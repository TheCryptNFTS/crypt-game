import { TRAIT_POWERS } from "./traitPowers";
import { SPECIAL_TRAIT_RULES } from "./specialTraitRules";

export function getTraitPower(category: string, value: string) {
  return TRAIT_POWERS.find(
    (entry) =>
      entry.category.toLowerCase() === category.toLowerCase() &&
      entry.value.toLowerCase() === value.toLowerCase()
  );
}

export function getSpecialTraitRule(category: "God" | "One of One", value: string) {
  return SPECIAL_TRAIT_RULES.find(
    (entry) =>
      entry.category === category &&
      entry.value.toLowerCase() === value.toLowerCase()
  );
}
