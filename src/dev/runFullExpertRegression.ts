import { execSync } from "node:child_process";

const commands = [
  "npm run dev:exactproof",
  "npm run dev:equipment",
  "npm run dev:artifact",
  "npm run dev:combat",
  "npm run dev:armorproof",
  "npm run dev:nomatch",
  "npm run dev:oneofone",
  "npm run dev:legendary",
  "npm run dev:lore-audit",
  "npm run dev:aaa-audit",
];

let failed = false;

for (const command of commands) {
  try {
    console.log(`\n=== RUNNING: ${command} ===\n`);
    execSync(command, { stdio: "inherit" });
  } catch {
    failed = true;
    console.error(`\nFAILED: ${command}\n`);
  }
}

if (failed) process.exit(1);

console.log("\nFULL EXPERT REGRESSION PASSED\n");
