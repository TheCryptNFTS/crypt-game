/**
 * CONSTRUCTED LEGALITY — the single definition of which cards may enter a
 * ranked / PvP / owned deck.
 *
 * The full Combat Archives catalog is ~4,100 cards, but ~1,544 of the units are
 * balance OUTLIERS: their stat budget is >6.0x the cost-curve baseline (the same
 * computeOutliers() formula that backs `cardOutlierBaseline.json` and the
 * dev:card-outliers gate). Those cards are fine to OWN, collect, and show off —
 * but letting them into a constructed deck hands whoever happens to own one an
 * un-fun, un-fair PvP advantage that has nothing to do with skill or deckbuilding.
 *
 * So constructed-legal = the catalog MINUS the known outliers MINUS soft-banned
 * (disabled) cards. The hand-curated 231-card core set (curatedCoreSetV2) already
 * contains ZERO outliers — it is a strict subset of the legal pool — so the demo /
 * starter path is already legal and is intentionally NOT touched here.
 *
 * This is a POOL restriction, not a re-cost: no card's stats change, nothing is
 * deleted, and the whole thing flips off with one constant. The deeper, tighter
 * "only the 231 curated cards are legal" format is a separate design + playtest
 * decision — this module just fences the provably-broken cards out of PvP.
 */
import outlierBaseline from "../data/cardOutlierBaseline.json";

/**
 * Master switch. When false, every card is treated as constructed-legal and deck
 * construction behaves exactly as before (no fence). One line to revert.
 */
export const CONSTRUCTED_LEGAL_ENABLED = true;

/** The frozen set of balance-outlier ids that are NOT constructed-legal. */
const OUTLIER_IDS: ReadonlySet<string> = new Set(outlierBaseline.ids as string[]);

/** How many cards are fenced out of constructed play (for honest UI/reporting). */
export const CONSTRUCTED_BANNED_COUNT = OUTLIER_IDS.size;

/**
 * Is this card legal in a ranked / PvP / owned deck? A card is illegal if it is a
 * known balance outlier or is soft-banned (disabled). When the master switch is
 * off, everything is legal. Accepts either a card object (preferred — also checks
 * `disabled`) or a bare id.
 */
export function isConstructedLegal(card: { id: string; disabled?: boolean } | string): boolean {
  if (!CONSTRUCTED_LEGAL_ENABLED) return true;
  if (typeof card === "string") return !OUTLIER_IDS.has(card);
  if (card.disabled === true) return false;
  return !OUTLIER_IDS.has(card.id);
}

/**
 * Filter a pool down to its constructed-legal cards. No-op when the switch is off.
 * Used at deck-build intake so an owned collection's outliers never enter a
 * ranked deck.
 */
export function constructedLegalPool<T extends { id: string; disabled?: boolean }>(pool: T[]): T[] {
  if (!CONSTRUCTED_LEGAL_ENABLED) return pool;
  return pool.filter((c) => c && isConstructedLegal(c));
}
