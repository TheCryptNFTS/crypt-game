/**
 * Marketplace + Rental/Scholarship service seam — DESIGN ONLY.
 *
 * HARD RULE (owner-mandated): this app facilitates, it NEVER custodies or moves
 * real value. There are NO on-chain transfers, NO wallet writes, NO minting or
 * crediting of hex/tokens anywhere in this module. The data model and the read
 * paths are real; every MUTATING path is a clearly-marked STUB that throws
 * `owner-decision-required` so the UI is fully demonstrable without ever
 * touching the chain.
 *
 * When a real backend / settlement layer is chosen, replace ONLY the bodies of
 * the stubbed functions below (search for `TODO(owner)`); the data shapes and
 * the entire UI stay as-is.
 *
 * Browser-safe: no node globals, no top-level chain/network calls at import.
 */

/** A standing sell-listing a holder has posted for one card (token). */
export type MarketListing = {
  id: string;
  /** Playable card id, e.g. `tcg_6658` — joins to the render manifest. */
  cardId: string;
  /** Lowercased on-chain address of the lister (the current holder). */
  seller: string;
  /** Asking price, denominated in $CRYPT. Display-only; never settled here. */
  priceHex: number;
  /** Unix ms when the listing was posted (mock data uses deterministic values). */
  listedAt: number;
  status: "active" | "filled" | "cancelled";
};

/** A buy-side offer a would-be buyer has made against a card. */
export type MarketOffer = {
  id: string;
  cardId: string;
  /** Lowercased address of the offerer. */
  buyer: string;
  /** Offered price in $CRYPT. Display-only; never settled here. */
  offerHex: number;
  createdAt: number;
  status: "open" | "accepted" | "declined" | "withdrawn";
};

/**
 * A rental / scholarship OFFER: a holder lends a card so a non-holder can play
 * it. `feeHex` + `revenueSharePct` are the lend terms; nothing is charged here.
 */
export type RentalOffer = {
  id: string;
  cardId: string;
  /** Lowercased address of the lending holder. */
  lender: string;
  /** Lease length the lender is offering, in days. */
  durationDays: number;
  /** Up-front fee in $CRYPT (display-only). */
  feeHex: number;
  /** Scholarship split: % of in-game earnings returned to the lender (0–100). */
  revenueSharePct: number;
  status: "offered" | "leased" | "withdrawn";
};

/**
 * The mock LEASE returned by the stubbed `borrowToPlay` seam. A lease is a
 * PLAY-RIGHT grant only: it never transfers the token, never custodies it, and
 * confers no ownership. Real issuance is an owner decision (see stub).
 */
export type CardLease = {
  id: string;
  cardId: string;
  lender: string;
  /** The borrower who holds the temporary play-right. */
  borrower: string;
  startedAt: number;
  expiresAt: number;
  revenueSharePct: number;
  /** Always "mock" in this build — proves the design, settles nothing. */
  kind: "mock";
};

/** Raised by every mutating seam so a real transfer can never run by accident. */
export class OwnerDecisionRequiredError extends Error {
  readonly code = "owner-decision-required";
  constructor(action: string) {
    super(
      `owner-decision-required: "${action}" would move real value and is intentionally not implemented. ` +
        `A human owner must wire the settlement layer before this can run.`,
    );
    this.name = "OwnerDecisionRequiredError";
  }
}

// ---------------------------------------------------------------------------
// READ PATHS — safe, deterministic mock data. No network at import.
// (A real indexer/backend would replace these bodies; shapes stay identical.)
// ---------------------------------------------------------------------------

/** Deterministic pseudo-address so the mock book looks plausible, not random. */
function mockAddr(seed: number): string {
  const hex = (seed * 2654435761 >>> 0).toString(16).padStart(8, "0");
  return `0x${hex}${"a3f9c0d2b1e4".repeat(3).slice(0, 32)}`;
}

/** Cheap deterministic hash from a card id, for stable mock pricing. */
function seedFromCardId(cardId: string): number {
  let h = 2166136261;
  for (let i = 0; i < cardId.length; i++) {
    h ^= cardId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mock order book for a card — a believable spread so the UI is demonstrable.
 * Read-only and pure; replace with a real indexer query later.
 */
export function getMockListings(cardId: string): MarketListing[] {
  const s = seedFromCardId(cardId);
  if (s % 5 === 0) return []; // some cards simply aren't listed
  const base = 40 + (s % 260);
  return [
    {
      id: `lst_${cardId}_a`,
      cardId,
      seller: mockAddr(s),
      priceHex: base,
      listedAt: 1_730_000_000_000 + (s % 9_000) * 1000,
      status: "active",
    },
  ];
}

export function getMockOffers(cardId: string): MarketOffer[] {
  const s = seedFromCardId(cardId);
  if (s % 3 !== 0) return [];
  const base = 30 + (s % 180);
  return [
    {
      id: `off_${cardId}_a`,
      cardId,
      buyer: mockAddr(s ^ 0x5151),
      offerHex: base,
      createdAt: 1_730_100_000_000 + (s % 7_000) * 1000,
      status: "open",
    },
  ];
}

export function getMockRentalOffers(cardId: string): RentalOffer[] {
  const s = seedFromCardId(cardId);
  if (s % 4 !== 0) return [];
  return [
    {
      id: `rnt_${cardId}_a`,
      cardId,
      lender: mockAddr(s ^ 0x7777),
      durationDays: 7 + (s % 3) * 7,
      feeHex: 10 + (s % 40),
      revenueSharePct: 10 + (s % 4) * 5,
      status: "offered",
    },
  ];
}

// ---------------------------------------------------------------------------
// MUTATING SEAMS — every one is a STUB. They model the call signature the UI
// needs and THROW so no real value can ever move. Owner must implement.
// ---------------------------------------------------------------------------

export type CreateListingInput = { cardId: string; priceHex: number; seller: string };
export type MakeOfferInput = { cardId: string; offerHex: number; buyer: string };
export type OfferForLoanInput = {
  cardId: string;
  lender: string;
  durationDays: number;
  feeHex: number;
  revenueSharePct: number;
};
export type BorrowToPlayInput = { rentalOfferId: string; cardId: string; borrower: string };

/** STUB — would post a real sell listing. TODO(owner): wire settlement. */
export async function createListing(_input: CreateListingInput): Promise<MarketListing> {
  throw new OwnerDecisionRequiredError("createListing");
}

/** STUB — would post a real buy offer. TODO(owner): wire settlement. */
export async function makeOffer(_input: MakeOfferInput): Promise<MarketOffer> {
  throw new OwnerDecisionRequiredError("makeOffer");
}

/** STUB — would publish a real loan/scholarship offer. TODO(owner). */
export async function offerForLoan(_input: OfferForLoanInput): Promise<RentalOffer> {
  throw new OwnerDecisionRequiredError("offerForLoan");
}

/**
 * STUB — would grant a real play-right lease. Returns a MOCK lease shape only so
 * the borrow flow is demonstrable end-to-end in the UI without issuing anything.
 * TODO(owner): replace with the real (non-custodial) play-right grant.
 */
export async function borrowToPlay(_input: BorrowToPlayInput): Promise<CardLease> {
  throw new OwnerDecisionRequiredError("borrowToPlay");
}

/**
 * Pure preview helper: build the MOCK lease a successful `borrowToPlay` WOULD
 * return, so the UI can show "what you'd get" without calling the throwing
 * stub. This issues nothing and touches no chain — it is display math only.
 */
export function previewLease(input: BorrowToPlayInput, offer: RentalOffer, now: number): CardLease {
  return {
    id: `lease_preview_${input.rentalOfferId}`,
    cardId: input.cardId,
    lender: offer.lender,
    borrower: input.borrower,
    startedAt: now,
    expiresAt: now + offer.durationDays * 24 * 60 * 60 * 1000,
    revenueSharePct: offer.revenueSharePct,
    kind: "mock",
  };
}
