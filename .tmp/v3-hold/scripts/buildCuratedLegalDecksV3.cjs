const fs = require("fs");
const path = require("path");

const identities = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "config/factionIdentities.json"), "utf8")
);

const core = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/curatedCoreSetV3.json"), "utf8")
);

const commanders = {
  cmd_stone_warden: "STONE",
  cmd_iron_warlord: "IRON",
  cmd_bronze_raider: "BRONZE",
  cmd_silver_oracle: "SILVER",
  cmd_golden_emperor: "GOLD"
};

function repeatPool(cards, target, maxCopies = 2) {
  const out = [];
  let copy = 0;
  while (out.length < target && cards.length > 0 && copy < maxCopies) {
    for (const card of cards) {
      if (out.length >= target) break;
      out.push(card.id);
    }
    copy++;
  }
  return out.slice(0, target);
}

function buildDeckForFaction(faction) {
  const identity = identities[faction];

  const factionUnits = core.units.filter((c) => c.faction === faction);
  const factionEquipment = core.equipment.filter((c) => c.faction === faction);
  const factionArtifacts = core.artifacts.filter((c) => c.faction === faction);
  const gods = core.units.filter((c) => c.faction === "GOD");

  const targetUnits = 18;
  const targetEquipment = identity.equipmentTargets;
  const targetArtifacts = identity.artifactTargets;

  const unitIds = repeatPool(factionUnits, targetUnits, 3);
  const equipmentIds = repeatPool(factionEquipment, targetEquipment, 3);
  const artifactIds = repeatPool(factionArtifacts, targetArtifacts, 3);

  const deck = [...unitIds, ...equipmentIds, ...artifactIds];

  if (deck.length < 29 && gods.length > 0) {
    deck.push(gods[0].id);
  }

  while (deck.length < 30 && factionUnits.length > 0) {
    deck.push(factionUnits[deck.length % factionUnits.length].id);
  }

  return deck.slice(0, 30);
}

const output = {};

for (const [commanderId, faction] of Object.entries(commanders)) {
  output[commanderId] = {
    commanderId,
    faction,
    cards: buildDeckForFaction(faction)
  };
}

fs.writeFileSync(
  path.resolve(process.cwd(), "src/data/curatedLegalDecksV3.json"),
  JSON.stringify(output, null, 2),
  "utf8"
);

console.log("=== CURATED LEGAL DECKS V3 BUILT ===");
for (const [id, deck] of Object.entries(output)) {
  console.log(`${id}: ${deck.cards.length} cards`);
}
console.log(`Saved: ${path.resolve(process.cwd(), "src/data/curatedLegalDecksV3.json")}`);
