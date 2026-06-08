import React, { useEffect, useMemo, useRef, useState } from "react";
import { CommanderHero } from "../crypt/CommanderHero";
import { InspectDrawer } from "../crypt/InspectDrawer";
import { ActionBar } from "./ActionBar";
import { BoardLane } from "./BoardLane";
import { CombatLogPanel } from "./CombatLogPanel";
import { HandCard } from "../crypt/HandCard";
import { MatchTopBar } from "./MatchTopBar";
import { artifactToVm, getCommanderVmForPlayer, handToVm, unitToVm } from "../../game-ui/liveMatchAdapter";
import { InspectState, PlayCardVM } from "../../ui/cryptTypes";
import { useMatchMotion } from "../../hooks/useMatchMotion";
import { useMatchSound } from "../../hooks/useMatchSound";
import { playAttack, playClick } from "../../audio/cryptSfx";
import { SoundToggle } from "./SoundToggle";
import { MatchCeremony } from "./MatchCeremony";
import { MatchFxCanvas, type MatchFxHandle, type FxKind } from "./MatchFxCanvas";
import { EmoteBar } from "./EmoteBar";
import { DeckPile } from "./DeckPile";
import {
  fetchMyRanking,
  fetchPendingRankup,
  ackRankup,
  type RankupEvent,
} from "../../services/ladderApi";
import "../../styles/match-motion.css";

type PlayerId = "P1" | "P2";

/**
 * The shared presentational board for BOTH single-player (`useLocalCryptMatch`)
 * and PvP (`useRemoteCryptMatch`). It takes a hook-shaped `match` object plus an
 * explicit `mySeat` (the perspective seat), so it renders the OWN side from
 * `mySeat` rather than the active player. In single-player `mySeat` is always
 * "P1" — identical to the original page behavior.
 */
export type CryptMatchBoardProps = {
  mySeat: PlayerId;
  match: any;
  winner: PlayerId | null;
  activePlayer: PlayerId;
  selectedHandId: string | null;
  selectedBoardId: string | null;
  inspectId: string | null;
  combatLog: { id: string; text: string }[];
  actionMessage: string | null;
  selectedHandCard: any;
  mulliganAvailable: boolean;
  energy: number;
  maxEnergy: number;
  deckSource: "owned" | "demo";
  affordableCostFor: (cardId: string) => boolean;
  setSelectedHandId: (id: string | null) => void;
  setSelectedBoardId: (id: string | null) => void;
  setInspectId: (id: string | null) => void;
  endTurn: () => void;
  playSelectedUnit: (lane: "front" | "back") => void;
  playSelectedArtifact: () => void;
  playSelectedSpell: (targetInstanceId?: string) => void;
  equipSelectedToUnit: (targetInstanceId: string) => void;
  attackUnit: (attackerInstanceId: string, defenderInstanceId: string) => void;
  attackFace: (attackerInstanceId: string) => void;
  mulligan: () => void;
  resetMatch: () => void;
  /** Optional banner (PvP connection state, waiting-for-opponent, etc.). */
  statusBanner?: React.ReactNode;
  /**
   * PvP-only: the live match id. When present (RemoteCryptMatchPage), the
   * in-match emote bar mounts. Solo (LiveCryptMatchPage) never passes it, so
   * emotes stay strictly PvP-gated.
   */
  pvpMatchId?: string;
  /**
   * SPECTATOR mode. When true the board is purely OBSERVATIONAL: ALL interaction
   * is suppressed (no select/deploy/attack/equip/mulligan/end-turn handler ever
   * fires), the ActionBar is hidden, and BOTH hands render as face-down counts
   * (the spectator view carries no card ids — fog of war is enforced server-side
   * regardless). All existing solo/PvP behaviour is unchanged when this is
   * absent/false. Audio / draw-drama / motion / ceremony wiring is untouched —
   * spectator mode only SUPPRESSES interaction + private info, it never rewires
   * the presentation layer.
   */
  spectator?: boolean;
};

export function CryptMatchBoard(props: CryptMatchBoardProps) {
  const {
    mySeat,
    match,
    winner,
    activePlayer,
    selectedHandId,
    selectedBoardId,
    inspectId,
    combatLog,
    actionMessage,
    selectedHandCard,
    mulliganAvailable,
    energy,
    maxEnergy,
    deckSource,
    affordableCostFor,
    setSelectedHandId,
    setSelectedBoardId,
    setInspectId,
    endTurn,
    playSelectedUnit,
    playSelectedArtifact,
    playSelectedSpell,
    equipSelectedToUnit,
    attackUnit,
    attackFace,
    mulligan,
    resetMatch,
    statusBanner,
    pvpMatchId,
    spectator = false,
  } = props;

  // In spectator mode EVERY interaction is suppressed at the source: selection
  // setters and action handlers are replaced with no-ops, so no click on a hand
  // card, unit, or quick-target can ever fire a select/deploy/attack. This is
  // belt-and-suspenders with hiding the ActionBar below — even a stray onSelect
  // wired by a child does nothing. Solo/PvP keep the real handlers untouched.
  const NOOP = () => {};
  // Selection setters with a tactile click — picking up a card/unit was silent
  // (playClick was defined but never called). A dry tick on every selection adds
  // constant low-level tactility. Only fire on an ACTUAL select (non-null id), so
  // clearing selection stays quiet.
  const safeSetSelectedHandId = spectator
    ? NOOP
    : (id: string | null) => {
        if (id) playClick();
        setSelectedHandId(id);
      };
  const safeSetSelectedBoardId = spectator
    ? NOOP
    : (id: string | null) => {
        if (id) playClick();
        setSelectedBoardId(id);
      };
  const safeSetInspectId = spectator ? NOOP : setInspectId;
  const safeEndTurn = spectator ? NOOP : endTurn;
  const safeMulligan = spectator ? NOOP : mulligan;
  const safePlaySelectedUnit = spectator ? (NOOP as (lane: "front" | "back") => void) : playSelectedUnit;
  const safePlaySelectedArtifact = spectator ? NOOP : playSelectedArtifact;
  const safePlaySelectedSpell = spectator
    ? (NOOP as (id?: string) => void)
    : playSelectedSpell;
  const safeEquipSelectedToUnit = spectator
    ? (NOOP as (id: string) => void)
    : equipSelectedToUnit;
  const safeAttackUnit = spectator ? (NOOP as (a: string, d: string) => void) : attackUnit;
  const safeAttackFace = spectator ? (NOOP as (a: string) => void) : attackFace;

  // Enemy attack-target lives in its OWN slot. `selectedBoardId` (the parent's
  // single selection) is reused for the OWN unit / attacker; without a separate
  // target slot an attacker and a defender could never be selected at the same
  // time, so "Attack Selected Enemy" could never enable. This keeps the two
  // sides independent so unit-vs-unit combat is actually reachable in the UI.
  const [targetBoardId, setTargetBoardId] = useState<string | null>(null);

  // Transient attacker-lunge token. Set the instant an attack is committed so
  // the striking unit plays the (already-authored) .mm-attack lunge; cleared on
  // a short timer. Presentation-only — never touches the reducer.
  const [lungeId, setLungeId] = useState<string | null>(null);
  const lungeTimer = useRef<number | null>(null);
  const triggerLunge = (id: string | null) => {
    if (!id) return;
    if (lungeTimer.current) window.clearTimeout(lungeTimer.current);
    setLungeId(id);
    lungeTimer.current = window.setTimeout(() => setLungeId(null), 400);
  };
  useEffect(() => () => {
    if (lungeTimer.current) window.clearTimeout(lungeTimer.current);
  }, []);

  const opponentSeat: PlayerId = mySeat === "P1" ? "P2" : "P1";
  const matchOver = !!winner;
  const playerWon = winner === mySeat;
  // Lock my actions when the match is over or it's not my turn.
  const actionsLocked = matchOver || activePlayer !== mySeat;

  const ownCommander = getCommanderVmForPlayer(match.players[mySeat]);
  const enemyCommander = getCommanderVmForPlayer(match.players[opponentSeat]);

  // In spectator mode the "own" side carries NO hand card ids (the neutral
  // server view redacts both hands to counts). Render that many face-down
  // placeholders so a watcher sees both players holding hidden cards, never real
  // ids. Non-spectator behaviour (real own-hand ids) is unchanged.
  const ownHandSource: string[] = spectator
    ? Array.from(
        { length: match.players[mySeat].handCount ?? 0 },
        (_, i) => `spectator_facedown_${mySeat}_${i}`
      )
    : (match.players[mySeat].hand ?? []);

  const ownHand = ownHandSource.map((cardId: string) =>
    handToVm(match, mySeat, cardId, selectedHandId === cardId)
  );

  const ownFront = (match.players[mySeat].board?.front ?? []).map((unit: any) =>
    unitToVm(mySeat, unit, selectedBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const ownBack = (match.players[mySeat].board?.back ?? []).map((unit: any) =>
    unitToVm(mySeat, unit, selectedBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const enemyFront = (match.players[opponentSeat].board?.front ?? []).map((unit: any) =>
    unitToVm(opponentSeat, unit, targetBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const enemyBack = (match.players[opponentSeat].board?.back ?? []).map((unit: any) =>
    unitToVm(opponentSeat, unit, targetBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const ownArtifacts = (match.players[mySeat].artifacts ?? []).map((artifact: any) =>
    artifactToVm(artifact, inspectId === artifact.cardId)
  );

  const allInspectable: PlayCardVM[] = [
    ...ownFront,
    ...ownBack,
    ...enemyFront,
    ...enemyBack,
    ...ownHand,
    ...ownArtifacts,
  ];

  const inspectCard = allInspectable.find((c) => c.id === inspectId) ?? null;

  const inspectState: InspectState = useMemo(() => {
    if (!inspectCard) return { open: false };
    return { open: true, commander: ownCommander, card: inspectCard };
  }, [inspectCard, ownCommander]);

  const selectedOwnUnit = [...ownFront, ...ownBack].find((u) => u.id === selectedBoardId) ?? null;
  const selectedEnemyUnit = [...enemyFront, ...enemyBack].find((u) => u.id === targetBoardId) ?? null;

  // Affordance highlights: light the board to show what the current selection
  // can do, so the deploy/attack loop is legible without trial-and-error.
  // Deploy: a unit card is in hand → own lanes are valid landing spots.
  // Attack: an own unit is selected → enemy lanes are valid strike targets.
  const deployReady = !actionsLocked && selectedHandCard?.type === "unit";
  const attackReady = !actionsLocked && !!selectedOwnUnit;

  // DIRECT-CLICK COMBAT: once you've selected your own unit (the attacker),
  // clicking an enemy unit attacks IT, and clicking the enemy Hex attacks face —
  // no separate button press across the dock. This is the core feel fix: combat
  // is direct manipulation (click attacker → click target → resolves) instead of
  // a 3-click, two-region loop. The ActionBar buttons remain as an explicit
  // fallback. Both paths funnel through these two resolvers. An illegal swing
  // (guard in the way, etc.) is rejected by the reducer and surfaced as usual.
  const resolveAttackUnit = (defenderId: string): boolean => {
    if (spectator || actionsLocked || !selectedOwnUnit) return false;
    triggerLunge(selectedOwnUnit.id);
    playAttack(); // swing whoosh — was only firing on face hits before
    // Contact burst at the struck defender, timed to the lunge apex (~150ms in).
    const defKey = laneKeyForUnit(defenderId);
    if (defKey) {
      window.setTimeout(() => fxRef.current?.burstAt("damage", laneAnchorRefs.current[defKey]), 150);
    }
    safeAttackUnit(selectedOwnUnit.id, defenderId);
    setTargetBoardId(null);
    safeSetSelectedBoardId(null);
    return true;
  };
  const resolveAttackFace = (): boolean => {
    if (spectator || actionsLocked || !selectedOwnUnit) return false;
    triggerLunge(selectedOwnUnit.id);
    playAttack();
    safeAttackFace(selectedOwnUnit.id);
    setTargetBoardId(null);
    safeSetSelectedBoardId(null);
    return true;
  };

  // Perspective-relative "Active" pill: "You" when it's my turn.
  const perspectiveActive: PlayerId = activePlayer === mySeat ? "P1" : "P2";

  const ownNexus = match.players[mySeat].nexusHealth ?? 20;
  const enemyNexus = match.players[opponentSeat].nexusHealth ?? 20;

  // Contextual battlefield: the arena degrades as the match gets bloodier. Drive
  // it off the LOWER of the two Hexes — when either side is near death the field
  // is "collapsed", mid-damage is "corrupted", otherwise "stable". A CSS attr
  // selector swaps the backdrop image (see live-crypt-match.css).
  const lowestHex = Math.min(ownNexus, enemyNexus);
  const battlefieldStage =
    lowestHex <= 6 ? "collapsed" : lowestHex <= 13 ? "corrupted" : "stable";

  // Deck-pile counts: prefer an explicit deckCount (PvP/redacted views send it),
  // fall back to the local deck array length. Presentation-only.
  const ownDeckCount =
    match.players[mySeat].deckCount ?? match.players[mySeat].deck?.length ?? 0;
  const enemyDeckCount =
    match.players[opponentSeat].deckCount ?? match.players[opponentSeat].deck?.length ?? 0;

  // PRESENTATION-ONLY: derive transient game-feel motion from state diffs.
  const motion = useMatchMotion({
    ownFront,
    ownBack,
    enemyFront,
    enemyBack,
    ownNexus,
    enemyNexus,
    activePlayer,
    mySeat,
    winner,
    resetKey: match.seed ?? 0,
  });

  // PRESENTATION-ONLY: procedural sound, diffing the same state as the motion
  // hook. One call covers solo + PvP. Muted is a no-op inside the synth. For a
  // spectator the own-hand ids are face-down placeholders (count-driven), which
  // is fine for diff-driven draw audio — no real ids ever appear here.
  const ownHandIds = ownHandSource as string[];
  useMatchSound({
    ownFront,
    ownBack,
    enemyFront,
    enemyBack,
    hand: ownHandIds,
    ownNexus,
    enemyNexus,
    activePlayer,
    mySeat,
    winner,
    resetKey: match.seed ?? 0,
    faction: ownCommander?.faction ?? null,
    maxNexus: 20,
  });

  // Card-draw drama: derive the set of hand-card ids that are NEW since the last
  // render so they can animate in. Presentation-only — never mutates the hand.
  const prevHandRef = useRef<Set<string>>(new Set());
  const seedRef = useRef(match.seed ?? 0);
  const [drawnIds, setDrawnIds] = useState<Set<string>>(new Set());
  const drawClearTimer = useRef<number | null>(null);
  useEffect(() => {
    // A fresh match resets the baseline so the opening hand doesn't all "draw".
    if (seedRef.current !== (match.seed ?? 0)) {
      seedRef.current = match.seed ?? 0;
      prevHandRef.current = new Set(ownHandIds);
      setDrawnIds(new Set());
      return;
    }
    const prev = prevHandRef.current;
    const fresh = ownHandIds.filter((id) => !prev.has(id));
    prevHandRef.current = new Set(ownHandIds);
    if (fresh.length === 0) return;
    setDrawnIds((cur) => {
      const next = new Set(cur);
      for (const id of fresh) next.add(id);
      return next;
    });
    if (drawClearTimer.current) window.clearTimeout(drawClearTimer.current);
    drawClearTimer.current = window.setTimeout(() => setDrawnIds(new Set()), 560);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownHandIds.join("|"), match.seed]);
  useEffect(
    () => () => {
      if (drawClearTimer.current) window.clearTimeout(drawClearTimer.current);
    },
    []
  );

  // Own units get the lunge token merged on top of the diff-derived motion, so a
  // committed attack visibly strikes forward (the .mm-attack keyframes exist but
  // can't be inferred from a health diff alone).
  const ownUnitMotion = lungeId
    ? { ...motion.unitMotion, [lungeId]: "attack" as const }
    : motion.unitMotion;

  const dyingFor = (side: "own" | "enemy", lane: "front" | "back") =>
    motion.dying.filter((d) => d.side === side && d.lane === lane);

  // ---- VISUAL SPECTACLE: particle bursts (presentation-only) --------------
  // A single canvas overlay (MatchFxCanvas) draws impact/shatter/deploy/victory
  // particles. We aim each burst at a stable, board-owned lane anchor (rendered
  // below as invisible centered markers) or at the topbar nexus pills — never at
  // BoardLane internals (those are owned by another agent). The canvas is a
  // no-op under reduced motion, so this whole block degrades cleanly. Bursts are
  // fired from the SAME motion signals the CSS already reacts to, so they stay
  // in lockstep with the existing game-feel and add zero new state diffs.
  const fxRef = useRef<MatchFxHandle | null>(null);
  type LaneKey = "ownFront" | "ownBack" | "enemyFront" | "enemyBack";
  const laneAnchorRefs = useRef<Record<LaneKey, HTMLDivElement | null>>({
    ownFront: null,
    ownBack: null,
    enemyFront: null,
    enemyBack: null,
  });
  const setLaneAnchor = (key: LaneKey) => (el: HTMLDivElement | null) => {
    laneAnchorRefs.current[key] = el;
  };
  const burstLane = (kind: FxKind, key: LaneKey) =>
    fxRef.current?.burstAt(kind, laneAnchorRefs.current[key]);


  // Map a unit id (from the motion token sets) to its lane anchor.
  const laneKeyForUnit = (id: string): LaneKey | null => {
    if (ownFront.some((u: any) => u.id === id)) return "ownFront";
    if (ownBack.some((u: any) => u.id === id)) return "ownBack";
    if (enemyFront.some((u: any) => u.id === id)) return "enemyFront";
    if (enemyBack.some((u: any) => u.id === id)) return "enemyBack";
    return null;
  };

  // Fire deploy/damage particles when the motion hook flags an enter/damage on a
  // unit (it clears the token after ~480ms, so a token's APPEARANCE = the event).
  const seenMotionRef = useRef<Record<string, true>>({});
  useEffect(() => {
    const seen = seenMotionRef.current;
    const next: Record<string, true> = {};
    for (const [id, kind] of Object.entries(motion.unitMotion)) {
      next[id] = true;
      if (seen[id]) continue; // already fired for this token instance
      const laneKey = laneKeyForUnit(id);
      if (!laneKey) continue;
      if (kind === "enter") burstLane("deploy", laneKey);
      else if (kind === "damage") burstLane("damage", laneKey);
    }
    seenMotionRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion.unitMotion]);

  // Fire a shatter when a unit dies (motion.dying carries side+lane directly).
  const seenDeathRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const seen = seenDeathRef.current;
    const live = new Set<string>();
    for (const d of motion.dying) {
      live.add(d.id);
      if (seen.has(d.id)) continue;
      const key = (`${d.side === "own" ? "own" : "enemy"}${
        d.lane === "front" ? "Front" : "Back"
      }`) as LaneKey;
      burstLane("death", key);
    }
    seenDeathRef.current = live;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion.dying]);

  // Fire a SHATTER on the Hex pills when face damage lands. The motion hook
  // mints a fresh {key,damage} token per hit; the key change = the event. This
  // finally gives the win condition real impact (a death-burst on the struck
  // Hex) instead of just a shake. A lethal hit additionally blooms via the
  // existing match-end ceremony effect.
  const seenHexHitRef = useRef<{ own: number | null; enemy: number | null }>({
    own: null,
    enemy: null,
  });
  useEffect(() => {
    // The Hex pills REMOUNT on every hit (their key changes to re-trigger the
    // CSS shake), so a captured ref goes stale exactly when we need it. Query the
    // live pill by its stable class at fire time instead. A short delay lets the
    // freshly-mounted pill settle so burstAt reads its real box.
    const ek = motion.enemyNexusHit?.key ?? null;
    if (ek != null && ek !== seenHexHitRef.current.enemy) {
      seenHexHitRef.current.enemy = ek;
      window.setTimeout(() => {
        fxRef.current?.burstAt("death", document.querySelector(".live-topbar__pill--nexus-enemy"));
      }, 20);
    }
    const ok = motion.ownNexusHit?.key ?? null;
    if (ok != null && ok !== seenHexHitRef.current.own) {
      seenHexHitRef.current.own = ok;
      window.setTimeout(() => {
        fxRef.current?.burstAt("damage", document.querySelector(".live-topbar__pill--nexus-own"));
      }, 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion.enemyNexusHit, motion.ownNexusHit]);

  // ---- MATCH-END CEREMONY (presentation-only) -----------------------------
  // The board only knows `winner`. The ranked rating delta + any tier crossing
  // are authoritative server facts, so we snapshot the rating BEFORE the match
  // resolves (on mount, when signed in) and reconcile AFTER it resolves to
  // derive the delta, then ask the server for a one-time rank-up event. All of
  // this degrades to nulls when solo/guest/offline (fetchMyRanking +
  // fetchPendingRankup return null), in which case the ceremony still shows
  // VICTORY/DEFEAT and simply omits the delta / rank-up beat.
  const [ceremonyDismissed, setCeremonyDismissed] = useState(false);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [rankup, setRankup] = useState<RankupEvent | null>(null);
  const baselineRatingRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);

  // Snapshot the pre-match authoritative rating once on mount (best-effort).
  useEffect(() => {
    let alive = true;
    fetchMyRanking()
      .then((r) => {
        if (alive && r) baselineRatingRef.current = r.rating;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // On the transition into a decided match, reconcile rating + pull rank-up.
  useEffect(() => {
    if (!matchOver || resolvedRef.current) return;
    resolvedRef.current = true;
    let alive = true;
    (async () => {
      try {
        const after = await fetchMyRanking();
        if (alive && after && baselineRatingRef.current !== null) {
          setRatingDelta(after.rating - baselineRatingRef.current);
        }
      } catch {
        /* solo/guest/offline — no delta */
      }
      try {
        const pending = await fetchPendingRankup();
        if (alive && pending) setRankup(pending);
      } catch {
        /* no rank-up to celebrate */
      }
    })();
    return () => {
      alive = false;
    };
  }, [matchOver]);

  // A fresh match clears the ceremony so it can fire again next time.
  useEffect(() => {
    setCeremonyDismissed(false);
    setRatingDelta(null);
    setRankup(null);
    resolvedRef.current = false;
  }, [match.seed]);

  // Victory/defeat particle bloom — one celebratory beat as the match resolves,
  // layered under the CSS ceremony panel. Reduced-motion makes it a no-op.
  const bloomFiredRef = useRef(false);
  useEffect(() => {
    if (!matchOver) {
      bloomFiredRef.current = false;
      return;
    }
    if (bloomFiredRef.current) return;
    bloomFiredRef.current = true;
    fxRef.current?.bloom(playerWon ? "win" : "loss");
  }, [matchOver, playerWon]);

  return (
    <div
      className={`live-match-shell ${motion.boardFlinch ? "mm-flinch" : ""}`}
      data-battlefield={battlefieldStage}
    >
      <MatchTopBar
        turn={match.turn ?? 1}
        activePlayer={perspectiveActive}
        p1Health={match.players[mySeat].nexusHealth ?? 20}
        p2Health={match.players[opponentSeat].nexusHealth ?? 20}
        energy={energy}
        maxEnergy={maxEnergy}
        deckSource={deckSource}
        onEndTurn={safeEndTurn}
        onReset={resetMatch}
        ownNexusHit={motion.ownNexusHit}
        enemyNexusHit={motion.enemyNexusHit}
        enemyHexTargetable={attackReady}
        onAttackEnemyHex={resolveAttackFace}
      />

      {statusBanner}


      {/* THE TABLE — a single-screen battlefield. The board (two framed ground
          zones meeting at a glowing seam) sits left; a vertical rail of
          commanders + decks + artifacts sits right. Enemy army on top facing
          down, your army on the bottom facing up. The hand + actions dock below. */}
      <div className="crypt-table">
        <div className="crypt-board">
          {/* ENEMY ZONE (top, facing down): crimson-framed ground. Back lane
              farthest from the seam, front lane nearest it. */}
          <div className="crypt-zone crypt-zone--enemy">
            <span className="crypt-zone__label">Enemy Ground</span>
            <div className="crypt-zone__lanes">
              <div className="mm-lane-fx">
                <span ref={setLaneAnchor("enemyBack")} className="mm-lane-fx__anchor" aria-hidden="true" />
                <BoardLane
                  title="Enemy Back"
                  sideLabel={"Back\u2009/\u2009Enemy"}
                  cards={enemyBack}
                  highlight={attackReady ? "target" : null}
                  hint="Attackable"
                  unitMotion={motion.unitMotion}
                  floats={motion.unitFloats}
                  dying={dyingFor("enemy", "back")}
                  onSelect={(card) => {
                    if (spectator) return;
                    // Attacker chosen → click attacks this unit; else just target it.
                    if (resolveAttackUnit(card.id)) return;
                    setTargetBoardId(card.id);
                  }}
                />
              </div>
              <div className="mm-lane-fx">
                <span ref={setLaneAnchor("enemyFront")} className="mm-lane-fx__anchor" aria-hidden="true" />
                <BoardLane
                  title="Enemy Front"
                  sideLabel={"Front\u2009/\u2009Enemy"}
                  cards={enemyFront}
                  highlight={attackReady ? "target" : null}
                  hint="Attackable"
                  unitMotion={motion.unitMotion}
                  floats={motion.unitFloats}
                  dying={dyingFor("enemy", "front")}
                  onSelect={(card) => {
                    if (spectator) return;
                    // Attacker chosen → click attacks this unit; else just target it.
                    if (resolveAttackUnit(card.id)) return;
                    setTargetBoardId(card.id);
                  }}
                />
              </div>
            </div>
          </div>

          {/* CENTER SEAM — a glowing divider with a medallion where the armies meet. */}
          <div className="crypt-seam" aria-hidden="true">
            <span className="crypt-seam__medallion">{"\u2B22"}</span>
          </div>

          {/* YOUR ZONE (bottom, facing up): gold-framed ground. Front lane nearest
              the seam, back lane behind it. */}
          <div className="crypt-zone crypt-zone--own">
            <span className="crypt-zone__label">Your Ground</span>
            <div className="crypt-zone__lanes">
              <div className="mm-lane-fx">
                <span ref={setLaneAnchor("ownFront")} className="mm-lane-fx__anchor" aria-hidden="true" />
                <BoardLane
                  title="Your Front"
                  sideLabel={"Front\u2009/\u2009Yours"}
                  cards={ownFront}
                  highlight={deployReady ? "deploy" : null}
                  hint="Play here"
                  unitMotion={ownUnitMotion}
                  floats={motion.unitFloats}
                  dying={dyingFor("own", "front")}
                  onSelect={(card) => {
                    safeSetSelectedBoardId(card.id);
                  }}
                />
              </div>
              <div className="mm-lane-fx">
                <span ref={setLaneAnchor("ownBack")} className="mm-lane-fx__anchor" aria-hidden="true" />
                <BoardLane
                  title="Your Back"
                  sideLabel={"Back\u2009/\u2009Yours"}
                  cards={ownBack}
                  highlight={deployReady ? "deploy" : null}
                  hint="Play here"
                  unitMotion={ownUnitMotion}
                  floats={motion.unitFloats}
                  dying={dyingFor("own", "back")}
                  onSelect={(card) => {
                    safeSetSelectedBoardId(card.id);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT RAIL — commanders + decks pulled out of the floating chips. */}
        <aside className="crypt-rail">
          <div className="crypt-rail__group crypt-rail__group--enemy">
            <span className="crypt-rail__head">Enemy</span>
            {enemyCommander ? <CommanderHero commander={enemyCommander} compact /> : null}
            <DeckPile count={enemyDeckCount} label="Enemy Deck" />
          </div>

          <div className="crypt-rail__group crypt-rail__group--own">
            <span className="crypt-rail__head">You</span>
            {ownCommander ? <CommanderHero commander={ownCommander} compact /> : null}
            {ownArtifacts.length ? (
              <BoardLane
                title="Your Artifacts"
                sideLabel="Artifacts"
                cards={ownArtifacts}
                onSelect={(card) => safeSetInspectId(card.id)}
              />
            ) : null}
            <DeckPile count={ownDeckCount} label="Your Deck" />
          </div>
        </aside>
      </div>

      {/* DOCK — hand + actions + log, pinned below the field (hand first so it
          sits right under your lanes). */}
      <div className="crypt-dock">
        <section className="live-hand">
          <div className="live-hand__header">
            <span className="kicker">Your Hand</span>
            <div className="live-hand__header-meta">
              <span>{ownHand.length} cards</span>
              {pvpMatchId ? <EmoteBar matchId={pvpMatchId} myId={mySeat} /> : null}
              <SoundToggle />
            </div>
          </div>
          <div className="live-hand__rail">
            {ownHand.map((card: PlayCardVM) => {
              const affordable = affordableCostFor(card.id);
              const justDrawn = drawnIds.has(card.id);
              return (
                <div
                  className={`live-hand__item ${affordable ? "" : "live-hand__item--unaffordable"}${
                    justDrawn ? " mm-hand-draw" : ""
                  }`}
                  key={card.id}
                >
                  <HandCard
                    card={card}
                    onSelect={(c) => {
                      safeSetSelectedHandId(c.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {!spectator ? (
          <div className="crypt-dock__actions">
            <ActionBar
              selectedType={actionsLocked ? null : selectedHandCard?.type ?? null}
              canEquip={!actionsLocked && selectedHandCard?.type === "equipment" && !!selectedOwnUnit}
              canCast={!actionsLocked && selectedHandCard?.type === "spell"}
              canAttackUnit={!actionsLocked && !!selectedOwnUnit && !!selectedEnemyUnit}
              canAttackFace={!actionsLocked && !!selectedOwnUnit && !selectedEnemyUnit}
              affordable={!selectedHandCard || affordableCostFor(selectedHandCard.id)}
              energy={energy}
              selectedCost={selectedHandCard?.liveStats?.cost ?? selectedHandCard?.cost ?? null}
              rejectMessage={actionsLocked ? null : actionMessage}
              onPlayFront={() => safePlaySelectedUnit("front")}
              onPlayBack={() => safePlaySelectedUnit("back")}
              onPlayArtifact={safePlaySelectedArtifact}
              onCastSpell={() => {
                // Pass the currently-selected board unit as the spell's target:
                // an enemy unit (damage/debuff) takes priority, else your own
                // unit (heal/buff). Untargeted spells ignore it. The reducer
                // rejects (and the status line surfaces) an illegal/missing
                // target, so the UI doesn't re-implement the targeting rules.
                const target = selectedEnemyUnit?.id ?? selectedOwnUnit?.id ?? undefined;
                safePlaySelectedSpell(target);
                setTargetBoardId(null);
              }}
              onEquip={() => {
                if (selectedOwnUnit) safeEquipSelectedToUnit(selectedOwnUnit.id);
              }}
              onAttackUnit={() => {
                if (selectedEnemyUnit) resolveAttackUnit(selectedEnemyUnit.id);
              }}
              onAttackFace={() => {
                resolveAttackFace();
              }}
            />
          </div>
        ) : null}

        <CombatLogPanel log={combatLog} />
      </div>

      <InspectDrawer state={inspectState} onClose={() => setInspectId(null)} />

      {motion.turnBanner ? (
        <div className="mm-turn-banner" key={motion.turnBanner.key} aria-hidden="true">
          <div
            className={`mm-turn-banner__inner ${
              motion.turnBanner.who === "enemy" ? "mm-turn-banner__inner--enemy" : ""
            }`}
          >
            <span className="mm-turn-banner__glyph">{"\u2B22"}</span>
            {motion.turnBanner.who === "you" ? "Your Turn" : "Enemy Turn"}
          </div>
        </div>
      ) : null}

      {matchOver && !ceremonyDismissed ? (
        <MatchCeremony
          playerWon={playerWon}
          ratingDelta={ratingDelta}
          rankup={rankup}
          onRankupShown={() => {
            // Acknowledge on the server so this rank-up only ever plays once.
            void ackRankup().catch(() => {});
          }}
          onDismiss={() => {
            setCeremonyDismissed(true);
            resetMatch();
          }}
        />
      ) : null}

      {/* Particle/flash overlay — pinned over the whole shell, pointer-events
          none, so it never blocks the board. No-op under reduced motion. Plays
          in spectator mode too (it only reflects state, no interaction). */}
      <MatchFxCanvas ref={fxRef} />
    </div>
  );
}
