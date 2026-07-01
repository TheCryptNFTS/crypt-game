import React from "react";
import { SnapBoard } from "../snap/SnapBoard";
import { SnapOnboardingBoard } from "../snap/SnapOnboardingBoard";

/**
 * SNAP PROTOTYPE ROUTE (/snap) — Cut 1 of the "Marvel-Snap simplicity" rebuild.
 *
 * This is the FLAG: the current TCG stays the live default at /match, untouched.
 * /snap renders the drastically-simplified 3-Crypt lane battler in isolation.
 *
 * FIRST-TIME FLOW: a brand-new pilot gets the scripted, guaranteed-winnable
 * tutorial FIRST (so the vanilla loop feels obvious before any free match).
 * Once completed (or replayed), free play takes over. The flag is local-only —
 * /snap stays non-public until this flow is retention-ready.
 */
const DONE_KEY = "snap_tutorial_done_v1";

function tutorialDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function SnapMatchPage() {
  const [mode, setMode] = React.useState<"onboarding" | "free">(() =>
    tutorialDone() ? "free" : "onboarding",
  );

  const completeTutorial = React.useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* private mode — just proceed */
    }
    setMode("free");
  }, []);

  if (mode === "onboarding") {
    return <SnapOnboardingBoard onComplete={completeTutorial} />;
  }
  return (
    <SnapBoard
      onReplayTutorial={() => {
        try {
          localStorage.removeItem(DONE_KEY);
        } catch {
          /* ignore */
        }
        setMode("onboarding");
      }}
    />
  );
}
