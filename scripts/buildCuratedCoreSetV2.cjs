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

const FACTIONS = ["STONE", "IRON", "BRONZE", "SILVER", "GOLD"];
const GOD = "GOD";

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

function dedupeByName(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const key = `${card.faction}|${card.type}|${card.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortPool(cards) {
  return [...cards].sort((a, b) => {
    const scoreDiff = baseScore(b) - baseScore(a);
    if (scoreDiff !== 0) return scoreDiff;
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
      factionPool.filter((c) => !used.has(c.id) && c.cost === cost)
    )[0];

    if (candidate) {
      picked.push(candidate);
      used.add(candidate.id);
      if (picked.length >= count) return picked;
    }
  }

  for (const candidate of sortPool(factionPool)) {
    if (used.has(candidate.id)) continue;
    picked.push(candidate);
    used.add(candidate.id);
    if (picked.length >= count) break;
  }

  return picked;
}

// Less insane curve. Old one was poisoning the pool.
const unitCurve = [2,2,2,2,3,3,3,3,3,4,4,4,4,5];
const equipmentCurve = [2,3,4];
const artifactCurve = [3,4];

const curatedUnits = [];
const curatedEquipment = [];
const curatedArtifacts = [];

for (const faction of FACTIONS) {
  curatedUnits.push(...takeFactionCards(units, faction, 14, unitCurve));
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
