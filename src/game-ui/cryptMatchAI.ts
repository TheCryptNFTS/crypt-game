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
import { compileAbility } from "../engine/abilityCompiler";

// Plays reference a card by id (not hand index): the hook re-finds the card's
// CURRENT index in P2's live hand at apply time, so plans stay correct even as
// earlier plays splice the hand. Spell targets reference an instanceId that
// exists at plan time (an EXISTING board unit), so they survive hand churn too.
export type AiAction =
  | { kind: "playUnit"; cardId: string; lane: "front" | "back" }
  | { kind: "playArtifact"; cardId: string }
  | { kind: "playSpell"; cardId: string; targetInstanceId?: string }
  | { kind: "equip"; cardId: string; targetInstanceId: string }
  | { kind: "attackUnit"; attackerInstanceId: string; defenderInstanceId: string }
  | { kind: "attackFace"; attackerInstanceId: string };

type CardMeta = {
  id: string;
  type: "unit" | "equipment" | "artifact" | "spell";
  cost: number;
  attack: number;
  health: number;
  /** Spell targeting (mirrors the reducer's PLAY_SPELL classification). */
  spell?: { needsTarget: boolean; wantsEnemy: boolean };
};

// Mirror the reducer's PLAY_SPELL target classification (reducer.ts): damage /
// debuff / destroy / bounce want an ENEMY unit; heal / self-buff want an ALLY;
// everything else needs no target.
const SPELL_ENEMY_OPS = ["DEAL_DAMAGE", "DEBUFF_ENEMY", "DESTROY_UNIT", "RETURN_TO_HAND"];
const SPELL_ALLY_OPS = ["HEAL", "BUFF_SELF"];

function classifySpell(card: any): { needsTarget: boolean; wantsEnemy: boolean } {
  const specs = (compileAbility(card?.rawTraits?.Ability).specs ?? []) as any[];
  const wantsEnemy = specs.some((s) => SPELL_ENEMY_OPS.includes(s.op));
  const wantsAlly = specs.some((s) => SPELL_ALLY_OPS.includes(s.op));
  return { needsTarget: wantsEnemy || wantsAlly, wantsEnemy };
}

const META = new Map<string, CardMeta>(
  (allPlayableCards as any[]).map((c) => [
    c.id,
    {
      id: c.id,
      type: c.type,
      cost: c.cost ?? 0,
      attack: c.stats?.attack ?? 0,
      health: c.stats?.health ?? 0,
      spell: c.type === "spell" ? classifySpell(c) : undefined,
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
 *
 * SINGLE-SHOT (legacy) path: plays then combat are planned off the SAME
 * pre-play board, so a unit summoned THIS turn is never planned as an attacker
 * (its instanceId doesn't exist yet) — even one with RUSH. Callers that want a
 * freshly-summoned RUSH unit to swing should instead run the two phases against
 * a re-derived board: apply `planP2Plays(match)`, then plan `planP2Combat` on
 * the POST-play state (where the new unit is live, has a real instanceId, and
 * `summoningSick` is already false for RUSH).
 */
export function planP2Turn(match: any): AiAction[] {
  if (!match || match.winner) return [];
  return [...planP2Plays(match), ...planP2Combat(match)];
}

/**
 * PHASE 1 — the play/equip/artifact plan for P2 (no combat). Pure; reads the
 * pre-play board to size an energy budget and choose targets.
 */
export function planP2Plays(match: any): AiAction[] {
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

  // --- Cast spells with leftover energy. Cheapest-first so we squeeze several
  // small spells out of the turn. Removal/burn (enemy-target) hits the strongest
  // enemy threat; heal/self-buff lands on our strongest body; no-target value
  // spells (draw / summon / AoE / nexus heal) fire directly. A spell with NO
  // legal target is skipped (e.g. a removal spell vs an empty enemy board), which
  // mirrors the reducer rejecting a missing target. Targets reference EXISTING
  // board units (real instanceIds), so the plan survives hand churn. ---
  const enemyForSpell = lanesOf(match.players?.P1).filter((u) => (u.health ?? 0) > 0);
  const allyForSpell = lanesOf(match.players?.P2).filter((u) => (u.health ?? 0) > 0);
  const strongest = (us: any[]) =>
    us.length ? [...us].sort((a, b) => (b.attack ?? 0) - (a.attack ?? 0))[0] : null;
  // A few casts max, re-scanning `working` cheapest-first each pass.
  for (let cast = 0; cast < 4; cast += 1) {
    let bestPos = -1;
    let bestCost = Infinity;
    for (let i = 0; i < working.length; i += 1) {
      const m = meta(working[i].cardId);
      if (!m || m.type !== "spell" || !m.spell) continue;
      if (m.cost > energy) continue;
      if (m.cost < bestCost) {
        bestCost = m.cost;
        bestPos = i;
      }
    }
    if (bestPos < 0) break;
    const m = meta(working[bestPos].cardId)!;
    const info = m.spell!;
    let targetInstanceId: string | undefined;
    if (info.needsTarget) {
      const target = info.wantsEnemy ? strongest(enemyForSpell) : strongest(allyForSpell);
      if (!target?.instanceId) {
        // No legal target this turn — drop this spell from consideration and retry.
        working.splice(bestPos, 1);
        continue;
      }
      targetInstanceId = target.instanceId;
    }
    energy -= m.cost;
    actions.push({ kind: "playSpell", cardId: working[bestPos].cardId, targetInstanceId });
    working.splice(bestPos, 1);
  }

  return actions;
}

/**
 * PHASE 2 — the combat plan for P2, read off the CURRENT board. Pure. Callers
 * that planned + applied PHASE 1 should call this on the post-play state so a
 * freshly-summoned RUSH unit (now live, real instanceId, `summoningSick` false)
 * is planned as an attacker.
 */
export function planP2Combat(match: any): AiAction[] {
  if (!match || match.winner) return [];

  const actions: AiAction[] = [];

  // --- Combat: each ready P2 unit attacks. ---
  // A unit can attack iff it is not exhausted AND not summoning-sick (unless it
  // has RUSH — mirrors engine `unitCanAttack`). Reading the live board means a
  // RUSH unit summoned earlier THIS turn is included; an ordinary fresh unit
  // (summoningSick=true) is correctly excluded so we never plan an illegal swing.
  const attackers = lanesOf(match.players?.P2).filter(
    (u) =>
      !u.exhausted &&
      (!u.summoningSick ||
        (Array.isArray(u?.keywords) && u.keywords.includes("RUSH")) ||
        (Array.isArray(u?.auraKeywords) && u.auraKeywords.includes("RUSH")))
  );
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
