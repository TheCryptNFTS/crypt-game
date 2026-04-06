import fs from "fs";
import path from "path";

type MetadataAttribute = {
  trait_type?: string;
  value?: string | number | null;
};

type RawMetadata = {
  name?: string | null;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  external_url?: string | null;
  attributes?: MetadataAttribute[] | null;
  traits?: MetadataAttribute[] | null;
};

type NormalizedTcgCard = {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  externalUrl: string;
  faction: string;
  rarity: string;
  cardType: string;
  rawTraits: Record<string, string>;
};

const INPUT_DIR = path.resolve(process.cwd(), "tcg_metadata");
const OUTPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");

function normalizeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function getAttributes(metadata: RawMetadata): MetadataAttribute[] {
  if (Array.isArray(metadata.attributes)) return metadata.attributes;
  if (Array.isArray(metadata.traits)) return metadata.traits;
  return [];
}

function traitArrayToMap(attributes: MetadataAttribute[]): Record<string, string> {
  const traitMap: Record<string, string> = {};

  for (const attr of attributes) {
    const key = normalizeText(attr.trait_type);
    const value = normalizeText(attr.value);

    if (!key || !value) continue;
    traitMap[key] = value;
  }

  return traitMap;
}

function getTraitValue(
  traitMap: Record<string, string>,
  possibleKeys: string[],
  fallback = "unknown"
): string {
  for (const key of possibleKeys) {
    if (traitMap[key]) return traitMap[key];
  }
  return fallback;
}

function normalizeFaction(rawFaction: string): string {
  if (!rawFaction || rawFaction === "unknown") return "UNKNOWN";
  return rawFaction
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRarity(rawRarity: string): string {
  if (!rawRarity || rawRarity === "unknown") return "unknown";
  return rawRarity.trim().toLowerCase();
}

function normalizeCardType(rawType: string): string {
  if (!rawType || rawType === "unknown") return "unknown";
  return rawType.trim().toLowerCase();
}

function buildCard(tokenId: string, metadata: RawMetadata): NormalizedTcgCard {
  const attributes = getAttributes(metadata);
  const traitMap = traitArrayToMap(attributes);

  const faction = getTraitValue(traitMap, ["Faction", "faction"]);
  const rarity = getTraitValue(traitMap, ["Rarity", "rarity", "Tier", "tier"]);
  const cardType = getTraitValue(
    traitMap,
    ["Card Type", "Type", "type", "Category", "category"]
  );

  const name = normalizeText(metadata.name, `TCG Card #${tokenId}`);
  const description = normalizeText(metadata.description, "");
  const imageUrl = normalizeText(metadata.image_url || metadata.image, "");
  const externalUrl = normalizeText(metadata.external_url, "");

  return {
    id: `tcg_${tokenId}`,
    tokenId,
    name,
    description,
    imageUrl,
    externalUrl,
    faction: normalizeFaction(faction),
    rarity: normalizeRarity(rarity),
    cardType: normalizeCardType(cardType),
    rawTraits: traitMap
  };
}

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Missing input directory: ${INPUT_DIR}`);
  }

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => Number(a.replace(".json", "")) - Number(b.replace(".json", "")));

  if (files.length === 0) {
    throw new Error(`No JSON files found in: ${INPUT_DIR}`);
  }

  const cards: NormalizedTcgCard[] = [];

  for (const file of files) {
    const tokenId = file.replace(".json", "");
    const fullPath = path.join(INPUT_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw) as RawMetadata;
    const card = buildCard(tokenId, parsed);
    cards.push(card);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cards, null, 2), "utf8");

  console.log(`Imported ${cards.length} TCG cards`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main();
