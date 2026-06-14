import { useEffect, useMemo, useState } from "react";

/**
 * Lightweight on-screen coaching for the forced first-time tutorial. This is NOT
 * a bespoke scripted engine — it overlays callouts on top of the normal local
 * match, advancing through the core loop as the player acts. It reads only a few
 * derived signals (turn, whose turn, how many units the pilot has fielded, the
 * winner) and never touches the engine, so it can never desync a real match.
 *
 * Theme: locked Crypt palette — gold #C8A75D/#E9C984 on warm-black #0B0B0D, the
 * ⬡ hex glyph, no emojis. (Re-skinned off the old off-brand purple so the very
 * first screen every new player sees matches the VERSUS/mulligan/ceremony beats.)
 */

const GOLD = "#E9C984";
const GOLD_DIM = "#C8A75D";

type Props = {
  turn: number;
  activePlayer: "P1" | "P2";
  boardCount: number;
  /** True while the opening mulligan gate is still open (can't deploy yet). */
  mulliganActive?: boolean;
  /** True while a hand card is selected — advances goal → deploy coaching. */
  handSelected?: boolean;
  winner: "P1" | "P2" | null;
};

type Step = {
  id: string;
  title: string;
  body: string;
};

/**
 * Teardown §3 rewrite. The old step machine could only ever reach indices
 * 0/1/3/5/6 — "lanes" and "keywords" were dead steps, ATTACK was never taught,
 * the visible counter skipped numbers, and the first body claimed "a Hex at 20
 * health" while the board showed 25 vs 8. The new flow: every step is reachable
 * on the natural play path, no step states a number the board can contradict,
 * and the deploy step covers the turn-1 dead-end (no affordable unit → END TURN
 * is your move — the old coach demanded a deploy the hand couldn't make).
 */
const STEPS: Step[] = [
  {
    id: "hex",
    title: "Win the race",
    body: "Your Hex is the green crystal up top — the enemy's is the red one. Drop the enemy Hex to 0 and you win. Tap a card in your hand to begin.",
  },
  {
    id: "play",
    title: "Play a unit",
    body: "Tap a glowing slot (or press PLAY FRONT) to deploy it. Units cost energy — the purple crystals. No unit you can afford? Press END TURN: your energy grows every turn.",
  },
  {
    id: "lanes",
    title: "Lanes, then end your turn",
    body: "Front row trades blows; the back row sits safer. Fresh units need a turn to ready up — press END TURN and watch the opponent move.",
  },
  {
    id: "attack",
    title: "Attack",
    body: "Tap your unit, then ATTACK HEX — or tap an enemy unit first to trade. Each unit strikes once per turn. Attack a unit and it strikes back; the Hex can't.",
  },
  {
    id: "keywords",
    title: "GUARD and RUSH",
    body: "A GUARD wall must be cleared before anything behind it — or the Hex — can be hit. RUSH units can attack the turn they land.",
  },
  {
    id: "close",
    title: "Close it out",
    body: "Keep deploying and attacking. The enemy Hex is weakened — finish the duel.",
  },
];

export function TutorialCoach({ turn, activePlayer, boardCount, mulliganActive, handSelected, winner }: Props) {
  // Derive the step from match progress: advance as the pilot fields units and
  // turns pass, so coaching tracks what they're actually doing. Indices map to
  // STEPS: 0 hex/goal, 1 play, 2 lanes/end-turn, 3 attack, 4 keywords, 5 close.
  // On the natural path (deploy turn 1 → end turn → attack turn 2 → keep going)
  // every step is hit IN ORDER — no dead steps, no visible counter skips.
  const derivedIndex = useMemo(() => {
    if (winner) return STEPS.length; // overlay handled by the result card below
    // The tutorial skips the mulligan (autoKeepOpeningHand), but if the gate is
    // ever open, sit on the goal step — it's safe under any overlay.
    if (mulliganActive) return 0;
    if (boardCount === 0) {
      // Nothing fielded yet: the GOAL first ("tap a card to begin"), then the
      // deploy verb once a hand card is selected (the body also covers the "no
      // affordable unit → END TURN" dead-end, so this step is never a lie).
      if (activePlayer !== "P1") return 0;
      return handSelected ? 1 : 0;
    }
    // At least one unit fielded. NOTE: the engine's `turn` counts HALF-turns
    // (it increments on EVERY end-turn), so with P1 acting first the player's
    // turns are 1, 3, 5… and the opponent's are 2, 4, 6….
    if (turn <= 2) return 2; // rest of player turn 1 + AI turn: lanes + "end your turn"
    if (turn <= 4) return 3; // player's SECOND turn: units are ready — teach the attack verb
    if (turn <= 6) return 4; // third cycle: GUARD/RUSH, as enemy walls start landing
    return 5; // close it out
  }, [winner, boardCount, turn, activePlayer, mulliganActive, handSelected]);

  const [index, setIndex] = useState(0);
  // Coaching only ever moves FORWARD with the match — never snaps backward.
  useEffect(() => {
    setIndex((prev) => Math.max(prev, derivedIndex));
  }, [derivedIndex]);

  const [dismissed, setDismissed] = useState(false);
  // On short viewports (<840px — the natural-scroll match layout) the hand + own
  // lanes a deploy/select step points at sit far below a top-anchored coach, so
  // you can't see the instruction and its target together. Bottom-anchor the coach
  // there (just above the fixed nav dock) so it rides next to the action area.
  // Tall screens keep the top anchor — the whole board is already on screen.
  const [shortViewport, setShortViewport] = useState(
    typeof window !== "undefined" ? window.innerHeight < 840 : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setShortViewport(window.innerHeight < 840);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (winner) {
    const won = winner === "P1";
    return (
      <div
        role="status"
        style={{
          position: "fixed",
          left: "50%",
          top: 84,
          transform: "translateX(-50%)",
          zIndex: 60,
          maxWidth: 420,
          width: "calc(100% - 32px)",
          padding: "16px 18px",
          borderRadius: 14,
          background: "rgba(11, 11, 13, 0.96)",
          border: `1px solid ${GOLD_DIM}`,
          boxShadow: "0 0 30px rgba(200,167,93,0.38)",
          color: "#F5F2E8",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.18em", color: GOLD }}>
          ⬡ TUTORIAL {won ? "CLEARED" : "COMPLETE"}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          {won
            ? "Signal restored. You ran the full loop — Hex, lanes, deploy, attack. The Crypt is open."
            : "You ran the full loop — Hex, lanes, deploy, attack. That's everything you need. Press on."}
        </p>
      </div>
    );
  }

  if (dismissed) return null;

  const step = STEPS[Math.min(index, STEPS.length - 1)];
  const stepNo = Math.min(index, STEPS.length - 1) + 1;

  return (
    <div
      role="note"
      aria-live="polite"
      style={{
        // Tall screens: anchored over the ENEMY zone (top), never the hand dock
        // (teardown §3: a bottom card covered the cards "play" told you to tap).
        // Short screens (natural-scroll): bottom-anchor above the nav dock so the
        // coach rides next to the hand/lanes the step points at — which are below
        // the fold up top here.
        position: "fixed",
        left: "50%",
        ...(shortViewport ? { bottom: 92 } : { top: 178 }),
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: 460,
        width: "calc(100% - 32px)",
        padding: "14px 16px",
        borderRadius: 14,
        background: "rgba(11, 11, 13, 0.96)",
        border: `1px solid ${GOLD_DIM}`,
        boxShadow: "0 0 24px rgba(200,167,93,0.3)",
        color: "#F5F2E8",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 12, letterSpacing: "0.16em", color: GOLD }}>
          ⬡ STEP {stepNo} / {STEPS.length}
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: "#9aa3b2",
            fontSize: 12,
            cursor: "pointer",
            letterSpacing: "0.08em",
          }}
        >
          hide
        </button>
      </div>
      <p style={{ margin: "8px 0 4px", fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
        {step.title}
      </p>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#d6d0c2" }}>{step.body}</p>
      {activePlayer === "P2" ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: GOLD }}>
          Opponent is taking their turn…
        </p>
      ) : null}
    </div>
  );
}
