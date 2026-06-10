import { useEffect, useRef, useState } from "react";

/**
 * One-shot combat-FX video overlay (the commissioned asset-review FX drop).
 * Renders a short mp4 over its parent (absolute inset-0). The FX renders are
 * on pure-black backgrounds, so `mix-blend-mode: screen` keys the black out —
 * only the spark/burst/dissolve light shows over the card art.
 *
 * Fail-safe by design: muted+playsInline (autoplay-legal everywhere), removes
 * itself on `ended` OR a hard timeout (whichever first), renders nothing under
 * prefers-reduced-motion, and if the browser refuses playback the blend-mode
 * keeps the black frame invisible — the CSS keyframe animations underneath
 * remain the baseline feedback.
 */
export function FxVideo({ src, ttlMs = 1400 }: { src: string; ttlMs?: number }) {
  const [gone, setGone] = useState(false);
  const ref = useRef<HTMLVideoElement | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setGone(true), ttlMs);
    return () => window.clearTimeout(t);
  }, [ttlMs, reduced]);

  if (reduced || gone) return null;

  return (
    <video
      className="crypt-fx-video"
      src={src}
      autoPlay
      muted
      loop={false}
      playsInline
      aria-hidden
      onEnded={() => setGone(true)}
      ref={(el) => {
        ref.current = el;
        // React omits the muted ATTRIBUTE (long-standing bug); without it some
        // browsers block autoplay. Set it for real, then kick playback.
        if (el && !el.hasAttribute("muted")) {
          el.setAttribute("muted", "");
          el.muted = true;
          // If playback is refused (rare; some automation contexts), DON'T
          // unmount — a paused first frame is pure black, which screen-blend
          // renders invisible. The ttl timeout cleans up either way.
          el.play().catch(() => {});
        }
      }}
    />
  );
}
