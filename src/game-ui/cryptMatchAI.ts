/**
 * Greedy single-player AI for P2 in the local Crypt match.
 *
 * Pure decision module: given a snapshot of the match it returns an ordered
 * list of high-level actions for P2's turn. The hook is responsible for
 * actually applying these via the existing play/attack primitives on cloned
 * state, then ending the turn. Keeping this pure (no engine mutation here)
 * makes it trivial to reason about and impossible to hang the turn.
 *
 * Policy (greedy, intentionally simple):
 *   1. Play the most expensive affordable units first to fill the board,
 *      preferring the front lane (where combat happens in this hook).
 *   2. Equip the strongest affordable equipment onto our biggest unit.
 *   3. With each ready unit, attack into a favorable trade if one exists
 *      (we kill them and survive), otherwise attack face.
 */

import { allPlayableCards } from "../engine/cards";

// Plays reference a card by id (not hand index): the hook re-finds the card's
// CURRENT index in P2's live hand at apply time, so plans stay correct even as
// earlier plays splice the hand.
export type AiAction =
  | { kind: "playUnit"; cardId: string; lane: "front" | "back" }
  | { kind: "playArtifact"; cardId: string }
  | { kind: "equip"; cardId: string; targetInstanceId: string }
  | { kind: "attackUnit"; attackerInstanceId: string; defenderInstanceId: string }
  | { kind: "attackFace"; attackerInstanceId: string };

type CardMeta = {
  id: string;
  type: "unit" | "equipment" | "artifact";
  cost: number;
  attack: number;
  health: number;
};

const META = new Map<string, CardMeta>(
  (allPlayableCards as any[]).map((c) => [
    c.id,
    {
      id: c.id,
      type: c.type,
      cost: c.cost ?? 0,
      attack: c.stats?.attack ?? 0,
      health: c.stats?.health ?? 0,
    } as CardMeta,
  ])
);

function meta(cardId: string): CardMeta | null {
  return META.get(cardId) ?? null;
}

function lanesOf(player: any): any[] {
  return [...(player?.board?.front ?? []), ...(player?.board?.back ?? [])];
}

/**
 * Returns the sequence of actions P2 should take this turn. Does NOT mutate
 * `match`. The caller applies them one at a time; if any individual primitive
 * rejects (energy/illegal), it can simply skip that action — the list is a
 * plan, not a guarantee.
 */
export function planP2Turn(match: any): AiAction[] {
  if (!match || match.winner) return [];

  const actions: AiAction[] = [];

  // --- 1. Cast/play from hand within a simulated energy budget. ---
  let energy: number = match.players?.P2?.energy ?? 0;
  const hand: string[] = [...(match.players?.P2?.hand ?? [])];

  // Working list of {cardId} we remove from as we plan, so we never plan the
  // same physical card twice.
  const working = hand.map((cardId) => ({ cardId }));

  const tryPlayBestUnit = (): boolean => {
    let bestPos = -1;
    let bestCost = -1;
    for (let i = 0; i < working.length; i += 1) {
      const m = meta(working[i].cardId);
      if (!m || m.type !== "unit") continue;
      if (m.cost > energy) continue;
      if (m.cost > bestCost) {
        bestCost = m.cost;
        bestPos = i;
      }
    }
    if (bestPos < 0) return false;
    energy -= bestCost;
    actions.push({ kind: "playUnit", cardId: working[bestPos].cardId, lane: "front" });
    working.splice(bestPos, 1);
    return true;
  };

  // Fill up to a few units (board space is soft; cap to avoid dumping the hand).
  for (let i = 0; i < 4; i += 1) {
    if (!tryPlayBestUnit()) break;
  }

  // Play one affordable artifact if we have spare energy (buffs our board).
  const artifactPos = working.findIndex((w) => {
    const m = meta(w.cardId);
    return !!m && m.type === "artifact" && m.cost <= energy;
  });
  if (artifactPos >= 0) {
    const m = meta(working[artifactPos].cardId)!;
    energy -= m.cost;
    actions.push({ kind: "playArtifact", cardId: working[artifactPos].cardId });
    working.splice(artifactPos, 1);
  }

  // Equip strongest affordable equipment onto our biggest existing unit.
  const myUnits = lanesOf(match.players?.P2);
  if (myUnits.length > 0) {
    let bestEq = -1;
    let bestEqCost = -1;
    for (let i = 0; i < working.length; i += 1) {
      const m = meta(working[i].cardId);
      if (!m || m.type !== "equipment") continue;
      if (m.cost > energy) continue;
      if (m.cost > bestEqCost) {
        bestEqCost = m.cost;
        bestEq = i;
      }
    }
    if (bestEq >= 0) {
      const target = [...myUnits].sort(
        (a, b) => (b.attack ?? 0) - (a.attack ?? 0)
      )[0];
      if (target?.instanceId) {
        energy -= bestEqCost;
        actions.push({
          kind: "equip",
          cardId: working[bestEq].cardId,
          targetInstanceId: target.instanceId,
        });
        working.splice(bestEq, 1);
      }
    }
  }

  // --- 2. Combat: each ready (non-exhausted) P2 unit attacks. ---
  // We approximate the post-play board: units just played this turn count as
  // attackers too (the hook doesn't impose summoning sickness on attacks),
  // but to stay safe we only plan attacks for units already on the board at
  // planning time — freshly-played ones simply attack next turn. This keeps
  // the plan robust against board churn.
  const attackers = lanesOf(match.players?.P2).filter((u) => !u.exhausted);
  const enemyUnits = lanesOf(match.players?.P1);
  const hasKw = (u: any, k: string) =>
    (Array.isArray(u?.keywords) && u.keywords.includes(k)) ||
    (Array.isArray(u?.auraKeywords) && u.auraKeywords.includes(k));
  // GUARD (taunt): a GUARD defender must be cleared before face / other units.
  const enemyGuards = enemyUnits.filter((u) => hasKw(u, "GUARD"));
  // FLYING (evasion) + STEALTH: only flyers / RANGED can hit a flyer, and a
  // stealthed unit cannot be targeted at all until it reveals.
  const canHit = (attacker: any, def: any) =>
    !def?.stealthed &&
    (!hasKw(def, "FLYING") || hasKw(attacker, "FLYING") || hasKw(attacker, "RANGED"));
  // SHIELD / WARD / DIVINE_SHIELD: an armed shield absorbs the first instance of
  // damage outright, so a single swing canNOT kill a shielded defender no matter
  // how much attack we have. The live unit carries `shielded` once armed.
  const isShielded = (u: any) => u?.shielded === true;

  for (const attacker of attackers) {
    if (!attacker?.instanceId) continue;
    const atk = attacker.attack ?? 0;
    const myHp = attacker.health ?? 0;
    // WINDFURY units may swing twice this turn.
    const swings = hasKw(attacker, "WINDFURY") ? 2 : 1;

    // Targets this attacker is actually allowed to hit (GUARD gate + FLYING).
    const legalDefenders = (enemyGuards.length > 0 ? enemyGuards : enemyUnits).filter(
      (def) => canHit(attacker, def)
    );

    // Find a favorable trade: a defender we can kill while surviving its counter.
    // A shielded defender survives the first hit, so it is never a one-swing kill.
    let favorable: any = null;
    for (const def of legalDefenders) {
      const defHp = def.health ?? 0;
      const defAtk = def.attack ?? 0;
      if (!isShielded(def) && atk >= defHp && defAtk < myHp) {
        // We kill it and live. Prefer killing the highest-attack threat.
        if (!favorable || (def.attack ?? 0) > (favorable.attack ?? 0)) {
          favorable = def;
        }
      }
    }

    // Plan up to `swings` attacks for this unit. The hook applies them in order
    // and tolerates a reject (e.g. the target died to the first swing), so a
    // Windfury unit's bonus swing falls through to face when no trade remains.
    for (let s = 0; s < swings; s += 1) {
      if (s === 0 && favorable?.instanceId) {
        actions.push({
          kind: "attackUnit",
          attackerInstanceId: attacker.instanceId,
          defenderInstanceId: favorable.instanceId,
        });
      } else if (enemyGuards.length > 0) {
        // Forced to deal with a GUARD wall: chip the one we can hit (if any),
        // rather than wasting the swing on an illegal face attack.
        const chip = legalDefenders[0];
        if (chip?.instanceId) {
          actions.push({
            kind: "attackUnit",
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: chip.instanceId,
          });
        }
      } else {
        actions.push({ kind: "attackFace", attackerInstanceId: attacker.instanceId });
      }
    }
  }

  return actions;
}
