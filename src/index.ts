import { loadAllCommanders, loadCommanderById } from "./data/loadCommanders";
import {
  getCommanderPassiveSummary,
  getCommanderStartOfGameBonus
} from "./engine/commanderAbilities";

function printSection(title: string, value: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

const allCommanders = loadAllCommanders();

printSection(
  "ALL LOADED COMMANDERS",
  allCommanders.map((commander) => ({
    id: commander.id,
    name: commander.name,
    class: commander.profile.cardClass,
    passive: commander.profile.passive,
    subtype: commander.profile.subtype,
    combatStyle: commander.profile.combatStyle,
    attack: commander.attack,
    health: commander.health,
    armor: commander.armor,
    rarityScore: commander.rarityScore,
    powerBand: commander.powerBand,
    tags: commander.tags
  }))
);

const stoneWarden = loadCommanderById("cmd_stone_warden");
const bronzeRaider = loadCommanderById("cmd_bronze_raider");
const hellJudge = loadCommanderById("cmd_hell_judge");
const skullEmperor = loadCommanderById("cmd_skull_emperor");
const lucifer = loadCommanderById("cmd_lucifer_one");
const satoshi = loadCommanderById("cmd_satoshi_one");

printSection("STONE WARDEN", stoneWarden);
printSection("BRONZE RAIDER", bronzeRaider);
printSection("HELL JUDGE", hellJudge);
printSection("SKULL EMPEROR", skullEmperor);
printSection("LUCIFER ONE OF ONE", lucifer);
printSection("SATOSHI ONE OF ONE", satoshi);

printSection("COMMANDER PASSIVE SUMMARIES", {
  stone_warden: getCommanderPassiveSummary("cmd_stone_warden"),
  bronze_raider: getCommanderPassiveSummary("cmd_bronze_raider"),
  hell_judge: getCommanderPassiveSummary("cmd_hell_judge"),
  skull_emperor: getCommanderPassiveSummary("cmd_skull_emperor"),
  lucifer_one: getCommanderPassiveSummary("cmd_lucifer_one"),
  satoshi_one: getCommanderPassiveSummary("cmd_satoshi_one")
});

printSection("COMMANDER START OF GAME BONUSES", {
  stone_warden: getCommanderStartOfGameBonus("cmd_stone_warden"),
  bronze_raider: getCommanderStartOfGameBonus("cmd_bronze_raider"),
  hell_judge: getCommanderStartOfGameBonus("cmd_hell_judge"),
  skull_emperor: getCommanderStartOfGameBonus("cmd_skull_emperor"),
  lucifer_one: getCommanderStartOfGameBonus("cmd_lucifer_one"),
  satoshi_one: getCommanderStartOfGameBonus("cmd_satoshi_one")
});

printSection(
  "TOP COMMANDERS BY RARITY SCORE",
  [...allCommanders]
    .sort((a, b) => b.rarityScore - a.rarityScore)
    .map((commander) => ({
      id: commander.id,
      name: commander.name,
      rarityScore: commander.rarityScore,
      powerBand: commander.powerBand
    }))
);