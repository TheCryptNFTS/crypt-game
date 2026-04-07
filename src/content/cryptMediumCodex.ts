import type { RenderManifestEntry } from "../types/renderManifest";

/**
 * One-line codex voices for archive inspect (Character trait on Crypt digital trading cards).
 * Anchored to the official @thecryptnfts Medium series—Crypt Legends, Cryptopia, Kraken of Aqualon,
 * D'Vile One the fallen guardian, Mr. LOL the man who laughed, Elara the woman who endured.
 * UI summations only, not article excerpts. (Medium URLs were not readable from the build environment;
 * phrasing follows those titles + in-repo asset names.)
 */
const VOICE_BY_CHARACTER_NORMALIZED: Record<string, string> = {
  "mr lol": "Mr. LOL—the Crypt still hears the man who laughed.",
  "mr. lol": "Mr. LOL—the Crypt still hears the man who laughed.",
  "the kraken": "The Kraken of Aqualon—depth wakes when this Crypt Digital Trading Card hits the field.",
  kraken: "The Kraken of Aqualon—depth wakes when this Crypt Digital Trading Card hits the field.",
  "d'vile": "D'Vile One—the fallen guardian does not forgive the Crypt.",
  dvile: "D'Vile One—the fallen guardian does not forgive the Crypt.",
  "d'vile one": "D'Vile One—the fallen guardian does not forgive the Crypt.",
  elara: "Elara endured—the woman who endured still answers when the Crypt calls.",
};

function normalizeCharacter(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Resolve a single codex voice from manifest Character trait, if present. */
export function codexVoiceForManifestEntry(entry: RenderManifestEntry): string | null {
  const traits = entry.traits;
  if (!traits?.length) return null;
  for (const t of traits) {
    if (String(t.trait_type).toLowerCase() !== "character") continue;
    const raw = String(t.value ?? "").trim();
    if (!raw) continue;
    const key = normalizeCharacter(raw);
    if (VOICE_BY_CHARACTER_NORMALIZED[key]) return VOICE_BY_CHARACTER_NORMALIZED[key];
    const nk = key.replace(/['']/g, "");
    for (const [alias, voice] of Object.entries(VOICE_BY_CHARACTER_NORMALIZED)) {
      if (alias.replace(/['']/g, "") === nk) return voice;
    }
  }
  return null;
}

/**
 * One restrained line for archive / verdict surfaces: named Character voices first, else sacred commander framing.
 */
export function lorePresenceForManifestEntry(entry: RenderManifestEntry): string | null {
  const named = codexVoiceForManifestEntry(entry);
  if (named) return named;
  if (entry.role === "commander") {
    return "Sacred commander—Crypt OG Skulls and Crypt Legends answer to this identity first.";
  }
  return null;
}
