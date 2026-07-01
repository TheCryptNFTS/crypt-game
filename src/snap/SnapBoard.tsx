import React from "react";
import { useSnapMatch } from "./useSnapMatch";
import { lanePower, laneWinner } from "./scoreLane";
import { MAX_TURNS, LANE_CAPACITY, type LaneIndex, type SnapCard } from "./types";
import "../styles/snap-match.css";

/** A single card face. Compact: art, name, cost pip, power. */
export function CardFace({
  card,
  selected,
  playable,
  dim,
  spotlight,
  onClick,
  small,
}: {
  card: SnapCard;
  selected?: boolean;
  playable?: boolean;
  /** Unaffordable this turn — greyed out and not tappable. */
  dim?: boolean;
  /** Coach spotlight — a pulsing ring drawing the eye to the card to play. */
  spotlight?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "snap-card",
        small ? "snap-card--small" : "",
        selected ? "is-selected" : "",
        playable ? "is-playable" : "",
        dim ? "is-unaffordable" : "",
        spotlight ? "is-spotlight" : "",
        onClick ? "" : "is-static",
      ].join(" ")}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
    >
      {card.imageUrl ? (
        <img className="snap-card__art" src={card.imageUrl} alt="" loading="lazy" />
      ) : (
        <div className="snap-card__art snap-card__art--blank" />
      )}
      <span className="snap-card__cost" aria-label={`cost ${card.cost}`}>{card.cost}</span>
      <span className="snap-card__power" aria-label={`power ${card.power}`}>{card.power}</span>
      {!small ? <span className="snap-card__name">{card.name}</span> : null}
    </button>
  );
}

/** Lane state from the player's point of view — drives the clear win/lose chip. */
export function laneState(p1p: number, p2p: number): "winning" | "losing" | "tied" | null {
  if (p1p === 0 && p2p === 0) return null; // empty Crypt — say nothing yet
  if (p1p > p2p) return "winning";
  if (p1p < p2p) return "losing";
  return "tied";
}

export const STATE_LABEL: Record<"winning" | "losing" | "tied", string> = {
  winning: "WINNING",
  losing: "LOSING",
  tied: "TIED",
};

/** Each Crypt gets its own name + on-brand gold tint so the three chambers never
 * read as identical empty boxes. Kept strictly in the gold family. */
export const CRYPT_THEMES = [
  { key: "ash", name: "Ash Court" },
  { key: "iron", name: "Ironworks" },
  { key: "grave", name: "Grave Terrace" },
] as const;

export function SnapBoard({
  seed,
  onReplayTutorial,
}: {
  seed?: number;
  /** Optional: re-enter the scripted tutorial from free play. */
  onReplayTutorial?: () => void;
}) {
  const m = useSnapMatch({ seed });
  const { state } = m;
  const hand = state.players.P1.hand;

  const laneSelectable = m.myTurn && !!m.selectedHandId;
  const revealing = !m.myTurn && !state.winner;
  const isFinal = state.turn >= MAX_TURNS && !state.winner;

  // Live crypt count so the player always knows how close the match is.
  const cryptsWon = state.lanes.filter((l) => laneWinner(l) === "P1").length;
  const cryptsLost = state.lanes.filter((l) => laneWinner(l) === "P2").length;

  return (
    <div
      className={
        "snap-shell" +
        (revealing ? " is-reveal" : m.myTurn ? " is-myturn" : "") +
        (isFinal ? " is-final" : "")
      }
    >
      {/* HUD */}
      <header className="snap-hud">
        <div className="snap-hud__turn">
          {isFinal ? (
            <span className="snap-hud__final">FINAL TURN</span>
          ) : (
            <>Turn <strong>{state.turn}</strong> / {MAX_TURNS}</>
          )}
        </div>
        <div className="snap-hud__energy" aria-label={`Energy ${m.energy}`}>
          Energy <strong className="snap-hud__energy-num">{m.energy}</strong>
          <span className="snap-energy-meter" aria-hidden="true">
            {Array.from({ length: state.turn }, (_, i) => (
              <span
                key={i}
                className={"snap-energy-pip" + (i < m.energy ? " is-full" : " is-spent")}
              />
            ))}
          </span>
        </div>
        <div className="snap-hud__crypts" aria-label={`You ${cryptsWon}, opponent ${cryptsLost} Crypts. Win 2 of 3.`}>
          <span className="snap-hud__crypts-nums">
            <strong className="is-mine">{cryptsWon}</strong>
            <span className="snap-hud__crypts-sep">/</span>
            <strong className="is-foe">{cryptsLost}</strong>
          </span>
          <span className="snap-hud__goal-cap">Win 2 of 3 Crypts</span>
        </div>
        {onReplayTutorial ? (
          <button type="button" className="snap-hud__tutorial" onClick={onReplayTutorial}>
            Tutorial
          </button>
        ) : null}
      </header>

      <div
        className={
          "snap-hint" + (revealing ? " is-reveal" : m.myTurn ? " is-myturn" : "")
        }
        role="status"
        aria-live="polite"
      >
        <span className="snap-hint__dot" aria-hidden="true" />
        <strong className="snap-hint__who">
          {state.winner ? "Match over" : revealing ? "Opponent's turn" : "Your turn"}
        </strong>
        {state.winner ? null : (
          <span className="snap-hint__act">
            {revealing
              ? "revealing…"
              : m.selectedHandId
                ? "tap a Crypt to place"
                : m.playableIds.size === 0
                  ? m.energy > 0
                    ? "nothing you can afford — End Turn"
                    : "no energy — tap End Turn"
                  : "tap a card, then a Crypt"}
          </span>
        )}
      </div>

      {/* THREE CRYPTS */}
      <div className="snap-lanes">
        {state.lanes.map((lane) => {
          const p1p = lanePower(lane, "P1");
          const p2p = lanePower(lane, "P2");
          const lead = laneWinner(lane);
          const st = laneState(p1p, p2p);
          const myFull = lane.P1.length >= LANE_CAPACITY;
          const droppable = laneSelectable && !myFull;
          const theme = CRYPT_THEMES[lane.index] ?? CRYPT_THEMES[0];
          const enemyGhosts = Math.max(0, LANE_CAPACITY - lane.P2.length);
          const myGhosts = Math.max(0, LANE_CAPACITY - lane.P1.length);
          return (
            <div
              key={lane.index}
              className={[
                "snap-lane",
                "snap-lane--" + theme.key,
                droppable ? "is-droppable" : "",
                laneSelectable && myFull ? "is-full" : "",
                lead === "P1" ? "is-p1-lead" : lead === "P2" ? "is-p2-lead" : "",
              ].join(" ")}
              onClick={droppable ? () => m.placeInLane(lane.index as LaneIndex) : undefined}
              role={droppable ? "button" : undefined}
              aria-label={`Crypt ${lane.index + 1}. You ${p1p}, opponent ${p2p}. ${lane.P1.length} of ${LANE_CAPACITY} slots used.`}
            >
              {/* opponent army — hugs the top of the chamber */}
              <div className="snap-lane__side snap-lane__side--enemy">
                {lane.P2.map((c) => (
                  <CardFace key={c.instanceId} card={c} small />
                ))}
                {Array.from({ length: enemyGhosts }, (_, i) => (
                  <span key={"eg" + i} className="snap-slot-ghost" aria-hidden="true" />
                ))}
              </div>

              {/* clash line — the contested centre: Crypt name over the two scores */}
              <div className="snap-lane__center">
                <div className="snap-lane__meta">
                  <span className="snap-lane__title">{theme.name}</span>
                  <span className="snap-lane__scores">
                    <span key={`p2-${p2p}`} className={"snap-lane__score" + (lead === "P2" ? " is-win" : "")}>{p2p}</span>
                    <span className="snap-lane__vs" aria-hidden="true">vs</span>
                    <span key={`p1-${p1p}`} className={"snap-lane__score" + (lead === "P1" ? " is-win" : "")}>{p1p}</span>
                  </span>
                </div>
                <div className="snap-lane__state-row">
                  {laneSelectable && myFull ? (
                    <span className="snap-lane__state is-full-tag">FULL</span>
                  ) : st ? (
                    <span className={"snap-lane__state is-" + st}>{STATE_LABEL[st]}</span>
                  ) : null}
                </div>
              </div>

              {/* your army — hugs the base of the chamber */}
              <div className="snap-lane__side snap-lane__side--mine">
                {lane.P1.map((c) => (
                  <CardFace key={c.instanceId} card={c} small />
                ))}
                {Array.from({ length: myGhosts }, (_, i) => (
                  <span key={"mg" + i} className="snap-slot-ghost" aria-hidden="true" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {revealing ? (
        <div className="snap-reveal-flash" role="presentation">
          <span className="snap-reveal-flash__dot" aria-hidden="true" />
          Opponent&rsquo;s turn
        </div>
      ) : null}

      {/* HAND */}
      <footer className="snap-hand-dock">
        <div className="snap-hand">
          {hand.map((c) => {
            const playable = m.playableIds.has(c.instanceId);
            const canPick = m.myTurn && playable;
            return (
              <CardFace
                key={c.instanceId}
                card={c}
                selected={m.selectedHandId === c.instanceId}
                playable={canPick}
                dim={m.myTurn && !playable}
                onClick={
                  canPick
                    ? () =>
                        m.setSelectedHandId(
                          m.selectedHandId === c.instanceId ? null : c.instanceId,
                        )
                    : undefined
                }
              />
            );
          })}
          {hand.length === 0 ? <div className="snap-hand__empty">Hand empty</div> : null}
        </div>
        <button
          type="button"
          className="snap-endturn"
          onClick={m.endTurn}
          disabled={!m.myTurn}
        >
          {state.winner ? "Match Over" : m.myTurn ? "End Turn" : "Opponent…"}
        </button>
      </footer>

      {/* RESULT */}
      {state.winner ? (
        <div className="snap-result" role="dialog" aria-label="Match result">
          <div className={"snap-result__card is-" + state.winner}>
            <h2 className={"snap-result__verdict is-" + state.winner}>
              {state.winner === "P1" ? "Victory" : state.winner === "P2" ? "Defeat" : "Stalemate"}
            </h2>
            <p className="snap-result__summary">
              {state.winner === "DRAW"
                ? `${cryptsWon}–${cryptsLost} Crypts — dead even`
                : `You took ${cryptsWon} of 3 Crypts`}
            </p>
            <p className="snap-result__lanes">
              {state.outcomes?.map((o) => (
                <span key={o.index} className={"snap-result__lane is-" + (o.winner ?? "draw")}>
                  Crypt {o.index + 1}: {o.p1Power}–{o.p2Power}
                </span>
              ))}
            </p>
            <button type="button" className="snap-endturn snap-result__again" onClick={m.reset}>
              Play Again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
