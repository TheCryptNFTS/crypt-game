/**
 * dev:real-play-path — closes the test-coverage gap that let BUG 1 (aura phantom
 * damage) and BUG 2 (board stats diverging from the catalog) ship past the green
 * gates. The pre-existing proofs build units with crafted `unit()` helpers that
 * BYPASS the real instantiation/play path, so a played `tcg_*` unit entering the
 * board at a 0/1 stub (BUG 2) and an aura over a REAL damaged unit (BUG 1) were
 * never asserted.
 *
 * This proof drives the REAL path end-to-end:
 *   1. Build a match the way the game/e2e harness does (createMatchFromDecks).
 *   2. Play real `tcg_*` units through `applyAction` PLAY_UNIT (-> playUnitFromHand).
 *   3. Assert every board instance's attack/health/maxHealth/keywords == its
 *      override-patched catalog entry (cardMetaById / allPlayableCards) — BUG 2.
 *   4. Assert an OVERRIDDEN card enters with its overridden stats — BUG 2.
 *   5. Assert an aura over a REAL damaged beneficiary survives correctly when the
 *      source dies (no phantom damage) — BUG 1, via the real play path.
 *
 * Deterministic: fixed seed, no Date/Math.random. check(name,cond,detail) +
 * process.exit(1) on any failure.
 */

import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import { getPlayableCardById } from "../engine/cards";
import { applyAction } from "../engine/reducer";
import { compileAbility } from "../engine/abilityCompiler";
import { BASE_MAX_ENERGY, STARTING_NEXUS_HEALTH, MatchState } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`OK: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

/** Build a real match exactly like the e2e harness, with plentiful energy so we
 *  can play arbitrary tcg_* units through the real PLAY_UNIT path. */
function freshMatch(seed: number): MatchState {
  const c1 = allCommanders[0];
  const c2 = allCommanders.find((c: any) => c.id !== c1.id) ?? c1;
  const deck = buildPlayerDeck().deck;
  const match: any = createMatchFromDecks({
    p1: { commanderId: c1.id, deck },
    p2: { commanderId: c2.id, deck },
    seed,
    openingHandSize: 6,
  });
  match.activePlayer = "P1";
  match.turn = 1;
  match.winner = null;
  match.players.P1.maxEnergy = 99;
  match.players.P1.energy = 99;
  match.players.P2.maxEnergy = BASE_MAX_ENERGY;
  match.players.P2.energy = BASE_MAX_ENERGY;
  match.players.P1.nexusHealth = STARTING_NEXUS_HEALTH;
  match.players.P2.nexusHealth = STARTING_NEXUS_HEALTH;
  return match as MatchState;
}

/** Play a card id from P1's hand (front lane) through the REAL reducer path and
 *  return the freshly-instantiated board unit. */
function playUnit(state: MatchState, cardId: string): { state: MatchState; unit: any } {
  const m: any = state;
  m.players.P1.hand = [cardId, ...m.players.P1.hand];
  const res = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const front = res.state.players.P1.board.front;
  return { state: res.state, unit: front[front.length - 1] };
}

function abilityHasOnSummonBuff(cardId: string): boolean {
  const meta = getPlayableCardById(cardId);
  const text = meta?.rawTraits?.Ability ?? "";
  // Only treat as a battlecry self-buff if the compiled ability actually has an
  // ON_SUMMON BUFF_SELF (so we can predict the post-summon stat delta).
  return compileAbility(text).specs.some(
    (s: any) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF"
  );
}

/** The on-summon stat delta the controller's COMMANDER passive applies to a unit
 *  (commanderPassives.ts). The board line must equal catalog stats PLUS this, so
 *  we assert against the catalog + commander delta — not catalog alone. */
function commanderSummonDelta(commanderId: string, cardId: string): { atk: number; hp: number } {
  const meta = getPlayableCardById(cardId);
  const kw = meta?.keywords ?? [];
  if (commanderId === "cmd_stone_warden" && kw.includes("GUARD")) return { atk: 0, hp: 2 };
  if (commanderId === "cmd_golden_emperor" && (meta?.cost ?? 0) >= 5) return { atk: 1, hp: 1 };
  return { atk: 0, hp: 0 };
}

function run() {
  // ---- BUG 2: board stats == catalog stats for a spread of REAL tcg_* units ---
  // Pick a deterministic spread of unit ids that exist in the catalog, skipping
  // any whose ability adds an ON_SUMMON self-buff (those legitimately differ from
  // the printed line) so the equality assertion is exact.
  const sampleIds: string[] = [];
  let scanState = freshMatch(1001);
  for (let n = 1; n <= 600 && sampleIds.length < 12; n += 1) {
    const id = `tcg_${n}`;
    const meta = getPlayableCardById(id);
    if (!meta || meta.type !== "unit") continue;
    if (meta.disabled) continue;
    if (abilityHasOnSummonBuff(id)) continue;
    sampleIds.push(id);
  }
  check("found a spread of real tcg_* units to play", sampleIds.length >= 8, sampleIds);

  const p1Commander = (scanState as any).players.P1.commanderId as string;
  for (const id of sampleIds) {
    const meta = getPlayableCardById(id)!;
    const { state, unit } = playUnit(scanState, id);
    scanState = state;
    // Board base line must equal the catalog (override-patched) line PLUS the
    // controller's commander on-summon passive delta. Pre-fix, board entered at a
    // 0/1 stub (BUG 2) — catalog atk/health was simply ignored.
    const d = commanderSummonDelta(p1Commander, id);
    const expAtk = meta.stats.attack + d.atk;
    const expHp = meta.stats.health + d.hp;
    const statsOk =
      unit.attack === expAtk &&
      unit.health === expHp &&
      unit.maxHealth === expHp;
    const kwOk = JSON.stringify([...unit.keywords].sort()) === JSON.stringify([...meta.keywords].sort());
    check(
      `BUG2: ${id} board stats == catalog+cmd (${expAtk}/${expHp}; catalog ${meta.stats.attack}/${meta.stats.health})`,
      statsOk,
      { board: { atk: unit.attack, hp: unit.health, max: unit.maxHealth }, catalog: meta.stats, cmdDelta: d }
    );
    check(`BUG2: ${id} board keywords == catalog`, kwOk, { board: unit.keywords, catalog: meta.keywords });
  }

  // ---- BUG 2: an OVERRIDDEN card enters with its OVERRIDDEN stats --------------
  // tcg_475 is overridden to 15/9 (from a 0/1 generated stub). It must enter the
  // board at 15/9, proving the play path reads the override-patched catalog.
  {
    const meta = getPlayableCardById("tcg_475")!;
    check("BUG2 setup: tcg_475 catalog is overridden to 15/9", meta.stats.attack === 15 && meta.stats.health === 9, meta.stats);
    const { unit } = playUnit(freshMatch(1002), "tcg_475");
    check(
      "BUG2: overridden tcg_475 enters board at overridden 15/9 (not 0/1 stub)",
      unit.attack === 15 && unit.health === 9 && unit.maxHealth === 9,
      { atk: unit.attack, hp: unit.health, max: unit.maxHealth }
    );
  }

  // ---- BUG 1: aura over a REAL damaged beneficiary, via the real play path -----
  // Play a real unit, CHIP it below an aura-inflated max, then strip the aura by
  // mutating its aura bonus directly and recomputing through a board change. We
  // verify the clamp-not-subtract semantics on a unit instantiated by the REAL
  // path (no crafted unit() helper).
  {
    let state: any = freshMatch(1003);
    // Pick a real vanilla-ish unit with health >= 3 and no on-summon buff.
    let pick: string | null = null;
    for (let n = 1; n <= 600; n += 1) {
      const id = `tcg_${n}`;
      const meta = getPlayableCardById(id);
      if (!meta || meta.type !== "unit" || meta.disabled) continue;
      if (meta.stats.health < 3) continue;
      if (abilityHasOnSummonBuff(id)) continue;
      pick = id;
      break;
    }
    check("BUG1 setup: found a real >=3 health unit", !!pick, pick);
    const played = playUnit(state, pick!);
    state = played.state;
    const beneficiary = played.unit;
    const baseMax = beneficiary.maxHealth;

    // Simulate having been under a +0/+3 aura (max baseMax+3) but chipped down to
    // current = baseMax (i.e. BELOW the inflated max). Then strip the aura.
    beneficiary.auraHp = 3;
    beneficiary.maxHealth = baseMax + 3;
    beneficiary.health = baseMax; // chipped below inflated max, at true base max

    // A board change triggers recomputeAuras (strip). Play a second unit to force
    // the recompute through the real reducer path.
    const before = { hp: beneficiary.health, max: beneficiary.maxHealth };
    const after = playUnit(state, pick!);
    state = after.state;
    const reben = state.players.P1.board.front.find((u: any) => u.instanceId === beneficiary.instanceId);
    check(
      "BUG1: chipped beneficiary SURVIVES aura strip (no phantom damage)",
      !!reben && reben.health === baseMax && reben.maxHealth === baseMax,
      { before, after: reben ? { hp: reben.health, max: reben.maxHealth } : null, baseMax }
    );
  }

  console.log("\n=== REAL PLAY-PATH PROOF (board stats == catalog; aura over real units) ===");
  if (failures > 0) {
    console.error(`FAILED: ${failures} real-play-path check(s) failed.`);
    process.exit(1);
  }
  console.log("ALL REAL PLAY-PATH PROOFS PASSED");
}

run();
