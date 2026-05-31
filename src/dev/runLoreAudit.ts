import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { WORLD_LORE, CHARACTER_LORE, FACTION_LORE, WORKING_CANON_NOTES } from "../lore/loreBible";

const oneOfOne = allCommanders.filter((c: any) => c.traits?.["One of One"]).length;
const legendary = allCommanders.filter((c: any) => c.traits?.["Legendary"] === "Legendary").length;

const traitCategories = new Map<string, number>();
for (const card of allPlayableCards) {
  for (const key of Object.keys(card.rawTraits ?? {})) {
    traitCategories.set(key, (traitCategories.get(key) ?? 0) + 1);
  }
}

console.log(JSON.stringify({
  worldLore: WORLD_LORE,
  characterLore: CHARACTER_LORE,
  factionLoreKeys: Object.keys(FACTION_LORE),
  workingCanonNotes: WORKING_CANON_NOTES,
  commanderCounts: {
    total: allCommanders.length,
    oneOfOne,
    legendary
  },
  cardCounts: {
    total: allPlayableCards.length,
    units: allPlayableCards.filter((c) => c.type === "unit").length,
    equipment: allPlayableCards.filter((c) => c.type === "equipment").length,
    artifacts: allPlayableCards.filter((c) => c.type === "artifact").length
  },
  topTraitCategories: [...traitCategories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([trait, count]) => ({ trait, count }))
}, null, 2));
