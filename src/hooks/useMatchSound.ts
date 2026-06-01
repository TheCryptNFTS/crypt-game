import { useEffect, useRef } from "react";
import {
  isMuted,
  playAttack,
  playDamage,
  playDeath,
  playDeploy,
  playDefeat,
  playDraw,
  playStalemate,
  playTurn,
  playWin,
  setFactionTint,
} from "../audio/cryptSfx";
import { isAmbienceEnabled, startAmbience } from "../audio/cryptAmbience";

/*
 * useMatchSound — PRESENTATION-ONLY procedural-audio driver.
 *
 * A sibling to useMatchMotion: it diffs the SAME rendered match state across
 * renders and fires the matching sfx (deploy on unit-enter, damage on HP drop,
 * death on unit-leave, draw on a new hand card, turn on active-player change,
 * win/defeat on resolve). It never touches the reducer, card data, or outcomes
 * — sound is downstream of state, exactly like motion.
 *
 * The synth itself (cryptSfx) honors a persisted mute flag, so this hook can
 * fire freely; muted just no-ops.
 */

type PlayerId = "P1" | "P2";

type Unit = { id: string; health: number };

export type MatchSoundInput = {
  ownFront: any[];
  ownBack: any[];
  enemyFront: any[];
  enemyBack: any[];
  /** Card ids in MY hand, used to detect draws. */
  hand: string[];
  ownNexus: number;
  enemyNexus: number;
  activePlayer: PlayerId;
  mySeat: PlayerId;
  winner: PlayerId | null;
  /** Bumps on a fresh match so we clear all diff baselines. */
  resetKey?: string | number;
  /** Optional faction of MY deck — drives the cheap per-faction tonal tint. */
  faction?: string | null;
  /** Starting nexus value, used to scale the ambience tension curve. */
  maxNexus?: number;
};

function healthOf(vm: any): number {
  return vm?.liveStats?.health ?? 0;
}

function unitMap(input: MatchSoundInput): Map<string, Unit> {
  const m = new Map<string, Unit>();
  const add = (arr: any[]) => {
    for (const vm of arr) {
      if (!vm?.id) continue;
      m.set(vm.id, { id: vm.id, health: healthOf(vm) });
    }
  };
  add(input.ownFront);
  add(input.ownBack);
  add(input.enemyFront);
  add(input.enemyBack);
  return m;
}

export function useMatchSound(input: MatchSoundInput) {
  const prevUnitsRef = useRef<Map<string, Unit> | null>(null);
  const prevHandRef = useRef<Set<string> | null>(null);
  const prevNexusRef = useRef<{ own: number; enemy: number } | null>(null);
  const prevActiveRef = useRef<PlayerId | null>(null);
  const prevWinnerRef = useRef<PlayerId | null>(null);
  const resetRef = useRef<string | number | undefined>(input.resetKey);

  // Hard reset on a new match: drop all baselines so the next paint is silent
  // (first paint never plays — same contract as useMatchMotion).
  useEffect(() => {
    if (resetRef.current === input.resetKey) return;
    resetRef.current = input.resetKey;
    prevUnitsRef.current = null;
    prevHandRef.current = null;
    prevNexusRef.current = null;
    prevActiveRef.current = null;
    prevWinnerRef.current = null;
  }, [input.resetKey]);

  // ---- Per-faction tonal tint (cheap motif) -------------------------------
  // Shifts the root pitch of every sfx to "key" the match to my deck.
  useEffect(() => {
    setFactionTint(input.faction);
  }, [input.faction]);

  // ---- Generative ambience bed (opt-in, mute-gated) -----------------------
  // Starts when a live (undecided) match exists and the user opted in; stops on
  // match end / reset / unmount. Tension intensifies as either nexus drops.
  const ambienceRef = useRef<ReturnType<typeof startAmbience> | null>(null);
  const ambienceActive = !input.winner && isAmbienceEnabled();
  useEffect(() => {
    if (!ambienceActive) return;
    const handle = startAmbience();
    ambienceRef.current = handle;
    return () => {
      handle?.stop();
      ambienceRef.current = null;
    };
    // Re-key on a new match so the bed restarts fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambienceActive, input.resetKey]);

  // Feed tension from the closest-to-death nexus: calm at full, frantic near 0.
  useEffect(() => {
    const handle = ambienceRef.current;
    if (!handle) return;
    const max = input.maxNexus && input.maxNexus > 0 ? input.maxNexus : 20;
    const lowest = Math.min(input.ownNexus, input.enemyNexus);
    const ratio = Math.max(0, Math.min(1, lowest / max));
    // tension rises non-linearly as the nexus approaches zero.
    handle.setTension(Math.pow(1 - ratio, 1.4));
  }, [input.ownNexus, input.enemyNexus, input.maxNexus]);

  // ---- Board diff: deploy / damage / death --------------------------------
  useEffect(() => {
    const cur = unitMap(input);
    const prev = prevUnitsRef.current;
    prevUnitsRef.current = cur;
    if (!prev || isMuted()) return; // first paint — establish baseline silently

    let entered = 0;
    let damaged = 0;
    for (const [id, u] of cur) {
      const before = prev.get(id);
      if (!before) entered++;
      else if (u.health < before.health) damaged++;
    }
    let died = 0;
    for (const id of prev.keys()) {
      if (!cur.has(id)) died++;
    }

    // One blip per event class per tick — layered events stay punchy, not noisy.
    if (entered) playDeploy();
    if (died) playDeath();
    else if (damaged) playDamage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.ownFront, input.ownBack, input.enemyFront, input.enemyBack]);

  // ---- Hand diff: card draw ----------------------------------------------
  useEffect(() => {
    const cur = new Set(input.hand);
    const prev = prevHandRef.current;
    prevHandRef.current = cur;
    if (!prev || isMuted()) return;

    let drew = false;
    for (const id of cur) {
      if (!prev.has(id)) {
        drew = true;
        break;
      }
    }
    if (drew) playDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.hand]);

  // ---- Nexus diff: attack swipe (face damage) -----------------------------
  useEffect(() => {
    const prev = prevNexusRef.current;
    prevNexusRef.current = { own: input.ownNexus, enemy: input.enemyNexus };
    if (!prev || isMuted()) return;
    if (input.enemyNexus < prev.enemy || input.ownNexus < prev.own) {
      playAttack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.ownNexus, input.enemyNexus]);

  // ---- Turn change --------------------------------------------------------
  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = input.activePlayer;
    if (prev === null) return;
    if (prev === input.activePlayer) return;
    if (input.winner) return;
    playTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.activePlayer]);

  // ---- Match resolve: win / defeat / stalemate ----------------------------
  useEffect(() => {
    const prev = prevWinnerRef.current;
    prevWinnerRef.current = input.winner;
    if (prev !== null) return; // only fire on the transition INTO a decided match
    if (!input.winner) return;
    if (input.winner === input.mySeat) playWin();
    else if (input.winner === ("draw" as any)) playStalemate();
    else playDefeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.winner]);
}
