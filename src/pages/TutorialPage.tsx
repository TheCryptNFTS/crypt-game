import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LiveCryptMatchPage from "./LiveCryptMatchPage";
import { buildStarterDeck, ensureStarterDeckEquipped } from "../lib/starterDeck";
import { markTutorialComplete } from "../lib/localProgress";
import { funnelOnce } from "../lib/funnel";

/**
 * Forced first-time tutorial. A brand-new pilot is routed here before anything
 * else (see SplashLoginPage + the route guard). It is a NORMAL local match —
 * the curated STONE_KEEPERS starter deck against a deliberately weak opponent —
 * with on-board coaching overlays (TutorialCoach) teaching the core loop:
 * Nexus health, front/back lanes, deploying a unit, attacking, and the GUARD /
 * RUSH keywords. Finishing (win OR loss) marks the tutorial complete in
 * localProgress, which unlocks the advanced surfaces.
 */

/** A low opponent Nexus so a first match resolves fast and a newcomer can win.
 *  2026-06-17 (Algorithm review): 8 → 6 to shave ~2 minutes off time-to-first-win —
 *  the most direct lever on the "the app's too complex" complaint. The newcomer closes
 *  in 2-3 swings and FEELS the core loop (deploy → attack → win) before fatigue. */
const TUTORIAL_OPPONENT_NEXUS = 6;

export default function TutorialPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  // Auto-equip the starter deck the moment the tutorial mounts so "Play" works
  // immediately afterward with zero deckbuilding.
  useEffect(() => {
    ensureStarterDeckEquipped();
    funnelOnce("tutorial_start"); // FTUE funnel stage 2 (once per device)
  }, []);

  const localMatchOptions = useMemo(
    () => ({
      p1Deck: buildStarterDeck(),
      opponentNexusHealth: TUTORIAL_OPPONENT_NEXUS,
      // Teardown §3: the mulligan was the FIRST interactive screen a brand-new
      // player ever saw — a redraw decision before they'd seen a card. The
      // tutorial keeps the dealt hand and starts straight on the board.
      autoKeepOpeningHand: true,
    }),
    [],
  );

  const onComplete = () => {
    markTutorialComplete();
    funnelOnce("tutorial_complete"); // FTUE funnel stage 3 (once per device)
    setDone(true);
  };

  return (
    <div className="crypt-tutorial-wrap">
      <header
        style={{
          textAlign: "center",
          padding: "12px 16px 0",
          color: "#E9C984",
          letterSpacing: "0.18em",
          fontSize: 12,
        }}
      >
        ⬡ FIRST DUEL · TUTORIAL
        <Link
          to="/help"
          style={{
            display: "block",
            marginTop: 4,
            color: "#9aa3b2",
            fontSize: 11,
            letterSpacing: "0.04em",
            textDecoration: "underline",
          }}
        >
          Stuck? How to play →
        </Link>
      </header>

      <LiveCryptMatchPage
        tutorial
        localMatchOptions={localMatchOptions}
        onTutorialComplete={onComplete}
      />

      {done ? (
        <div
          role="dialog"
          aria-label="Tutorial complete"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(8, 6, 16, 0.72)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "calc(100% - 40px)",
              padding: "24px 22px",
              borderRadius: 16,
              background: "rgba(11, 11, 13, 0.98)",
              border: "1px solid #C8A75D",
              boxShadow: "0 0 36px rgba(200,167,93,0.4)",
              color: "#F5F2E8",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", color: "#E9C984" }}>
              ⬡ THE CRYPT IS OPEN
            </p>
            <h2 style={{ margin: "10px 0 6px", fontSize: 22 }}>You know the loop</h2>
            <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "#d6d0c2" }}>
              Your starter deck is ready. Jump into another match.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate("/play", { replace: true })}
                style={{
                  appearance: "none",
                  cursor: "pointer",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(180deg, #C8A75D, #E9C984)",
                  color: "#060507",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                Play a match
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
