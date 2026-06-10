import type { CSSProperties } from "react";

/** Per-faction tint used for edge + premium inner glow + foil. */
function factionTint(faction: string | undefined): string {
  // Match by substring so BOTH the short code ("STONE") and the full code
  // ("STONE_KEEPERS" / "Stone Keepers") resolve. The bug was that every card
  // fell through to the default cyan because the keys were short-only — so the
  // premium faction glow was always weak/cyan and the cards read as flat.
  const f = (faction ?? "").toUpperCase();
  if (f.includes("STONE")) return "rgba(176, 180, 196, 0.8)";
  if (f.includes("IRON")) return "rgba(143, 155, 179, 0.85)";
  if (f.includes("BRONZE")) return "rgba(201, 139, 72, 0.85)";
  if (f.includes("SILVER")) return "rgba(207, 214, 230, 0.85)";
  if (f.includes("GOLD") || f.includes("SOVEREIGN")) return "rgba(233, 201, 132, 0.9)";
  if (f.includes("GOD")) return "rgba(183, 155, 255, 0.85)";
  return "rgba(233, 201, 132, 0.55)"; // brand gold fallback (not cyan)
}

/** Edge tint from faction — subtle, not fantasy rainbow. */
export function factionEdgeStyle(faction: string | undefined): CSSProperties {
  const c = factionTint(faction);
  return {
    background: `linear-gradient(180deg, ${c} 0%, transparent 28%, transparent 72%, ${c} 100%)`,
  };
}

/** Sets the --cf-faction CSS var consumed by polish-cards.css (glow + foil). */
export function factionVarStyle(faction: string | undefined): CSSProperties {
  return { ["--cf-faction" as string]: factionTint(faction) } as CSSProperties;
}

/** Normalize rarity → a single gem tier key used by polish-cards.css. */
function rarityTier(rarity: string | undefined, commander?: boolean): string {
  const r = (rarity ?? "").toLowerCase();
  if (commander || r.includes("commander")) return "commander";
  if (r === "god" || r.includes("one_of") || r.includes("one-of")) return "oneofone";
  if (r === "mythic") return "mythic";
  if (r === "legendary") return "legendary";
  if (r === "epic") return "epic";
  if (r === "rare") return "rare";
  if (r === "uncommon") return "uncommon";
  return "common";
}

/** Sculpted rarity gem/bar classes (replaces the flat strip). */
export function rarityGemClass(rarity: string | undefined, commander?: boolean): string {
  return `crypt-rarity-gem crypt-rarity-${rarityTier(rarity, commander)}`;
}

/** High rarities only get an animated foil sheen (perf on 4k-card grids). */
export function foilClass(rarity: string | undefined, commander?: boolean): string | null {
  const tier = rarityTier(rarity, commander);
  if (tier === "oneofone" || tier === "mythic") return "crypt-foil crypt-foil-strong";
  if (tier === "legendary" || tier === "commander") return "crypt-foil";
  return null;
}

export function rarityStripClass(rarity: string | undefined): string {
  const r = (rarity ?? "").toLowerCase();
  if (r.includes("commander")) {
    return "bg-gradient-to-r from-amber-900/90 via-amber-600/50 to-amber-900/90";
  }
  if (r === "god" || r.includes("one_of")) {
    return "bg-gradient-to-r from-amber-950/80 via-yellow-700/40 to-amber-950/80";
  }
  if (r === "legendary") {
    return "bg-gradient-to-r from-zinc-800 via-violet-950/70 to-zinc-800";
  }
  if (r === "epic") {
    return "bg-gradient-to-r from-cyan-950/80 via-cyan-800/35 to-cyan-950/80";
  }
  if (r === "rare") {
    return "bg-gradient-to-r from-slate-800 via-slate-600/50 to-slate-800";
  }
  if (r === "uncommon") {
    return "bg-gradient-to-r from-emerald-950/70 via-emerald-900/25 to-emerald-950/70";
  }
  return "bg-gradient-to-r from-zinc-900 via-zinc-800/80 to-zinc-900";
}
