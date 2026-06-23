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

// SINGLE SOURCE OF TRUTH for the per-match Sigil figure. The in-board
// WinCeremony reads SIGIL_REWARDS directly (+30 win / +10 loss); the results
// page + share card + recent-match line read it through here. Both surfaces
// MUST show the same number for the same match — diverging constants (this
// module used to pay 25/8) made one win read "+30 Sigil" in the ceremony and
// "+25 Sigil" on the results screen, which reads as a bug to the player.
import { SIGIL_REWARDS } from "../meta/rewards";

// SINGLE SOURCE OF TRUTH for the Pass-XP figures (a track distinct from Sigil).
// Both the per-match reward and the daily-pack claim read from here so the two
// surfaces can never drift to different magic numbers the way the Sigil
// constants once did. Win pays more than a draw, a draw more than a loss.
const PASS_XP_REWARDS = { loss: 15, draw: 20, win: 40, dailyPack: 30 } as const;

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

/**
 * In-memory mirror of the onboarding flags. In incognito/private mode (and other
 * sandboxes) localStorage.setItem throws, so the tutorial-complete flag never
 * persists and the OnboardingGate bounces a just-finished pilot back to
 * /tutorial forever. This module-level mirror keeps markTutorialComplete() /
 * hasFirstWin() honest for the lifetime of the session even when the underlying
 * store rejects writes — enough to escape the gate within the same page session.
 */
const memFlags: Record<string, boolean> = {};

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
  // Consult the in-memory mirror first: if this session set the flag but the
  // write to localStorage was rejected (private mode), the mirror is the only
  // record. A truthy persisted value also wins.
  if (memFlags[key]) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  // Always update the in-memory mirror so reads succeed even if persistence
  // throws below.
  memFlags[key] = on;
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore — mirror already holds the value for this session */
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

  // Sigil mirrors the canonical SIGIL_REWARDS the WinCeremony shows. A draw is a
  // non-win, so it pays the loss base (matching the ceremony, which shows the
  // loss base for any non-win). Pass XP is a distinct track (not Sigil) and is
  // unaffected.
  let cryptDelta: number = SIGIL_REWARDS.loss;
  let passXpDelta: number = PASS_XP_REWARDS.loss;
  if (draw) {
    cryptDelta = SIGIL_REWARDS.loss;
    passXpDelta = PASS_XP_REWARDS.draw;
  } else if (won) {
    cryptDelta = SIGIL_REWARDS.win;
    passXpDelta = PASS_XP_REWARDS.win;
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
      `${label} · ${input.turn} ${input.turn === 1 ? "turn" : "turns"} · +${cryptDelta} ◈ Sigil · +${passXpDelta} pass XP`
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
  const passXpDelta = PASS_XP_REWARDS.dailyPack;
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
      `Daily vault · +${cryptDelta} ◈ Sigil · +${passXpDelta} pass XP`
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
  // Agree with the rolling-24h cooldown that claimDailyPack + getProgressSnapshot
  // use (this is exactly !dailyReady). The old toDateString() calendar-day check
  // disagreed just after LOCAL midnight — the UI offered a pack the claim function
  // then rejected as still-on-cooldown (a confusing dead tap).
  const last = readNum(K.lastDailyClaimMs, 0);
  return last > 0 && now < last + DAILY_PACK_COOLDOWN_MS;
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
