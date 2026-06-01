/**
 * dev:missing-mechanics — pins the five formerly-UNKNOWN authored abilities that
 * the ability compiler now recognizes (coverage 4093/4093 = 100%). Each block
 * compiles the REAL card text from `generatedTcgCards.json` via `compileAbility`
 * (parser + resolver proven together, end-to-end) and asserts:
 *
 *   - the clause is RECOGNIZED (no UNKNOWN), and
 *   - for every REAL op, the live-shape mutation after `resolveEffect`.
 *
 * The five cards (all now REAL ops):
 *   tcg_5592 — SCRY_DYNAMIC on "deals damage"     (REAL OP, ON_DAMAGE)
 *   tcg_938  — GRANT_SELF_WARD on summon          (REAL OP, ON_SUMMON)
 *   tcg_3400 — HEAL_ALLIES_FULL at turn start     (REAL OP, ON_TURN_START)
 *   tcg_3375 — REVEAL_AND_CULL (Darius)           (REAL OP, ON_SUMMON — both decks)
 *   tcg_3425 — RETURN_LAST_PLAYED (Yesterday)     (REAL OP, ON_SUMMON — once/match)
 */

import { compileAbility } from "../engine/abilityCompiler";
import { resolveEffect, resolveSpecs, EffectContext } from "../engine/effectResolver";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, PlayerId } from "../engine/state";
import rawCards from "../data/generatedTcgCards.json";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

const cardMap = new Map((rawCards as unknown as { id?: string; rawTraits?: { Ability?: string } }[]).map((c) => [c.id, c]));
function abilityOf(id: string): string {
  const ab = cardMap.get(id)?.rawTraits?.Ability;
  if (!ab) throw new Error(`missing ability text for ${id}`);
  return ab;
}

function unit(overrides: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test",
    lane: "front",
    attack: 1,
    health: 1,
    maxHealth: 1,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...overrides,
  };
}

function arena(): MatchState {
  const m = makeSeededMatch(4242);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
    m.players[p].deck = [];
    m.players[p].deckCount = 0;
  }
  return m;
}

function ctx(m: MatchState, controller: PlayerId, extra: Partial<EffectContext> = {}): EffectContext {
  return { state: m, controller, ...extra };
}

// --- tcg_5592: SCRY_DYNAMIC on "When this unit deals damage". (REAL OP) ---------
{
  const compiled = compileAbility(abilityOf("tcg_5592"));
  check("tcg_5592 recognized", compiled.recognized, compiled.classified.map((s) => s.op));
  const spec = compiled.specs.find((s) => s.op === "SCRY_DYNAMIC");
  check("tcg_5592 -> SCRY_DYNAMIC @ ON_DAMAGE", !!spec && spec.trigger === "ON_DAMAGE" && spec.amount === 1, spec);
  if (spec) {
    const cost: Record<string, number> = { hi: 5, lo: 1, tail: 3 };
    // The card prints "scry 1" (amount===1); a depth-1 reorder is inherently a
    // no-op (only the single top card is "reordered"), so first prove it resolves
    // cleanly and moves no cards.
    const m1 = arena();
    m1.players.P1.deck = ["hi", "lo", "tail"];
    m1.players.P1.deckCount = 3;
    resolveEffect(spec, ctx(m1, "P1", { costOf: (id) => cost[id] ?? 0 }));
    check("tcg_5592 scry 1 resolves cleanly, moves no cards", m1.players.P1.deck.length === 3, m1.players.P1.deck);

    // Now prove the SCRY_DYNAMIC op is genuinely LIVE (not an inert classification):
    // the SAME op with depth>=2 reorders the deck top by ascending cost.
    const m2 = arena();
    m2.players.P1.deck = ["hi", "lo", "tail"];
    m2.players.P1.deckCount = 3;
    resolveEffect({ ...spec, amount: 2 }, ctx(m2, "P1", { costOf: (id) => cost[id] ?? 0 }));
    check(
      "tcg_5592 SCRY_DYNAMIC is live (depth 2 sorts lo before hi)",
      m2.players.P1.deck.indexOf("lo") < m2.players.P1.deck.indexOf("hi") && m2.players.P1.deck.length === 3,
      m2.players.P1.deck
    );
  }
}

// --- tcg_938: GRANT_SELF_WARD on summon. (REAL OP) -----------------------------
{
  const compiled = compileAbility(abilityOf("tcg_938"));
  check("tcg_938 recognized", compiled.recognized, compiled.classified.map((s) => s.op));
  const spec = compiled.specs.find((s) => s.op === "GRANT_SELF_WARD");
  check("tcg_938 -> GRANT_SELF_WARD @ ON_SUMMON", !!spec && spec.trigger === "ON_SUMMON", spec);
  if (spec) {
    const m = arena();
    const self = unit({ instanceId: "warded", attack: 2, health: 3, maxHealth: 3 });
    m.players.P1.board.front = [self];
    check("tcg_938 source starts unshielded", !(self as any).shielded);
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("tcg_938 arms the source's WARD/shield absorb", (self as any).shielded === true, self);
    // No source -> clean no-op (never throws).
    const m2 = arena();
    resolveEffect(spec, ctx(m2, "P1"));
    check("tcg_938 no-source is a safe no-op", true);
  }
}

// --- tcg_3400: HEAL_ALLIES_FULL at turn start. (REAL OP) -----------------------
{
  const compiled = compileAbility(abilityOf("tcg_3400"));
  check("tcg_3400 recognized", compiled.recognized, compiled.classified.map((s) => s.op));
  const spec = compiled.specs.find((s) => s.op === "HEAL_ALLIES_FULL");
  check("tcg_3400 -> HEAL_ALLIES_FULL @ ON_TURN_START", !!spec && spec.trigger === "ON_TURN_START", spec);
  if (spec) {
    // Crypt-Legend gating: only OTHER MYTHIC allies are healed to full.
    const m = arena();
    const source = unit({ instanceId: "legend", attack: 3, health: 5, maxHealth: 5, rarity: "MYTHIC" });
    const legendAlly = unit({ instanceId: "wounded_legend", attack: 2, health: 2, maxHealth: 9, rarity: "MYTHIC" });
    const commonAlly = unit({ instanceId: "wounded_common", attack: 2, health: 2, maxHealth: 9, rarity: "COMMON" });
    m.players.P1.board.front = [source, legendAlly, commonAlly];
    resolveEffect(spec, ctx(m, "P1", { source }));
    check("tcg_3400 heals OTHER Crypt Legend ally to full (2 -> 9)", legendAlly.health === 9, legendAlly.health);
    check("tcg_3400 does NOT heal a non-Legend ally (stays 2)", commonAlly.health === 2, commonAlly.health);
    check("tcg_3400 does not over-heal the source", source.health === 5, source.health);

    // Gate: with another ally present but NO other LEGEND, it is a clean no-op.
    const m2 = arena();
    const lone = unit({ instanceId: "lone_legend", attack: 3, health: 3, maxHealth: 9, rarity: "MYTHIC" });
    const onlyCommon = unit({ instanceId: "only_common", attack: 2, health: 2, maxHealth: 9, rarity: "COMMON" });
    m2.players.P1.board.front = [lone, onlyCommon];
    resolveEffect(spec, ctx(m2, "P1", { source: lone }));
    check("tcg_3400 no-op when no OTHER Legend ally (common stays 2)", onlyCommon.health === 2, onlyCommon.health);
  }
}

// --- tcg_3375: REVEAL_AND_CULL. (REAL OP — Darius) -----------------------------
{
  const compiled = compileAbility(abilityOf("tcg_3375"));
  check("tcg_3375 recognized", compiled.recognized, compiled.classified.map((s) => s.op));
  const spec = compiled.specs.find((s) => s.op === "REVEAL_AND_CULL");
  check(
    "tcg_3375 -> REVEAL_AND_CULL @ ON_SUMMON (count 3 / gate 5)",
    !!spec && spec.trigger === "ON_SUMMON" && spec.revealCount === 3 && spec.costGate === 5,
    spec
  );
  if (spec) {
    // Deck top-3 for BOTH players: a 6-cost (>= gate -> returns to deck) and two
    // cheap units (< gate -> destroyed to graveyard). The 4th card is below the
    // reveal window and must be untouched. costOf/graveStatsOf are injected just
    // like the live reducer wires them.
    const cost: Record<string, number> = { big: 6, cheapA: 2, cheapB: 1, deep: 3, p2big: 5, p2cheap: 1, p2deep: 4 };
    const stats: Record<string, { attack: number; maxHealth: number; keywords: string[] }> = {
      cheapA: { attack: 2, maxHealth: 2, keywords: ["GUARD"] },
      cheapB: { attack: 1, maxHealth: 1, keywords: [] },
      p2cheap: { attack: 1, maxHealth: 3, keywords: [] },
    };
    const m = arena();
    m.players.P1.deck = ["big", "cheapA", "cheapB", "deep"];
    m.players.P1.deckCount = 4;
    m.players.P2.deck = ["p2big", "p2cheap", "p2deep"];
    m.players.P2.deckCount = 3;
    resolveEffect(
      spec,
      ctx(m, "P1", {
        costOf: (id) => cost[id] ?? 0,
        graveStatsOf: (id) => stats[id] ?? { attack: 0, maxHealth: 1, keywords: [] },
      })
    );
    // P1: 6-cost "big" returned to deck (still present); cheapA/cheapB destroyed.
    check("tcg_3375 P1 6-cost returned to deck (still present)", m.players.P1.deck.includes("big"), m.players.P1.deck);
    check(
      "tcg_3375 P1 low-cost cards destroyed to graveyard",
      m.players.P1.graveyard.some((g) => g.cardId === "cheapA") && m.players.P1.graveyard.some((g) => g.cardId === "cheapB"),
      m.players.P1.graveyard
    );
    check(
      "tcg_3375 destroyed grave record carries real stats/keywords",
      m.players.P1.graveyard.some((g) => g.cardId === "cheapA" && g.attack === 2 && g.maxHealth === 2 && g.keywords.includes("GUARD")),
      m.players.P1.graveyard
    );
    check("tcg_3375 P1 deep (below reveal window) survives in deck", m.players.P1.deck.includes("deep"), m.players.P1.deck);
    check("tcg_3375 P1 deck now has 2 cards (big + deep)", m.players.P1.deck.length === 2 && m.players.P1.deckCount === 2, m.players.P1.deck);
    // P2 too: 5-cost (>= gate) returns, the 1-cost is destroyed.
    check("tcg_3375 P2 5-cost returned to deck", m.players.P2.deck.includes("p2big"), m.players.P2.deck);
    check("tcg_3375 P2 1-cost destroyed", m.players.P2.graveyard.some((g) => g.cardId === "p2cheap"), m.players.P2.graveyard);

    // DETERMINISM: identical seed + deck -> identical reshuffle (replay-stable).
    const run = () => {
      const mm = arena();
      mm.players.P1.deck = ["big", "cheapA", "cheapB", "deep", "x1", "x2"];
      mm.players.P1.deckCount = 6;
      mm.players.P2.deck = [];
      resolveEffect(spec, ctx(mm, "P1", { costOf: (id) => cost[id] ?? 7, graveStatsOf: (id) => stats[id] ?? { attack: 0, maxHealth: 1, keywords: [] } }));
      return mm.players.P1.deck.join(",");
    };
    check("tcg_3375 reshuffle is deterministic (same seed -> same order)", run() === run(), [run(), run()]);
  }
}

// --- tcg_3425: RETURN_LAST_PLAYED. (REAL OP — Yesterday Is History) ------------
{
  const compiled = compileAbility(abilityOf("tcg_3425"));
  check("tcg_3425 recognized", compiled.recognized, compiled.classified.map((s) => s.op));
  const spec = compiled.specs.find((s) => s.op === "RETURN_LAST_PLAYED");
  check(
    "tcg_3425 -> RETURN_LAST_PLAYED @ ON_SUMMON (once per match)",
    !!spec && spec.trigger === "ON_SUMMON" && spec.oncePerMatch === true,
    spec
  );
  if (spec) {
    const m = arena();
    // Simulate a card already played by the opponent (the slot the reducer keeps).
    m.players.P2.hand = [];
    m.lastCardPlayed = { cardId: "tcg_played", owner: "P2" };
    resolveEffect(spec, ctx(m, "P1"));
    check("tcg_3425 bounces last-played card to its OWNER's hand", m.players.P2.hand.includes("tcg_played"), m.players.P2.hand);
    check("tcg_3425 marks the once-per-match used flag", m.returnLastPlayedUsed === true, m.returnLastPlayedUsed);
    check("tcg_3425 consumes the last-played slot", m.lastCardPlayed == null, m.lastCardPlayed);

    // Second use is BLOCKED by the used flag, even if a new card was played.
    m.lastCardPlayed = { cardId: "tcg_other", owner: "P1" };
    const p1HandBefore = [...m.players.P1.hand];
    resolveEffect(spec, ctx(m, "P1"));
    check(
      "tcg_3425 second use is blocked (no bounce)",
      JSON.stringify(m.players.P1.hand) === JSON.stringify(p1HandBefore),
      m.players.P1.hand
    );

    // No card played yet -> clean no-op (never throws, mutates nothing).
    const m2 = arena();
    const before = JSON.stringify(m2.players);
    resolveEffect(spec, ctx(m2, "P1"));
    check("tcg_3425 no-op when nothing was played", JSON.stringify(m2.players) === before && !m2.returnLastPlayedUsed);
  }
}

console.log(`\n=== MISSING-MECHANICS PROOF (5 formerly-UNKNOWN authored cards) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} missing-mechanics check(s) failed.`);
  process.exit(1);
}
console.log("ALL MISSING-MECHANICS PROOFS PASSED");
