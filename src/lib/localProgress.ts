/**
 * Closed-alpha / prototype progression — all localStorage.
 * TODO: replace with server ledger when accounts exist.
 */

const K = {
  balance: "crypt.progress.balance",
  passXp: "crypt.progress.passXp",
  matchesTotal: "crypt.progress.matchesTotal",
  lastDailyClaimMs: "crypt.progress.lastDailyClaimMs",
  dailyPackClaims: "crypt.progress.dailyPackClaims",
  lastMatchSummary: "crypt.progress.lastMatchSummary",
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
