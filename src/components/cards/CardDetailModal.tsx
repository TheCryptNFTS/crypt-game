import type { RenderManifestEntry } from "../../types/renderManifest";
import { lorePresenceForManifestEntry } from "../../content/cryptMediumCodex";
import { toUICardDisplay } from "../../presentation/uiCardModel";
import CommanderCard from "./CommanderCard";
import PlayableCard from "./PlayableCard";

type CardDetailModalProps = {
  entry: RenderManifestEntry | null;
  onClose: () => void;
};

export default function CardDetailModal({ entry, onClose }: CardDetailModalProps) {
  if (!entry) return null;

  const ui = toUICardDisplay(entry);
  const isCommander = ui.role === "commander";
  const loreLine = lorePresenceForManifestEntry(entry);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={ui.name}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-obsidian)] shadow-[var(--shadow-commander)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--color-crypt-muted)]">
              Archive record
            </p>
            <h2 className="mt-1 font-semibold tracking-tight text-[color:var(--color-crypt-text)]">
              {ui.name}
            </h2>
            {loreLine && (
              <p className="crypt-codex-voice mt-2 max-w-[32ch] text-[12px] leading-snug text-[color:var(--color-crypt-muted)]">
                {loreLine}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]"
          >
            Close
          </button>
        </div>

        <div className="flex justify-center border-b border-white/[0.04] bg-black/40 px-5 py-6">
          {isCommander ? (
            <CommanderCard entry={entry} scale="dominant" className="!max-w-[240px]" />
          ) : (
            <PlayableCard entry={entry} mode="modal" />
          )}
        </div>

        <div className="px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-crypt-muted)]">
          {ui.role}
          {ui.faction !== "—" ? ` · ${ui.faction}` : ""}
          {ui.rarityLabel ? ` · ${ui.rarityLabel}` : ""}
          {ui.cost != null ? ` · cost ${ui.cost}` : ""}
        </div>

        {ui.keywords.length > 0 && (
          <div className="border-t border-white/[0.04] px-5 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-muted)]">
              Keywords
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ui.keywords.map((k) => (
                <span
                  key={k}
                  className="border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[color:var(--color-crypt-ice)]"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {ui.traitsForDisplay.length > 0 && (
          <div className="border-t border-white/[0.04] px-5 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-muted)]">
              Relic data
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--color-crypt-text)]/90">
              {ui.traitsForDisplay.map((t, i) => (
                <li key={`${t.label}-${i}`} className="flex gap-2 text-[12px]">
                  <span className="font-mono text-[10px] text-[color:var(--color-crypt-muted)]">{t.label}</span>
                  <span>{t.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ui.externalUrl && (
          <div className="border-t border-white/[0.04] px-5 py-4">
            <a
              href={ui.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-crypt-ice)] underline decoration-[color:var(--color-crypt-ice-dim)] underline-offset-4"
            >
              Source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
