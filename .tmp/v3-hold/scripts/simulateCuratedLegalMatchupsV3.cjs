const fs = require("fs");
const path = require("path");

const decks = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/curatedLegalDecksV3.json"), "utf8")
);
const core = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/curatedCoreSetV3.json"), "utf8")
);

const lookup = {};
for (const card of core.all) lookup[card.id] = card;

function scoreCard(id) {
  const card = lookup[id];
  if (!card) return 0;
  if (card.type === "unit") {
    const s = card.stats || {};
    return (s.attack || 0) + (s.health || 0) * 0.8 + (s.armor || 0) * 1.2 + (s.speed || 0) * 0.6 + ((card.keywords || []).length * 0.9);
  }
  if (card.type === "equipment") {
    const s = card.bonuses || {};
    return (s.attack || 0) + (s.health || 0) * 0.7 + (s.armor || 0) + (s.speed || 0) * 0.5 + ((card.keywords || []).length * 0.6);
  }
  return ((card.effectTags || []).length * 2.2) + card.cost;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, seed) {
  const rng = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function simulate(deckA, deckB, seed) {
  const a = shuffle(deckA, seed).slice(0, 12);
  const b = shuffle(deckB, seed + 999).slice(0, 12);

  let scoreA = 0;
  let scoreB = 0;

  for (let i = 0; i < a.length; i++) scoreA += scoreCard(a[i]);
  for (let i = 0; i < b.length; i++) scoreB += scoreCard(b[i]);

  return scoreA >= scoreB ? "A" : "B";
}

const ids = Object.keys(decks);
const report = {};

for (const a of ids) {
  report[a] = {};
  for (const b of ids) {
    if (a === b) continue;
    let wins = 0;
    let losses = 0;

    for (let i = 0; i < 200; i++) {
      const result = simulate(decks[a].cards, decks[b].cards, i + 1);
      if (result === "A") wins++;
      else losses++;
    }

    report[a][b] = {
      wins,
      losses,
      winRate: Number((wins / 200).toFixed(3))
    };
  }
}

console.log("\n=== CURATED LEGAL MATCHUP SIM V3 ===");
console.log(JSON.stringify(report, null, 2));
