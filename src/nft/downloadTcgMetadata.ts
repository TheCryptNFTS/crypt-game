import fs from "fs";
import path from "path";

const raw = JSON.parse(fs.readFileSync("opensea_crypttradingcards_full.json", "utf8"));

type Nft = {
  identifier: string;
  metadata_url?: string | null;
};

const nfts = raw.nfts as Nft[];
const outDir = path.resolve("tcg_metadata");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];

    if (!nft.metadata_url) {
      continue;
    }

    const response = await fetch(nft.metadata_url);

    if (!response.ok) {
      console.log(`Failed ${nft.identifier}: ${response.status}`);
      continue;
    }

    const data = await response.text();
    fs.writeFileSync(path.join(outDir, `${nft.identifier}.json`), data);

    console.log(`Saved ${i + 1}/${nfts.length}: ${nft.identifier}`);
  }

  console.log("Done downloading metadata");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
