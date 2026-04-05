import fs from "fs";
import path from "path";
import os from "os";
import { mapNftToCard, RawNft } from "./nftCardMapper";

const candidateInputPaths = [
  path.resolve(process.cwd(), "crypt_og_raw.json"),
  path.resolve(os.homedir(), "crypt_og_raw.json")
];

const outputPath = path.resolve(process.cwd(), "src/data/generatedNftCards.json");

function findInputPath(): string {
  for (const candidate of candidateInputPaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Missing input file. Checked:\n${candidateInputPaths.join("\n")}`
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTraits(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  const result: Record<string, string> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") {
      result[key] = raw;
    } else if (raw != null) {
      result[key] = String(raw);
    }
  }

  return result;
}

function normalizeRawNft(value: unknown, index: number): RawNft {
  if (!isRecord(value)) {
    throw new Error(`Invalid NFT at index ${index}: expected object`);
  }

  const idValue = value.id;
  if (idValue === undefined || idValue === null) {
    throw new Error(`Invalid NFT at index ${index}: missing id`);
  }

  return {
    id: String(idValue),
    name: typeof value.name === "string" ? value.name : undefined,
    traits: normalizeTraits(value.traits)
  };
}

function main() {
  const inputPath = findInputPath();
  const rawText = fs.readFileSync(inputPath, "utf8");
  const parsedJson: unknown = JSON.parse(rawText);

  if (!Array.isArray(parsedJson)) {
    throw new Error("Input JSON must be an array");
  }

  const parsed: RawNft[] = parsedJson.map((item, index) =>
    normalizeRawNft(item, index)
  );

  const generatedCards = parsed.map((nft) => mapNftToCard(nft));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(generatedCards, null, 2), "utf8");

  console.log(`Imported ${generatedCards.length} NFT cards`);
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
}

main();