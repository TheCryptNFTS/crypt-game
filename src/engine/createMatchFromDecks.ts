import { createMatch } from "./setup";
import { getCommanderById } from "./commanders";
import { validateDeck } from "./deckRules";
import { getPlayableCardById, isCommanderCardId } from "./cards";
import { MatchBootstrapInput } from "../types/matchBootstrap";

type PlayerId = "P1" | "P2";

export function createMatchFromDecks(input: MatchBootstrapInput) {
  const openingHandSize = Math.max(0, input.openingHandSize ?? 3);
  const shouldShuffle = input.shuffle ?? true;

  validateBootstrapSide(input.p1, "P1");
  validateBootstrapSide(input.p2, "P2");

  const match = createMatch() as any;

  hydratePlayer(match, "P1", input.p1, openingHandSize, shouldShuffle);
  hydratePlayer(match, "P2", input.p2, openingHandSize, shouldShuffle);

  match.turn = match.turn ?? 1;
  match.activePlayer = match.activePlayer ?? "P1";
  match.phase = match.phase ?? "main";
  match.winner = match.winner ?? null;

  return match;
}

function hydratePlayer(
  match: any,
  playerId: PlayerId,
  input: { commanderId: string; deck: string[] },
  openingHandSize: number,
  shouldShuffle: boolean
) {
  const player = match.players[playerId];
  const commander = getCommanderById(input.commanderId);

  const deck = [...input.deck];
  const library = shouldShuffle ? shuffle(deck) : deck;

  player.commander = commander;
  player.commanderZone = {
    cardId: commander.id,
    name: commander.name,
    faction: commander.faction,
  };

  player.deck = [...library];
  player.hand = [];
  player.discard = [];
  player.artifacts = [];
  player.board = player.board ?? { front: [] };
  player.board.front = [];
  player.deckCount = player.deck.length;

  for (let i = 0; i < openingHandSize; i += 1) {
    drawOne(player);
  }
}

function drawOne(player: any) {
  if (!Array.isArray(player.deck) || player.deck.length === 0) return;
  const next = player.deck.shift();
  if (!next) return;
  player.hand.push(next);
  player.deckCount = player.deck.length;
}

function validateBootstrapSide(
  input: { commanderId: string; deck: string[] },
  label: "P1" | "P2"
) {
  if (!input || typeof input !== "object") {
    throw new Error(`${label} bootstrap input is missing`);
  }

  if (!input.commanderId) {
    throw new Error(`${label} commanderId is required`);
  }

  if (!Array.isArray(input.deck)) {
    throw new Error(`${label} deck must be an array`);
  }

  const commander = getCommanderById(input.commanderId);

  if (input.deck.includes(input.commanderId)) {
    throw new Error(`${label} deck illegally contains its commander: ${input.commanderId}`);
  }

  const commanderLeak = input.deck.find((id) => isCommanderCardId(id));
  if (commanderLeak) {
    throw new Error(`${label} deck illegally contains commander card: ${commanderLeak}`);
  }

  const unknown = input.deck.find((id) => !getPlayableCardById(id));
  if (unknown) {
    throw new Error(`${label} deck contains unknown or non-playable card: ${unknown}`);
  }

  const result = validateDeck(input.deck, input.commanderId, {
    deckSize: commander.deckRules.deckSize,
    maxCopies: 2,
    allowGodCards: commander.deckRules.maxGodCards > 0,
  });

  if (!result.valid) {
    throw new Error(`${label} deck failed validation:\n${result.errors.join("\n")}`);
  }

  const godCount = Object.entries(result.stats.byFaction)
    .filter(([faction]) => faction === "GOD")
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);

  if (godCount > commander.deckRules.maxGodCards) {
    throw new Error(
      `${label} deck has ${godCount} GOD cards but commander allows max ${commander.deckRules.maxGodCards}`
    );
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
