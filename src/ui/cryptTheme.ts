import { CryptFaction, SyncLevel } from "./cryptTypes";

export const factionTheme: Record<
  CryptFaction,
  {
    label: string;
    edge: string;
    glow: string;
    chip: string;
    shadow: string;
  }
> = {
  STONE: {
    label: "Stone Keepers",
    edge: "#8e949b",
    glow: "rgba(166, 173, 181, 0.35)",
    chip: "rgba(142, 148, 155, 0.16)",
    shadow: "0 0 28px rgba(166, 173, 181, 0.2)"
  },
  IRON: {
    label: "Iron Defenders",
    edge: "#7aa6ff",
    glow: "rgba(72, 133, 255, 0.35)",
    chip: "rgba(72, 133, 255, 0.16)",
    shadow: "0 0 28px rgba(72, 133, 255, 0.24)"
  },
  BRONZE: {
    label: "Bronze Guardians",
    edge: "#c98b48",
    glow: "rgba(201, 139, 72, 0.35)",
    chip: "rgba(201, 139, 72, 0.16)",
    shadow: "0 0 28px rgba(201, 139, 72, 0.24)"
  },
  SILVER: {
    label: "Silver Sentinels",
    edge: "#cfd6e6",
    glow: "rgba(130, 227, 255, 0.34)",
    chip: "rgba(130, 227, 255, 0.16)",
    shadow: "0 0 28px rgba(130, 227, 255, 0.24)"
  },
  GOLD: {
    label: "Golden Sovereigns",
    edge: "#f0d24f",
    glow: "rgba(240, 210, 79, 0.4)",
    chip: "rgba(240, 210, 79, 0.18)",
    shadow: "0 0 30px rgba(240, 210, 79, 0.28)"
  },
  GOD: {
    label: "Gods",
    edge: "#ae77ff",
    glow: "rgba(174, 119, 255, 0.4)",
    chip: "rgba(174, 119, 255, 0.18)",
    shadow: "0 0 30px rgba(174, 119, 255, 0.28)"
  }
};

export const syncTheme: Record<
  SyncLevel,
  {
    label: string;
    tone: string;
    bg: string;
    border: string;
  }
> = {
  none: {
    label: "No Sync",
    tone: "#8e949b",
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.1)"
  },
  category: {
    label: "Category Sync",
    tone: "#8D5CFF",
    bg: "rgba(141,92,255,0.12)",
    border: "rgba(141,92,255,0.32)"
  },
  exact: {
    label: "Exact Match",
    tone: "#f0d24f",
    bg: "rgba(240,210,79,0.14)",
    border: "rgba(240,210,79,0.38)"
  },
  legendary: {
    label: "Legendary Aura",
    tone: "#f0d24f",
    bg: "rgba(240,210,79,0.16)",
    border: "rgba(240,210,79,0.44)"
  },
  oneOfOne: {
    label: "One of One",
    tone: "#ff6a6a",
    bg: "rgba(255,106,106,0.14)",
    border: "rgba(255,106,106,0.42)"
  }
};

export function rarityClassName(rarityLabel: string) {
  if (rarityLabel === "One of One") return "crypt-rarity crypt-rarity--one";
  if (rarityLabel === "Legendary") return "crypt-rarity crypt-rarity--legendary";
  return "crypt-rarity crypt-rarity--standard";
}
