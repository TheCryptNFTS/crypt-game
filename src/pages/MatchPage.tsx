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
import { HandTray } from "./match/HandTray";
import { BattlefieldSurface } from "./match/BattlefieldSurface";
import { MatchFooterLog } from "./match/MatchFooterLog";

function commanderCardId(player: any): string | undefined {
  return (
    player?.commanderZone?.cardId ?? player?.commander?.id ?? player?.commanderId
  );
}

type InteractionMode =
  | { type: "idle" }
  | { type: "hand_selected"; handIndex: number }
  | { type: "equip_targeting"; handIndex: number }
  | { type: "attack_targeting"; attackerId: string; hoverTargetId: string | null };

export default function MatchPage() {
  const navigate = useNavigate();
  const { match, combatLog, uiError, actions } = useGame();
  const { entryById, loading, error, ready } = useRenderManifest();

  const [interaction, setInteraction] = useState<InteractionMode>({ type: "idle" });

  const boardAnchorsRef = useRef(new Map<string, HTMLElement>());

  const registerBoardAnchor = useCallback(
    (instanceId: string, el: HTMLElement | null) => {
      if (el) boardAnchorsRef.current.set(instanceId, el);
      else boardAnchorsRef.current.delete(instanceId);
    },
    []
  );

  const getAnchorEl = useCallback((id: string) => boardAnchorsRef.current.get(id), []);

  const active = match.activePlayer as PlayerId;
  const phase = match.phase ?? "—";
  const winner = match.winner;

  const p1 = match.players.P1 as any;
  const p2 = match.players.P2 as any;

  const selectedHandIndex =
    interaction.type === "hand_selected" ? interaction.handIndex : null;

  const equipHandIndex =
    interaction.type === "equip_targeting" ? interaction.handIndex : null;

  const attackPick =
    interaction.type === "attack_targeting" ? interaction.attackerId : null;

  const strikeHoverTarget =
    interaction.type === "attack_targeting" ? interaction.hoverTargetId : null;

  const clearInteractionState = useCallback(() => {
    setInteraction({ type: "idle" });
  }, []);

  const handleSelectHandIndex = useCallback((index: number | null) => {
    if (index === null) {
      setInteraction({ type: "idle" });
      return;
    }
    setInteraction({ type: "hand_selected", handIndex: index });
  }, []);

  const handleStartEquip = useCallback((index: number) => {
    setInteraction({ type: "equip_targeting", handIndex: index });
  }, []);

  const handleCancelEquip = useCallback(() => {
    setInteraction({ type: "idle" });
  }, []);

  const handleDeclareAttacker = useCallback((instanceId: string) => {
    setInteraction({
      type: "attack_targeting",
      attackerId: instanceId,
      hoverTargetId: null,
    });
  }, []);

  const handleStrikeHoverTarget = useCallback((instanceId: string | null) => {
    setInteraction((prev) =>
      prev.type === "attack_targeting"
        ? { ...prev, hoverTargetId: instanceId }
        : prev
    );
  }, []);

  const handleStrikeUnit = useCallback(
    (defenderInstanceId: string) => {
      setInteraction((prev) => {
        if (prev.type !== "attack_targeting") return prev;
        actions.attack(prev.attackerId, defenderInstanceId);
        return { type: "idle" };
      });
    },
    [actions]
  );

  const handleStrikeFace = useCallback(() => {
    setInteraction((prev) => {
      if (prev.type !== "attack_targeting") return prev;
      actions.attack(prev.attackerId);
      return { type: "idle" };
    });
  }, [actions]);

  const handleCancelCombat = useCallback(() => {
    setInteraction((prev) =>
      prev.type === "attack_targeting" ? { type: "idle" } : prev
    );
  }, []);

  const handleAffixEquipment = useCallback(
    (targetInstanceId: string) => {
      setInteraction((prev) => {
        if (prev.type !== "equip_targeting") return prev;
        actions.playEquipment(active, prev.handIndex, targetInstanceId);
        return { type: "idle" };
      });
    },
    [actions, active]
  );

  const deckSize = (player: any) =>
    typeof player.deckCount === "number"
      ? player.deckCount
      : player.deck?.length ?? 0;

  const resolveCommanderEntry = (cardId: string | undefined) =>
    cardId ? entryById.get(cardId) : undefined;

  const equipCard =
    equipHandIndex !== null
      ? getPlayableCardById((match.players[active] as any)?.hand?.[equipHandIndex])
      : null;

  const enemyId: PlayerId = active === "P1" ? "P2" : "P1";
  const enemyFrontEmpty =
    ((match.players[enemyId] as any)?.board?.front ?? []).length === 0;

  const hand = (match.players[active] as any)?.hand ?? [];
  const legalTargets = attackPick ? legalTargetInstanceIds(match, enemyId) : null;
  const strikeActive = !!attackPick && !winner;

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
          onStrikeFace={handleStrikeFace}
          onCancelCombat={handleCancelCombat}
        />

        {uiError && (
          <div className="mx-auto mt-2 w-[min(960px,92vw)] rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <div className="flex items-center justify-between gap-3">
              <span>{uiError}</span>
              <button
                type="button"
                className="rounded-md border border-red-400/40 px-2 py-1 text-xs"
                onClick={actions.clearUiError}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <OpponentZone
          player={p2}
          commanderEntry={resolveCommanderEntry(commanderCardId(p2))}
          entryById={entryById}
          deckCount={deckSize(match.players.P2)}
        />

        <BattlefieldSurface
          match={match}
          active={active}
          winner={winner}
          attackPick={attackPick}
          legalTargets={legalTargets}
          equipHandIndex={equipHandIndex}
          equipCardType={equipCard?.type}
          entryById={entryById}
          registerBoardAnchor={registerBoardAnchor}
          getAnchorEl={getAnchorEl}
          strikeActive={strikeActive}
          strikeHoverTarget={strikeHoverTarget}
          enemyFrontEmpty={enemyFrontEmpty}
          onStrikeHoverTarget={handleStrikeHoverTarget}
          onDeclareAttacker={handleDeclareAttacker}
          onStrikeUnit={handleStrikeUnit}
          onAffixEquipment={handleAffixEquipment}
        />

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
          onSelectHandIndex={handleSelectHandIndex}
          equipHandIndex={equipHandIndex}
          onCancelEquip={handleCancelEquip}
          onPlayUnit={(index) => {
            actions.playUnit(active, index, "front");
            clearInteractionState();
          }}
          onStartEquip={handleStartEquip}
          onPlayArtifact={(index) => {
            actions.playArtifact(active, index);
            clearInteractionState();
          }}
        />

        <MatchFooterLog
          combatLog={combatLog}
          onNewMatch={() => {
            actions.reset();
            clearInteractionState();
          }}
        />
      </div>
    </CatalogLoader>
  );
}
