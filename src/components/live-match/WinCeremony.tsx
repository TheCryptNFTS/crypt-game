import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { openTweet, shareOrCopy, absoluteUrl } from "../../lib/share";
import { resultCardBlob, resultCardDataUrl } from "../../lib/shareCard";
import { activeQuests, SIGIL_REWARDS, type RewardsState } from "../../meta/rewards";
import "../../styles/win-ceremony.css";
import "../../styles/ai-bosses.css";

/*
 * WinCeremony — the premium full-screen WIN / LOSS ceremony for the solo Play
 * screen. Shown once the local match `winner` is decided:
 *   • win  → "SIGNAL RESTORED" (gold #E9C984)
 *   • loss → "SIGNAL LOST"     (red  #FF4D4D)
 *
 * PRESENTATION-ONLY. It reflects the already-decided winner and an OPTIONAL
 * read-only `match` snapshot (used purely to surface a brief stat line). It
 * never touches the engine/reducer — "Run It Back" simply invokes the existing
 * reset handler passed down from the page. A dramatic scale+glow entrance plus a
 * one-shot screen flash + shake play on reveal, then the children land as
 * SEQUENCED reward beats (title 120ms → stats 300ms → rewards 600ms with a
 * ~600ms Sigil count-up → quest bars 820ms sweep-filling from 0 → actions
 * 1040ms; punch item #24). All motion disabled under prefers-reduced-motion.
 * Brand: Clash Display, gold/red, warm-black.
 */

type Seat = "P1" | "P2";

export type WinCeremonyProps = {
  /** Decided winner from the local match, or null while the match is live. */
  winner: Seat | null;
  /** The seat the local player occupies (solo Play is always "P1"). */
  mySeat?: Seat;
  /** Resets the match for another round — the existing handler from the page. */
  onPlayAgain: () => void;
  /**
   * Optional read-only match snapshot. When present a brief stat line (turns +
   * remaining nexus health) is shown. Safe to omit — the ceremony degrades to
   * just the verdict + actions.
   */
  match?: any;
  /**
   * Post-match rewards ledger (Sigil + daily quests + season), already advanced
   * by useMatchRewards. When present the ceremony shows what this match earned +
   * daily-quest progress — the "come back tomorrow" hook. In-game-only.
   */
  rewards?: RewardsState | null;
  /** Non-null only when THIS match earned the first-win-of-day bonus — the
   *  ceremony then celebrates it as a separate beat above the base Sigil. */
  firstWinBonus?: number | null;
  /** Current rank label (e.g. "Gold II") from the local profile, shown with the
   *  MMR delta as the "progress" hook — the reason to keep climbing. */
  rankLabel?: string | null;
  /** MMR change from THIS match (e.g. +12 / -9), null until decided. */
  ratingDelta?: number | null;
  /**
   * Optional NAMED-BOSS outro (solo only, additive). One pre-seeded static line
   * spoken by the AI boss — already win/loss-appropriate and deterministic per
   * match (picked by the page). Omitted/null → nothing renders (PvP untouched).
   */
  bossLine?: string | null;
  /** Boss attribution for the line, e.g. "WARDEN KAEL". */
  bossName?: string | null;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Sigil count-up (punch item #24, Hearthstone reward beat): rolls 0→target over
 * ~600ms, starting in sync with the rewards' stagger beat (delayMs). Pure
 * presentation — the ledger was already advanced by useMatchRewards upstream.
 * Reduced-motion (or inactive) shows the final value immediately.
 */
function useCountUp(
  target: number,
  active: boolean,
  reduced: boolean,
  delayMs = 600,
  durMs = 600,
): number {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    if (reduced) {
      setVal(target);
      return;
    }
    setVal(0);
    let raf = 0;
    let start: number | null = null;
    const t0 = window.setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / durMs);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setVal(Math.round(target * eased));
        if (t < 1) raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(t0);
      window.cancelAnimationFrame(raf);
    };
  }, [target, active, reduced, delayMs, durMs]);
  return reduced || !active ? target : val;
}

export function WinCeremony({
  winner,
  mySeat = "P1",
  onPlayAgain,
  match,
  rewards,
  firstWinBonus,
  rankLabel = null,
  ratingDelta = null,
  bossLine = null,
  bossName = null,
}: WinCeremonyProps) {
  const playerWon = winner === mySeat;
  const reduced = prefersReducedMotion();

  // Post-match payoff: base Sigil for the result + today's daily-quest progress.
  const sigilBase = playerWon ? SIGIL_REWARDS.win : SIGIL_REWARDS.loss;
  const dailies = rewards ? activeQuests(rewards, "daily") : [];

  // Sigil amount rolls 0→base in sync with the rewards beat of the stagger
  // (600ms in, ~600ms roll). Hook MUST run unconditionally (before the
  // `if (!winner)` early return) to keep the hook count stable.
  const sigilShown = useCountUp(sigilBase, !!winner && !!rewards, reduced);

  // Best-effort stat line from the read-only snapshot. Wrapped defensively so a
  // shape change can never break the ceremony.
  const turns = typeof match?.turn === "number" ? match.turn : null;
  const myHealth =
    typeof match?.players?.[mySeat]?.nexusHealth === "number"
      ? match.players[mySeat].nexusHealth
      : null;

  const navigate = useNavigate();

  // VIEW REWARDS (P5, 2026-06-09): the in-board ceremony previously dead-ended at
  // Run-It-Back / Leave, leaving the /match-results reward screen (+⬡ HEX / XP)
  // orphaned — unreachable through normal play. This writes the result state to
  // the SAME sessionStorage key the results page rehydrates from (its built-in
  // F5-survival path) and navigates there. Engine/reducer/rewards untouched — the
  // results page runs the existing `applyMatchRewards`. Device-local ⬡ HEX only.
  const onViewRewards = React.useCallback(() => {
    try {
      const state = {
        nonce: `match-${Date.now()}`,
        winner: winner as string,
        turn: typeof match?.turn === "number" ? match.turn : 0,
        p1CommanderId: match?.players?.P1?.commanderId,
        p2CommanderId: match?.players?.P2?.commanderId,
      };
      sessionStorage.setItem("crypt.lastResultState", JSON.stringify(state));
      navigate("/match-results", { state });
    } catch {
      navigate("/match-results");
    }
  }, [navigate, winner, match]);

  // Move keyboard focus to the primary action when the ceremony opens so
  // screen-reader / keyboard users land on "Run It Back". Presentation-only.
  const playAgainRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    playAgainRef.current?.focus();
  }, []);

  const [toast, setToast] = React.useState<string | null>(null);
  const flash = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Nothing to show until the match decides. MUST come AFTER all hooks above —
  // an early return before the hooks changes the hook count between renders when
  // `winner` flips null→set ("Expected static flag was missing" React error).
  if (!winner) return null;

  const shareUrl = absoluteUrl("/");

  // Brand copy for the X intent.
  const tweetText = playerWon
    ? `Signal Restored \u2014 I won my CRYPT duel${
        turns !== null ? ` in ${turns} turns` : ""
      }. \u2B22`
    : `Signal Lost \u2014 my CRYPT duel slipped away${
        turns !== null ? ` after ${turns} turns` : ""
      }. Run it back? \u2B22`;

  const cardData = { won: playerWon, turns, nexus: myHealth };

  const onShareX = () => openTweet(tweetText, shareUrl);

  const onShare = async () => {
    const result = await shareOrCopy({
      title: playerWon ? "Signal Restored" : "Signal Lost",
      text: tweetText,
      url: shareUrl,
    });
    flash(
      result === "shared"
        ? "Shared"
        : result === "copied"
        ? "Link copied"
        : "Share unavailable",
    );
  };

  // Render the branded card and try a native files-share; fall back to download.
  const onShareImage = async () => {
    try {
      const blob = await resultCardBlob(cardData);
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; text?: string; url?: string }) => Promise<void>;
      };
      if (
        blob &&
        nav.canShare &&
        nav.share &&
        nav.canShare({ files: [new File([blob], "crypt-result.png", { type: "image/png" })] })
      ) {
        const file = new File([blob], "crypt-result.png", { type: "image/png" });
        await nav.share({ files: [file], text: tweetText, url: shareUrl });
        flash("Shared");
        return;
      }
    } catch {
      /* user cancelled or unsupported → fall through to download */
    }
    downloadCard();
  };

  const downloadCard = () => {
    const url = resultCardDataUrl(cardData);
    if (!url) {
      flash("Image unavailable");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "crypt-result.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    flash("Image saved");
  };

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";

  return (
    <div
      className={`wc-shell ${playerWon ? "wc-shell--win" : "wc-shell--loss"} ${
        !reduced && playerWon ? "wc-shell--shake" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={playerWon ? "Signal Restored" : "Signal Lost"}
    >
      {!reduced ? (
        <div
          className={`wc-flash ${playerWon ? "wc-flash--win" : "wc-flash--loss"}`}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`wc-rays ${playerWon ? "wc-rays--win" : "wc-rays--loss"}`}
        aria-hidden="true"
      />

      <div className={`wc-panel ${playerWon ? "wc-panel--win" : "wc-panel--loss"}`}>
        <span className="wc-kicker">Transmission Ended</span>
        <span
          className={`wc-glyph ${playerWon ? "wc-glyph--win" : "wc-glyph--loss"}`}
          aria-hidden="true"
        >
          {"\u2B22"}
        </span>
        <h1
          className={`wc-title wc-seq wc-seq--1 ${
            playerWon ? "wc-title--win" : "wc-title--loss"
          }`}
        >
          {playerWon ? "SIGNAL RESTORED" : "SIGNAL LOST"}
        </h1>

        {bossLine ? (
          <p className="wc-bossline wc-seq wc-seq--2">
            <span className="wc-bossline__quote">{"“"}{bossLine}{"”"}</span>
            {bossName ? (
              <span className="wc-bossline__name">{" — "}{bossName}</span>
            ) : null}
          </p>
        ) : null}

        {turns !== null || myHealth !== null ? (
          <div className="wc-stats wc-seq wc-seq--2">
            {turns !== null ? (
              <div className="wc-stat">
                <span className="wc-stat__value">{turns}</span>
                <span className="wc-stat__label">Turns</span>
              </div>
            ) : null}
            {myHealth !== null ? (
              <div className="wc-stat">
                <span className="wc-stat__value">{Math.max(0, myHealth)}</span>
                <span className="wc-stat__label">Pyre</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {rankLabel && ratingDelta !== null ? (
          <div
            className="wc-rank wc-seq wc-seq--2"
            aria-label={`Rank ${rankLabel}, ${ratingDelta >= 0 ? "gained" : "lost"} ${Math.abs(ratingDelta)} rating`}
          >
            <span className="wc-rank__label">{rankLabel}</span>
            <span className={`wc-rank__delta ${ratingDelta >= 0 ? "wc-rank__delta--up" : "wc-rank__delta--down"}`}>
              {ratingDelta >= 0 ? `+${ratingDelta}` : `−${Math.abs(ratingDelta)}`} MMR
            </span>
          </div>
        ) : null}

        {rewards ? (
          <div className="wc-rewards wc-seq wc-seq--3" aria-label="Rewards earned">
            {firstWinBonus ? (
              <div className="wc-firstwin" role="status">
                <span className="wc-firstwin__tag">★ First win of the day</span>
                <span className="wc-firstwin__amt">+{firstWinBonus} ◈</span>
              </div>
            ) : null}
            <div className="wc-rewards__sigil">
              <span className="wc-rewards__sigil-amt">+{sigilShown}</span>
              <span className="wc-rewards__sigil-lbl">◈ Sigil</span>
            </div>
            {dailies.length > 0 ? (
              <ul className="wc-quests wc-seq wc-seq--4">
                {dailies.map((q) => {
                  const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
                  return (
                    <li key={q.id} className={`wc-quest${q.claimed ? " wc-quest--done" : ""}`}>
                      <span className="wc-quest__title">
                        {q.claimed ? "✓ " : ""}{q.title}
                      </span>
                      <span className="wc-quest__bar" aria-hidden="true">
                        <span className="wc-quest__fill" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="wc-quest__count">
                        {q.claimed ? `+${q.sigilReward} ◈` : `${q.progress}/${q.goal}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <span className="wc-rewards__foot wc-seq wc-seq--5">Daily quests reset at 00:00 UTC — come back to keep the streak.</span>
          </div>
        ) : null}

        <div className="wc-share wc-seq wc-seq--5" role="group" aria-label="Share result">
          <button className="wc-share-btn wc-share-btn--x" onClick={onShareX}>
            <span aria-hidden="true">{"\uD835\uDD4F"}</span> Share on X
          </button>
          <button className="wc-share-btn" onClick={onShare}>
            Share
          </button>
          <button className="wc-share-btn" onClick={onShareImage}>
            {canShareFiles ? "Share image" : "Save image"}
          </button>
        </div>

        {toast ? (
          <div className="wc-toast" role="status" aria-live="polite">
            {toast}
          </div>
        ) : null}

        <div className="wc-actions wc-seq wc-seq--5">
          <button ref={playAgainRef} className="wc-btn wc-btn--primary" onClick={onViewRewards}>
            View rewards →
          </button>
          <button className="wc-btn" onClick={onPlayAgain}>
            Run It Back
          </button>
          <Link className="wc-leave" to="/home">
            Leave
          </Link>
        </div>
      </div>
    </div>
  );
}

export default WinCeremony;
