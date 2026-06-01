/**
 * Closed-alpha / prototype progression — localStorage.
 *
 * The authoritative ranked ladder + per-UTC-day daily-quest/login claims now
 * live SERVER-SIDE (see server/server.ts + src/services/ladderApi.ts). That
 * server is the source of truth for rating and quest claims. THIS module remains
 * the OFFLINE FALLBACK device-local cache (and the pre-account onboarding gates
 * `firstWin`/`tutorialDone`): it is consulted when no session is signed in or
 * the server is unreachable. It never sources real hex — game-internal only.
 */

const K = {
  balance: "crypt.progress.balance",
  passXp: "crypt.progress.passXp",
  matchesTotal: "crypt.progress.matchesTotal",
  lastDailyClaimMs: "crypt.progress.lastDailyClaimMs",
  dailyPackClaims: "crypt.progress.dailyPackClaims",
  lastMatchSummary: "crypt.progress.lastMatchSummary",
  // New-player onboarding flags. The forced first-time tutorial reads these to
  // decide whether to coach a brand-new pilot, and the router/nav reads them to
  // keep advanced surfaces (deck builder, full collection, shop) hidden until a
  // newcomer has finished the tutorial or banked their first win.
  tutorialDone: "crypt.progress.tutorialDone",
  firstWin: "crypt.progress.firstWin",
} as const;

export const DAILY_PACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function readNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNum(key: string, n: number) {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore */
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export type MatchOutcomeInput = {
  winner: string;
  turn: number;
};

export type MatchRewardBreakdown = {
  won: boolean;
  draw: boolean;
  cryptDelta: number;
  passXpDelta: number;
  turn: number;
  winner: string;
  cryptBalanceAfter: number;
  passXpAfter: number;
  matchesTotal: number;
};

/** P1 = human in local prototype table. */
export function applyMatchRewards(input: MatchOutcomeInput): MatchRewardBreakdown {
  const draw = input.winner === "DRAW";
  const won = !draw && input.winner === "P1";

  let cryptDelta = 8;
  let passXpDelta = 15;
  if (draw) {
    cryptDelta = 12;
    passXpDelta = 20;
  } else if (won) {
    cryptDelta = 25;
    passXpDelta = 40;
  }

  const balance = readNum(K.balance, 0) + cryptDelta;
  const passXp = readNum(K.passXp, 0) + passXpDelta;
  const matchesTotal = readNum(K.matchesTotal, 0) + 1;

  // First win is a one-way onboarding gate: once a newcomer wins a single match
  // the advanced surfaces unlock even if they skipped/lost the tutorial.
  if (won) writeFlag(K.firstWin, true);

  writeNum(K.balance, balance);
  writeNum(K.passXp, passXp);
  writeNum(K.matchesTotal, matchesTotal);

  const label = draw ? "Draw" : won ? "Victory" : "Defeat";
  try {
    localStorage.setItem(
      K.lastMatchSummary,
      `${label} · ${input.turn} ${input.turn === 1 ? "turn" : "turns"} · +${cryptDelta} $CRYPT · +${passXpDelta} pass XP (device)`
    );
  } catch {
    /* ignore */
  }

  return {
    won,
    draw,
    cryptDelta,
    passXpDelta,
    turn: input.turn,
    winner: input.winner,
    cryptBalanceAfter: balance,
    passXpAfter: passXp,
    matchesTotal,
  };
}

export type DailyClaimResult =
  | { ok: true; cryptDelta: number; passXpDelta: number; nextClaimAt: number }
  | { ok: false; reason: "cooldown"; nextClaimAt: number };

export function claimDailyPack(now = Date.now()): DailyClaimResult {
  const last = readNum(K.lastDailyClaimMs, 0);
  const next = last + DAILY_PACK_COOLDOWN_MS;
  if (last > 0 && now < next) {
    return { ok: false, reason: "cooldown", nextClaimAt: next };
  }

  const cryptDelta = 50;
  const passXpDelta = 30;
  const balance = readNum(K.balance, 0) + cryptDelta;
  const passXp = readNum(K.passXp, 0) + passXpDelta;
  const claims = readNum(K.dailyPackClaims, 0) + 1;

  writeNum(K.balance, balance);
  writeNum(K.passXp, passXp);
  try {
    localStorage.setItem(K.lastDailyClaimMs, String(now));
    localStorage.setItem(K.dailyPackClaims, String(claims));
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(
      K.lastMatchSummary,
      `Daily vault · +${cryptDelta} $CRYPT · +${passXpDelta} pass XP (device)`
    );
  } catch {
    /* ignore */
  }

  return { ok: true, cryptDelta, passXpDelta, nextClaimAt: now + DAILY_PACK_COOLDOWN_MS };
}

export function hasCompletedAnyMatch() {
  return readNum(K.matchesTotal, 0) >= 1;
}

/**
 * ONBOARDING GATE. A pilot is "onboarded" once they finish the forced first-time
 * tutorial OR bank their first real win. Until then the router/nav keep the
 * advanced surfaces (deck builder, full 10k collection, shop) hidden so a brand-
 * new player only ever sees Play + the tutorial. One-way: never resets itself.
 */
export function hasCompletedTutorial() {
  return readFlag(K.tutorialDone);
}

export function markTutorialComplete() {
  writeFlag(K.tutorialDone, true);
}

export function hasFirstWin() {
  return readFlag(K.firstWin);
}

/** True once the newcomer has cleared onboarding by either path. */
export function isOnboarded() {
  return hasCompletedTutorial() || hasFirstWin();
}

export function hasClaimedDailyPackToday(now = Date.now()) {
  const last = readNum(K.lastDailyClaimMs, 0);
  if (!last) return false;
  return new Date(last).toDateString() === new Date(now).toDateString();
}

export function getProgressSnapshot(now = Date.now()) {
  const balance = readNum(K.balance, 0);
  const passXp = readNum(K.passXp, 0);
  const matchesTotal = readNum(K.matchesTotal, 0);
  const lastClaim = readNum(K.lastDailyClaimMs, 0);
  const nextClaimAt = lastClaim > 0 ? lastClaim + DAILY_PACK_COOLDOWN_MS : now;
  const dailyReady = lastClaim === 0 || now >= nextClaimAt;
  let lastMatchSummary: string | null = null;
  try {
    lastMatchSummary = localStorage.getItem(K.lastMatchSummary);
  } catch {
    /* ignore */
  }
  return {
    cryptBalance: balance,
    passXp,
    matchesTotal,
    dailyReady,
    nextClaimAt: dailyReady ? null : nextClaimAt,
    lastMatchSummary,
  };
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
