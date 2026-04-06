import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import { validateDeckV2 } from "../engine/deckRulesV2";

const commanders = [
  "cmd_stone_warden",
  "cmd_iron_warlord",
  "cmd_bronze_raider",
  "cmd_silver_oracle",
  "cmd_golden_emperor"
];

for (const commanderId of commanders) {
  const deck = buildCuratedDeck(commanderId);
  const result = validateDeckV2(deck, commanderId);

  console.log(`\n=== ${commanderId.toUpperCase()} ===`);
  console.log(JSON.stringify({
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    stats: result.stats,
    first10: deck.slice(0, 10)
  }, null, 2));
}
