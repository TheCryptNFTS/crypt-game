import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Action } from "../engine/reducer";
import { BASE_MAX_ENERGY } from "../engine/state";
import { allPlayableCards } from "../engine/cards";
import { getAuthHeader } from "../nft/gameSession";

/**
 * REMOTE Crypt match hook — the server-authoritative twin of
 * `useLocalCryptMatch`. It MIRRORS that hook's return surface so
 * `LiveCryptMatchPage` can swap between them with no UI changes.
 *
 * Authority model: this client NEVER runs the reducer for truth. Every action
 * is sent to the server (`POST /api/match/[id]/action`), which validates against
 * the authoritative engine and returns a redacted `view` + monotonically
 * increasing `version`. We render an OPTIMISTIC echo while in flight, then
 * reconcile: a 200 adopts the authoritative view; a 422 (illegal) or 409
 * (stale/conflict) rolls the echo back and refetches.
 *
 * The opponent's hand is hidden by the server (count only), so we synthesize
 * face-down placeholder ids for it — they render as backs and are never
 * inspectable as real cards.
 */

type PlayerId = "P1" | "P2";
type Lane = "front" | "back";

type CombatLogEntry = { id: string; text: string };

type ViewSide = {
  nexusHealth?: number;
  energy?: number;
  maxEnergy?: number;
  hand?: unknown[];
  board?: { front?: unknown[]; back?: unknown[] };
  artifacts?: unknown[];
  handCount?: number;
  deckCount?: number;
};

export type MatchView = {
  matchId: string;
  turn?: number;
  activePlayer: PlayerId;
  winner?: PlayerId | null;
  mySeat: PlayerId;
  joinCode?: string;
  self: ViewSide;
  opponent: ViewSide;
};

type ConnectionState = "connecting" | "live" | "reconnecting" | "ended";

const cardMetaById = new Map<string, any>((allPlayableCards as any[]).map((c) => [c.id, c]));

function costOf(cardId: string): number {
  return cardMetaById.get(cardId)?.cost ?? 0;
}

function CITY_BASE(): string {
  return (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_CITY_API_BASE || "https://freeloncity.com"
  );
}

/** A server `Card` may arrive as a bare cardId string or an object — normalize
 *  to the cardId string the local VM adapters (handToVm) expect. */
function toCardId(card: unknown): string {
  if (typeof card === "string") return card;
  const obj = card as { id?: string; cardId?: string } | null;
  return obj?.cardId ?? obj?.id ?? "unknown";
}

const FACE_DOWN_PREFIX = "facedown_";

/** localStorage key (shared with PvpLobby) under which the active match id is
 *  remembered for reconnect-after-refresh. Cleared once the match ends/leaves so
 *  the lobby stops offering to reconnect to a finished match. */
const ACTIVE_MATCH_KEY = "crypt:activeMatchId";

function forgetActiveMatch(): void {
  try {
    window.localStorage.removeItem(ACTIVE_MATCH_KEY);
  } catch {
    /* ignore: storage may be disabled */
  }
}

/**
 * Adapt the redacted server `view` into the loose `match`-ish shape the page +
 * `liveMatchAdapter` VMs read: `match.players.{P1,P2}.{hand,board,artifacts,
 * nexusHealth,energy,maxEnergy,deckCount}`, plus `turn`/`activePlayer`/`winner`.
 *
 * `self` always maps to `mySeat`. The opponent's hand is count-only, so we emit
 * that many face-down placeholder ids (rendered as card backs).
 */
function viewToMatch(view: MatchView): any {
  const mySeat = view.mySeat;
  const oppSeat: PlayerId = mySeat === "P1" ? "P2" : "P1";

  const selfHand = (view.self.hand ?? []).map(toCardId);
  const oppCount = view.opponent.handCount ?? (view.opponent.hand ?? []).length ?? 0;
  const oppHand = Array.from({ length: oppCount }, (_, i) => `${FACE_DOWN_PREFIX}${i}`);

  const sidePlayer = (side: ViewSide, hand: string[], id: PlayerId) => ({
    id,
    hand,
    board: {
      front: (side.board?.front ?? []) as any[],
      back: (side.board?.back ?? []) as any[],
    },
    artifacts: (side.artifacts ?? []) as any[],
    nexusHealth: side.nexusHealth ?? 20,
    energy: side.energy ?? 0,
    maxEnergy: side.maxEnergy ?? BASE_MAX_ENERGY,
    deck: [],
    deckCount: side.deckCount ?? 0,
    handCount: side.handCount ?? hand.length,
    cardModifiers: {},
  });

  const players: Record<PlayerId, any> = {
    P1: undefined as any,
    P2: undefined as any,
  };
  players[mySeat] = sidePlayer(view.self, selfHand, mySeat);
  players[oppSeat] = sidePlayer(view.opponent, oppHand, oppSeat);

  return {
    matchId: view.matchId,
    turn: view.turn ?? 1,
    activePlayer: view.activePlayer,
    winner: view.winner ?? null,
    players,
  };
}

/** True for the synthetic opponent face-down placeholders. */
export function isFaceDownId(id: string): boolean {
  return typeof id === "string" && id.startsWith(FACE_DOWN_PREFIX);
}

type RemoteOptions = {
  matchId: string;
  initialView: MatchView;
  initialVersion: number;
  mySeat: PlayerId;
  /** Called when the player leaves (resetMatch) — return to lobby. */
  onLeave?: () => void;
};

export function useRemoteCryptMatch(opts: RemoteOptions) {
  const { matchId, initialView, initialVersion, mySeat } = opts;

  const [view, setView] = useState<MatchView>(initialView);
  const [version, setVersion] = useState<number>(initialVersion);
  const [connectionState, setConnectionState] = useState<ConnectionState>("live");
  const [reconnecting, setReconnecting] = useState(false);
  const [pending, setPending] = useState(false);

  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([
    { id: "boot", text: "PvP signal live — server authoritative." },
  ]);

  // Latest version in a ref so the poll loop always sends the freshest `since`.
  const versionRef = useRef(version);
  versionRef.current = version;
  const mountedRef = useRef(true);

  const appendLog = useCallback((text: string) => {
    setCombatLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text }, ...prev].slice(0, 40));
  }, []);

  const match = useMemo(() => viewToMatch(view), [view]);

  const winner: PlayerId | null = view.winner ?? null;
  const activePlayer: PlayerId = view.activePlayer;
  const inactivePlayer: PlayerId = activePlayer === "P1" ? "P2" : "P1";

  // It is only MY turn (and actions are only legal) when the server says the
  // active player is my seat and the match is undecided.
  const myTurn = activePlayer === mySeat && !winner;

  const selectedHandIndex = useMemo(() => {
    if (!selectedHandId) return -1;
    const hand: string[] = match.players[mySeat]?.hand ?? [];
    return hand.findIndex((id: string) => id === selectedHandId);
  }, [match, mySeat, selectedHandId]);

  const selectedHandCardId =
    selectedHandIndex >= 0 ? match.players[mySeat].hand[selectedHandIndex] : null;
  const selectedHandCard =
    selectedHandCardId && !isFaceDownId(selectedHandCardId)
      ? (allPlayableCards as any[]).find((c) => c.id === selectedHandCardId) ?? null
      : null;

  const myEnergy = match.players[mySeat]?.energy ?? 0;
  const myMaxEnergy = match.players[mySeat]?.maxEnergy ?? BASE_MAX_ENERGY;

  /**
   * Send an action to the server with optimistic echo + reconcile.
   *
   * Optimism here is conservative: we don't try to re-run the reducer locally
   * (we lack authority + full state), so the "echo" is a UI lock (`pending`)
   * plus a log breadcrumb. On 200 we adopt the authoritative view; on 422/409
   * we roll the lock back and refetch the latest server view. This keeps the
   * board always equal to server truth while still giving instant feedback.
   */
  const sendAction = useCallback(
    async (action: Action, echoText: string) => {
      if (!myTurn || pending) return;
      setPending(true);
      appendLog(echoText);
      const sentVersion = versionRef.current;
      try {
        const res = await fetch(`${CITY_BASE()}/api/match/${matchId}/action`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ version: sentVersion, action }),
        });

        if (res.status === 200) {
          const data = (await res.json()) as { version: number; view: MatchView; events?: unknown[] };
          if (!mountedRef.current) return;
          setView(data.view);
          setVersion(data.version);
          setSelectedHandId(null);
          setSelectedBoardId(null);
        } else if (res.status === 422) {
          // Illegal move — roll back the optimistic echo, adopt the returned
          // view if present (server may include corrected state), else refetch.
          const data = (await res.json().catch(() => null)) as { view?: MatchView; rejected?: boolean } | null;
          if (!mountedRef.current) return;
          appendLog("Move rejected by server.");
          if (data?.view) setView(data.view);
          else await refetch();
        } else if (res.status === 409) {
          // Stale/conflict — our `since` lost a race. Refetch authoritative.
          if (!mountedRef.current) return;
          appendLog("State changed — resyncing.");
          await refetch();
        } else if (res.status === 403) {
          if (!mountedRef.current) return;
          appendLog("Not authorized for this action.");
        }
      } catch {
        if (!mountedRef.current) return;
        appendLog("Network error — resyncing.");
        await refetch();
      } finally {
        if (mountedRef.current) setPending(false);
      }
    },
    // refetch is stable (defined below via useCallback); listed in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, myTurn, pending, appendLog],
  );

  /** GET the authoritative view (optionally only if newer than `since`). */
  const refetch = useCallback(
    async (since?: number) => {
      try {
        const url = `${CITY_BASE()}/api/match/${matchId}${
          since !== undefined ? `?since=${since}` : ""
        }`;
        const res = await fetch(url, {
          headers: { accept: "application/json", ...getAuthHeader() },
        });
        if (!res.ok) {
          if (mountedRef.current) {
            setReconnecting(true);
            setConnectionState("reconnecting");
          }
          return;
        }
        const data = (await res.json()) as { version?: number; view?: MatchView; stale?: boolean };
        if (!mountedRef.current) return;
        setReconnecting(false);
        if (data.stale) {
          // No newer state than `since` — nothing to do.
          setConnectionState((s) => (s === "ended" ? s : "live"));
          return;
        }
        if (data.view && typeof data.version === "number") {
          // Only adopt if strictly newer to avoid clobbering an in-flight echo.
          if (data.version >= versionRef.current) {
            setView(data.view);
            setVersion(data.version);
          }
          setConnectionState(data.view.winner ? "ended" : "live");
        }
      } catch {
        if (mountedRef.current) {
          setReconnecting(true);
          setConnectionState("reconnecting");
        }
      }
    },
    [matchId],
  );

  // --- Action handlers: mirror useLocalCryptMatch, but server-authoritative.
  // Each builds the matching reducer Action with `player: mySeat`.

  const endTurn = useCallback(() => {
    if (!myTurn) return;
    void sendAction({ type: "END_TURN", player: mySeat }, "You ended your turn.");
  }, [myTurn, mySeat, sendAction]);

  const playSelectedUnit = useCallback(
    (lane: Lane) => {
      if (!myTurn || !selectedHandCard || selectedHandCard.type !== "unit" || selectedHandIndex < 0) return;
      void sendAction(
        { type: "PLAY_UNIT", player: mySeat, handIndex: selectedHandIndex, lane },
        `You deploy ${selectedHandCard.name} to ${lane}.`,
      );
    },
    [myTurn, mySeat, selectedHandCard, selectedHandIndex, sendAction],
  );

  const playSelectedArtifact = useCallback(() => {
    if (!myTurn || !selectedHandCard || selectedHandCard.type !== "artifact" || selectedHandIndex < 0) return;
    void sendAction(
      { type: "PLAY_ARTIFACT", player: mySeat, handIndex: selectedHandIndex },
      `You activate ${selectedHandCard.name}.`,
    );
  }, [myTurn, mySeat, selectedHandCard, selectedHandIndex, sendAction]);

  const equipSelectedToUnit = useCallback(
    (targetInstanceId: string) => {
      if (!myTurn || !selectedHandCard || selectedHandCard.type !== "equipment" || selectedHandIndex < 0) return;
      void sendAction(
        { type: "EQUIP", player: mySeat, handIndex: selectedHandIndex, targetInstanceId },
        `You equip ${selectedHandCard.name}.`,
      );
    },
    [myTurn, mySeat, selectedHandCard, selectedHandIndex, sendAction],
  );

  const attackUnit = useCallback(
    (attackerInstanceId: string, defenderInstanceId: string) => {
      if (!myTurn) return;
      void sendAction(
        { type: "ATTACK_UNIT", player: mySeat, attackerInstanceId, defenderInstanceId },
        "You strike an enemy unit.",
      );
    },
    [myTurn, mySeat, sendAction],
  );

  const attackFace = useCallback(
    (attackerInstanceId: string) => {
      if (!myTurn) return;
      void sendAction(
        { type: "ATTACK_FACE", player: mySeat, attackerInstanceId },
        "You strike the enemy nexus.",
      );
    },
    [myTurn, mySeat, sendAction],
  );

  const mulligan = useCallback(() => {
    if (!myTurn) return;
    void sendAction({ type: "MULLIGAN", player: mySeat }, "You recalibrate your hand.");
  }, [myTurn, mySeat, sendAction]);

  /**
   * Concede the match (forfeit → opponent wins). Server-authoritative: we POST
   * the concede and adopt the returned decided view. The match is terminal after
   * this; the poll loop will keep showing the ended state. Safe to call once.
   */
  const concede = useCallback(async () => {
    if (winner) return;
    appendLog("You concede the match.");
    try {
      const res = await fetch(`${CITY_BASE()}/api/match/${matchId}/concede`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...getAuthHeader(),
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { version: number; view: MatchView };
        if (!mountedRef.current) return;
        setView(data.view);
        setVersion(data.version);
        setConnectionState("ended");
      } else {
        await refetch();
      }
    } catch {
      if (mountedRef.current) await refetch();
    }
    // refetch is stable (useCallback); appendLog stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, winner, appendLog]);

  // resetMatch in PvP has NO local re-shuffle authority — it leaves the match
  // and returns to the lobby (the server owns match lifecycle). Leaving also
  // forgets the remembered match so the lobby won't offer to reconnect to it.
  const resetMatch = useCallback(() => {
    forgetActiveMatch();
    opts.onLeave?.();
  }, [opts]);

  // Once the match is decided, forget the remembered id so the reconnect prompt
  // never points at a finished match.
  useEffect(() => {
    if (winner) forgetActiveMatch();
  }, [winner]);

  // --- Poll loop. Cadence: brisk while it's the OPPONENT's turn (we're waiting
  // on them), relaxed while it's OUR turn (our own actions already update us).
  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      await refetch(versionRef.current);
      if (!mountedRef.current) return;
      const opponentTurn = activePlayer !== mySeat && !winner;
      const delay = winner ? 8000 : opponentTurn ? 1800 : 6000;
      timer = setTimeout(tick, delay);
    };

    // First poll after the active-turn-appropriate delay.
    const opponentTurn = activePlayer !== mySeat && !winner;
    timer = setTimeout(tick, opponentTurn ? 1800 : 6000);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activePlayer, mySeat, winner, refetch]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    // Mirror of useLocalCryptMatch's surface.
    deckSource: "owned" as const,
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
    // PvP has no client-side one-time mulligan gate; gate on turn + server rules.
    mulliganAvailable: myTurn,
    energy: myEnergy,
    maxEnergy: myMaxEnergy,
    affordableCostFor: (cardId: string) =>
      !isFaceDownId(cardId) && costOf(cardId) <= myEnergy,
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
    resetMatch,
    concede,
    // Extra PvP-only fields (page can ignore; lobby/status may use them).
    mySeat,
    version,
    connectionState,
    reconnecting,
    pending,
    myTurn,
  };
}
