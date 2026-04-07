export type CommanderTraitBoost = {
  category: "Backgrounds" | "Eyes" | "Headwears" | "Mouth" | "Skins";
  value: string;
  bonus: {
    attack?: number;
    health?: number;
    armor?: number;
    crit?: number;
    speed?: number;
    utility?: number;
  };
  extraTags?: string[];
  extraPassives?: string[];
};

export const COMMANDER_TRAIT_BOOSTS: CommanderTraitBoost[] = [
  // =========================
  // COMMANDER BACKGROUNDS
  // =========================
  {
    category: "Backgrounds",
    value: "Black",
    bonus: { utility: 1 },
    extraTags: ["void", "neutral", "focus"],
    extraPassives: ["Neutral darkness slightly sharpens focus and intimidation"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Onyx",
    bonus: { utility: 2 },
    extraTags: ["smoke", "onyx", "concealment"],
    extraPassives: ["Improves concealment and dark-field control"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Silver",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["smoke", "silver", "precision"],
    extraPassives: ["Adds refined precision through silver haze"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Ruby",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["smoke", "ruby", "pressure"],
    extraPassives: ["Adds aggressive pressure through ruby haze"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Topaz",
    bonus: { utility: 2 },
    extraTags: ["smoke", "topaz", "resonance"],
    extraPassives: ["Improves aura pressure and gem-like field resonance"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Fire Opel",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["smoke", "fire", "burn"],
    extraPassives: ["Adds fiery haze and pressure-based field presence"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Lavendar Quartz",
    bonus: { utility: 2 },
    extraTags: ["smoke", "quartz", "mystic"],
    extraPassives: ["Adds mystic focus and softened control through quartz haze"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Canary Diamond",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["smoke", "diamond", "luxury"],
    extraPassives: ["Adds premium clarity and sharp value-oriented pressure"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Emerald",
    bonus: { health: 1, utility: 1 },
    extraTags: ["smoke", "emerald", "growth"],
    extraPassives: ["Adds resilient growth-like aura and stabilising presence"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Gold",
    bonus: { health: 1, utility: 2 },
    extraTags: ["smoke", "gold", "authority"],
    extraPassives: ["Adds regal field control and high-status presence"]
  },
  {
    category: "Backgrounds",
    value: "Smokey Yellow",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["smoke", "yellow", "energy"],
    extraPassives: ["Adds charged tempo and bright-field pressure"]
  },
  // =========================
  // COMMANDER EYES
  // =========================
  {
    category: "Eyes",
    value: "Sharp",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "I See Dead People",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Lightning",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "energy", "shock", "burst"],
    extraPassives: ["Improves shock-based tempo and fast battlefield reads"]
  },
  {
    category: "Eyes",
    value: "Ancient History",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "time", "foresight", "distortion"],
    extraPassives: ["Improves foresight, timing windows, and turn-shaping control"]
  },
  {
    category: "Eyes",
    value: "Imprisoned",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "stealth", "obscure", "control"],
    extraPassives: ["Improves concealment reads and disruption through obscurity"]
  },
  {
    category: "Eyes",
    value: "Naked",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "plain", "baseline"],
    extraPassives: ["Minimal eye bonus; baseline awareness only"]
  },
  {
    category: "Eyes",
    value: "Till Death Do Us Part",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Around The World",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Grieving Widow",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Hugin And Munin",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Life Through A Broken Lense",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "The Creeper",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Piercing",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Leave Me Alone",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "stealth", "obscure", "control"],
    extraPassives: ["Improves concealment reads and disruption through obscurity"]
  },
  {
    category: "Eyes",
    value: "Life Is Hell",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Escaping Darkness",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Unseen Death",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Moonshot",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "The Fly",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Times up",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "time", "foresight", "distortion"],
    extraPassives: ["Improves foresight, timing windows, and turn-shaping control"]
  },
  {
    category: "Eyes",
    value: "The High Life",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Trapped",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "stealth", "obscure", "control"],
    extraPassives: ["Improves concealment reads and disruption through obscurity"]
  },
  {
    category: "Eyes",
    value: "Lost Childhood",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Explorer",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "precision", "foresight", "awareness"],
    extraPassives: ["Improves precision, awareness, and information advantage"]
  },
  {
    category: "Eyes",
    value: "I Made A Mistake",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "chaos", "weird", "distortion"],
    extraPassives: ["Improves chaotic vision effects and unstable battlefield reads"]
  },
  {
    category: "Eyes",
    value: "Facing Death",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Soldiers Pain",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Unimaginable",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Popeye",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Crypt Coin",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "None",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "plain", "baseline"],
    extraPassives: ["Minimal eye bonus; baseline awareness only"]
  },
  {
    category: "Eyes",
    value: "Neon",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Double Snake",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Fantasy Glow",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Smokey",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "stealth", "obscure", "control"],
    extraPassives: ["Improves concealment reads and disruption through obscurity"]
  },
  {
    category: "Eyes",
    value: "Spider",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Vinyl",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Robotic",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "tech", "scan", "precision"],
    extraPassives: ["Improves targeting precision and systems-level battlefield analysis"]
  },
  {
    category: "Eyes",
    value: "Snake",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Self Reflection",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Neon Skull And Cross",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "In Lucifer We Trust",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Love Eyes",
    bonus: { utility: 2 },
    extraTags: ["commander-eye", "charm", "emotion", "control"],
    extraPassives: ["Improves charm pressure and emotional disruption"]
  },
  {
    category: "Eyes",
    value: "Half Moon",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Silver",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Dystopia",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Cats Eyes",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Kheper",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Honey",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Canary Diamond",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Heavens Gateway",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-eye", "holy", "protection", "judgment"],
    extraPassives: ["Improves holy reads, judgment pressure, and protective insight"]
  },
  {
    category: "Eyes",
    value: "Machine Gun Eye",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Ruby",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Specs",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Temporal Rift",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "energy", "shock", "burst"],
    extraPassives: ["Improves shock-based tempo and fast battlefield reads"]
  },
  {
    category: "Eyes",
    value: "Eye Patch",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Gold",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Pink Sapphire",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Endless Void",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Hells Gateway",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Lizards Eye",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "beast", "poison", "predator"],
    extraPassives: ["Improves hunt pressure, poison reads, and predatory timing"]
  },
  {
    category: "Eyes",
    value: "Oh Beehave",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Soul Cry",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Devilish Sight",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Mad Scientist",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "chaos", "weird", "distortion"],
    extraPassives: ["Improves chaotic vision effects and unstable battlefield reads"]
  },
  {
    category: "Eyes",
    value: "Magic Mushroom",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "chaos", "weird", "distortion"],
    extraPassives: ["Improves chaotic vision effects and unstable battlefield reads"]
  },
  {
    category: "Eyes",
    value: "Shady",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-eye", "stealth", "obscure", "control"],
    extraPassives: ["Improves concealment reads and disruption through obscurity"]
  },
  {
    category: "Eyes",
    value: "Time Reversed",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "time", "foresight", "distortion"],
    extraPassives: ["Improves foresight, timing windows, and turn-shaping control"]
  },
  {
    category: "Eyes",
    value: "Topaz",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Contagion",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Deadeye",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Emerald",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Lavendar Quartz",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Skulls",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Time Warp",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "time", "foresight", "distortion"],
    extraPassives: ["Improves foresight, timing windows, and turn-shaping control"]
  },
  {
    category: "Eyes",
    value: "Brown Jasper",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "wealth", "focus", "value"],
    extraPassives: ["Improves premium precision and value-oriented focus"]
  },
  {
    category: "Eyes",
    value: "Side Skulls",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Eyes",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "plain", "baseline"],
    extraPassives: ["Minimal eye bonus; baseline awareness only"]
  },
  {
    category: "Eyes",
    value: "Revolver",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Death Stare",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "dark", "death", "curse"],
    extraPassives: ["Improves death-pressure, curse reads, and fatal precision"]
  },
  {
    category: "Eyes",
    value: "Dragons",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "mythic", "beast", "sight"],
    extraPassives: ["Improves mythic scouting, aerial reads, and precision"]
  },
  {
    category: "Eyes",
    value: "Faiths Guardian",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-eye", "holy", "protection", "judgment"],
    extraPassives: ["Improves holy reads, judgment pressure, and protective insight"]
  },
  {
    category: "Eyes",
    value: "One Eye",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Eye See All",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "precision", "foresight", "awareness"],
    extraPassives: ["Improves precision, awareness, and information advantage"]
  },
  {
    category: "Eyes",
    value: "Four Twenty",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Light Up My Life",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "The Dons M-Frames",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Weed",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "chaos", "weird", "distortion"],
    extraPassives: ["Improves chaotic vision effects and unstable battlefield reads"]
  },
  {
    category: "Eyes",
    value: "Wow",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "chaos", "weird", "distortion"],
    extraPassives: ["Improves chaotic vision effects and unstable battlefield reads"]
  },
  {
    category: "Eyes",
    value: "See No Evil",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "precision", "foresight", "awareness"],
    extraPassives: ["Improves precision, awareness, and information advantage"]
  },
  {
    category: "Eyes",
    value: "Looking Into The Future",
    bonus: { utility: 3 },
    extraTags: ["commander-eye", "time", "foresight", "distortion"],
    extraPassives: ["Improves foresight, timing windows, and turn-shaping control"]
  },
  {
    category: "Eyes",
    value: "Jarvis",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "tech", "scan", "precision"],
    extraPassives: ["Improves targeting precision and systems-level battlefield analysis"]
  },
  {
    category: "Eyes",
    value: "Knife Eye",
    bonus: { utility: 1 },
    extraTags: ["commander-eye", "vision"],
    extraPassives: ["Improves commander sight-based synergy"]
  },
  {
    category: "Eyes",
    value: "Flame Eyes",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-eye", "fire", "burn", "pressure"],
    extraPassives: ["Improves aggressive fire-pressure and threat projection"]
  },
  {
    category: "Eyes",
    value: "VR",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-eye", "tech", "scan", "precision"],
    extraPassives: ["Improves targeting precision and systems-level battlefield analysis"]
  },
  {
    category: "Eyes",
    value: "Blazin",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-eye", "fire", "burn", "pressure"],
    extraPassives: ["Improves aggressive fire-pressure and threat projection"]
  },
  // =========================
  // COMMANDER MOUTH
  // =========================
  {
    category: "Mouth",
    value: "None",
    bonus: { utility: 1 },
    extraTags: ["commander-mouth", "plain", "baseline"],
    extraPassives: ["Minimal mouth bonus; baseline intimidation only"]
  },
  {
    category: "Mouth",
    value: "Robotic",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "tech", "alien", "hybrid"],
    extraPassives: ["Improves synthetic intimidation and tech-pressure identity"]
  },
  {
    category: "Mouth",
    value: "Wax Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Crypt Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Sting",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "drain", "predator"],
    extraPassives: ["Improves lifesteal-style pressure and predatory finish patterns"]
  },
  {
    category: "Mouth",
    value: "666 Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Flash Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Razor Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Smoke Bomb",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "Skull Eats Skull",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "death", "dark", "fear"],
    extraPassives: ["Improves grim intimidation and death-pressure synergy"]
  },
  {
    category: "Mouth",
    value: "Lightsaber",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Warfare Mask",
    bonus: { armor: 1, utility: 1 },
    extraTags: ["commander-mouth", "mask", "defense", "concealment"],
    extraPassives: ["Improves concealment, survival, and battle-read disruption"]
  },
  {
    category: "Mouth",
    value: "Fangs",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "drain", "predator"],
    extraPassives: ["Improves lifesteal-style pressure and predatory finish patterns"]
  },
  {
    category: "Mouth",
    value: "Dead Protectors Mask",
    bonus: { armor: 1, utility: 1 },
    extraTags: ["commander-mouth", "mask", "defense", "concealment"],
    extraPassives: ["Improves concealment, survival, and battle-read disruption"]
  },
  {
    category: "Mouth",
    value: "Racers Mask",
    bonus: { armor: 1, utility: 1 },
    extraTags: ["commander-mouth", "mask", "defense", "concealment"],
    extraPassives: ["Improves concealment, survival, and battle-read disruption"]
  },
  {
    category: "Mouth",
    value: "Bullet",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Alien Attack",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "tech", "alien", "hybrid"],
    extraPassives: ["Improves synthetic intimidation and tech-pressure identity"]
  },
  {
    category: "Mouth",
    value: "Single Tooth",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Skull Teeth",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Rainbow Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Gold Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Normal Teeth",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Saurons Mace",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Joint",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "Loki Sceptor",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "tech", "alien", "hybrid"],
    extraPassives: ["Improves synthetic intimidation and tech-pressure identity"]
  },
  {
    category: "Mouth",
    value: "Dead Money",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "death", "dark", "fear"],
    extraPassives: ["Improves grim intimidation and death-pressure synergy"]
  },
  {
    category: "Mouth",
    value: "Double Joint",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "Under Pressure",
    bonus: { utility: 1 },
    extraTags: ["commander-mouth", "expression"],
    extraPassives: ["Improves commander mouth-based synergy"]
  },
  {
    category: "Mouth",
    value: "Mace Skull",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "The Fixer",
    bonus: { utility: 1 },
    extraTags: ["commander-mouth", "expression"],
    extraPassives: ["Improves commander mouth-based synergy"]
  },
  {
    category: "Mouth",
    value: "Tongue Out",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "style", "expression", "weird"],
    extraPassives: ["Improves expressive or weird-pressure utility"]
  },
  {
    category: "Mouth",
    value: "Diamond Grill",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Crypt Mjolnir",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "tech", "alien", "hybrid"],
    extraPassives: ["Improves synthetic intimidation and tech-pressure identity"]
  },
  {
    category: "Mouth",
    value: "Four Twenty",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "Missing Tooth",
    bonus: { crit: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "flash", "intimidation"],
    extraPassives: ["Improves intimidation, bite pressure, and flashy threat projection"]
  },
  {
    category: "Mouth",
    value: "Elven Dagger",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Yaka Arrow",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Stitched Up",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-mouth", "damaged", "grim", "survival"],
    extraPassives: ["Improves damaged-survivor pressure and scarred resilience"]
  },
  {
    category: "Mouth",
    value: "Katana",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Nailed It",
    bonus: { utility: 1 },
    extraTags: ["commander-mouth", "expression"],
    extraPassives: ["Improves commander mouth-based synergy"]
  },
  {
    category: "Mouth",
    value: "Broken Sword",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Dagger",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Sword Of Heaven",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Minoru Sceptor",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "tech", "alien", "hybrid"],
    extraPassives: ["Improves synthetic intimidation and tech-pressure identity"]
  },
  {
    category: "Mouth",
    value: "Red Rose",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "style", "expression", "weird"],
    extraPassives: ["Improves expressive or weird-pressure utility"]
  },
  {
    category: "Mouth",
    value: "Red Arrow",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Stormbreaker",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Smoked Out",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "The Creep",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "death", "dark", "fear"],
    extraPassives: ["Improves grim intimidation and death-pressure synergy"]
  },
  {
    category: "Mouth",
    value: "Cigar",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "Grenade",
    bonus: { attack: 1, crit: 1 },
    extraTags: ["commander-mouth", "weaponized", "danger", "burst"],
    extraPassives: ["Improves weapon-mouth threat pressure and burst finishing"]
  },
  {
    category: "Mouth",
    value: "Radiation Mask",
    bonus: { armor: 1, utility: 1 },
    extraTags: ["commander-mouth", "mask", "defense", "concealment"],
    extraPassives: ["Improves concealment, survival, and battle-read disruption"]
  },
  {
    category: "Mouth",
    value: "Death Blow",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "death", "dark", "fear"],
    extraPassives: ["Improves grim intimidation and death-pressure synergy"]
  },
  {
    category: "Mouth",
    value: "Pipe",
    bonus: { utility: 2 },
    extraTags: ["commander-mouth", "smoke", "chaos", "haze"],
    extraPassives: ["Improves haze pressure, misdirection, and slow disruption"]
  },
  {
    category: "Mouth",
    value: "Gone Nuclear",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "death", "dark", "fear"],
    extraPassives: ["Improves grim intimidation and death-pressure synergy"]
  },
  {
    category: "Mouth",
    value: "Hands Of Death",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "death", "dark", "fear"],
    extraPassives: ["Improves grim intimidation and death-pressure synergy"]
  },
  {
    category: "Mouth",
    value: "The Hobbit Sting Sword",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-mouth", "bite", "drain", "predator"],
    extraPassives: ["Improves lifesteal-style pressure and predatory finish patterns"]
  },
  // =========================
  // COMMANDER HEADWEARS
  // =========================
  {
    category: "Headwears",
    value: "None",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "plain", "baseline"],
    extraPassives: ["Minimal headwear bonus; baseline presence only"]
  },
  {
    category: "Headwears",
    value: "Hooded One",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Snapback",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "style", "identity", "tempo"],
    extraPassives: ["Improves style-based confidence and expression pressure"]
  },
  {
    category: "Headwears",
    value: "Devil Horns",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "demonic", "fear", "aggression"],
    extraPassives: ["Improves fear pressure and aggressive battle presence"]
  },
  {
    category: "Headwears",
    value: "Deadphones",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "King Crown",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "Cap",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-headwear", "worker", "order", "utility"],
    extraPassives: ["Improves practical stability and role-driven utility"]
  },
  {
    category: "Headwears",
    value: "Jackson",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Baby Dragon",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Bushido",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Biker",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Odins Raven",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Axe",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Gold Miner",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-headwear", "worker", "order", "utility"],
    extraPassives: ["Improves practical stability and role-driven utility"]
  },
  {
    category: "Headwears",
    value: "Hell Horns",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "demonic", "fear", "aggression"],
    extraPassives: ["Improves fear pressure and aggressive battle presence"]
  },
  {
    category: "Headwears",
    value: "Dead Dragon",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Nailed It",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Red Indian",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "The Captain",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "Her Hair",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "style", "identity", "tempo"],
    extraPassives: ["Improves style-based confidence and expression pressure"]
  },
  {
    category: "Headwears",
    value: "Peaky Blinder",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "style", "identity", "tempo"],
    extraPassives: ["Improves style-based confidence and expression pressure"]
  },
  {
    category: "Headwears",
    value: "Revolver",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Samurai",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Thunderstruck",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Dragon Slayer",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Pirate Beanie",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "pirate", "rogue", "tempo"],
    extraPassives: ["Improves rogue tempo and opportunistic pressure"]
  },
  {
    category: "Headwears",
    value: "Bane",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Benji",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Ring Of Roses",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "style", "identity", "tempo"],
    extraPassives: ["Improves style-based confidence and expression pressure"]
  },
  {
    category: "Headwears",
    value: "Fortune Teller",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Hellrazor",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "demonic", "fear", "aggression"],
    extraPassives: ["Improves fear pressure and aggressive battle presence"]
  },
  {
    category: "Headwears",
    value: "Matrix Helmet",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "Wolfskin",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Caribbean Pirate",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "pirate", "rogue", "tempo"],
    extraPassives: ["Improves rogue tempo and opportunistic pressure"]
  },
  {
    category: "Headwears",
    value: "Wolfgang",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Clowning Around",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "Davy Jones",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "pirate", "rogue", "tempo"],
    extraPassives: ["Improves rogue tempo and opportunistic pressure"]
  },
  {
    category: "Headwears",
    value: "Dead Scorpion",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Pirates Life",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "pirate", "rogue", "tempo"],
    extraPassives: ["Improves rogue tempo and opportunistic pressure"]
  },
  {
    category: "Headwears",
    value: "Octopus",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Roman Soldier",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Chained",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Bio Hazard",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "Medieval Armour",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Pipe Dream",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Mourning",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Steampunk",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "Egyptian God",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Facing The Stinger",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Dead Astronaut",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "Fireman",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Jester",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "Marley",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "War",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "demonic", "fear", "aggression"],
    extraPassives: ["Improves fear pressure and aggressive battle presence"]
  },
  {
    category: "Headwears",
    value: "Arachne",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Astral",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Capone",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-headwear", "worker", "order", "utility"],
    extraPassives: ["Improves practical stability and role-driven utility"]
  },
  {
    category: "Headwears",
    value: "Emperor",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "Four Twenty",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "Lords Crown",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "On A Dim Night",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "The Brainiac",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "Crystal Hawk",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Leonidas",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Old Police Hat",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-headwear", "worker", "order", "utility"],
    extraPassives: ["Improves practical stability and role-driven utility"]
  },
  {
    category: "Headwears",
    value: "Redemption",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Royalty",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "420 Cap",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-headwear", "worker", "order", "utility"],
    extraPassives: ["Improves practical stability and role-driven utility"]
  },
  {
    category: "Headwears",
    value: "Bipolar",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "Card Master",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "weaponized", "threat", "intimidation"],
    extraPassives: ["Improves intimidation and combat-ready pressure"]
  },
  {
    category: "Headwears",
    value: "Dead Head",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Heavy Is The Head",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "Lucky Death",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Mohawk",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "style", "identity", "tempo"],
    extraPassives: ["Improves style-based confidence and expression pressure"]
  },
  {
    category: "Headwears",
    value: "WW2 Ace",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Adams Hand",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Bullet Head",
    bonus: { crit: 1, utility: 2 },
    extraTags: ["commander-headwear", "tech", "scan", "augmented"],
    extraPassives: ["Improves technical precision and processed battlefield reads"]
  },
  {
    category: "Headwears",
    value: "Dead Samurai",
    bonus: { attack: 1, armor: 1 },
    extraTags: ["commander-headwear", "warrior", "discipline", "combat"],
    extraPassives: ["Improves disciplined combat posture and frontline resolve"]
  },
  {
    category: "Headwears",
    value: "Hive Mind",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Pharaohs Fortune",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Viking Warrior",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-headwear", "authority", "leader", "aura"],
    extraPassives: ["Improves leadership, aura pressure, and command presence"]
  },
  {
    category: "Headwears",
    value: "War Horns",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "demonic", "fear", "aggression"],
    extraPassives: ["Improves fear pressure and aggressive battle presence"]
  },
  {
    category: "Headwears",
    value: "Black Widow",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "beast", "predator", "tribal"],
    extraPassives: ["Improves beast-linked identity and hunt pressure"]
  },
  {
    category: "Headwears",
    value: "Ice man",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Tapped",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Bright Idea",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "Her Hat",
    bonus: { speed: 1, utility: 1 },
    extraTags: ["commander-headwear", "style", "identity", "tempo"],
    extraPassives: ["Improves style-based confidence and expression pressure"]
  },
  {
    category: "Headwears",
    value: "Police Hat",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-headwear", "worker", "order", "utility"],
    extraPassives: ["Improves practical stability and role-driven utility"]
  },
  {
    category: "Headwears",
    value: "Roses Are Dead",
    bonus: { utility: 1 },
    extraTags: ["commander-headwear", "presence"],
    extraPassives: ["Improves commander headwear-based synergy"]
  },
  {
    category: "Headwears",
    value: "Times up",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "chaos", "mindgame", "weird"],
    extraPassives: ["Improves mindgame pressure and unpredictable tempo"]
  },
  {
    category: "Headwears",
    value: "All Seeing Eye",
    bonus: { utility: 2 },
    extraTags: ["commander-headwear", "mystic", "foresight", "ritual"],
    extraPassives: ["Improves foresight, ritual pressure, and hidden knowledge"]
  },
  {
    category: "Headwears",
    value: "Pentagram",
    bonus: { attack: 1, utility: 1 },
    extraTags: ["commander-headwear", "demonic", "fear", "aggression"],
    extraPassives: ["Improves fear pressure and aggressive battle presence"]
  },
  // =========================
  // COMMANDER SKINS
  // =========================
  {
    category: "Skins",
    value: "Yes or No",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "The Cogs Turn",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Day Of The Dead",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Sleek",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Anunnaki",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Year 4023",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Time Is All We Have",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "Mosaic",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Good vs Evil",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Living In Grief",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Melting",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "elemental", "aura", "energy"],
    extraPassives: ["Improves elemental pressure and energized body-state flavor"]
  },
  {
    category: "Skins",
    value: "Smooth Operator",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Light Of My Life",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Wisdom",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Naked",
    bonus: { health: 1, speed: 1 },
    extraTags: ["commander-skin", "baseline", "human", "fragile"],
    extraPassives: ["More exposed body-state with lighter but faster bonuses"]
  },
  {
    category: "Skins",
    value: "Spiders Web",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  },
  {
    category: "Skins",
    value: "Fast Lane",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Gold Carvings",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Misunderstood",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Round Table",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Glory In Death",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Lost",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Great Britain",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "rogue", "fortune", "risk"],
    extraPassives: ["Improves high-risk pressure and opportunistic play flavor"]
  },
  {
    category: "Skins",
    value: "Half Human",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  },
  {
    category: "Skins",
    value: "Praise",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Carved In Hell",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "The Healer",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Bees And Honey",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  },
  {
    category: "Skins",
    value: "Mandala",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "Ornate",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Lookin Glass",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "Dragons Mother",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Enigma",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "Holy",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Death Defines",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Loved Fashion",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Guardian",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Lost Hope",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "3D Future",
    bonus: { health: 1, speed: 1 },
    extraTags: ["commander-skin", "baseline", "human", "fragile"],
    extraPassives: ["More exposed body-state with lighter but faster bonuses"]
  },
  {
    category: "Skins",
    value: "Punishment",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Unplugged",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "79 Years",
    bonus: { health: 1, speed: 1 },
    extraTags: ["commander-skin", "baseline", "human", "fragile"],
    extraPassives: ["More exposed body-state with lighter but faster bonuses"]
  },
  {
    category: "Skins",
    value: "Pure Evil",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Take Me To Hell",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Death Glow",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Warrior",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Heavy Is The Head",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Trapped",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Visiting Earth",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Mad House",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Bloody Death",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Kill For Gold",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Fortune Teller",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Her Beauty",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Serial Killer",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Comms Down",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Del Muerte",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Forsaken Throne",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Inferno",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "elemental", "aura", "energy"],
    extraPassives: ["Improves elemental pressure and energized body-state flavor"]
  },
  {
    category: "Skins",
    value: "Interstellar",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Not King Nor Queen",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Ancient Warrior",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "No Remorse",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Beauty Queen",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Galactic",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Hybrid",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  },
  {
    category: "Skins",
    value: "3 Card Monty",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "rogue", "fortune", "risk"],
    extraPassives: ["Improves high-risk pressure and opportunistic play flavor"]
  },
  {
    category: "Skins",
    value: "Blessed",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Ice Age",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "elemental", "aura", "energy"],
    extraPassives: ["Improves elemental pressure and energized body-state flavor"]
  },
  {
    category: "Skins",
    value: "Peace Of Mind",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Spreading Evil",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Dare Me",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Slave Master",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Techno",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Long Live The King",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Witching Hour",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Hooded One",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Shrouded",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Unwind my Fate",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "The Hairdresser",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Dead Queen",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Sound Of Death",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Spiteful",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Flare",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "elemental", "aura", "energy"],
    extraPassives: ["Improves elemental pressure and energized body-state flavor"]
  },
  {
    category: "Skins",
    value: "Sovereign Of Shadows",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "A Pirates Sins",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Born Into Darkness",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "In Death I Hear You",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Ruined",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Devils Advocate",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Skulls in Skulls",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Circle Of Life",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "Deceit",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "mind", "suffering", "shadow"],
    extraPassives: ["Improves suffering, deception, and shadow-state resilience"]
  },
  {
    category: "Skins",
    value: "Misty Death",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Dead King",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Clown",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Dead Man's Hand",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Drippy skull",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Dead Patriot",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Enslaved",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  },
  {
    category: "Skins",
    value: "Astrological",
    bonus: { health: 1, utility: 2 },
    extraTags: ["commander-skin", "fate", "time", "mystic"],
    extraPassives: ["Improves mystic foresight and temporal defense flavor"]
  },
  {
    category: "Skins",
    value: "Dead Dollars",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Heavens Retro",
    bonus: { health: 2, utility: 1 },
    extraTags: ["commander-skin", "holy", "renewal", "preserve"],
    extraPassives: ["Improves sustain, healing flavor, and stabilising pressure"]
  },
  {
    category: "Skins",
    value: "Marble Paint",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Naked Minds",
    bonus: { health: 1, speed: 1 },
    extraTags: ["commander-skin", "baseline", "human", "fragile"],
    extraPassives: ["More exposed body-state with lighter but faster bonuses"]
  },
  {
    category: "Skins",
    value: "One Shot One Kill",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Rekt Skull",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Celebrate Life",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Chosen Ones",
    bonus: { health: 1, armor: 1, utility: 1 },
    extraTags: ["commander-skin", "royal", "warrior", "command"],
    extraPassives: ["Improves disciplined durability and leadership presence"]
  },
  {
    category: "Skins",
    value: "Dead Money",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Diamond",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Hells Retro",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Pop Art",
    bonus: { speed: 1, utility: 2 },
    extraTags: ["commander-skin", "style", "elegance", "confidence"],
    extraPassives: ["Improves refined confidence and smooth tempo presence"]
  },
  {
    category: "Skins",
    value: "Celtic Skull",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Crazy Life",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Dead Flowers",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Illuminati",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Pushing Up Daisies",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Four Twenty",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Funeral Song",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Live A Full Life",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Mech",
    bonus: { armor: 1, utility: 2 },
    extraTags: ["commander-skin", "tech", "synthetic", "adaptive"],
    extraPassives: ["Improves adaptive defense and technical resilience"]
  },
  {
    category: "Skins",
    value: "Sins Of Man",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "dark", "corruption", "pain"],
    extraPassives: ["Improves corruption, pain, and attrition pressure"]
  },
  {
    category: "Skins",
    value: "Honeycomb",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  },
  {
    category: "Skins",
    value: "Junkyard",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Rotting Flesh",
    bonus: { health: 2, armor: 1 },
    extraTags: ["commander-skin", "undead", "grave", "grim"],
    extraPassives: ["Improves undead resilience and grave-flavored endurance"]
  },
  {
    category: "Skins",
    value: "Roses",
    bonus: { health: 1, utility: 1 },
    extraTags: ["commander-skin", "body"],
    extraPassives: ["Improves commander skin-based synergy"]
  },
  {
    category: "Skins",
    value: "Frankenstein",
    bonus: { attack: 1, health: 1, utility: 1 },
    extraTags: ["commander-skin", "mutated", "creature", "hybrid"],
    extraPassives: ["Improves mutated-body resilience and creature pressure"]
  }
];
