import fs from "fs";
import path from "path";

const API_KEY = process.env.OPENSEA_API_KEY || "";
const CHAIN = process.env.OPENSEA_CHAIN || "ethereum";

/**
 * Set these before running:
 * - COMMANDER_COLLECTION_SLUG  -> OpenSea slug for Crypt OG / OOGIE commander collection
 * - CARD_COLLECTION_SLUG       -> OpenSea slug for trading cards collection
 *
 * Example:
 *   export COMMANDER_COLLECTION_SLUG="your-crypt-og-slug"
 *   export CARD_COLLECTION_SLUG="crypttradingcards"
 */
const COMMANDER_COLLECTION_SLUG = process.env.COMMANDER_COLLECTION_SLUG || "";
const CARD_COLLECTION_SLUG = process.env.CARD_COLLECTION_SLUG || "";

if (!API_KEY) {
  throw new Error("Missing OPENSEA_API_KEY");
}
if (!COMMANDER_COLLECTION_SLUG) {
  throw new Error("Missing COMMANDER_COLLECTION_SLUG");
}
if (!CARD_COLLECTION_SLUG) {
  throw new Error("Missing CARD_COLLECTION_SLUG");
}

const headers = {
  "X-API-KEY": API_KEY,
  "Content-Type": "application/json",
};

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenSea request failed ${res.status}: ${url}\n${text}`);
  }
  return res.json();
}

async function fetchCollectionNfts(slug, limit = 200) {
  let next = null;
  const all = [];

  do {
    const url = new URL(`https://api.opensea.io/api/v2/collection/${slug}/nfts`);
    url.searchParams.set("limit", String(limit));
    if (next) url.searchParams.set("next", next);

    const data = await getJson(url.toString());
    const nfts = data.nfts || data.assets || [];
    all.push(...nfts);
    next = data.next || null;
  } while (next);

  return all;
}

function normalizeTraits(rawTraits) {
  if (!Array.isArray(rawTraits)) return [];
  return rawTraits.map((t) => ({
    trait_type: t.trait_type ?? t.type ?? "Unknown",
    value: t.value ?? t.display_value ?? "",
  }));
}

function normalizeNft(nft, role) {
  return {
    tokenId: String(nft.identifier ?? nft.token_id ?? nft.tokenId ?? ""),
    contract: String(
      nft.contract ?? nft.contract_address ?? nft.contractAddress ?? nft.contract?.address ?? ""
    ),
    name: nft.name ?? `#${nft.identifier ?? nft.token_id ?? nft.tokenId ?? ""}`,
    description: nft.description ?? "",
    imageUrl:
      nft.image_url ??
      nft.display_image_url ??
      nft.imageUrl ??
      nft.image_preview_url ??
      null,
    animationUrl: nft.animation_url ?? nft.animationUrl ?? null,
    externalUrl: nft.external_url ?? nft.externalUrl ?? nft.opensea_url ?? null,
    traits: normalizeTraits(nft.traits),
    role,
    raw: nft,
  };
}

async function main() {
  const commanderNfts = (await fetchCollectionNfts(COMMANDER_COLLECTION_SLUG)).map((n) =>
    normalizeNft(n, "commander")
  );
  const cardNfts = (await fetchCollectionNfts(CARD_COLLECTION_SLUG)).map((n) =>
    normalizeNft(n, "playable")
  );

  const out = {
    generatedAt: new Date().toISOString(),
    chain: CHAIN,
    commanderCollectionSlug: COMMANDER_COLLECTION_SLUG,
    cardCollectionSlug: CARD_COLLECTION_SLUG,
    commanders: commanderNfts,
    cards: cardNfts,
  };

  const outPath = path.resolve(process.cwd(), "src/data/openseaAssets.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`Saved ${out.commanders.length} commanders and ${out.cards.length} cards -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
