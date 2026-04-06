const fs = require("fs");
const path = require("path");

const setPath = path.resolve(process.cwd(), "src/data/curatedCoreSetV2.json");
const data = JSON.parse(fs.readFileSync(setPath, "utf8"));

function unitScore(card) {
  const stats = card.stats || {};
  const attack = stats.attack || 0;
  const health = stats.health || 0;
  const armor = stats.armor || 0;
  const speed = stats.speed || 0;
  const keywordCount = (card.keywords || []).length;

  return attack + (health * 0.8) + (armor * 0.7) + (speed * 0.5) + (keywordCount * 1.2);
}

const issues = [];

for (const card of data.units || []) {
  const score = unitScore(card);
  const ratio = score / Math.max(card.cost || 1, 1);

  if (card.cost <= 2 && ratio > 6.5) {
    issues.push({
      id: card.id,
      faction: card.faction,
      cost: card.cost,
      score: Number(score.toFixed(2)),
      ratio: Number(ratio.toFixed(2))
    });
  }
}

console.log("\n=== CURATED ALPHA BALANCE GATE ===");
console.log(`Flagged: ${issues.length}`);
if (issues.length) {
  console.log(JSON.stringify(issues.slice(0, 50), null, 2));
  process.exit(1);
}
console.log("PASS");
