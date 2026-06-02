import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogLoader } from "../components/CatalogLoader";
import { encodeDeck } from "../share/deckCodec";
import { absoluteUrl, openTweet, shareOrCopy } from "../lib/share";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { t } from "../i18n";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { validateDeck } from "../engine/deckRules";
import { Format, isCardLegalInFormat } from "../engine/formats";
import { getCommanderById } from "../engine/commanders";
import { useRenderManifest } from "../hooks/useRenderManifest";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import {
  LS_DECK_BUILDER_COMMANDER,
  LS_DECK_BUILDER_MAIN_DECK,
  loadStoredCommanderId,
  loadStoredMainDeckCardIds,
} from "../lib/deckBuilderStorage";

const commanderIds = Object.keys(COMMANDER_SPECS).sort();

export default function DeckBuilderPage() {
  const { playable, entryById, loading, error, ready } = useRenderManifest();
  const [commanderId, setCommanderId] = useState(loadStoredCommanderId);
  const [mainDeck, setMainDeck] = useState<string[]>(loadStoredMainDeckCardIds);
  // FORMAT (PART 2). Open is the historical DEFAULT (full pool legal); Core
  // restricts legality to the curated Core set. Local-only UI state — it just
  // drives `validateDeck`'s `format` param and the archive's Core-legal dimming.
  const [format, setFormat] = useState<Format>("Open");

  useEffect(() => {
    try {
      localStorage.setItem(LS_DECK_BUILDER_COMMANDER, commanderId);
    } catch {
      /* ignore */
    }
  }, [commanderId]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DECK_BUILDER_MAIN_DECK, JSON.stringify(mainDeck));
    } catch {
      /* ignore */
    }
  }, [mainDeck]);

  const commander = useMemo(() => {
    try {
      return getCommanderById(commanderId);
    } catch {
      return null;
    }
  }, [commanderId]);

  const validation = useMemo(() => {
    if (!commander) {
      return {
        valid: false,
        errors: [t("deck.invalidCommander")],
        warnings: [] as string[],
        stats: null as ReturnType<typeof validateDeck>["stats"] | null,
      };
    }
    return validateDeck(mainDeck, commanderId, {
      deckSize: commander.deckRules.deckSize,
      maxCopies: 2,
      allowGodCards: commander.deckRules.maxGodCards > 0,
      format,
    });
  }, [commander, commanderId, mainDeck, format]);

  const playablePool = useMemo(
    () => playable.filter((e) => e.role === "unit" || e.role === "equipment" || e.role === "artifact"),
    [playable]
  );

  const addCard = useCallback(
    (id: string) => {
      if (!commander) return;
      if (mainDeck.length >= commander.deckRules.deckSize) return;
      // FORMAT gate: in Core, only Core-legal cards can be enlisted (the archive
      // also dims+disables them below, so this is belt-and-suspenders).
      if (!isCardLegalInFormat(id, format)) return;
      setMainDeck((d) => [...d, id]);
    },
    [commander, mainDeck.length, format]
  );

  const removeAt = useCallback((index: number) => {
    setMainDeck((d) => d.filter((_, i) => i !== index));
  }, []);

  const clearDeck = useCallback(() => setMainDeck([]), []);

  // SHARE — encode the live deck (commander + ordered card ids) into a codec
  // string, wrap it in an absolute /d?code= link, and hand off to the native
  // share sheet (clipboard fallback) plus an X intent. Read-only; never mutates
  // the build state above.
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shareDeck = useCallback(async () => {
    try {
      const code = encodeDeck({ commanderId, cards: mainDeck });
      const url = absoluteUrl(`/d?code=${encodeURIComponent(code)}`);
      const text = t("deck.share.text");
      const result = await shareOrCopy({ title: t("deck.share.title"), text, url });
      setShareNote(
        result === "shared"
          ? t("deck.share.shared")
          : result === "copied"
            ? t("deck.share.copied")
            : t("deck.share.failed")
      );
      if (result !== "failed") openTweet(text, url);
    } catch {
      setShareNote(t("deck.share.error"));
    }
  }, [commanderId, mainDeck]);

  const commanderEntry = entryById.get(commanderId);

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow={t("deck.eyebrow")}
        title={t("deck.title")}
        lead={t("deck.lead")}
      >
        <div className="crypt-deck-page space-y-6">
          <p className="crypt-lore-whisper">
            {t("deck.whisper")}
          </p>
          <div className="crypt-deck-panel">
            <label className="crypt-deck-label">{t("deck.format.label")}</label>
            <div className="live-quick-buttons" style={{ marginBottom: 8 }}>
              {(["Open", "Core"] as Format[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`live-btn ${format === f ? "live-btn--primary" : "live-btn--ghost"}`}
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="crypt-deck-hint">
              {format === "Open"
                ? t("deck.format.openHint")
                : t("deck.format.coreHint")}
            </p>
          </div>

          <div className="crypt-deck-panel">
            <label className="crypt-deck-label" htmlFor="crypt-deck-commander-select">
              {t("deck.commander.label")}
            </label>
            <select
              id="crypt-deck-commander-select"
              className="crypt-deck-select"
              value={commanderId}
              onChange={(e) => setCommanderId(e.target.value)}
            >
              {commanderIds.map((id) => (
                <option key={id} value={id}>
                  {COMMANDER_SPECS[id]?.name ?? id}
                </option>
              ))}
            </select>
            {commanderEntry && (
              <div className="mt-5 flex justify-center sm:justify-start">
                <div className="max-w-[168px]">
                  <CommanderCard entry={commanderEntry} scale="table" />
                </div>
              </div>
            )}
            {commander && (
              <p className="crypt-deck-hint">
                Target size {commander.deckRules.deckSize} · Max god cards {commander.deckRules.maxGodCards}
              </p>
            )}
          </div>

          <div className="crypt-deck-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="crypt-deck-h2">
                Main deck ({mainDeck.length}
                {commander ? ` / ${commander.deckRules.deckSize}` : ""})
              </h2>
              <button type="button" className="crypt-deck-clear" onClick={clearDeck}>
                {t("deck.clear")}
              </button>
            </div>

            <div className="crypt-deck-list-scroll">
              {mainDeck.length === 0 && (
                <p className="crypt-deck-muted">{t("deck.empty")}</p>
              )}
              <ul className="list-none space-y-0 p-0">
                {mainDeck.map((id, index) => (
                  <li key={`${id}-${index}`} className="crypt-deck-list-row crypt-deck-muted">
                    <span className="min-w-0 truncate text-[color:var(--color-crypt-text)]">
                      {entryById.get(id)?.name ?? id}
                      {entryById.get(id)?.faction ? (
                        <span className="text-[color:var(--color-crypt-muted)]">
                          {" "}· {entryById.get(id)!.faction.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </span>
                    <button type="button" className="crypt-deck-remove" onClick={() => removeAt(index)}>
                      {t("deck.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 space-y-2">
              <div className={validation.valid ? "crypt-deck-validation-ok" : "crypt-deck-validation-bad"}>
                {validation.valid ? t("deck.validation.ok") : t("deck.validation.bad")}
              </div>
              {validation.errors.length > 0 && (
                <ul className="crypt-deck-errors list-disc">
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <ul className="crypt-deck-warnings list-disc">
                  {validation.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={shareDeck}
                disabled={mainDeck.length === 0}
              >
                {t("deck.share.cta")}
              </button>
              {shareNote && <span className="crypt-deck-hint">{shareNote}</span>}
            </div>
          </div>

          <div>
            <h2 className="crypt-deck-section-title">{t("deck.archive.title")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {playablePool.map((entry) => {
                // FORMAT legality: in Core, cards outside the curated set are
                // dimmed and non-interactive so the legal pool reads at a glance.
                const legal = isCardLegalInFormat(entry.id, format);
                return (
                  <PlayableCard
                    key={entry.id}
                    entry={entry}
                    mode="collection"
                    onClick={legal ? () => addCard(entry.id) : undefined}
                    className={legal ? "" : "pointer-events-none opacity-40"}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
