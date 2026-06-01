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
// power), so capping it would cut its only competitive cards and bury it; GODS are
// intentional premium top-end and never enter the 5-mortal-faction sim. Excluded
// cards stay fully deck-legal in the corpus — only the curated SELECTION is bounded.
const UNIT_DRAFT_CEILING = 14.3;
const CEILING_EXEMPT = new Set([GOD, "GOLDEN_SOVEREIGNS"]);
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
  return Math.abs(simDraftPower(card) - UNIT_BAND_TARGET);
}
// Above the cross-faction ceiling? Units only, and never for the exempt factions.
function isAboveDraftCeiling(card) {
  if (card.type !== "unit" || CEILING_EXEMPT.has(card.faction)) return false;
  return simDraftPower(card) > UNIT_DRAFT_CEILING;
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
  curatedUnits.push(...takeFactionCards(units, faction, UNITS_PER_FACTION, curve));
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
