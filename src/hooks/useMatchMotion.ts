import { useEffect, useRef, useState } from "react";

/*
 * useMatchMotion — PRESENTATION-ONLY game-feel driver.
 *
 * This hook does NOT touch game logic. It diffs the rendered match state across
 * renders to derive transient "motion tokens" that the view uses to trigger CSS
 * animations (unit enter/death/damage, nexus shake, turn banner, win flourish).
 *
 * Everything here is derived from props the board already receives, so it works
 * identically for solo and PvP and never alters outcomes or determinism.
 */

type PlayerId = "P1" | "P2";

export type UnitMotion = "enter" | "damage" | "attack";

/** A unit that has left the board this tick — rendered as a fading ghost. */
export type DyingUnit = {
  id: string;
  /** Snapshot of the VM at the moment of death so we can keep rendering it. */
  vm: any;
  lane: "front" | "back";
  side: "own" | "enemy";
};

export type TurnBanner = {
  key: number;
  who: "you" | "enemy";
};

export type NexusHit = {
  /** Increment-keyed so repeated hits re-trigger the animation. */
  key: number;
  damage: number;
};

type BoardSnapshot = {
  /** instanceId -> { health, side, lane, vm } */
  units: Map<string, { health: number; side: "own" | "enemy"; lane: "front" | "back"; vm: any }>;
};

export type MatchMotionInput = {
  ownFront: any[];
  ownBack: any[];
  enemyFront: any[];
  enemyBack: any[];
  ownNexus: number;
  enemyNexus: number;
  activePlayer: PlayerId;
  mySeat: PlayerId;
  winner: PlayerId | null;
  /** Bumps whenever the match is reset, so we clear all transient state. */
  resetKey?: string | number;
};

function healthOf(vm: any): number {
  return vm?.liveStats?.health ?? 0;
}

function buildSnapshot(input: MatchMotionInput): BoardSnapshot {
  const units = new Map<string, { health: number; side: "own" | "enemy"; lane: "front" | "back"; vm: any }>();
  const add = (arr: any[], side: "own" | "enemy", lane: "front" | "back") => {
    for (const vm of arr) {
      if (!vm?.id) continue;
      units.set(vm.id, { health: healthOf(vm), side, lane, vm });
    }
  };
  add(input.ownFront, "own", "front");
  add(input.ownBack, "own", "back");
  add(input.enemyFront, "enemy", "front");
  add(input.enemyBack, "enemy", "back");
  return { units };
}

export function useMatchMotion(input: MatchMotionInput) {
  const prevRef = useRef<BoardSnapshot | null>(null);
  const prevNexusRef = useRef<{ own: number; enemy: number } | null>(null);
  const prevActiveRef = useRef<PlayerId | null>(null);
  const prevWinnerRef = useRef<PlayerId | null>(null);
  const resetRef = useRef<string | number | undefined>(input.resetKey);
  const keyRef = useRef(0);
  const nextKey = () => (keyRef.current += 1);

  // Per-unit transient motion class ("enter" | "damage" | "attack").
  const [unitMotion, setUnitMotion] = useState<Record<string, UnitMotion>>({});
  // Units currently fading out of existence.
  const [dying, setDying] = useState<DyingUnit[]>([]);
  // Floating damage popups keyed by unit id.
  const [unitFloats, setUnitFloats] = useState<{ key: number; unitId: string; amount: number }[]>([]);
  const [turnBanner, setTurnBanner] = useState<TurnBanner | null>(null);
  const [ownNexusHit, setOwnNexusHit] = useState<NexusHit | null>(null);
  const [enemyNexusHit, setEnemyNexusHit] = useState<NexusHit | null>(null);
  const [boardFlinch, setBoardFlinch] = useState(false);

  const clearTimers = useRef<number[]>([]);
  const schedule = (fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    clearTimers.current.push(t);
  };

  useEffect(() => {
    return () => {
      clearTimers.current.forEach((t) => window.clearTimeout(t));
      clearTimers.current = [];
    };
  }, []);

  // Hard reset on a new match.
  useEffect(() => {
    if (resetRef.current === input.resetKey) return;
    resetRef.current = input.resetKey;
    prevRef.current = null;
    prevNexusRef.current = null;
    prevActiveRef.current = null;
    prevWinnerRef.current = null;
    setUnitMotion({});
    setDying([]);
    setUnitFloats([]);
    setTurnBanner(null);
    setOwnNexusHit(null);
    setEnemyNexusHit(null);
  }, [input.resetKey]);

  // ---- Board diff: enters / deaths / damage ------------------------------
  useEffect(() => {
    const snap = buildSnapshot(input);
    const prev = prevRef.current;
    prevRef.current = snap;

    if (!prev) return; // first paint — no animations on initial board

    const entered: string[] = [];
    const damaged: { id: string; amount: number }[] = [];

    for (const [id, cur] of snap.units) {
      const before = prev.units.get(id);
      if (!before) {
        entered.push(id);
      } else if (cur.health < before.health) {
        damaged.push({ id, amount: before.health - cur.health });
      }
    }

    const died: DyingUnit[] = [];
    for (const [id, before] of prev.units) {
      if (!snap.units.has(id)) {
        died.push({ id, vm: before.vm, lane: before.lane, side: before.side });
      }
    }

    if (entered.length || damaged.length) {
      setUnitMotion((m) => {
        const next = { ...m };
        for (const id of entered) next[id] = "enter";
        for (const d of damaged) next[d.id] = "damage";
        return next;
      });
      // Clear the transient classes after their animations finish.
      const touched = [...entered, ...damaged.map((d) => d.id)];
      schedule(() => {
        setUnitMotion((m) => {
          const next = { ...m };
          for (const id of touched) delete next[id];
          return next;
        });
      }, 480);
    }

    if (damaged.length) {
      setUnitFloats((f) => [
        ...f,
        ...damaged.map((d) => ({ key: nextKey(), unitId: d.id, amount: d.amount })),
      ]);
      const keys = damaged.map((d) => d.id);
      schedule(() => {
        setUnitFloats((f) => f.filter((x) => !keys.includes(x.unitId)));
      }, 950);
    }

    if (died.length) {
      setDying((cur) => [...cur, ...died]);
      const deadIds = died.map((d) => d.id);
      schedule(() => {
        setDying((cur) => cur.filter((d) => !deadIds.includes(d.id)));
      }, 520);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.ownFront, input.ownBack, input.enemyFront, input.enemyBack]);

  // ---- Nexus diff: shake + floating number -------------------------------
  useEffect(() => {
    const prev = prevNexusRef.current;
    prevNexusRef.current = { own: input.ownNexus, enemy: input.enemyNexus };
    if (!prev) return;

    if (input.ownNexus < prev.own) {
      setOwnNexusHit({ key: nextKey(), damage: prev.own - input.ownNexus });
      setBoardFlinch(true);
      schedule(() => setOwnNexusHit(null), 950);
      schedule(() => setBoardFlinch(false), 360);
    }
    if (input.enemyNexus < prev.enemy) {
      setEnemyNexusHit({ key: nextKey(), damage: prev.enemy - input.enemyNexus });
      schedule(() => setEnemyNexusHit(null), 950);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.ownNexus, input.enemyNexus]);

  // ---- Turn change banner -------------------------------------------------
  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = input.activePlayer;
    if (prev === null) return; // skip the very first render
    if (prev === input.activePlayer) return;
    if (input.winner) return;
    setTurnBanner({
      key: nextKey(),
      who: input.activePlayer === input.mySeat ? "you" : "enemy",
    });
    schedule(() => setTurnBanner(null), 1150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.activePlayer]);

  return {
    unitMotion,
    dying,
    unitFloats,
    turnBanner,
    ownNexusHit,
    enemyNexusHit,
    boardFlinch,
  };
}
