import { useState } from "react";
import { getPlayableCardById } from "../engine/cards";
import { useGame } from "../hooks/useGame";
import { useRenderManifest } from "../hooks/useRenderManifest";
import CardFrame from "../components/cards/CardFrame";
import type { PlayerId } from "../lib/gameClient";

function panelClass() {
  return "rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-4";
}

export default function MatchPage() {
  const { match, combatLog, actions } = useGame();
  const { entryById } = useRenderManifest();
  const [equipHandIndex, setEquipHandIndex] = useState<number | null>(null);
  const [attackPick, setAttackPick] = useState<string | null>(null);

  const active = match.activePlayer as PlayerId;
  const phase = match.phase ?? "—";
  const winner = match.winner;

  const p1 = match.players.P1 as any;
  const p2 = match.players.P2 as any;

  const deckCount = (p: any) => (typeof p.deckCount === "number" ? p.deckCount : p.deck?.length ?? 0);

  const commanderEntry = (cardId: string | undefined) =>
    cardId ? entryById.get(cardId) : undefined;

  const boardRow = (playerId: PlayerId, label: string) => {
    const p = match.players[playerId] as any;
    const units = p.board?.front ?? [];
    return (
      <div className={panelClass()}>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label} — front lane
        </div>
        <div className="flex min-h-[100px] flex-wrap gap-2">
          {units.length === 0 && (
            <span className="text-sm text-zinc-600">Empty</span>
          )}
          {units.map((u: any) => {
            const isOwn = playerId === active;
            const canPickAttack =
              attackPick === null && isOwn && playerId === active && !winner;
            const isAttackTarget =
              attackPick &&
              playerId !== active &&
              !winner;

            return (
              <div key={u.instanceId} className="w-40 space-y-1">
                <CardFrame entry={entryById.get(u.cardId)} compact className="!w-40" />
                <div className="text-[11px] text-zinc-400">
                  {u.attack}/{u.health} {u.exhausted ? "· exhausted" : ""}{" "}
                  {u.summoningSick ? "· summoning sick" : ""}
                </div>
                <div className="flex flex-wrap gap-1">
                  {playerId === active &&
                    !winner &&
                    equipHandIndex !== null &&
                    equipCard?.type === "equipment" && (
                      <button
                        type="button"
                        className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200"
                        onClick={() => {
                          actions.playEquipment(active, equipHandIndex, u.instanceId);
                          setEquipHandIndex(null);
                        }}
                      >
                        Equip here
                      </button>
                    )}
                  {canPickAttack && (
                    <button
                      type="button"
                      className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200"
                      onClick={() => setAttackPick(u.instanceId)}
                    >
                      Select attacker
                    </button>
                  )}
                  {isAttackTarget && attackPick && (
                    <button
                      type="button"
                      className="rounded bg-rose-900/50 px-2 py-0.5 text-[10px] text-rose-100"
                      onClick={() => {
                        actions.attack(attackPick, u.instanceId);
                        setAttackPick(null);
                      }}
                    >
                      Block / target
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const artifactZone = (playerId: PlayerId, label: string) => {
    const p = match.players[playerId] as any;
    const arts = p.artifacts ?? [];
    return (
      <div className={panelClass()}>
        <div className="mb-2 text-xs font-medium text-zinc-500">{label} — artifacts</div>
        <div className="flex flex-wrap gap-2">
          {arts.length === 0 && <span className="text-sm text-zinc-600">None</span>}
          {arts.map((a: any, i: number) => (
            <div key={`${a.cardId}-${i}`} className="w-32">
              <CardFrame entry={entryById.get(a.cardId)} compact className="!w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hand = (match.players[active] as any)?.hand ?? [];

  const equipCard =
    equipHandIndex !== null
      ? getPlayableCardById((match.players[active] as any)?.hand?.[equipHandIndex])
      : null;

  const enemyId: PlayerId = active === "P1" ? "P2" : "P1";
  const enemyFrontEmpty = ((match.players[enemyId] as any)?.board?.front ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Match</h1>
          <p className="text-sm text-zinc-500">
            Turn {match.turn ?? "—"} · Phase {phase} · Active {active}
            {winner && (
              <span className="ml-2 text-[color:var(--color-crypt-accent)]">
                · Winner: {winner}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
            onClick={() => actions.reset()}
          >
            New match
          </button>
          <button
            type="button"
            disabled={!!winner}
            className="rounded-lg border border-[color:var(--color-crypt-accent)]/40 bg-amber-950/30 px-3 py-2 text-sm text-[color:var(--color-crypt-accent)] disabled:opacity-40"
            onClick={() => actions.endTurn()}
          >
            End turn
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={panelClass()}>
          <div className="text-xs font-medium text-zinc-500">P2</div>
          <div className="mt-1 text-2xl font-semibold">{p2.health ?? "—"} HP</div>
          <div className="text-sm text-zinc-400">
            Energy {p2.energy ?? "—"} / {p2.maxEnergy ?? "—"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Deck {deckCount(p2)} · Discard {p2.discard?.length ?? 0}
          </div>
        </div>
        <div className={panelClass()}>
          <div className="text-xs font-medium text-zinc-500">P1</div>
          <div className="mt-1 text-2xl font-semibold">{p1.health ?? "—"} HP</div>
          <div className="text-sm text-zinc-400">
            Energy {p1.energy ?? "—"} / {p1.maxEnergy ?? "—"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Deck {deckCount(p1)} · Discard {p1.discard?.length ?? 0}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={panelClass()}>
          <div className="mb-2 text-xs font-medium text-zinc-500">P2 commander</div>
          <div className="max-w-xs">
            <CardFrame
              entry={commanderEntry(p2.commanderZone?.cardId ?? p2.commander?.id ?? p2.commanderId)}
            />
          </div>
        </div>
        <div className={panelClass()}>
          <div className="mb-2 text-xs font-medium text-zinc-500">P1 commander</div>
          <div className="max-w-xs">
            <CardFrame
              entry={commanderEntry(p1.commanderZone?.cardId ?? p1.commander?.id ?? p1.commanderId)}
            />
          </div>
        </div>
      </div>

      {attackPick && !winner && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-100">
          Attacking with {attackPick}.{" "}
          {enemyFrontEmpty ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                actions.attack(attackPick);
                setAttackPick(null);
              }}
            >
              Strike opponent
            </button>
          ) : (
            <span className="text-amber-200/80">Choose an enemy unit.</span>
          )}{" "}
          <button type="button" className="ml-2 text-zinc-400 underline" onClick={() => setAttackPick(null)}>
            Cancel
          </button>
        </div>
      )}

      {boardRow("P2", "P2")}
      {boardRow("P1", "P1")}

      <div className="grid gap-4 md:grid-cols-2">
        {artifactZone("P2", "P2")}
        {artifactZone("P1", "P1")}
      </div>

      <div className={panelClass()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {active} hand (actions use active player)
          </span>
          {equipHandIndex !== null && (
            <button
              type="button"
              className="text-xs text-zinc-400 underline"
              onClick={() => setEquipHandIndex(null)}
            >
              Cancel equip mode
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {hand.map((cardId: string, index: number) => {
            const def = getPlayableCardById(cardId);
            const entry = entryById.get(cardId);
            return (
              <div key={`${cardId}-${index}`} className="w-36 space-y-1">
                <CardFrame entry={entry} compact className="!w-36" />
                <div className="flex flex-wrap gap-1">
                  {def?.type === "unit" && !winner && (
                    <button
                      type="button"
                      className="rounded bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-100"
                      onClick={() => actions.playUnit(active, index, "front")}
                    >
                      Play unit
                    </button>
                  )}
                  {def?.type === "equipment" && !winner && (
                    <button
                      type="button"
                      className="rounded bg-indigo-900/50 px-2 py-0.5 text-[10px] text-indigo-100"
                      onClick={() => setEquipHandIndex(index)}
                    >
                      Target equip
                    </button>
                  )}
                  {def?.type === "artifact" && !winner && (
                    <button
                      type="button"
                      className="rounded bg-cyan-900/50 px-2 py-0.5 text-[10px] text-cyan-100"
                      onClick={() => actions.playArtifact(active, index)}
                    >
                      Play
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {equipHandIndex !== null && (
          <p className="mt-2 text-xs text-zinc-500">
            Select a friendly unit below with &quot;Equip here&quot; (instance must be on {active}&apos;s board).
          </p>
        )}
      </div>

      <div className={panelClass()}>
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Combat log</div>
        <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm text-zinc-400">
          {combatLog.length === 0 && <li className="list-none text-zinc-600">No actions yet.</li>}
          {combatLog.slice().reverse().map((line, i) => (
            <li key={`${combatLog.length - i}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
