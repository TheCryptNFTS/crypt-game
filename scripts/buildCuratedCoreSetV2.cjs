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
const FACTION_IDENTITY = {
  STONE_KEEPERS:     { archetype: "Endurance Wall",   keyword: "GUARD", stat: { health: 1.2, armor: 0.9 }, curve: [2,3,3,3,3,4,4,4,4,4,5,5,5,5] },
  IRON_DEFENDERS:    { archetype: "Fortress",         keyword: "GUARD", stat: { armor: 1.5, health: 0.6 }, curve: [2,2,3,3,3,3,4,4,4,4,4,5,5,5] },
  BRONZE_GUARDIANS:  { archetype: "Bruiser Midrange", keyword: "CRUSH", stat: { attack: 0.9, health: 0.5 }, curve: [2,2,3,3,3,3,3,4,4,4,4,4,5,5] },
  SILVER_SENTINELS:  { archetype: "Tempo Aggro",      keyword: "RUSH",  stat: { attack: 1.0, speed: 1.1 }, curve: [2,2,2,2,3,3,3,3,3,4,4,4,4,5] },
  GOLDEN_SOVEREIGNS: { archetype: "Premium Finisher", keyword: "CRUSH", stat: { attack: 0.8, health: 0.3 }, curve: [3,3,3,4,4,4,4,5,5,5,5,5,5,5] },
};

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

// Faction-aware sort: identity bonus rides on top of the generic balance score,
// so each faction prefers cards that match its archetype (falling back to raw
// score when faction is null, e.g. equipment/artifact pools).
function sortPool(cards, faction = null) {
  return [...cards].sort((a, b) => {
    const sa = baseScore(a) + identityBonus(a, faction);
    const sb = baseScore(b) + identityBonus(b, faction);
    if (sb !== sa) return sb - sa;
    if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
    return String(a.id).localeCompare(String(b.id));
  });
}

function filteredFactionPool(pool, faction) {
  return dedupeByName(
    pool.filter((c) => c.faction === faction).filter((c) => !isBrokenCheapUnit(c))
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
  curatedUnits.push(...takeFactionCards(units, faction, 14, curve));
  curatedEquipment.push(...takeFactionCards(equipment, faction, 3, equipmentCurve));
  curatedArtifacts.push(...takeFactionCards(artifacts, faction, 2, artifactCurve));
}

curatedUnits.push(...takeFactionCards(units, GOD, 4, [7,7,7,7]));

const all = [...curatedUnits, ...curatedEquipment, ...curatedArtifacts];

const output = {
  units: curatedUnits,
  equipment: curatedEquipment,
  artifacts: curatedArtifacts,
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
