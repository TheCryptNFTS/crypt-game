import curatedDecks from "../data/curatedLegalDecksV3.json";
import { validateDeck } from "../engine/deckRules";

const data = curatedDecks as Record<
  string,
  {
    commanderId: string;
    faction: string;
    cards: string[];
  }
>;

for (const [commanderId, entry] of Object.entries(data)) {
  const result = validateDeck(entry.cards, commanderId);

  console.log(`\n=== ${commanderId} ===`);
  console.log(
    JSON.stringify(
      {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        stats: result.stats,
        first10: entry.cards.slice(0, 10)
      },
      null,
      2
    )
  );
}
