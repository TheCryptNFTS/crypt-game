import React from "react";
import { useSearchParams } from "react-router-dom";
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

/** Parse a positive integer seed from the URL, or null if absent/invalid. */
function parseSeed(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : null;
}

export default function SnapMatchPage() {
  const [params] = useSearchParams();
  // A "beat my seed" challenge link (/snap?seed=…) drops the visitor straight
  // into the exact same deterministic match — same decks, same opponent, same
  // draw order — skipping the scripted tutorial so the challenge lands cold.
  const challengeSeed = parseSeed(params.get("seed"));

  const [mode, setMode] = React.useState<"onboarding" | "free">(() =>
    challengeSeed != null || tutorialDone() ? "free" : "onboarding",
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
      seed={challengeSeed ?? undefined}
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
