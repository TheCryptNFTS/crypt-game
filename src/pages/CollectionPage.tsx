import { useMemo, useState } from "react";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { useRenderManifest } from "../hooks/useRenderManifest";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import CardDetailModal from "../components/cards/CardDetailModal";
import type { RenderManifestEntry } from "../types/renderManifest";

type Filter = "all" | string;

export default function CollectionPage() {
  const { commanders, playable, loading, error, ready } = useRenderManifest();
  const [selected, setSelected] = useState<RenderManifestEntry | null>(null);
  const [faction, setFaction] = useState<Filter>("all");

  const factions = useMemo(() => {
    const s = new Set<string>();
    for (const e of [...commanders, ...playable]) {
      if (e.faction) s.add(e.faction);
    }
    return Array.from(s).sort();
  }, [commanders, playable]);

  const playableFiltered = useMemo(() => {
    if (faction === "all") return playable;
    return playable.filter((e) => e.faction === faction);
  }, [playable, faction]);

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow="Vault · codex"
        title="Command the archive"
        lead="The archive holds every commander and Crypt Digital Trading Card. Personal vault records come later."
      >
        <div className="crypt-collection-lore">
          <p className="crypt-lore-whisper">Tap a legend to open its archive record.</p>
          <p className="crypt-lore-whisper crypt-lore-whisper--secondary">
            From Mid World to Aqualon, every relic leaves a trace.
          </p>
        </div>
        <div className="crypt-collection-toolbar mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFaction("all")}
              className={[
                "rounded-sm border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em]",
                faction === "all"
                  ? "border-[color:var(--color-crypt-border-strong)] text-[color:var(--color-crypt-accent)]"
                  : "border-white/[0.08] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]",
              ].join(" ")}
            >
              All factions
            </button>
            {factions.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFaction(f)}
                className={[
                  "rounded-sm border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em]",
                  faction === f
                    ? "border-[color:var(--color-crypt-ice-dim)] text-[color:var(--color-crypt-ice)]"
                    : "border-white/[0.08] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <section className="crypt-collection-commanders mb-16">
          <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[0.35em] text-[color:var(--color-crypt-accent)]">
            Commanders · legends
          </h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {commanders
              .filter((e) => faction === "all" || e.faction === faction)
              .map((entry) => (
                <div key={entry.id} className="flex justify-center">
                  <CommanderCard
                    entry={entry}
                    scale="dominant"
                    onClick={() => setSelected(entry)}
                    className="!max-w-none w-full max-w-[180px]"
                  />
                </div>
              ))}
          </div>
        </section>

        <section>
          <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[0.35em] text-[color:var(--color-crypt-ice)]">
            Crypt Digital Trading Cards
          </h2>
          <div className="columns-2 gap-4 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
            {playableFiltered.map((entry) => (
              <div key={entry.id} className="mb-4 flex justify-center break-inside-avoid">
                <PlayableCard entry={entry} mode="collection" onClick={() => setSelected(entry)} />
              </div>
            ))}
          </div>
        </section>

        <CardDetailModal entry={selected} onClose={() => setSelected(null)} />
      </CryptPageFrame>
    </CatalogLoader>
  );
}
