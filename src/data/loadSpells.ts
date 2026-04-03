import { buildStarterSpells } from "../engine/cardFactory";

const spells = buildStarterSpells();

export function loadSpells() {
  return spells;
}

export function loadSpellById(id: string) {
  return spells.find((spell) => spell.id === id);
}

export default spells;