import React, { useCallback, useEffect, useRef, useState } from "react";
import { CommanderVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";

/*
 * VersusIntro — the match-OPEN beat. Your commander vs the enemy commander, full
 * collectible art slamming in from opposite sides across a gold ⬡ "VERSUS", then
 * it fades and hands off to the live board.
 *
 * Fighting-game versus presentation (punch item #20): a one-frame white flash +
 * 180ms screen shake at the moment the center hex SLAMS in (scale 1.4→1 on the
 * back-out easing), name plates staggering in 90ms apart, and tap-anywhere to
 * skip straight to the board. All beats are CSS-driven (match-motion.css) and
 * fully gated behind prefers-reduced-motion.
 *
 * PRESENTATION-ONLY and self-contained (same shape as MatchCeremony): it reflects
 * the two commander VMs and runs ONE setTimeout(onDone) — no rAF, no live-board
 * effect, so it can't trip the known in-match static-flag instability. Honors
 * prefers-reduced-motion (static face-off, shorter hold). Plays once per match;
 * the caller re-arms it on reset via a key/state reset.
 */

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function VersusIntro({
  own,
  enemy,
  onDone,
}: {
  own: CommanderVM;
  enemy: CommanderVM;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const reduced = reducedMotion();

  useEffect(() => {
    const hold = reduced ? 700 : 1500;
    const fade = reduced ? 0 : 380;
    const t1 = window.setTimeout(() => setLeaving(true), hold);
    const t2 = window.setTimeout(onDone, hold + fade);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // onDone is stable for a given match; intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap-anywhere-to-skip (fighting-game convention). One-shot: the first press
  // starts the leave fade immediately and hands off; the auto timers above are
  // harmless after (setLeaving is idempotent and the parent unmounts us on done).
  const skippedRef = useRef(false);
  const skip = useCallback(() => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, reduced ? 0 : 200);
  }, [onDone, reduced]);

  const ownEdge = factionTheme[own.faction]?.edge ?? "#C8A75D";
  const enemyEdge = factionTheme[enemy.faction]?.edge ?? "#FF4D4D";

  return (
    <div
      className={`vs-intro${leaving ? " vs-intro--leave" : ""}`}
      aria-hidden="true"
      onPointerDown={skip}
    >
      {/* One-frame white impact flash, timed to the hex slam (CSS delay). */}
      {!reduced ? <div className="vs-intro__flash" /> : null}
      <div className="vs-intro__side vs-intro__side--own" style={{ ["--vs-edge" as string]: ownEdge }}>
        <img className="vs-intro__art" src={own.imageUrl} alt="" />
        <div className="vs-intro__meta">
          <span className="vs-intro__role">You</span>
          <span className="vs-intro__name">{own.name}</span>
          <span className="vs-intro__faction">{own.faction.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="vs-intro__clash">
        <span className="vs-intro__hex">{"\u2B22"}</span>
        <span className="vs-intro__vs">VERSUS</span>
      </div>

      <div className="vs-intro__side vs-intro__side--enemy" style={{ ["--vs-edge" as string]: enemyEdge }}>
        <img className="vs-intro__art" src={enemy.imageUrl} alt="" />
        <div className="vs-intro__meta">
          <span className="vs-intro__role">Opponent</span>
          <span className="vs-intro__name">{enemy.name}</span>
          <span className="vs-intro__faction">{enemy.faction.replace(/_/g, " ")}</span>
        </div>
      </div>

      <span className="vs-intro__skip">Tap to skip</span>
    </div>
  );
}
