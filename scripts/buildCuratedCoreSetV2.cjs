const fs = require("fs");
const path = require("path");

const units = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"), "utf8"));
const equipment = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"), "utf8"));
const artifacts = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"), "utf8"));

const FACTIONS = ["STONE", "IRON", "BRONZE", "SILVER", "GOLD"];
const GOD = "GOD";

function keywordCount(card) {
  return (card.keywords || card.effectTags || []).length;
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

function baseScore(card) {
  const stats = card.stats || card.bonuses || {};
  const statTotal =
    (stats.attack || 0) +
    (stats.health || 0) +
    (stats.armor || 0) +
    (stats.speed || 0);

  return (
    rarityScore(card.rarity) * 10 +
    keywordCount(card) * 4 +
    subtypeScore(card) * 3 +
    statTotal
  );
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

function takeFactionCards(pool, faction, count, preferredCosts) {
  const factionPool = dedupeByName(pool.filter((c) => c.faction === faction));
  const picked = [];
  const used = new Set();

  for (const cost of preferredCosts) {
    const candidate = factionPool
      .filter((c) => !used.has(c.id) && c.cost === cost)
      .sort((a, b) => baseScore(b) - baseScore(a))[0];

    if (candidate) {
      picked.push(candidate);
      used.add(candidate.id);
      if (picked.length >= count) return picked;
    }
  }

  for (const candidate of factionPool.sort((a, b) => baseScore(b) - baseScore(a))) {
    if (used.has(candidate.id)) continue;
    picked.push(candidate);
    used.add(candidate.id);
    if (picked.length >= count) break;
  }

  return picked;
}

const unitCurve = [2,2,2,2,2,2,3,3,3,3,4,4,4,5];
const equipmentCurve = [2,2,3];
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
