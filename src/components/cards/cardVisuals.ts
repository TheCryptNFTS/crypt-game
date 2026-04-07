import type { CSSProperties } from "react";

/** Edge tint from faction — subtle, not fantasy rainbow. */
export function factionEdgeStyle(faction: string | undefined): CSSProperties {
  const f = (faction ?? "").toUpperCase();
  const stops: Record<string, string> = {
    STONE: "rgba(140, 140, 150, 0.55)",
    IRON: "rgba(120, 145, 170, 0.6)",
    BRONZE: "rgba(180, 120, 75, 0.55)",
    SILVER: "rgba(185, 195, 210, 0.55)",
    GOLD: "rgba(201, 164, 58, 0.65)",
    GOD: "rgba(201, 164, 58, 0.4)",
  };
  const c = stops[f] ?? "rgba(107, 221, 245, 0.35)";
  return {
    background: `linear-gradient(180deg, ${c} 0%, transparent 28%, transparent 72%, ${c} 100%)`,
  };
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
