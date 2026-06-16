import { useEffect, useMemo, useRef, useState } from "react";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { applyAction, autoPickOption, Action, GameEvent } from "../engine/reducer";
import { BASE_MAX_ENERGY, ENERGY_CAP, OPENING_HAND_SIZE, CORE_RULESET } from "../engine/state";
import { beginMulliganPhase, requireMulligan } from "../engine/setup";
import { buildPlayerDeck, DEMO_COMMANDER_ID } from "../nft/buildOwnedDeck";
import { loadStoredCommanderId, loadStoredMainDeckCardIds } from "../lib/deckBuilderStorage";
import { applyMatchRewards } from "../lib/localProgress";
import { planP2Turn, planP2Plays, planP2Surge, planP2Combat, readAiDifficulty } from "./cryptMatchAI";

type PlayerId = "P1" | "P2";
type Lane = "front" | "back";

type CombatLogEntry = {
  id: string;
  text: string;
};

/** P1 is the human, P2 the simulated opponent — the log reads from your seat. */
const DISPLAY_NAME: Record<PlayerId, string> = { P1: "You", P2: "Opponent" };
// Possessive form — "You" → "Your", otherwise append 's (avoids "You's turn").
const POSSESSIVE: Record<PlayerId, string> = { P1: "Your", P2: "Opponent's" };

/** Signal-civilization framing for a decided match (P1 = your perspective). */
function winLine(w: PlayerId): string {
  return w === "P1" ? "Signal restored — you win." : "Signal lost — opponent wins.";
}

function findCommander(preferredName: string) {
  return allCommanders.find((c: any) => c.name === preferredName) ?? allCommanders[0];
}

/** P1's commander is the one the player PICKED (onboarding/deck builder). Falls
 *  back to the DEMO (Iron) commander when nothing valid is stored, so a fresh
 *  newcomer pairs the faction-coherent demo deck (buildOwnedDeck) with the curated
 *  commander whose identity actually rewards it — without that pairing an Iron
 *  starter deck under a generated `cmd_6xxx` commander triggers NO faction identity
 *  and the whole #8 layer reads as nothing on a first game. A returning player who
 *  picked a commander still gets exactly their pick. */
function resolveP1Commander() {
  const storedId = loadStoredCommanderId();
  const picked = storedId ? allCommanders.find((c: any) => c.id === storedId) : null;
  return (
    picked ??
    allCommanders.find((c: any) => c.id === DEMO_COMMANDER_ID) ??
    findCommander("Crypt #6600")
  );
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
  /** Override P1's starting Hex. When set, the default newcomer cushion below is
   *  NOT applied (the caller is taking explicit control of the player's HP). */
  playerNexusHealth?: number;
  /** TUTORIAL (teardown §3): keep the dealt opening hand and skip the mulligan
   *  screen entirely. A redraw decision is meaningless to someone who has never
   *  seen a card — the old flow made the mulligan the FIRST interactive screen
   *  of the entire game. Skipping the phase = identical to pressing KEEP HAND
   *  immediately (the phase is simply never opened; the reducer's vanilla
   *  no-mulligan path runs). */
  autoKeepOpeningHand?: boolean;
};

// Newcomer cushion (LOCAL SOLO ONLY): the default /match is a first-time player's
// game, and the playtest twice saw the greedy AI burst a LEADING newcomer from full
// (18 / 12 in one turn) for a flat "dead from full while ahead" feel-bad. A modest
// +5 Hex on the PLAYER (25 vs the standard 20) absorbs that single alpha-strike
// without weakening the AI or making the game trivially easy — the player still has
// to actually win the board. SCOPE: this lives in makeInitialMatch, which only ever
// runs for the local single-player hook; real PvP is server-authoritative
// (useRemoteCryptMatch) and never passes through here, so competitive balance is
// untouched. Suppressed whenever a caller (tutorial, tests) sets its own HP.
const NEWCOMER_PLAYER_NEXUS = 25;

function makeInitialMatch(ownedCardIds?: string[], options?: LocalMatchOptions) {
  const p1Commander = resolveP1Commander();
  // The opponent plays the faction-coherent DEMO (Bronze) deck (buildPlayerDeck()),
  // so pair it with the curated Bronze commander too — otherwise the opponent's
  // identity never fires and its Bronze deck reads as a flat pile. This makes the
  // newcomer's first game a clean Bronze-vs-Bronze read where the Onslaught/Rush
  // identity is visible on BOTH sides. Falls back to a Legendary then any commander
  // if the curated id ever goes missing, so the match always boots.
  const p2Commander =
    allCommanders.find((c: any) => c.id === DEMO_COMMANDER_ID) ??
    allCommanders.find((c: any) => c.traits?.Legendary === "Legendary" && c.id !== p1Commander.id) ??
    allCommanders[1] ??
    p1Commander;
  // P1's deck, in priority order: (1) an explicit tutorial/draft deck, (2) the
  // deck the player actually PICKED/built (deck-builder storage) — this is what
  // onboarding equips, faction-matched to the chosen commander, so the in-match
  // deck matches the commander instead of a generic demo deck, (3) the owned/demo
  // builder. Only legal 30-card lists are honored: createMatchFromDecks THROWS on
  // an illegal deck and this runs inside useState — an unguarded throw
  // white-screens the whole app, so a non-30 list always falls through.
  const storedDeck = loadStoredMainDeckCardIds();
  const explicitP1 =
    options?.p1Deck && options.p1Deck.length === 30
      ? options.p1Deck
      : storedDeck && storedDeck.length === 30
        ? storedDeck
        : null;
  const p1Deck = explicitP1 ?? buildPlayerDeck(ownedCardIds).deck;
  const p2Deck = buildPlayerDeck().deck;

  // The engine is now seedable/deterministic. Single-player picks a fresh seed
  // per match (server play would supply an authoritative seed instead). A real
  // seeded shuffle means draw order now varies run-to-run — the desired fix for
  // the old fixed-draw "solved game".
  const match: any = createMatchFromDecks({
    p1: { commanderId: p1Commander.id, deck: p1Deck },
    p2: { commanderId: p2Commander.id, deck: p2Deck },
    seed: Date.now(),
    openingHandSize: OPENING_HAND_SIZE,
    // Live play ships the CORE ruleset: FLAT faction identities (Bedrock/Insight/
    // Onslaught/Tempered/Largesse) so deck/faction choice is mechanically
    // meaningful, but no archetype-threshold depth or response stack to learn.
    rules: CORE_RULESET
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

  // Newcomer cushion for the default solo /match (see NEWCOMER_PLAYER_NEXUS). An
  // explicit `playerNexusHealth` wins; otherwise the demo path gets the cushion so
  // a leading first-timer isn't one-shot from full. Local-only — PvP never reaches
  // here. The tutorial weakens the OPPONENT instead and doesn't need this on top,
  // but it also never sets playerNexusHealth, so it inherits the cushion harmlessly
  // (a coached newcomer being a little harder to one-shot is consistent intent).
  if (typeof options?.playerNexusHealth === "number") {
    match.players.P1.nexusHealth = options.playerNexusHealth;
  } else {
    match.players.P1.nexusHealth = NEWCOMER_PLAYER_NEXUS;
  }

  // D1 (teardown): stamp each player's heal cap to their FINAL starting Hex.
  // Without this the engine's heal clamp (STARTING_NEXUS_HEALTH = 20) actively
  // DAMAGED the 25-Hex cushioned newcomer on every lifesteal/heal proc — the
  // exact path every default solo match runs.
  match.players.P1.maxNexusHealth = match.players.P1.nexusHealth;
  match.players.P2.maxNexusHealth = match.players.P2.nexusHealth;

  // OPENING MULLIGAN (PART 1) — open the phase for the HUMAN (P1) only. Passing
  // a single side marks the OTHER side (P2, the AI) `done` automatically, so the
  // opponent silently keeps its opening hand and play can proceed the instant the
  // player confirms their own mulligan. While P1 is `pending` the reducer's global
  // gate reject-softs every non-MULLIGAN action, so the board is inert behind the
  // mulligan screen until the player keeps or redraws. The tutorial skips the
  // phase entirely (autoKeepOpeningHand) — see LocalMatchOptions.
  if (!options?.autoKeepOpeningHand) {
    beginMulliganPhase(match, ["P1"]);
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
      return `${DISPLAY_NAME[ev.player]} struck ${POSSESSIVE[ev.targetPlayer]} Hex for ${ev.damage}.`;
    case "TURN_START":
      return `${POSSESSIVE[ev.player]} turn. Energy ${ev.energy}/${ev.maxEnergy}.`;
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

/** Live reduced-motion check (browser-safe; false in Node/SSR harnesses, which
 *  keeps the AI turn a single deterministic commit there). When true, the AI
 *  turn does NOT step — it commits in one go so accessibility users get no
 *  animation churn. */
function prefersReducedMotionLive(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Map a reducer REJECTED reason to a short, player-facing nudge. Returns null
 * for reasons the player never needs to see (internal/no-op guards). Keep these
 * plain-language — they show on the action bar, not in dev logs.
 */
function rejectReasonText(reason: string): string | null {
  switch (reason) {
    case "not-enough-energy":
      return "Not enough energy for that.";
    case "lane-full":
      return "That lane is full (max 7 units).";
    case "guard-blocks-face":
      return "A Guard unit blocks the Hex — clear it first.";
    case "commander-shielded":
      return "Their commander is shielded — clear the board first.";
    case "guard-must-be-cleared":
      return "You must attack the Guard unit first.";
    case "attacker-exhausted":
      return "That unit already acted this turn.";
    case "attacker-summoning-sick":
      return "That unit is summoning-sick — it can act next turn.";
    case "attacker-cannot-attack":
      return "That unit can't attack — it holds the line instead.";
    case "spell-target-required":
      return "That spell needs a target — select a unit, then Cast.";
    case "spell-target-not-found":
      return "No valid target for that spell — pick another unit.";
    case "spell-target-stealthed":
    case "defender-is-stealthed":
      return "That unit is stealthed — you can't target it yet.";
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
  // Transient "why did nothing happen?" nudge. A rejected action (guard blocks
  // the nexus, attacker already swung, not enough energy, lane full) used to be
  // a silent no-op that only whispered into the log. We surface the reason on
  // the action bar so the player isn't left wondering. Cleared on any success.
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const builtDeck = buildPlayerDeck(ownedCardIds);
  const deckSource = builtDeck.source;
  const ownedPlayable = builtDeck.ownedPlayable;

  // Track the owned ids the currently-loaded match was built from, so we can
  // detect a wallet connecting/changing mid-session and rebuild without looping.
  const loadedOwnedKey = useRef<string>((ownedCardIds ?? []).join(","));
  // Guards the AI effect so P2's turn is only ever driven once.
  const aiRunningRef = useRef(false);
  // True while this hook's component is mounted. The AI setTimeout below resolves
  // asynchronously; if the user navigates away mid-AI-turn we must not call
  // setMatch on an unmounted component (state-update warning + leak).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const winner: PlayerId | null = detectWinner(match);

  // OPENING MULLIGAN (PART 1): the explicit phase is OPEN while P1 is still
  // `pending`. The dedicated mulligan screen renders off this flag; the normal
  // board stays mounted but inert (the reducer gate rejects every other action).
  const mulliganPhaseActive: boolean = requireMulligan(match);
  const mulliganHand: string[] = mulliganPhaseActive ? (match.players.P1.hand ?? []) : [];

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
    if (rejected && rejected.type === "REJECTED") {
      const text = rejectReasonText(rejected.reason);
      if (text) {
        appendLog(text);
        setActionMessage(text);
      }
      return false;
    }
    setActionMessage(null);

    // Drain any mid-resolution CHOICE the action raised (a DISCOVER spell sets
    // state.pendingChoice). The live UI has no choice-picker yet, so an unresolved
    // pendingChoice would WEDGE the match — every later action rejects
    // 'choice-pending' and only RESET escapes. Auto-resolve deterministically with
    // the same autoPickOption + RESOLVE_CHOICE drain the engine harnesses use, to a
    // fixed point. No DISCOVER card is auto-drafted today (buildOwnedDeck excludes
    // them), so this is belt-and-suspenders against any future content/path that
    // lands one. No-op for every shipped action (no pendingChoice → loop skipped).
    let settled = nextState;
    const allEvents = [...events];
    let guard = 0;
    while (settled.pendingChoice && guard < 64) {
      guard += 1;
      const optionId = autoPickOption(settled);
      if (optionId == null) break;
      const res = applyAction(settled, {
        type: "RESOLVE_CHOICE",
        player: settled.pendingChoice.controller,
        optionId,
      });
      settled = res.state;
      for (const ev of res.events) allEvents.push(ev);
    }

    setMatch(settled);
    for (const ev of allEvents) {
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

  // THE SURGE (#4 — the "Snap" beat). The human is always P1; available once per
  // match, on your own turn, after any mulligan, while the ruleset enables it.
  const canSurge =
    !winner &&
    activePlayer === "P1" &&
    !mulliganPhaseActive &&
    !!match.rules?.surge &&
    !match.players.P1.surgeUsed;

  const surge = () => {
    if (!canSurge) return;
    dispatch({ type: "SURGE", player: "P1" });
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

  /**
   * Cast the selected SPELL. Targeted spells (damage / heal / debuff) need a
   * board target — the caller passes the currently-selected board unit's id, if
   * any. Untargeted spells ignore it. The reducer rejects (and the action bar
   * surfaces) "spell-target-required" / "spell-target-not-found" /
   * "spell-target-stealthed" when the target is missing or illegal, so the UI
   * doesn't need to duplicate the engine's targeting rules.
   */
  const playSelectedSpell = (targetInstanceId?: string) => {
    if (winner) return;
    if (!selectedHandCard || selectedHandCard.type !== "spell" || selectedHandIndex < 0) return;
    consumeMulligan();
    if (
      dispatch({
        type: "PLAY_SPELL",
        player: activePlayer,
        handIndex: selectedHandIndex,
        targetInstanceId,
      })
    ) {
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

  /**
   * OPENING MULLIGAN (PART 1) — resolve P1's opening hand during the explicit
   * phase. `indices` are the opening-hand slots the player chose to REDRAW (empty
   * = keep everything). We dispatch the phase-aware `MULLIGAN { cards }` action;
   * because the phase was opened for P1 only, P2 is already `done`, so this single
   * resolution closes the gate and normal play begins. The once-only legacy
   * "Recalibrate Hand" button is spent here too so the player can't double-dip.
   */
  const resolveMulligan = (indices: number[]) => {
    if (!mulliganPhaseActive) return;
    const { state: nextState, events } = applyAction(match, { type: "MULLIGAN", player: "P1", cards: indices });
    if (events.some((e) => e.type === "REJECTED")) return;
    setMulliganAvailable(false);
    setSelectedHandId(null);
    setMatch(nextState);
    appendLog(
      indices.length > 0
        ? `Opening hand recalibrated — ${indices.length} card${indices.length === 1 ? "" : "s"} redrawn.`
        : "Opening hand kept — signal locked."
    );
  };

  const resetMatch = () => {
    // RUN IT BACK KEEPS REWARDS (teardown "Earn/progress" + Book ruling): the
    // device ⬡ HEX / pass XP / matchesTotal grant lived ONLY on /match-results,
    // so rematching from the ceremony forfeited the match you just finished.
    // Bank the DECIDED match before discarding it. Once-per-match by
    // construction: a decided match can only be reset once (the fresh match has
    // no winner), and the "View rewards" path navigates away — it never reaches
    // this reset — so the two grant paths are mutually exclusive. Mid-match
    // resets (no winner) bank nothing. Quest/sigil rewards already recorded at
    // decide-time via useMatchRewards (new seed below re-arms it for the rematch).
    if (winner) {
      try {
        applyMatchRewards({ winner, turn: match.turn ?? 0 });
      } catch {
        /* storage unavailable — never block the rematch */
      }
    }
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

    // Collected step timers so teardown cancels every pending commit.
    const stepTimers: ReturnType<typeof setTimeout>[] = [];

    const mapAiAction = (
      a: ReturnType<typeof planP2Turn>[number],
      state: any,
    ): Action | null => {
      if (a.kind === "playUnit") {
        const idx = (state.players.P2.hand ?? []).indexOf(a.cardId);
        return idx < 0 ? null : { type: "PLAY_UNIT", player: "P2", handIndex: idx, lane: a.lane };
      } else if (a.kind === "playArtifact") {
        const idx = (state.players.P2.hand ?? []).indexOf(a.cardId);
        return idx < 0 ? null : { type: "PLAY_ARTIFACT", player: "P2", handIndex: idx };
      } else if (a.kind === "playSpell") {
        const idx = (state.players.P2.hand ?? []).indexOf(a.cardId);
        return idx < 0 ? null : { type: "PLAY_SPELL", player: "P2", handIndex: idx, targetInstanceId: a.targetInstanceId };
      } else if (a.kind === "equip") {
        const idx = (state.players.P2.hand ?? []).indexOf(a.cardId);
        return idx < 0 ? null : { type: "EQUIP", player: "P2", handIndex: idx, targetInstanceId: a.targetInstanceId };
      } else if (a.kind === "attackUnit") {
        return { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: a.attackerInstanceId, defenderInstanceId: a.defenderInstanceId };
      } else if (a.kind === "attackFace") {
        return { type: "ATTACK_FACE", player: "P2", attackerInstanceId: a.attackerInstanceId };
      } else if (a.kind === "surge") {
        return { type: "SURGE", player: "P2" };
      }
      return null;
    };

    const timer = setTimeout(() => {
      // Bail out if torn down between scheduling and firing — no state updates
      // on an unmounted component.
      if (!mountedRef.current) return;

      // PASS 1 — compute the full ordered action list against a private copy of
      // the state (pure, no UI commit). The reducer logic is byte-identical to
      // before; we're only deferring the COMMITS, not changing the plan.
      let plan: { action: Action; isStep: boolean }[] = [];
      let scratch = match;
      const planAndPush = (a: ReturnType<typeof planP2Turn>[number]) => {
        const action = mapAiAction(a, scratch);
        if (!action) return;
        const { state: nextState } = applyAction(scratch, action);
        scratch = nextState;
        // Deploys and attacks are the "watchable" beats the player should SEE
        // animate one at a time; everything else (equips, spells, end-turn) is
        // folded into the trailing batch.
        const isStep = a.kind === "playUnit" || a.kind === "attackUnit" || a.kind === "attackFace";
        plan.push({ action, isStep });
      };
      try {
        // VISIBLE TIERS ONLY (Book game ruling): the AI plays exactly the tier
        // the player picked in DifficultySelect (Initiate/Veteran/Sovereign →
        // easy/normal/hard). The old hidden lifetime-match ramp silently made
        // every "Run It Back" harder — it is gone; no explicit pick = Veteran.
        const diff = readAiDifficulty();
        // Two-phase: all plays first, THEN combat off the post-play board so a
        // freshly-summoned RUSH unit can swing.
        for (const a of planP2Plays(scratch, diff)) {
          if (scratch.winner) break;
          planAndPush(a);
        }
        // THE SURGE (#4): between plays and combat, snap to ready the just-played
        // units IFF it converts the turn to lethal (planP2Surge is lethal-only). The
        // readied units then enter planP2Combat below as live attackers for the kill.
        if (!scratch.winner) {
          for (const a of planP2Surge(scratch, diff)) planAndPush(a);
        }
        for (const a of planP2Combat(scratch, diff)) {
          if (scratch.winner) break;
          planAndPush(a);
        }
      } catch {
        // Planning failed — fall through; the END_TURN below keeps the game live.
      }
      const endsTurn = !scratch.winner;

      // PASS 2 — replay the plan, committing one action per render. Because the
      // motion/sound hooks diff state-to-state, committing each AI deploy/attack
      // separately makes the EXISTING juice (lunge, particles, sound, deploy
      // ring) fire per-event — exactly like a human turn. Before this, the whole
      // AI turn collapsed into ONE diff and the player never saw the opponent act.
      let live = match;
      const commitOne = (action: Action) => {
        const { state: nextState, events } = applyAction(live, action);
        live = nextState;
        if (!mountedRef.current) return;
        setMatch(live);
        for (const ev of events) {
          const line = eventToLogText(ev);
          if (line) appendLog(line);
        }
      };

      // Reduced-motion (or an empty plan): no per-step pacing — single commit,
      // identical to the original behavior, so accessibility users and harnesses
      // see no animation churn.
      const stepped = !prefersReducedMotionLive() && plan.some((p) => p.isStep);

      if (!stepped) {
        for (const p of plan) commitOne(p.action);
        if (endsTurn) commitOne({ type: "END_TURN", player: "P2" });
        aiRunningRef.current = false;
        if (!mountedRef.current) return;
        setSelectedHandId(null);
        setSelectedBoardId(null);
        return;
      }

      // Staggered cadence: ~520ms between watchable beats (attack lunge is
      // 460ms, so this leaves headroom); tighten on a long turn so a big board
      // doesn't drag. Non-step actions ride on the previous beat's tick.
      const stepCount = plan.filter((p) => p.isStep).length;
      const gap = stepCount > 5 ? 360 : 520;
      let delay = 0;
      let pending: Action[] = [];
      const flushAt = (atDelay: number, actions: Action[]) => {
        const batch = actions.slice();
        stepTimers.push(
          setTimeout(() => {
            if (!mountedRef.current) return;
            for (const act of batch) commitOne(act);
          }, atDelay),
        );
      };
      for (const p of plan) {
        pending.push(p.action);
        if (p.isStep) {
          flushAt(delay, pending);
          pending = [];
          delay += gap;
        }
      }
      // Trailing non-step actions + END_TURN on a final tick.
      const tail: Action[] = [...pending];
      if (endsTurn) tail.push({ type: "END_TURN", player: "P2" });
      stepTimers.push(
        setTimeout(() => {
          if (!mountedRef.current) return;
          for (const act of tail) commitOne(act);
          aiRunningRef.current = false;
          setSelectedHandId(null);
          setSelectedBoardId(null);
        }, delay),
      );
    }, 600);

    return () => {
      clearTimeout(timer);
      for (const t of stepTimers) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.activePlayer, match.turn, winner]);

  return {
    deckSource,
    ownedPlayable,
    match,
    winner,
    activePlayer,
    inactivePlayer,
    selectedHandId,
    selectedBoardId,
    inspectId,
    combatLog,
    actionMessage,
    selectedHandCard,
    selectedHandIndex,
    mulliganAvailable,
    mulliganPhaseActive,
    mulliganHand,
    // Always MY (P1's) pool — never the active player's (teardown §7). The old
    // shape switched to the OPPONENT's energy during the AI turn, so the topbar
    // silently changed meaning every turn and the hand re-dimmed against the
    // enemy's pool. This hook is the local solo hook; the human is always P1.
    energy: match.players.P1.energy ?? 0,
    maxEnergy: match.players.P1.maxEnergy ?? BASE_MAX_ENERGY,
    affordableCostFor: (cardId: string) => costOf(cardId) <= (match.players.P1.energy ?? 0),
    setSelectedHandId,
    setSelectedBoardId,
    setInspectId,
    endTurn,
    canSurge,
    surge,
    playSelectedUnit,
    playSelectedArtifact,
    playSelectedSpell,
    equipSelectedToUnit,
    attackUnit,
    attackFace,
    mulligan,
    resolveMulligan,
    resetMatch
  };
}
