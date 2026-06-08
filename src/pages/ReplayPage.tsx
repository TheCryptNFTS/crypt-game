/**
 * REPLAY VIEWER (`/replay?code=...`) — the read-only consumer side of the match
 * replay codec. A replay carries ONLY `(seed, actions)` (plus an optional deck
 * bootstrap), because the engine is deterministic: feeding that exact action log
 * back through the SAME `applyAction` the live game uses re-derives the
 * byte-identical match. So this page does NOT trust any embedded final state — it
 * REBUILDS the match from the seed and folds every action through the reducer,
 * snapshotting state after each step so the scrubber can show intermediate
 * positions. No engine forking, no second code path: same reducer as live play.
 *
 * OWN ONLY this file + a single lazy `/replay` route in router.tsx.
 */

import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { decodeReplay, type ShareableReplay } from "../share/replayCodec";
import { applyAction, autoPickOption, type Action } from "../engine/reducer";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import {
  BASE_MAX_ENERGY,
  STARTING_NEXUS_HEALTH,
  type MatchState,
  type UnitInPlay,
} from "../engine/state";
import { getAnyCardById } from "../engine/cards";
import { getCommanderById } from "../engine/commanders";
import { absoluteUrl } from "../lib/share";

/* -------------------------------------------------------------------------- */
/* Re-derivation: seed + actions -> a sequence of MatchState snapshots.        */
/* -------------------------------------------------------------------------- */

/**
 * Build the EXACT starting match a replay re-derives from. If the replay embeds a
 * deck bootstrap (`p1`/`p2`) we honour it; otherwise we fall back to the same
 * default seeded match the determinism harness uses, so a bare `(seed, actions)`
 * replay still re-derives cleanly. Seeding mirrors the live hook (base energy +
 * nexus pool) so the opening matches what players actually saw.
 */
function buildInitialMatch(replay: ShareableReplay): MatchState {
  const handSize = typeof replay.openingHandSize === "number" ? replay.openingHandSize : 6;

  let p1 = replay.p1
    ? { commanderId: replay.p1.commanderId, deck: replay.p1.cards }
    : null;
  let p2 = replay.p2
    ? { commanderId: replay.p2.commanderId, deck: replay.p2.cards }
    : null;

  if (!p1 || !p2) {
    const c1 = allCommanders[0];
    const c2 = allCommanders.find((c) => c.id !== c1.id) ?? c1;
    const deck = buildPlayerDeck().deck;
    p1 = p1 ?? { commanderId: c1.id, deck };
    p2 = p2 ?? { commanderId: c2.id, deck };
  }

  const match = createMatchFromDecks({
    p1,
    p2,
    seed: replay.seed,
    openingHandSize: handSize,
  }) as MatchState;

  match.activePlayer = match.activePlayer ?? "P1";
  match.turn = match.turn ?? 1;
  match.winner = match.winner ?? null;
  match.players.P1.maxEnergy = BASE_MAX_ENERGY;
  match.players.P1.energy = BASE_MAX_ENERGY;
  match.players.P2.maxEnergy = BASE_MAX_ENERGY;
  match.players.P2.energy = BASE_MAX_ENERGY;
  match.players.P1.nexusHealth = match.players.P1.nexusHealth ?? STARTING_NEXUS_HEALTH;
  match.players.P2.nexusHealth = match.players.P2.nexusHealth ?? STARTING_NEXUS_HEALTH;

  return match;
}

interface Derivation {
  /** One snapshot per scrub position: index 0 = opening, i = after action i-1. */
  frames: MatchState[];
  applied: number;
  total: number;
  final: MatchState;
}

/**
 * Fold the action log through the reducer, capturing a snapshot after each step.
 * Any mid-resolution CHOICE the log did not pre-resolve is drained with the same
 * deterministic auto-pick the harness uses, so a viewer never wedges on a pause.
 * A rejected action (reducer returns the same state reference) is tolerated — it
 * simply produces an unchanged frame rather than aborting the whole replay.
 */
function deriveFrames(replay: ShareableReplay): Derivation {
  const start = buildInitialMatch(replay);
  const frames: MatchState[] = [start];
  let state = start;
  const actions = replay.actions as Action[];
  let applied = 0;

  for (const action of actions) {
    let res = applyAction(state, action);
    let next = res.state;
    applied += 1;

    // Drain any raised choice to a fixed point (guarded), mirroring the harness.
    let guard = 0;
    while (next.pendingChoice && guard < 64) {
      guard += 1;
      const optionId = autoPickOption(next);
      if (optionId == null) break;
      res = applyAction(next, {
        type: "RESOLVE_CHOICE",
        player: next.pendingChoice.controller,
        optionId,
      } as Action);
      next = res.state;
    }

    state = next;
    frames.push(state);
    if (state.winner) break;
  }

  return { frames, applied, total: actions.length, final: state };
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                               */
/* -------------------------------------------------------------------------- */

const GOLD = "#e8c473";
const PURPLE = "#7b5cc4";
const WARM_BLACK = "#0d0b12";
const PANEL = "#171320";
const INK = "#efe9f7";
const MUTE = "#a99fc0";

function cardName(id: string): string {
  return getAnyCardById(id)?.name ?? id;
}

function commanderName(id: string | undefined): string {
  if (!id) return "Commander";
  try {
    return getCommanderById(id).name ?? id;
  } catch {
    return id;
  }
}

function UnitChip({ unit }: { unit: UnitInPlay }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 8,
        background: "rgba(123,92,196,0.16)",
        border: `1px solid ${PURPLE}`,
        fontSize: 12,
        color: INK,
        whiteSpace: "nowrap",
      }}
      title={unit.instanceId}
    >
      <span style={{ fontWeight: 600 }}>{cardName(unit.cardId)}</span>
      <span style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>
        {unit.attack}/{unit.health}
      </span>
    </span>
  );
}

function Lane({ label, units }: { label: string; units: UnitInPlay[] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: MUTE }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5, minHeight: 24 }}>
        {units.length === 0 ? (
          <span style={{ color: MUTE, fontSize: 12, fontStyle: "italic" }}>empty</span>
        ) : (
          units.map((u) => <UnitChip key={u.instanceId} unit={u} />)
        )}
      </div>
    </div>
  );
}

function PlayerPanel({
  seat,
  state,
  isWinner,
}: {
  seat: "P1" | "P2";
  state: MatchState;
  isWinner: boolean;
}) {
  const p = state.players[seat];
  return (
    <div
      style={{
        flex: "1 1 280px",
        background: PANEL,
        border: `1px solid ${isWinner ? GOLD : "rgba(123,92,196,0.4)"}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: isWinner ? `0 0 0 1px ${GOLD}, 0 8px 30px rgba(232,196,115,0.12)` : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: MUTE }}>
            {seat}
            {isWinner ? " · winner" : ""}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>
            {commanderName(p.commanderId)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: MUTE }}>HEX</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: GOLD, fontVariantNumeric: "tabular-nums" }}>
            {p.nexusHealth}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: MUTE }}>
        <span>Hand {p.hand.length}</span>
        <span>Deck {p.deckCount}</span>
        <span>Energy {p.energy}/{p.maxEnergy}</span>
      </div>
      <Lane label="Front" units={p.board.front} />
      <Lane label="Back" units={p.board.back} />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <Shell>
      <div
        style={{
          background: PANEL,
          border: `1px solid ${PURPLE}`,
          borderRadius: 14,
          padding: 28,
          maxWidth: 560,
          margin: "60px auto",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: GOLD }}>
          Replay unavailable
        </div>
        <p style={{ color: INK, marginTop: 12, lineHeight: 1.6 }}>{message}</p>
        <a
          href={absoluteUrl("/play")}
          style={{ color: GOLD, textDecoration: "none", fontWeight: 600, fontSize: 14 }}
        >
          ← Back to the field
        </a>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 600px at 50% -10%, rgba(123,92,196,0.18), ${WARM_BLACK})`,
        color: INK,
        fontFamily:
          '"Clash Display", "ClashDisplay", system-ui, -apple-system, Segoe UI, sans-serif',
        padding: "32px 20px 64px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ReplayPage() {
  const location = useLocation();
  const code = useMemo(
    () => new URLSearchParams(location.search).get("code") ?? "",
    [location.search],
  );

  const derived = useMemo<{ data?: Derivation; error?: string }>(() => {
    if (!code) return { error: "No replay code was provided. Add `?code=…` to the URL." };
    try {
      const replay = decodeReplay(code);
      return { data: deriveFrames(replay) };
    } catch (e) {
      return {
        error:
          "This replay code is missing, malformed, or from an unsupported version. " +
          (e instanceof Error ? e.message : ""),
      };
    }
  }, [code]);

  // Scrub position: 0 = opening, frames.length-1 = final. Hooks must run before
  // any early return, so default to 0 and clamp against the derived frame count.
  const [pos, setPos] = useState(0);

  if (derived.error || !derived.data) {
    return <ErrorScreen message={derived.error ?? "Unknown error."} />;
  }

  const { frames, applied, total, final } = derived.data;
  const clamped = Math.min(pos, frames.length - 1);
  const shown = frames[clamped];
  const atEnd = clamped >= frames.length - 1;
  const winnerLabel =
    final.winner === "P1" || final.winner === "P2"
      ? `${final.winner} — ${commanderName(final.players[final.winner].commanderId)}`
      : "Undecided";

  return (
    <Shell>
      <header style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: PURPLE }}>
          CRYPT · Match Replay
        </div>
        <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 800, color: INK }}>
          Verdict:{" "}
          <span style={{ color: GOLD }}>{final.winner ? winnerLabel : "No winner"}</span>
        </h1>
        <div style={{ display: "flex", gap: 18, marginTop: 8, color: MUTE, fontSize: 13 }}>
          <span>Turn {shown.turn}</span>
          <span>Active {shown.activePlayer}</span>
          <span>
            {applied} action{applied === 1 ? "" : "s"} re-derived
            {applied < total ? ` (of ${total}, stopped at win)` : ""}
          </span>
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <PlayerPanel seat="P1" state={shown} isWinner={final.winner === "P1" && atEnd} />
        <PlayerPanel seat="P2" state={shown} isWinner={final.winner === "P2" && atEnd} />
      </div>

      {/* Step scrubber — fold position over the captured frames. */}
      <div
        style={{
          marginTop: 22,
          background: PANEL,
          border: `1px solid rgba(123,92,196,0.4)`,
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <StepButton label="⏮ Start" disabled={clamped === 0} onClick={() => setPos(0)} />
          <StepButton
            label="◀ Prev"
            disabled={clamped === 0}
            onClick={() => setPos((v) => Math.max(0, Math.min(v, frames.length - 1) - 1))}
          />
          <StepButton
            label="Next ▶"
            disabled={atEnd}
            onClick={() => setPos((v) => Math.min(frames.length - 1, v + 1))}
          />
          <StepButton label="End ⏭" disabled={atEnd} onClick={() => setPos(frames.length - 1)} />
          <span style={{ marginLeft: "auto", color: MUTE, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            Step {clamped} / {frames.length - 1}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={clamped}
          onChange={(e) => setPos(Number(e.target.value))}
          style={{ width: "100%", marginTop: 14, accentColor: GOLD }}
          aria-label="Scrub replay step"
        />
      </div>

      <footer style={{ marginTop: 20 }}>
        <a
          href={absoluteUrl("/play")}
          style={{ color: GOLD, textDecoration: "none", fontWeight: 600, fontSize: 14 }}
        >
          ← Back to the field
        </a>
      </footer>
    </Shell>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 9,
        border: `1px solid ${disabled ? "rgba(123,92,196,0.3)" : GOLD}`,
        background: disabled ? "transparent" : "rgba(232,196,115,0.1)",
        color: disabled ? MUTE : GOLD,
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Producer helper (export-only; no other page edited).                       */
/* -------------------------------------------------------------------------- */

/** Build an absolute `/replay?code=…` share URL for a previously-encoded replay. */
export function replayShareUrl(code: string): string {
  return absoluteUrl(`/replay?code=${encodeURIComponent(code)}`);
}
