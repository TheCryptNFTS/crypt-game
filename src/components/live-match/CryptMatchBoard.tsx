import React, { useMemo } from "react";
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
  } = props;

  const opponentSeat: PlayerId = mySeat === "P1" ? "P2" : "P1";
  const matchOver = !!winner;
  const playerWon = winner === mySeat;
  // Lock my actions when the match is over or it's not my turn.
  const actionsLocked = matchOver || activePlayer !== mySeat;

  const ownCommander = getCommanderVmForPlayer(match.players[mySeat]);

  const ownHand = (match.players[mySeat].hand ?? []).map((cardId: string) =>
    handToVm(match, mySeat, cardId, selectedHandId === cardId)
  );

  const ownFront = (match.players[mySeat].board?.front ?? []).map((unit: any) =>
    unitToVm(mySeat, unit, selectedBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const ownBack = (match.players[mySeat].board?.back ?? []).map((unit: any) =>
    unitToVm(mySeat, unit, selectedBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const enemyFront = (match.players[opponentSeat].board?.front ?? []).map((unit: any) =>
    unitToVm(opponentSeat, unit, selectedBoardId === unit.instanceId || inspectId === unit.instanceId)
  );

  const enemyBack = (match.players[opponentSeat].board?.back ?? []).map((unit: any) =>
    unitToVm(opponentSeat, unit, selectedBoardId === unit.instanceId || inspectId === unit.instanceId)
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
  const selectedEnemyUnit = [...enemyFront, ...enemyBack].find((u) => u.id === selectedBoardId) ?? null;
  const firstEnemy = enemyFront[0] ?? enemyBack[0] ?? null;
  const firstOwn = ownFront[0] ?? ownBack[0] ?? null;

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

  const dyingFor = (side: "own" | "enemy", lane: "front" | "back") =>
    motion.dying.filter((d) => d.side === side && d.lane === lane);

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
        canRecalibrate={mulliganAvailable && activePlayer === mySeat && !matchOver}
        onRecalibrate={mulligan}
        onEndTurn={endTurn}
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
            <BoardLane
              title="Enemy Front"
              cards={enemyFront}
              unitMotion={motion.unitMotion}
              floats={motion.unitFloats}
              dying={dyingFor("enemy", "front")}
              onSelect={(card) => {
                setSelectedBoardId(card.id);
                setInspectId(card.id);
              }}
            />
            <BoardLane
              title="Enemy Back"
              cards={enemyBack}
              unitMotion={motion.unitMotion}
              floats={motion.unitFloats}
              dying={dyingFor("enemy", "back")}
              onSelect={(card) => {
                setSelectedBoardId(card.id);
                setInspectId(card.id);
              }}
            />
            <BoardLane
              title="Your Front"
              cards={ownFront}
              unitMotion={motion.unitMotion}
              floats={motion.unitFloats}
              dying={dyingFor("own", "front")}
              onSelect={(card) => {
                setSelectedBoardId(card.id);
                setInspectId(card.id);
              }}
            />
            <BoardLane
              title="Your Back"
              cards={ownBack}
              unitMotion={motion.unitMotion}
              floats={motion.unitFloats}
              dying={dyingFor("own", "back")}
              onSelect={(card) => {
                setSelectedBoardId(card.id);
                setInspectId(card.id);
              }}
            />
            {ownArtifacts.length ? (
              <BoardLane
                title="Your Artifacts"
                cards={ownArtifacts}
                onSelect={(card) => setInspectId(card.id)}
              />
            ) : null}
          </div>

          <section className="live-hand">
            <div className="live-hand__header">
              <h2>Hand</h2>
              <span>{ownHand.length} cards</span>
            </div>
            <div className="live-hand__rail">
              {ownHand.map((card: PlayCardVM) => {
                const affordable = affordableCostFor(card.id);
                return (
                  <div
                    className={`live-hand__item ${affordable ? "" : "live-hand__item--unaffordable"}`}
                    key={card.id}
                  >
                    <HandCard
                      card={card}
                      onSelect={(c) => {
                        setSelectedHandId(c.id);
                        setInspectId(c.id);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="live-grid__right">
          <ActionBar
            selectedType={actionsLocked ? null : selectedHandCard?.type ?? null}
            canEquip={!actionsLocked && selectedHandCard?.type === "equipment" && !!selectedOwnUnit}
            canAttackUnit={!actionsLocked && !!selectedOwnUnit && !!selectedEnemyUnit}
            canAttackFace={!actionsLocked && !!selectedOwnUnit && !selectedEnemyUnit}
            onPlayFront={() => playSelectedUnit("front")}
            onPlayBack={() => playSelectedUnit("back")}
            onPlayArtifact={playSelectedArtifact}
            onEquip={() => {
              if (selectedOwnUnit) equipSelectedToUnit(selectedOwnUnit.id);
            }}
            onAttackUnit={() => {
              if (selectedOwnUnit && selectedEnemyUnit) attackUnit(selectedOwnUnit.id, selectedEnemyUnit.id);
            }}
            onAttackFace={() => {
              if (selectedOwnUnit) attackFace(selectedOwnUnit.id);
            }}
          />

          <section className="live-side-panel">
            <h3>Quick Targets</h3>
            <div className="live-quick-buttons">
              <button
                className="live-btn live-btn--ghost"
                disabled={!firstOwn}
                onClick={() => {
                  if (firstOwn) {
                    setSelectedBoardId(firstOwn.id);
                    setInspectId(firstOwn.id);
                  }
                }}
              >
                Select Own Unit
              </button>
              <button
                className="live-btn live-btn--ghost"
                disabled={!firstEnemy}
                onClick={() => {
                  if (firstEnemy) {
                    setSelectedBoardId(firstEnemy.id);
                    setInspectId(firstEnemy.id);
                  }
                }}
              >
                Select Enemy Unit
              </button>
            </div>
          </section>

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

      {matchOver ? (
        <div className="live-gameover" role="dialog" aria-modal="true">
          <div className={`live-gameover__panel ${playerWon ? "live-gameover__panel--win" : ""}`}>
            <span className="live-topbar__label">Transmission Ended</span>
            <h2 className="live-gameover__title">{playerWon ? "Signal Restored" : "Signal Lost"}</h2>
            <p className="live-gameover__sub">
              {playerWon
                ? "The enemy nexus has gone dark. Your transmission holds."
                : "Your nexus has gone dark. The signal fades."}
            </p>
            <button className="live-btn live-btn--primary" onClick={resetMatch}>
              Run It Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
