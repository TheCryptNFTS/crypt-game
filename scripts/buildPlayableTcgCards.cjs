const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");
const UNITS_OUTPUT = path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json");
const EQUIPMENT_OUTPUT = path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json");
const ARTIFACTS_OUTPUT = path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json");

if (!fs.existsSync(INPUT_PATH)) {
  throw new Error(`Missing file: ${INPUT_PATH}`);
}

const raw = fs.readFileSync(INPUT_PATH, "utf8");
const cards = JSON.parse(raw);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapFaction(faction) {
  const f = String(faction || "").trim().toUpperCase();

  switch (f) {
    case "STONE_KEEPERS":
      return "STONE_KEEPERS";
    case "IRON_DEFENDERS":
      return "IRON_DEFENDERS";
    case "BRONZE_GUARDIANS":
      return "BRONZE_GUARDIANS";
    case "SILVER_SENTINELS":
      return "SILVER_SENTINELS";
    case "GOLDEN_SOVEREIGNS":
      return "GOLDEN_SOVEREIGNS";
    case "GODS":
      return "GODS";
    default:
      return "GODS";
  }
}

function rarityBudget(rarity) {
  switch (String(rarity || "").toLowerCase()) {
    case "common":
      return 9;
    case "uncommon":
      return 10;
    case "rare":
      return 12;
    case "epic":
      return 14;
    case "legendary":
      return 16;
    case "god":
      return 19;
    case "one_of_one":
      return 20;
    default:
      return 11;
  }
}

function costFromBudget(budget) {
  if (budget <= 9) return 2;
  if (budget <= 11) return 3;
  if (budget <= 13) return 4;
  if (budget <= 15) return 5;
  if (budget <= 17) return 6;
  return 7;
}

function normalizeKeywords(keywords) {
  const mapped = new Set();

  for (const keyword of Array.isArray(keywords) ? keywords : []) {
    const k = String(keyword || "").trim().toUpperCase();

    if (k === "CRUSH") mapped.add("CRUSH");
    if (k === "GUARD") mapped.add("GUARD");
    if (k === "RUSH") mapped.add("RUSH");
    if (k === "RANGED") mapped.add("RUSH");
    if (k === "QUICKSTEP") mapped.add("RUSH");
  }

  return Array.from(mapped);
}

// --- DISPLAY ENRICHMENT (deterministic) ------------------------------------
// The reducer compiles each unit's rules text (rawTraits.Ability) into real
// effect ops AND wires the card's full canonical keyword list at play time. The
// stripped `keywords` field above keeps only the 3 stat-shaping tokens the
// curated balance pass scores on (GUARD/RUSH/CRUSH), so the display layer used to
// look vanilla. These two helpers carry the SAME source-of-truth the engine reads
// — the human-readable ability text and the full keyword list — through to the
// display JSON so the deckbuilder/collection can show what a card actually does.
// Pure string/array reads from the card's own data; no randomness, no dates.
function abilityText(card) {
  const rt = card.rawTraits || card.traits || {};
  const ab = rt.Ability;
  return ab === undefined || ab === null ? "" : String(ab).trim();
}

function displayKeywords(card) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const k = String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };
  // The card's own normalized keyword array (engine source) first, then the
  // canonical single Keyword trait, so nothing the engine wires is dropped.
  for (const k of Array.isArray(card.keywords) ? card.keywords : []) push(k);
  const rt = card.rawTraits || card.traits || {};
  if (rt.Keyword) for (const part of String(rt.Keyword).split(/[,/]/)) push(part);
  return out;
}

function buildUnit(card) {
  const rarity = String(card.rarity || "unknown").toLowerCase();
  const faction = mapFaction(card.faction);
  const bias = card.statBias || {};
  const budget = Number(bias.budget || rarityBudget(rarity));

  let attack = Number(bias.attackBias || 0);
  let health = Number(bias.healthBias || 0);
  let armor = Number(bias.armorBias || 0);
  let speed = Number(bias.speedBias || 0);

  if (rarity === "common") {
    attack += 1;
    health += 3;
  } else if (rarity === "uncommon") {
    attack += 2;
    health += 3;
  } else if (rarity === "rare") {
    attack += 2;
    health += 4;
  } else if (rarity === "epic") {
    attack += 3;
    health += 5;
  } else if (rarity === "legendary") {
    attack += 4;
    health += 6;
  } else if (rarity === "god") {
    attack += 5;
    health += 8;
  } else if (rarity === "one_of_one") {
    attack += 5;
    health += 9;
  } else {
    attack += 2;
    health += 4;
  }

  return {
    id: `tcg_unit_${card.tokenId}`,
    name: card.name,
    type: "unit",
    faction,
    rarity,
    cost: clamp(costFromBudget(budget), 1, 8),
    stats: {
      attack: clamp(Math.round(attack), 1, 12),
      health: clamp(Math.round(health), 1, 20),
      speed: clamp(Math.max(1, Math.round(speed + 1)), 1, 6),
      armor: clamp(Math.round(armor), 0, 6)
    },
    keywords: normalizeKeywords(card.keywords),
    ability: abilityText(card),
    functionalKeywords: displayKeywords(card),
    sourceTokenId: card.tokenId,
    sourceCardClass: card.cardClass,
    sourceSubtype: card.subtype,
    rawTraits: card.rawTraits || {}
  };
}

function buildEquipment(card) {
  const rarity = String(card.rarity || "unknown").toLowerCase();
  const faction = mapFaction(card.faction);
  const bias = card.statBias || {};
  const budget = Number(bias.budget || rarityBudget(rarity));

  return {
    id: `tcg_eq_${card.tokenId}`,
    name: card.name,
    type: "equipment",
    faction,
    rarity,
    cost: clamp(costFromBudget(Math.max(6, budget - 1)), 1, 7),
    bonuses: {
      attack: clamp(Math.ceil(Number(bias.attackBias || 0) / 2), 0, 4),
      health: clamp(Math.ceil(Number(bias.healthBias || 0) / 2), 0, 5),
      armor: clamp(Math.max(1, Math.round(Number(bias.armorBias || 0))), 0, 4),
      speed: clamp(Math.round(Number(bias.speedBias || 0)), 0, 3)
    },
    keywords: normalizeKeywords(card.keywords),
    ability: abilityText(card),
    functionalKeywords: displayKeywords(card),
    sourceTokenId: card.tokenId,
    sourceCardClass: card.cardClass,
    sourceSubtype: card.subtype,
    rawTraits: card.rawTraits || {}
  };
}

function buildArtifact(card) {
  const rarity = String(card.rarity || "unknown").toLowerCase();
  const faction = mapFaction(card.faction);
  const budget = rarityBudget(rarity);

  return {
    id: `tcg_art_${card.tokenId}`,
    name: card.name,
    type: "artifact",
    faction,
    rarity,
    cost: clamp(costFromBudget(Math.max(8, budget)), 2, 8),
    effectTags: Array.from(new Set([...(card.keywords || []), "ARCANE"])),
    ability: abilityText(card),
    functionalKeywords: displayKeywords(card),
    sourceTokenId: card.tokenId,
    sourceCardClass: card.cardClass,
    sourceSubtype: card.subtype,
    rawTraits: card.rawTraits || {}
  };
}

// --- Source-by-token index for display enrichment --------------------------
// The canonical re-reveal carries each card's mechanical truth (Ability text +
// full Keyword list) in generatedTcgCards.json, keyed by `tokenId`. The shipped
// playable files key the same card by `sourceTokenId`. This index lets the
// enrichment pass below join the two without re-deriving any stat/cost/faction.
const sourceByToken = new Map();
for (const card of cards) {
  if (card.tokenId !== undefined && card.tokenId !== null) {
    sourceByToken.set(String(card.tokenId), card);
  }
}

// Pull ability text + full keyword list from the canonical source for an
// already-built playable card. Falls back to the card's own data when no source
// row is found, so the field is always present and deterministic.
function enrichDisplayFields(builtCard) {
  const src = sourceByToken.get(String(builtCard.sourceTokenId));
  const merged = src
    ? { ...builtCard, rawTraits: src.rawTraits || builtCard.rawTraits, keywords: src.keywords || builtCard.keywords }
    : builtCard;
  return {
    ...builtCard,
    ability: abilityText(merged),
    functionalKeywords: displayKeywords(merged),
  };
}

function readExisting(outputPath) {
  if (!fs.existsSync(outputPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Build a category. ENRICHMENT MODE (default): when the playable file already
// exists, preserve every shipped card verbatim (stats/cost/faction/keywords) and
// only ADD the display-facing ability + functionalKeywords joined by token. This
// keeps the deterministic shipped catalog stable while surfacing what each card
// does. FULL MODE (no existing file): generate from the canonical source.
function buildCategory(outputPath, sourceFilter, builder) {
  const existing = readExisting(outputPath);
  if (existing) {
    return existing.map((card) => enrichDisplayFields(card));
  }
  return cards.filter(sourceFilter).map((card) => enrichDisplayFields(builder(card)));
}

const units = buildCategory(
  UNITS_OUTPUT,
  (c) => c.cardClass !== "artifact" && c.cardClass !== "equipment",
  buildUnit
);
const equipment = buildCategory(EQUIPMENT_OUTPUT, (c) => c.cardClass === "equipment", buildEquipment);
const artifacts = buildCategory(ARTIFACTS_OUTPUT, (c) => c.cardClass === "artifact", buildArtifact);

fs.mkdirSync(path.dirname(UNITS_OUTPUT), { recursive: true });
fs.writeFileSync(UNITS_OUTPUT, JSON.stringify(units, null, 2), "utf8");
fs.writeFileSync(EQUIPMENT_OUTPUT, JSON.stringify(equipment, null, 2), "utf8");
fs.writeFileSync(ARTIFACTS_OUTPUT, JSON.stringify(artifacts, null, 2), "utf8");

console.log(`Units: ${units.length}`);
console.log(`Equipment: ${equipment.length}`);
console.log(`Artifacts: ${artifacts.length}`);
console.log(`Saved: ${UNITS_OUTPUT}`);
console.log(`Saved: ${EQUIPMENT_OUTPUT}`);
console.log(`Saved: ${ARTIFACTS_OUTPUT}`);
