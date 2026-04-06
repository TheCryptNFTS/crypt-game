import { buildGeneratedTcgDeck } from "../lib/buildGeneratedTcgDeck";
import { validateDeck } from "../engine/deckRules";

const stoneCommander = "cmd_stone_warden";
const bronzeCommander = "cmd_bronze_raider";

const stoneDeck = buildGeneratedTcgDeck(stoneCommander);
const bronzeDeck = buildGeneratedTcgDeck(bronzeCommander);

const stoneValidation = validateDeck(stoneDeck, stoneCommander);
const bronzeValidation = validateDeck(bronzeDeck, bronzeCommander);

console.log("\n=== STONE DECK CHECK ===");
console.log(
  JSON.stringify(
    {
      valid: stoneValidation.valid,
      errors: stoneValidation.errors,
      warnings: stoneValidation.warnings,
      stats: stoneValidation.stats,
      first10: stoneDeck.slice(0, 10)
    },
    null,
    2
  )
);

console.log("\n=== BRONZE DECK CHECK ===");
console.log(
  JSON.stringify(
    {
      valid: bronzeValidation.valid,
      errors: bronzeValidation.errors,
      warnings: bronzeValidation.warnings,
      stats: bronzeValidation.stats,
      first10: bronzeDeck.slice(0, 10)
    },
    null,
    2
  )
);

console.log("\n=== STATUS ===");
console.log("Generated TCG deck rules are working if both decks validate.");
