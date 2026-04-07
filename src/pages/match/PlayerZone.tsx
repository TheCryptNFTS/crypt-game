import CommanderCard from "../../components/cards/CommanderCard";
import PlayableCard from "../../components/cards/PlayableCard";
import type { RenderManifestEntry } from "../../types/renderManifest";

type PlayerZoneProps = {
  player: any;
  commanderEntry: RenderManifestEntry | undefined;
  entryById: Map<string, RenderManifestEntry>;
  deckCount: number;
};

/** Player: commander altar + counters + relics — anchors hand above; subordinate to battlefield. */
export function PlayerZone({ player, commanderEntry, entryById, deckCount }: PlayerZoneProps) {
  const arts = player?.artifacts ?? [];

  return (
    <section className="crypt-match-player-zone">
      <div className="crypt-match-zone-inner crypt-match-zone-inner--player">
        <div className="crypt-commander-block">
          <div className="crypt-altar crypt-altar--self">
            <div className="crypt-commander-pedestal">
              <div className="crypt-commander-inner">
                <CommanderCard entry={commanderEntry} scale="dominant" variant="match" />
              </div>
            </div>
          </div>
          {commanderEntry && (
            <p className="crypt-commander-name-mono truncate">{commanderEntry.name}</p>
          )}
        </div>

        <div className="crypt-match-counters">
          <span className="tabular-nums">
            <span className="crypt-stat-key">Life</span> {player?.health ?? "—"}
          </span>
          <span className="tabular-nums">
            <span className="crypt-stat-key">Energy</span> {player?.energy ?? "—"}
            <span className="text-white/35">/</span>
            {player?.maxEnergy ?? "—"}
          </span>
          <span className="tabular-nums">
            <span className="crypt-stat-key">Deck</span> {deckCount}
          </span>
        </div>

        <div className="crypt-relic-strip">
          {arts.length === 0 ? (
            <span className="crypt-relic-empty" aria-hidden />
          ) : (
            arts.map((a: any, i: number) => (
              <div key={`${a.cardId}-${i}`} className="crypt-relic-thumb">
                <PlayableCard
                  entry={entryById.get(a.cardId)}
                  mode="board"
                  className="!w-[44px] sm:!w-[48px]"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
