import type { RenderManifestEntry } from "../../types/renderManifest";
import { lorePresenceForManifestEntry } from "../../content/cryptMediumCodex";
import { toUICardDisplay } from "../../presentation/uiCardModel";
import { getKeywordDescription } from "../../engine/keywordDescriptions";
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
        {/* Faction accent rule — a thin gold seam at the crown of the record. */}
        <div
          aria-hidden
          className="h-[2px] w-full bg-gradient-to-r from-transparent via-[color:var(--color-crypt-accent)] to-transparent opacity-70"
        />

        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-6 py-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--color-crypt-accent)]/80">
              Archive record
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[color:var(--color-crypt-text)]">
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
            className="-mr-1 -mt-1 shrink-0 font-mono text-[9px] uppercase tracking-widest text-[color:var(--color-crypt-muted)] transition-colors hover:text-[color:var(--color-crypt-text)]"
          >
            Close
          </button>
        </div>

        {/* Square art region — the artifact, given room to dominate. */}
        <div className="flex justify-center border-b border-white/[0.04] bg-gradient-to-b from-black/55 via-black/35 to-black/55 px-6 py-7">
          {isCommander ? (
            <CommanderCard entry={entry} scale="dominant" className="!max-w-[248px]" />
          ) : (
            <PlayableCard entry={entry} mode="modal" />
          )}
        </div>

        <div className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-crypt-muted)]">
          {ui.role}
          {ui.faction !== "—" ? ` · ${ui.faction}` : ""}
          {ui.rarityLabel ? ` · ${ui.rarityLabel}` : ""}
          {ui.cost != null ? ` · cost ${ui.cost}` : ""}
        </div>

        {ui.ability && (
          <div className="border-t border-white/[0.04] px-6 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-muted)]">
              Ability
            </div>
            <p className="mt-2 border-l-2 border-[color:var(--color-crypt-accent)]/50 pl-3 text-[13px] leading-relaxed text-[color:var(--color-crypt-text)]/90">
              <span aria-hidden className="mr-1.5 text-[color:var(--color-crypt-accent)]">
                &#x2B22;
              </span>
              {ui.ability}
            </p>
          </div>
        )}

        {ui.flavor && (
          <div className="border-t border-white/[0.04] px-6 py-5">
            {/* Diamond-flanked divider sets the lore apart from the mechanical text. */}
            <div aria-hidden className="mb-3 flex items-center gap-2 text-[color:var(--color-crypt-accent)]/45">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[color:var(--color-crypt-accent)]/40" />
              <span className="text-[8px]">&#x2B22;</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[color:var(--color-crypt-accent)]/40" />
            </div>
            <blockquote className="relative px-2 text-center">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-2 left-0 select-none font-[family-name:var(--font-label)] text-3xl leading-none text-[color:var(--color-crypt-accent)]/25"
              >
                &ldquo;
              </span>
              <p className="font-[family-name:var(--font-label)] text-[13px] italic leading-relaxed text-[color:var(--color-crypt-muted)]">
                &ldquo;{ui.flavor}&rdquo;
              </p>
            </blockquote>
          </div>
        )}

        {ui.keywords.length > 0 && (
          <div className="border-t border-white/[0.04] px-6 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-muted)]">
              Keywords
            </div>
            <dl className="mt-2 space-y-2">
              {ui.keywords.map((k) => {
                const def = getKeywordDescription(k);
                return (
                  <div key={k} className="flex flex-col gap-1">
                    <dt>
                      <span className="border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[color:var(--color-crypt-ice)]">
                        {k}
                      </span>
                    </dt>
                    <dd className="text-[12px] leading-snug text-[color:var(--color-crypt-text)]/90">
                      {def.description}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}

        {ui.traitsForDisplay.length > 0 && (
          <div className="border-t border-white/[0.04] px-6 py-4">
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
          <div className="border-t border-white/[0.04] px-6 py-4">
            {/* The chain bridge: every card IS an on-chain NFT — link straight to
                the holder's token so "your cards" is verifiable, not a claim.
                Labeled OpenSea (the contract's marketplace) when that's the host,
                else a neutral "View source". */}
            <a
              href={ui.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-crypt-ice)] underline decoration-[color:var(--color-crypt-ice-dim)] underline-offset-4"
            >
              {/opensea\.io/i.test(ui.externalUrl) ? "View on OpenSea ↗" : "View source ↗"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
