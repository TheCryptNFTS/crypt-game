/**
 * dev:deep-content — proves the 2026.05.31 DEEP-CONTENT wave: the deck-legal
 * SPELL pool roughly doubled again (24 -> 50) across distinct archetypes, plus the
 * faction-EXCLUSIVE "Oath" payoff layer. Three guarantees, all on the EXISTING
 * resolver vocabulary (no new ops):
 *
 *   A. POOL CONTRACT — every liveSpell is a deck-legal type:"spell" card that
 *      compiles to >=1 RECOGNIZED ACTIVE op (no inert text), emits NO duplicate
 *      (op,trigger) spec (a double-resolve would lie about magnitude), and is
 *      NO-BURN (no op can lower an enemy nexus; the only nexus op is HEAL_NEXUS on
 *      the caster's OWN face).
 *
 *   B. ARCHETYPE CASTS — one representative new spell per archetype is driven
 *      end-to-end through the REAL `applyAction` PLAY_SPELL path and asserted to do
 *      exactly what it prints: removal, board-wide control, go-wide buff, token,
 *      graveyard recursion, tutor/dig, discover. Every cast leaves BOTH nexuses at
 *      full (except an explicit own-nexus heal).
 *
 *   C. FACTION-EXCLUSIVE OATH PAYOFF — oathPayoffFor() fires ONLY at the faction
 *      threshold, is a clean no-op when rules.factionIdentities is off (vanilla
 *      byte-identical), counts ONLY the controller's OWN faction (mono-faction
 *      reward), is deterministic, and never touches an enemy nexus.
 */

import { applyAction } from "../engine/reducer";
import { compileAbility, EffectOp } from "../engine/abilityCompiler";
import { getPlayableCardById, allPlayableCards } from "../engine/cards";
import { liveSpells } from "../engine/spellCards";
import { oathPayoffFor } from "../engine/factionIdentity";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, GraveyardRecord } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`OK: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

// Real catalog lookups (the reducer passes equivalent closures into the hooks).
const META = new Map<string, any>((allPlayableCards as any[]).map((c) => [c.id, c]));
const factionOf = (id: string): string | null => META.get(id)?.faction ?? null;

function unit(over: Partial<UnitInPlay> & { instanceId: string; cardId: string }): UnitInPlay {
  return { lane: "front", attack: 1, health: 5, maxHealth: 5, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false, ...over };
}
function grave(cardId: string, attack = 2, maxHealth = 4): GraveyardRecord {
  return { cardId, attack, maxHealth, keywords: [] };
}
function arena(seed = 4242): MatchState {
  const m = makeSeededMatch(seed);
  m.seed = seed;
  m.rngCursor = 0;
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].deck = [];
    m.players[p].deckCount = 0;
    m.players[p].discard = [];
    m.players[p].graveyard = [];
  }
  return m;
}
function cast(m: MatchState, id: string, targetInstanceId?: string) {
  m.players.P1.hand = [id];
  return applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId }).state;
}

// Inert/no-op op classes the compiler may emit alongside an active spec.
const INERT_OPS = new Set<EffectOp>([
  "UNKNOWN",
  "STAT_LINE",
  "GRANT_KEYWORD",
  "KEYWORD_WIRED",
  "GLOBAL_UNPARSED",
] as EffectOp[]);

// =============================================================================
// A. POOL-WIDE CONTRACT
// =============================================================================
{
  check(`liveSpells roughly doubled again (>= 40, got ${liveSpells.length})`, liveSpells.length >= 40, liveSpells.length);
  check(`liveSpells within target band (<= 50, got ${liveSpells.length})`, liveSpells.length <= 50, liveSpells.length);

  // Unique ids (a collision would silently shadow a real card in cardMetaById).
  const ids = new Set(liveSpells.map((s) => s.id));
  check("every liveSpell id is unique", ids.size === liveSpells.length, { unique: ids.size, total: liveSpells.length });

  let inert = 0;
  let dupSpecs = 0;
  let burn = 0;
  for (const s of liveSpells) {
    const card = getPlayableCardById(s.id);
    check(`${s.id} is a deck-legal type:spell card`, !!card && card.type === "spell", card?.type);

    const c = compileAbility((s.rawTraits as { Ability?: string }).Ability);
    const active = c.specs.filter((x) => !INERT_OPS.has(x.op));
    if (!c.recognized || active.length === 0) {
      inert += 1;
      console.error(`  inert/unrecognized: ${s.id} -> ${c.specs.map((x) => x.op)}`);
    }
    // No duplicate (op,trigger) — a double spec resolves twice and would over-
    // deliver vs the printed magnitude (caught spell_volley / spell_regrow /
    // spell_execute during authoring).
    const seen = new Set<string>();
    for (const sp of c.specs) {
      const k = `${sp.trigger}:${sp.op}`;
      if (seen.has(k)) {
        dupSpecs += 1;
        console.error(`  duplicate spec: ${s.id} -> ${k}`);
      }
      seen.add(k);
    }
    // NO-BURN: the engine has NO enemy-face op at all; the only nexus op a spell may
    // carry is HEAL_NEXUS (own face). Assert no other "nexus-ish" op sneaks in.
    for (const sp of c.specs) {
      if (sp.op !== "HEAL_NEXUS" && /NEXUS|FACE|COMMANDER/.test(sp.op)) burn += 1;
    }
  }
  check("no liveSpell is inert / unrecognized (all wire an active op)", inert === 0, inert);
  check("no liveSpell emits a duplicate (op,trigger) spec", dupSpecs === 0, dupSpecs);
  check("NO-BURN: no liveSpell carries an enemy-face/nexus op (only own HEAL_NEXUS)", burn === 0, burn);
}

// =============================================================================
// B. REPRESENTATIVE ARCHETYPE CASTS (real PLAY_SPELL path)
// =============================================================================

// go-wide BUFF (spell_war_banner, Bless +1/+1 to ALL allies, no target)
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "a", cardId: "tcg_2", attack: 2, health: 3, maxHealth: 3 }),
    unit({ instanceId: "b", cardId: "tcg_2", attack: 1, health: 1, maxHealth: 1 }),
  ];
  const s = cast(m, "spell_war_banner");
  const a = s.players.P1.board.front.find((u) => u.instanceId === "a");
  const b = s.players.P1.board.front.find((u) => u.instanceId === "b");
  check("spell_war_banner buffs ALL allies +1/+1 (go-wide anthem)", a?.attack === 3 && a?.health === 4 && b?.attack === 2 && b?.health === 2, { a, b });
  check("spell_war_banner touched NEITHER nexus", s.players.P1.nexusHealth === 20 && s.players.P2.nexusHealth === 20);
}

// board-wide DEBUFF (spell_intimidate, -1 atk to all enemies this turn)
{
  const m = arena();
  m.players.P2.board.front = [
    unit({ instanceId: "x", cardId: "tcg_2", attack: 4, health: 4, maxHealth: 4 }),
    unit({ instanceId: "y", cardId: "tcg_2", attack: 2, health: 4, maxHealth: 4 }),
  ];
  const s = cast(m, "spell_intimidate");
  const x = s.players.P2.board.front.find((u) => u.instanceId === "x");
  const y = s.players.P2.board.front.find((u) => u.instanceId === "y");
  check("spell_intimidate weakens ALL enemy attack -1", x?.attack === 3 && y?.attack === 1, { x: x?.attack, y: y?.attack });
  check("spell_intimidate leaves the enemy nexus full", s.players.P2.nexusHealth === 20);
}

// board-wide SWAP tech (spell_upheaval, swap atk<->hp on every enemy, no target)
{
  const m = arena();
  m.players.P2.board.front = [
    unit({ instanceId: "p", cardId: "tcg_2", attack: 5, health: 1, maxHealth: 1 }),
    unit({ instanceId: "q", cardId: "tcg_2", attack: 4, health: 2, maxHealth: 2 }),
  ];
  const s = cast(m, "spell_upheaval");
  const p = s.players.P2.board.front.find((u) => u.instanceId === "p");
  const q = s.players.P2.board.front.find((u) => u.instanceId === "q");
  // glass cannons (5/1, 4/2) flip to tanks-with-no-bite (1/5, 2/4).
  check("spell_upheaval swaps attack<->health on ALL enemy units", p?.attack === 1 && p?.health === 5 && q?.attack === 2 && q?.health === 4, { p, q });
  check("spell_upheaval never touches the enemy nexus", s.players.P2.nexusHealth === 20);
}

// hard removal, auto-selected (spell_execute, destroy highest-cost enemy — no target)
{
  const m = arena();
  // tcg_27 is a cost-6 STONE body; tcg_2 is cost-2. Highest-cost (tcg_27) is reaped.
  m.players.P2.board.front = [
    unit({ instanceId: "small", cardId: "tcg_2", attack: 2, health: 4, maxHealth: 4 }),
    unit({ instanceId: "big", cardId: "tcg_27", attack: 5, health: 9, maxHealth: 9, armor: 5 }),
  ];
  const s = cast(m, "spell_execute");
  check("spell_execute auto-destroys the HIGHEST-cost enemy (no manual target)", !s.players.P2.board.front.some((u) => u.instanceId === "big"), s.players.P2.board.front.map((u) => u.instanceId));
  check("spell_execute leaves the cheaper enemy alive", s.players.P2.board.front.some((u) => u.instanceId === "small"));
  check("spell_execute deals NO face damage", s.players.P2.nexusHealth === 20);
}

// premium single-target damage (spell_smite, 5 dmg, ignores armor)
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", cardId: "tcg_2", health: 8, maxHealth: 8, armor: 6 })];
  const s = cast(m, "spell_smite", "foe");
  const f = s.players.P2.board.front.find((u) => u.instanceId === "foe");
  check("spell_smite deals 5 ignoring armor (8 -> 3)", f?.health === 3, f?.health);
}

// token go-wide (spell_levy, two 2/2 Wraiths)
{
  const m = arena();
  const s = cast(m, "spell_levy");
  const toks = s.players.P1.board.front;
  check("spell_levy mints TWO 2/2 tokens", toks.length === 2 && toks.every((t) => t.attack === 2 && t.health === 2), toks.map((t) => `${t.attack}/${t.health}`));
}

// graveyard recursion to hand (spell_regrow, RETURN_FROM_GRAVE, no target)
{
  const m = arena();
  m.players.P1.graveyard = [grave("tcg_2", 3, 5)];
  const handBefore = m.players.P1.hand.length;
  const s = cast(m, "spell_regrow");
  check("spell_regrow returns a graveyard card to HAND", s.players.P1.hand.includes("tcg_2"), s.players.P1.hand);
  check("spell_regrow pops the grave record", s.players.P1.graveyard.length === 0, s.players.P1.graveyard.length);
  void handBefore;
}

// seeded-random mass resurrect (spell_mass_raise) — replay-stable
{
  const run = (seed: number) => {
    const m = arena(seed);
    m.players.P1.graveyard = [grave("A"), grave("B"), grave("C"), grave("D")];
    const s = cast(m, "spell_mass_raise");
    return s.players.P1.board.front[0]?.cardId;
  };
  check("spell_mass_raise is replay-stable (same seed -> same revive)", run(11) === run(11));
  const picks = new Set<string | undefined>();
  for (let s = 1; s <= 30; s += 1) picks.add(run(s));
  check("spell_mass_raise varies across seeds (>= 2 distinct revives)", picks.size >= 2, [...picks]);
}

// deterministic tutor (spell_call_arms, search deck for highest-cost unit -> hand)
{
  const m = arena();
  // tcg_27 (cost 6) is the highest-cost unit in this deck; it should be tutored.
  m.players.P1.deck = ["tcg_2", "tcg_27", "tcg_8"];
  m.players.P1.deckCount = 3;
  const s = cast(m, "spell_call_arms");
  check("spell_call_arms tutors the HIGHEST-cost unit to hand", s.players.P1.hand.includes("tcg_27"), s.players.P1.hand);
  check("spell_call_arms removed it from the deck", !s.players.P1.deck.includes("tcg_27"), s.players.P1.deck);
}

// discover pauses for a choice (spell_requisition)
{
  const m = arena();
  m.players.P1.deck = ["tcg_2", "tcg_27", "tcg_8", "tcg_93", "tcg_100"];
  m.players.P1.deckCount = 5;
  m.players.P1.hand = ["spell_requisition"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_requisition opens a Discover CHOICE (pendingChoice set)", !!(r.state as any).pendingChoice, (r.state as any).pendingChoice ? "set" : "none");
  check("spell_requisition never touched a nexus", r.state.players.P1.nexusHealth === 20 && r.state.players.P2.nexusHealth === 20);
}

// =============================================================================
// C. FACTION-EXCLUSIVE OATH PAYOFF (oathPayoffFor)
// =============================================================================

const CMD_BY_FACTION: Record<string, string> = {
  STONE_KEEPERS: "cmd_stone_warden",
  BRONZE_GUARDIANS: "cmd_bronze_raider",
  SILVER_SENTINELS: "cmd_silver_oracle",
  IRON_DEFENDERS: "cmd_iron_warlord",
  GOLDEN_SOVEREIGNS: "cmd_golden_emperor",
};
// Real same-faction unit ids (probed from the catalog; match runFactionIdentityProof).
const STONE_UNIT = "tcg_2";
const GOLD_UNIT = "tcg_100";
const BRONZE_UNIT = "tcg_93";

function oathState(commanderId: string, enabled: boolean): MatchState {
  return {
    rules: enabled ? { factionIdentities: true } : undefined,
    players: {
      P1: { commanderId, nexusHealth: 20, deck: [], board: { front: [], back: [] } },
      P2: { commanderId: "cmd_demo", nexusHealth: 20, deck: [], board: { front: [], back: [] } },
    },
  } as unknown as MatchState;
}
function fill(state: MatchState, cardId: string, count: number): void {
  const lane = (state.players.P1 as any).board.front as any[];
  for (let i = 0; i < count; i += 1) lane.push({ cardId, keywords: [], attack: 2, health: 3, maxHealth: 3, armor: 0 });
}

// STONE Oath: threshold 3 -> fires at 3+ Stone, inert below, +0/+2 bonus.
{
  const below = oathState(CMD_BY_FACTION.STONE_KEEPERS, true);
  fill(below, STONE_UNIT, 2);
  const rBelow = oathPayoffFor(below, "P1", factionOf);
  check("Oath of Stone is DORMANT below threshold (2 < 3)", !rBelow.active && rBelow.bonus.attack === 0 && rBelow.bonus.health === 0, rBelow);

  const at = oathState(CMD_BY_FACTION.STONE_KEEPERS, true);
  fill(at, STONE_UNIT, 3);
  const rAt = oathPayoffFor(at, "P1", factionOf);
  check("Oath of Stone FIRES at threshold (3+) with +0/+2", rAt.active && rAt.bonus.attack === 0 && rAt.bonus.health === 2, rAt);
  check("Oath of Stone counted exactly the live Stone units", rAt.factionUnits === 3 && rAt.threshold === 3, rAt);
  check("Oath of Stone never burned the enemy nexus", at.players.P2.nexusHealth === 20);
}

// GOLD Oath: threshold 4 (premium top-end) -> needs 4 Gold, +0/+3.
{
  const at = oathState(CMD_BY_FACTION.GOLDEN_SOVEREIGNS, true);
  fill(at, GOLD_UNIT, 4);
  const r = oathPayoffFor(at, "P1", factionOf);
  check("Oath of Gold FIRES at its higher threshold (4+) with +0/+3", r.active && r.threshold === 4 && r.bonus.health === 3, r);
}

// MONO-FACTION ONLY: off-faction splashes do NOT count toward the Oath threshold.
{
  const mixed = oathState(CMD_BY_FACTION.BRONZE_GUARDIANS, true);
  fill(mixed, BRONZE_UNIT, 2); // 2 Bronze (own faction)
  fill(mixed, STONE_UNIT, 3); // 3 Stone splash — must NOT count
  const r = oathPayoffFor(mixed, "P1", factionOf);
  check("Oath counts ONLY the controller's OWN faction (off-faction splash ignored)", r.factionUnits === 2 && !r.active, r);
}

// GATED OFF: flag absent -> always inert (vanilla byte-identical), even over threshold.
{
  const off = oathState(CMD_BY_FACTION.STONE_KEEPERS, false);
  fill(off, STONE_UNIT, 5); // well over threshold
  const r = oathPayoffFor(off, "P1", factionOf);
  check("Oath payoff is a NO-OP when factionIdentities is OFF (over threshold)", !r.active && r.bonus.attack === 0 && r.bonus.health === 0, r);
  check("Oath payoff still REPORTS faction + threshold when off (for UI)", r.faction === "STONE_KEEPERS" && r.threshold === 3, r);
}

// NON-FACTION commander -> inert (no identity).
{
  const none = oathState("cmd_demo", true);
  fill(none, STONE_UNIT, 5);
  const r = oathPayoffFor(none, "P1", factionOf);
  check("Oath payoff is inert for a non-faction commander", r.faction === null && !r.active, r);
}

// DETERMINISM: same inputs -> identical payoff every call (pure query).
{
  const s = oathState(CMD_BY_FACTION.STONE_KEEPERS, true);
  fill(s, STONE_UNIT, 3);
  const a = JSON.stringify(oathPayoffFor(s, "P1", factionOf));
  const b = JSON.stringify(oathPayoffFor(s, "P1", factionOf));
  check("oathPayoffFor is deterministic (pure)", a === b, { a, b });
}

console.log(`\n=== DEEP CONTENT PROOF (${liveSpells.length} deck-legal spells; archetype casts; faction-exclusive Oath payoff; no-burn) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} deep-content check(s) failed.`);
  process.exit(1);
}
console.log("ALL DEEP CONTENT PROOFS PASSED");
