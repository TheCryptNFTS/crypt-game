import { playUnitFromHand, playEquipmentFromHand, playArtifactCard } from "../engine/play";

console.log(JSON.stringify({
  playUnitFromHand: typeof playUnitFromHand,
  playEquipmentFromHand: typeof playEquipmentFromHand,
  playArtifactCard: typeof playArtifactCard,
}, null, 2));
