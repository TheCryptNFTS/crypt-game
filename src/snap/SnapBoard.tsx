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
        <div className="snap-hud__hint" role="status" aria-live="polite">
          {state.winner
            ? "Match over"
            : !m.myTurn
              ? "Opponent is playing…"
              : m.selectedHandId
                ? "Tap a Crypt to place your card"
                : "Tap a card, then tap a Crypt"}
        </div>
        {onReplayTutorial ? (
          <button type="button" className="snap-hud__tutorial" onClick={onReplayTutorial}>
            Tutorial
          </button>
        ) : null}
      </header>

      {/* THREE CRYPTS */}
      <div className="snap-lanes">
        {state.lanes.map((lane) => {
          const p1p = lanePower(lane, "P1");
          const p2p = lanePower(lane, "P2");
          const lead = laneWinner(lane);
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
                <span className={"snap-lane__score" + (lead === "P2" ? " is-win" : "")}>{p2p}</span>
                <span className="snap-lane__title">Crypt {lane.index + 1}</span>
                <span className={"snap-lane__score" + (lead === "P1" ? " is-win" : "")}>{p1p}</span>
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
          <div className="snap-result__card">
            <h2 className="snap-result__verdict">
              {state.winner === "P1" ? "Victory" : state.winner === "P2" ? "Defeat" : "Stalemate"}
            </h2>
            <p className="snap-result__lanes">
              {state.outcomes?.map((o) => (
                <span key={o.index} className={"snap-result__lane is-" + (o.winner ?? "draw")}>
                  Crypt {o.index + 1}: {o.p1Power}–{o.p2Power}
                </span>
              ))}
            </p>
            <button type="button" className="snap-endturn" onClick={m.reset}>
              Play Again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
