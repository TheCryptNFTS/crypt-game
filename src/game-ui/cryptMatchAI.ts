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
import { classifySpellTargeting } from "../engine/spellTargeting";
import { MAX_LANE_UNITS } from "../engine/state";

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
  | { kind: "attackFace"; attackerInstanceId: string }
  // THE SURGE (#4 — the "Snap" beat): ready the whole side + spike energy for an
  // all-in alpha-strike. The AI emits this only to CONVERT a turn to lethal (see
  // planP2Surge), so it always reads as a decisive "it went for the kill" moment.
  | { kind: "surge" };

type CardMeta = {
  id: string;
  type: "unit" | "equipment" | "artifact" | "spell";
  cost: number;
  attack: number;
  health: number;
  /** Spell targeting (mirrors the reducer's PLAY_SPELL classification). */
  spell?: { needsTarget: boolean; wantsEnemy: boolean };
};

// Spell targeting (damage/debuff/destroy/bounce → ENEMY; heal/self-buff → ALLY)
// now lives in the shared engine/spellTargeting util so the planner and the
// board's cast-target highlight share ONE source of truth.
const classifySpell = classifySpellTargeting;

// Raw card lookup (carries rawTraits.Ability) so the planner can compile a
// unit's ability — needed to detect PATIENT's STATIC "cannot attack" marker.
const RAW_CARD_BY_ID = new Map<string, any>(
  (allPlayableCards as any[]).map((c) => [c.id, c]),
);

/**
 * True if a unit's compiled ability carries PATIENT's STATIC RESTRICT_ATTACK
 * marker ("this unit cannot attack"). The reducer now rejects such attacks
 * (reason "attacker-cannot-attack"), so the planner MUST exclude these units or
 * it desyncs by planning an illegal swing. Fear's RESTRICT_ATTACK is trigger
 * "PASSIVE" (a defender rule) and is deliberately NOT matched here.
 */
function cannotAttack(unit: any): boolean {
  const card = RAW_CARD_BY_ID.get(unit?.cardId);
  if (!card) return false;
  const specs = (compileAbility(card?.rawTraits?.Ability).specs ?? []) as any[];
  return specs.some((s) => s.op === "RESTRICT_ATTACK" && s.trigger === "STATIC");
}

/**
 * True if a unit carries COMMANDER_SHIELD (e.g. Skull Island). The reducer
 * REJECTS face swings ("commander-shielded") while the DEFENDING player controls
 * any live unit with this passive (reducer.ts ATTACK_FACE ~L1714, via
 * `boardHasOp(... "COMMANDER_SHIELD")` → `unitHasOp` → ANY trigger). The compiler
 * emits it as `{ trigger: "PASSIVE", op: "COMMANDER_SHIELD" }` (abilityCompiler
 * ~L1263), but the reducer matches on op alone, so we match on op alone too.
 */
function hasCommanderShield(unit: any): boolean {
  const card = RAW_CARD_BY_ID.get(unit?.cardId);
  if (!card) return false;
  const specs = (compileAbility(card?.rawTraits?.Ability).specs ?? []) as any[];
  return specs.some((s) => s.op === "COMMANDER_SHIELD");
}

/**
 * True if `defender` FEARS `attacker`: the defender carries Fear's defender-side
 * RESTRICT_ATTACK (trigger "PASSIVE", with a `costThreshold`) AND the attacker's
 * cost is at/below that threshold — exactly what the reducer rejects with
 * "attacker-feared" (reducer.ts ATTACK_UNIT ~L1670-1672, via `passiveSpec(...,
 * "RESTRICT_ATTACK")` which gates on trigger === "PASSIVE", then
 * `costOf(attacker) <= (fear.costThreshold ?? 0)`). costOf reads the STATIC card
 * cost, identical to the planner's `meta().cost`. PATIENT's STATIC
 * RESTRICT_ATTACK (no costThreshold) is excluded by the trigger gate, mirroring
 * `passiveSpec`. A low-cost attacker barred this way contributes NO damage, so
 * it must be dropped from both the unit plan and the lethal faceDmg sum.
 */
function isFearedBy(attacker: any, defender: any): boolean {
  const card = RAW_CARD_BY_ID.get(defender?.cardId);
  if (!card) return false;
  const specs = (compileAbility(card?.rawTraits?.Ability).specs ?? []) as any[];
  const fear = specs.find(
    (s) => s.op === "RESTRICT_ATTACK" && s.trigger === "PASSIVE",
  );
  if (!fear) return false;
  const attackerCost = meta(attacker?.cardId)?.cost ?? 0;
  return attackerCost <= (fear.costThreshold ?? 0);
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

// --- Difficulty tiers -------------------------------------------------------
//
// Three profiles tune HOW MUCH of the board the AI commits and HOW SMART its
// combat is. NORMAL is the historical greedy behavior (byte-for-byte unchanged
// so harnesses/regression stay deterministic). EASY plays passively and
// fumbles lethal; HARD trades + tempos better and always takes lethal.
export type AiDifficulty = "easy" | "normal" | "hard";

export const AI_DIFFICULTY_KEY = "crypt_ai_difficulty";

type DifficultyProfile = {
  /** Max units to deploy per turn (board commitment / under-deploy knob). */
  maxDeploys: number;
  /** Skip a favorable trade and hit face instead? (EASY plays sloppily.) */
  skipTrades: boolean;
  /** Take lethal face damage when the swing is exact-or-over? */
  takeLethal: boolean;
};

const PROFILES: Record<AiDifficulty, DifficultyProfile> = {
  // EASY: under-deploys (2 units), often ignores trades, never hunts lethal.
  easy: { maxDeploys: 2, skipTrades: true, takeLethal: false },
  // NORMAL: the original greedy policy — 4 deploys, takes trades, no lethal math.
  normal: { maxDeploys: 4, skipTrades: false, takeLethal: false },
  // HARD: full board (5), always trades, and prioritizes lethal when on the table.
  hard: { maxDeploys: 5, skipTrades: false, takeLethal: true },
};

/**
 * Self-read the chosen difficulty from localStorage. Browser-safe: in any
 * non-browser context (regression harnesses, SSR, Node) `localStorage` is
 * undefined, so we fall back to NORMAL — which keeps the planner byte-identical
 * to its historical greedy behavior and the regression suite deterministic.
 */
/** localStorage flag set by localProgress.markFirstWin — read directly (same
 *  pattern as MATCHES_TOTAL_KEY below) to avoid a module cycle. */
const FIRST_WIN_KEY = "crypt.progress.firstWin";

export function readAiDifficulty(fallback: AiDifficulty = "normal"): AiDifficulty {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(AI_DIFFICULTY_KEY)
        : null;
    if (raw === "easy" || raw === "normal" || raw === "hard") return raw;
    // GENTLE DEFAULT (holder feedback 2026-06-11: a first-time, non-TCG player
    // "got rekt 5 times in a row" — the old newcomer ramp died with the hidden
    // ramp removal, leaving fresh players on NORMAL). Until the FIRST WIN is
    // banked, the no-choice default is the Initiate boss (easy). VISIBLE, not
    // hidden: Home's boss row derives its selection from this same read, so a
    // newcomer sees Warden Kael selected. An explicit pick above always wins;
    // after the first win the default returns to `fallback`.
    if (typeof localStorage !== "undefined" && localStorage.getItem(FIRST_WIN_KEY) !== "1") {
      return "easy";
    }
  } catch {
    // localStorage can throw (private mode / disabled storage) — use the fallback.
  }
  // `fallback` defaults to NORMAL so Node harnesses (no localStorage) stay
  // byte-identical & deterministic; the browser hook passes "hard" so a real
  // solo match faces an opponent that commits the board and takes lethal.
  return fallback;
}

/** localStorage key the rest of the app writes the lifetime match count to. */
const MATCHES_TOTAL_KEY = "crypt.progress.matchesTotal";

/**
 * NEW-PLAYER DIFFICULTY RAMP. A brand-new pilot shouldn't meet the lethal "hard"
 * AI on match one — that's the most likely "this is too hard, I'm out" moment.
 * So unless the player has EXPLICITLY chosen a difficulty (the settings key is
 * set), we ramp by lifetime matches played:
 *   • matches 0–1  → EASY   (under-deploys, fumbles lethal — a gentle on-ramp)
 *   • matches 2–3  → NORMAL (greedy trades, no lethal hunt)
 *   • matches 4+   → HARD   (full board + takes lethal — the real opponent)
 * An explicit choice always wins (readAiDifficulty returns it). Node/harness
 * contexts (no localStorage) fall through to NORMAL for determinism.
 */
export function rampedAiDifficulty(): AiDifficulty {
  try {
    if (typeof localStorage !== "undefined") {
      // An explicit user setting overrides the ramp entirely.
      const chosen = localStorage.getItem(AI_DIFFICULTY_KEY);
      if (chosen === "easy" || chosen === "normal" || chosen === "hard") return chosen;
      const played = Number(localStorage.getItem(MATCHES_TOTAL_KEY) ?? 0);
      if (Number.isFinite(played)) {
        if (played <= 1) return "easy";
        if (played <= 3) return "normal";
        return "hard";
      }
    }
  } catch {
    // private mode / disabled storage — fall through to NORMAL.
  }
  return "normal";
}

// Tiny deterministic hash → [0,1). Derived from match.seed so EASY's "sloppy"
// choices REPLAY exactly for a given match (matches the AI's no-Math.random
// discipline). `salt` lets distinct decisions in the same turn diverge.
function seededUnit(seed: number, salt: number): number {
  let x = (Math.floor(seed) ^ Math.floor(salt) ^ 0x9e3779b9) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5;
  x >>>= 0;
  return x / 0xffffffff;
}

// Stable numeric salt from an instanceId string (FNV-1a-ish). Lets each
// attacker's seeded decision diverge while replaying for a fixed match.
function hashInstance(id: string): number {
  let h = 2166136261 >>> 0;
  const s = String(id ?? "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
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
export function planP2Turn(match: any, difficulty?: AiDifficulty): AiAction[] {
  if (!match || match.winner) return [];
  // Self-read difficulty from localStorage when the caller didn't pin one. This
  // keeps the hook/page wiring untouched: the AI reads its own setting.
  const diff = difficulty ?? readAiDifficulty();
  return [...planP2Plays(match, diff), ...planP2Combat(match, diff)];
}

/**
 * PHASE 1 — the play/equip/artifact plan for P2 (no combat). Pure; reads the
 * pre-play board to size an energy budget and choose targets.
 */
export function planP2Plays(match: any, difficulty: AiDifficulty = "normal"): AiAction[] {
  if (!match || match.winner) return [];

  const profile = PROFILES[difficulty] ?? PROFILES.normal;
  const actions: AiAction[] = [];

  // --- 1. Cast/play from hand within a simulated energy budget. ---
  let energy: number = match.players?.P2?.energy ?? 0;
  const hand: string[] = [...(match.players?.P2?.hand ?? [])];

  // Working list of {cardId} we remove from as we plan, so we never plan the
  // same physical card twice.
  const working = hand.map((cardId) => ({ cardId }));

  // LANE CAPACITY (mirror the reducer): a lane holds at most MAX_LANE_UNITS, and
  // PLAY_UNIT rejects "lane-full" once it does. Track the SIMULATED fill of each
  // lane as we plan so consecutive deploys this turn spill into the back lane
  // instead of all targeting a now-full front (which the reducer would reject,
  // leaving the AI unable to develop its board in a long match — it would sit
  // with a bloated hand and an idle back lane). Seed from the live board.
  const laneFill: { front: number; back: number } = {
    front: (match.players?.P2?.board?.front ?? []).length,
    back: (match.players?.P2?.board?.back ?? []).length,
  };
  // Front-first, back fallback; null when BOTH lanes are full (skip the play so we
  // never plan a guaranteed-reject deploy).
  const openLane = (): "front" | "back" | null => {
    if (laneFill.front < MAX_LANE_UNITS) return "front";
    if (laneFill.back < MAX_LANE_UNITS) return "back";
    return null;
  };

  const tryPlayBestUnit = (): boolean => {
    const lane = openLane();
    if (lane === null) return false; // board full — no legal deploy
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
    actions.push({ kind: "playUnit", cardId: working[bestPos].cardId, lane });
    laneFill[lane] += 1;
    working.splice(bestPos, 1);
    return true;
  };

  // Fill up to `maxDeploys` units (board space is soft; cap to avoid dumping the
  // hand). EASY under-deploys (2), NORMAL fills 4, HARD commits a full 5.
  for (let i = 0; i < profile.maxDeploys; i += 1) {
    if (!tryPlayBestUnit()) break;
  }

  // ARTIFACTS CUT FROM V1 (teardown §11 P1): the AI no longer plays artifacts.
  // They do nothing for their cost and resetUnitToBase wipes the AI's OWN buffs
  // on play (D3) — the bot was self-harming every game it drew one. Decks no
  // longer contain artifacts either; this is the matching planner change.

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
  // Exclude stealthed enemy units — the reducer rejects them as spell targets
  // (same as combat), so picking one would waste the AI's cast. Mirrors the
  // combat-path stealth guard.
  const enemyForSpell = lanesOf(match.players?.P1).filter((u) => (u.health ?? 0) > 0 && !u.stealthed);
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
/**
 * THE SURGE (#4) — the AI's "snap for the kill" decision. Returns a single
 * `{ kind: "surge" }` iff readying its summoning-sick units would UNLOCK lethal it
 * does not already have. It mirrors planP2Combat's hard-lethal gate exactly (no enemy
 * GUARD wall, no commander shield, WINDFURY counts double), so the surge + the combat
 * that follows agree on the kill. Conservative by construction: the AI never burns its
 * one-per-match Surge on a non-converting turn, so it always reads as a decisive
 * all-in. Only a `takeLethal` profile (Sovereign/hard) snaps — EASY/NORMAL keep their
 * non-lethal-reading policy, matching the combat planner. Called between plays and
 * combat so the readied units enter planP2Combat as live attackers.
 */
export function planP2Surge(match: any, difficulty: AiDifficulty = "normal"): AiAction[] {
  if (!match || match.winner) return [];
  if (!match.rules?.surge) return [];
  if (match.players?.P2?.surgeUsed) return [];
  const profile = PROFILES[difficulty] ?? PROFILES.normal;
  if (!profile.takeLethal) return [];

  const hasKw = (u: any, k: string) =>
    (Array.isArray(u?.keywords) && u.keywords.includes(k)) ||
    (Array.isArray(u?.auraKeywords) && u.auraKeywords.includes(k));

  // Lethal is only open with no GUARD wall and no commander shield (mirror combat).
  const enemyUnits = lanesOf(match.players?.P1);
  if (enemyUnits.some((u) => hasKw(u, "GUARD"))) return [];
  if (enemyUnits.some((u) => hasCommanderShield(u))) return [];
  const enemyNexus = Number(match.players?.P1?.nexusHealth ?? 0);
  if (enemyNexus <= 0) return [];

  const faceOf = (u: any) => (u?.attack ?? 0) * (hasKw(u, "WINDFURY") ? 2 : 1);
  const myUnits = lanesOf(match.players?.P2);
  // Units that can already swing this turn (mirrors planP2Combat's `attackers`).
  const canSwingNow = (u: any) =>
    !u.exhausted && !cannotAttack(u) && (!u.summoningSick || hasKw(u, "RUSH"));
  // Summoning-sick (non-RUSH) units the Surge would ready — PATIENT/cannot-attack
  // units are excluded (readying sickness doesn't make them legal attackers).
  const surgeReadies = (u: any) =>
    !u.exhausted && !cannotAttack(u) && u.summoningSick && !hasKw(u, "RUSH");

  const nowDmg = myUnits.filter(canSwingNow).reduce((s, u) => s + faceOf(u), 0);
  const afterDmg = nowDmg + myUnits.filter(surgeReadies).reduce((s, u) => s + faceOf(u), 0);

  // Snap ONLY if it converts: not already lethal, but lethal once readied.
  if (nowDmg < enemyNexus && afterDmg >= enemyNexus) return [{ kind: "surge" }];
  return [];
}

export function planP2Combat(match: any, difficulty: AiDifficulty = "normal"): AiAction[] {
  if (!match || match.winner) return [];

  const profile = PROFILES[difficulty] ?? PROFILES.normal;
  const seed = Number(match.seed ?? 0);
  const actions: AiAction[] = [];

  // --- Combat: each ready P2 unit attacks. ---
  // A unit can attack iff it is not exhausted AND not summoning-sick (unless it
  // has RUSH — mirrors engine `unitCanAttack`). Reading the live board means a
  // RUSH unit summoned earlier THIS turn is included; an ordinary fresh unit
  // (summoningSick=true) is correctly excluded so we never plan an illegal swing.
  const attackers = lanesOf(match.players?.P2).filter(
    (u) =>
      !u.exhausted &&
      // PATIENT units cannot declare attacks (reducer rejects them); excluding
      // them here keeps the planner in lockstep with the reducer.
      !cannotAttack(u) &&
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
  // COMMANDER_SHIELD (e.g. Skull Island): while the enemy controls ANY live unit
  // with this passive, the reducer REJECTS every face swing ("commander-shielded",
  // reducer.ts ~L1714). Mirror that here so the planner never wastes its turn (or
  // miscomputes lethal) fumbling face into a shielded commander — it must clear
  // the board first. boardHasOp matches on op alone, so we OR over all enemy units.
  const enemyCommanderShielded = enemyUnits.some((u) => hasCommanderShield(u));
  // FLYING (evasion) + STEALTH + FEAR: only flyers / RANGED can hit a flyer; a
  // stealthed unit cannot be targeted at all until it reveals; and a Fear unit
  // rejects any attacker whose cost is at/below its threshold (reducer.ts ~L1670).
  // canHit folds all three so legalDefenders never contains a swing the reducer
  // would reject — matching the GUARD/FLYING/STEALTH discipline already here.
  const canHit = (attacker: any, def: any) =>
    !def?.stealthed &&
    !isFearedBy(attacker, def) &&
    (!hasKw(def, "FLYING") || hasKw(attacker, "FLYING") || hasKw(attacker, "RANGED"));
  // SHIELD / WARD / DIVINE_SHIELD: an armed shield absorbs the first instance of
  // damage outright, so a single swing canNOT kill a shielded defender no matter
  // how much attack we have. The live unit carries `shielded` once armed.
  const isShielded = (u: any) => u?.shielded === true;

  // HARD lethal check: if there is NO enemy GUARD wall, NO enemy COMMANDER_SHIELD,
  // and the sum of our ready attackers' damage meets-or-exceeds the enemy nexus,
  // send EVERYTHING face for the kill, ignoring trades. The COMMANDER_SHIELD gate
  // mirrors the reducer's ATTACK_FACE rejection ("commander-shielded", ~L1714):
  // every face swing is illegal while the enemy controls a shielded commander, so
  // computing/committing a face-lethal there would throw away the whole turn. When
  // shielded (or walled), the AI falls through to the per-unit loop below and
  // attacks units to clear the board instead. (EASY/NORMAL never compute lethal —
  // EASY by design under-reads the board, NORMAL keeps its historical greedy policy.)
  if (profile.takeLethal && enemyGuards.length === 0 && !enemyCommanderShielded) {
    const enemyNexus = Number(match.players?.P1?.nexusHealth ?? 0);
    let faceDmg = 0;
    for (const a of attackers) {
      if (!a?.instanceId) continue;
      const swings = hasKw(a, "WINDFURY") ? 2 : 1;
      faceDmg += (a.attack ?? 0) * swings;
    }
    if (enemyNexus > 0 && faceDmg >= enemyNexus) {
      for (const a of attackers) {
        if (!a?.instanceId) continue;
        const swings = hasKw(a, "WINDFURY") ? 2 : 1;
        for (let s = 0; s < swings; s += 1) {
          actions.push({ kind: "attackFace", attackerInstanceId: a.instanceId });
        }
      }
      return actions;
    }
  }

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

    // EASY plays sloppily: roughly half the time it walks past a favorable trade
    // and swings face instead. Deterministic per (seed, attacker) so a match
    // replays identically — no Math.random (matches the AI's randomness rule).
    if (
      profile.skipTrades &&
      favorable &&
      enemyGuards.length === 0 &&
      seededUnit(seed, hashInstance(attacker.instanceId)) < 0.5
    ) {
      favorable = null;
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
      } else if (enemyGuards.length > 0 || enemyCommanderShielded) {
        // Forced to attack a unit, not the face: either a GUARD wall stands, or
        // the enemy controls a COMMANDER_SHIELD (the reducer rejects EVERY face
        // swing while it lives, ~L1714). Chip the strongest legal defender we can
        // hit to clear toward an opening, rather than wasting the swing on an
        // illegal face attack. legalDefenders already excludes flyers we can't
        // reach, stealthed units, and Fear-restricted matchups (via canHit).
        const chip =
          [...legalDefenders].sort((a, b) => (b.attack ?? 0) - (a.attack ?? 0))[0];
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
