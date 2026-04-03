import { buildStarterUnits } from "../engine/cardFactory";

const units = buildStarterUnits();

export function loadUnits() {
  return units;
}

export function loadUnitById(id: string) {
  return units.find((unit) => unit.id === id);
}

export default units;