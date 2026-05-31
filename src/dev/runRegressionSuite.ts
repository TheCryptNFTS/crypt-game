import { execSync } from "node:child_process";

const commands = [
  "npm run dev:exactproof",
  "npm run dev:equipment",
  "npm run dev:artifact",
  "npm run dev:combat",
  "npm run dev:keywords",
  "npm run dev:combatkw",
  "npm run dev:statuskw",
  "npm run dev:effect-coverage",
  "npm run dev:effects",
  "npm run dev:triggers",
  "npm run dev:passives",
  "npm run dev:targeting",
  "npm run dev:faction-scaling",
  "npm run dev:auras",
  "npm run dev:turnstart",
  "npm run dev:turnend",
  "npm run dev:ondeath",
  "npm run dev:longtail",
  "npm run dev:battlecry-target",
  "npm run dev:spells",
  "npm run dev:spell-archetype",
  "npm run dev:choice",
  "npm run dev:discover-spells",
  "npm run dev:cleave-copy",
  "npm run dev:track-a1",
  "npm run dev:track-a2",
  "npm run dev:expressiveness",
  "npm run dev:graveyard",
  "npm run dev:adjacency",
  "npm run dev:copy-aura",
  "npm run dev:continuous-aura",
  "npm run dev:trigger-order",
  "npm run dev:card-override",
  "npm run dev:real-play-path",
  "npm run dev:marquee-summon",
  "npm run dev:marquee-combat",
  "npm run dev:marquee-aura",
  "npm run dev:marquee-redteam",
  "npm run dev:red-team-fix",
  "npm run dev:reducer-equivalence",
  "npm run dev:commander",
  "npm run dev:card-outlier-sweep",
];

let failed = false;

for (const command of commands) {
  try {
    console.log(`\n=== RUNNING: ${command} ===\n`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    failed = true;
    console.error(`\nFAILED: ${command}\n`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("\nALL REGRESSION PROOFS PASSED\n");
