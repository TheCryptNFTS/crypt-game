import type { Faction } from "../types/faction";

export const FACTION_COLORS: Record<Faction, { bg: string; border: string; text: string; glow: string }> = {
  STONE: {
    bg: "bg-slate-800/50",
    border: "border-slate-500",
    text: "text-slate-300",
    glow: "shadow-slate-500/30",
  },
  IRON: {
    bg: "bg-zinc-800/50",
    border: "border-zinc-400",
    text: "text-zinc-300",
    glow: "shadow-zinc-400/30",
  },
  BRONZE: {
    bg: "bg-amber-900/30",
    border: "border-amber-600",
    text: "text-amber-400",
    glow: "shadow-amber-600/30",
  },
  SILVER: {
    bg: "bg-gray-700/40",
    border: "border-gray-300",
    text: "text-gray-200",
    glow: "shadow-gray-300/30",
  },
  GOLD: {
    bg: "bg-yellow-900/30",
    border: "border-yellow-500",
    text: "text-yellow-400",
    glow: "shadow-yellow-500/40",
  },
  GOD: {
    bg: "bg-purple-900/30",
    border: "border-purple-500",
    text: "text-purple-300",
    glow: "shadow-purple-500/40",
  },
};

export const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-yellow-400",
  commander: "text-crypt-accent",
  unknown: "text-gray-500",
};

export function getFactionGradient(faction: Faction): string {
  const gradients: Record<Faction, string> = {
    STONE: "from-slate-700 to-slate-900",
    IRON: "from-zinc-600 to-zinc-900",
    BRONZE: "from-amber-700 to-amber-950",
    SILVER: "from-gray-400 to-gray-800",
    GOLD: "from-yellow-600 to-yellow-950",
    GOD: "from-purple-600 to-purple-950",
  };
  return gradients[faction];
}
