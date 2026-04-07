import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import { validateDeck } from "../engine/deckRules";
import { getCommanderById } from "../engine/commanders";
import {
  loadStoredCommanderId,
  loadStoredMainDeckCardIds,
} from "../lib/deckBuilderStorage";
import { useRenderManifest } from "../hooks/useRenderManifest";

/**
 * Mode launcher — /match stays the table; this is the product surface for picking how to play.
 * TODO: server queues, events, ranked, AI tuning; deck preview reads local deck-builder storage only.
 */
export default function PlayHubPage() {
  const location = useLocation();
  const { entryById, loading, error, ready } = useRenderManifest();
  const [soonKind, setSoonKind] = useState<"faction" | "ranked" | null>(null);

  const { mainDeck, commander, commanderEntry, validation } = useMemo(() => {
    const cid = loadStoredCommanderId();
    const deck = loadStoredMainDeckCardIds();
    let cmd: ReturnType<typeof getCommanderById> = null;
    try {
      cmd = getCommanderById(cid);
    } catch {
      cmd = null;
    }
    const val = cmd
      ? validateDeck(deck, cid, {
          deckSize: cmd.deckRules.deckSize,
          maxCopies: 2,
          allowGodCards: cmd.deckRules.maxGodCards > 0,
        })
      : undefined;
    return {
      mainDeck: deck,
      commander: cmd,
      commanderEntry: entryById.get(cid),
      validation: val,
    };
  }, [location.pathname, entryById]);

  const previewSample = useMemo(() => mainDeck.slice(0, 6), [mainDeck]);

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow="Play · Crypt Legends"
        title="The field awaits"
        lead={
          <>
            <strong className="text-[color:var(--color-crypt-ice)]">Live:</strong> Crypt Digital Trading Cards on the
            table—tactical duels on device.{" "}
            <strong className="text-[color:var(--color-crypt-muted)]">Sealed:</strong> ranked ladders, faction seasons,
            cross-server queues.
          </>
        }
      >
        <div className="crypt-play-sections">
          <p className="crypt-lore-whisper">
            Vault identity and season truth follow the live archive—for now, tactics alone settle the Crypt.
          </p>
          <section className="crypt-play-loadout" aria-label="Active deck and commander">
            <div className="crypt-play-loadout-header">
              <h2 className="crypt-play-section-label">Field loadout</h2>
              <Link to="/deck" className="crypt-play-edit-deck">
                Forge loadout →
              </Link>
            </div>
            <div className="crypt-play-loadout-grid">
              <div className="crypt-play-commander-panel">
                {commanderEntry ? (
                  <div className="crypt-play-commander-stage">
                    <CommanderCard entry={commanderEntry} scale="dominant" variant="catalog" />
                  </div>
                ) : (
                  <div className="crypt-play-commander-fallback" aria-hidden>
                    Commander
                  </div>
                )}
                {commander && (
                  <p className="crypt-play-commander-meta">
                    {commander.name}
                    <span className="crypt-play-commander-meta-sub">
                      {" "}
                      · {commander.deckRules.deckSize}-card main deck
                    </span>
                  </p>
                )}
              </div>
              <div className="crypt-play-deck-panel">
                <div className="crypt-play-deck-strip">
                  {previewSample.length === 0 ? (
                    <p className="crypt-play-deck-empty">Main deck empty—forge loadout under Deck first.</p>
                  ) : (
                    previewSample.map((id) => {
                      const entry = entryById.get(id);
                      return entry ? (
                        <div key={id} className="crypt-play-deck-thumb">
                          <PlayableCard entry={entry} mode="collection" />
                        </div>
                      ) : (
                        <div key={id} className="crypt-play-deck-thumb-fallback" title={id}>
                          ···
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="crypt-play-deck-count">
                  Main deck: {mainDeck.length}
                  {commander ? ` / ${commander.deckRules.deckSize}` : ""} cards
                </p>
                {validation && !validation.valid && (
                  <p className="crypt-play-deck-warning">
                    Blocking errors in this loadout—fix them in Loadout forge before ranked matters.
                  </p>
                )}
                {validation?.valid && <p className="crypt-play-deck-ok">Passes deck law (local check).</p>}
              </div>
            </div>
          </section>

          <section className="crypt-play-modes" aria-label="Game modes">
            <h2 className="crypt-play-section-label crypt-play-section-label--spaced">Modes</h2>

            <Link to="/match" className="crypt-play-mode-quick">
              <span className="crypt-play-mode-quick-kicker">Live · primary</span>
              <span className="crypt-play-mode-quick-title">Quick duel</span>
              <span className="crypt-play-mode-quick-meta">Table → verdict → device ledger (closed alpha)</span>
            </Link>

            <div className="crypt-play-mode-featured crypt-play-mode-featured--labs">
              <div className="crypt-play-mode-featured-inner">
                <span className="crypt-play-featured-kicker">Sealed · coming soon</span>
                <h3 className="crypt-play-featured-title">Faction seasons</h3>
                <p className="crypt-play-featured-copy">
                  Five factions will contest live territory—this is a sealed banner until events are real, not a hidden
                  queue.
                </p>
                <button type="button" className="crypt-play-featured-cta" onClick={() => setSoonKind("faction")}>
                  Read the seal
                </button>
              </div>
            </div>

            <div className="crypt-play-mode-row">
              <Link to="/match" className="crypt-play-mode-tile crypt-play-mode-tile--wide">
                <span className="crypt-play-tile-kicker">Same table</span>
                <span className="crypt-play-tile-title">Practice the duel</span>
                <span className="crypt-play-tile-meta">
                  Runs a local Crypt Legends duel until tutorials and AI arrive
                </span>
              </Link>
              <button
                type="button"
                className="crypt-play-mode-tile crypt-play-mode-tile--locked"
                onClick={() => setSoonKind("ranked")}
              >
                <span className="crypt-play-tile-kicker">Sealed · coming soon</span>
                <span className="crypt-play-tile-title">Ranked ladder</span>
                <span className="crypt-play-tile-meta">No MMR or seasons yet—do not read this as live ladder</span>
              </button>
            </div>

            {soonKind === "faction" && (
              <p className="crypt-play-soon">
                Faction scheduling, intel, and payouts are not wired—this banner only reserves the real war table.
              </p>
            )}
            {soonKind === "ranked" && (
              <p className="crypt-play-soon">
                Ranked needs MMR, seasons, and server truth—placeholder until matchmaking exists.
              </p>
            )}
          </section>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
