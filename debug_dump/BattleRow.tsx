import PlayableCard from "../../components/cards/PlayableCard";
import type { RenderManifestEntry } from "../../types/renderManifest";
import type { PlayerId } from "../../lib/gameClient";
import { boardChromeForUnit, canUnitAttackUi } from "./combatRules";

type BattleRowProps = {
  playerId: PlayerId;
  side: "foe" | "self";
  match: any;
  active: PlayerId;
  winner: string | null | undefined;
  attackPick: string | null;
  legalTargets: Set<string> | null;
  equipHandIndex: number | null;
  equipCardType: string | null | undefined;
  entryById: Map<string, RenderManifestEntry>;
  registerBoardAnchor?: (instanceId: string, el: HTMLElement | null) => void;
  onStrikeHoverTarget?: (instanceId: string | null) => void;
  strikeHoverTarget?: string | null;
  onDeclareAttacker: (instanceId: string) => void;
  onStrikeUnit: (defenderInstanceId: string) => void;
  onAffixEquipment: (targetInstanceId: string) => void;
};

export function BattleRow({
  playerId,
  side,
  match,
  active,
  winner,
  attackPick,
  legalTargets,
  equipHandIndex,
  equipCardType,
  entryById,
  registerBoardAnchor,
  onStrikeHoverTarget,
  strikeHoverTarget = null,
  onDeclareAttacker,
  onStrikeUnit,
  onAffixEquipment,
}: BattleRowProps) {
  const p = match.players[playerId];
  const units = p?.board?.front ?? [];
  const isActiveSide = playerId === active;

  return (
    <div
      className={[
        "crypt-battle-row relative z-[1] flex min-h-[104px] flex-wrap justify-center gap-5 md:gap-8",
        side === "foe" ? "crypt-battle-row--foe items-end pb-1" : "crypt-battle-row--self items-start pt-1",
      ].join(" ")}
    >
      {units.length === 0 && (
        <span className="self-center crypt-battle-row-empty" aria-hidden>
          Empty lane
        </span>
      )}
      {units.map((u: any) => {
        const canPickAttack =
          attackPick === null && isActiveSide && playerId === active && !winner;
        const mayDeclareAttack = canPickAttack && canUnitAttackUi(u);
        const isAttackTarget = !!attackPick && playerId !== active && !winner;
        const isLegalStrike =
          isAttackTarget && legalTargets && legalTargets.has(u.instanceId);

        const chromeState = boardChromeForUnit({
          playerId,
          active,
          side,
          u,
          winner,
          attackPick,
          legalTargets,
          equipHandIndex,
          equipIsEquipment: equipCardType === "equipment",
        });

        const lockPreview = isLegalStrike && strikeHoverTarget === u.instanceId;

        const anchorClasses = [
          chromeState === "boardAttacker" ? "crypt-attacker-anchor" : "",
          isLegalStrike ? "crypt-legal-target-anchor" : "",
          lockPreview ? "crypt-strike-lock-active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={u.instanceId} className="crypt-board-unit flex flex-col items-center gap-1.5">
            <div
              ref={(el) => registerBoardAnchor?.(u.instanceId, el)}
              className={["crypt-board-clip relative", anchorClasses].filter(Boolean).join(" ")}
              onMouseEnter={() => {
                if (isLegalStrike) onStrikeHoverTarget?.(u.instanceId);
              }}
              onMouseLeave={() => {
                if (isLegalStrike) onStrikeHoverTarget?.(null);
              }}
            >
              <PlayableCard
                entry={entryById.get(u.cardId)}
                mode="board"
                attack={u.attack}
                health={u.health}
                exhausted={u.exhausted}
                summoningSick={u.summoningSick}
                chromeState={chromeState}
                onClick={
                  isAttackTarget && isLegalStrike ? () => onStrikeUnit(u.instanceId) : undefined
                }
              />
            </div>
            <div className="crypt-board-actions flex min-h-[1rem] flex-wrap justify-center gap-x-2 gap-y-0.5 px-0.5">
              {playerId === active && !winner && equipHandIndex !== null && equipCardType === "equipment" && (
                <button
                  type="button"
                  className="crypt-link-affix"
                  onClick={() => onAffixEquipment(u.instanceId)}
                >
                  Affix here
                </button>
              )}
              {canPickAttack && mayDeclareAttack && (
                <button type="button" className="crypt-link-declare" onClick={() => onDeclareAttacker(u.instanceId)}>
                  Attack with this unit
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
