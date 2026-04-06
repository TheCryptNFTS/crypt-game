/**
 * Canonical deck validation shim.
 *
 * Old code may still import deckRulesV2 symbols.
 * We route everything to the same validator so rules cannot drift.
 */
export {
  getCardFaction,
  inferCommanderFaction,
  validateDeck,
  type DeckCardLike,
  type DeckValidationResult,
} from "./deckRules";

export { validateDeck as validateDeckV2 } from "./deckRules";
