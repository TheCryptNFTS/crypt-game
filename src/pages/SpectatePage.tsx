import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CryptMatchBoard } from "../components/live-match/CryptMatchBoard";
import { BASE_MAX_ENERGY } from "../engine/state";
import {
  fetchLiveMatches,
  fetchSpectatorView,
  type LiveMatchSummary,
} from "../services/spectateApi";

/**
 * SPECTATE / "Watch live" page.
 *
 * Two modes off one component:
 *   1. LIST  — polls `fetchLiveMatches()` and shows the in-progress PUBLIC
 *      matches available to watch. Guest/offline => null => a calm empty state
 *      ("No live matches to watch right now"), never an error.
 *   2. WATCH — selecting a match polls `fetchSpectatorView(matchId, since)` with
 *      the SAME `since`-poll model as the player transport and renders the shared
 *      `CryptMatchBoard` in NON-INTERACTIVE spectator mode (no action bar, no
 *      clickable hand/attack). A "SPECTATING" banner sits above the board.
 *
 * SECURITY: the `view` is redacted SERVER-SIDE (both hands count-only, no deck
 * order, no secrets). This page never receives — and so can never leak — either
 * player's hidden information. It is strictly read-only: there is no action path.
 *
 * The integrator wires the route (suggested `/spectate`); this file only exports
 * the default `SpectatePage`.
 */

type PlayerId = "P1" | "P2";

/** The redacted side shape the spectator view carries (no `hand` array). */
interface SpectatorSide {
  nexusHealth?: number;
  energy?: number;
  maxEnergy?: number;
  handCount?: number;
  deckCount?: number;
  board?: { front?: unknown[]; back?: unknown[] };
  artifacts?: unknown[];
}

/** The neutral spectator `MatchView` (mirrors server `view.ts` MatchView). */
interface SpectatorMatchView {
  matchId: string;
  turn?: number;
  activePlayer?: PlayerId;
  winner?: PlayerId | null;
  mySeat?: PlayerId;
  self: SpectatorSide;
  opponent: SpectatorSide;
}

const FACE_DOWN_PREFIX = "facedown_";

/**
 * Adapt the neutral redacted `view` into the loose `match`-ish shape the board +
 * `liveMatchAdapter` VMs read. Both hands are count-only here, so we emit
 * face-down placeholders for the opponent and leave the own hand empty (the
 * board's spectator branch renders the own hand from `handCount` as face-down).
 * No real card id ever exists in this structure — fog of war is enforced
 * server-side and preserved here.
 */
function spectatorViewToMatch(view: SpectatorMatchView): any {
  const seat: PlayerId = view.mySeat ?? "P1";
  const oppSeat: PlayerId = seat === "P1" ? "P2" : "P1";

  const side = (s: SpectatorSide, id: PlayerId, hand: string[]) => ({
    id,
    hand,
    board: {
      front: (s.board?.front ?? []) as any[],
      back: (s.board?.back ?? []) as any[],
    },
    artifacts: (s.artifacts ?? []) as any[],
    nexusHealth: s.nexusHealth ?? 20,
    energy: s.energy ?? 0,
    maxEnergy: s.maxEnergy ?? BASE_MAX_ENERGY,
    deck: [],
    deckCount: s.deckCount ?? 0,
    handCount: s.handCount ?? 0,
    cardModifiers: {},
  });

  const oppCount = view.opponent.handCount ?? 0;
  const oppHand = Array.from({ length: oppCount }, (_, i) => `${FACE_DOWN_PREFIX}${i}`);

  const players: Record<PlayerId, any> = { P1: undefined as any, P2: undefined as any };
  // `self` hand is left EMPTY; the board's spectator branch synthesizes the
  // face-down own-hand from `handCount`, so both hands render hidden.
  players[seat] = side(view.self, seat, []);
  players[oppSeat] = side(view.opponent, oppSeat, oppHand);

  return {
    matchId: view.matchId,
    turn: view.turn ?? 1,
    activePlayer: view.activePlayer ?? "P1",
    winner: view.winner ?? null,
    players,
  };
}

/** Stable no-op so the board's required handler props are satisfied. The board
 *  ALSO neutralises these in spectator mode; passing no-ops is belt-and-braces. */
const NOOP = () => {};

function LiveList({
  onWatch,
}: {
  onWatch: (m: LiveMatchSummary) => void;
}) {
  const [matches, setMatches] = useState<LiveMatchSummary[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const list = await fetchLiveMatches();
    if (!mounted.current) return;
    setMatches(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const empty = loaded && (matches === null || matches.length === 0);

  return (
    <div className="spectate-list">
      <header className="spectate-list__head">
        <h1>Watch Live</h1>
        <p className="spectate-list__sub">
          Public ladder matches in progress. Observe only — both hands stay hidden.
        </p>
      </header>

      {empty ? (
        <div className="spectate-empty">No live matches to watch right now.</div>
      ) : (
        <ul className="spectate-rows">
          {(matches ?? []).map((m) => (
            <li key={m.matchId} className="spectate-row">
              <div className="spectate-row__players">
                <span className="spectate-row__p">{m.p1Label}</span>
                <span className="spectate-row__vs">vs</span>
                <span className="spectate-row__p">{m.p2Label}</span>
              </div>
              <div className="spectate-row__meta">Turn {m.turn}</div>
              <button
                type="button"
                className="live-btn"
                onClick={() => onWatch(m)}
              >
                Watch
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WatchView({
  summary,
  onLeave,
}: {
  summary: LiveMatchSummary;
  onLeave: () => void;
}) {
  const [view, setView] = useState<SpectatorMatchView | null>(null);
  const [version, setVersion] = useState(0);
  const [lost, setLost] = useState(false);
  const versionRef = useRef(0);
  versionRef.current = version;
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    const res = await fetchSpectatorView(summary.matchId, versionRef.current);
    if (!mounted.current) return;
    if (!res) {
      // Match ended / became unavailable / private — drop back to the list.
      setLost(true);
      return;
    }
    setLost(false);
    // Adopt only when strictly newer (a `stale` poll returns the same version).
    if (res.version >= versionRef.current) {
      setView(res.view as SpectatorMatchView);
      setVersion(res.version);
    }
  }, [summary.matchId]);

  useEffect(() => {
    mounted.current = true;
    void poll();
    const t = setInterval(() => void poll(), 1800);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [poll]);

  const seat: PlayerId = view?.mySeat ?? "P1";
  const match = useMemo(() => (view ? spectatorViewToMatch(view) : null), [view]);
  const winner: PlayerId | null = view?.winner ?? null;
  const activePlayer: PlayerId = view?.activePlayer ?? "P1";

  const banner = (
    <div
      className="live-deckhint"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
    >
      <span style={{ letterSpacing: "0.18em", fontWeight: 700 }}>
        {"\u2B22"} SPECTATING — {summary.p1Label} vs {summary.p2Label}
        {winner ? ` · ${winner === seat ? summary.p1Label : summary.p2Label} won` : ""}
      </span>
      <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
        Leave
      </button>
    </div>
  );

  if (lost && !match) {
    return (
      <div className="spectate-list">
        <div className="spectate-empty">This match has ended.</div>
        <button type="button" className="live-btn" onClick={onLeave}>
          Back to live matches
        </button>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="spectate-list">
        <div className="spectate-empty">Connecting to the match…</div>
        <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="crypt-shell">
      <div className="crypt-shell__bg" />
      <CryptMatchBoard
        spectator
        mySeat={seat}
        match={match}
        winner={winner}
        activePlayer={activePlayer}
        selectedHandId={null}
        selectedBoardId={null}
        inspectId={null}
        combatLog={[{ id: "boot", text: "Spectating — server authoritative, read-only." }]}
        selectedHandCard={null}
        mulliganAvailable={false}
        energy={match.players[seat]?.energy ?? 0}
        maxEnergy={match.players[seat]?.maxEnergy ?? BASE_MAX_ENERGY}
        deckSource="owned"
        affordableCostFor={() => false}
        setSelectedHandId={NOOP}
        setSelectedBoardId={NOOP}
        setInspectId={NOOP}
        endTurn={NOOP}
        playSelectedUnit={NOOP}
        playSelectedArtifact={NOOP}
        equipSelectedToUnit={NOOP}
        attackUnit={NOOP}
        attackFace={NOOP}
        mulligan={NOOP}
        resetMatch={onLeave}
        statusBanner={banner}
      />
    </div>
  );
}

export default function SpectatePage() {
  const [watching, setWatching] = useState<LiveMatchSummary | null>(null);

  if (watching) {
    return <WatchView summary={watching} onLeave={() => setWatching(null)} />;
  }
  return <LiveList onWatch={setWatching} />;
}
