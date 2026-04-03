import { buildStarterEquipment } from "../engine/cardFactory";

const equipment = buildStarterEquipment();

export function loadEquipment() {
  return equipment;
}

export function loadEquipmentById(id: string) {
  return equipment.find((item) => item.id === id);
}

export default equipment;