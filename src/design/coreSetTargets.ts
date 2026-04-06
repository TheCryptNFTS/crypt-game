export const CORE_SET_TARGETS = {
  deckSize: 30,
  idealDeckMix: {
    units: 20,
    equipment: 6,
    artifacts: 4
  },
  curveTargets: {
    2: 8,
    3: 8,
    4: 7,
    5: 5,
    6: 2
  },
  maxCopiesPerCard: 2,
  maxGodCardsPerDeck: 1,
  factionCardTargets: {
    STONE: { units: 16, equipment: 4, artifacts: 2 },
    IRON: { units: 16, equipment: 4, artifacts: 2 },
    BRONZE: { units: 16, equipment: 4, artifacts: 2 },
    SILVER: { units: 16, equipment: 4, artifacts: 2 },
    GOLD: { units: 14, equipment: 3, artifacts: 3 },
    GOD: { units: 2, equipment: 0, artifacts: 2 }
  }
} as const;
