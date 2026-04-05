import units from "../src/data/units.json";
import spells from "../src/data/spells.json";
import equipment from "../src/data/equipment.json";
import commanders from "../src/data/commanders.json";

type CardLike = { id: string; name?: string };

function findDuplicates(cards: CardLike[], label: string) {
  const seen = new Set<string>();
  const dupes = new Set<string>();

  for (const card of cards) {
    if (seen.has(card.id)) dupes.add(card.id);
    seen.add(card.id);
  }

  if (dupes.size > 0) {
    throw new Error(`${label} has duplicate ids: ${[...dupes].join(", ")}`);
  }
}

function validate() {
  findDuplicates(units as CardLike[], "units");
  findDuplicates(spells as CardLike[], "spells");
  findDuplicates(equipment as CardLike[], "equipment");
  findDuplicates(commanders as CardLike[], "commanders");

  console.log("\n=== CARD VALIDATION PASSED ===");
  console.log({
    units: (units as CardLike[]).length,
    spells: (spells as CardLike[]).length,
    equipment: (equipment as CardLike[]).length,
    commanders: (commanders as CardLike[]).length
  });
}

validate();