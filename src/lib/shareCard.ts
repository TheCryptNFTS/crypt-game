/**
 * shareCard — client-side branded RESULT CARD renderer (raw canvas 2d).
 *
 * The Play SPA is static (no server OG image generation), so the shareable
 * visual for a finished duel is rendered here, in the browser, onto an
 * offscreen canvas. It paints a warm-black card with the verdict
 * ("SIGNAL RESTORED / SIGNAL LOST"), the turn count, remaining nexus, a ⬡
 * mark and the play.freeloncity.com wordmark — gold for wins, red for losses.
 *
 * Dependency-free. Exposes helpers to get a Blob (for navigator.canShare files)
 * or a dataURL (for a "Save image" download fallback).
 */

export type ResultCardData = {
  /** Did the local player win? Drives gold (win) vs red (loss) treatment. */
  won: boolean;
  /** Turns the duel lasted, if known. */
  turns?: number | null;
  /** Remaining nexus health for the local player, if known. */
  nexus?: number | null;
};

const WIDTH = 1200;
const HEIGHT = 630; // standard social card ratio (1.91:1)

const GOLD = "#E9C984";
const GOLD_SOFT = "#f2d999";
const RED = "#FF4D4D";
const INK = "#f4ede0";
const HEX = "\u2B22"; // ⬡

/** Pick a display font, preferring the brand display face when loaded. */
function displayFont(weight: number, px: number): string {
  return `${weight} ${px}px "Clash Display", "Inter", system-ui, sans-serif`;
}

/**
 * Render the result card onto a fresh offscreen canvas and return it. Caller
 * can convert to Blob/dataURL via the helpers below.
 */
export function renderResultCard(data: ResultCardData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const accent = data.won ? GOLD : RED;

  // --- warm-black backdrop with a verdict-tinted radial glow ---
  ctx.fillStyle = "#080605";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT * 0.36,
    40,
    WIDTH / 2,
    HEIGHT * 0.36,
    WIDTH * 0.7,
  );
  glow.addColorStop(0, data.won ? "rgba(233,201,132,0.20)" : "rgba(255,77,77,0.18)");
  glow.addColorStop(1, "rgba(8,6,5,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // a subtle purple wash low-left to nod the Freelon palette
  const purple = ctx.createRadialGradient(
    WIDTH * 0.12,
    HEIGHT * 0.92,
    20,
    WIDTH * 0.12,
    HEIGHT * 0.92,
    WIDTH * 0.5,
  );
  purple.addColorStop(0, "rgba(108,74,182,0.18)");
  purple.addColorStop(1, "rgba(8,6,5,0)");
  ctx.fillStyle = purple;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- inner border frame ---
  const pad = 36;
  ctx.lineWidth = 2;
  ctx.strokeStyle = data.won ? "rgba(233,201,132,0.45)" : "rgba(255,77,77,0.4)";
  roundRect(ctx, pad, pad, WIDTH - pad * 2, HEIGHT - pad * 2, 28);
  ctx.stroke();

  // --- kicker ---
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = displayFont(600, 26);
  ctx.save();
  spacedText(ctx, "TRANSMISSION ENDED", WIDTH / 2, 150, 8);
  ctx.restore();

  // --- hex glyph mark ---
  ctx.fillStyle = accent;
  ctx.font = displayFont(700, 64);
  ctx.fillText(HEX, WIDTH / 2, 240);

  // --- verdict title ---
  const title = data.won ? "SIGNAL RESTORED" : "SIGNAL LOST";
  ctx.font = displayFont(700, 92);
  ctx.shadowColor = data.won ? "rgba(233,201,132,0.55)" : "rgba(255,77,77,0.5)";
  ctx.shadowBlur = 36;
  const grad = ctx.createLinearGradient(0, 320, 0, 410);
  if (data.won) {
    grad.addColorStop(0, GOLD_SOFT);
    grad.addColorStop(1, GOLD);
  } else {
    grad.addColorStop(0, "#ff7a7a");
    grad.addColorStop(1, RED);
  }
  ctx.fillStyle = grad;
  ctx.fillText(title, WIDTH / 2, 380);
  ctx.shadowBlur = 0;

  // --- stat line (turns + nexus) ---
  const stats: Array<{ value: string; label: string }> = [];
  if (typeof data.turns === "number") {
    stats.push({ value: String(data.turns), label: "TURNS" });
  }
  if (typeof data.nexus === "number") {
    stats.push({ value: String(Math.max(0, data.nexus)), label: "HEX" });
  }

  if (stats.length) {
    const gap = 220;
    const startX = WIDTH / 2 - ((stats.length - 1) * gap) / 2;
    stats.forEach((s, i) => {
      const x = startX + i * gap;
      ctx.fillStyle = INK;
      ctx.font = displayFont(700, 56);
      ctx.fillText(s.value, x, 482);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = displayFont(600, 20);
      spacedText(ctx, s.label, x, 516, 5);
    });
  }

  // --- footer wordmark ---
  ctx.fillStyle = accent;
  ctx.font = displayFont(700, 24);
  ctx.fillText(`${HEX} CRYPT`, WIDTH / 2 - 110, HEIGHT - 60);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = displayFont(500, 22);
  ctx.fillText("play.freeloncity.com", WIDTH / 2 + 70, HEIGHT - 60);

  return canvas;
}

/** Draw text with manual per-character letter-spacing (px), centered on x. */
function spacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
): void {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

/** Rounded-rect path helper. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Render the card and resolve a PNG Blob (null if unsupported). */
export function resultCardBlob(data: ResultCardData): Promise<Blob | null> {
  const canvas = renderResultCard(data);
  return new Promise((resolve) => {
    if (!canvas.toBlob) {
      try {
        const url = canvas.toDataURL("image/png");
        const bin = atob(url.split(",")[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: "image/png" }));
      } catch {
        resolve(null);
      }
      return;
    }
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

/** Render the card and return a PNG dataURL ("" if unsupported). */
export function resultCardDataUrl(data: ResultCardData): string {
  try {
    return renderResultCard(data).toDataURL("image/png");
  } catch {
    return "";
  }
}
