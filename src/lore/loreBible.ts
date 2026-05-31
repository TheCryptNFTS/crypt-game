export type CanonStatus = "working" | "locked";

export type LoreEntry = {
  id: string;
  title: string;
  summary: string;
  pillars: string[];
  motifs: string[];
  canonicalStatus: CanonStatus;
};

export const WORLD_LORE: LoreEntry[] = [
  {
    id: "planet_rekt",
    title: "Planet REKT",
    summary:
      "A refuge-world built from the remains of burned charts, discarded assets, broken conviction, and post-hype survivors. Value here is forged after collapse, not before it.",
    pillars: [
      "survival after wipeout",
      "status earned through scars",
      "rebirth through the portal",
      "anti-slop, anti-fake prestige"
    ],
    motifs: [
      "ruins",
      "smoke",
      "ash",
      "neon relics",
      "fractured crowns",
      "market graveyards"
    ],
    canonicalStatus: "working"
  },
  {
    id: "cryptopia",
    title: "Cryptopia",
    summary:
      "A mythic crypt-civilization where commanders, artifacts, and trait-bound forces compete for dominance across dead empires, techno-ruins, cursed arenas, and celestial fracture zones.",
    pillars: [
      "trait identity matters",
      "commanders shape destiny",
      "relics amplify fate",
      "every match is a power struggle"
    ],
    motifs: [
      "tombs",
      "rings",
      "fractures",
      "ash storms",
      "gold relics",
      "spectral courts"
    ],
    canonicalStatus: "working"
  },
  {
    id: "portal_doctrine",
    title: "The Portal Doctrine",
    summary:
      "Crossing the portal is not escape. It is selection. Only those strong enough to survive collapse, distortion, and mutation emerge with authority.",
    pillars: [
      "rebirth",
      "selection through pressure",
      "survivor status",
      "high-risk transformation"
    ],
    motifs: [
      "thresholds",
      "gates",
      "light fractures",
      "dimensional shear",
      "ritual crossing"
    ],
    canonicalStatus: "working"
  },
  {
    id: "aftr",
    title: "AFTR",
    summary:
      "AFTR is the doctrine of existence after hype. It rejects shallow pumping, fake momentum, and borrowed prestige. Permanence beats noise.",
    pillars: [
      "anti-fake momentum",
      "earned credibility",
      "durability over hype",
      "identity under pressure"
    ],
    motifs: [
      "afterglow",
      "embers",
      "survivor economy",
      "post-collapse order"
    ],
    canonicalStatus: "working"
  }
];

export const CHARACTER_LORE: LoreEntry[] = [
  {
    id: "oogie",
    title: "Oogie",
    summary:
      "The gatekeeper archetype. Rule, judgment, access, and authority. Oogie figures define entry, status, and consequence.",
    pillars: [
      "authority",
      "threshold control",
      "judgment",
      "status enforcement"
    ],
    motifs: [
      "crowns",
      "keys",
      "gates",
      "ritual entry"
    ],
    canonicalStatus: "working"
  },
  {
    id: "poogie",
    title: "Poogie",
    summary:
      "Historian of chain-memory. Poogie archetypes preserve the record of who survived, who lied, who built, and who vanished.",
    pillars: [
      "memory",
      "history",
      "proof",
      "ledger truth"
    ],
    motifs: [
      "ledgers",
      "tablets",
      "archives",
      "proof marks"
    ],
    canonicalStatus: "working"
  },
  {
    id: "moogie",
    title: "Moogie",
    summary:
      "Portal-guide and chaos vector. Moogie archetypes bend order, destabilize certainty, and turn passage into transformation.",
    pillars: [
      "chaos",
      "guidance",
      "mutation",
      "portal instability"
    ],
    motifs: [
      "swirl",
      "rifts",
      "glitches",
      "wild masks"
    ],
    canonicalStatus: "working"
  }
];

export const FACTION_LORE: Record<string, LoreEntry> = {
  STONE: {
    id: "stone_keepers",
    title: "Stone Keepers",
    summary:
      "Endurance, memory, fortification, and old-world authority. Stone forces outlast chaos and weaponize permanence.",
    pillars: ["endurance", "fortification", "discipline", "ancient weight"],
    motifs: ["stone", "gravework", "fortress", "runes"],
    canonicalStatus: "working"
  },
  IRON: {
    id: "iron_defenders",
    title: "Iron Defenders",
    summary:
      "Industrial pressure, hardened discipline, and brutal practical force. Iron does not negotiate with weakness.",
    pillars: ["pressure", "discipline", "metal force", "war-machine tempo"],
    motifs: ["iron", "smoke", "rivets", "impact"],
    canonicalStatus: "working"
  },
  BRONZE: {
    id: "bronze_guardians",
    title: "Bronze Guardians",
    summary:
      "Ancient martial prestige, weapon tradition, and ritualized strength. Bronze carries the weight of old champions.",
    pillars: ["martial honor", "guardian presence", "ritual force", "legacy"],
    motifs: ["bronze", "axes", "altars", "weathered armor"],
    canonicalStatus: "working"
  },
  SILVER: {
    id: "silver_sentinels",
    title: "Silver Sentinels",
    summary:
      "Precision, omen-reading, moonlit vigilance, and high-tempo control. Silver cuts through noise with clarity.",
    pillars: ["precision", "watchfulness", "tempo control", "omen logic"],
    motifs: ["silver", "moonlight", "mirrors", "cold edges"],
    canonicalStatus: "working"
  },
  GOLD: {
    id: "golden_sovereigns",
    title: "Golden Sovereigns",
    summary:
      "Power projection, elite status, divine vanity, and ceremonial dominance. Gold is spectacle backed by force.",
    pillars: ["status", "sovereignty", "show of force", "radiant authority"],
    motifs: ["gold", "crowns", "sunfire", "thrones"],
    canonicalStatus: "working"
  },
  GOD: {
    id: "gods",
    title: "Gods",
    summary:
      "Divine exception, cosmic intervention, and rule-breaking scale. Gods distort normal constraints.",
    pillars: ["divinity", "exception", "fate pressure", "mythic scale"],
    motifs: ["lightning", "void", "sea wrath", "afterlife gates"],
    canonicalStatus: "working"
  }
};

export const COMMANDER_ROLE_HINTS: Record<string, string> = {
  "One of One": "Unique commander. Should feel rule-bending, singular, dangerous, and memorable.",
  Legendary:
    "Prestige commander. Should amplify, elevate, or stabilize broad strategy rather than only spike raw stats."
};

export const WORKING_CANON_NOTES = [
  "Planet REKT is treated as the post-collapse refuge layer of the setting.",
  "Cryptopia is treated as the battlefield civilization layer.",
  "Portal crossing is treated as selection and rebirth, not simple travel.",
  "AFTR is treated as the ethos of surviving after hype and noise.",
  "Oogie, Poogie, and Moogie are treated as archetypal roles that can influence future faction or commander flavor."
];
