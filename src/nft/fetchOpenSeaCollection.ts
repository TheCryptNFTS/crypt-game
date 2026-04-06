import fs from "fs";

const API_KEY = process.env.OPENSEA_API_KEY;
const COLLECTION_SLUG = "crypttradingcards";
const OUTPUT_PATH = "opensea_crypttradingcards_full.json";

if (!API_KEY) {
  throw new Error("Missing OPENSEA_API_KEY in environment");
}

type OpenSeaTrait = {
  trait_type: string;
  value: string | number | null;
};

type OpenSeaNft = {
  identifier: string;
  name: string | null;
  description: string | null;
  image_url: string | null;
  metadata_url: string | null;
  opensea_url: string | null;
  traits?: OpenSeaTrait[];
};

type OpenSeaResponse = {
  nfts: OpenSeaNft[];
  next?: string;
};

async function fetchPage(next?: string): Promise<OpenSeaResponse> {
  const url = new URL(`https://api.opensea.io/api/v2/collection/${COLLECTION_SLUG}/nfts`);

  if (next) {
    url.searchParams.set("next", next);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-KEY": API_KEY
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenSea request failed: ${response.status} ${response.statusText}\n${text}`);
  }

  return (await response.json()) as OpenSeaResponse;
}

async function main() {
  const allNfts: OpenSeaNft[] = [];
  let next: string | undefined = undefined;
  let page = 1;

  while (true) {
    console.log(`Fetching page ${page}...`);

    const data = await fetchPage(next);

    if (Array.isArray(data.nfts)) {
      allNfts.push(...data.nfts);
      console.log(`Page ${page}: got ${data.nfts.length} NFTs`);
      console.log(`Running total: ${allNfts.length}`);
    }

    if (!data.next) {
      break;
    }

    next = data.next;
    page += 1;
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        collection: COLLECTION_SLUG,
        total: allNfts.length,
        nfts: allNfts
      },
      null,
      2
    )
  );

  console.log(`Done. Saved ${allNfts.length} NFTs to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
