import fs from "fs";
import path from "path";

const SOURCE = "src/data/curatedCoreSet.json";

type AnyCard = Record<string, any>;

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function normalizeFaction(value: unknown): string {
  if (!value) return "UNKNOWN";
  const raw = String(value).trim();

  const map: Record<string, string> = {
    Stonekeepers: "STONE",
    "Stone Keepers": "STONE",
    "Iron Defenders": "IRON",
    "Bronze Guardians": "BRONZE",
    "Silver Sentinals": "SILVER",
    "Silver Sentinels": "SILVER",
    "Golden Sovergins": "GOLD",
    "Golden Sovereigns": "GOLD",
    Gods: "GOD",
    STONE: "STONE",
    IRON: "IRON",
    BRONZE: "BRONZE",
    SILVER: "SILVER",
    GOLD: "GOLD",
    GOD: "GOD",
  };

  return map[raw] ?? raw.toUpperCase();
}

function extractKeywords(card: AnyCard): string[] {
  const out: string[] = [];

  for (const key of ["keywords", "keyword", "abilities", "tags"]) {
    const value = card[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") out.push(item.trim());
      }
    }
  }

  return out;
}

const raw = readJson(SOURCE);
const cards: AnyCard[] = Array.isArray(raw) ? raw : raw.all ?? [];

const uniqueIds = new Set<string>();
const factionCounts = new Map<string, number>();
const typeCounts = new Map<string, number>();
const keywordCounts = new Map<string, number>();

for (const card of cards) {
  const id = String(card.id ?? card.cardId ?? "").trim();
  if (!id || uniqueIds.has(id)) continue;

  uniqueIds.add(id);

  const faction = normalizeFaction(
    card.faction ?? card.Faction ?? card.factionName ?? card.group
  );
  bump(factionCounts, faction);

  const type = String(card.type ?? card.cardType ?? "UNKNOWN").trim();
  bump(typeCounts, type);

  for (const keyword of extractKeywords(card)) {
    bump(keywordCounts, keyword);
  }
}

console.log("TOTAL UNIQUE TCG CARDS:", uniqueIds.size);

console.log("\nFACTIONS:");
console.table(
  Object.fromEntries([...factionCounts.entries()].sort((a, b) => b[1] - a[1]))
);

console.log("\nCARD TYPES:");
console.table(
  Object.fromEntries([...typeCounts.entries()].sort((a, b) => b[1] - a[1]))
);

console.log("\nTOP KEYWORDS:");
console.table(
  Object.fromEntries(
    [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)
  )
);
