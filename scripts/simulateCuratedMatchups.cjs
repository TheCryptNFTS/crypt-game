const fs = require("fs");
const path = require("path");

const core = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/curatedCoreSetV2.json"), "utf8"));

const factions = ["STONE", "IRON", "BRONZE", "SILVER", "GOLD"];

function rng(seed) {
  let x = seed || 123456789;
  return function() {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return Math.abs(x) / 2147483647;
  };
}

function scoreCard(card) {
  const stats = card.stats || card.bonuses || {};
  return (
    (stats.attack || 0) * 1.0 +
    (stats.health || 0) * 0.8 +
    (stats.armor || 0) * 1.0 +
    (stats.speed || 0) * 0.6 +
    ((card.keywords || card.effectTags || []).length * 1.3) -
    (card.cost * 0.5)
  );
}

function draftFactionDeck(faction) {
  const pool = core.all.filter((c) => c.faction === faction);
  return pool
    .slice()
    .sort((a, b) => scoreCard(b) - scoreCard(a))
    .slice(0, 30);
}

function simulate(deckA, deckB, seed) {
  const rand = rng(seed);
  let scoreA = 0;
  let scoreB = 0;

  for (let i = 0; i < 10; i++) {
    const a = deckA[Math.floor(rand() * deckA.length)];
    const b = deckB[Math.floor(rand() * deckB.length)];

    scoreA += scoreCard(a) + rand() * 2;
    scoreB += scoreCard(b) + rand() * 2;
  }

  return scoreA >= scoreB ? "A" : "B";
}

const report = {};

for (const a of factions) {
  report[a] = {};
  for (const b of factions) {
    if (a === b) continue;

    const deckA = draftFactionDeck(a);
    const deckB = draftFactionDeck(b);

    let winsA = 0;
    let winsB = 0;

    for (let i = 0; i < 200; i++) {
      const result = simulate(deckA, deckB, i + 1);
      if (result === "A") winsA++;
      else winsB++;
    }

    report[a][b] = {
      wins: winsA,
      losses: winsB,
      winRate: Number((winsA / 200).toFixed(3))
    };
  }
}

console.log("\n=== CURATED MATCHUP SIM REPORT ===");
console.log(JSON.stringify(report, null, 2));
