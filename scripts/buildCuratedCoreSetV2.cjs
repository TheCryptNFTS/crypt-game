const fs = require("fs");
const path = require("path");

const units = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"),
    "utf8"
  )
);
const equipment = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"),
    "utf8"
  )
);
const artifacts = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"),
    "utf8"
  )
);

// --- Undercosted cost-2 body re-cost (balance, 2026.06.06) -----------------
// The outlier report (`npm run report:outliers`, ratio > 6.0) flagged ~31% of the
// curated units — EVERY ONE a cost-2 body whose reconciled power/cost exceeds 6.0,
// led by the armor-3 GUARD walls (4/6/3, 3/7/3; ratio ~7.1-7.3) but also the armor-2
// GUARDs, the speed-4 RUSH skirmishers, and the 7-8-attack vanilla 2-drops. The
// matchup sim traced STONE_KEEPERS / IRON_DEFENDERS dominance (~76-84%, never below
// 50%) to their deep source pool of these unbreakable 2-mana bodies. They are
// honestly costed at 3, not 2; the OLD alpha gate's weaker weights + softer net let
// the whole class slip (it flagged ZERO).
//
// Re-stamp the WHOLE undercosted cost-2 class (any cost-2 unit over the report's
// 6.0 efficiency line, using the report's EXACT power weights) up to cost 3 at the
// build chokepoint, so the curated set, the matchup sim, AND the reconciled alpha
// gate all read the fair cost. Net effect (sim): Stone 83->68, Silver 24->45, no
// faction left auto-losing, and the gate now PASSES at the report's own 6.0 line
// because the class it used to miss is correctly costed. Pure + deterministic: ONLY
// the `cost` field changes, ONLY for the over-line cost-2 class; no card is added or
// removed and no other stat is touched. The runtime catalog (cardOverrides.ts id
// space) is a separate, already-fair generation — see the note there for why this
// re-cost is NOT mirrored as per-id runtime overrides.
function recostUndercostedTwoDrops(card) {
  if (card.type !== "unit") return card;
  const s = card.stats || {};
  // Mirror reportCardOutliers.cjs unitPower EXACTLY so this re-cost and the gate
  // agree on which cost-2 bodies are over the 6.0 efficiency line.
  const power =
    (s.attack || 0) +
    (s.health || 0) * 0.8 +
    (s.armor || 0) * 1.1 +
    (s.speed || 0) * 0.6 +
    ((card.keywords || []).length) * 1.5;
  const ratio = power / Math.max(card.cost || 1, 1);
  // RUSH skirmishers are the aggro factions' INTENDED cheap tempo: they read as
  // ratio-outliers on a pure stat line but are balanced by their fragility and the
  // fact they trade into the board the turn they land. Re-costing them to 3 craters
  // BRONZE / SILVER (the sim drops them ~20pts and re-opens blowouts), so they are
  // EXEMPT here and instead carried by the reconciled gate's documented RUSH carve-
  // out (scripts/checkCuratedAlphaBalance.cjs). Only the durable non-RUSH walls and
  // beaters — the bodies that snowballed Stone/Iron — are re-costed.
  const isRush = (card.keywords || []).includes("RUSH");
  // RE-COST TIGHTENING — INVESTIGATED + REJECTED (2026.06.06 de-inversion pass).
  // The curve IS inverted (curated value/cost falls 6.7 at cost-2 to 3.3 at cost-8),
  // so the obvious fix is to re-cost more of the cheap over-statted bodies UP. Three
  // tighter variants were tried against `npm run sim:curated`:
  //   (a) `>= 6.0` on cost-2 (catch the 4 bricks landing exactly on the line) — moved
  //       2 curated cards, yet SPIKED GOLD to 73.8% and widened the avg faction spread
  //       12.9 -> 22.4pt.
  //   (b) a parallel cost-3 ratio>5.3 -> 4 re-cost — widened the spread to ~27pt.
  //   (c) both together — ~30pt and a cratered GOLD.
  // ROOT CAUSE: the curated set's matchup balance is a FRAGILE band-convergence
  // equilibrium (every faction's top-30 is selected to sit near a shared 13.5 draft-
  // power target). Re-costing even a couple of bodies shifts which cards a faction
  // drafts at each cost slot, and the perturbation propagates chaotically — GOLD's
  // shallow pool is especially sensitive. The cost relabel also doesn't truly DE-invert
  // (a body's power is unchanged; it just moves cost slots). De-inverting the curve
  // honestly requires RESTATTING the source statlines (regenerating the on-chain-
  // derived JSON), which is out of scope for a balance-tuning pass. So the re-cost is
  // held at the prior pass's `> 6.0` line — the value that keeps the spread at 12.9pt.
  if (card.cost === 2 && ratio > 6.0 && !isRush) return { ...card, cost: 3 };
  return card;
}
for (let i = 0; i < units.length; i++) units[i] = recostUndercostedTwoDrops(units[i]);

// --- Soft-ban exclusion (gap #3) -------------------------------------------
// The override layer (src/engine/cardOverrides.ts) soft-bans the 36 units whose
// rawTraits.Ability is null/empty. Those are deck-illegal, so the curated/
// known-good set must NOT pick them. We re-derive the disabled set here from the
// SAME source rule (a blank Ability) so the builder stays in lockstep with the
// overrides without a TS import. Match is on the shared sourceTokenId (curated
// ids are "tcg_unit_<token>"; generatedTcgCards ids are "tcg_<token>").
//
// NOTE: the 71 spec-less "Global effect active while in play." cards are NOT in
// this set. They are ALL of cardClass artifact and the ENTIRE artifact pool, and
// commander specs require minArtifacts >= 1, so they stay deck-legal (documented
// inert in cardOverrides.ts, no `disabled` flag) and the curated set may pick them.
const generatedTcg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedTcgCards.json"), "utf8")
);
const disabledTokens = new Set();
for (const c of generatedTcg) {
  const rt = c.rawTraits || c.traits || {};
  const ab = rt.Ability;
  const blank = ab === undefined || ab === null || String(ab).trim() === "";
  if (blank && c.tokenId !== undefined && c.tokenId !== null) {
    disabledTokens.add(String(c.tokenId));
  }
}
// Also exclude the non-blank dead units soft-banned in cardOverrides.ts: their
// Ability text exists but compiles to no live op AND they carry no functional
// keyword, so they are deck-illegal too. Re-derived here (not imported) to keep
// this builder in lockstep with the overrides without a TS dependency. Currently
// exactly one such token under the live engine keyword wiring (tcg_3375).
for (const token of ["3375"]) disabledTokens.add(token);
function isDisabledCard(card) {
  return card.sourceTokenId !== undefined && disabledTokens.has(String(card.sourceTokenId));
}

// Long-form faction enum (canonical on-chain reveal). The old short codes
// ("STONE", "IRON", ...) silently matched nothing after the rename, leaving the
// curated set empty; these are the values the source data actually carries.
const FACTIONS = ["STONE_KEEPERS", "IRON_DEFENDERS", "BRONZE_GUARDIANS", "SILVER_SENTINELS", "GOLDEN_SOVEREIGNS"];
const GOD = "GODS";

function keywordList(card) {
  return card.keywords || card.effectTags || [];
}

function keywordCount(card) {
  return keywordList(card).length;
}

function rarityScore(rarity) {
  return rarity === "god" ? 8 :
    rarity === "one_of_one" ? 7 :
    rarity === "legendary" ? 6 :
    rarity === "epic" ? 5 :
    rarity === "rare" ? 4 :
    rarity === "uncommon" ? 3 :
    2;
}

function subtypeScore(card) {
  const subtype = card.sourceSubtype || "none";
  if (subtype === "hybrid") return 2;
  if (subtype === "weapon") return 1.5;
  if (subtype === "artifact") return 1.5;
  if (subtype === "armor") return 1.25;
  if (subtype === "creature") return 1.5;
  if (subtype === "metaverse") return 1.25;
  return 1;
}

function statBlock(card) {
  return card.stats || card.bonuses || {};
}

function estimatedUnitPower(card) {
  const stats = statBlock(card);
  return (
    (stats.attack || 0) +
    (stats.health || 0) * 0.8 +
    (stats.armor || 0) * 0.7 +
    (stats.speed || 0) * 0.5 +
    keywordCount(card) * 1.2
  );
}

function efficiencyRatio(card) {
  return estimatedUnitPower(card) / Math.max(card.cost || 1, 1);
}

function isBrokenCheapUnit(card) {
  if (card.type !== "unit") return false;

  const ratio = efficiencyRatio(card);
  const kw = keywordCount(card);

  if (card.cost <= 2 && ratio > 6.5) return true;
  if (card.cost === 3 && ratio > 5.8) return true;
  if (card.cost === 4 && ratio > 5.4) return true;

  // extra anti-slop filters for cheap units
  if (card.cost <= 2 && kw >= 3) return true;
  if (card.cost <= 2 && kw >= 2 && ratio > 5.8) return true;

  return false;
}

// --- Cross-faction competitive band (balance, 2026.06.01) -------------------
// The matchup sim (scripts/simulateCuratedMatchups.cjs) drafts each faction's
// strongest ~30 curated units by a raw stat-sum and pits them head-to-head. The
// deep-pool factions (STONE/IRON have 700-880 legal units) surfaced a far stronger
// stat tail than the shallow GOLDEN_SOVEREIGNS pool (~55 legal, weaker ceiling),
// producing 100%/0% blowouts. We can't lift GOLD's source stats (and we don't
// hand-edit emitted JSON), so we CONVERGE the cross-faction draft band purely by
// SELECTION: each faction curates the units whose raw draft-power sits closest to
// a shared TARGET, instead of its absolute monster top. A deep faction is then
// pulled DOWN to the shared band (its monster tail is left out of the curated set,
// though still deck-legal in the full corpus), while a shallow faction like GOLD
// simply surfaces its best — so the curated top-30 of every faction lands in a
// comparable competitive band and the sim's blowouts collapse.
//
// `simDraftPower` mirrors the sim's own draft metric, so the convergence is exact.
// Pure, deterministic; NO card is re-statted and the SOURCE pool is untouched, so
// the outlier sweep + alpha gate (which read the unbounded source JSON) are
// unaffected and constructed legality (30+commander, copy caps) is unchanged.
const UNIT_BAND_TARGET = 13.5;
// Hard cross-faction draft-power ceiling. A faction's curated units must sit at or
// below this so the sim's top-30 draft (which always skims the strongest curated
// cards) lands in a shared band rather than skimming a deep faction's monster tail.
// Set just above the target; tuned so the 4 deep factions converge to GOLD's
// achievable top-30 band (~14). GOLDEN_SOVEREIGNS and GODS are EXEMPT: GOLD's
// source pool is the weakest in the set (its strongest legal body is ~14 draft-
// power), so capping it would cut its only competitive cards and bury it (a GOLD
// ceiling was tried and rejected this pass — see the GOLD SHAVE note below); GODS are
// intentional premium top-end and never enter the 5-mortal-faction sim. Excluded
// cards stay fully deck-legal in the corpus — only the curated SELECTION is bounded.
const UNIT_DRAFT_CEILING = 14.3;
// GOLD SHAVE — INVESTIGATED + REJECTED (2026.06.06 faction-compression pass).
// GOLDEN_SOVEREIGNS sits at the TOP of the matchup-sim ladder (~66% asA vs IRON's
// ~53%). The obvious lever — adding a GOLD-specific draft ceiling to clip its 16-18
// draft-power monster tail — was tried at 15.0 and 16.5 and BACKFIRED HARD in the real
// builder+sim: it dropped GOLD from the top of the ladder to the BOTTOM (40% at 16.5,
// 12% at 15.0) and WIDENED the avg spread from 12.9 to 27-28pt. Root cause: GOLD's
// legal pool is shallow (~62) and BOTTOM-HEAVY (only ~19 units draft above 12.0), so
// band-selection already deselects the bombs; clipping the ceiling only strips GOLD's
// competitive top while its weak 10.7-11.1 floor cluster (which a 30-card deck is
// forced to include) stays — net a LOWER, not tighter, deck. The variance bombs were
// load-bearing. A selection-only shave cannot compress GOLD without restatting the
// source JSON (out of scope). So GOLD stays EXEMPT — compression is pursued via the
// IRON identity buff (lifting the floor faction) instead. GODS stay exempt as always.
const CEILING_EXEMPT = new Set([GOD, "GOLDEN_SOVEREIGNS"]);

// IRON IDENTITY BUFF (2026.06.16 floor-faction lift) ------------------------
// IRON_DEFENDERS sat at the BOTTOM of the seat-bias-corrected matchup ladder
// (~43.8% vs the field's 49-54%) — its Fortress/GUARD bodies score low on the
// sim's draft metric (armor-heavy, attack-light), so the shared 13.5 band kept
// its curated top-30 at the same power as everyone else while its profile lost
// the head-to-head. A whole-band raise was tried first and REJECTED: it is
// BIMODAL — at the shared target IRON sits at 0.438, and the smallest nudge that
// admits its next power-cluster snaps the entire curated set up and IRON jumps to
// ~0.75 (now oppressive). There is no target value in between (the bodies cluster
// discretely), so a single band knob cannot land the 47-52% window.
//
// The working lever is PARTIAL ADMISSION: keep IRON's FILL units on the same fair
// shared band as every other faction (so the bulk of its deck is not buffed), and
// inject a small, COUNTABLE number of its strongest already-legal Fortress bodies
// as "elite" picks above the band. The count (FACTION_ELITE_UNITS) is the tuning
// knob — each elite body the sim drafts lifts IRON a controllable amount, so the
// win rate moves continuously instead of snapping. Selection-only: no source card
// is restatted, so the outlier sweep + alpha gate (which read the unbounded source
// JSON) are unaffected, and the FILL cards stay banded so IRON isn't globally
// stronger — it just gets a few signature Fortress finishers. IRON's ceiling is
// lifted only so those elite bodies survive the pool filter; the band sort still
// keeps them out of the FILL picks (they sort far from the 13.5 target). Other
// factions are untouched; GOLD/GODS stay ceiling-exempt as before.
const FACTION_BAND_TARGET = {}; // IRON's fill stays on the shared band (fair).
const FACTION_DRAFT_CEILING = {}; // IRON's FILL keeps the normal ceiling; only the
                                  // elite path (below) bypasses it, so the bulk of
                                  // the deck stays capped like every other faction.
// Tuned against the seat-bias-corrected matchup sim: 3 finishers capped at draft-
// power 14.4 lands IRON at 0.499 (dead-centre of the 47-52% target) and TIGHTENS the
// whole field to 0.469-0.524 (spread 0.055, was 0.102 with IRON the lone 0.438
// laggard). More/stronger finishers overshoot; fewer leave IRON short — see the
// sweep in the commit message. Env-overridable for re-tuning.
const FACTION_ELITE_UNITS = { IRON_DEFENDERS: Number(process.env.IRON_ELITE ?? 3) };
// Elite finishers are capped to a power window just above the shared band (not the
// faction's absolute monster tail) so each one is a measured lift, not a blowout.
const FACTION_ELITE_CEILING = { IRON_DEFENDERS: Number(process.env.IRON_ELITE_CEIL ?? 14.4) };
function bandTargetFor(faction) {
  return FACTION_BAND_TARGET[faction] ?? UNIT_BAND_TARGET;
}
function draftCeilingFor(faction) {
  return FACTION_DRAFT_CEILING[faction] ?? UNIT_DRAFT_CEILING;
}

function simDraftPower(card) {
  const stats = statBlock(card);
  return (
    (stats.attack || 0) +
    (stats.health || 0) * 0.8 +
    (stats.armor || 0) +
    (stats.speed || 0) * 0.6 +
    keywordCount(card) * 1.3 -
    (card.cost || 0) * 0.5
  );
}
// Distance of a unit's draft-power from the shared band target. GODS are exempt
// (only ~10 exist, never drafted by the 5-mortal-faction sim) — they return 0 so
// the band never reshapes the premium god slots.
function bandDistance(card) {
  if (card.type !== "unit" || card.faction === GOD) return 0;
  return Math.abs(simDraftPower(card) - bandTargetFor(card.faction));
}
// Above the cross-faction ceiling? Units only, and never for the exempt factions
// (GODS, GOLDEN_SOVEREIGNS — see the GOLD SHAVE note above for why GOLD stays exempt).
// IRON uses a raised ceiling (see IRON IDENTITY BUFF above) so its stronger
// Fortress tail survives selection.
function isAboveDraftCeiling(card) {
  if (card.type !== "unit" || CEILING_EXEMPT.has(card.faction)) return false;
  return simDraftPower(card) > draftCeilingFor(card.faction);
}

function baseScore(card) {
  const stats = statBlock(card);
  const statTotal =
    (stats.attack || 0) +
    (stats.health || 0) +
    (stats.armor || 0) +
    (stats.speed || 0);

  let score =
    rarityScore(card.rarity) * 10 +
    keywordCount(card) * 4 +
    subtypeScore(card) * 3 +
    statTotal;

  // stop cheap unit spam dominating selection
  if (card.type === "unit") {
    const ratio = efficiencyRatio(card);

    if (card.cost === 2) score -= 8;
    if (card.cost === 3) score += 2;
    if (card.cost === 4) score += 3;
    if (card.cost === 5) score += 1;

    if (card.cost <= 2 && keywordCount(card) >= 2) score -= 6;
    if (card.cost <= 2 && ratio > 5.5) score -= 10;
  }

  return score;
}

// --- Faction identity ----------------------------------------------------
// The curated source only carries the GUARD / RUSH / CRUSH keywords, so faction
// identity is expressed through (a) which of those a faction prefers, (b) the
// stat shape it skews toward, and (c) its mana curve. This pulls each faction's
// 14 curated units toward a distinct archetype instead of generic "best stats".
// EXPANSION (2026.06.01): each faction now curates UNITS_PER_FACTION (36) units
// instead of 14, surfacing far more of the already-legal corpus into the playable
// pool. The per-faction `curve` is extended to ~36 ordered cost-preferences so the
// larger pick set still resolves along the faction's signature mana curve (the
// same archetype shape, just deeper). Once the curve is exhausted, takeFactionCards
// backfills with the best-remaining card by faction-identity score — unchanged.
const FACTION_IDENTITY = {
  STONE_KEEPERS:     { archetype: "Endurance Wall",   keyword: "GUARD", stat: { health: 1.2, armor: 0.9 }, curve: [2,3,3,3,3,4,4,4,4,4,5,5,5,5, 2,3,3,3,4,4,4,4,5,5,5,6,6, 2,3,3,4,4,5,5,6,7] },
  IRON_DEFENDERS:    { archetype: "Fortress",         keyword: "GUARD", stat: { armor: 1.5, health: 0.6 }, curve: [2,2,3,3,3,3,4,4,4,4,4,5,5,5, 2,2,3,3,3,4,4,4,5,5,5,6,6, 2,3,3,4,4,5,5,6,7] },
  BRONZE_GUARDIANS:  { archetype: "Bruiser Midrange", keyword: "CRUSH", stat: { attack: 0.9, health: 0.5 }, curve: [2,2,3,3,3,3,3,4,4,4,4,4,5,5, 2,2,3,3,3,4,4,4,4,5,5,6,6, 2,3,3,4,4,5,5,6,7] },
  SILVER_SENTINELS:  { archetype: "Tempo Aggro",      keyword: "RUSH",  stat: { attack: 1.0, speed: 1.1 }, curve: [2,2,2,2,3,3,3,3,3,4,4,4,4,5, 2,2,2,3,3,3,4,4,4,5,5,5,6, 2,2,3,3,4,4,5,5,6] },
  GOLDEN_SOVEREIGNS: { archetype: "Premium Finisher", keyword: "CRUSH", stat: { attack: 0.8, health: 0.3 }, curve: [3,3,3,4,4,4,4,5,5,5,5,5,5,5, 3,4,4,4,5,5,5,6,6,6,7,7,7, 3,4,5,5,6,6,7,7,8] },
};

// Per-category curation depth. Bumped from the original 14/3/2 to surface far more
// of the legal corpus into the playable pool. GOLDEN_SOVEREIGNS has the smallest
// legal unit pool (~55) and the smallest artifact pool (1), so takeFactionCards
// simply takes what's available there — the count is an upper bound, never padded.
const UNITS_PER_FACTION = 36;
const EQUIPMENT_PER_FACTION = 6;
const ARTIFACTS_PER_FACTION = 3;
const GOD_UNITS = 8;

// Faction-identity bonus added on top of the generic baseScore. Rewards the
// faction's signature keyword and stat shape so its curated picks cohere.
function identityBonus(card, faction) {
  const id = FACTION_IDENTITY[faction];
  if (!id || card.type !== "unit") return 0;
  let bonus = 0;
  if ((card.keywords || []).includes(id.keyword)) bonus += 8;
  const stats = statBlock(card);
  for (const [k, w] of Object.entries(id.stat)) bonus += (stats[k] || 0) * w;
  return bonus;
}

function dedupeByName(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const key = `${card.faction}|${card.type}|${card.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Faction-aware sort: the cross-faction competitive band leads for units (cards
// closest to the shared draft-power target sort first, in coarse 0.5-wide buckets
// so float jitter never reorders), THEN the identity bonus rides on the generic
// balance score within a band bucket — so each faction still prefers its archetype
// while every faction's curated picks converge to the same power band. Equipment /
// artifacts (faction === null path) and GODS get bandDistance 0, so for them this
// is identical to the old identity+score sort. Deterministic tie-breaks on cost+id.
function sortPool(cards, faction = null) {
  return [...cards].sort((a, b) => {
    // Band-distance leads for units, rounded to 4dp so float jitter never reorders
    // (determinism). The closest-to-target unit wins outright; identity + score only
    // break ties between equally-band-fit cards. This compresses deep factions DOWN
    // to the shared band instead of letting their high-stat tail win on baseScore.
    const ba = Math.round(bandDistance(a) * 10000);
    const bb = Math.round(bandDistance(b) * 10000);
    if (ba !== bb) return ba - bb;
    const sa = baseScore(a) + identityBonus(a, faction);
    const sb = baseScore(b) + identityBonus(b, faction);
    if (sb !== sa) return sb - sa;
    if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
    return String(a.id).localeCompare(String(b.id));
  });
}

function filteredFactionPool(pool, faction) {
  return dedupeByName(
    pool
      .filter((c) => c.faction === faction)
      .filter((c) => !isBrokenCheapUnit(c))
      // Cross-faction competitive band: exclude over-ceiling monster bodies so the
      // sim's top-30 draft converges across factions (GOLD/GODS exempt — see above).
      .filter((c) => !isAboveDraftCeiling(c))
      // Never curate a soft-banned (disabled) card — the next-best real card
      // backfills the slot, keeping all curated picks deck-legal.
      .filter((c) => !isDisabledCard(c))
  );
}

function takeFactionCards(pool, faction, count, preferredCosts) {
  const factionPool = filteredFactionPool(pool, faction);
  const picked = [];
  const used = new Set();

  for (const cost of preferredCosts) {
    const candidate = sortPool(
      factionPool.filter((c) => !used.has(c.id) && c.cost === cost),
      faction
    )[0];

    if (candidate) {
      picked.push(candidate);
      used.add(candidate.id);
      if (picked.length >= count) return picked;
    }
  }

  for (const candidate of sortPool(factionPool, faction)) {
    if (used.has(candidate.id)) continue;
    picked.push(candidate);
    used.add(candidate.id);
    if (picked.length >= count) break;
  }

  return picked;
}

// Units selection with optional ELITE injection (see IRON IDENTITY BUFF). For a
// faction in FACTION_ELITE_UNITS, the strongest N already-legal bodies (raw
// draft-power, identity-tie-broken) are taken as above-band finishers, then the
// remaining slots are band-filled normally — so the bulk of the deck stays on the
// fair shared band and only N signature finishers ride above it. eliteN===0 (every
// other faction) is exactly the old takeFactionCards path.
function takeFactionUnits(pool, faction, count, preferredCosts) {
  const eliteN = FACTION_ELITE_UNITS[faction] || 0;
  if (eliteN <= 0) return takeFactionCards(pool, faction, count, preferredCosts);

  // Elite pool bypasses ONLY the draft-power ceiling (the band cap) — it still
  // honours every legality/quality filter — so stronger Fortress bodies become
  // eligible as finishers while the fill stays capped. Capped to the elite-power
  // window so the finishers are a measured lift, not the faction's monster tail.
  const eliteCeil = FACTION_ELITE_CEILING[faction] ?? Infinity;
  const elitePool = dedupeByName(
    pool
      .filter((c) => c.faction === faction)
      .filter((c) => !isBrokenCheapUnit(c))
      .filter((c) => !isDisabledCard(c))
      .filter((c) => simDraftPower(c) <= eliteCeil)
  );
  const elite = elitePool
    .sort(
      (a, b) =>
        simDraftPower(b) - simDraftPower(a) ||
        identityBonus(b, faction) - identityBonus(a, faction) ||
        String(a.id).localeCompare(String(b.id))
    )
    .slice(0, Math.min(eliteN, count));
  const eliteIds = new Set(elite.map((c) => c.id));
  const fill = takeFactionCards(
    pool.filter((c) => !eliteIds.has(c.id)),
    faction,
    count - elite.length,
    preferredCosts
  );
  return [...elite, ...fill];
}

// Less insane curve. Old one was poisoning the pool. Per-faction curves (above)
// override this for units; this is the fallback when a faction has no identity.
const unitCurve = [2,2,2,2,3,3,3,3,3,4,4,4,4,5];
const equipmentCurve = [2,3,4];
const artifactCurve = [3,4];

const curatedUnits = [];
const curatedEquipment = [];
const curatedArtifacts = [];

for (const faction of FACTIONS) {
  const curve = (FACTION_IDENTITY[faction] && FACTION_IDENTITY[faction].curve) || unitCurve;
  curatedUnits.push(...takeFactionUnits(units, faction, UNITS_PER_FACTION, curve));
  curatedEquipment.push(...takeFactionCards(equipment, faction, EQUIPMENT_PER_FACTION, equipmentCurve));
  curatedArtifacts.push(...takeFactionCards(artifacts, faction, ARTIFACTS_PER_FACTION, artifactCurve));
}

curatedUnits.push(...takeFactionCards(units, GOD, GOD_UNITS, [7,7,7,7,7,7,7,7]));

// --- Tag every curated pick as PRIMARY (gap #1) ----------------------------
// `isPrimary` marks the ~98 curated/known-good cards so the default deck builder
// (src/lib/buildCuratedDeck.ts) can prefer this clean set over the full noisy
// corpus. `sourceCardId` is the canonical "tcg_<token>" id (cardMaster.json id
// space) so consumers can cross-map without re-deriving it. Pure, deterministic.
function tagPrimary(card) {
  return {
    ...card,
    isPrimary: true,
    sourceCardId:
      card.sourceTokenId !== undefined && card.sourceTokenId !== null
        ? `tcg_${card.sourceTokenId}`
        : card.id,
  };
}
const taggedUnits = curatedUnits.map(tagPrimary);
const taggedEquipment = curatedEquipment.map(tagPrimary);
const taggedArtifacts = curatedArtifacts.map(tagPrimary);

const all = [...taggedUnits, ...taggedEquipment, ...taggedArtifacts];

const output = {
  units: taggedUnits,
  equipment: taggedEquipment,
  artifacts: taggedArtifacts,
  // Flat list of the canonical "tcg_<token>" ids for the primary/curated set —
  // the default deck builder's preferred source.
  primaryCardIds: all.map((c) => c.sourceCardId),
  all
};

const outPath = path.resolve(process.cwd(), "src/data/curatedCoreSetV2.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.log("=== CURATED CORE SET V2 BUILT ===");
console.log(`Units: ${curatedUnits.length}`);
console.log(`Equipment: ${curatedEquipment.length}`);
console.log(`Artifacts: ${curatedArtifacts.length}`);
console.log(`Total: ${all.length}`);
console.log(`Saved: ${outPath}`);
