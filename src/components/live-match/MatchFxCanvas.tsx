import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

/*
 * MatchFxCanvas — PRESENTATION-ONLY particle/flash overlay for the live match.
 *
 * A single full-board <canvas> pinned over the play area (pointer-events:none,
 * so it never intercepts clicks). The board fires imperative bursts at screen
 * coordinates (impact on damage, shatter on death, a soft flash on deploy, and
 * a victory/defeat bloom). One shared requestAnimationFrame loop draws every
 * live particle; the loop sleeps (cancels the RAF) whenever nothing is alive,
 * so an idle match costs nothing. Particle count is hard-capped for perf.
 *
 * Reduced-motion: when the user prefers reduced motion the overlay is a no-op —
 * spawn() returns immediately and the canvas stays empty. The CSS ceremony /
 * board motion already degrade separately; this just adds zero particles.
 *
 * Theme: purple #8D5CFF, gold #E9C984, danger #ff6a6a. No emoji, no assets.
 */

export type FxKind = "deploy" | "damage" | "death" | "win" | "loss";

export type MatchFxHandle = {
  /** Spawn an effect at a viewport point (clientX/clientY). */
  burst: (kind: FxKind, x: number, y: number) => void;
  /** Spawn an effect centered on a DOM element (by its bounding box). */
  burstAt: (kind: FxKind, el: Element | null) => void;
  /** Full-screen ceremony bloom (gold for win, cold for loss). */
  bloom: (kind: "win" | "loss") => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // remaining, seconds
  ttl: number; // total, seconds
  size: number;
  color: string;
  gravity: number;
  shape: "spark" | "ring" | "shard";
  rot: number;
  vr: number;
};

const MAX_PARTICLES = 220;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const C_PURPLE = "141, 92, 255";
const C_GOLD = "233, 201, 132";
const C_DANGER = "255, 106, 106";
const C_WHITE = "255, 255, 255";

export const MatchFxCanvas = forwardRef<MatchFxHandle, {}>(function MatchFxCanvas(
  _props,
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const dprRef = useRef<number>(1);
  // A transient full-screen bloom flash (ceremony). {kind, t, ttl}.
  const bloomRef = useRef<{ kind: "win" | "loss"; t: number; ttl: number } | null>(
    null,
  );

  // Keep the backing store sized to the element + devicePixelRatio.
  const resize = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.floor(r.width * dpr));
    cv.height = Math.max(1, Math.floor(r.height * dpr));
  };

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
    };
  }, []);

  // Convert a viewport point to canvas-local (the canvas is fixed to the board
  // shell, so subtract its box origin) device pixels.
  const toLocal = (x: number, y: number) => {
    const cv = canvasRef.current;
    if (!cv) return { x: 0, y: 0 };
    const r = cv.getBoundingClientRect();
    const dpr = dprRef.current;
    return { x: (x - r.left) * dpr, y: (y - r.top) * dpr };
  };

  const ensureLoop = () => {
    if (rafRef.current !== null) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    const cv = canvasRef.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) {
      rafRef.current = null;
      return;
    }
    const dt = Math.min(0.05, (now - lastRef.current) / 1000);
    lastRef.current = now;

    g.clearRect(0, 0, cv.width, cv.height);

    // ---- Ceremony bloom (radial flash from center) ----
    const bloom = bloomRef.current;
    if (bloom) {
      bloom.t += dt;
      const p = bloom.t / bloom.ttl;
      if (p >= 1) {
        bloomRef.current = null;
      } else {
        const cx = cv.width / 2;
        const cy = cv.height * 0.42;
        const maxR = Math.hypot(cv.width, cv.height) * 0.65;
        const rad = maxR * Math.min(1, p * 1.6);
        const alpha = (1 - p) * 0.5;
        const col = bloom.kind === "win" ? C_GOLD : C_PURPLE;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, rad));
        grad.addColorStop(0, `rgba(${col}, ${alpha})`);
        grad.addColorStop(0.5, `rgba(${col}, ${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${col}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, cv.width, cv.height);
      }
    }

    // ---- Particles ----
    const ps = particlesRef.current;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const a = Math.max(0, p.life / p.ttl);

      g.save();
      g.globalCompositeOperation = "lighter";
      if (p.shape === "ring") {
        const grow = 1 + (1 - a) * 2.2;
        g.strokeStyle = `rgba(${p.color}, ${a * 0.8})`;
        g.lineWidth = Math.max(1, p.size * 0.4 * dprRef.current);
        g.beginPath();
        g.arc(p.x, p.y, p.size * grow * dprRef.current, 0, Math.PI * 2);
        g.stroke();
      } else if (p.shape === "shard") {
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = `rgba(${p.color}, ${a})`;
        const s = p.size * dprRef.current;
        g.beginPath();
        g.moveTo(0, -s);
        g.lineTo(s * 0.4, 0);
        g.lineTo(0, s);
        g.lineTo(-s * 0.4, 0);
        g.closePath();
        g.fill();
      } else {
        // spark
        g.fillStyle = `rgba(${p.color}, ${a})`;
        g.beginPath();
        g.arc(p.x, p.y, p.size * a * dprRef.current, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    if (ps.length === 0 && !bloomRef.current) {
      // Nothing alive — stop the loop so an idle board costs zero.
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const cap = () => {
    const ps = particlesRef.current;
    if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);
  };

  const spawn = (kind: FxKind, lx: number, ly: number) => {
    const ps = particlesRef.current;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    if (kind === "deploy") {
      // A soft purple landing flash: one expanding ring + a few rising sparks.
      ps.push({
        x: lx, y: ly, vx: 0, vy: 0, life: 0.45, ttl: 0.45,
        size: 18, color: C_PURPLE, gravity: 0, shape: "ring", rot: 0, vr: 0,
      });
      for (let i = 0; i < 10; i++) {
        const ang = rand(-Math.PI, 0); // upward fan
        const spd = rand(40, 130);
        ps.push({
          x: lx, y: ly, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: rand(0.4, 0.7), ttl: 0.7, size: rand(1.5, 3),
          color: i % 3 === 0 ? C_WHITE : C_PURPLE, gravity: 160,
          shape: "spark", rot: 0, vr: 0,
        });
      }
    } else if (kind === "damage") {
      // A tight white/red impact spray.
      for (let i = 0; i < 14; i++) {
        const ang = rand(0, Math.PI * 2);
        const spd = rand(80, 240);
        ps.push({
          x: lx, y: ly, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: rand(0.25, 0.5), ttl: 0.5, size: rand(1.5, 3.5),
          color: i % 2 === 0 ? C_WHITE : C_DANGER, gravity: 220,
          shape: "spark", rot: 0, vr: 0,
        });
      }
      ps.push({
        x: lx, y: ly, vx: 0, vy: 0, life: 0.3, ttl: 0.3,
        size: 10, color: C_WHITE, gravity: 0, shape: "ring", rot: 0, vr: 0,
      });
    } else if (kind === "death") {
      // A bigger shatter: shards + embers raining down.
      for (let i = 0; i < 22; i++) {
        const ang = rand(0, Math.PI * 2);
        const spd = rand(60, 280);
        ps.push({
          x: lx, y: ly, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60,
          life: rand(0.5, 1.0), ttl: 1.0, size: rand(2.5, 5.5),
          color: i % 4 === 0 ? C_WHITE : C_DANGER, gravity: 420,
          shape: i % 2 === 0 ? "shard" : "spark", rot: rand(0, 6.28),
          vr: rand(-8, 8),
        });
      }
      ps.push({
        x: lx, y: ly, vx: 0, vy: 0, life: 0.5, ttl: 0.5,
        size: 16, color: C_DANGER, gravity: 0, shape: "ring", rot: 0, vr: 0,
      });
    } else if (kind === "win" || kind === "loss") {
      // A celebratory fountain (gold) or a cold collapse (purple-grey).
      const col = kind === "win" ? C_GOLD : C_PURPLE;
      const n = kind === "win" ? 60 : 36;
      for (let i = 0; i < n; i++) {
        const ang = rand(-Math.PI * 0.8, -Math.PI * 0.2);
        const spd = rand(120, 420);
        ps.push({
          x: lx, y: ly, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: rand(0.8, 1.6), ttl: 1.6, size: rand(2, 5),
          color: i % 3 === 0 ? C_WHITE : col, gravity: kind === "win" ? 300 : 480,
          shape: i % 3 === 0 ? "shard" : "spark", rot: rand(0, 6.28),
          vr: rand(-6, 6),
        });
      }
    }
    cap();
    ensureLoop();
  };

  useImperativeHandle(
    ref,
    (): MatchFxHandle => ({
      burst(kind, x, y) {
        if (reducedMotion()) return;
        const p = toLocal(x, y);
        spawn(kind, p.x, p.y);
      },
      burstAt(kind, el) {
        if (reducedMotion() || !el) return;
        const r = el.getBoundingClientRect();
        const p = toLocal(r.left + r.width / 2, r.top + r.height / 2);
        spawn(kind, p.x, p.y);
      },
      bloom(kind) {
        if (reducedMotion()) return;
        const cv = canvasRef.current;
        bloomRef.current = { kind, t: 0, ttl: kind === "win" ? 1.1 : 0.9 };
        // Plus a confetti fountain from the lower-center for the win beat.
        if (cv) {
          const cx = cv.width / (2 * dprRef.current);
          const cy = cv.height / (1.25 * dprRef.current);
          spawn(kind, cx, cy);
        }
        ensureLoop();
      },
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      className="mm-fx-canvas"
      aria-hidden="true"
    />
  );
});
