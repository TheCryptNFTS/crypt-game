import React from "react";
import { CardFace } from "./SnapBoard";
import { useSnapOnboarding } from "./useSnapOnboarding";
import { lanePower, laneWinner } from "./scoreLane";
import { expectedInstanceId, PLAYER_LANES } from "./onboarding";
import { MAX_TURNS, type LaneIndex } from "./types";
import "../styles/snap-match.css";

type Phase = "place" | "end" | "opponent" | "win";

/** Coach copy for the current beat. Short, one instruction at a time. */
function coachCopy(turn: number, phase: Phase): { step: string; title: string; body: string } {
  if (phase === "opponent") {
    return { step: "Watch", title: "Opponent's turn", body: "They're placing a card. See where it lands." };
  }
  if (phase === "end") {
    if (turn === 1) return { step: "End Turn", title: "Crypt 1 is yours", body: "You have more power here. Tap End Turn to let your opponent play." };
    if (turn === MAX_TURNS) return { step: "Win", title: "Lock it in", body: "Tap End Turn to score the board — you should take 2 of 3 Crypts." };
    return { step: "End Turn", title: "Nicely placed", body: "Tap End Turn to pass to your opponent." };
  }
  // place
  switch (turn) {
    case 1:
      return { step: "Step 1 · Place", title: "This is a Crypt", body: "A Crypt is a lane. Tap your glowing card, then tap Crypt 1 to place it." };
    case 2:
      return { step: "Energy = turn", title: "You have 2 energy", body: "Energy equals the turn number. Place your card in Crypt 3." };
    case 3:
      return { step: "Bigger wins", title: "More power takes a Crypt", body: "Grow Crypt 1's lead — place your card there." };
    case 4:
      return { step: "2 of 3", title: "You only need two Crypts", body: "Crypt 2 is a losing lane, but commit here — you can win the match without it." };
    case 5:
      return { step: "Set the trap", title: "You're behind in Crypt 3", body: "Add power to Crypt 3. You'll finish it next turn." };
    case 6:
      return { step: "Final turn!", title: "Steal Crypt 3 to win", body: "You're LOSING Crypt 3. Play your strongest card here to flip it and win 2 Crypts." };
    default:
      return { step: "Play", title: "Place a card", body: "Tap a card, then tap a Crypt." };
  }
}

export function SnapOnboardingBoard({ onComplete }: { onComplete?: () => void }) {
  const m = useSnapOnboarding();
  const { state } = m;
  const hand = state.players.P1.hand;
  const isFinal = state.turn >= MAX_TURNS && !state.winner;

  // The single coached play for this turn (null once it's been played).
  const expectedId = m.myTurn ? expectedInstanceId(state.turn) : null;
  const expectedLane = m.myTurn ? PLAYER_LANES[state.turn - 1] : null;
  const needPlay = !!expectedId && hand.some((c) => c.instanceId === expectedId);

  const phase: Phase = state.winner
    ? "win"
    : !m.myTurn
      ? "opponent"
      : needPlay
        ? "place"
        : "end";
  const coach = coachCopy(state.turn, phase);

  // Only the target lane is droppable, and only once the coached card is picked.
  const laneSelectable = phase === "place" && !!m.selectedHandId;

  return (
    <div className={"snap-shell snap-shell--coached" + (isFinal ? " is-final" : "")}>
      {/* HUD */}
      <header className="snap-hud">
        <div className="snap-hud__turn">
          Turn <strong>{state.turn}</strong> / {MAX_TURNS}
        </div>
        <div className="snap-hud__energy">
          <span className="snap-energy-pip" aria-hidden="true" />
          Energy <strong>{m.energy}</strong>
        </div>
        <div className="snap-hud__goal" aria-hidden="true">WIN 2 OF 3 CRYPTS</div>
      </header>

      {isFinal ? <div className="snap-final-banner" role="status">FINAL TURN</div> : null}

      {/* COACH */}
      {!state.winner ? (
        <div className={"snap-coach is-" + phase} role="status" aria-live="polite">
          <span className="snap-coach__step">{coach.step}</span>
          <strong className="snap-coach__title">{coach.title}</strong>
          <span className="snap-coach__body">{coach.body}</span>
        </div>
      ) : null}

      {/* THREE CRYPTS */}
      <div className="snap-lanes">
        {state.lanes.map((lane) => {
          const p1p = lanePower(lane, "P1");
          const p2p = lanePower(lane, "P2");
          const lead = laneWinner(lane);
          const isTarget = laneSelectable && lane.index === expectedLane;
          return (
            <div
              key={lane.index}
              className={[
                "snap-lane",
                isTarget ? "is-droppable is-target" : "",
                lead === "P1" ? "is-p1-lead" : lead === "P2" ? "is-p2-lead" : "",
              ].join(" ")}
              onClick={isTarget ? () => m.placeInLane(lane.index as LaneIndex) : undefined}
              role={isTarget ? "button" : undefined}
              aria-label={`Crypt ${lane.index + 1}. You ${p1p}, opponent ${p2p}.`}
            >
              {/* opponent side */}
              <div className="snap-lane__side snap-lane__side--enemy">
                {lane.P2.map((c) => (
                  <CardFace key={c.instanceId} card={c} small />
                ))}
              </div>

              <div className="snap-lane__meta">
                <span
                  key={`p2-${p2p}`}
                  className={"snap-lane__score" + (lead === "P2" ? " is-win" : "")}
                >
                  {p2p}
                </span>
                <span className="snap-lane__title">Crypt {lane.index + 1}</span>
                <span
                  key={`p1-${p1p}`}
                  className={"snap-lane__score" + (lead === "P1" ? " is-win" : "")}
                >
                  {p1p}
                </span>
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
            const isExpected = c.instanceId === expectedId && needPlay;
            return (
              <CardFace
                key={c.instanceId}
                card={c}
                selected={m.selectedHandId === c.instanceId}
                playable={isExpected}
                spotlight={isExpected}
                onClick={
                  isExpected
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
          className={"snap-endturn" + (phase === "end" ? " is-cue" : "")}
          onClick={m.endTurn}
          disabled={phase !== "end"}
        >
          {phase === "end" ? "End Turn" : m.myTurn ? "Place card" : "Opponent…"}
        </button>
      </footer>

      {/* RESULT */}
      {state.winner ? (
        <div className="snap-result" role="dialog" aria-label="Match result">
          <div className="snap-result__card">
            <h2 className="snap-result__verdict">
              {state.winner === "P1" ? "Victory" : state.winner === "P2" ? "Defeat" : "Stalemate"}
            </h2>
            <p className="snap-result__teach">
              {state.winner === "P1"
                ? "You took 2 of 3 Crypts — and stole Crypt 3 on the final turn. That's the whole game."
                : "The board is scored — higher total power takes each Crypt."}
            </p>
            <p className="snap-result__lanes">
              {state.outcomes?.map((o) => (
                <span key={o.index} className={"snap-result__lane is-" + (o.winner ?? "draw")}>
                  Crypt {o.index + 1}: {o.p1Power}–{o.p2Power}
                </span>
              ))}
            </p>
            <div className="snap-result__actions">
              <button type="button" className="snap-endturn" onClick={onComplete}>
                Play for real
              </button>
              <button type="button" className="snap-result__replay" onClick={m.restart}>
                Replay tutorial
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
