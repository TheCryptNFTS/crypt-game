import fs from "fs";
import path from "path";

const SOURCE = "src/data/cardMaster.json";

type AnyCard = Record<string, any>;

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function normalizeFaction(value: unknown): string {
  if (!value) return "UNKNOWN";
  const raw = String(value).trim();

  const map: Record<string, string> = {
    Stonekeepers: "STONE",
    "Iron Defenders": "IRON",
    "Bronze Guardians": "BRONZE",
    "Silver Sentinals": "SILVER",
    "Golden Sovergins": "GOLD",
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

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function extractTraits(card: AnyCard): string[] {
  const out: string[] = [];

  if (Array.isArray(card.traits)) {
    for (const trait of card.traits) {
      if (typeof trait === "string") {
        out.push(trait.trim());
      } else if (trait && typeof trait === "object") {
        const name =
          trait.name ??
          trait.trait_type ??
          trait.traitType ??
          trait.type;

        const value =
          trait.value ??
          trait.trait_value ??
          trait.traitValue;

        if (name && value) {
          out.push(`${String(name).trim()}:${String(value).trim()}`);
        }
      }
    }
  }

  if (Array.isArray(card.attributes)) {
    for (const attr of card.attributes) {
      if (!attr || typeof attr !== "object") continue;

      const name =
        attr.name ??
        attr.trait_type ??
        attr.traitType ??
        attr.type;

      const value =
        attr.value ??
        attr.trait_value ??
        attr.traitValue;

      if (name && value) {
        out.push(`${String(name).trim()}:${String(value).trim()}`);
      }
    }
  }

  return out;
}

const raw = readJson(SOURCE);
const cards: AnyCard[] = Array.isArray(raw) ? raw : raw.cards ?? [];

const uniqueIds = new Set<string>();
const factionCounts = new Map<string, number>();
const traitCounts = new Map<string, number>();

for (const card of cards) {
  const id = String(card.id ?? card.cardId ?? "").trim();
  if (!id) continue;
  uniqueIds.add(id);

  const faction = normalizeFaction(
    card.faction ?? card.Faction ?? card.factionName ?? card.group
  );
  bump(factionCounts, faction);

  for (const trait of extractTraits(card)) {
    bump(traitCounts, trait);
  }
}

const factionSorted = [...factionCounts.entries()].sort((a, b) => b[1] - a[1]);
const traitSorted = [...traitCounts.entries()].sort((a, b) => b[1] - a[1]);

console.log("TOTAL UNIQUE CARDS:", uniqueIds.size);
console.log("\nFACTION COUNTS:");
console.table(Object.fromEntries(factionSorted));

console.log("\nTOP 100 TRAITS:");
console.table(Object.fromEntries(traitSorted.slice(0, 100)));

fs.writeFileSync(
  "card_audit.json",
  JSON.stringify(
    {
      totalUniqueCards: uniqueIds.size,
      factionCounts: Object.fromEntries(factionSorted),
      topTraits: Object.fromEntries(traitSorted.slice(0, 500)),
    },
    null,
    2
  )
);

console.log("\nWrote card_audit.json");
