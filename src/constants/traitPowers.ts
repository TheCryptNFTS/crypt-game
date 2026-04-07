export type TraitPower = {
  category: string;
  value: string;
  tags: string[];
  moves: string[];
  passives: string[];
  statMods?: {
    attack?: number;
    health?: number;
    armor?: number;
    crit?: number;
    speed?: number;
    utility?: number;
  };
  special?: boolean;
};

export const TRAIT_POWERS: TraitPower[] = [
  // NONE
  {
    category: "Weapons",
    value: "None",
    tags: ["unarmed"],
    moves: ["Scrap", "Bare Knuckle"],
    passives: ["No weapon bonus"],
    statMods: { speed: 1 }
  },

  // AXES / HEAVY
  {
    category: "Weapons",
    value: "Axe",
    tags: ["melee", "heavy", "cleave"],
    moves: ["Heavy Swing", "Split Armor"],
    passives: ["Bonus damage against armored enemies"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Great Axe",
    tags: ["melee", "heavy", "cleave", "slow"],
    moves: ["Execution Arc", "Sunder"],
    passives: ["High damage but reduced tempo"],
    statMods: { attack: 3, speed: -1 }
  },
  {
    category: "Weapons",
    value: "Hand Axe",
    tags: ["melee", "fast", "bleed"],
    moves: ["Hack", "Quick Rend"],
    passives: ["Faster follow-up strikes"],
    statMods: { attack: 1, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Storm Breaker",
    tags: ["melee", "heavy", "shock"],
    moves: ["Thunder Chop", "Storm Burst"],
    passives: ["Attacks can apply shock"],
    statMods: { attack: 2, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Double Storm Breaker",
    tags: ["melee", "dual", "shock", "burst"],
    moves: ["Twin Tempest", "Thunder Rush"],
    passives: ["Multi-hit burst attacks"],
    statMods: { attack: 2, speed: 1 }
  },

  // BLADES
  {
    category: "Weapons",
    value: "Broken Sword",
    tags: ["melee", "blade", "desperate"],
    moves: ["Jagged Slash", "Last Stand"],
    passives: ["Stronger when damaged"],
    statMods: { attack: 1 }
  },
  {
    category: "Weapons",
    value: "Cutlass",
    tags: ["melee", "blade", "tempo"],
    moves: ["Cut Down", "Riposte"],
    passives: ["Improved counter-pressure"],
    statMods: { attack: 1, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Daggers",
    tags: ["melee", "blade", "fast", "crit"],
    moves: ["Quick Stab", "Bleeding Cut"],
    passives: ["Higher crit pressure"],
    statMods: { attack: 1, crit: 2, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Twin Daggers",
    tags: ["melee", "dual", "fast", "crit"],
    moves: ["Twin Slice", "Assassin Rush"],
    passives: ["Bonus on repeated hits"],
    statMods: { attack: 1, crit: 2, speed: 2 }
  },
  {
    category: "Weapons",
    value: "Katana",
    tags: ["melee", "blade", "precision"],
    moves: ["Iaido Cut", "Perfect Slice"],
    passives: ["Improved first strike precision"],
    statMods: { attack: 2, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Long Sword",
    tags: ["melee", "blade", "balanced"],
    moves: ["Cleave", "Parry Slash"],
    passives: ["Balanced offense and tempo"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Short Sword",
    tags: ["melee", "blade", "fast"],
    moves: ["Short Slash", "Lunge"],
    passives: ["Faster attack sequencing"],
    statMods: { attack: 1, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Scimitar",
    tags: ["melee", "blade", "curved", "tempo"],
    moves: ["Arc Slice", "Dance Cut"],
    passives: ["Bonus mobility in combat"],
    statMods: { attack: 1, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Sword Of Heaven",
    tags: ["melee", "blade", "holy"],
    moves: ["Radiant Slash", "Heavenfall"],
    passives: ["Deals bonus against corrupted targets"],
    statMods: { attack: 2, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Hobbits Stinger",
    tags: ["melee", "blade", "pierce", "small"],
    moves: ["Precise Stab", "Hidden Cut"],
    passives: ["Bonus vs larger enemies"],
    statMods: { attack: 1, crit: 1, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Knife Eye",
    tags: ["melee", "blade", "precision", "weird"],
    moves: ["Eye Jab", "Focused Cut"],
    passives: ["Improved target lock"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Demon Slayer",
    tags: ["melee", "blade", "anti-demon"],
    moves: ["Purge Slash", "Demon Break"],
    passives: ["Bonus vs cursed or demon tags"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Redemption",
    tags: ["melee", "blade", "holy"],
    moves: ["Redeeming Strike", "Purity Arc"],
    passives: ["Recover slightly on kill"],
    statMods: { attack: 2, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Light Saber",
    tags: ["melee", "energy", "precision"],
    moves: ["Photon Slice", "Beam Arc"],
    passives: ["Ignores part of armor"],
    statMods: { attack: 2, crit: 1 }
  },

  // BLUNT / CRUSH
  {
    category: "Weapons",
    value: "Baseball Bat",
    tags: ["melee", "blunt", "knockback"],
    moves: ["Home Run", "Crack Skull"],
    passives: ["Chance to stagger enemies"],
    statMods: { attack: 1 }
  },
  {
    category: "Weapons",
    value: "Boxing Gloves",
    tags: ["melee", "blunt", "combo", "fast"],
    moves: ["Jab", "Cross Combo"],
    passives: ["Bonus on consecutive attacks"],
    statMods: { speed: 2 }
  },
  {
    category: "Weapons",
    value: "Elven Shoemakers Hammer",
    tags: ["melee", "blunt", "craft", "crush"],
    moves: ["Forge Strike", "Hammerfall"],
    passives: ["Minor armor break"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Flail",
    tags: ["melee", "blunt", "wild"],
    moves: ["Chain Crush", "Swing Through"],
    passives: ["Can pressure guarded targets"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Lead Pipe",
    tags: ["melee", "blunt", "brutal"],
    moves: ["Pipe Crack", "Dirty Hit"],
    passives: ["Bonus vs weakened enemies"],
    statMods: { attack: 1 }
  },
  {
    category: "Weapons",
    value: "Mad Max Pipe",
    tags: ["melee", "blunt", "scrap"],
    moves: ["Road Smash", "Junkyard Hit"],
    passives: ["Gains value in rough fights"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Mjolnir",
    tags: ["melee", "blunt", "shock", "mythic"],
    moves: ["Hammer of Storms", "Sky Crash"],
    passives: ["Shock impact on hit"],
    statMods: { attack: 3, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Morning Star",
    tags: ["melee", "blunt", "pierce", "crush"],
    moves: ["Spiked Crush", "Morning Break"],
    passives: ["Improved armor break"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Nailed It",
    tags: ["melee", "blunt", "improvised", "crush"],
    moves: ["Nail Bash", "Ragged Slam"],
    passives: ["Extra pressure on damaged units"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Pans Revenge",
    tags: ["melee", "blunt", "improvised"],
    moves: ["Pan Crack", "Kitchen Fury"],
    passives: ["Improved retaliation flavor"],
    statMods: { attack: 1 }
  },
  {
    category: "Weapons",
    value: "Pipe Dream",
    tags: ["melee", "blunt", "scrap", "tempo"],
    moves: ["Dream Smash", "Scrap Rush"],
    passives: ["Cheap pressure identity"],
    statMods: { attack: 1, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Saurons Mace",
    tags: ["melee", "blunt", "dark", "crush"],
    moves: ["Dark Crush", "Mordor Slam"],
    passives: ["Applies intimidation pressure"],
    statMods: { attack: 3 }
  },
  {
    category: "Weapons",
    value: "Sharp",
    tags: ["melee", "simple", "improvised"],
    moves: ["Sharp Jab", "Quick Cut"],
    passives: ["Light pressure only"],
    statMods: { attack: 1 }
  },
  {
    category: "Weapons",
    value: "Trippie Brew",
    tags: ["melee", "chaos", "weird"],
    moves: ["Brew Bash", "Chaos Spill"],
    passives: ["Random minor effect chance"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Under Pressure",
    tags: ["melee", "blunt", "tempo"],
    moves: ["Press Down", "Crush Nerve"],
    passives: ["Gains value when ahead on board"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Garden Hoe",
    tags: ["melee", "improvised", "reach"],
    moves: ["Hook Pull", "Hoe Strike"],
    passives: ["Minor board-control utility"],
    statMods: { attack: 1, utility: 1 }
  },

  // POLE / REACH
  {
    category: "Weapons",
    value: "Glavie",
    tags: ["melee", "reach", "cleave"],
    moves: ["Wide Arc", "Pole Sweep"],
    passives: ["Hits through frontline pressure"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Pike",
    tags: ["melee", "reach", "pierce"],
    moves: ["Long Thrust", "Hold the Line"],
    passives: ["Strong into charging enemies"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Weapons",
    value: "Staff",
    tags: ["melee", "reach", "arcane"],
    moves: ["Arcane Strike", "Channel Tap"],
    passives: ["Supports utility effects"],
    statMods: { attack: 1, utility: 2 }
  },
  {
    category: "Weapons",
    value: "Scythe",
    tags: ["melee", "reach", "reap"],
    moves: ["Reaping Cut", "Harvest Arc"],
    passives: ["Improved finish potential"],
    statMods: { attack: 2 }
  },

  // WHIPS / FLEX
  {
    category: "Weapons",
    value: "Chain Whip",
    tags: ["melee", "flex", "control"],
    moves: ["Entangle Lash", "Chain Snap"],
    passives: ["Can disrupt enemy tempo"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Nine Tails Whip",
    tags: ["melee", "flex", "multi-hit"],
    moves: ["Ninefold Lash", "Scourge"],
    passives: ["Applies repeated chip pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Snake Whip",
    tags: ["melee", "flex", "poison"],
    moves: ["Venom Lash", "Coil Strike"],
    passives: ["Can apply poison"],
    statMods: { utility: 2 }
  },

  // BOWS / ARROWS / THROWN
  {
    category: "Weapons",
    value: "Arrow",
    tags: ["ranged", "pierce"],
    moves: ["Piercing Shot", "Volley"],
    passives: ["Improved backline reach"],
    statMods: { crit: 1 }
  },
  {
    category: "Weapons",
    value: "Red Arrow",
    tags: ["ranged", "pierce", "marked"],
    moves: ["Marked Shot", "Blood Arrow"],
    passives: ["Bonus against marked targets"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Yaka Arrow",
    tags: ["ranged", "pierce", "tribal"],
    moves: ["Yaka Shot", "Hunt Mark"],
    passives: ["Improved precision"],
    statMods: { crit: 1 }
  },
  {
    category: "Weapons",
    value: "Long Bow",
    tags: ["ranged", "precision", "long-range"],
    moves: ["Snipe", "Long Draw"],
    passives: ["Strong long-range targeting"],
    statMods: { crit: 2 }
  },
  {
    category: "Weapons",
    value: "Short Bow",
    tags: ["ranged", "fast", "volley"],
    moves: ["Quick Shot", "Rapid Volley"],
    passives: ["Better tempo than heavy bows"],
    statMods: { speed: 1, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Cross Bow",
    tags: ["ranged", "pierce", "heavy"],
    moves: ["Bolt Shot", "Armor Pierce"],
    passives: ["Ignores part of armor"],
    statMods: { attack: 2, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Slingshot",
    tags: ["ranged", "cheap", "tempo"],
    moves: ["Pebble Pop", "Cheap Shot"],
    passives: ["Fast low-cost pressure"],
    statMods: { speed: 1 }
  },
  {
    category: "Weapons",
    value: "Throwing Knives",
    tags: ["ranged", "fast", "bleed"],
    moves: ["Knife Fan", "Cutting Rain"],
    passives: ["Bonus chip damage"],
    statMods: { speed: 1, crit: 1 }
  },

  // GUNS
  {
    category: "Weapons",
    value: "AK47",
    tags: ["ranged", "gun", "burst"],
    moves: ["Burst Fire", "Suppressing Spray"],
    passives: ["High pressure against exposed targets"],
    statMods: { attack: 2, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Desert Eagle 5.0",
    tags: ["ranged", "gun", "heavy"],
    moves: ["Magnum Shot", "Headshot"],
    passives: ["High burst single-target damage"],
    statMods: { attack: 2, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Glock",
    tags: ["ranged", "gun", "fast"],
    moves: ["Quick Shot", "Double Tap"],
    passives: ["Improved tempo shots"],
    statMods: { speed: 1, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Grenade Launcher",
    tags: ["ranged", "gun", "explosive"],
    moves: ["Shell Burst", "Arc Bombard"],
    passives: ["Splash pressure"],
    statMods: { attack: 2, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Pipe Gun",
    tags: ["ranged", "gun", "scrap"],
    moves: ["Junk Shot", "Unsafe Burst"],
    passives: ["Unstable but aggressive"],
    statMods: { attack: 1 }
  },
  {
    category: "Weapons",
    value: "Pulse Energy Gun",
    tags: ["ranged", "gun", "energy"],
    moves: ["Pulse Shot", "Energy Burst"],
    passives: ["Bypasses some defenses"],
    statMods: { attack: 2, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Revolver",
    tags: ["ranged", "gun", "precision"],
    moves: ["Quick Draw", "Fatal Round"],
    passives: ["Higher crit pressure"],
    statMods: { attack: 1, crit: 2 }
  },
  {
    category: "Weapons",
    value: "Robotic Gun",
    tags: ["ranged", "gun", "tech"],
    moves: ["Auto Burst", "Servo Shot"],
    passives: ["Stable ranged output"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Robotic Pistol",
    tags: ["ranged", "gun", "tech", "fast"],
    moves: ["Auto Tap", "Servo Snap"],
    passives: ["Improved accuracy"],
    statMods: { speed: 1, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Shotgun",
    tags: ["ranged", "gun", "blast"],
    moves: ["Buckshot", "Close Blast"],
    passives: ["Better at close-range finish pressure"],
    statMods: { attack: 2 }
  },
  {
    category: "Weapons",
    value: "Sniper Rifle",
    tags: ["ranged", "gun", "precision", "long-range"],
    moves: ["Deadeye", "Kill Shot"],
    passives: ["Very high precision against priority targets"],
    statMods: { crit: 3 }
  },
  {
    category: "Weapons",
    value: "The Fixer",
    tags: ["ranged", "gun", "assassin"],
    moves: ["Silent Round", "Fix the Problem"],
    passives: ["Bonus against wounded targets"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Uzi",
    tags: ["ranged", "gun", "spray", "fast"],
    moves: ["Spray Fire", "Unload"],
    passives: ["Multi-hit pressure"],
    statMods: { speed: 2 }
  },

  // EXPLOSIVE / THROWABLE
  {
    category: "Weapons",
    value: "Bullet",
    tags: ["ranged", "ammo", "pierce"],
    moves: ["Loaded Round", "Piercing Hit"],
    passives: ["Supports ranged damage identity"],
    statMods: { crit: 1 }
  },
  {
    category: "Weapons",
    value: "Flash Grenade",
    tags: ["ranged", "utility", "blind"],
    moves: ["Flash Pop", "Blinding Burst"],
    passives: ["Can disrupt enemy actions"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Freeze",
    tags: ["ranged", "utility", "ice"],
    moves: ["Freeze Blast", "Cold Snap"],
    passives: ["Can slow enemies"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Flamethrower",
    tags: ["ranged", "fire", "sweep"],
    moves: ["Burn Line", "Flame Wash"],
    passives: ["Applies burn pressure"],
    statMods: { attack: 2, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Molotov Cocktail",
    tags: ["ranged", "fire", "throwable"],
    moves: ["Molotov Toss", "Fire Spread"],
    passives: ["Creates burn zones"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Smoke Bomb",
    tags: ["utility", "stealth", "escape"],
    moves: ["Smoke Veil", "Blind Exit"],
    passives: ["Improves evasion/escape patterns"],
    statMods: { utility: 2, speed: 1 }
  },
  {
    category: "Weapons",
    value: "Smoke Grenade",
    tags: ["utility", "smoke", "control"],
    moves: ["Smoke Cloud", "Line Break"],
    passives: ["Can disrupt targeting"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Smoked Out",
    tags: ["utility", "smoke", "pressure"],
    moves: ["Choke Screen", "Pressure Fog"],
    passives: ["Punishes clustered enemies"],
    statMods: { utility: 2 }
  },

  // ARCANE / RELIC / SPECIAL
  {
    category: "Weapons",
    value: "Lokis Sceptre",
    tags: ["arcane", "trickster", "control"],
    moves: ["Trick Bolt", "Loki's Twist"],
    passives: ["Can apply deceptive or chaos effects"],
    statMods: { utility: 3 }
  },
  {
    category: "Weapons",
    value: "Lokis Sceptre Green",
    tags: ["arcane", "trickster", "poison"],
    moves: ["Venom Trick", "Green Hex"],
    passives: ["Applies poison/control pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Weapons",
    value: "Lokis Sceptre Teal",
    tags: ["arcane", "trickster", "phase"],
    moves: ["Teal Hex", "Phase Trick"],
    passives: ["Improves evasive play"],
    statMods: { utility: 3 }
  },
  {
    category: "Weapons",
    value: "Minoru Sceptre",
    tags: ["arcane", "sceptre", "precision"],
    moves: ["Minoru Ray", "Focused Hex"],
    passives: ["Higher control precision"],
    statMods: { utility: 2, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Wand",
    tags: ["arcane", "focus", "cast"],
    moves: ["Arc Bolt", "Focus Beam"],
    passives: ["Supports spell-like effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Weapons",
    value: "Robotic",
    tags: ["tech", "weird", "hybrid"],
    moves: ["Servo Strike", "Machine Burst"],
    passives: ["Hybrid utility profile"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Weapons",
    value: "Nightmare Claws",
    tags: ["melee", "claw", "fear"],
    moves: ["Night Rend", "Terror Slash"],
    passives: ["Can apply fear pressure"],
    statMods: { attack: 2, crit: 1 }
  },
  {
    category: "Weapons",
    value: "Red Rose",
    tags: ["special", "charm", "bleed"],
    moves: ["Rose Thorn", "Bloody Bloom"],
    passives: ["Charm/flavor bleed profile"],
    statMods: { utility: 1, crit: 1 }
  },

  // =========================
  // ARMOR
  // =========================

  {
    category: "Armor",
    value: "None",
    tags: ["unarmored"],
    moves: ["Roll", "Brace"],
    passives: ["No armor bonus"],
    statMods: { speed: 1 }
  },
  {
    category: "Armor",
    value: "Boots",
    tags: ["mobility", "footwork"],
    moves: ["Quick Step", "Dash Kick"],
    passives: ["Slightly improved movement and tempo"],
    statMods: { speed: 1 }
  },
  {
    category: "Armor",
    value: "Stealth Boots",
    tags: ["mobility", "stealth", "evasion"],
    moves: ["Silent Step", "Vanish Step"],
    passives: ["Harder to pin down or target cleanly"],
    statMods: { speed: 2, utility: 1 }
  },
  {
    category: "Armor",
    value: "Socks And Jesus Sandals",
    tags: ["mobility", "weird", "tempo"],
    moves: ["Holy Shuffle", "Sandaled Sprint"],
    passives: ["Odd but surprisingly slippery"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Armor",
    value: "Bracers",
    tags: ["defense", "parry", "guard"],
    moves: ["Deflect", "Brace Up"],
    passives: ["Improves basic blocking and survivability"],
    statMods: { armor: 1, health: 1 }
  },
  {
    category: "Armor",
    value: "Buckler",
    tags: ["shield", "block", "counter"],
    moves: ["Buckler Check", "Quick Guard"],
    passives: ["Reduce the first incoming damage each turn"],
    statMods: { armor: 2 }
  },
  {
    category: "Armor",
    value: "Crusader Shield",
    tags: ["shield", "holy", "guard"],
    moves: ["Crusade Guard", "Shield Bash"],
    passives: ["Improved frontline protection"],
    statMods: { armor: 2, health: 1 }
  },
  {
    category: "Armor",
    value: "Riot Shield",
    tags: ["shield", "wall", "control"],
    moves: ["Shield Wall", "Suppress Push"],
    passives: ["Very strong against frontal pressure"],
    statMods: { armor: 3 }
  },
  {
    category: "Armor",
    value: "Leather Tunic",
    tags: ["light-armor", "balanced"],
    moves: ["Absorb Hit", "Stay Loose"],
    passives: ["Balanced low-weight protection"],
    statMods: { armor: 1, speed: 1 }
  },
  {
    category: "Armor",
    value: "Scale Mail",
    tags: ["medium-armor", "durable"],
    moves: ["Scale Guard", "Harden"],
    passives: ["Solid all-round mitigation"],
    statMods: { armor: 2, health: 1 }
  },
  {
    category: "Armor",
    value: "Snake Scale Mail",
    tags: ["medium-armor", "poison-resist", "slick"],
    moves: ["Serpent Guard", "Slip Aside"],
    passives: ["Better against poison or attrition effects"],
    statMods: { armor: 2, utility: 1 }
  },
  {
    category: "Armor",
    value: "Dragon Scale Mail",
    tags: ["heavy-armor", "mythic", "resistance"],
    moves: ["Dragon Guard", "Scale Fortress"],
    passives: ["Strong resistance profile"],
    statMods: { armor: 3, health: 2 }
  },
  {
    category: "Armor",
    value: "Dragon Bone Plate",
    tags: ["heavy-armor", "mythic", "tank"],
    moves: ["Bone Bastion", "Ancient Plating"],
    passives: ["Extremely high durability"],
    statMods: { armor: 4, health: 2, speed: -1 }
  },
  {
    category: "Armor",
    value: "Energy Shield",
    tags: ["shield", "energy", "barrier"],
    moves: ["Energy Ward", "Pulse Barrier"],
    passives: ["Absorbs bursts more efficiently"],
    statMods: { armor: 2, utility: 2 }
  },
  {
    category: "Armor",
    value: "Gauntlets",
    tags: ["armor", "impact", "melee"],
    moves: ["Iron Grip", "Gauntlet Slam"],
    passives: ["Improves close-quarters impact"],
    statMods: { armor: 1, attack: 1 }
  },
  {
    category: "Armor",
    value: "Clockwork",
    tags: ["tech-armor", "tempo", "mechanical"],
    moves: ["Wind Up", "Clockwork Brace"],
    passives: ["Stable mechanical defenses"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Armor",
    value: "Mech Full Plate",
    tags: ["tech-armor", "heavy", "mechanical"],
    moves: ["Servo Guard", "Full Plate Lock"],
    passives: ["Strong heavy-tech mitigation"],
    statMods: { armor: 3, health: 1, speed: -1 }
  },
  {
    category: "Armor",
    value: "Mask",
    tags: ["face-armor", "fear", "resist"],
    moves: ["Masked Resolve", "Dread Glare"],
    passives: ["Improves mental pressure / resistance"],
    statMods: { armor: 1, utility: 1 }
  },
,

  // =========================
  // GOD
  // =========================

  {
    category: "God",
    value: "Anubis",
    tags: ["god", "death", "judgment", "underworld"],
    moves: ["Soul Weigh", "Tomb Call"],
    passives: ["Strong interaction with death, grave, or fallen units"],
    statMods: { utility: 3, health: 1 },
    special: true
  },
  {
    category: "God",
    value: "Anunnaki",
    tags: ["god", "cosmic", "ancient", "creator"],
    moves: ["Star Descent", "Ancient Decree"],
    passives: ["Reality-bending or origin-style power spikes"],
    statMods: { utility: 3, attack: 1 },
    special: true
  },
  {
    category: "God",
    value: "Aphrodite",
    tags: ["god", "charm", "beauty", "temptation"],
    moves: ["Charm Pulse", "Heart Snare"],
    passives: ["Can redirect pressure or weaken enemy aggression"],
    statMods: { utility: 3, speed: 1 },
    special: true
  },
  {
    category: "God",
    value: "Hades",
    tags: ["god", "underworld", "drain", "death"],
    moves: ["Underworld Gate", "Grave Grasp"],
    passives: ["Strong graveyard, drain, and inevitability pressure"],
    statMods: { utility: 2, health: 2 },
    special: true
  },
  {
    category: "God",
    value: "Loki",
    tags: ["god", "trickster", "chaos", "deception"],
    moves: ["Trick Mirror", "False Fate"],
    passives: ["Chaos effects, swaps, and deceptive control"],
    statMods: { utility: 4 },
    special: true
  },
  {
    category: "God",
    value: "Odin",
    tags: ["god", "wisdom", "war", "runes"],
    moves: ["Rune Command", "Allfather's Gaze"],
    passives: ["High-level tactical buffs and foresight pressure"],
    statMods: { utility: 3, attack: 1 },
    special: true
  },
  {
    category: "God",
    value: "Poseidon",
    tags: ["god", "sea", "flood", "control"],
    moves: ["Tidal Crush", "Riptide Pull"],
    passives: ["Board displacement and wave-style control"],
    statMods: { utility: 3, health: 1 },
    special: true
  },
  {
    category: "God",
    value: "Thor",
    tags: ["god", "storm", "thunder", "crush"],
    moves: ["Thunder Hammer", "Stormfall"],
    passives: ["Shock-heavy burst and impact pressure"],
    statMods: { attack: 2, utility: 2 },
    special: true
  },
  {
    category: "God",
    value: "Vishnu",
    tags: ["god", "preservation", "order", "balance"],
    moves: ["Preserve", "Avatar Cycle"],
    passives: ["Protection, renewal, and stabilising power"],
    statMods: { health: 2, utility: 2 },
    special: true
  },
  {
    category: "God",
    value: "Zeus",
    tags: ["god", "sky", "lightning", "authority"],
    moves: ["Sky Judgment", "Lightning Crown"],
    passives: ["Punishes overextension with divine burst"],
    statMods: { attack: 2, utility: 2 },
    special: true
  },
,

  // =========================
  // ONE OF ONE
  // =========================

  {
    category: "One of One",
    value: "Crypt Keeper",
    tags: ["one-of-one", "keeper", "grave", "legendary"],
    moves: ["Seal the Tomb", "Keeper's Claim"],
    passives: ["Strong grave-control identity"],
    statMods: { utility: 3, health: 1 },
    special: true
  },
  {
    category: "One of One",
    value: "Darius",
    tags: ["one-of-one", "warlord", "command", "legendary"],
    moves: ["Darius Command", "Crush the Line"],
    passives: ["Leadership and frontline pressure"],
    statMods: { attack: 2, utility: 1 },
    special: true
  },
  {
    category: "One of One",
    value: "Diamond Damien",
    tags: ["one-of-one", "luxury", "resilience", "legendary"],
    moves: ["Diamond Cut", "Brilliant Guard"],
    passives: ["High-value premium resilience profile"],
    statMods: { armor: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Good vs Evil",
    tags: ["one-of-one", "duality", "moral", "legendary"],
    moves: ["Split Fate", "Moral Reckoning"],
    passives: ["Can pivot between opposing effect modes"],
    statMods: { utility: 3 },
    special: true
  },
  {
    category: "One of One",
    value: "Grim Reaper",
    tags: ["one-of-one", "death", "execute", "legendary"],
    moves: ["Final Harvest", "Soul Reap"],
    passives: ["Strong finisher identity against weakened enemies"],
    statMods: { attack: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Grim Reaper 2079",
    tags: ["one-of-one", "death", "cyber", "legendary"],
    moves: ["Neon Reap", "Protocol Extinction"],
    passives: ["Tech-infused execution profile"],
    statMods: { attack: 2, utility: 3 },
    special: true
  },
  {
    category: "One of One",
    value: "Harley",
    tags: ["one-of-one", "chaos", "trickster", "legendary"],
    moves: ["Chaos Spin", "Wild Card"],
    passives: ["Unstable tempo and disruption pressure"],
    statMods: { speed: 1, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Hear, Speak, See No Evil",
    tags: ["one-of-one", "triune", "silence", "legendary"],
    moves: ["Mute Truth", "Blind Judgment"],
    passives: ["Silence, concealment, and denial effects"],
    statMods: { utility: 3 },
    special: true
  },
  {
    category: "One of One",
    value: "I Am Death",
    tags: ["one-of-one", "death", "inevitability", "legendary"],
    moves: ["Death Incarnate", "End All Things"],
    passives: ["Overwhelming inevitability pressure"],
    statMods: { attack: 2, health: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "I am Death - Pink",
    tags: ["one-of-one", "death", "variant", "legendary"],
    moves: ["Pink Oblivion", "Fatal Bloom"],
    passives: ["Stylised variant of death-pressure mechanics"],
    statMods: { attack: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Jean",
    tags: ["one-of-one", "mind", "presence", "legendary"],
    moves: ["Psychic Hold", "Mindflare"],
    passives: ["Control-oriented mental pressure"],
    statMods: { utility: 3, crit: 1 },
    special: true
  },
  {
    category: "One of One",
    value: "King Tomb",
    tags: ["one-of-one", "royal", "grave", "legendary"],
    moves: ["Royal Entomb", "King's Decree"],
    passives: ["Authority plus graveyard dominance"],
    statMods: { health: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Lucifer",
    tags: ["one-of-one", "fallen", "temptation", "legendary"],
    moves: ["Fallen Star", "Infernal Offer"],
    passives: ["Corruption and temptation mechanics"],
    statMods: { attack: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Satoshi",
    tags: ["one-of-one", "origin", "money", "legendary"],
    moves: ["Genesis Block", "Chain Authority"],
    passives: ["Economic or system-level control identity"],
    statMods: { utility: 3 },
    special: true
  },
  {
    category: "One of One",
    value: "Skeletor",
    tags: ["one-of-one", "villain", "arcane", "legendary"],
    moves: ["Skull Blast", "Evil Ascendant"],
    passives: ["Villainous pressure and dark spell power"],
    statMods: { attack: 1, utility: 3 },
    special: true
  },
  {
    category: "One of One",
    value: "Skull Heart",
    tags: ["one-of-one", "heart", "undead", "legendary"],
    moves: ["Heart of Bone", "Undying Pulse"],
    passives: ["Strong sustain through death themes"],
    statMods: { health: 2, utility: 2 },
    special: true
  },
  {
    category: "One of One",
    value: "Skull Island",
    tags: ["one-of-one", "island", "territory", "legendary"],
    moves: ["Island Curse", "Bone Tide"],
    passives: ["Zone-control and board-pressure identity"],
    statMods: { utility: 3, health: 1 },
    special: true
  },
  {
    category: "One of One",
    value: "T2",
    tags: ["one-of-one", "machine", "future", "legendary"],
    moves: ["Target Lock", "Machine Ascend"],
    passives: ["Cold precision and machine inevitability"],
    statMods: { attack: 1, utility: 3 },
    special: true
  },
  {
    category: "One of One",
    value: "The Deceiver",
    tags: ["one-of-one", "deception", "trickster", "legendary"],
    moves: ["False Face", "Perfect Lie"],
    passives: ["Misleads and redirects enemy actions"],
    statMods: { utility: 4 },
    special: true
  },
  {
    category: "One of One",
    value: "Walter",
    tags: ["one-of-one", "chemist", "volatile", "legendary"],
    moves: ["Cook the Formula", "Volatile Mix"],
    passives: ["Explosive setup and unstable payoff mechanics"],
    statMods: { utility: 2, attack: 1 },
    special: true
  },
  {
    category: "One of One",
    value: "Yesterday Is History",
    tags: ["one-of-one", "time", "memory", "legendary"],
    moves: ["Rewrite Yesterday", "History Falls Away"],
    passives: ["Time and reset-oriented control effects"],
    statMods: { utility: 3 },
    special: true
  }
,

  // =========================
  // CHARACTER
  // =========================

  {
    category: "Character",
    value: "Amenadiel",
    tags: ["character", "angelic", "authority", "legendary"],
    moves: ["Divine Descent", "Heaven's Order"],
    passives: ["Strong authority and divine-pressure identity"],
    statMods: { utility: 3, health: 1 },
    special: true
  },
  {
    category: "Character",
    value: "D'Vile",
    tags: ["character", "villain", "dark", "legendary"],
    moves: ["Vile Strike", "Corrupt Intent"],
    passives: ["Dark pressure and corruption-style effects"],
    statMods: { attack: 2, utility: 1 },
    special: true
  },
  {
    category: "Character",
    value: "Elias",
    tags: ["character", "mystic", "presence", "legendary"],
    moves: ["Elias Invocation", "Silent Knowing"],
    passives: ["Measured control and mystic influence"],
    statMods: { utility: 2, health: 1 },
    special: true
  },
  {
    category: "Character",
    value: "Golden Samurai God",
    tags: ["character", "samurai", "gold", "divine", "legendary"],
    moves: ["Golden Cut", "Divine Iaido"],
    passives: ["Precision offense with divine-grade pressure"],
    statMods: { attack: 2, crit: 1, utility: 1 },
    special: true
  },
  {
    category: "Character",
    value: "Hokusai",
    tags: ["character", "artist", "wave", "legendary"],
    moves: ["Ink Wave", "Master's Stroke"],
    passives: ["Creative control and flow-based mechanics"],
    statMods: { utility: 3 },
    special: true
  },
  {
    category: "Character",
    value: "Hunter",
    tags: ["character", "tracker", "predator", "legendary"],
    moves: ["Mark the Prey", "Hunter's Finish"],
    passives: ["Improved pursuit and target-lock pressure"],
    statMods: { attack: 1, crit: 1, utility: 1 },
    special: true
  },
  {
    category: "Character",
    value: "Kiss of Death",
    tags: ["character", "death", "fatal", "legendary"],
    moves: ["Fatal Kiss", "Death Bloom"],
    passives: ["High lethality and finisher pressure"],
    statMods: { attack: 2, utility: 2 },
    special: true
  },
  {
    category: "Character",
    value: "Legendary Creation",
    tags: ["character", "origin", "mythic", "core"],
    moves: ["Genesis Shape", "Prime Creation"],
    passives: ["Foundational legendary identity with flexible mythic scaling"],
    statMods: { health: 1, utility: 2 },
    special: false
  },
  {
    category: "Character",
    value: "Mr LOL",
    tags: ["character", "chaos", "comic", "legendary"],
    moves: ["Laughing Break", "Mockery Burst"],
    passives: ["Disruptive tempo with mocking chaos"],
    statMods: { speed: 1, utility: 2 },
    special: true
  },
  {
    category: "Character",
    value: "The Dragon Master",
    tags: ["character", "dragon", "command", "legendary"],
    moves: ["Master's Roar", "Dragon Bind"],
    passives: ["Dragon synergy and commanding board presence"],
    statMods: { attack: 1, health: 1, utility: 2 },
    special: true
  },
  {
    category: "Character",
    value: "The Kraken",
    tags: ["character", "sea", "crush", "legendary"],
    moves: ["Tentacle Crush", "Deep Surge"],
    passives: ["Heavy zone pressure and crushing control"],
    statMods: { attack: 2, health: 1, utility: 1 },
    special: true
  },
,

  // =========================
  // CREATURE
  // =========================

  {
    category: "Creature",
    value: "None",
    tags: ["creatureless"],
    moves: ["Hold Ground", "Stay Ready"],
    passives: ["No creature bonus"],
    statMods: { utility: 1 }
  },
  {
    category: "Creature",
    value: "Arachne",
    tags: ["creature", "spider", "web", "poison"],
    moves: ["Web Snare", "Venom Bite"],
    passives: ["Can hinder movement or apply poison pressure"],
    statMods: { utility: 2, speed: 1 }
  },
  {
    category: "Creature",
    value: "Baby Dragon",
    tags: ["creature", "dragon", "fire", "young"],
    moves: ["Ember Snap", "Wing Buffet"],
    passives: ["Minor dragon-style burn pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Creature",
    value: "Black Widow",
    tags: ["creature", "spider", "venom", "assassin"],
    moves: ["Widow's Bite", "Toxic Lure"],
    passives: ["Higher poison and finisher pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Creature",
    value: "Dead Dragon",
    tags: ["creature", "dragon", "undead", "death"],
    moves: ["Rot Breath", "Death Wing"],
    passives: ["Undead dragon identity with decay pressure"],
    statMods: { attack: 2, health: 1, utility: 1 }
  },
  {
    category: "Creature",
    value: "Dead Scorpion",
    tags: ["creature", "scorpion", "undead", "poison"],
    moves: ["Rotting Sting", "Grave Skitter"],
    passives: ["Poison plus death-themed attrition"],
    statMods: { utility: 2, attack: 1 }
  },
  {
    category: "Creature",
    value: "Dragon Slayer",
    tags: ["creature", "hunter", "anti-dragon", "slayer"],
    moves: ["Slayer's Mark", "Dragon Break"],
    passives: ["Bonus pressure against dragon-tagged enemies"],
    statMods: { attack: 2, crit: 1 }
  },
  {
    category: "Creature",
    value: "Facing The Stinger",
    tags: ["creature", "sting", "threat", "survival"],
    moves: ["Brace for Sting", "Counter Venom"],
    passives: ["Improved reaction against poison or sting effects"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Creature",
    value: "Octopus",
    tags: ["creature", "sea", "grapple", "control"],
    moves: ["Tentacle Grip", "Ink Surge"],
    passives: ["Strong control and entangle identity"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Creature",
    value: "Odins Raven",
    tags: ["creature", "raven", "scout", "omens"],
    moves: ["Raven Scout", "Omen Dive"],
    passives: ["Improved information, scouting, or foresight flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Creature",
    value: "Wolfgang",
    tags: ["creature", "wolf", "pack", "feral"],
    moves: ["Pack Rush", "Feral Tear"],
    passives: ["Pack-style aggression and pursuit pressure"],
    statMods: { attack: 1, speed: 1 }
  },
  {
    category: "Creature",
    value: "Wolfskin",
    tags: ["creature", "wolf", "hide", "predator"],
    moves: ["Skin Shift", "Predator's Pounce"],
    passives: ["Predatory aggression with survivability flavor"],
    statMods: { attack: 1, health: 1 }
  },
,

  // =========================
  // FACTION
  // =========================

  {
    category: "Faction",
    value: "Bronze Guardians",
    tags: ["faction", "bronze", "guardians", "tempo", "discipline"],
    moves: ["Guardian Stand", "Bronze Advance"],
    passives: ["Balanced protection and steady pressure"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Faction",
    value: "Gods",
    tags: ["faction", "divine", "mythic", "transcendent"],
    moves: ["Divine Presence", "Mythic Edict"],
    passives: ["Elevated mythic scaling and special-rule pressure"],
    statMods: { utility: 3, health: 1 },
    special: true
  },
  {
    category: "Faction",
    value: "Golden Sovereigns",
    tags: ["faction", "gold", "royal", "authority"],
    moves: ["Sovereign Order", "Golden Decree"],
    passives: ["High-status command and value-oriented control"],
    statMods: { utility: 2, health: 1 }
  },
  {
    category: "Faction",
    value: "Iron Defenders",
    tags: ["faction", "iron", "defense", "fortitude"],
    moves: ["Iron Wall", "Defender's March"],
    passives: ["Strong defensive structure and frontline resilience"],
    statMods: { armor: 2, health: 1 }
  },
  {
    category: "Faction",
    value: "Silver Sentinels",
    tags: ["faction", "silver", "precision", "watchers"],
    moves: ["Sentinel Watch", "Silver Strike"],
    passives: ["Sharper precision and reactive battlefield control"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Faction",
    value: "Stone Keepers",
    tags: ["faction", "stone", "endurance", "fortress"],
    moves: ["Stoneform", "Keeper's Hold"],
    passives: ["Heavy durability and grounded sustain identity"],
    statMods: { armor: 2, health: 1 }
  },
,
  // =========================
  // MOUTH
  // =========================

  {
    category: "Mouth",
    value: "666 Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Alien Attack",
    tags: ["mouth", "tech", "alien", "hybrid"],
    moves: ["Synthetic Voice", "Mechanical Threat"],
    passives: ["Adds synthetic, tech, or alien intimidation"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "All Gums",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "ATM",
    tags: ["mouth", "tech", "alien", "hybrid"],
    moves: ["Synthetic Voice", "Mechanical Threat"],
    passives: ["Adds synthetic, tech, or alien intimidation"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Beard Of Flames",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "Blunt",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Broken Sword",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Bullet",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Cigar",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Creep",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Creepers",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Crypt Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Crypt Mjolnir",
    tags: ["mouth", "tech", "alien", "hybrid"],
    moves: ["Synthetic Voice", "Mechanical Threat"],
    passives: ["Adds synthetic, tech, or alien intimidation"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Dagger",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Dead Money",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Dead Protector",
    tags: ["mouth", "mask", "defense", "concealment"],
    moves: ["Masked Threat", "Hidden Intent"],
    passives: ["Improves concealment, survival, or battle-read disruption"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Dead Protectors Mask",
    tags: ["mouth", "mask", "defense", "concealment"],
    moves: ["Masked Threat", "Hidden Intent"],
    passives: ["Improves concealment, survival, or battle-read disruption"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Death Blow",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Diamond Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Double Blunts",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Double Joint",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Elven Dagger",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Fangs",
    tags: ["mouth", "bite", "drain", "predator"],
    moves: ["Predator Bite", "Drain Fang"],
    passives: ["Adds lifesteal, bite, or predator pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Flash Diamond",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Flash Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Four Twenty",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Friday Night Lights",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "Gold Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Gone Nuclear",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Grenade",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Hands Of Death",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Joint",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Katana",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Lightsaber",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Loki Sceptor",
    tags: ["mouth", "tech", "alien", "hybrid"],
    moves: ["Synthetic Voice", "Mechanical Threat"],
    passives: ["Adds synthetic, tech, or alien intimidation"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Mace Skull",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Minoru Sceptor",
    tags: ["mouth", "tech", "alien", "hybrid"],
    moves: ["Synthetic Voice", "Mechanical Threat"],
    passives: ["Adds synthetic, tech, or alien intimidation"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Missing Teeth",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Missing Tooth",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Nailed It",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "Nesferatu",
    tags: ["mouth", "bite", "drain", "predator"],
    moves: ["Predator Bite", "Drain Fang"],
    passives: ["Adds lifesteal, bite, or predator pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "None",
    tags: ["mouth", "plain", "baseline"],
    moves: ["Set Jaw", "Stay Quiet"],
    passives: ["Minimal mouth bonus; baseline intimidation only"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "Normal Teeth",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Pearls",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Pipe",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Racers Mask",
    tags: ["mouth", "mask", "defense", "concealment"],
    moves: ["Masked Threat", "Hidden Intent"],
    passives: ["Improves concealment, survival, or battle-read disruption"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Radiation Mask",
    tags: ["mouth", "mask", "defense", "concealment"],
    moves: ["Masked Threat", "Hidden Intent"],
    passives: ["Improves concealment, survival, or battle-read disruption"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Rainbow Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Razor Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Red Arrow",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Red Rose",
    tags: ["mouth", "style", "expression", "weird"],
    moves: ["Wild Expression", "Styled Threat"],
    passives: ["Adds expressive or weird-pressure utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Robotic",
    tags: ["mouth", "tech", "alien", "hybrid"],
    moves: ["Synthetic Voice", "Mechanical Threat"],
    passives: ["Adds synthetic, tech, or alien intimidation"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Royal Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Saurons Mace",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Single Tooth",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Skull Eats Skull",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Skull Teeth",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Skull Teeth Glow",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Smoke Bomb",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Smoked Out",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Spliff",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Stiched",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "Sting",
    tags: ["mouth", "bite", "drain", "predator"],
    moves: ["Predator Bite", "Drain Fang"],
    passives: ["Adds lifesteal, bite, or predator pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Stitched Mouth",
    tags: ["mouth", "damaged", "grim", "survival"],
    moves: ["Broken Snarl", "Scarred Breath"],
    passives: ["Adds damaged-survivor pressure and grim flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Stitched Up",
    tags: ["mouth", "damaged", "grim", "survival"],
    moves: ["Broken Snarl", "Scarred Breath"],
    passives: ["Adds damaged-survivor pressure and grim flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Stormbreaker",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "Sword Of Heaven",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  },
  {
    category: "Mouth",
    value: "The Creep",
    tags: ["mouth", "death", "dark", "fear"],
    moves: ["Death Grin", "Grave Mockery"],
    passives: ["Adds fear, death-pressure, or grim intimidation"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "The Fixer",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "The Hobbit Sting Sword",
    tags: ["mouth", "bite", "drain", "predator"],
    moves: ["Predator Bite", "Drain Fang"],
    passives: ["Adds lifesteal, bite, or predator pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Tongue Out",
    tags: ["mouth", "style", "expression", "weird"],
    moves: ["Wild Expression", "Styled Threat"],
    passives: ["Adds expressive or weird-pressure utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Under Pressure",
    tags: ["mouth", "expression"],
    moves: ["Snarl", "Taunt"],
    passives: ["Adds mouth-based pressure or expression flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Mouth",
    value: "Vampire",
    tags: ["mouth", "bite", "drain", "predator"],
    moves: ["Predator Bite", "Drain Fang"],
    passives: ["Adds lifesteal, bite, or predator pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Warfare Mask",
    tags: ["mouth", "mask", "defense", "concealment"],
    moves: ["Masked Threat", "Hidden Intent"],
    passives: ["Improves concealment, survival, or battle-read disruption"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Wax Drip",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Wax Grill",
    tags: ["mouth", "bite", "flash", "intimidation"],
    moves: ["Flash Bite", "Golden Gnash"],
    passives: ["Adds intimidation and mouth-based pressure"],
    statMods: { crit: 1, utility: 1 }
  },
  {
    category: "Mouth",
    value: "Weed Leaf",
    tags: ["mouth", "smoke", "chaos", "haze"],
    moves: ["Smoke Veil", "Hazy Exhale"],
    passives: ["Creates haze, misdirection, or slow-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Mouth",
    value: "Yaka Arrow",
    tags: ["mouth", "weaponized", "danger", "burst"],
    moves: ["Weapon Clamp", "Fatal Snap"],
    passives: ["Adds dangerous burst or weapon-mouth threat pressure"],
    statMods: { attack: 1, crit: 1 }
  }
,
  // =========================
  // HEADWEAR
  // =========================

  {
    category: "Headwear",
    value: "420 Cap",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Adams Hand",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "All Seeing Eye",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Arachne",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Astral",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Axe",
    tags: ["headwear", "weaponized", "threat", "intimidation"],
    moves: ["Threat Display", "Loaded Presence"],
    passives: ["Improves intimidation and combat-ready pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Baby Dragon",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Bane",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Benji",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Biker",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Bio Hazard",
    tags: ["headwear", "tech", "scan", "augmented"],
    moves: ["System Uplink", "Calculated Edge"],
    passives: ["Improves technical precision and processed battlefield reads"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Bipolar",
    tags: ["headwear", "chaos", "mindgame", "weird"],
    moves: ["Wild Persona", "Unstable Signal"],
    passives: ["Adds mindgame pressure and unpredictable tempo"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Black Widow",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Bright Idea",
    tags: ["headwear", "chaos", "mindgame", "weird"],
    moves: ["Wild Persona", "Unstable Signal"],
    passives: ["Adds mindgame pressure and unpredictable tempo"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Bullet Head",
    tags: ["headwear", "tech", "scan", "augmented"],
    moves: ["System Uplink", "Calculated Edge"],
    passives: ["Improves technical precision and processed battlefield reads"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Bushido",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Headwear",
    value: "Cap",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Capone",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Card Master",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Caribbean Pirate",
    tags: ["headwear", "pirate", "rogue", "tempo"],
    moves: ["Raider's Grin", "Plunder Rush"],
    passives: ["Improves rogue tempo and opportunistic pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Chained",
    tags: ["headwear", "weaponized", "threat", "intimidation"],
    moves: ["Threat Display", "Loaded Presence"],
    passives: ["Improves intimidation and combat-ready pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Clowning Around",
    tags: ["headwear", "chaos", "mindgame", "weird"],
    moves: ["Wild Persona", "Unstable Signal"],
    passives: ["Adds mindgame pressure and unpredictable tempo"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Crystal Hawk",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Davy Jones",
    tags: ["headwear", "pirate", "rogue", "tempo"],
    moves: ["Raider's Grin", "Plunder Rush"],
    passives: ["Improves rogue tempo and opportunistic pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Dead Astronaut",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Dead Dragon",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Dead Head",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Dead Samurai",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Headwear",
    value: "Dead Scorpion",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Deadphones",
    tags: ["headwear", "tech", "scan", "augmented"],
    moves: ["System Uplink", "Calculated Edge"],
    passives: ["Improves technical precision and processed battlefield reads"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Devil Horns",
    tags: ["headwear", "demonic", "fear", "aggression"],
    moves: ["Infernal Charge", "Dread Signal"],
    passives: ["Adds fear and aggression-based pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Dragon Slayer",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Egyptian God",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Emperor",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Facing The Stinger",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Fireman",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Flaming Skull",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Fortune Teller",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Four Twenty",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Gold Miner",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Heavy Is The Head",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Hell Horns",
    tags: ["headwear", "demonic", "fear", "aggression"],
    moves: ["Infernal Charge", "Dread Signal"],
    passives: ["Adds fear and aggression-based pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Hellrazor",
    tags: ["headwear", "demonic", "fear", "aggression"],
    moves: ["Infernal Charge", "Dread Signal"],
    passives: ["Adds fear and aggression-based pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Her Hair",
    tags: ["headwear", "style", "identity", "tempo"],
    moves: ["Styled Entrance", "Signature Look"],
    passives: ["Adds style-based confidence and expression pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Her Hat",
    tags: ["headwear", "style", "identity", "tempo"],
    moves: ["Styled Entrance", "Signature Look"],
    passives: ["Adds style-based confidence and expression pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Hive Mind",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Hooded One",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Ice man",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Indian",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Jackson",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Jester",
    tags: ["headwear", "chaos", "mindgame", "weird"],
    moves: ["Wild Persona", "Unstable Signal"],
    passives: ["Adds mindgame pressure and unpredictable tempo"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "King Crown",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Leonidas",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Headwear",
    value: "Lords Crown",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Lords Crown All Around",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Lucky Death",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Marley",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Matrix Helmet",
    tags: ["headwear", "tech", "scan", "augmented"],
    moves: ["System Uplink", "Calculated Edge"],
    passives: ["Improves technical precision and processed battlefield reads"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Medieval Armour",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Headwear",
    value: "Miner",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Mohawk",
    tags: ["headwear", "style", "identity", "tempo"],
    moves: ["Styled Entrance", "Signature Look"],
    passives: ["Adds style-based confidence and expression pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Mourning",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Nailed It",
    tags: ["headwear", "weaponized", "threat", "intimidation"],
    moves: ["Threat Display", "Loaded Presence"],
    passives: ["Improves intimidation and combat-ready pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "None",
    tags: ["headwear", "plain", "baseline"],
    moves: ["Bare Head", "Stay Ready"],
    passives: ["Minimal headwear bonus; baseline presence only"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Octopus",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Odins Raven",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Old Police Hat",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "On A Dim Night",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Peaky Blinder",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Pentagram",
    tags: ["headwear", "demonic", "fear", "aggression"],
    moves: ["Infernal Charge", "Dread Signal"],
    passives: ["Adds fear and aggression-based pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Pharaohs Fortune",
    tags: ["headwear", "mystic", "foresight", "ritual"],
    moves: ["Veiled Insight", "Occult Reading"],
    passives: ["Improves foresight, ritual pressure, and hidden knowledge"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Pipe Dream",
    tags: ["headwear", "weaponized", "threat", "intimidation"],
    moves: ["Threat Display", "Loaded Presence"],
    passives: ["Improves intimidation and combat-ready pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Pirate Beanie",
    tags: ["headwear", "pirate", "rogue", "tempo"],
    moves: ["Raider's Grin", "Plunder Rush"],
    passives: ["Improves rogue tempo and opportunistic pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Pirates Life",
    tags: ["headwear", "pirate", "rogue", "tempo"],
    moves: ["Raider's Grin", "Plunder Rush"],
    passives: ["Improves rogue tempo and opportunistic pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Police Hat",
    tags: ["headwear", "worker", "order", "utility"],
    moves: ["Duty Calls", "Workmanlike Resolve"],
    passives: ["Adds practical stability and role-driven utility"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Red Indian",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Redemption",
    tags: ["headwear", "weaponized", "threat", "intimidation"],
    moves: ["Threat Display", "Loaded Presence"],
    passives: ["Improves intimidation and combat-ready pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Revolver",
    tags: ["headwear", "weaponized", "threat", "intimidation"],
    moves: ["Threat Display", "Loaded Presence"],
    passives: ["Improves intimidation and combat-ready pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Ring Of Roses",
    tags: ["headwear", "style", "identity", "tempo"],
    moves: ["Styled Entrance", "Signature Look"],
    passives: ["Adds style-based confidence and expression pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Roman Soldier",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Headwear",
    value: "Roses Are Dead",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Royalty",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Samurai",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Headwear",
    value: "Snapback",
    tags: ["headwear", "style", "identity", "tempo"],
    moves: ["Styled Entrance", "Signature Look"],
    passives: ["Adds style-based confidence and expression pressure"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Steampunk",
    tags: ["headwear", "tech", "scan", "augmented"],
    moves: ["System Uplink", "Calculated Edge"],
    passives: ["Improves technical precision and processed battlefield reads"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Tapped",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "The Brainiac",
    tags: ["headwear", "tech", "scan", "augmented"],
    moves: ["System Uplink", "Calculated Edge"],
    passives: ["Improves technical precision and processed battlefield reads"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "The Captain",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "Thunderstruck",
    tags: ["headwear", "presence"],
    moves: ["Steady Presence", "Hold Composure"],
    passives: ["Adds headwear-based status or presence flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Headwear",
    value: "Times up",
    tags: ["headwear", "chaos", "mindgame", "weird"],
    moves: ["Wild Persona", "Unstable Signal"],
    passives: ["Adds mindgame pressure and unpredictable tempo"],
    statMods: { utility: 2 }
  },
  {
    category: "Headwear",
    value: "Viking Warrior",
    tags: ["headwear", "authority", "leader", "aura"],
    moves: ["Command Presence", "Royal Decree"],
    passives: ["Improves leadership, aura pressure, and ally coordination"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Headwear",
    value: "War",
    tags: ["headwear", "demonic", "fear", "aggression"],
    moves: ["Infernal Charge", "Dread Signal"],
    passives: ["Adds fear and aggression-based pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "War Horns",
    tags: ["headwear", "demonic", "fear", "aggression"],
    moves: ["Infernal Charge", "Dread Signal"],
    passives: ["Adds fear and aggression-based pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Wolfgang",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "Wolfskin",
    tags: ["headwear", "beast", "predator", "tribal"],
    moves: ["Predator Crest", "Beast Instinct"],
    passives: ["Adds beast-linked identity and hunt pressure"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Headwear",
    value: "WW2 Ace",
    tags: ["headwear", "warrior", "discipline", "combat"],
    moves: ["Battle Focus", "Warrior's Poise"],
    passives: ["Improves disciplined combat posture and frontline resolve"],
    statMods: { attack: 1, armor: 1 }
  }
,
  // =========================
  // SKIN
  // =========================

  {
    category: "Skin",
    value: "3 Card Monty",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "3 Card Monty Rare",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "3D Future",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "3D Future Common",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "3D Future Rare",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "79 Years",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "79 Years Common",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "A Pirates Sin Common",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "A Pirates Sin Rare",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "A Pirates Sins",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ancient Warrior",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ancient Warrior Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ancient Warrior Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Anunnaki",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Anunnaki Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Anunnaki Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Astrological",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Astrological Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Astrological Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Bane Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bane Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Beautiful Disaster",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Beautiful Disaster Common",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Beautiful Disaster Rare",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Beauty Queen",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Beauty Queen Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Beauty Queen Epic",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bees And Honey",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bees And Honey Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bees And Honey Rare",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Blessed",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Blessed Common",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Blessed Rare",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bloody Death",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bloody Death Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Bloody Death Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Born Into Darkness",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Brainiac Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carved In Hell",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carved In Hell Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carved In Hell Epic",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carved In Hell Legendary",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carved In Hell Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carvings Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carvings Epic",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Carvings Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Celebrate Life",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Celebrate Life Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Celebrate Life Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Celtic Skull",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Celtic Skull Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Celtic Skull Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Chosen One Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Chosen One Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Chosen Ones",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Circle Of Life",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Circle Of Life Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Circle Of Life Epic",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Circle Of Life Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Clown",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Clown Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Clown Epic",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Clown Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Comms Down",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Comms Down Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Comms Down Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Crazy Life",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Crazy Life Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Crazy Life Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Dare Me",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Dare Me Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Dare Me Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Day Of The Dead",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Day Of The Dead Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Dollars",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Dollars Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Flowers",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Flowers Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Flowers Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead King",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead King Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead King Epic",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead King Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Man's Hand",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Mans Hand Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Mans Hand Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Money",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Money Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Money Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Patriot",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Patriot Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Queen",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Queen Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dead Queen Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Death Defines",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Death Defines Skull Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Death Defines Skull Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Death Glow",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Death Glow Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Death Glow Uncommon",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Deathglow Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Deceit",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Deceit Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Deceit Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Del Muerte",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Del Muerte Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Del Muerte Common Light",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Del Muerte Epic",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Del Muerte Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Devils Advocate",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Devils Advocate Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Devils Advocate Epic",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Devils Advocate Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Diamond",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Diamond Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Diamond Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Dollar Bill Skull Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Dragons Mother",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Dragons Mother Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Dragons Mother Epic",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Dragons Mother Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Drippy skull",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Drippy Skull Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Drippy Skull Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Enigma",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Enigma Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Enigma Epic",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Enigma Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Enslaved",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Enslaved Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Enslaved Rare",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Fast Lane",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Fast Lane Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Fast Lane Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Flair Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Flair Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Flaming Skull Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Flare",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Forsaken Throne",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Forsaken Throne Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Forsaken Throne Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Fortune Teller",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Fortune Teller Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Fortune Teller Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Four Twenty",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Four Twenty Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Four Twenty Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Frankenstein",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Frankenstein Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Frankenstein Epic",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Frankenstein Rare",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Funeral Song",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Funeral Song Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Funeral Song Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Galactic",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Galactic Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Glory In Death",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Glory In Death Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Glory In Death Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Gold Carvings",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Gold Carvings Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Gold Carvings Epic",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Gold Carvings Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Good vs Evil",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Good Vs Evil Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Good Vs Evil Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Great Britain",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Great Britain Common",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Great Britain Rare",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Guardian",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Guardian Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Guardian Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Half Human",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Half Human Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Half Human Rare",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Healer Common",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Healer Rare",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Heavens Retro",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Heavens Retro Common",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Heavens Retro Rare",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Heavy Is The Head",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hells Retro",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hells Retro Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hells Retro Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Her Beauty",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Her Beauty Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Her Beauty Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Holy",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Holy Common",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Holy Epic",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Holy Rare",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Honeycomb",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Honeycomb Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hooded One",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hooded One Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hooded One Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hybrid",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hybrid Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hybrid Epic",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Hybrid Rare",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ice Age",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Ice Age Common",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Ice Age Epic",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Ice Age Rare",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Illuminati",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Illuminati Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Illuminati Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "In Death I Hear You",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "In Death I Hear You Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "In Death I Hear You Epic",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "In Death I Hear You Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Inferno",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Inferno Common",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Inferno Rare",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Interstellar",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Interstellar Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Interstellar Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Junkyard",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Junkyard Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Junkyard Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Kill For Gold",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Kill For Gold Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Kill For Gold Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Light Of My Life",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Light Of My Life Common",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Light Of My Life Rare",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Live A Full Life",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Live A Full Life Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Living In Grief",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Living In Grief Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Living In Grief Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Long Live The King",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Long Live The King Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Long Live The King Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Lookin Glass",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lookin Glass Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lookin Glass Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost Hope",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost Hope Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost Hope Epic",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost Hope Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Lost Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Loved Fashion",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Loved Fashion Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Loved Fashion Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mad House",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mad House Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mad House Epic",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mad House Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mandala",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mandala Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mandala Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Marble Paint",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Marble Paint Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Marble Paint Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mech",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mech Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mech Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Melting",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Melting Common",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Melting Rare",
    tags: ["skin", "elemental", "aura", "energy"],
    moves: ["Elemental Hide", "Aura Pulse"],
    passives: ["Adds elemental pressure and energized body-state flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Misty Death",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Misty Death Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Misty Death Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Misunderstood",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Misunderstood Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Misunderstood Epic",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Misunderstood Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Mosaic",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Mosaic Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Mosaic Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Naked",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Naked Common",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Naked Minds",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Naked Minds Common",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Naked Minds Epic",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Naked Minds Rare",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "Naked Rare",
    tags: ["skin", "baseline", "human", "fragile"],
    moves: ["Raw Form", "Human Resolve"],
    passives: ["More exposed body-state with lighter bonuses"],
    statMods: { health: 1, speed: 1 }
  },
  {
    category: "Skin",
    value: "No Remorse",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "No Remorse Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "No Remorse Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Not King Nor Queen",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Not King Nor Queen Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Not King Nor Queen Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "One Shot One Kill",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "One Shot One Kill Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "One Shot One Kill Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ornate",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Ornate Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Ornate Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Peace Of Mind",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Peace Of Mind Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Piece Of Mind Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Pop Art",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Pop Art Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Pop Art Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Praise",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Praise Common",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Praise Rare",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Punishment",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Punishment Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Punishment Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Pure Evil",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Pure Evil Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Pure Evil Epic",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Pure Evil Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Pushing Daisies Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Pushing Daisies Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Pushing Up Daisies",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Red Rose Skull Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Red Roses Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Rekt Skull",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Rekt Skull Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Rekt Skull Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Roses",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Rotting Flesh",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Rotting Flesh Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Rotting Flesh Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Round Table",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Round Table Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Round Table Epic",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Round Table Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ruined",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ruined Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Ruined Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Serial Killer",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Serial Killer Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Serial Killer Legendary",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Serial Killer Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Shrouded",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Shrouded Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Shrouded Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Sins Of Man",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Skull In Skulls Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Skull In Skulls Epic",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Skull In Skulls Legendary",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Skull In Skulls Rare",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Skulls in Skulls",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "Slave Master",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Slave Master Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Slave Master Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Sleek",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Sleek Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Sleek Rare",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Smooth Operator",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Smooth Operator Common",
    tags: ["skin", "style", "elegance", "confidence"],
    moves: ["Polished Form", "Elegant Poise"],
    passives: ["Adds refined confidence and smooth tempo presence"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Sound Of Death",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Sound Of Death Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Sound Of Death Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Sovereign Of Shadows",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Sovereign Of Shadows Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Sovereign Of Shadows Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spiders Web",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spiderweb Common",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spiderweb Rare",
    tags: ["skin", "mutated", "creature", "hybrid"],
    moves: ["Mutant Skin", "Hybrid Shift"],
    passives: ["Adds mutated-body resilience and creature pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spiteful",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spiteful Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spiteful Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spreading Evil",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spreading Evil Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Spreading Evil Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Take Me To Hell",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Take Me To Hell Common",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Take Me To Hell Rare",
    tags: ["skin", "dark", "corruption", "pain"],
    moves: ["Infernal Husk", "Death-Touched Form"],
    passives: ["Adds corruption, pain, and attrition pressure"],
    statMods: { attack: 1, health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Techno",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Techno Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Techno Epic",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Techno Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "The Cog Turns Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "The Cogs Turn",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "The Cogs Turn Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "The Dead Patriot Common",
    tags: ["skin", "undead", "grave", "grim"],
    moves: ["Graveform", "Bone Endurance"],
    passives: ["Adds undead resilience and grave-flavored endurance"],
    statMods: { health: 2, armor: 1 }
  },
  {
    category: "Skin",
    value: "The Hairdresser",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "The Hairdresser Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "The Hairdresser Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "The Healer",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Three Card Monty Rare",
    tags: ["skin", "rogue", "fortune", "risk"],
    moves: ["Risked Skin", "Gambler's Poise"],
    passives: ["Adds high-risk pressure and opportunistic play flavor"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Time Is All We Have",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Time Is All We Have Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Time Is All We Have Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Trapped",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Trapped Common",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Trapped Rare",
    tags: ["skin", "mind", "suffering", "shadow"],
    moves: ["Fractured Skin", "Shadow Wear"],
    passives: ["Adds suffering, deception, or shadow-state resilience"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unplugged",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unplugged Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unplugged Epic",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unplugged Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unwind my Fate",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unwind My Fate Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Unwind My Fate Epic",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Visiting Earth",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Visiting Earth Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Visiting Earth Epic",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Visiting Earth Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Warrior",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Warrior Common",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Warrior Rare",
    tags: ["skin", "royal", "warrior", "command"],
    moves: ["Royal Bearing", "Warrior's Shell"],
    passives: ["Improves disciplined durability and leadership presence"],
    statMods: { health: 1, armor: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Wisdom",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Wisdom Common",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Wisdom Rare",
    tags: ["skin", "holy", "renewal", "preserve"],
    moves: ["Holy Renewal", "Blessed Guard"],
    passives: ["Improves sustain, healing flavor, and stabilising pressure"],
    statMods: { health: 2, utility: 1 }
  },
  {
    category: "Skin",
    value: "Witching Hour",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Witching Hour Common",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Witching Hour Rare",
    tags: ["skin", "body"],
    moves: ["Endure", "Hold Form"],
    passives: ["Adds body-state resilience and identity flavor"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Skin",
    value: "Year 4023",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Year 4023 Common",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Year 4023 Rare",
    tags: ["skin", "tech", "synthetic", "adaptive"],
    moves: ["Synthetic Shell", "System Shift"],
    passives: ["Improves adaptive defense and technical resilience"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Yes or No",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Yes Or No Common",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Skin",
    value: "Yes Or No Rare",
    tags: ["skin", "fate", "time", "mystic"],
    moves: ["Fate Skin", "Temporal Sheath"],
    passives: ["Adds mystic foresight and temporal defense flavor"],
    statMods: { health: 1, utility: 2 }
  }
,
  // =========================
  // ARTIFACTS
  // =========================

  {
    category: "Artifacts",
    value: "Arcane Orb",
    tags: ["artifacts", "arcane", "focus", "channel"],
    moves: ["Orb Pulse", "Arcane Channel"],
    passives: ["Improves arcane focus and ranged utility"],
    statMods: { utility: 3 }
  },
  {
    category: "Artifacts",
    value: "Bong Of Protection",
    tags: ["artifacts", "smoke", "protection", "haze"],
    moves: ["Protective Haze", "Cloud Guard"],
    passives: ["Adds haze-based protection and disruption"],
    statMods: { armor: 1, utility: 2 }
  },
  {
    category: "Artifacts",
    value: "Grimoire",
    tags: ["artifacts", "spellbook", "ritual", "knowledge"],
    moves: ["Forbidden Page", "Dark Reading"],
    passives: ["Adds ritual, knowledge, and spell-like utility"],
    statMods: { health: 1, utility: 3 }
  },
  {
    category: "Artifacts",
    value: "Jet Pack",
    tags: ["artifacts", "mobility", "tech", "burst"],
    moves: ["Lift Off", "Sky Dash"],
    passives: ["Improves movement and vertical burst mobility"],
    statMods: { speed: 2, utility: 1 }
  },
  {
    category: "Artifacts",
    value: "None",
    tags: ["artifacts", "plain", "baseline"],
    moves: ["Hold Steady", "Stay Grounded"],
    passives: ["No artifact bonus"],
    statMods: { utility: 1 }
  },
  {
    category: "Artifacts",
    value: "Wings",
    tags: ["artifacts", "flight", "mobility", "grace"],
    moves: ["Wing Guard", "Aerial Rise"],
    passives: ["Adds flight-like mobility and evasive pressure"],
    statMods: { speed: 1, utility: 2 }
  }
,
  // =========================
  // METAVERSE
  // =========================

  {
    category: "Metaverse",
    value: "Adams Hand",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "All Seeing Eye",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Astral",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Axe",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Bane",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Benji",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Biker",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "BioHazard",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Bipolar",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Bright Idea",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Bullet",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Bullet Head",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Bushido",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "Caribbean Pirate",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Crystal Hawk",
    tags: ["metaverse", "elemental", "energy", "burst"],
    moves: ["Element Shift", "Storm Frame"],
    passives: ["Adds elemental energy and burst-style metaverse pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Davy Jones",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Dead Astronaut",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Dead Head",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Dead Phones",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Deadphones",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Dead Samurai",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "Devil Horns",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Egyptian God",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Fortune Teller",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Gold Miner",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Heavy Is The Head",
    tags: ["metaverse", "authority", "leadership", "status"],
    moves: ["World Command", "Crown Signal"],
    passives: ["Improves leadership and status pressure across the board"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Hell Horns",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Hellrazor",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Her Hair",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Hive Mind",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Hooded One",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Hooded Ones",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Ice Man",
    tags: ["metaverse", "elemental", "energy", "burst"],
    moves: ["Element Shift", "Storm Frame"],
    passives: ["Adds elemental energy and burst-style metaverse pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Jackson",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Kings Crown",
    tags: ["metaverse", "authority", "leadership", "status"],
    moves: ["World Command", "Crown Signal"],
    passives: ["Improves leadership and status pressure across the board"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Leonidas",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "Marley",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Matrix Helmet",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Medieval Armour",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "Mourning",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Nailed It",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "None",
    tags: ["metaverse", "plain", "baseline"],
    moves: ["Stay Present", "Hold Layer"],
    passives: ["No metaverse bonus"],
    statMods: { utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Old Police Hat",
    tags: ["metaverse", "elemental", "energy", "burst"],
    moves: ["Element Shift", "Storm Frame"],
    passives: ["Adds elemental energy and burst-style metaverse pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "On A Dim Night",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Peaky",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Pentagram",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Pharaohs Fortune",
    tags: ["metaverse", "mystic", "ritual", "foresight"],
    moves: ["Occult Phase", "Fate Signal"],
    passives: ["Adds ritual, foresight, and occult control"],
    statMods: { utility: 3 }
  },
  {
    category: "Metaverse",
    value: "Pipe Dream",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Pirate Beanie",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Pirates Life",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Police Hat",
    tags: ["metaverse", "elemental", "energy", "burst"],
    moves: ["Element Shift", "Storm Frame"],
    passives: ["Adds elemental energy and burst-style metaverse pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Red Indian",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Redemption",
    tags: ["metaverse", "dark", "fear", "death"],
    moves: ["Hell Phase", "Death Echo"],
    passives: ["Adds fear, death pressure, and hostile identity effects"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Revolver",
    tags: ["metaverse", "rogue", "tempo", "threat"],
    moves: ["Rogue Shift", "Outlaw Pressure"],
    passives: ["Improves tempo, threat projection, and opportunistic attacks"],
    statMods: { speed: 1, utility: 1 }
  },
  {
    category: "Metaverse",
    value: "Ring Of Roses",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Roman Soldier",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "Royalty",
    tags: ["metaverse", "authority", "leadership", "status"],
    moves: ["World Command", "Crown Signal"],
    passives: ["Improves leadership and status pressure across the board"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Samurai",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "Snapback",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Snapbacks",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Steampunk",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Tapped",
    tags: ["metaverse", "persona", "chaos", "style"],
    moves: ["Persona Shift", "Mood Swing"],
    passives: ["Adds style, unpredictability, and expression-driven utility"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "The Brainiac",
    tags: ["metaverse", "tech", "augmented", "system"],
    moves: ["System Sync", "Neural Uplink"],
    passives: ["Improves technical precision and processed control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "The Captain",
    tags: ["metaverse", "authority", "leadership", "status"],
    moves: ["World Command", "Crown Signal"],
    passives: ["Improves leadership and status pressure across the board"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Thunderstruck",
    tags: ["metaverse", "elemental", "energy", "burst"],
    moves: ["Element Shift", "Storm Frame"],
    passives: ["Adds elemental energy and burst-style metaverse pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Times Up",
    tags: ["metaverse", "identity"],
    moves: ["Shift Phase", "Digital Echo"],
    passives: ["Adds metaverse identity and cross-world pressure"],
    statMods: { utility: 2 }
  },
  {
    category: "Metaverse",
    value: "Viking Warrior",
    tags: ["metaverse", "authority", "leadership", "status"],
    moves: ["World Command", "Crown Signal"],
    passives: ["Improves leadership and status pressure across the board"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Metaverse",
    value: "War",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "War Horns",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  },
  {
    category: "Metaverse",
    value: "WW2 Ace",
    tags: ["metaverse", "warrior", "discipline", "combat"],
    moves: ["Battle Protocol", "Honor Drive"],
    passives: ["Improves disciplined combat and battle-read pressure"],
    statMods: { attack: 1, armor: 1 }
  }
,
  // =========================
  // BACKGROUND
  // =========================

  {
    category: "Background",
    value: "Absent A Capella",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Black",
    tags: ["background", "void", "blank", "neutral"],
    moves: ["Void Backdrop", "Dark Canvas"],
    passives: ["Neutral darkness that slightly sharpens focus and intimidation"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Botanic Haven",
    tags: ["background", "nature", "growth", "decay"],
    moves: ["Wild Spread", "Rooted Ground"],
    passives: ["Adds natural growth or decay-based field effects"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Chrono Cascade",
    tags: ["background", "time", "distortion", "foresight"],
    moves: ["Temporal Field", "Cascade Shift"],
    passives: ["Adds temporal shaping, delay, or foresight pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Background",
    value: "Cobblestone Echoes",
    tags: ["background", "urban", "terrain", "structure"],
    moves: ["Urban Cover", "Concrete Hold"],
    passives: ["Adds structured terrain utility and grounded control"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Concrete Canvas",
    tags: ["background", "urban", "terrain", "structure"],
    moves: ["Urban Cover", "Concrete Hold"],
    passives: ["Adds structured terrain utility and grounded control"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Corridor Of Time",
    tags: ["background", "time", "distortion", "foresight"],
    moves: ["Temporal Field", "Cascade Shift"],
    passives: ["Adds temporal shaping, delay, or foresight pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Background",
    value: "Crimson Rift",
    tags: ["background", "gem", "luxury", "resonance"],
    moves: ["Gem Resonance", "Jeweled Aura"],
    passives: ["Adds premium aura pressure and refined field presence"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Cursed Crops",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Dantes Monument",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Deathly Shadows",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Demonic Wasteland",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Dungeon Passage",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Eternal Rest",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Eternal Torment",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Faded Frontier",
    tags: ["background", "urban", "terrain", "structure"],
    moves: ["Urban Cover", "Concrete Hold"],
    passives: ["Adds structured terrain utility and grounded control"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Fogveil Alley",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Forgotten Streets",
    tags: ["background", "urban", "terrain", "structure"],
    moves: ["Urban Cover", "Concrete Hold"],
    passives: ["Adds structured terrain utility and grounded control"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Fractured Vessel",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Fungal Dreamscape",
    tags: ["background", "nature", "growth", "decay"],
    moves: ["Wild Spread", "Rooted Ground"],
    passives: ["Adds natural growth or decay-based field effects"],
    statMods: { health: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Ghost Deck",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Hellfire Gorge",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Hells Pinnacle",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Imperial Requiem",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Mad Scientists Lab",
    tags: ["background", "urban", "terrain", "structure"],
    moves: ["Urban Cover", "Concrete Hold"],
    passives: ["Adds structured terrain utility and grounded control"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Quantum Mechanica",
    tags: ["background", "time", "distortion", "foresight"],
    moves: ["Temporal Field", "Cascade Shift"],
    passives: ["Adds temporal shaping, delay, or foresight pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Background",
    value: "Rebel Walls",
    tags: ["background", "urban", "terrain", "structure"],
    moves: ["Urban Cover", "Concrete Hold"],
    passives: ["Adds structured terrain utility and grounded control"],
    statMods: { armor: 1, utility: 1 }
  },
  {
    category: "Background",
    value: "Ringleaders Reign",
    tags: ["background", "environment"],
    moves: ["Field Presence", "Set the Scene"],
    passives: ["Adds environmental pressure and passive board flavor"],
    statMods: { utility: 1 }
  },
  {
    category: "Background",
    value: "Sealed Depths",
    tags: ["background", "sea", "zone", "pressure"],
    moves: ["Tidal Zone", "Depth Surge"],
    passives: ["Adds sea-control, pull, and zone pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Silent Tombs",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Skull Dust Sanctuary",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Skull Island",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Cyan",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke DarkGreen",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke DarkPurple",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Green",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Orange",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Pink",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Purple",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Red",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smoke Yellow",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Canary Diamond",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Emerald",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Fire Opel",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Gold",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Lavendar Quartz",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Onyx",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Ruby",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Silver",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Topaz",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Smokey Yellow",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Spiral Descent",
    tags: ["background", "time", "distortion", "foresight"],
    moves: ["Temporal Field", "Cascade Shift"],
    passives: ["Adds temporal shaping, delay, or foresight pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Background",
    value: "The Hollow",
    tags: ["background", "obscure", "haze", "concealment"],
    moves: ["Obscuring Field", "Veil Drift"],
    passives: ["Improves concealment, misdirection, and soft control"],
    statMods: { utility: 2 }
  },
  {
    category: "Background",
    value: "Tidal Divide",
    tags: ["background", "sea", "zone", "pressure"],
    moves: ["Tidal Zone", "Depth Surge"],
    passives: ["Adds sea-control, pull, and zone pressure"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Tombstone Path",
    tags: ["background", "dark", "grave", "curse"],
    moves: ["Grave Terrain", "Torment Pulse"],
    passives: ["Adds curse, grave, and hostile battlefield pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Background",
    value: "Whispering Stones",
    tags: ["background", "nature", "growth", "decay"],
    moves: ["Wild Spread", "Rooted Ground"],
    passives: ["Adds natural growth or decay-based field effects"],
    statMods: { health: 1, utility: 1 }
  }
,
  // =========================
  // EYE
  // =========================

  {
    category: "Eye",
    value: "Sharp",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "I See Dead People",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Unseen Death",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lightning",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Piercing",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "I Made A Mistake",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Around The World",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Endless Void",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Facing Death",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Hells Gateway",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Ancient History",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Imprisoned",
    tags: ["eye", "stealth", "obscure", "control"],
    moves: ["Obscuring Look", "Shadow Veil"],
    passives: ["Harder to read and better at disruption through concealment"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Naked",
    tags: ["eye", "plain", "baseline"],
    moves: ["Plain Sight", "Stay Sharp"],
    passives: ["Minimal eye bonus; baseline awareness only"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Leave Me Alone",
    tags: ["eye", "stealth", "obscure", "control"],
    moves: ["Obscuring Look", "Shadow Veil"],
    passives: ["Harder to read and better at disruption through concealment"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Life Through A Broken Lense",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Till Death Do Us Part",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Grieving Widow",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "The Creeper",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Life Is Hell",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "In Lucifer We Trust",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Moonshot",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "The Fly",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Escaping Darkness",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Hugin And Munin",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "The High Life",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Times Up",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Soldiers Pain",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Trapped",
    tags: ["eye", "stealth", "obscure", "control"],
    moves: ["Obscuring Look", "Shadow Veil"],
    passives: ["Harder to read and better at disruption through concealment"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Explorer",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lost Childhood",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Unimaginable",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Crypt Coin",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Popeye",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Light Up My Life",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Oh Beehave",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Vinyl",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Fantasy Glow",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Spider",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Double Snake",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "None",
    tags: ["eye", "plain", "baseline"],
    moves: ["Plain Sight", "Stay Sharp"],
    passives: ["Minimal eye bonus; baseline awareness only"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Half Moon",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Self Reflection",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Robotic",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Dystopia",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Neon",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Smokey",
    tags: ["eye", "stealth", "obscure", "control"],
    moves: ["Obscuring Look", "Shadow Veil"],
    passives: ["Harder to read and better at disruption through concealment"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Mad Scientist",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Temporal Rift",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lizards Eyes",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Heavens Gateway",
    tags: ["eye", "holy", "protection", "judgment"],
    moves: ["Holy Vision", "Judgment Beam"],
    passives: ["Adds holy protection and judgment-style pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Faiths Guardian",
    tags: ["eye", "holy", "protection", "judgment"],
    moves: ["Holy Vision", "Judgment Beam"],
    passives: ["Adds holy protection and judgment-style pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Soul Cry",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Devilish Sight",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Kheper",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Eye",
    tags: ["eye", "plain", "baseline"],
    moves: ["Plain Sight", "Stay Sharp"],
    passives: ["Minimal eye bonus; baseline awareness only"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Snake",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Contagion",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Death Stare",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Jarvis",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "The Dons M-Frames",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Neon Skull And Cross",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Time Warp",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Love Eyes",
    tags: ["eye", "charm", "emotion", "control"],
    moves: ["Charm Gaze", "Heart Snare"],
    passives: ["Adds charm-style control and emotional disruption"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Looking Into The Future",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Honey",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Silver",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "VR",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Cats Eyes",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Machine Gun Eye",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Specs",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Deadeye",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Side Skulls",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Eye Patch",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Gold",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Skulls",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Magic Mushroom",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Ruby",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Eye See All",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Shady",
    tags: ["eye", "stealth", "obscure", "control"],
    moves: ["Obscuring Look", "Shadow Veil"],
    passives: ["Harder to read and better at disruption through concealment"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Time Reversed",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Emerald",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "One Eye",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Canary Diamond",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Brown Jasper",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Topaz",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Dragons",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Pink Sapphire",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Four Twenty",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Weed",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Lavendar Quartz",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Revolver",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "See No Evil",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Eyes",
    tags: ["eye", "plain", "baseline"],
    moves: ["Plain Sight", "Stay Sharp"],
    passives: ["Minimal eye bonus; baseline awareness only"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Tech Moncocle",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Burning Desire",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Dragon Eyes",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Supernova",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Wow",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Demon Through A Lens",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Earths Core",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Sunflare",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Triple Geek Eyes",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Nighvision",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Flame Eyes",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "The Talk",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Winter Vortex",
    tags: ["eye", "ice", "slow", "control"],
    moves: ["Frozen Sight", "Glacial Lock"],
    passives: ["Can slow or hinder enemies through cold-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Skull V Skull",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "One Eyed Willy",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Wandering Souls",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Split The Atom",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Fire Nuggets",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Enter The Dragon",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Blazin",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Plugged Into The Matrix",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Eternal Rings",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Eternal Glow",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Bloodshot",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Electrified",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Dragons Spirit",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Icicle Explosion",
    tags: ["eye", "ice", "slow", "control"],
    moves: ["Frozen Sight", "Glacial Lock"],
    passives: ["Can slow or hinder enemies through cold-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Little And Large",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Bloodshot Steampunk",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Dragon Fruit",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Steampunk Tech",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Reflections Of The Past",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Magma Pool",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Aura",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Android",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Beehive",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Fire And Ice",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Skeletons Scream",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Droopy Right",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Ancient Classics",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Thermal Detonation",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Cheshire Cat",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Magma Spirit",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Time Is Short",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Atomic Bombs",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lightning Staff",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Tractor Beam",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Marley",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Dragons Roar",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Futuristic Goggles",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Demon Cat",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Pieces Of Eight",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Android Ruby",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Dead Knight",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Troll",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Owls Perspective",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lasers Burn",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Blue Lightning",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Damien",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lonely",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Ice Blast",
    tags: ["eye", "ice", "slow", "control"],
    moves: ["Frozen Sight", "Glacial Lock"],
    passives: ["Can slow or hinder enemies through cold-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Knife Eye",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Bullet Holes",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Tech Nerd",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Acid",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Skeletor",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Ice Shots",
    tags: ["eye", "ice", "slow", "control"],
    moves: ["Frozen Sight", "Glacial Lock"],
    passives: ["Can slow or hinder enemies through cold-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Lightyears",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Serpents",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "The Journey Begins",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Happy Hearts",
    tags: ["eye", "charm", "emotion", "control"],
    moves: ["Charm Gaze", "Heart Snare"],
    passives: ["Adds charm-style control and emotional disruption"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Piece Of The Puzzle",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Hands Of Power",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Sunfire",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Hooded Sillouette",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Daggers To The Soul",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "T1 vs T2",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Demons Trilogy",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Hot Beehive",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Silver Dragons",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Atlantis",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Ruby Ethereum",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Poison Charge",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Portals",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Magic Cross",
    tags: ["eye", "holy", "protection", "judgment"],
    moves: ["Holy Vision", "Judgment Beam"],
    passives: ["Adds holy protection and judgment-style pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Swords Of Protection",
    tags: ["eye", "holy", "protection", "judgment"],
    moves: ["Holy Vision", "Judgment Beam"],
    passives: ["Adds holy protection and judgment-style pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Baby Demon",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Demons Dance",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Harps Of Nature",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Tarantulas",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Wings Of Lightning",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "The Trees Have Eyes",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Blood",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Compass",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Swordmakers View",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Sorcerer",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Sorcery",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Side Eye",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Werewolf",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Vortex",
    tags: ["eye", "time", "foresight", "distortion"],
    moves: ["Future Sight", "Temporal Glitch"],
    passives: ["Adds foresight and turn-shaping control"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Cyclops",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Burnt Out Cyclops",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Plasma",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Valadium Cross",
    tags: ["eye", "holy", "protection", "judgment"],
    moves: ["Holy Vision", "Judgment Beam"],
    passives: ["Adds holy protection and judgment-style pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "EMP Grenade",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Harry Under The Stairs",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Flowers Of Ice",
    tags: ["eye", "ice", "slow", "control"],
    moves: ["Frozen Sight", "Glacial Lock"],
    passives: ["Can slow or hinder enemies through cold-pressure effects"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Heat",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Goetia",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Twin Peaks",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Rings Of Focus",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Baseball",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "I See You",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Honeycomb",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Fish Eyes",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Visions Of Fate",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Cobweb",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Through Hazy Eyes",
    tags: ["eye", "stealth", "obscure", "control"],
    moves: ["Obscuring Look", "Shadow Veil"],
    passives: ["Harder to read and better at disruption through concealment"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Wayfarers",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Knowledge",
    tags: ["eye", "mythic", "beast", "sight"],
    moves: ["Ancient Sight", "Predator Mark"],
    passives: ["Improves mythic scouting and aerial hunting pressure"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Heavens Door",
    tags: ["eye", "holy", "protection", "judgment"],
    moves: ["Holy Vision", "Judgment Beam"],
    passives: ["Adds holy protection and judgment-style pressure"],
    statMods: { health: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Hades",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Snakes Hiss",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Traders Tech",
    tags: ["eye", "tech", "scan", "precision"],
    moves: ["Target Scan", "Machine Lock"],
    passives: ["Improves precision and system-level targeting"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Giant",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Diamond Cross",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Dual Snakes",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Plasma Power",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Aztec Dial",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Budding Ambition",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Mad Professor",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Steampunk Solutions",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Electro",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Ancient Insight",
    tags: ["eye", "precision", "foresight", "awareness"],
    moves: ["Keen Sight", "Deadeye Read"],
    passives: ["Improves precision and information advantage"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Smouldering Death",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Fairy",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Vipers Rise",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Lightning Strikes",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Hearts Desire",
    tags: ["eye", "charm", "emotion", "control"],
    moves: ["Charm Gaze", "Heart Snare"],
    passives: ["Adds charm-style control and emotional disruption"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Dead Hypnotist",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Fireborn",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Virtual Insanity",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Latte Art",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Alloys",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Stoner",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Rainbow Magic Mushrooms",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Urchins",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Creatures Scream",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Explosive",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Geode",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Alien Glow",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Gold Coins",
    tags: ["eye", "wealth", "focus", "value"],
    moves: ["Gem Focus", "Treasure Sight"],
    passives: ["Adds value-oriented focus and premium precision"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Tempus Fugit",
    tags: ["eye", "energy", "shock", "burst"],
    moves: ["Voltage Sight", "Static Burst"],
    passives: ["Adds shock-style pressure and faster burst reads"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Death Rider",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "All Eyez On Me",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Volcano View",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Skull Based Cross",
    tags: ["eye", "dark", "death", "curse"],
    moves: ["Death Stare", "Soul Mark"],
    passives: ["Applies death-pressure and curse-like control"],
    statMods: { crit: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Maskerade",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Sunset Dreams",
    tags: ["eye", "fire", "burn", "pressure"],
    moves: ["Burning Gaze", "Sunflare Pulse"],
    passives: ["Adds burn pressure and aggressive threat projection"],
    statMods: { attack: 1, utility: 1 }
  },
  {
    category: "Eye",
    value: "Shadey",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Tweaters",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Saw",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Hypnotise",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "On A Trip",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Trons veil",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Neural Connections",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "Scarabs",
    tags: ["eye", "beast", "poison", "predator"],
    moves: ["Predator Glare", "Venom Focus"],
    passives: ["Adds poison, hunt, or beast-pressure identity"],
    statMods: { speed: 1, utility: 2 }
  },
  {
    category: "Eye",
    value: "Bong O Bongo",
    tags: ["eye", "chaos", "weird", "distortion"],
    moves: ["Warped Vision", "Psychedelic Glare"],
    passives: ["Can create unstable or randomised pressure"],
    statMods: { utility: 3 }
  },
  {
    category: "Eye",
    value: "Hearts Trap",
    tags: ["eye", "charm", "emotion", "control"],
    moves: ["Charm Gaze", "Heart Snare"],
    passives: ["Adds charm-style control and emotional disruption"],
    statMods: { utility: 2 }
  },
  {
    category: "Eye",
    value: "Swords Of Light",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "The Ring",
    tags: ["eye", "vision"],
    moves: ["Focus Gaze", "Read Intent"],
    passives: ["Improved target awareness"],
    statMods: { utility: 1 }
  },
  {
    category: "Eye",
    value: "I See Your Heart",
    tags: ["eye", "charm", "emotion", "control"],
    moves: ["Charm Gaze", "Heart Snare"],
    passives: ["Adds charm-style control and emotional disruption"],
    statMods: { utility: 2 }
  }

];
