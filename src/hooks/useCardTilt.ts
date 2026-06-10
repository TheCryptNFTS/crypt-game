import { useEffect, useRef } from "react";

/**
 * Premium pointer-tilt + cursor-glare for a card (the Snap/Hearthstone
 * signature). Pointer position drives a 3D rotateX/rotateY and a glare hotspot,
 * but NEVER 1:1 — a rAF lerp eases the card toward the target so it has weight
 * (1:1 mapping is the amateur tell: jittery and cheap). Writes CSS custom
 * properties the card's CSS consumes:
 *   --rx / --ry  (deg)   tilt
 *   --mx / --my  (%)      glare hotspot
 *   --glare      (0..1)   glare + lift strength (0 at rest)
 * No-ops under prefers-reduced-motion. Returns props to spread on the card root.
 */
export function useCardTilt(maxDeg = 9) {
  const ref = useRef<HTMLElement | null>(null);
  const target = useRef({ rx: 0, ry: 0, mx: 50, my: 50, g: 0 });
  const cur = useRef({ rx: 0, ry: 0, mx: 50, my: 50, g: 0 });
  const raf = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const tick = () => {
    const el = ref.current;
    const c = cur.current;
    const t = target.current;
    const k = 0.14; // lerp factor — the "weight"
    c.rx += (t.rx - c.rx) * k;
    c.ry += (t.ry - c.ry) * k;
    c.mx += (t.mx - c.mx) * k;
    c.my += (t.my - c.my) * k;
    c.g += (t.g - c.g) * k;
    if (el) {
      el.style.setProperty("--rx", c.rx.toFixed(2) + "deg");
      el.style.setProperty("--ry", c.ry.toFixed(2) + "deg");
      el.style.setProperty("--mx", c.mx.toFixed(1) + "%");
      el.style.setProperty("--my", c.my.toFixed(1) + "%");
      el.style.setProperty("--glare", c.g.toFixed(3));
    }
    const settled =
      Math.abs(t.rx - c.rx) < 0.01 &&
      Math.abs(t.ry - c.ry) < 0.01 &&
      Math.abs(t.g - c.g) < 0.005;
    if (settled && t.g === 0) {
      running.current = false;
      return; // rest — stop the loop until next interaction
    }
    raf.current = requestAnimationFrame(tick);
  };

  const ensureRunning = () => {
    if (reduced || running.current) return;
    running.current = true;
    raf.current = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    target.current.ry = (px - 0.5) * 2 * maxDeg; // x → rotateY
    target.current.rx = -(py - 0.5) * 2 * maxDeg; // y → rotateX
    target.current.mx = px * 100;
    target.current.my = py * 100;
    target.current.g = 1;
    ensureRunning();
  };

  const onPointerLeave = () => {
    target.current.rx = 0;
    target.current.ry = 0;
    target.current.mx = 50;
    target.current.my = 50;
    target.current.g = 0;
    ensureRunning();
  };

  return { ref, onPointerMove, onPointerLeave };
}
