import type { RenderRole } from "../types/renderManifest";

/** Values that add no UI meaning */
const NOISE_VALUES = new Set(["", "none", "n/a", "null"]);

function cleanValue(v: string | number): string | null {
  const s = String(v).trim();
  if (!s) return null;
  if (NOISE_VALUES.has(s.toLowerCase())) return null;
  return s;
}

/** Commander identity traits only (OG art / collectible read). Expand when manifest carries gameplay traits. */
const COMMANDER_TRAIT_PRIORITY = [
  "Backgrounds",
  "Skins",
  "Eyes",
  "Headwears",
  "Headwear",
  "Mouth",
  "Clothes",
  "Body",
] as const;

function displayLabel(traitType: string): string {
  if (traitType === "Headwears") return "Headwear";
  return traitType;
}

/**
 * Never pipe raw OpenSea rows into UI.
 * - Commanders: ordered, meaningful cosmetics only.
 * - Playables: empty until manifest attaches gameplay/display traits (avoid wrong “Eyes” on units).
 */
export function traitsForPresentation(
  role: RenderRole,
  traits?: Array<{ trait_type: string; value: string | number }>
): Array<{ label: string; value: string }> {
  if (!traits?.length) return [];
  if (role !== "commander") return [];

  const rows: Array<{ label: string; value: string; priority: number }> = [];
  for (const t of traits) {
    const value = cleanValue(t.value);
    if (value == null) continue;
    const type = String(t.trait_type).trim();
    const p = (COMMANDER_TRAIT_PRIORITY as readonly string[]).indexOf(type);
    const priority = p === -1 ? 100 + rows.length : p;
    rows.push({ label: displayLabel(type), value, priority });
  }
  rows.sort((a, b) => a.priority - b.priority);
  const dedup = new Map<string, string>();
  for (const r of rows) {
    if (!dedup.has(r.label)) dedup.set(r.label, r.value);
  }
  return [...dedup.entries()].map(([label, value]) => ({ label, value })).slice(0, 8);
}
