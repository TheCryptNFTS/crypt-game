import React from "react";
import { Link } from "react-router-dom";
import { openTweet, shareOrCopy, absoluteUrl } from "../../lib/share";
import { resultCardBlob, resultCardDataUrl } from "../../lib/shareCard";
import "../../styles/win-ceremony.css";

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
 * one-shot screen flash + shake play on reveal, all disabled under
 * prefers-reduced-motion. Brand: Clash Display, gold/red, warm-black.
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
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function WinCeremony({
  winner,
  mySeat = "P1",
  onPlayAgain,
  match,
}: WinCeremonyProps) {
  // Nothing to show until the match decides.
  if (!winner) return null;

  const playerWon = winner === mySeat;
  const reduced = prefersReducedMotion();

  // Best-effort stat line from the read-only snapshot. Wrapped defensively so a
  // shape change can never break the ceremony.
  const turns = typeof match?.turn === "number" ? match.turn : null;
  const myHealth =
    typeof match?.players?.[mySeat]?.nexusHealth === "number"
      ? match.players[mySeat].nexusHealth
      : null;

  const [toast, setToast] = React.useState<string | null>(null);
  const flash = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

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
        reduced ? "" : "wc-shell--shake"
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
        <h1 className={`wc-title ${playerWon ? "wc-title--win" : "wc-title--loss"}`}>
          {playerWon ? "SIGNAL RESTORED" : "SIGNAL LOST"}
        </h1>

        {turns !== null || myHealth !== null ? (
          <div className="wc-stats">
            {turns !== null ? (
              <div className="wc-stat">
                <span className="wc-stat__value">{turns}</span>
                <span className="wc-stat__label">Turns</span>
              </div>
            ) : null}
            {myHealth !== null ? (
              <div className="wc-stat">
                <span className="wc-stat__value">{Math.max(0, myHealth)}</span>
                <span className="wc-stat__label">Nexus</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="wc-share" role="group" aria-label="Share result">
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

        <div className="wc-actions">
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
