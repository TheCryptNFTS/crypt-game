import fs from "fs";
import path from "path";

const SOURCE = "src/data/cardMaster.json"; // change if this is your NFT metadata source

type AnyItem = Record<string, any>;

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function normalizeCategory(value: string): string {
  const raw = value.trim();
  const map: Record<string, string> = {
    Background: "Background",
    Backgrounds: "Background",
    Eye: "Eyes",
    Eyes: "Eyes",
    Headwear: "Headwear",
    Headwears: "Headwear",
    Skin: "Skin",
    Skins: "Skin",
    Weapon: "Weapons",
    Weapons: "Weapons",
    Artifact: "Artifacts",
    Artifacts: "Artifacts",
    Creature: "Creature",
    Armor: "Armor",
    Mouth: "Mouth",
    Character: "Character",
    Faction: "Faction",
    Metaverse: "Metaverse",
  };
  return map[raw] ?? raw;
}

const raw = readJson(SOURCE);
const items: AnyItem[] = Array.isArray(raw) ? raw : raw.cards ?? raw.items ?? [];

const uniqueIds = new Set<string>();
const traitCounts = new Map<string, number>();

for (const item of items) {
  const id = String(item.id ?? item.tokenId ?? item.cardId ?? "").trim();
  if (id) uniqueIds.add(id);

  const attrs = Array.isArray(item.attributes) ? item.attributes : [];
  for (const attr of attrs) {
    const cat = attr?.trait_type ?? attr?.traitType ?? attr?.type ?? attr?.name;
    const val = attr?.value ?? attr?.trait_value ?? attr?.traitValue;
    if (!cat || !val) continue;
    bump(traitCounts, `${normalizeCategory(String(cat))}:${String(val).trim()}`);
  }

  if (Array.isArray(item.traits)) {
    for (const t of item.traits) {
      if (t && typeof t === "object") {
        const cat = t.name ?? t.trait_type ?? t.type;
        const val = t.value ?? t.trait_value;
        if (cat && val) {
          bump(traitCounts, `${normalizeCategory(String(cat))}:${String(val).trim()}`);
        }
      }
    }
  }
}

console.log("TOTAL UNIQUE NFT ITEMS:", uniqueIds.size);
console.log("\nTOP NFT TRAITS:");
console.table(Object.fromEntries([...traitCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)));
