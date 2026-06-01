import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { useWalletConnection } from "../hooks/useWalletConnection";
import PlayableCard from "../components/cards/PlayableCard";
import type { RenderManifestEntry } from "../types/renderManifest";
import {
  borrowToPlay,
  createListing,
  getMockListings,
  getMockOffers,
  getMockRentalOffers,
  makeOffer,
  offerForLoan,
  previewLease,
  type CardLease,
} from "../marketplace/marketplaceApi";

type Filter = "all" | string;
type ActionKind = "list" | "offer" | "rent";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const RARITY_ORDER = ["common", "rare", "epic", "legendary", "mythic"];

/**
 * MARKETPLACE + RENTAL/SCHOLARSHIP browser. Read-only against the real catalog
 * and the viewer's real (connected) wallet; EVERY mutating control routes to a
 * clearly-stubbed `marketplaceApi` seam that throws `owner-decision-required`,
 * so the full design is demonstrable without touching the chain.
 */
export default function MarketplacePage() {
  const { playable, loading, error, ready } = useRenderManifest();
  const wallet = useWalletConnection();
  const viewer = wallet.connection?.address ?? null;

  const [faction, setFaction] = useState<Filter>("all");
  const [rarity, setRarity] = useState<Filter>("all");
  const [active, setActive] = useState<RenderManifestEntry | null>(null);

  const factions = useMemo(() => {
    const s = new Set<string>();
    for (const e of playable) if (e.faction) s.add(e.faction);
    return Array.from(s).sort();
  }, [playable]);

  const rarities = useMemo(() => {
    const s = new Set<string>();
    for (const e of playable) if (e.rarity) s.add(e.rarity);
    return Array.from(s).sort(
      (a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b),
    );
  }, [playable]);

  const filtered = useMemo(() => {
    return playable.filter(
      (e) =>
        (faction === "all" || e.faction === faction) &&
        (rarity === "all" || e.rarity === rarity),
    );
  }, [playable, faction, rarity]);

  // Cap the rendered grid — 4k cards at once is needless. Filters narrow it.
  const shown = filtered.slice(0, 120);

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow="Bazaar · facilitation-only"
        title="Trade & lend the archive"
        lead="Browse listings, post offers, or lend a card as a scholarship. This build facilitates only — nothing settles on-chain; every trade and lease is a stubbed seam awaiting owner sign-off."
      >
        <WalletStrip wallet={wallet} viewer={viewer} />

        <div className="mb-8 flex flex-col gap-4">
          <FilterRow
            label="Faction"
            value={faction}
            options={factions}
            onPick={setFaction}
          />
          <FilterRow
            label="Rarity"
            value={rarity}
            options={rarities}
            onPick={setRarity}
          />
        </div>

        <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--color-crypt-muted)]">
          {filtered.length} cards · showing {shown.length}
        </p>

        <div className="columns-2 gap-4 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
          {shown.map((entry) => {
            const listing = getMockListings(entry.id)[0];
            return (
              <div
                key={entry.id}
                className="mb-4 flex flex-col items-center gap-1 break-inside-avoid"
              >
                <PlayableCard
                  entry={entry}
                  mode="collection"
                  onClick={() => setActive(entry)}
                />
                <span className="font-mono text-[9px] tabular-nums text-[color:var(--color-crypt-muted)]">
                  {listing ? `${listing.priceHex} $CRYPT` : "not listed"}
                </span>
              </div>
            );
          })}
        </div>

        <nav className="crypt-shop-foot mt-12" aria-label="Leave bazaar">
          <Link to="/collection" className="crypt-shop-foot-link">
            Vault
          </Link>
          <Link to="/shop" className="crypt-shop-foot-link crypt-shop-foot-link--muted">
            Reliquary
          </Link>
        </nav>

        <CardActionModal entry={active} viewer={viewer} onClose={() => setActive(null)} />
      </CryptPageFrame>
    </CatalogLoader>
  );
}

function WalletStrip({
  wallet,
  viewer,
}: {
  wallet: ReturnType<typeof useWalletConnection>;
  viewer: string | null;
}) {
  return (
    <div className="crypt-preview-banner mb-8" role="status">
      {viewer ? (
        <span>
          Viewing as <strong>{shortAddr(viewer)}</strong>
          {wallet.connection?.combatArchives != null && (
            <> · holds {wallet.connection.combatArchives} Combat Archives</>
          )}{" "}
          —{" "}
          <button
            type="button"
            className="crypt-shop-foot-link crypt-shop-foot-link--muted underline"
            onClick={wallet.disconnect}
          >
            disconnect
          </button>
        </span>
      ) : wallet.unavailable ? (
        <span>
          <strong>No wallet detected.</strong> You can still browse the book; connect a
          wallet (read-only) to see which cards you could lend vs. borrow.
        </span>
      ) : (
        <span>
          <strong>Read-only.</strong> Browsing the book is open to all.{" "}
          <button
            type="button"
            className="crypt-shop-foot-link underline disabled:opacity-50"
            onClick={wallet.connect}
            disabled={wallet.connecting}
          >
            {wallet.connecting ? "connecting…" : "connect wallet"}
          </button>{" "}
          to see your holdings (no signing).
        </span>
      )}
    </div>
  );
}

function FilterRow({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: Filter;
  options: string[];
  onPick: (v: Filter) => void;
}) {
  const chip = (active: boolean) =>
    [
      "rounded-sm border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em]",
      active
        ? "border-[color:var(--color-crypt-border-strong)] text-[color:var(--color-crypt-accent)]"
        : "border-white/[0.08] text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]",
    ].join(" ");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--color-crypt-muted)]">
        {label}
      </span>
      <button type="button" className={chip(value === "all")} onClick={() => onPick("all")}>
        All
      </button>
      {options.map((o) => (
        <button key={o} type="button" className={chip(value === o)} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/** Per-card action panel: list / make offer / rent — all stub-backed. */
function CardActionModal({
  entry,
  viewer,
  onClose,
}: {
  entry: RenderManifestEntry | null;
  viewer: string | null;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ActionKind>("offer");
  const [result, setResult] = useState<string | null>(null);
  const [lease, setLease] = useState<CardLease | null>(null);

  if (!entry) return null;

  const listings = getMockListings(entry.id);
  const offers = getMockOffers(entry.id);
  const rentals = getMockRentalOffers(entry.id);

  // Run a STUBBED mutation; surface the owner-decision-required signal honestly.
  async function run() {
    if (!entry) return;
    setLease(null);
    setResult(null);
    const who = viewer ?? "0xVIEWER".padEnd(42, "0");
    try {
      if (kind === "list") {
        await createListing({ cardId: entry.id, priceHex: 100, seller: who });
      } else if (kind === "offer") {
        await makeOffer({ cardId: entry.id, offerHex: 80, buyer: who });
      } else {
        const rentalOffer = rentals[0];
        if (!rentalOffer) {
          setResult("No active loan offer on this card to borrow against.");
          return;
        }
        // Show the borrower exactly what a successful lease WOULD grant (pure
        // preview, issues nothing), then call the stub so the seam is exercised.
        setLease(
          previewLease(
            { rentalOfferId: rentalOffer.id, cardId: entry.id, borrower: who },
            rentalOffer,
            Date.now(),
          ),
        );
        await borrowToPlay({ rentalOfferId: rentalOffer.id, cardId: entry.id, borrower: who });
      }
      setResult("Unexpected: stub returned without throwing.");
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
  }

  const tab = (k: ActionKind, label: string) =>
    [
      "flex-1 border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em]",
      kind === k
        ? "border-[color:var(--color-crypt-border-strong)] text-[color:var(--color-crypt-accent)]"
        : "border-white/[0.08] text-[color:var(--color-crypt-muted)]",
    ].join(" ");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Trade ${entry.name}`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-obsidian)] p-5 shadow-[var(--shadow-commander)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--color-crypt-muted)]">
              Bazaar · {entry.faction} · {entry.rarity ?? "—"}
            </p>
            <h2 className="mt-1 font-semibold text-[color:var(--color-crypt-text)]">{entry.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-crypt-muted)] hover:text-[color:var(--color-crypt-text)]"
          >
            close
          </button>
        </div>

        <div className="mb-4 flex justify-center">
          <PlayableCard entry={entry} mode="modal" />
        </div>

        <BookSection title="Listings">
          {listings.length ? (
            listings.map((l) => (
              <li key={l.id}>
                {l.priceHex} $CRYPT · {shortAddr(l.seller)}
              </li>
            ))
          ) : (
            <li className="opacity-60">no active listings</li>
          )}
        </BookSection>
        <BookSection title="Offers">
          {offers.length ? (
            offers.map((o) => (
              <li key={o.id}>
                {o.offerHex} $CRYPT · {shortAddr(o.buyer)}
              </li>
            ))
          ) : (
            <li className="opacity-60">no open offers</li>
          )}
        </BookSection>
        <BookSection title="Loan / scholarship offers">
          {rentals.length ? (
            rentals.map((r) => (
              <li key={r.id}>
                {r.durationDays}d · fee {r.feeHex} $CRYPT · {r.revenueSharePct}% revenue share ·{" "}
                {shortAddr(r.lender)}
              </li>
            ))
          ) : (
            <li className="opacity-60">not offered for loan</li>
          )}
        </BookSection>

        <div className="mt-5 mb-3 flex gap-2">
          <button type="button" className={tab("list", "List")} onClick={() => setKind("list")}>
            List
          </button>
          <button type="button" className={tab("offer", "Make offer")} onClick={() => setKind("offer")}>
            Make offer
          </button>
          <button type="button" className={tab("rent", "Borrow")} onClick={() => setKind("rent")}>
            Borrow
          </button>
        </div>

        <button
          type="button"
          onClick={run}
          className="w-full border border-[color:var(--color-crypt-border-strong)] px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-accent)] hover:bg-white/[0.04]"
        >
          {kind === "list"
            ? "Post listing"
            : kind === "offer"
              ? "Submit offer"
              : "Borrow to play"}
        </button>

        {lease && (
          <div className="mt-4 border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] text-[color:var(--color-crypt-text)]/85">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--color-crypt-ice)]">
              Mock lease preview (issues nothing)
            </p>
            <p>Play-right only · no token transfer · no custody.</p>
            <p>
              {Math.round((lease.expiresAt - lease.startedAt) / 86_400_000)}-day lease ·{" "}
              {lease.revenueSharePct}% revenue share to {shortAddr(lease.lender)}
            </p>
          </div>
        )}

        {result && (
          <p
            className="mt-4 border-l-2 border-amber-300/60 bg-amber-300/[0.06] px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/90"
            role="status"
          >
            {result}
          </p>
        )}
        <p className="mt-3 font-mono text-[9px] leading-relaxed text-[color:var(--color-crypt-muted)]">
          Facilitation only — no on-chain transfer, no wallet write, no value moved. Mutating
          actions are stubbed for owner sign-off.
        </p>
      </div>
    </div>
  );
}

function BookSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[color:var(--color-crypt-ice)]">
        {title}
      </h3>
      <ul className="space-y-0.5 font-mono text-[10px] tabular-nums text-[color:var(--color-crypt-text)]/80">
        {children}
      </ul>
    </section>
  );
}
