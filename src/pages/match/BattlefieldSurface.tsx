import type { RenderManifestEntry } from "../../types/renderManifest";
import type { PlayerId } from "../../lib/gameClient";
import { BattleRow } from "./BattleRow";
import { StrikeIntentOverlay } from "./StrikeIntentOverlay";

type BattlefieldSurfaceProps = {
  match: any;
  active: PlayerId;
  winner: string | null | undefined;
  attackPick: string | null;
  legalTargets: Set<string> | null;
  equipHandIndex: number | null;
  equipCardType: string | null | undefined;
  entryById: Map<string, RenderManifestEntry>;
  registerBoardAnchor?: (instanceId: string, el: HTMLElement | null) => void;
  getAnchorEl: (id: string) => HTMLElement | undefined;
  strikeActive: boolean;
  strikeHoverTarget: string | null;
  enemyFrontEmpty: boolean;
  onStrikeHoverTarget: (instanceId: string | null) => void;
  onDeclareAttacker: (instanceId: string) => void;
  onStrikeUnit: (defenderInstanceId: string) => void;
  onAffixEquipment: (targetInstanceId: string) => void;
};

export function BattlefieldSurface({
  match,
  active,
  winner,
  attackPick,
  legalTargets,
  equipHandIndex,
  equipCardType,
  entryById,
  registerBoardAnchor,
  getAnchorEl,
  strikeActive,
  strikeHoverTarget,
  enemyFrontEmpty,
  onStrikeHoverTarget,
  onDeclareAttacker,
  onStrikeUnit,
  onAffixEquipment,
}: BattlefieldSurfaceProps) {
  return (
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
        equipCardType={equipCardType}
        entryById={entryById}
        registerBoardAnchor={registerBoardAnchor}
        onStrikeHoverTarget={onStrikeHoverTarget}
        strikeHoverTarget={strikeHoverTarget}
        onDeclareAttacker={onDeclareAttacker}
        onStrikeUnit={onStrikeUnit}
        onAffixEquipment={onAffixEquipment}
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
        equipCardType={equipCardType}
        entryById={entryById}
        registerBoardAnchor={registerBoardAnchor}
        onStrikeHoverTarget={onStrikeHoverTarget}
        strikeHoverTarget={strikeHoverTarget}
        onDeclareAttacker={onDeclareAttacker}
        onStrikeUnit={onStrikeUnit}
        onAffixEquipment={onAffixEquipment}
      />
    </div>
  );
}
