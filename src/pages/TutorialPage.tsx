import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LiveCryptMatchPage from "./LiveCryptMatchPage";
import { buildStarterDeck, ensureStarterDeckEquipped } from "../lib/starterDeck";
import { markTutorialComplete } from "../lib/localProgress";

/**
 * Forced first-time tutorial. A brand-new pilot is routed here before anything
 * else (see SplashLoginPage + the route guard). It is a NORMAL local match —
 * the curated STONE_KEEPERS starter deck against a deliberately weak opponent —
 * with on-board coaching overlays (TutorialCoach) teaching the core loop:
 * Nexus health, front/back lanes, deploying a unit, attacking, and the GUARD /
 * RUSH keywords. Finishing (win OR loss) marks the tutorial complete in
 * localProgress, which unlocks the advanced surfaces.
 */

/** A low opponent Nexus so a first match resolves fast and a newcomer can win. */
const TUTORIAL_OPPONENT_NEXUS = 8;

export default function TutorialPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  // Auto-equip the starter deck the moment the tutorial mounts so "Play" works
  // immediately afterward with zero deckbuilding.
  useEffect(() => {
    ensureStarterDeckEquipped();
  }, []);

  const localMatchOptions = useMemo(
    () => ({
      p1Deck: buildStarterDeck(),
      opponentNexusHealth: TUTORIAL_OPPONENT_NEXUS,
    }),
    [],
  );

  const onComplete = () => {
    markTutorialComplete();
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
              background: "rgba(16, 12, 28, 0.98)",
              border: "1px solid #8D5CFF",
              boxShadow: "0 0 36px rgba(141,92,255,0.4)",
              color: "#F4F1FB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", color: "#E9C984" }}>
              ⬡ THE CRYPT IS OPEN
            </p>
            <h2 style={{ margin: "10px 0 6px", fontSize: 22 }}>You know the loop</h2>
            <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "#CFC8E4" }}>
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
                  background: "linear-gradient(135deg, #8D5CFF, #6E3CE0)",
                  color: "#FFFFFF",
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
