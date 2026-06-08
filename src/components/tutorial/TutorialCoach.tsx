import { useEffect, useMemo, useState } from "react";

/**
 * Lightweight on-screen coaching for the forced first-time tutorial. This is NOT
 * a bespoke scripted engine — it overlays callouts on top of the normal local
 * match, advancing through the core loop as the player acts. It reads only a few
 * derived signals (turn, whose turn, how many units the pilot has fielded, the
 * winner) and never touches the engine, so it can never desync a real match.
 *
 * Theme: purple #8D5CFF / gold #E9C984, the ⬡ hex glyph, no emojis.
 */

const PURPLE = "#8D5CFF";
const GOLD = "#E9C984";

type Props = {
  turn: number;
  activePlayer: "P1" | "P2";
  boardCount: number;
  /** True while the opening mulligan gate is still open (can't deploy yet). */
  mulliganActive?: boolean;
  winner: "P1" | "P2" | null;
};

type Step = {
  id: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    id: "mulligan",
    title: "Lock in your opening hand",
    body: "First, your opening hand. Tap any cards you want to swap, then press KEEP HAND (or RECALIBRATE) to lock it in and start the duel.",
  },
  {
    id: "nexus",
    title: "Protect your Hex",
    body: "Each side guards a Hex at 20 health. Drop the enemy Hex to 0 to win — and don't let yours fall.",
  },
  {
    id: "lanes",
    title: "Front and back lanes",
    body: "Units deploy to a FRONT or BACK lane. Front units trade blows; back units sit safer until you push.",
  },
  {
    id: "play",
    title: "Play a unit",
    body: "Tap a card in hand, then press Play Front or Play Back in the Actions panel to spend energy and deploy it. Get a body on the board now.",
  },
  {
    id: "keywords",
    title: "Keywords: GUARD and RUSH",
    body: "GUARD walls must be dealt with before attacks slip past. RUSH units can attack the turn they land.",
  },
  {
    id: "attack",
    title: "Attack",
    body: "Select your unit, then an enemy unit or their Hex. Chip the enemy Hex down to zero.",
  },
  {
    id: "close",
    title: "Close it out",
    body: "Keep deploying and attacking. The enemy Hex is weakened — finish the duel.",
  },
];

export function TutorialCoach({ turn, activePlayer, boardCount, mulliganActive, winner }: Props) {
  // Derive the step from match progress: advance as the pilot fields units and
  // turns pass, so coaching tracks what they're actually doing. Indices map to
  // STEPS: 0 mulligan, 1 nexus, 2 lanes, 3 play, 4 keywords, 5 attack, 6 close.
  const derivedIndex = useMemo(() => {
    if (winner) return STEPS.length; // overlay handled by the result card below
    // While the opening-hand gate is open, sit on the mulligan step — never tell
    // the player to "play a unit" before they've locked their hand.
    if (mulliganActive) return 0;
    if (boardCount >= 1 && turn >= 2) return 6;
    if (boardCount >= 1) return 5;
    // Hand locked, your turn, nothing deployed yet → "Play a unit".
    if (turn >= 1 && boardCount === 0 && activePlayer === "P1") return 3;
    return 1;
  }, [winner, boardCount, turn, activePlayer, mulliganActive]);

  const [index, setIndex] = useState(0);
  // Coaching only ever moves FORWARD with the match — never snaps backward.
  useEffect(() => {
    setIndex((prev) => Math.max(prev, derivedIndex));
  }, [derivedIndex]);

  const [dismissed, setDismissed] = useState(false);

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
          background: "rgba(14, 11, 24, 0.94)",
          border: `1px solid ${won ? GOLD : PURPLE}`,
          boxShadow: `0 0 28px ${won ? "rgba(233,201,132,0.35)" : "rgba(141,92,255,0.35)"}`,
          color: "#F4F1FB",
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
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: 460,
        width: "calc(100% - 32px)",
        padding: "14px 16px",
        borderRadius: 14,
        background: "rgba(14, 11, 24, 0.94)",
        border: `1px solid ${PURPLE}`,
        boxShadow: "0 0 24px rgba(141,92,255,0.28)",
        color: "#F4F1FB",
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
            color: "#9C93B8",
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
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#CFC8E4" }}>{step.body}</p>
      {activePlayer === "P2" ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: PURPLE }}>
          Opponent is taking their turn…
        </p>
      ) : null}
    </div>
  );
}
