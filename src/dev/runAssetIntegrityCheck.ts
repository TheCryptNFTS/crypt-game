import fs from "fs";
import path from "path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function run() {
  const file = path.resolve(process.cwd(), "src/data/renderManifest.json");
  assert(fs.existsSync(file), "renderManifest.json missing");

  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

  assert(Array.isArray(manifest.commanders), "manifest.commanders missing");
  assert(Array.isArray(manifest.playable), "manifest.playable missing");

  const commanderCount = manifest.commanders.length;
  const playableCount = manifest.playable.length;
  const commanderImages = manifest.commanders.filter((x: any) => x.imageUrl).length;
  const playableImages = manifest.playable.filter((x: any) => x.imageUrl).length;

  assert(commanderCount > 0, "No commanders in manifest");
  assert(playableCount > 0, "No playable cards in manifest");
  assert(commanderImages === commanderCount, `Commander images incomplete: ${commanderImages}/${commanderCount}`);
  assert(playableImages > 0, "No playable images mapped");

  console.log("\n=== ASSET INTEGRITY CHECK ===");
  console.log(`Commanders: ${commanderCount}`);
  console.log(`Commander images: ${commanderImages}/${commanderCount}`);
  console.log(`Playable: ${playableCount}`);
  console.log(`Playable images: ${playableImages}/${playableCount}`);
  console.log("PASS");
}

run();
