import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { getPlayableCardById } from "../engine/cards";
import { useGame } from "../hooks/useGame";
import { useRenderManifest } from "../hooks/useRenderManifest";
import type { PlayerId } from "../lib/gameClient";
import { legalTargetInstanceIds } from "./match/combatRules";
import { CombatHud } from "./match/CombatHud";
import { OpponentZone } from "./match/OpponentZone";
import { PlayerZone } from "./match/PlayerZone";
import { BattleRow } from "./match/BattleRow";
import { HandTray } from "./match/HandTray";
import { StrikeIntentOverlay } from "./match/StrikeIntentOverlay";

function commanderCardId(player: any): string | undefined {
  return (
    player?.commanderZone?.cardId ?? player?.commander?.id ?? player?.commanderId
  );
}

export default function MatchPage() {
  const navigate = useNavigate();
  const { match, combatLog, actions } = useGame();
  const { entryById, loading, error, ready } = useRenderManifest();
  const [equipHandIndex, setEquipHandIndex] = useState<number | null>(null);
  const [attackPick, setAttackPick] = useState<string | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [strikeHoverTarget, setStrikeHoverTarget] = useState<string | null>(null);

  const boardAnchorsRef = useRef(new Map<string, HTMLElement>());
  const registerBoardAnchor = useCallback((instanceId: string, el: HTMLElement | null) => {
    if (el) boardAnchorsRef.current.set(instanceId, el);
    else boardAnchorsRef.current.delete(instanceId);
  }, []);
  const getAnchorEl = useCallback((id: string) => boardAnchorsRef.current.get(id), []);

  const active = match.activePlayer as PlayerId;
  const phase = match.phase ?? "—";
  const winner = match.winner;

  const deckSize = (p: any) =>
    typeof p.deckCount === "number" ? p.deckCount : p.deck?.length ?? 0;

  const resolveCommanderEntry = (cardId: string | undefined) =>
    cardId ? entryById.get(cardId) : undefined;

  const equipCard =
    equipHandIndex !== null
      ? getPlayableCardById((match.players[active] as any)?.hand?.[equipHandIndex])
      : null;

  const enemyId: PlayerId = active === "P1" ? "P2" : "P1";
  const enemyFrontEmpty = ((match.players[enemyId] as any)?.board?.front ?? []).length === 0;

  const hand = (match.players[active] as any)?.hand ?? [];

  const legalTargets = attackPick ? legalTargetInstanceIds(match, enemyId) : null;

  const clearInteractionState = () => {
    setSelectedHandIndex(null);
    setEquipHandIndex(null);
    setAttackPick(null);
    setStrikeHoverTarget(null);
  };

  const strikeActive = !!attackPick && !winner;

  const p2 = match.players.P2 as any;
  const p1 = match.players.P1 as any;

  const MATCH_END_GATE = "crypt.lastMatchEndNav";
  useEffect(() => {
    if (!winner && match.turn === 1) {
      try {
        sessionStorage.removeItem(MATCH_END_GATE);
      } catch {
        /* ignore */
      }
    }
  }, [winner, match.turn]);

  useEffect(() => {
    if (!winner) return;
    const key = `${winner}:${match.turn}`;
    try {
      if (sessionStorage.getItem(MATCH_END_GATE) === key) return;
      sessionStorage.setItem(MATCH_END_GATE, key);
    } catch {
      /* still navigate */
    }
    navigate("/match/result", {
      replace: true,
      state: {
        nonce: crypto.randomUUID(),
        winner: String(winner),
        turn: match.turn,
        p1CommanderId: commanderCardId(p1) ?? "",
        p2CommanderId: commanderCardId(p2) ?? "",
      },
    });
  }, [winner, match.turn, navigate, p1, p2]);

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <div className="crypt-match-root flex min-h-[calc(100dvh-49px)] flex-col">
        <CombatHud
          turn={match.turn}
          phase={String(phase)}
          activePlayer={active}
          winner={winner}
          onEndTurn={() => {
            actions.endTurn();
            clearInteractionState();
          }}
          endTurnDisabled={!!winner}
          attackPick={attackPick}
          enemyFrontEmpty={enemyFrontEmpty}
          legalTargetCount={legalTargets?.size ?? 0}
          onStrikeFace={() => {
            if (attackPick) actions.attack(attackPick);
            setAttackPick(null);
            setStrikeHoverTarget(null);
          }}
          onCancelCombat={() => {
            setAttackPick(null);
            setStrikeHoverTarget(null);
          }}
        />

        <OpponentZone
          player={p2}
          commanderEntry={resolveCommanderEntry(commanderCardId(p2))}
          entryById={entryById}
          deckCount={deckSize(match.players.P2)}
        />

        <div className="crypt-battlefield relative flex min-h-[min(36vh,320px)] flex-1 flex-col justify-center">
          <StrikeIntentOverlay
            active={strikeActive}
            attackPick={attackPick}
            strikeHoverTarget={strikeHoverTarget}
            enemyFrontEmpty={enemyFrontEmpty}
            getAnchorEl={getAnchorEl}
          />
          <BattleRow
            playerId="P2"
            side="foe"
            match={match}
            active={active}
            winner={winner}
            attackPick={attackPick}
            legalTargets={legalTargets}
            equipHandIndex={equipHandIndex}
            equipCardType={equipCard?.type}
            entryById={entryById}
            registerBoardAnchor={registerBoardAnchor}
            onStrikeHoverTarget={setStrikeHoverTarget}
            strikeHoverTarget={strikeHoverTarget}
            onDeclareAttacker={(id) => {
              setAttackPick(id);
              setSelectedHandIndex(null);
              setStrikeHoverTarget(null);
            }}
            onStrikeUnit={(defenderId) => {
              if (attackPick) actions.attack(attackPick, defenderId);
              setAttackPick(null);
              setStrikeHoverTarget(null);
            }}
            onAffixEquipment={(targetId) => {
              if (equipHandIndex !== null) {
                actions.playEquipment(active, equipHandIndex, targetId);
                setEquipHandIndex(null);
              }
            }}
          />

          <div className="crypt-battlefield-void pointer-events-none" aria-hidden />

          <BattleRow
            playerId="P1"
            side="self"
            match={match}
            active={active}
            winner={winner}
            attackPick={attackPick}
            legalTargets={legalTargets}
            equipHandIndex={equipHandIndex}
            equipCardType={equipCard?.type}
            entryById={entryById}
            registerBoardAnchor={registerBoardAnchor}
            onStrikeHoverTarget={setStrikeHoverTarget}
            strikeHoverTarget={strikeHoverTarget}
            onDeclareAttacker={(id) => {
              setAttackPick(id);
              setSelectedHandIndex(null);
              setStrikeHoverTarget(null);
            }}
            onStrikeUnit={(defenderId) => {
              if (attackPick) actions.attack(attackPick, defenderId);
              setAttackPick(null);
              setStrikeHoverTarget(null);
            }}
            onAffixEquipment={(targetId) => {
              if (equipHandIndex !== null) {
                actions.playEquipment(active, equipHandIndex, targetId);
                setEquipHandIndex(null);
              }
            }}
          />
        </div>

        <PlayerZone
          player={p1}
          commanderEntry={resolveCommanderEntry(commanderCardId(p1))}
          entryById={entryById}
          deckCount={deckSize(match.players.P1)}
        />

        <HandTray
          hand={hand}
          winner={winner}
          entryById={entryById}
          selectedHandIndex={selectedHandIndex}
          onSelectHandIndex={setSelectedHandIndex}
          equipHandIndex={equipHandIndex}
          onCancelEquip={() => setEquipHandIndex(null)}
          onPlayUnit={(index) => actions.playUnit(active, index, "front")}
          onStartEquip={(index) => {
            setEquipHandIndex(index);
            setSelectedHandIndex(null);
          }}
          onPlayArtifact={(index) => actions.playArtifact(active, index)}
        />

        <footer className="crypt-match-log-footer">
          <div className="crypt-match-log-footer-inner">
            {combatLog.length === 0 ? (
              <span className="crypt-log-quiet">Log</span>
            ) : (
              <ul className="crypt-log-lines">
                {combatLog.slice(-5).map((line, i) => (
                  <li key={`${combatLog.length}-${i}`}>{line}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="crypt-log-reset"
              onClick={() => {
                actions.reset();
                clearInteractionState();
              }}
            >
              New match
            </button>
          </div>
        </footer>
      </div>
    </CatalogLoader>
  );
}
