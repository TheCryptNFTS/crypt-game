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
  /** Authored flavor quote — boilerplate/attribution stripped; empty when none. */
  flavor: string;
  imageUrl: string | null;
  animationUrl: string | null;
  externalUrl: string | null;
  traitsForDisplay: Array<{ label: string; value: string }>;
};

/**
 * Authored descriptions read: `"<quote>"\n\n— <ATTRIBUTION>\n\nPart of THE CRYPT · Genesis.`
 * The collection-wide "Part of …" trailer and the attribution line are chrome, not flavor;
 * we keep only the quote so the modal surfaces lore, not boilerplate.
 */
function extractFlavor(description: unknown): string {
  if (typeof description !== "string") return "";
  const cleaned = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^part of\b/i.test(line)) // collection trailer (every card)
    .filter((line) => !/^[—–-]\s*\S/.test(line)) // "— ATTRIBUTION" credit line
    .join(" ")
    .trim();
  // Source quotes ship wrapped in their own straight quotes; strip one matched pair
  // so the UI owns the quotation styling (decorative marks, italics) consistently.
  return cleaned.replace(/^["“](.*)["”]$/s, "$1").trim();
}

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
    flavor: extractFlavor(entry.description),
    imageUrl: entry.imageUrl ?? null,
    animationUrl: entry.animationUrl ?? null,
    externalUrl: entry.externalUrl ?? null,
    traitsForDisplay: traitsForPresentation(entry.role, entry.traits),
  };
}
