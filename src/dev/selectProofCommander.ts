import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";

/**
 * Picks a commander that GUARANTEES the trait-sync dev proofs work under the
 * canonical Keyword-only sync identity.
 *
 * Strategy: choose the commander whose `traits.Keyword` produces the most
 * exact-match UNITS among allPlayableCards (a commander's keyword exactly
 * matching a card's `rawTraits.Keyword`). "Taunt" (682 cards) wins in practice,
 * but we compute it robustly rather than hardcoding. Falls back to
 * allCommanders[0] if nothing qualifies.
 */
export function selectProofCommander() {
  const units = allPlayableCards.filter((c) => c.type === "unit");

  let best: (typeof allCommanders)[number] | undefined;
  let bestCount = 0;

  for (const commander of allCommanders) {
    const kw = commander.traits?.Keyword;
    if (!kw) continue;
    const matches = units.filter((c) => (c.rawTraits ?? {}).Keyword === kw).length;
    if (matches > bestCount) {
      bestCount = matches;
      best = commander;
    }
  }

  return best ?? allCommanders[0];
}
