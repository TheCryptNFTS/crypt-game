import openseaAssets from "./openseaAssets.json";
import cardMaster from "./cardMaster.json";

type OpenSeaAsset = {
  tokenId?: string;
  name?: string;
  imageUrl?: string | null;
  raw?: {
    image_url?: string | null;
    display_image_url?: string | null;
    animation_url?: string | null;
    display_animation_url?: string | null;
  };
};

type OpenSeaAssetsShape = {
  commanders?: OpenSeaAsset[];
  cards?: OpenSeaAsset[];
};

type CardMasterEntry = {
  id?: string;
  tokenId?: string;
  name?: string;
  imageUrl?: string;
  openseaUrl?: string;
};

const assets = openseaAssets as OpenSeaAssetsShape;
const master = cardMaster as CardMasterEntry[];

function normalizeName(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isRenderableImage(url: string | undefined | null) {
  if (!url) return false;
  return /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(url);
}

function pickImage(asset: OpenSeaAsset | CardMasterEntry | undefined | null) {
  if (!asset) return null;

  const candidates = [
    (asset as any).imageUrl,
    (asset as any).raw?.display_image_url,
    (asset as any).raw?.image_url,
  ];

  for (const candidate of candidates) {
    if (isRenderableImage(candidate)) return candidate;
  }

  return null;
}

const commanderByToken = new Map<string, string>();
const commanderByName = new Map<string, string>();
const cardByToken = new Map<string, string>();
const cardByName = new Map<string, string>();

for (const commander of assets.commanders ?? []) {
  const image = pickImage(commander);
  if (!image) continue;

  if (commander.tokenId) commanderByToken.set(String(commander.tokenId), image);
  if (commander.name) commanderByName.set(normalizeName(commander.name), image);
}

for (const card of assets.cards ?? []) {
  const image = pickImage(card);
  if (!image) continue;

  if (card.tokenId) cardByToken.set(String(card.tokenId), image);
  if (card.name) cardByName.set(normalizeName(card.name), image);
}

for (const entry of master) {
  const image = pickImage(entry);
  if (!image) continue;

  if (entry.tokenId && !commanderByToken.has(String(entry.tokenId))) {
    commanderByToken.set(String(entry.tokenId), image);
  }

  if (entry.name && !commanderByName.has(normalizeName(entry.name))) {
    commanderByName.set(normalizeName(entry.name), image);
  }
}

export function getCommanderImageUrl(input: {
  tokenId?: string | number | null;
  name?: string | null;
}) {
  const tokenId = input.tokenId != null ? String(input.tokenId) : "";
  const name = normalizeName(input.name);

  return (
    (tokenId ? commanderByToken.get(tokenId) : null) ||
    (name ? commanderByName.get(name) : null) ||
    null
  );
}

export function getCardImageUrl(input: {
  tokenId?: string | number | null;
  name?: string | null;
}) {
  const tokenId = input.tokenId != null ? String(input.tokenId) : "";
  const name = normalizeName(input.name);

  return (
    (tokenId ? cardByToken.get(tokenId) : null) ||
    (name ? cardByName.get(name) : null) ||
    null
  );
}

export function debugImageIndexCounts() {
  return {
    commandersByToken: commanderByToken.size,
    commandersByName: commanderByName.size,
    cardsByToken: cardByToken.size,
    cardsByName: cardByName.size,
  };
}
