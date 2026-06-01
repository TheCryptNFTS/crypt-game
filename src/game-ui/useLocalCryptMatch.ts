import { useEffect, useMemo, useRef, useState } from "react";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { applyAction, Action, GameEvent } from "../engine/reducer";
import { BASE_MAX_ENERGY, ENERGY_CAP, OPENING_HAND_SIZE } from "../engine/state";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import { planP2Turn } from "./cryptMatchAI";

type PlayerId = "P1" | "P2";
type Lane = "front" | "back";

type CombatLogEntry = {
  id: string;
  text: string;
};

/** P1 is the human, P2 the simulated opponent — the log reads from your seat. */
const DISPLAY_NAME: Record<PlayerId, string> = { P1: "You", P2: "Opponent" };

/** Signal-civilization framing for a decided match (P1 = your perspective). */
function winLine(w: PlayerId): string {
  return w === "P1" ? "Signal restored — you win." : "Signal lost — opponent wins.";
}

function findCommander(preferredName: string) {
  return allCommanders.find((c: any) => c.name === preferredName) ?? allCommanders[0];
}

/**
 * Additive, opt-in config so the new-player TUTORIAL can run the normal local
 * match but with (a) an explicit fixed starter deck for P1 and (b) a weakened
 * opponent. Both fields are optional and unused by the default `/match` flow, so
 * returning-player behavior is byte-identical when no options are passed.
 */
export type LocalMatchOptions = {
  /** Force P1's deck to this exact card-id list (the curated starter deck). */
  p1Deck?: string[];
  /** Tutorial easy-mode: start the opponent nexus low so a newcomer can win. */
  opponentNexusHealth?: number;
};

function makeInitialMatch(ownedCardIds?: string[], options?: LocalMatchOptions) {
  const p1Commander = findCommander("Crypt #6600");
  const p2Commander = allCommanders.find((c: any) => c.traits?.Legendary === "Legendary" && c.id !== p1Commander.id) ?? allCommanders[1] ?? p1Commander;
  const p1Deck = options?.p1Deck && options.p1Deck.length > 0
    ? options.p1Deck
    : buildPlayerDeck(ownedCardIds).deck;
  const p2Deck = buildPlayerDeck().deck;

  // The engine is now seedable/deterministic. Single-player picks a fresh seed
  // per match (server play would supply an authoritative seed instead). A real
  // seeded shuffle means draw order now varies run-to-run — the desired fix for
  // the old fixed-draw "solved game".
  const match: any = createMatchFromDecks({
    p1: { commanderId: p1Commander.id, deck: p1Deck },
    p2: { commanderId: p2Commander.id, deck: p2Deck },
    seed: Date.now(),
    openingHandSize: OPENING_HAND_SIZE
  });

  match.activePlayer = match.activePlayer ?? "P1";
  match.turn = match.turn ?? 1;
  match.winner = match.winner ?? null;

  // Real ramping energy: active player (P1) starts with base max, the opponent
  // is seeded at base max too and will refill/ramp at the start of their turn.
  match.players.P1.maxEnergy = BASE_MAX_ENERGY;
  match.players.P1.energy = BASE_MAX_ENERGY;
  match.players.P2.maxEnergy = BASE_MAX_ENERGY;
  match.players.P2.energy = BASE_MAX_ENERGY;

  match.players.P1.nexusHealth = match.players.P1.nexusHealth ?? 20;
  match.players.P2.nexusHealth = match.players.P2.nexusHealth ?? 20;

  // Tutorial easy-mode: a lower opponent nexus lets a first-time pilot close out
  // a real game quickly. Only applied when explicitly requested.
  if (typeof options?.opponentNexusHealth === "number") {
    match.players.P2.nexusHealth = options.opponentNexusHealth;
  }

  return match;
}

/** Returns "P1" | "P2" | null based on nexus health and any engine winner. */
function detectWinner(match: any): PlayerId | null {
  if (match.winner === "P1" || match.winner === "P2") return match.winner;
  const p1Dead = (match.players.P1.nexusHealth ?? 20) <= 0;
  const p2Dead = (match.players.P2.nexusHealth ?? 20) <= 0;
  if (p2Dead) return "P1";
  if (p1Dead) return "P2";
  return null;
}

const cardMetaById = new Map<string, any>(
  (allPlayableCards as any[]).map((c) => [c.id, c])
);

function costOf(cardId: string): number {
  return cardMetaById.get(cardId)?.cost ?? 0;
}

function nameOf(cardId: string): string {
  return cardMetaById.get(cardId)?.name ?? cardId;
}

/**
 * VIEW-LAYER ONLY: turn the reducer's structured `GameEvent[]` into the
 * player-facing combat-log strings. DISPLAY_NAME / winLine live here, NOT in the
 * reducer (which stays string-free and server-portable).
 */
function eventToLogText(ev: GameEvent): string | null {
  switch (ev.type) {
    case "UNIT_PLAYED":
      return `${DISPLAY_NAME[ev.player]} deployed ${nameOf(ev.cardId)} to ${ev.lane}.`;
    case "ARTIFACT_PLAYED":
      return `${DISPLAY_NAME[ev.player]} activated artifact ${nameOf(ev.cardId)}.`;
    case "EQUIPPED":
      return `${DISPLAY_NAME[ev.player]} equipped ${nameOf(ev.cardId)}.`;
    case "ATTACK":
      return `${DISPLAY_NAME[ev.player]} struck for ${ev.outgoing} raw / ${ev.mitigated} final. Counter: ${ev.counter}.`;
    case "NEXUS_DAMAGE":
      return `${DISPLAY_NAME[ev.player]} struck ${DISPLAY_NAME[ev.targetPlayer]}'s nexus for ${ev.damage}.`;
    case "TURN_START":
      return `${DISPLAY_NAME[ev.player]}'s turn. Energy ${ev.energy}/${ev.maxEnergy}.`;
    case "DECK_OUT":
      return `${DISPLAY_NAME[ev.player]} decked out.`;
    case "WIN":
      return winLine(ev.player);
    case "TURN_END":
    case "REJECTED":
    default:
      return null;
  }
}

export function useLocalCryptMatch(ownedCardIds?: string[], options?: LocalMatchOptions) {
  const [match, setMatch] = useState<any>(() => makeInitialMatch(ownedCardIds, options));
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  // Mulligan is a one-time redraw of P1's opening hand, allowed only before any
  // action has been taken on turn 1.
  const [mulliganAvailable, setMulliganAvailable] = useState(true);
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([
    { id: "boot", text: "Match online — signal live." }
  ]);

  const deckSource = buildPlayerDeck(ownedCardIds).source;

  // Track the owned ids the currently-loaded match was built from, so we can
  // detect a wallet connecting/changing mid-session and rebuild without looping.
  const loadedOwnedKey = useRef<string>((ownedCardIds ?? []).join(","));
  // Guards the AI effect so P2's turn is only ever driven once.
  const aiRunningRef = useRef(false);

  const winner: PlayerId | null = detectWinner(match);

  const activePlayer: PlayerId = match.activePlayer === "P2" ? "P2" : "P1";
  const inactivePlayer: PlayerId = activePlayer === "P1" ? "P2" : "P1";

  const appendLog = (text: string) => {
    setCombatLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text }, ...prev].slice(0, 40));
  };

  const selectedHandIndex = useMemo(() => {
    if (!selectedHandId) return -1;
    return (match.players[activePlayer].hand ?? []).findIndex((id: string) => id === selectedHandId);
  }, [match, activePlayer, selectedHandId]);

  const selectedHandCardId = selectedHandIndex >= 0 ? match.players[activePlayer].hand[selectedHandIndex] : null;
  const selectedHandCard = selectedHandCardId
    ? allPlayableCards.find((c: any) => c.id === selectedHandCardId) ?? null
    : null;

  // Once a card is committed, the one-time mulligan is gone.
  const consumeMulligan = () => {
    if (mulliganAvailable) setMulliganAvailable(false);
  };

  /**
   * Single funnel: every human action now flows through the pure reducer. We
   * dispatch the action, commit the returned state, and map its structured
   * events into log lines. A REJECTED result is a clean no-op (we surface a
   * short message only for the energy case so the UI still nudges the player).
   */
  const dispatch = (action: Action): boolean => {
    const { state: nextState, events } = applyAction(match, action);
    const rejected = events.find((e) => e.type === "REJECTED");
    if (rejected) {
      if (rejected.type === "REJECTED" && rejected.reason === "not-enough-energy") {
        appendLog("Not enough energy.");
      }
      return false;
    }
    setMatch(nextState);
    for (const ev of events) {
      const line = eventToLogText(ev);
      if (line) appendLog(line);
    }
    return true;
  };

  const endTurn = () => {
    if (winner) return;
    consumeMulligan();
    if (dispatch({ type: "END_TURN", player: activePlayer })) {
      setSelectedHandId(null);
      setSelectedBoardId(null);
    }
  };

  const playSelectedUnit = (lane: Lane) => {
    if (winner) return;
    if (!selectedHandCard || selectedHandCard.type !== "unit" || selectedHandIndex < 0) return;
    consumeMulligan();
    if (dispatch({ type: "PLAY_UNIT", player: activePlayer, handIndex: selectedHandIndex, lane })) {
      setSelectedHandId(null);
    }
  };

  const playSelectedArtifact = () => {
    if (winner) return;
    if (!selectedHandCard || selectedHandCard.type !== "artifact" || selectedHandIndex < 0) return;
    consumeMulligan();
    if (dispatch({ type: "PLAY_ARTIFACT", player: activePlayer, handIndex: selectedHandIndex })) {
      setSelectedHandId(null);
    }
  };

  const equipSelectedToUnit = (targetInstanceId: string) => {
    if (winner) return;
    if (!selectedHandCard || selectedHandCard.type !== "equipment" || selectedHandIndex < 0) return;
    consumeMulligan();
    if (dispatch({ type: "EQUIP", player: activePlayer, handIndex: selectedHandIndex, targetInstanceId })) {
      setSelectedHandId(null);
    }
  };

  const attackUnit = (attackerInstanceId: string, defenderInstanceId: string) => {
    if (winner) return;
    consumeMulligan();
    dispatch({ type: "ATTACK_UNIT", player: activePlayer, attackerInstanceId, defenderInstanceId });
  };

  const attackFace = (attackerInstanceId: string) => {
    if (winner) return;
    consumeMulligan();
    dispatch({ type: "ATTACK_FACE", player: activePlayer, attackerInstanceId });
  };

  const mulligan = () => {
    if (!mulliganAvailable || winner) return;
    if (activePlayer !== "P1") return;
    const { state: nextState, events } = applyAction(match, { type: "MULLIGAN", player: "P1" });
    if (events.some((e) => e.type === "REJECTED")) return;
    setMulliganAvailable(false);
    setSelectedHandId(null);
    setMatch(nextState);
    appendLog("Hand recalibrated — opening signal redrawn.");
  };

  const resetMatch = () => {
    setMatch(makeInitialMatch(ownedCardIds, options));
    setSelectedHandId(null);
    setSelectedBoardId(null);
    setInspectId(null);
    setMulliganAvailable(true);
    aiRunningRef.current = false;
    setCombatLog([{ id: "reset", text: "Match reset." }]);
  };

  // Live-swap the deck if the wallet connects/changes while the user is already
  // on the Play tab. Rebuild only when the owned ids actually differ from what
  // the current match was built from (tracked in a ref) so this never loops.
  useEffect(() => {
    const nextKey = (ownedCardIds ?? []).join(",");
    if (nextKey === loadedOwnedKey.current) return;
    loadedOwnedKey.current = nextKey;
    setMatch(makeInitialMatch(ownedCardIds, options));
    setSelectedHandId(null);
    setSelectedBoardId(null);
    setInspectId(null);
    setMulliganAvailable(true);
    aiRunningRef.current = false;
    setCombatLog([{ id: `swap-${Date.now()}`, text: "Deck updated from connected wallet." }]);
  }, [ownedCardIds]);

  // Simulated AI opponent. When it becomes P2's turn (and the match is live),
  // build a plan from the current state and feed it through THE SAME reducer the
  // human uses — `for (const a of planP2Turn(state)) state = applyAction(...)` —
  // then dispatch END_TURN. AI and human now run byte-identical rules; the only
  // AI-specific glue is mapping the planner's cardId-based actions to the
  // reducer's index-based ones (re-finding each card's current hand index, since
  // the plan is robust to hand churn).
  useEffect(() => {
    if (match.activePlayer !== "P2") {
      aiRunningRef.current = false;
      return;
    }
    if (winner) return;
    if (aiRunningRef.current) return;
    aiRunningRef.current = true;

    const timer = setTimeout(() => {
      let work = match;
      const logs: string[] = [];

      const run = (action: Action) => {
        const { state: nextState, events } = applyAction(work, action);
        work = nextState;
        for (const ev of events) {
          const line = eventToLogText(ev);
          if (line) logs.push(line);
        }
      };

      try {
        const plan = planP2Turn(work);
        for (const a of plan) {
          if (work.winner) break;
          if (a.kind === "playUnit") {
            const idx = (work.players.P2.hand ?? []).indexOf(a.cardId);
            if (idx < 0) continue;
            run({ type: "PLAY_UNIT", player: "P2", handIndex: idx, lane: a.lane });
          } else if (a.kind === "playArtifact") {
            const idx = (work.players.P2.hand ?? []).indexOf(a.cardId);
            if (idx < 0) continue;
            run({ type: "PLAY_ARTIFACT", player: "P2", handIndex: idx });
          } else if (a.kind === "equip") {
            const idx = (work.players.P2.hand ?? []).indexOf(a.cardId);
            if (idx < 0) continue;
            run({ type: "EQUIP", player: "P2", handIndex: idx, targetInstanceId: a.targetInstanceId });
          } else if (a.kind === "attackUnit") {
            run({ type: "ATTACK_UNIT", player: "P2", attackerInstanceId: a.attackerInstanceId, defenderInstanceId: a.defenderInstanceId });
          } else if (a.kind === "attackFace") {
            run({ type: "ATTACK_FACE", player: "P2", attackerInstanceId: a.attackerInstanceId });
          }
        }
      } catch {
        // Planning failed — fall through to ending the turn safely.
      }

      // End P2's turn (unless P2 already won) through the reducer too.
      if (!work.winner) {
        run({ type: "END_TURN", player: "P2" });
      }

      aiRunningRef.current = false;
      setMatch(work);
      setSelectedHandId(null);
      setSelectedBoardId(null);
      for (const line of logs) appendLog(line);
    }, 600);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.activePlayer, match.turn, winner]);

  return {
    deckSource,
    match,
    winner,
    activePlayer,
    inactivePlayer,
    selectedHandId,
    selectedBoardId,
    inspectId,
    combatLog,
    selectedHandCard,
    selectedHandIndex,
    mulliganAvailable,
    energy: match.players[activePlayer].energy ?? 0,
    maxEnergy: match.players[activePlayer].maxEnergy ?? BASE_MAX_ENERGY,
    affordableCostFor: (cardId: string) => costOf(cardId) <= (match.players[activePlayer].energy ?? 0),
    setSelectedHandId,
    setSelectedBoardId,
    setInspectId,
    endTurn,
    playSelectedUnit,
    playSelectedArtifact,
    equipSelectedToUnit,
    attackUnit,
    attackFace,
    mulligan,
    resetMatch
  };
}
