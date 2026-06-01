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
import { SoundToggle } from "./SoundToggle";
import { MatchCeremony } from "./MatchCeremony";
import { MatchFxCanvas, type MatchFxHandle, type FxKind } from "./MatchFxCanvas";
import { EmoteBar } from "./EmoteBar";
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
  const safeSetSelectedHandId = spectator ? NOOP : setSelectedHandId;
  const safeSetSelectedBoardId = spectator ? NOOP : setSelectedBoardId;
  const safeSetInspectId = spectator ? NOOP : setInspectId;
  const safeEndTurn = spectator ? NOOP : endTurn;
  const safeMulligan = spectator ? NOOP : mulligan;
  const safePlaySelectedUnit = spectator ? (NOOP as (lane: "front" | "back") => void) : playSelectedUnit;
  const safePlaySelectedArtifact = spectator ? NOOP : playSelectedArtifact;
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
  const firstEnemy = enemyFront[0] ?? enemyBack[0] ?? null;
  const firstOwn = ownFront[0] ?? ownBack[0] ?? null;

  // Affordance highlights: light the board to show what the current selection
  // can do, so the deploy/attack loop is legible without trial-and-error.
  // Deploy: a unit card is in hand → own lanes are valid landing spots.
  // Attack: an own unit is selected → enemy lanes are valid strike targets.
  const deployReady = !actionsLocked && selectedHandCard?.type === "unit";
  const attackReady = !actionsLocked && !!selectedOwnUnit;

  // Perspective-relative "Active" pill: "You" when it's my turn.
  const perspectiveActive: PlayerId = activePlayer === mySeat ? "P1" : "P2";

  const ownNexus = match.players[mySeat].nexusHealth ?? 20;
  const enemyNexus = match.players[opponentSeat].nexusHealth ?? 20;

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
    <div className={`live-match-shell ${motion.boardFlinch ? "mm-flinch" : ""}`}>
      <MatchTopBar
        turn={match.turn ?? 1}
        activePlayer={perspectiveActive}
        p1Health={match.players[mySeat].nexusHealth ?? 20}
        p2Health={match.players[opponentSeat].nexusHealth ?? 20}
        energy={energy}
        maxEnergy={maxEnergy}
        deckSource={deckSource}
        canRecalibrate={!spectator && mulliganAvailable && activePlayer === mySeat && !matchOver}
        onRecalibrate={safeMulligan}
        onEndTurn={safeEndTurn}
        onReset={resetMatch}
        ownNexusHit={motion.ownNexusHit}
        enemyNexusHit={motion.enemyNexusHit}
      />

      {statusBanner}

      {deckSource === "demo" ? (
        <p className="live-deckhint">
          You're fielding the demo deck. Connect a wallet holding Combat Archives
          to field your own cards.
        </p>
      ) : null}

      <div className="live-grid">
        <aside className="live-grid__left">
          <CommanderHero
            commander={ownCommander}
            activeSyncText={
              selectedHandCard
                ? `Selected ${selectedHandCard.type}. Choose a legal action.`
                : "Live engine state. Select a card, unit, or target."
            }
          />
        </aside>

        <main className="live-grid__center">
          <div className="live-board-stack">
            {/* Each lane is wrapped in a relatively-positioned cell so the FX
                canvas can aim particle bursts at a centered, board-owned anchor
                WITHOUT touching BoardLane internals (owned elsewhere). The
                wrapper is a plain grid cell — same vertical order + gap. */}
            <div className="mm-lane-fx">
              <span ref={setLaneAnchor("enemyFront")} className="mm-lane-fx__anchor" aria-hidden="true" />
            <BoardLane
              title="Enemy Front"
              cards={enemyFront}
              highlight={attackReady ? "target" : null}
              hint="Attackable"
              unitMotion={motion.unitMotion}
              floats={motion.unitFloats}
              dying={dyingFor("enemy", "front")}
              onSelect={(card) => {
                // Combat targeting only. Opening the inspect modal here would
                // overlay the ActionBar's Attack buttons and block the core
                // combat loop, so selecting a unit stays modal-free.
                if (spectator) return;
                setTargetBoardId(card.id);
              }}
            />
            </div>
            <div className="mm-lane-fx">
              <span ref={setLaneAnchor("enemyBack")} className="mm-lane-fx__anchor" aria-hidden="true" />
            <BoardLane
              title="Enemy Back"
              cards={enemyBack}
              highlight={attackReady ? "target" : null}
              hint="Attackable"
              unitMotion={motion.unitMotion}
              floats={motion.unitFloats}
              dying={dyingFor("enemy", "back")}
              onSelect={(card) => {
                if (spectator) return;
                setTargetBoardId(card.id);
              }}
            />
            </div>
            <div className="mm-lane-fx">
              <span ref={setLaneAnchor("ownFront")} className="mm-lane-fx__anchor" aria-hidden="true" />
            <BoardLane
              title="Your Front"
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
            {ownArtifacts.length ? (
              <BoardLane
                title="Your Artifacts"
                cards={ownArtifacts}
                onSelect={(card) => safeSetInspectId(card.id)}
              />
            ) : null}
          </div>

          <section className="live-hand">
            <div className="live-hand__header">
              <h2>Hand</h2>
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
                        // Select-to-play only. Opening the inspect modal here would
                        // overlay the ActionBar's Play Front/Back buttons and block
                        // the core deploy loop, so selection stays modal-free.
                        safeSetSelectedHandId(c.id);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="live-grid__right">
          {/* Spectator mode is OBSERVATIONAL: no ActionBar + no quick-target
              controls. Even were they rendered, the safe* handlers are no-ops —
              this just removes the affordance entirely so the surface reads as
              "watch only". The combat log stays so a watcher follows the match. */}
          {!spectator ? (
            <>
              <ActionBar
                selectedType={actionsLocked ? null : selectedHandCard?.type ?? null}
                canEquip={!actionsLocked && selectedHandCard?.type === "equipment" && !!selectedOwnUnit}
                canAttackUnit={!actionsLocked && !!selectedOwnUnit && !!selectedEnemyUnit}
                canAttackFace={!actionsLocked && !!selectedOwnUnit && !selectedEnemyUnit}
                onPlayFront={() => safePlaySelectedUnit("front")}
                onPlayBack={() => safePlaySelectedUnit("back")}
                onPlayArtifact={safePlaySelectedArtifact}
                onEquip={() => {
                  if (selectedOwnUnit) safeEquipSelectedToUnit(selectedOwnUnit.id);
                }}
                onAttackUnit={() => {
                  if (selectedOwnUnit && selectedEnemyUnit) {
                    triggerLunge(selectedOwnUnit.id);
                    safeAttackUnit(selectedOwnUnit.id, selectedEnemyUnit.id);
                    setTargetBoardId(null);
                  }
                }}
                onAttackFace={() => {
                  if (selectedOwnUnit) {
                    triggerLunge(selectedOwnUnit.id);
                    safeAttackFace(selectedOwnUnit.id);
                    setTargetBoardId(null);
                  }
                }}
              />

              <section className="live-side-panel">
                <h3>Quick Targets</h3>
                <div className="live-quick-buttons">
                  <button
                    className="live-btn live-btn--ghost"
                    disabled={!firstOwn}
                    onClick={() => {
                      // Action path: select only. Opening the inspect modal here
                      // would cover the ActionBar and block chaining into a
                      // target + attack.
                      if (firstOwn) safeSetSelectedBoardId(firstOwn.id);
                    }}
                  >
                    Select Own Unit
                  </button>
                  <button
                    className="live-btn live-btn--ghost"
                    disabled={!firstEnemy}
                    onClick={() => {
                      // Action path: select only (see "Select Own Unit" above).
                      if (firstEnemy) setTargetBoardId(firstEnemy.id);
                    }}
                  >
                    Select Enemy Unit
                  </button>
                </div>
              </section>
            </>
          ) : null}

          <CombatLogPanel log={combatLog} />
        </aside>
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
