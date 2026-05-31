import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import commandersJson from "../data/commanders.json";

// Rarity flags live as top-level booleans (`oneOfOne` / `isLegendary`) on the
// curated commander data in commanders.json — NOT under traits["One of One"] /
// traits["Legendary"], and NOT on the generated NFT dump (whose only trait key
// is "Keyword"). The previous audit read non-existent trait fields and always
// got 0. Count against the authoritative source data instead.
// `oneOfOne` is a truthy string in the data (the 1/1 character name, e.g.
// "Harley"); `isLegendary` is a real boolean.
type RawCommanderRarity = { id: string; oneOfOne?: string | boolean; isLegendary?: boolean };
const rawCommanders = commandersJson as RawCommanderRarity[];
const oneOfOne = rawCommanders.filter((c) => Boolean(c.oneOfOne)).length;
const legendary = rawCommanders.filter((c) => c.isLegendary === true).length;
const exactTraitCapableCards = allPlayableCards.filter((c) => Object.keys(c.rawTraits ?? {}).length > 0).length;
const factions = [...new Set(allPlayableCards.map((c) => c.faction))];

console.log(JSON.stringify({
  readiness: {
    realCommanders: allCommanders.length > 0,
    realPlayableCards: allPlayableCards.length > 0,
    commanderTraitCoverage: oneOfOne + legendary > 0,
    exactTraitCapableCards: exactTraitCapableCards > 0,
    equipmentExists: allPlayableCards.some((c) => c.type === "equipment"),
    artifactExists: allPlayableCards.some((c) => c.type === "artifact"),
    factionCoverage: factions
  },
  counts: {
    commanders: allCommanders.length,
    oneOfOne,
    legendary,
    cards: allPlayableCards.length,
    units: allPlayableCards.filter((c) => c.type === "unit").length,
    equipment: allPlayableCards.filter((c) => c.type === "equipment").length,
    artifacts: allPlayableCards.filter((c) => c.type === "artifact").length,
    exactTraitCapableCards
  }
}, null, 2));
