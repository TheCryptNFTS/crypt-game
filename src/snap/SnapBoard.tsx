import React from "react";
import { useSnapMatch } from "./useSnapMatch";
import { lanePower, laneWinner } from "./scoreLane";
import { MAX_TURNS, type LaneIndex, type SnapCard } from "./types";
import "../styles/snap-match.css";

/** A single card face. Compact: art, name, cost pip, power. */
export function CardFace({
  card,
  selected,
  playable,
  spotlight,
  onClick,
  small,
}: {
  card: SnapCard;
  selected?: boolean;
  playable?: boolean;
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
function laneState(p1p: number, p2p: number): "winning" | "losing" | "tied" | null {
  if (p1p === 0 && p2p === 0) return null; // empty Crypt — say nothing yet
  if (p1p > p2p) return "winning";
  if (p1p < p2p) return "losing";
  return "tied";
}

const STATE_LABEL: Record<"winning" | "losing" | "tied", string> = {
  winning: "WINNING",
  losing: "LOSING",
  tied: "TIED",
};

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

  // Live crypt count so the player always knows how close the match is.
  const cryptsWon = state.lanes.filter((l) => laneWinner(l) === "P1").length;
  const cryptsLost = state.lanes.filter((l) => laneWinner(l) === "P2").length;

  return (
    <div className="snap-shell">
      {/* HUD */}
      <header className="snap-hud">
        <div className="snap-hud__turn">
          Turn <strong>{state.turn}</strong> / {MAX_TURNS}
        </div>
        <div className="snap-hud__energy">
          <span className="snap-energy-pip" aria-hidden="true" />
          Energy <strong>{m.energy}</strong>
        </div>
        <div className="snap-hud__crypts" aria-label={`You ${cryptsWon}, opponent ${cryptsLost} Crypts`}>
          <strong className="is-mine">{cryptsWon}</strong>
          <span className="snap-hud__crypts-sep">Crypts</span>
          <strong className="is-foe">{cryptsLost}</strong>
        </div>
        {onReplayTutorial ? (
          <button type="button" className="snap-hud__tutorial" onClick={onReplayTutorial}>
            Tutorial
          </button>
        ) : null}
      </header>

      <div className="snap-hint" role="status" aria-live="polite">
        {state.winner
          ? "Match over"
          : revealing
            ? "Opponent is revealing…"
            : m.selectedHandId
              ? "Tap a Crypt to place your card"
              : m.playableIds.size === 0
                ? "No energy to play — tap End Turn"
                : "Tap a card, then tap a Crypt"}
      </div>

      {/* THREE CRYPTS */}
      <div className="snap-lanes">
        {state.lanes.map((lane) => {
          const p1p = lanePower(lane, "P1");
          const p2p = lanePower(lane, "P2");
          const lead = laneWinner(lane);
          const st = laneState(p1p, p2p);
          return (
            <div
              key={lane.index}
              className={[
                "snap-lane",
                laneSelectable ? "is-droppable" : "",
                lead === "P1" ? "is-p1-lead" : lead === "P2" ? "is-p2-lead" : "",
              ].join(" ")}
              onClick={laneSelectable ? () => m.placeInLane(lane.index as LaneIndex) : undefined}
              role={laneSelectable ? "button" : undefined}
              aria-label={`Crypt ${lane.index + 1}. You ${p1p}, opponent ${p2p}.`}
            >
              {/* opponent side */}
              <div className="snap-lane__side snap-lane__side--enemy">
                {lane.P2.map((c) => (
                  <CardFace key={c.instanceId} card={c} small />
                ))}
              </div>

              <div className="snap-lane__meta">
                <span key={`p2-${p2p}`} className={"snap-lane__score" + (lead === "P2" ? " is-win" : "")}>{p2p}</span>
                <span className="snap-lane__title">Crypt {lane.index + 1}</span>
                <span key={`p1-${p1p}`} className={"snap-lane__score" + (lead === "P1" ? " is-win" : "")}>{p1p}</span>
              </div>
              <div className="snap-lane__state-row">
                {st ? <span className={"snap-lane__state is-" + st}>{STATE_LABEL[st]}</span> : null}
              </div>

              {/* my side */}
              <div className="snap-lane__side snap-lane__side--mine">
                {lane.P1.map((c) => (
                  <CardFace key={c.instanceId} card={c} small />
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
            return (
              <CardFace
                key={c.instanceId}
                card={c}
                selected={m.selectedHandId === c.instanceId}
                playable={playable && m.myTurn}
                onClick={
                  m.myTurn
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
