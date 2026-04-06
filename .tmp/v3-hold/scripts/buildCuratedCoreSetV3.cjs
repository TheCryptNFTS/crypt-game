const fs = require("fs");
const path = require("path");

const profile = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "config/balanceProfile.json"), "utf8")
);
const identities = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "config/factionIdentities.json"), "utf8")
);

const units = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"), "utf8")
);
const equipment = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"), "utf8")
);
const artifacts = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"), "utf8")
);

function kwScore(keywords = []) {
  return keywords.reduce((sum, k) => sum + (profile.keywordWeights[k] || 0), 0);
}

function unitScore(card) {
  const s = card.stats || {};
  return (
    (s.attack || 0) * profile.unitStatWeights.attack +
    (s.health || 0) * profile.unitStatWeights.health +
    (s.armor || 0) * profile.unitStatWeights.armor +
    (s.speed || 0) * profile.unitStatWeights.speed +
    kwScore(card.keywords || [])
  );
}

function equipmentScore(card) {
  const s = card.bonuses || {};
  return (
    (s.attack || 0) * profile.equipmentStatWeights.attack +
    (s.health || 0) * profile.equipmentStatWeights.health +
    (s.armor || 0) * profile.equipmentStatWeights.armor +
    (s.speed || 0) * profile.equipmentStatWeights.speed +
    kwScore(card.keywords || [])
  );
}

function artifactScore(card) {
  return (card.effectTags || []).length + kwScore(card.effectTags || []);
}

function ratio(card) {
  if (card.type === "unit") {
    const budget = profile.unitBudgetByCost[String(card.cost)] || 999;
    return unitScore(card) / budget;
  }
  if (card.type === "equipment") {
    const budget = profile.equipmentBudgetByCost[String(card.cost)] || 999;
    return equipmentScore(card) / budget;
  }
  const budget = profile.artifactBudgetByCost[String(card.cost)] || 999;
  return artifactScore(card) / budget;
}

function keywordFit(card, faction) {
  const identity = identities[faction];
  const kws = card.keywords || card.effectTags || [];
  return kws.reduce((sum, k) => sum + (identity.keywords.includes(k) ? 2 : 0), 0);
}

function costFit(card, faction) {
  const identity = identities[faction];
  return identity.preferredCosts.includes(card.cost) ? 2 : 0;
}

function rarityRank(rarity) {
  return {
    common: 1,
    unknown: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    god: 6,
    one_of_one: 7
  }[rarity] || 1;
}

function cardPriority(card, faction) {
  const rawRatio = ratio(card);
  const safeBonus = rawRatio <= 1 ? 3 : rawRatio <= 1.08 ? 1 : -10;
  return (
    safeBonus +
    keywordFit(card, faction) +
    costFit(card, faction) +
    rarityRank(card.rarity) * 0.4
  );
}

function cleanPool(cards, maxRatio) {
  return cards.filter((c) => ratio(c) <= maxRatio);
}

const safeUnits = cleanPool(units, profile.maxUnitRatioOverBudget);
const safeEquipment = cleanPool(equipment, profile.maxEquipmentRatioOverBudget);
const safeArtifacts = cleanPool(artifacts, profile.maxArtifactRatioOverBudget);

const factions = ["STONE", "IRON", "BRONZE", "SILVER", "GOLD"];
const curated = {
  units: [],
  equipment: [],
  artifacts: [],
  all: []
};

for (const faction of factions) {
  const factionUnits = safeUnits
    .filter((c) => c.faction === faction)
    .sort((a, b) => cardPriority(b, faction) - cardPriority(a, faction));

  const factionEquipment = safeEquipment
    .filter((c) => c.faction === faction)
    .sort((a, b) => cardPriority(b, faction) - cardPriority(a, faction));

  const factionArtifacts = safeArtifacts
    .filter((c) => c.faction === faction)
    .sort((a, b) => cardPriority(b, faction) - cardPriority(a, faction));

  const wantUnits = 16;
  const wantEquipment = 5;
  const wantArtifacts = 3;

  const pickedUnits = factionUnits.slice(0, wantUnits);
  const pickedEquipment = factionEquipment.slice(0, wantEquipment);
  const pickedArtifacts = factionArtifacts.slice(0, wantArtifacts);

  curated.units.push(...pickedUnits);
  curated.equipment.push(...pickedEquipment);
  curated.artifacts.push(...pickedArtifacts);
}

const godUnits = safeUnits
  .filter((c) => c.faction === "GOD")
  .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))
  .slice(0, 4);

curated.units.push(...godUnits);

curated.all = [...curated.units, ...curated.equipment, ...curated.artifacts];

fs.writeFileSync(
  path.resolve(process.cwd(), "src/data/curatedCoreSetV3.json"),
  JSON.stringify(curated, null, 2),
  "utf8"
);

console.log("=== CURATED CORE SET V3 BUILT ===");
console.log(`Units: ${curated.units.length}`);
console.log(`Equipment: ${curated.equipment.length}`);
console.log(`Artifacts: ${curated.artifacts.length}`);
console.log(`Total: ${curated.all.length}`);
console.log(`Saved: ${path.resolve(process.cwd(), "src/data/curatedCoreSetV3.json")}`);
