import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { playArtifactCard } from "../engine/effectSystem";
import { buildProofDeck } from "./buildProofDecks";
import { selectProofCommander } from "./selectProofCommander";

const commander = selectProofCommander();
if (!commander) throw new Error("No commander found");

const deck = buildProofDeck(["artifact"], 30);

const match = createMatchFromDecks({
  p1: { commanderId: commander.id, deck },
  p2: { commanderId: commander.id, deck },
  shuffle: false,
  openingHandSize: 5,
}) as any;

match.players.P1.energy = 999;

const artifactIndex = match.players.P1.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "artifact";
});
if (artifactIndex === -1) throw new Error("No artifact in hand");

const artifactCardId = match.players.P1.hand[artifactIndex];
const artifactCard = allPlayableCards.find((c) => c.id === artifactCardId);

const next = playArtifactCard(match, "P1", artifactIndex) as any;

console.log(JSON.stringify({
  commander: commander.name,
  artifactCardId,
  artifactCardName: artifactCard?.name,
  artifactStoredModifier: match.players.P1.cardModifiers[artifactCardId] ?? null,
  artifactInPlay: next.players.P1.artifacts[next.players.P1.artifacts.length - 1] ?? null,
  allArtifacts: next.players.P1.artifacts,
}, null, 2));
