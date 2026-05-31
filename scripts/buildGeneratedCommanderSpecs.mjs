// Regenerates src/design/generatedCommanderSpecs.ts onto the canonical reveal schema.
//
// Canonical sync identity is KEYWORD ONLY (see task design decision):
//   - Keyword is the only selective identity trait (225 cards lack it), so it
//     preserves the exact-match vs no-match distinction the dev proofs rely on.
//
// Behavior:
//   - Preserve the exact roster of commander ids, tokenIds, and each entry's
//     deckRules from the CURRENT file (other code references these ids).
//   - Rewrite only `name` and `traits` per entry:
//       * tokenId IN snapshot  -> name = canonical name;
//                                 traits = { Keyword: <kw> } if present else {}
//       * tokenId NOT in snapshot (ghost) -> name UNCHANGED; traits = {}
//   - faction stays null for all.
//   - cmd_6600 is a ghost token but MUST remain (default/anchor commander).
//   - Deterministic output, original entry order preserved.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const specsPath = path.join(repoRoot, "src", "design", "generatedCommanderSpecs.ts");
const snapshotPath = path.join(repoRoot, "opensea_crypttradingcards_full.json");

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const tokenById = new Map(snapshot.nfts.map((n) => [String(n.identifier), n]));

function canonicalKeyword(nft) {
  const t = (nft.traits || []).find((tr) => tr.trait_type === "Keyword");
  return t ? t.value : undefined;
}

const source = fs.readFileSync(specsPath, "utf8");

// Parse each entry block. Entries look like:
//   "cmd_6600": {
//     id: "cmd_6600",
//     tokenId: "6600",
//     name: "Crypt #6600",
//     faction: null,
//     traits: {...},
//     deckRules: {...},
//   },
const entryRe =
  /^  "(cmd_[^"]+)": \{\n    id: "([^"]+)",\n    tokenId: ("[^"]*"|null),\n    name: ("(?:[^"\\]|\\.)*"),\n    faction: null,\n    traits: (\{[^\n]*\}),\n    deckRules: (\{[^\n]*\}),\n  \},/gm;

const entries = [];
let match;
while ((match = entryRe.exec(source)) !== null) {
  const [, key, id, tokenIdRaw, nameRaw, , deckRulesRaw] = match;
  entries.push({ key, id, tokenIdRaw, nameRaw, deckRulesRaw });
}

if (entries.length === 0) {
  throw new Error("Parsed 0 commander entries — entry regex did not match the file shape.");
}

const stats = { total: entries.length, withKeyword: 0, emptyInSnap: 0, ghost: 0 };

const lines = [];
for (const e of entries) {
  const tokenId = e.tokenIdRaw === "null" ? null : e.tokenIdRaw.slice(1, -1);
  let nameLiteral = e.nameRaw; // preserve original by default
  let traitsLiteral = "{}";

  const nft = tokenId != null ? tokenById.get(tokenId) : undefined;
  if (nft) {
    nameLiteral = JSON.stringify(nft.name ?? JSON.parse(e.nameRaw));
    const kw = canonicalKeyword(nft);
    if (kw !== undefined) {
      traitsLiteral = JSON.stringify({ Keyword: kw });
      stats.withKeyword++;
    } else {
      traitsLiteral = "{}";
      stats.emptyInSnap++;
    }
  } else {
    // ghost token: keep original name, vanilla (no-sync) commander
    stats.ghost++;
  }

  lines.push(`  "${e.key}": {`);
  lines.push(`    id: "${e.id}",`);
  lines.push(`    tokenId: ${e.tokenIdRaw},`);
  lines.push(`    name: ${nameLiteral},`);
  lines.push(`    faction: null,`);
  lines.push(`    traits: ${traitsLiteral},`);
  lines.push(`    deckRules: ${e.deckRulesRaw},`);
  lines.push(`  },`);
}

const header = `export type GeneratedCommanderSpec = {
  id: string;
  tokenId: string | null;
  name: string;
  faction: null;
  traits: Record<string, string>;
  deckRules: {
    deckSize: number;
    exactFaction: boolean;
    maxGodCards: number;
    minUnits: number;
    minEquipment: number;
    minArtifacts: number;
  };
};

export const GENERATED_COMMANDER_SPECS: Record<string, GeneratedCommanderSpec> = {
`;

const out = header + lines.join("\n") + "\n};\n";
fs.writeFileSync(specsPath, out);

// Sanity: cmd_6600 must remain.
if (!out.includes(`"cmd_6600": {`)) {
  throw new Error("cmd_6600 missing from output — aborting (it is the anchor commander).");
}

console.log(JSON.stringify(stats, null, 2));
console.log(`Wrote ${specsPath}`);
