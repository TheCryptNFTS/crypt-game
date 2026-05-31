import { createMatch } from "./setup";
import { getCommanderById } from "./commanders";
import { validateDeck } from "./deckRules";
import { getPlayableCardById, isCommanderCardId } from "./cards";
import { MatchBootstrapInput } from "../types/matchBootstrap";
import { getCommanderSpecialBonuses } from "../lib/getCommanderBonuses";
import { getCommanderCardSynergy } from "../lib/getCommanderCardSynergy";
import { makeRng, shuffle as seededShuffle, Rng } from "./rng";
import { STARTING_NEXUS_HEALTH } from "./state";

type PlayerId = "P1" | "P2";

type Bonus = {
  attack?: number;
  health?: number;
  armor?: number;
  crit?: number;
  speed?: number;
  utility?: number;
};

function addBonus(base: Bonus, extra?: Bonus) {
  if (!extra) return;
  for (const key of Object.keys(extra) as (keyof Bonus)[]) {
    base[key] = (base[key] ?? 0) + (extra[key] ?? 0);
  }
}

function uniqueStrings(values: (string | undefined | null)[]) {
  return [...new Set(values.filter(Boolean).map(String))];
}

export function createMatchFromDecks(input: MatchBootstrapInput) {
  const openingHandSize = Math.max(0, input.openingHandSize ?? 3);
  const shouldShuffle = input.shuffle ?? true;
  const seed = input.seed ?? Date.now();

  validateBootstrapSide(input.p1, "P1");
  validateBootstrapSide(input.p2, "P2");

  // Single deterministic RNG stream drives both players' shuffles in order
  // (P1 then P2), so the whole opening is reproducible from `seed`.
  const rng = makeRng(seed);

  const match = createMatch(seed) as any;
  match.seed = seed;
  match.idCounter = match.idCounter ?? 0;

  hydratePlayer(match, "P1", input.p1, openingHandSize, shouldShuffle, rng);
  hydratePlayer(match, "P2", input.p2, openingHandSize, shouldShuffle, rng);

  match.turn = match.turn ?? 1;
  match.activePlayer = match.activePlayer ?? "P1";
  match.winner = match.winner ?? null;
  match.rngCursor = match.rngCursor ?? 0;

  return match;
}

function hydratePlayer(
  match: any,
  playerId: PlayerId,
  input: { commanderId: string; deck: string[] },
  openingHandSize: number,
  shouldShuffle: boolean,
  rng: Rng
) {
  const player = match.players[playerId];
  const commander = getCommanderById(input.commanderId);

  const deck = [...input.deck];
  const library = shouldShuffle ? seededShuffle(deck, rng) : deck;

  const commanderTraits = commander.traits ?? {};
  const commanderSpecial = getCommanderSpecialBonuses(commanderTraits);

  player.commander = commander;
  player.commanderZone = {
    cardId: commander.id,
    name: commander.name,
  };

  player.commanderOg = {
    name: commander.name ?? null,
    traits: commanderTraits,
  };

  player.commanderBonuses = commanderSpecial;
  player.cardModifiers = buildCardModifiers(commander.name, commanderTraits, deck, commanderSpecial);

  player.deck = [...library];
  player.hand = [];
  player.discard = [];
  player.graveyard = [];
  player.artifacts = [];
  player.board = player.board ?? { front: [], back: [] };
  player.board.front = [];
  // Bootstrap bug fix: the `back` lane was never initialised here, so the live
  // {front, back} board shape carried an undefined back lane until first touch.
  player.board.back = [];
  player.deckCount = player.deck.length;
  player.nexusHealth = player.nexusHealth ?? STARTING_NEXUS_HEALTH;

  for (let i = 0; i < openingHandSize; i += 1) {
    drawOne(player);
  }
}

function buildCardModifiers(
  commanderName: string,
  commanderTraits: Record<string, string>,
  deck: string[],
  commanderSpecial: ReturnType<typeof getCommanderSpecialBonuses>
) {
  const byId: Record<
    string,
    {
      bonus: Bonus;
      reasons: string[];
      extraTags: string[];
      extraPassives: string[];
      exactTraitMatches: string[];
      categoryMatches: string[];
      nameMatch: boolean;
      factionMatch: boolean;
    }
  > = {};

  for (const cardId of deck) {
    const card = getPlayableCardById(cardId) as any;
    if (!card) continue;

    const synergy = getCommanderCardSynergy(
      commanderName,
      card.name ?? card.id,
      card.rawTraits ?? {},
      card.faction ?? null,
      commanderTraits
    );

    const totalBonus: Bonus = {};
    addBonus(totalBonus, commanderSpecial.bonus);
    addBonus(totalBonus, synergy.bonus);

    const reasons = uniqueStrings([
      ...(commanderSpecial.reasons ?? []),
      ...synergy.exactTraitMatches,
      ...synergy.categoryMatches.map((x) => `Shared category: ${x}`),
      synergy.nameMatch ? `Name match: ${commanderName} ↔ ${card.name ?? card.id}` : null,
      synergy.factionMatch ? `Faction match: ${card.faction ?? "unknown"}` : null,
    ]);

    byId[cardId] = {
      bonus: totalBonus,
      reasons,
      extraTags: uniqueStrings([...(commanderSpecial.extraTags ?? [])]),
      extraPassives: uniqueStrings([...(commanderSpecial.extraPassives ?? [])]),
      exactTraitMatches: synergy.exactTraitMatches,
      categoryMatches: synergy.categoryMatches,
      nameMatch: synergy.nameMatch,
      factionMatch: synergy.factionMatch,
    };
  }

  return byId;
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

  // Balance-patch soft-ban: cards flagged `disabled` by the override layer stay
  // in the catalog (count audits unaffected) but are not deck-legal.
  const banned = input.deck.find((id) => getPlayableCardById(id)?.disabled === true);
  if (banned) {
    throw new Error(`${label} deck contains a disabled (soft-banned) card: ${banned}`);
  }

  const result = validateDeck(input.deck, input.commanderId, {
    deckSize: commander.deckRules.deckSize,
    maxCopies: 2,
    allowGodCards: commander.deckRules.maxGodCards > 0,
  });

  if (!result.valid) {
    throw new Error(`${label} deck failed validation:\n${result.errors.join("\n")}`);
  }
}

