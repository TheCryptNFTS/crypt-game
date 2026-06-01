import React, { useEffect, useState } from "react";

/*
 * MatchCeremony — the end-of-match VICTORY / DEFEAT beat, plus an optional
 * one-time RANK-UP celebration that fires AFTER it.
 *
 * PRESENTATION-ONLY. It never touches the reducer/engine; it only reflects the
 * already-decided `playerWon` plus an OPTIONAL rating delta and rank-up event
 * passed down by the board. Punchy by design: one animated beat, then dismiss
 * (button + auto-fade). Honors prefers-reduced-motion (no animation, just the
 * result). Palette stays in cryptTheme tones (purple #8D5CFF, gold #E9C984); no
 * emojis — the hex glyph (⬡) and typographic marks (+, −, #) carry the accent.
 */

export type CeremonyRankup = {
  /** New ladder tier just crossed into, e.g. "ASCENDANT". */
  tier: string;
  rating: number;
};

export type MatchCeremonyProps = {
  playerWon: boolean;
  /**
   * Authoritative ranked rating change for this match. Positive on a win,
   * negative on a loss. `null` when unknown (solo / guest / offline) — the
   * ceremony then omits the delta line and still shows VICTORY / DEFEAT.
   */
  ratingDelta: number | null;
  /** Rank-up to celebrate after the win beat, or null to skip it. */
  rankup: CeremonyRankup | null;
  /** "Run It Back" / leave action (mirrors the prior gameover button). */
  onDismiss: () => void;
  /** Called once when the rank-up beat has been shown, so it won't replay. */
  onRankupShown?: () => void;
};

type Phase = "result" | "rankup";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MatchCeremony({
  playerWon,
  ratingDelta,
  rankup,
  onDismiss,
  onRankupShown,
}: MatchCeremonyProps) {
  const reduced = prefersReducedMotion();
  // Start on the result beat; advance to the rank-up beat (if any) after it.
  const [phase, setPhase] = useState<Phase>("result");
  const ackedRef = React.useRef(false);

  // Auto-advance from the win beat to the rank-up beat. With reduced motion the
  // result is shown statically, so advance promptly; otherwise let the beat play.
  useEffect(() => {
    if (phase !== "result" || !rankup) return;
    const t = window.setTimeout(() => setPhase("rankup"), reduced ? 700 : 1700);
    return () => window.clearTimeout(t);
  }, [phase, rankup, reduced]);

  // Acknowledge the rank-up exactly once when its beat is reached.
  useEffect(() => {
    if (phase !== "rankup" || ackedRef.current) return;
    ackedRef.current = true;
    onRankupShown?.();
  }, [phase, onRankupShown]);

  const deltaText =
    ratingDelta === null
      ? null
      : ratingDelta >= 0
        ? `+${ratingDelta}`
        : `\u2212${Math.abs(ratingDelta)}`; // proper minus sign

  if (phase === "rankup" && rankup) {
    return (
      <div className="mc-shell mc-shell--rankup" role="dialog" aria-modal="true">
        <div className="mc-panel mc-panel--rankup">
          <span className="mc-kicker mc-kicker--gold">Tier Ascension</span>
          <span className="mc-rankup-glyph" aria-hidden="true">{"\u2B22"}</span>
          <h2 className="mc-rankup-tier">{rankup.tier}</h2>
          <p className="mc-rankup-sub">
            You broke into a higher signal. Rating {rankup.rating}.
          </p>
          <button className="live-btn live-btn--primary" onClick={onDismiss}>
            Run It Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mc-shell ${playerWon ? "mc-shell--win" : "mc-shell--loss"}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Behind the panel: a radiant halo + raking light rays (gold on a win,
          cold purple on a loss). Pure CSS, killed under reduced motion. */}
      <div className={`mc-rays ${playerWon ? "mc-rays--win" : "mc-rays--loss"}`} aria-hidden="true" />
      <div className={`mc-panel ${playerWon ? "mc-panel--win" : "mc-panel--loss"}`}>
        <span className="mc-kicker">Transmission Ended</span>
        <h2 className={`mc-title ${playerWon ? "mc-title--win" : "mc-title--loss"}`}>
          {playerWon ? "VICTORY" : "DEFEAT"}
        </h2>
        {deltaText !== null ? (
          <div
            className={`mc-delta ${ratingDelta! >= 0 ? "mc-delta--up" : "mc-delta--down"}`}
            aria-label={`Rating ${ratingDelta! >= 0 ? "gained" : "lost"} ${Math.abs(
              ratingDelta!,
            )}`}
          >
            <span className="mc-delta__label">Rating</span>
            <span className="mc-delta__value">{deltaText}</span>
          </div>
        ) : null}
        <button className="live-btn live-btn--primary" onClick={onDismiss}>
          Run It Back
        </button>
      </div>
    </div>
  );
}
