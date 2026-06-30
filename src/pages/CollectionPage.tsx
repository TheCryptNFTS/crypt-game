import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { useOwnedCardIds } from "../nft/useOwnedCardIds";
import CommanderCard from "../components/cards/CommanderCard";
import PlayableCard from "../components/cards/PlayableCard";
import CardDetailModal from "../components/cards/CardDetailModal";
import type { RenderManifestEntry } from "../types/renderManifest";
import "../styles/owned-cards-bar.css";

const OPENSEA_COLLECTION = "https://opensea.io/collection/crypttradingcards";

type Filter = "all" | string;
type SortKey = "cost" | "name" | "rarity" | "faction";

const FAVORITES_KEY = "crypt_favorites_v1";
const PAGE_SIZE = 120;

const FACTION_SIGIL: Record<string, string> = {
  STONE_KEEPERS: "stone",
  IRON_DEFENDERS: "iron",
  BRONZE_GUARDIANS: "bronze",
  SILVER_SENTINELS: "silver",
  GOLDEN_SOVEREIGNS: "gold",
  GODS: "gods",
};
function sigilSrc(f: string): string | null {
  const k = FACTION_SIGIL[f.toUpperCase().replace(/\s+/g, "_")];
  return k ? `/crypt-assets/sigil-${k}.png` : null;
}

// Lower index = rarer-last ordering (common first ascending). Unknown sinks to end.
const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
  god: 6,
  one_of_one: 7,
};
function rarityRank(r?: string): number {
  if (!r) return 99;
  const v = RARITY_ORDER[r.trim().toLowerCase()];
  return v == null ? 98 : v;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "cost", label: "Cost" },
  { key: "name", label: "Name" },
  { key: "rarity", label: "Rarity" },
  { key: "faction", label: "Faction" },
];

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export default function CollectionPage() {
  const { commanders, playable, loading, error, ready } = useRenderManifest();
  // WALLET → OWNED CARDS. The archive shows the whole 4,129-card catalogue to
  // everyone; a holder connecting their wallet should be able to collapse it to
  // "the cards I actually own." `ownedIds` is the set of `tcg_<tokenId>` keys the
  // wallet holds (null until connected/resolved, or on an indexer outage —
  // treated as unknown, never a confirmed-empty collection).
  const { address, ownedIds, state: ownedState, connect } = useOwnedCardIds();
  const [ownedOnly, setOwnedOnly] = useState(false);
  // When a holder's collection resolves, default the view to THEIR cards — that's
  // the whole point of connecting. They can switch back to "All cards" anytime.
  useEffect(() => {
    if (ownedState === "ready" && ownedIds) setOwnedOnly(true);
  }, [ownedState, ownedIds]);
  const ownedCount = ownedIds ? ownedIds.size : 0;
  const [selected, setSelected] = useState<RenderManifestEntry | null>(null);
  const [faction, setFaction] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [favOnly, setFavOnly] = useState(false);

  // Debounced search.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Persist favorites.
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [favorites]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const factions = useMemo(() => {
    const s = new Set<string>();
    for (const e of [...commanders, ...playable]) {
      if (e.faction) s.add(e.faction);
    }
    return Array.from(s).sort();
  }, [commanders, playable]);

  const playableFiltered = useMemo(() => {
    let rows = playable;
    // OWNED gate: when "Owned only" is on (and we have a resolved owned set),
    // show only the cards this wallet holds. `ownedIds == null` (not connected /
    // outage) leaves the full catalogue visible — never a false-empty vault.
    if (ownedOnly && ownedIds) rows = rows.filter((e) => ownedIds.has(e.id));
    if (faction !== "all") rows = rows.filter((e) => e.faction === faction);
    if (favOnly) rows = rows.filter((e) => favorites.has(e.id));
    if (search) rows = rows.filter((e) => e.name.toLowerCase().includes(search));

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "rarity": {
          const d = rarityRank(a.rarity) - rarityRank(b.rarity);
          return d !== 0 ? d : a.name.localeCompare(b.name);
        }
        case "faction": {
          const d = (a.faction || "").localeCompare(b.faction || "");
          return d !== 0 ? d : a.name.localeCompare(b.name);
        }
        case "cost":
        default: {
          const d = (a.cost ?? 999) - (b.cost ?? 999);
          return d !== 0 ? d : a.name.localeCompare(b.name);
        }
      }
    });
    return sorted;
  }, [playable, ownedOnly, ownedIds, faction, favOnly, favorites, search, sortKey]);

  // Cap-and-load-more windowing: only mount `visible` cards, grow on scroll/click.
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [faction, favOnly, search, sortKey, ownedOnly]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          setVisible((v) => Math.min(v + PAGE_SIZE, playableFiltered.length));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [playableFiltered.length]);

  const windowed = playableFiltered.slice(0, visible);
  const remaining = playableFiltered.length - windowed.length;

  const commandersFiltered = useMemo(() => {
    // Commanders are game legends (cmd_*), not part of the owned NFT token set,
    // so "Owned only" hides the commander section entirely — the view is strictly
    // "the cards you hold."
    if (ownedOnly && ownedIds) return [];
    let rows = commanders.filter((e) => faction === "all" || e.faction === faction);
    if (favOnly) rows = rows.filter((e) => favorites.has(e.id));
    if (search) rows = rows.filter((e) => e.name.toLowerCase().includes(search));
    return rows;
  }, [commanders, ownedOnly, ownedIds, faction, favOnly, favorites, search]);

  const chipBase =
    "rounded-sm border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em]";

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

        {/* WALLET → YOUR CARDS. Connect to collapse the full archive down to the
            cards you actually hold. Reuses the audited read-only owned-cards
            chain (eth_accounts adopt + city /api/owned-cards lookup). */}
        <OwnedVaultBar
          address={address}
          state={ownedState}
          ownedOnly={ownedOnly}
          ownedCount={ownedCount}
          onConnect={connect}
          onToggleOwned={setOwnedOnly}
        />

        {/* Search + sort + favorites controls */}
        <div className="crypt-collection-controls mb-6 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search cards by name"
            className="w-full max-w-[260px] rounded-sm border border-white/[0.1] bg-black/40 px-3 py-1.5 font-mono text-[11px] text-[color:var(--color-crypt-text)] placeholder:text-[color:var(--color-crypt-muted)] focus:border-[color:var(--color-crypt-ice-dim)] focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-crypt-muted)]">
              Sort
            </span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSortKey(s.key)}
                className={[
                  chipBase,
                  sortKey === s.key
                    ? "border-[color:var(--color-crypt-ice-dim)] text-[color:var(--color-crypt-ice)]"
                    : "border-white/[0.08] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            aria-pressed={favOnly}
            className={[
              chipBase,
              "inline-flex items-center gap-1.5",
              favOnly
                ? "border-[color:var(--color-crypt-accent)] text-[color:var(--color-crypt-accent)]"
                : "border-white/[0.08] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]",
            ].join(" ")}
          >
            <span aria-hidden>{favOnly ? "★" : "☆"}</span>
            Favorites
            {favorites.size > 0 && (
              <span className="tabular-nums opacity-70">{favorites.size}</span>
            )}
          </button>
        </div>

        <div className="crypt-collection-toolbar mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFaction("all")}
              className={[
                chipBase,
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
                  "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em]",
                  faction === f
                    ? "border-[color:var(--color-crypt-ice-dim)] text-[color:var(--color-crypt-ice)]"
                    : "border-white/[0.08] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]",
                ].join(" ")}
              >
                {sigilSrc(f) && (
                  <img
                    src={sigilSrc(f)!}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-4 w-4 object-contain"
                  />
                )}
                {f.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {commandersFiltered.length > 0 && (
          <section className="crypt-collection-commanders mb-16">
            <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[0.35em] text-[color:var(--color-crypt-accent)]">
              Commanders · legends
            </h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {commandersFiltered.map((entry) => (
                <div key={entry.id} className="relative flex justify-center">
                  <FavButton
                    active={favorites.has(entry.id)}
                    onToggle={() => toggleFavorite(entry.id)}
                  />
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
        )}

        <section>
          <h2 className="mb-6 flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.35em] text-[color:var(--color-crypt-ice)]">
            Crypt Digital Trading Cards
            <span className="text-[color:var(--color-crypt-muted)] tracking-[0.18em] normal-case">
              {playableFiltered.length} shown
            </span>
          </h2>

          {playableFiltered.length === 0 ? (
            ownedOnly && ownedIds && ownedCount === 0 ? (
              <p className="font-mono text-[11px] text-[color:var(--color-crypt-muted)]">
                You don&apos;t hold any Crypt cards yet —{" "}
                <a
                  href={OPENSEA_COLLECTION}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-crypt-accent)] underline"
                >
                  get cards →
                </a>{" "}
                or switch to All cards above.
              </p>
            ) : (
              <p className="font-mono text-[11px] text-[color:var(--color-crypt-muted)]">
                No cards match the current filters.
              </p>
            )
          ) : (
            <>
              <div className="columns-2 gap-4 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
                {windowed.map((entry) => (
                  <div
                    key={entry.id}
                    className="relative mb-4 flex justify-center break-inside-avoid"
                  >
                    <FavButton
                      active={favorites.has(entry.id)}
                      onToggle={() => toggleFavorite(entry.id)}
                    />
                    <PlayableCard
                      entry={entry}
                      mode="collection"
                      onClick={() => setSelected(entry)}
                    />
                  </div>
                ))}
              </div>

              {remaining > 0 && (
                <div
                  ref={sentinelRef}
                  className="mt-6 flex justify-center"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setVisible((v) => Math.min(v + PAGE_SIZE, playableFiltered.length))
                    }
                    className="rounded-sm border border-white/[0.12] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]"
                  >
                    Load {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <CardDetailModal entry={selected} onClose={() => setSelected(null)} />
      </CryptPageFrame>
    </CatalogLoader>
  );
}

function OwnedVaultBar({
  address,
  state,
  ownedOnly,
  ownedCount,
  onConnect,
  onToggleOwned,
}: {
  address: string | null;
  state: import("../nft/useOwnedCardIds").OwnedState;
  ownedOnly: boolean;
  ownedCount: number;
  onConnect: () => void;
  onToggleOwned: (next: boolean) => void;
}) {
  // Not connected → the invitation to see your own cards.
  if (!address) {
    if (state === "no-wallet") {
      return (
        <div className="ocb ocb--warn" role="status">
          <span>No wallet in this browser — open the Crypt in your wallet app to see your cards.</span>
        </div>
      );
    }
    return (
      <div className="ocb ocb--invite" role="status">
        <span>Own Crypt cards? See your collection.</span>
        <button className="ocb__btn" onClick={onConnect} disabled={state === "connecting"}>
          {state === "connecting" ? "Connecting…" : "Show my cards →"}
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="ocb ocb--load" role="status">
        <span>Reading your collection…</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="ocb ocb--warn" role="status">
        <span>Couldn&apos;t reach the collection service — showing the full archive.</span>
        <button className="ocb__btn ocb__btn--ghost" onClick={onConnect}>
          Retry
        </button>
      </div>
    );
  }
  // Connected + resolved → an Owned-only / All-cards toggle.
  return (
    <div className="ocb ocb--owned" role="status">
      <span>
        ✓ Connected — you hold <strong>{ownedCount}</strong> Crypt {ownedCount === 1 ? "card" : "cards"}.
      </span>
      <button
        className={`ocb__btn${ownedOnly ? "" : " ocb__btn--ghost"}`}
        aria-pressed={ownedOnly}
        onClick={() => onToggleOwned(!ownedOnly)}
      >
        {ownedOnly ? "Showing your cards" : "Show my cards only"}
      </button>
    </div>
  );
}

function FavButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      className={[
        "absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-sm border text-[12px] leading-none backdrop-blur-sm transition-colors",
        active
          ? "border-[color:var(--color-crypt-accent)] bg-black/60 text-[color:var(--color-crypt-accent)]"
          : "border-white/[0.1] bg-black/40 text-white/40 hover:text-[color:var(--color-crypt-accent)]",
      ].join(" ")}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
