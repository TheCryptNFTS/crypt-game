import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { CatalogLoader } from "../components/CatalogLoader";
import { encodeDeck } from "../share/deckCodec";
import { absoluteUrl, openTweet, shareOrCopy } from "../lib/share";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { t } from "../i18n";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { validateDeck, getCardFaction } from "../engine/deckRules";
import { Format, isCardLegalInFormat } from "../engine/formats";
import { getCommanderById } from "../engine/commanders";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { useOwnedCardIds } from "../nft/useOwnedCardIds";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import { factionTheme } from "../ui/cryptTheme";
import {
  LS_DECK_BUILDER_COMMANDER,
  LS_DECK_BUILDER_MAIN_DECK,
  loadStoredCommanderId,
  loadStoredMainDeckCardIds,
} from "../lib/deckBuilderStorage";
import "../styles/owned-cards-bar.css";

const OPENSEA_COLLECTION = "https://opensea.io/collection/crypttradingcards";

const commanderIds = Object.keys(COMMANDER_SPECS).sort();

export default function DeckBuilderPage() {
  const { playable, entryById, loading, error, ready } = useRenderManifest();
  const [commanderId, setCommanderId] = useState(loadStoredCommanderId);
  const [mainDeck, setMainDeck] = useState<string[]>(loadStoredMainDeckCardIds);
  // FORMAT. Open is the DEFAULT: this is a holder-first game — the binder must
  // show a holder every card they own, and most owned NFT cards are NOT Core-legal
  // (Core is a curated ~200-card subset). Defaulting to Core would hide cards a
  // holder paid for behind a toggle. Core stays one tap away for anyone who wants
  // the curated competitive pool. Local-only UI state — it drives `validateDeck`'s
  // `format` param and the Core-legal dimming (Core dims illegal cards; it never
  // removes them from view).
  const [format, setFormat] = useState<Format>("Open");
  // WALLET → OWNED filter, so a holder can build from just the cards they hold.
  const { address: walletAddress, ownedIds, state: ownedState, connect: connectWallet } = useOwnedCardIds();
  const [ownedOnly, setOwnedOnly] = useState(false);
  useEffect(() => {
    if (ownedState === "ready" && ownedIds) setOwnedOnly(true);
  }, [ownedState, ownedIds]);

  // UX audit FIX 2 — transient "why your add was blocked" message. A blocked add
  // (deck full / 2 copies / god cap / not Core-legal) was a silent no-op; this
  // surfaces the reason near the Main deck header and self-clears after a few
  // seconds. Small local state, not a notification system.
  const [addBlock, setAddBlock] = useState<string | null>(null);
  useEffect(() => {
    if (!addBlock) return;
    const tid = window.setTimeout(() => setAddBlock(null), 3000);
    return () => window.clearTimeout(tid);
  }, [addBlock]);

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
      // Enforce the cap the UI already advertises (teardown §11 P1): without this
      // a deck of 20 gods validated as legal.
      maxGodCards: commander.deckRules.maxGodCards,
      format,
    });
  }, [commander, commanderId, mainDeck, format]);

  // Artifacts are cut from V1 (teardown §11 P1) — never offered in the builder.
  const playablePool = useMemo(
    () => playable.filter((e) => e.role === "unit" || e.role === "equipment"),
    [playable]
  );

  // BINDER FILTERS (2026-06-10) — the pool was a ~398,000px black-void scroll of
  // all 4,129 cards. Search + faction + cost filters + "show more" paging turn it
  // into a browsable collection. Pure view state; never touches the deck/engine.
  const [search, setSearch] = useState("");
  const [factionSel, setFactionSel] = useState<string | null>(null);
  const [costSel, setCostSel] = useState<number | null>(null);
  const [shown, setShown] = useState(48);

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return playablePool.filter((e) => {
      // OWNED gate: when "Owned only" is on, show only the cards this wallet holds.
      // A null set (not connected, or an indexer outage) leaves the full pool
      // visible — never a false-empty binder that hides a holder's cards.
      if (ownedOnly && ownedIds && !ownedIds.has(e.id)) return false;
      // FORMAT is NOT a hard filter: Core DIMS illegal cards at render (below) so a
      // holder always sees every card they own; it never deletes them from view.
      if (q && !(e.name ?? "").toLowerCase().includes(q)) return false;
      if (factionSel && !(e.faction ?? "").toUpperCase().includes(factionSel)) return false;
      if (costSel != null) {
        const c = e.cost ?? 0;
        if (costSel === 6 ? c < 6 : c !== costSel) return false;
      }
      return true;
    });
  }, [playablePool, search, factionSel, costSel, ownedOnly, ownedIds]);

  // Reset the page window whenever the filter narrows/changes.
  useEffect(() => {
    setShown(48);
  }, [search, factionSel, costSel, ownedOnly]);

  const FACTION_CHIPS: ReadonlyArray<[string, string]> = [
    ["STONE", "Stone"],
    ["IRON", "Iron"],
    ["BRONZE", "Bronze"],
    ["SILVER", "Silver"],
    ["GOLD", "Gold"],
    ["GOD", "Gods"],
  ];

  // DECK SHAPE (render-derived, no engine change): the mana curve (cards bucketed
  // 0..6+) and the faction mix — so a builder can read "is my deck top-heavy /
  // mono-faction?" at a glance, matching the mulligan/puzzle stat treatment.
  const deckShape = useMemo(() => {
    const COLS = 7; // 0,1,2,3,4,5,6+
    const curve = Array.from({ length: COLS }, () => 0);
    for (const id of mainDeck) {
      const cost = entryById.get(id)?.cost;
      const bucket = typeof cost === "number" ? Math.max(0, Math.min(COLS - 1, cost)) : 0;
      curve[bucket] += 1;
    }
    const peak = Math.max(1, ...curve);
    const byFaction = (validation.stats?.byFaction ?? {}) as Record<string, number>;
    const factions = Object.entries(byFaction)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    return { curve, peak, factions };
  }, [mainDeck, entryById, validation.stats]);

  const addCard = useCallback(
    (id: string) => {
      if (!commander) return;
      const { deckSize, maxGodCards } = commander.deckRules;
      // FORMAT gate: in Core, only Core-legal cards can be enlisted (the archive
      // also dims+disables them below, so this is belt-and-suspenders).
      if (!isCardLegalInFormat(id, format)) {
        setAddBlock("That card isn't legal in the Core format");
        return;
      }
      // ENFORCE deck rules AT ADD TIME so the add buttons can never assemble a
      // deck that validateDeck would reject. Mirrors exactly the limits the
      // validation memo passes: deckSize, maxCopies (2, same literal as line ~82),
      // and the numeric GOD cap (commander.deckRules.maxGodCards). The functional
      // setState reads the CURRENT deck (not a stale closure), so rapid clicks
      // can't overshoot any cap.
      //
      // UX audit FIX 2: a blocked add used to return the deck UNCHANGED with NO
      // feedback, so a capped card read as a silent no-op. We now surface WHY via
      // setAddBlock. The reason is computed from the SAME current-deck snapshot the
      // setState uses (no stale closure), and the state write still independently
      // enforces the caps (the message is purely informative).
      setMainDeck((d) => {
        // deckSize cap
        if (d.length >= deckSize) {
          setAddBlock("Deck full — remove a card first");
          return d;
        }
        // maxCopies cap (must match validateDeck's maxCopies: 2)
        const copies = d.reduce((n, c) => (c === id ? n + 1 : n), 0);
        if (copies >= 2) {
          setAddBlock("Max 2 copies");
          return d;
        }
        // GOD-card cap: block when this add would push GODS over maxGodCards.
        let faction: string | null = null;
        try {
          faction = getCardFaction(id);
        } catch {
          faction = null;
        }
        if (faction === "GODS") {
          const gods = d.reduce((n, c) => {
            try {
              return getCardFaction(c) === "GODS" ? n + 1 : n;
            } catch {
              return n;
            }
          }, 0);
          if (gods >= maxGodCards) {
            setAddBlock(maxGodCards === 0 ? "No god cards allowed" : "God-card limit reached");
            return d;
          }
        }
        // Allowed: clear any stale block message on a successful add.
        setAddBlock(null);
        return [...d, id];
      });
    },
    [commander, format]
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

  // UNOWNED-IN-DECK warning (FIX 2). When the holder is filtering to owned-only
  // and the owned set is KNOWN (non-null), count main-deck cards they don't hold
  // so we can warn — without auto-deleting or blocking play. Fail-safe: if the
  // owned set is null/unknown (not connected or an indexer outage) this is 0, so
  // we NEVER imply they own nothing.
  const unownedInDeckCount = useMemo(() => {
    if (!ownedOnly || !ownedIds) return 0;
    return mainDeck.reduce((n, id) => (ownedIds.has(id) ? n : n + 1), 0);
  }, [ownedOnly, ownedIds, mainDeck]);

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
                Target size {commander.deckRules.deckSize}
                {commander.deckRules.maxGodCards === 0
                  ? " · No god cards"
                  : ` · Max god cards ${commander.deckRules.maxGodCards}`}
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

            {addBlock && (
              <div className="ocb ocb--warn" role="status" aria-live="polite" style={{ marginTop: 8 }}>
                <span>{addBlock}</span>
              </div>
            )}

            {unownedInDeckCount > 0 && (
              <div className="ocb ocb--warn" role="status" style={{ marginTop: 8 }}>
                <span>
                  {unownedInDeckCount} {unownedInDeckCount === 1 ? "card" : "cards"} in
                  this deck {unownedInDeckCount === 1 ? "isn't" : "aren't"} in your
                  collection.
                </span>
              </div>
            )}

            {mainDeck.length > 0 && (
              <div className="crypt-deck-shape">
                {/* Mana curve histogram */}
                <div className="crypt-deck-curve" aria-hidden="true">
                  {deckShape.curve.map((n, cost) => (
                    <div className="crypt-deck-curve-col" key={cost} title={`${n} at cost ${cost === 6 ? "6+" : cost}`}>
                      <div className="crypt-deck-curve-bar-wrap">
                        <div
                          className={`crypt-deck-curve-bar${n === 0 ? " crypt-deck-curve-bar--empty" : ""}`}
                          style={{ height: `${(n / deckShape.peak) * 100}%` }}
                        />
                      </div>
                      <span className="crypt-deck-curve-n">{n || ""}</span>
                      <span className="crypt-deck-curve-cost">{cost === 6 ? "6+" : cost}</span>
                    </div>
                  ))}
                </div>
                {/* Faction breakdown segmented bar */}
                {deckShape.factions.length > 0 && (
                  <div className="crypt-deck-factions">
                    <div className="crypt-deck-factions-bar" aria-hidden="true">
                      {deckShape.factions.map(([fac, n]) => (
                        <div
                          key={fac}
                          className="crypt-deck-factions-seg"
                          style={{
                            width: `${(n / mainDeck.length) * 100}%`,
                            background: factionTheme[fac as keyof typeof factionTheme]?.edge ?? "#8e949b",
                          }}
                          title={`${fac.replace(/_/g, " ")}: ${n}`}
                        />
                      ))}
                    </div>
                    <div className="crypt-deck-factions-legend">
                      {deckShape.factions.map(([fac, n]) => (
                        <span className="crypt-deck-factions-chip" key={fac}>
                          <span
                            className="crypt-deck-factions-dot"
                            style={{ background: factionTheme[fac as keyof typeof factionTheme]?.edge ?? "#8e949b" }}
                          />
                          {fac.replace(/_/g, " ").toLowerCase()} {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
            {/* WALLET → build from YOUR cards. Connect to filter the binder down to
                the cards this wallet holds. Reuses the read-only owned-cards chain. */}
            {!walletAddress ? (
              ownedState === "no-wallet" ? (
                <div className="ocb ocb--warn" role="status">
                  <span>No wallet in this browser — open the Crypt in your wallet app to build from your cards.</span>
                </div>
              ) : (
                <div className="ocb ocb--invite" role="status">
                  <span>Own Crypt cards? Build a deck from your collection.</span>
                  <button className="ocb__btn" onClick={connectWallet} disabled={ownedState === "connecting"}>
                    {ownedState === "connecting" ? "Connecting…" : "Use my cards →"}
                  </button>
                </div>
              )
            ) : ownedState === "loading" ? (
              <div className="ocb ocb--load" role="status"><span>Reading your collection…</span></div>
            ) : ownedState === "error" ? (
              <div className="ocb ocb--warn" role="status">
                <span>Couldn&apos;t reach the collection service — showing the full archive.</span>
                <button className="ocb__btn ocb__btn--ghost" onClick={connectWallet}>Retry</button>
              </div>
            ) : (
              <div className="ocb ocb--owned" role="status">
                <span>
                  ✓ Connected — you hold <strong>{ownedIds ? ownedIds.size : 0}</strong>{" "}
                  Crypt {ownedIds && ownedIds.size === 1 ? "card" : "cards"}.
                </span>
                {ownedIds && ownedIds.size > 0 ? (
                  <button
                    className={`ocb__btn${ownedOnly ? "" : " ocb__btn--ghost"}`}
                    aria-pressed={ownedOnly}
                    onClick={() => setOwnedOnly((v) => !v)}
                  >
                    {ownedOnly ? "Building from your cards" : "Use my cards only"}
                  </button>
                ) : (
                  <a className="ocb__btn ocb__btn--ghost" href={OPENSEA_COLLECTION} target="_blank" rel="noreferrer">
                    Get cards →
                  </a>
                )}
              </div>
            )}

            <div className="crypt-binder-head">
              <h2 className="crypt-deck-section-title">{t("deck.archive.title")}</h2>
              <span className="crypt-binder-count">{filteredPool.length.toLocaleString()} cards</span>
            </div>

            {/* BINDER FILTERS — search + faction + cost. */}
            <div className="crypt-binder-filters">
              <input
                type="search"
                className="crypt-binder-search"
                placeholder="Search cards by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search cards by name"
              />
              <div className="crypt-binder-chips" role="group" aria-label="Filter by faction">
                <button
                  type="button"
                  className={`crypt-binder-chip${!factionSel ? " is-on" : ""}`}
                  onClick={() => setFactionSel(null)}
                >
                  All
                </button>
                {FACTION_CHIPS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`crypt-binder-chip${factionSel === key ? " is-on" : ""}`}
                    style={{ "--chip": factionTheme[key as keyof typeof factionTheme].edge } as CSSProperties}
                    onClick={() => setFactionSel(factionSel === key ? null : key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="crypt-binder-chips" role="group" aria-label="Filter by cost">
                <button
                  type="button"
                  className={`crypt-binder-chip crypt-binder-chip--cost${costSel == null ? " is-on" : ""}`}
                  onClick={() => setCostSel(null)}
                >
                  Any
                </button>
                {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`crypt-binder-chip crypt-binder-chip--cost${costSel === c ? " is-on" : ""}`}
                    onClick={() => setCostSel(costSel === c ? null : c)}
                  >
                    {c === 6 ? "6+" : c}
                  </button>
                ))}
              </div>
            </div>

            {filteredPool.length === 0 ? (
              <p className="crypt-binder-empty">No cards match — clear a filter.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPool.slice(0, shown).map((entry) => {
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
                {shown < filteredPool.length ? (
                  <button
                    type="button"
                    className="crypt-binder-more"
                    onClick={() => setShown((s) => s + 48)}
                  >
                    Show more — {(filteredPool.length - shown).toLocaleString()} left
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
