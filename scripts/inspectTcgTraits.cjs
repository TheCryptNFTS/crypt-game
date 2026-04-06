const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");

if (!fs.existsSync(INPUT_PATH)) {
  throw new Error(`Missing file: ${INPUT_PATH}`);
}

const cards = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));

const traitKeys = {};
const skinValues = {};
const armorValues = {};
const weaponValues = {};
const artifactValues = {};
const metaverseValues = {};
const mouthValues = {};
const headwearValues = {};
const creatureValues = {};
const eyeValues = {};

for (const card of cards) {
  const traits = card.rawTraits || {};

  for (const key of Object.keys(traits)) {
    traitKeys[key] = (traitKeys[key] || 0) + 1;
  }

  if (traits.Skin) skinValues[traits.Skin] = (skinValues[traits.Skin] || 0) + 1;
  if (traits.Armor) armorValues[traits.Armor] = (armorValues[traits.Armor] || 0) + 1;
  if (traits.Weapons) weaponValues[traits.Weapons] = (weaponValues[traits.Weapons] || 0) + 1;
  if (traits.Artifacts) artifactValues[traits.Artifacts] = (artifactValues[traits.Artifacts] || 0) + 1;
  if (traits.Metaverse) metaverseValues[traits.Metaverse] = (metaverseValues[traits.Metaverse] || 0) + 1;
  if (traits.Mouth) mouthValues[traits.Mouth] = (mouthValues[traits.Mouth] || 0) + 1;
  if (traits.Headwear) headwearValues[traits.Headwear] = (headwearValues[traits.Headwear] || 0) + 1;
  if (traits.Creature) creatureValues[traits.Creature] = (creatureValues[traits.Creature] || 0) + 1;
  if (traits.Eye) eyeValues[traits.Eye] = (eyeValues[traits.Eye] || 0) + 1;
}

function topEntries(obj, limit = 40) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

console.log("\n=== TRAIT KEYS ===");
console.log(JSON.stringify(topEntries(traitKeys, 50), null, 2));

console.log("\n=== TOP SKIN VALUES ===");
console.log(JSON.stringify(topEntries(skinValues, 80), null, 2));

console.log("\n=== TOP ARMOR VALUES ===");
console.log(JSON.stringify(topEntries(armorValues, 80), null, 2));

console.log("\n=== TOP WEAPON VALUES ===");
console.log(JSON.stringify(topEntries(weaponValues, 80), null, 2));

console.log("\n=== TOP ARTIFACT VALUES ===");
console.log(JSON.stringify(topEntries(artifactValues, 80), null, 2));

console.log("\n=== TOP METAVERSE VALUES ===");
console.log(JSON.stringify(topEntries(metaverseValues, 80), null, 2));

console.log("\n=== TOP CREATURE VALUES ===");
console.log(JSON.stringify(topEntries(creatureValues, 80), null, 2));
