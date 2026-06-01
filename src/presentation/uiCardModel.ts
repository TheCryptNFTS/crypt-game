import type { RenderManifestEntry, RenderRole } from "../types/renderManifest";
import { traitsForPresentation } from "./traitFilters";

/** How the card reads in the product — sacred (commander) vs tactical (playable). */
export type UICardVisualTier = "sacred" | "tactical";

/**
 * Single normalized model for CRYPT UI. Components should prefer this over raw manifest fields.
 * Source of truth for art URLs remains manifest; this layer only curates what humans see.
 */
export type UICardDisplay = {
  id: string;
  name: string;
  role: RenderRole;
  visualTier: UICardVisualTier;
  faction: string;
  rarityLabel: string | null;
  cost: number | null;
  keywords: string[];
  /** Human-readable rules text — empty string when the card has no ability. */
  ability: string;
  imageUrl: string | null;
  animationUrl: string | null;
  externalUrl: string | null;
  traitsForDisplay: Array<{ label: string; value: string }>;
};

export function toUICardDisplay(entry: RenderManifestEntry): UICardDisplay {
  const visualTier: UICardVisualTier = entry.role === "commander" ? "sacred" : "tactical";
  return {
    id: entry.id,
    name: entry.name?.trim() || entry.id,
    role: entry.role,
    visualTier,
    faction: entry.faction?.trim() || "—",
    rarityLabel: entry.rarity?.trim() || null,
    cost: entry.cost ?? null,
    keywords: Array.isArray(entry.keywords) ? [...entry.keywords] : [],
    ability: typeof entry.ability === "string" ? entry.ability.trim() : "",
    imageUrl: entry.imageUrl ?? null,
    animationUrl: entry.animationUrl ?? null,
    externalUrl: entry.externalUrl ?? null,
    traitsForDisplay: traitsForPresentation(entry.role, entry.traits),
  };
}
