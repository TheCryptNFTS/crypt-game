import { useId, useLayoutEffect, useState } from "react";

export type RegisterBoardAnchor = (instanceId: string, el: HTMLElement | null) => void;

type StrikeIntentOverlayProps = {
  /** Declared attacker instance id */
  attackPick: string | null;
  /** Hovered legal defender (for line snap) */
  strikeHoverTarget: string | null;
  enemyFrontEmpty: boolean;
  /** Resolve measured anchor roots by instance id */
  getAnchorEl: (instanceId: string) => HTMLElement | undefined;
  active: boolean;
};

function computeLine(
  attackPick: string,
  getAnchorEl: (id: string) => HTMLElement | undefined,
  strikeHoverTarget: string | null,
  enemyFrontEmpty: boolean
): { x1: number; y1: number; x2: number; y2: number } | null {
  const fromEl = getAnchorEl(attackPick);
  if (!fromEl) return null;

  const r1 = fromEl.getBoundingClientRect();
  const x1 = r1.left + r1.width / 2;
  const y1 = r1.top + r1.height * 0.38;

  let x2 = x1;
  let y2 = y1;

  if (!enemyFrontEmpty && strikeHoverTarget) {
    const toEl = getAnchorEl(strikeHoverTarget);
    if (toEl) {
      const r2 = toEl.getBoundingClientRect();
      x2 = r2.left + r2.width / 2;
      y2 = r2.top + r2.height * 0.38;
      return { x1, y1, x2, y2 };
    }
  }

  if (!enemyFrontEmpty) {
    y2 = y1 - Math.min(100, Math.max(48, (y1 / window.innerHeight) * 90));
    x2 = x1 + (window.innerWidth / 2 - x1) * 0.12;
    return { x1, y1, x2, y2 };
  }

  y2 = y1 - Math.min(200, window.innerHeight * 0.14);
  x2 = x1 + (window.innerWidth / 2 - x1) * 0.08;
  return { x1, y1, x2, y2 };
}

/**
 * Premium strike vector: gold → ice gradient line, soft glow, anchor dots.
 * Fixed SVG; pointer-events none.
 */
export function StrikeIntentOverlay({
  attackPick,
  strikeHoverTarget,
  enemyFrontEmpty,
  getAnchorEl,
  active,
}: StrikeIntentOverlayProps) {
  const gid = useId().replace(/:/g, "");
  const [geom, setGeom] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!active || !attackPick) {
      setGeom(null);
      return;
    }

    const run = () => {
      const g = computeLine(attackPick, getAnchorEl, strikeHoverTarget, enemyFrontEmpty);
      setGeom(g);
    };

    run();
    window.addEventListener("resize", run);
    window.addEventListener("scroll", run, true);
    return () => {
      window.removeEventListener("resize", run);
      window.removeEventListener("scroll", run, true);
    };
  }, [active, attackPick, strikeHoverTarget, enemyFrontEmpty, getAnchorEl]);

  if (!geom) return null;

  const { x1, y1, x2, y2 } = geom;
  const targetLocked = !!(strikeHoverTarget && !enemyFrontEmpty);
  const gradId = `crypt-strike-grad-${gid}`;
  const glowId = `crypt-strike-glow-${gid}`;
  const reticlePath =
    "M-7,-7 L-7,-2.5 M-7,-7 L-2.5,-7 M7,-7 L7,-2.5 M7,-7 L2.5,-7 M-7,7 L-7,2.5 M-7,7 L-2.5,7 M7,7 L7,2.5 M7,7 L2.5,7";

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[35] h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
        >
          <stop offset="0%" stopColor="rgba(212,168,75,0.92)" />
          <stop offset="45%" stopColor="rgba(212,168,75,0.35)" />
          <stop offset="78%" stopColor="rgba(95,212,240,0.42)" />
          <stop offset="100%" stopColor="rgba(95,212,240,0.12)" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#${gradId})`}
        strokeWidth={targetLocked ? 1.65 : 1.15}
        strokeLinecap="round"
        filter={`url(#${glowId})`}
        opacity={targetLocked ? 0.88 : 0.72}
        className="crypt-strike-line"
      />
      <circle cx={x1} cy={y1} r="3.5" fill="rgba(212,168,75,0.45)" opacity={0.9} />
      {!targetLocked && (
        <circle cx={x2} cy={y2} r="2.8" fill="rgba(95,212,240,0.34)" opacity={0.82} />
      )}
      {targetLocked && (
        <g transform={`translate(${x2} ${y2})`}>
          <g className="crypt-strike-reticle">
            <path
              d={reticlePath}
              fill="none"
              stroke="rgba(95,212,240,0.88)"
              strokeWidth="1.15"
              strokeLinecap="round"
              opacity={0.92}
            />
          </g>
        </g>
      )}
    </svg>
  );
}
