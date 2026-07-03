/**
 * LOOP SPINE 2026-07-03 — the Daily Trial's local memory.
 *
 * Before this, nothing in the snap loop persisted: no streak, no personal
 * best, no played-today state — so the certificate could never show
 * accumulation and day three of the habit had no payoff. This is a
 * device-local, localStorage-only ledger (NO accounts, NO backend, NO
 * cloud): it records one entry per UTC daily date and derives streak/best.
 *
 * Honesty rule: the certificate only shows accumulation when it is locally
 * TRUE — a first-ever play has no history and displays nothing.
 */

export type DailyLedger = {
  /** UTC date (YYYY-MM-DD) of the most recent recorded daily. */
  lastDate: string;
  /** Consecutive UTC days played, ending at lastDate. */
  streak: number;
  /** Highest daily total power ever recorded on this device. */
  best: number;
};

const KEY = "crypt.snap.dailyLedger.v1";

function safeGet(): DailyLedger | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as DailyLedger;
    if (typeof j.lastDate !== "string" || typeof j.streak !== "number" || typeof j.best !== "number") return null;
    return j;
  } catch {
    return null; // private mode / storage denied — the loop degrades silently
  }
}

function safeSet(l: DailyLedger): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* storage denied — nothing to do */
  }
}

/** Read without writing (null until the first daily is recorded). */
export function readDailyLedger(): DailyLedger | null {
  return safeGet();
}

/** True when `next` is exactly the UTC day after `prev` (both YYYY-MM-DD). */
export function isNextUtcDay(prev: string, next: string): boolean {
  const [py, pm, pd] = prev.split("-").map(Number);
  const [ny, nm, nd] = next.split("-").map(Number);
  if (![py, pm, pd, ny, nm, nd].every(Number.isFinite)) return false;
  return Date.UTC(ny, nm - 1, nd) - Date.UTC(py, pm - 1, pd) === 86_400_000;
}

/**
 * Record a completed daily. Idempotent per date: replaying the same daily
 * only raises `best`, never inflates the streak. Returns the ledger state
 * from BEFORE this record (null on a first-ever play) plus the new state —
 * the caller shows accumulation only when `prev` existed.
 */
export function recordDaily(date: string, power: number): { prev: DailyLedger | null; now: DailyLedger } {
  const prev = safeGet();
  let now: DailyLedger;
  if (!prev) {
    now = { lastDate: date, streak: 1, best: power };
  } else if (prev.lastDate === date) {
    now = { ...prev, best: Math.max(prev.best, power) };
  } else if (isNextUtcDay(prev.lastDate, date)) {
    now = { lastDate: date, streak: prev.streak + 1, best: Math.max(prev.best, power) };
  } else {
    // gap (or clock weirdness) — streak restarts, best is forever
    now = { lastDate: date, streak: 1, best: Math.max(prev.best, power) };
  }
  safeSet(now);
  return { prev, now };
}
