/**
 * dev:card-override — pins the CARD-OVERRIDE / VERSIONING LAYER (balance-patch spine).
 *
 * Covers:
 *   (a) a stat override changes cost/attack/health in `allPlayableCards` AND is
 *       enforced by the reducer (energy check uses the patched cost; a played
 *       unit enters the board with the patched stats).
 *   (b) an `ability` override RECOMPILES — compileAbility(patched Ability) yields
 *       the new EffectSpec.
 *   (c) the layer is immutable + idempotent — base catalog objects aren't mutated,
 *       applying twice is a no-op delta.
 *   (d) a `disabled` card is flagged and excluded from deck legality.
 *   (e) card COUNT is unchanged by overrides (audit invariant holds).
 */

import { allPlayableCards, getPlayableCardById } from "../engine/cards";
import { cardOverrides, applyCardOverride, CARD_OVERRIDES_VERSION } from "../engine/cardOverrides";
import { compileAbility } from "../engine/abilityCompiler";
import { applyAction } from "../engine/reducer";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState } from "../engine/state";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import runtimeMatchPlayableCards from "../data/runtimeMatchPlayableCards.json";
import { liveSpells } from "../engine/spellCards";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

const byId = (id: string) => getPlayableCardById(id)!;

console.log(`\n=== CARD OVERRIDE PROOF (version ${CARD_OVERRIDES_VERSION}) ===`);

// --- (e) card COUNT unchanged -------------------------------------------------
{
  // The OVERRIDE layer modifies in place — it adds/deletes nothing. The catalog is
  // the raw runtime tuples PLUS the live SPELL archetype (a separate, non-override
  // source merged in cards.ts), so the invariant is: catalog === raw + liveSpells.
  // This still pins that overrides never change the count (any drift in the raw
  // tuples or a duplicated spell id breaks it).
  const baseCount = (runtimeMatchPlayableCards as unknown[]).length + liveSpells.length;
  check(
    "card count unchanged by overrides (catalog === raw tuple count + live spells)",
    allPlayableCards.length === baseCount,
    { catalog: allPlayableCards.length, raw: (runtimeMatchPlayableCards as unknown[]).length, liveSpells: liveSpells.length }
  );
  // Pin the live SPELL archetype size: the 6 original value/deck-manip spells PLUS
  // the 4 DISCOVER spells (spell_scout / spell_archive / spell_salvage /
  // spell_grand_survey). If a spell is added/removed this must be updated in lockstep
  // with the catalog count above.
  check(
    "liveSpells length is 10 (6 value/deck-manip + 4 discover)",
    liveSpells.length === 10,
    liveSpells.length
  );
  // ZERO duplicate ids across the ENTIRE catalog (raw tuples + live spells). A
  // colliding spell id would silently shadow a real card in cardMetaById.
  {
    const ids = allPlayableCards.map((c) => c.id);
    const seen = new Set<string>();
    const dupes = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    check("no duplicate card ids across the catalog", dupes.length === 0, dupes);
  }
  // Every overridden id still resolves — overrides modify, never delete.
  for (const id of Object.keys(cardOverrides)) {
    check(`overridden card ${id} still present in catalog`, getPlayableCardById(id) !== null);
  }
}

// --- (a) stat override visible in allPlayableCards ----------------------------
{
  const erosion = byId("tcg_1428");
  check("tcg_1428 attack patched 18 -> 16 in catalog", erosion.stats.attack === 16, erosion.stats.attack);
  const warden = byId("tcg_475");
  check("tcg_475 attack patched 17 -> 15 in catalog", warden.stats.attack === 15, warden.stats.attack);
  check("tcg_475 cost stamped 10 in catalog", warden.cost === 10, warden.cost);
}

// --- (a) stat + cost override ENFORCED by the reducer -------------------------
function arena(seed = 7777): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
    m.players[p].discard = [];
  }
  return m;
}

{
  // tcg_475 patched cost is 10. At energy 9 the reducer must REJECT; at 10 accept.
  const lo = arena();
  lo.players.P1.hand = ["tcg_475"];
  lo.players.P1.energy = 9;
  lo.players.P1.maxEnergy = 99;
  const rLo = applyAction(lo, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check(
    "reducer enforces patched cost: tcg_475 rejected at energy 9 (cost 10)",
    rLo.state === lo && rLo.events.some((e) => e.type === "REJECTED"),
    rLo.events.map((e) => e.type)
  );

  const hi = arena();
  hi.players.P1.hand = ["tcg_475"];
  hi.players.P1.energy = 10;
  hi.players.P1.maxEnergy = 99;
  const rHi = applyAction(hi, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const played = rHi.state.players.P1.board.front.find((u) => u.cardId === "tcg_475");
  check("reducer accepts tcg_475 at energy 10 (patched cost)", !!played, rHi.events.map((e) => e.type));
  check(
    "played tcg_475 enters board with PATCHED attack 15 (reducer inherits cardMeta)",
    played?.attack === 15,
    played?.attack
  );
}

// --- (b) ability override RECOMPILES -----------------------------------------
{
  const retext = byId("tcg_86");
  const compiled = compileAbility(retext.rawTraits.Ability);
  const spec = compiled.specs.find((s) => s.op === "BUFF_SELF");
  check(
    "tcg_86 ability retext is present on the catalog card",
    /On play: gain \+3\/\+3\./.test(retext.rawTraits.Ability ?? ""),
    retext.rawTraits.Ability
  );
  // Base compiled to { trigger: ON_DAMAGE, op: BUFF_SELF, +1/+1 }; the retext must
  // RECOMPILE to a DIFFERENT EffectSpec: { trigger: ON_SUMMON, op: BUFF_SELF, +3/+3 }.
  check(
    "tcg_86 RECOMPILES to a new EffectSpec (ON_SUMMON BUFF_SELF +3/+3, was ON_DAMAGE +1/+1)",
    !!spec && spec.trigger === "ON_SUMMON" && (spec as any).attack === 3 && (spec as any).health === 3,
    compiled.specs
  );
}

// --- (c) immutable + idempotent ----------------------------------------------
{
  // Build a fresh base object identical to a raw tuple and confirm applyCardOverride
  // does NOT mutate it, and applying twice is a no-op delta.
  const base = {
    id: "tcg_1428",
    cost: 10,
    stats: { attack: 18, health: 9, speed: 0, armor: 0 },
    keywords: ["FEAR"],
    rawTraits: { Ability: "Fear." },
  };
  const baseSnapshot = JSON.stringify(base);
  const once = applyCardOverride(base);
  check("applyCardOverride does NOT mutate the base object", JSON.stringify(base) === baseSnapshot, base);
  check("override returns a NEW object (not same ref)", once !== (base as any));
  check("override clones nested stats (no shared ref)", once.stats !== base.stats);
  check("override applied once: attack 18 -> 16", once.stats.attack === 16, once.stats.attack);
  const twice = applyCardOverride(once);
  check("idempotent: applying twice yields identical result", JSON.stringify(twice) === JSON.stringify(once), {
    once,
    twice,
  });

  // The shipped catalog object for an un-overridden card carries no `disabled`.
  const plain = byId("tcg_1");
  check("un-overridden card has no disabled flag", plain.disabled !== true, plain.disabled);
}

// --- (d) disabled flag + legality exclusion ----------------------------------
{
  const banned = byId("tcg_45");
  check("tcg_45 is flagged disabled in the catalog", banned.disabled === true, banned.disabled);

  // Confirm deck legality REJECTS a deck containing the disabled card. Build a real
  // curated deck (passes the unknown-card check) and swap one slot for the banned id
  // so the soft-ban branch is specifically what fires.
  const commanderIds = Object.keys(COMMANDER_SPECS);
  const cid = commanderIds[0];
  const deck = buildCuratedDeck(cid).slice();
  deck[0] = "tcg_45"; // inject the soft-banned card into an otherwise-legal deck
  let threw = false;
  let msg = "";
  try {
    createMatchFromDecks({
      p1: { commanderId: cid, deck },
      p2: { commanderId: commanderIds[1], deck: buildCuratedDeck(commanderIds[1]) },
      shuffle: false,
      openingHandSize: 3,
    } as any);
  } catch (e) {
    threw = true;
    msg = String((e as Error).message ?? e);
  }
  check("createMatchFromDecks rejects a deck containing a disabled card", threw, msg);
  check("rejection is the soft-ban path (message names disabled/soft-banned)", /disabled \(soft-banned\)/.test(msg), msg);

  // Control: the SAME curated deck WITHOUT the banned card builds fine (the soft-ban
  // is the only reason it failed — overrides don't otherwise break legality).
  let okThrew = false;
  try {
    createMatchFromDecks({
      p1: { commanderId: cid, deck: buildCuratedDeck(cid) },
      p2: { commanderId: commanderIds[1], deck: buildCuratedDeck(commanderIds[1]) },
      shuffle: false,
      openingHandSize: 3,
    } as any);
  } catch {
    okThrew = true;
  }
  check("the same curated deck WITHOUT the banned card is still legal", !okThrew);
}

console.log(`\n=== CARD OVERRIDE PROOF SUMMARY ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} card-override check(s) failed.`);
  process.exit(1);
}
console.log("ALL CARD OVERRIDE PROOFS PASSED");
