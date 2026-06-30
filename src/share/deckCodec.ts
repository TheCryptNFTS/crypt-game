/**
 * DECK SHARE CODEC — encode a deck (commander + card-id list) to a short,
 * copy-paste-safe string and decode it back. Pure functions, no engine imports,
 * browser-safe (the only platform surface is the guarded base64url helper).
 *
 * Wire format (versioned): a `v1.` prefix + base64url(JSON). The JSON keeps the
 * deck as an ordered card-id list so encode->decode is an EXACT round-trip
 * (order preserved). A run-length pass collapses repeated ids (decks hold up to
 * 2 copies) to keep the string short without losing order.
 */

import { encodeBase64Url, decodeBase64Url } from "./base64url";

export const DECK_CODEC_VERSION = "v1";

export interface ShareableDeck {
  commanderId: string;
  /** Main-deck card ids, in deck order. */
  cards: string[];
}

/** Wire JSON: `c` = commander, `d` = run-length pairs [cardId, count]. */
interface DeckWire {
  v: 1;
  c: string;
  d: Array<[string, number]>;
}

/** Collapse an ordered id list into run-length [id, count] pairs (order-stable). */
function runLengthEncode(cards: string[]): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const id of cards) {
    const last = out[out.length - 1];
    if (last && last[0] === id) last[1] += 1;
    else out.push([id, 1]);
  }
  return out;
}

/** Hard ceiling on a decoded deck length. A real deck is 30 cards; this small
 *  bound stops a crafted code (e.g. a pair like ["x", 100000000]) from
 *  allocating a huge array and freezing the tab. Anything larger is rejected. */
const MAX_DECODED_CARDS = 100;
/** A single run-length count must be a finite int in this range — a deck holds
 *  up to 2 copies of a card, but allow generous headroom for legacy/wide codes
 *  while still bounding per-pair allocation. */
const MAX_RUN_COUNT = 60;

/**
 * Inverse of runLengthEncode. Defensive against untrusted input (a shared deck
 * link is fully attacker-controlled): every pair must be [string id, finite int
 * in 1..MAX_RUN_COUNT], and the total expanded length is capped at
 * MAX_DECODED_CARDS. A malformed/oversized payload THROWS so decodeDeck's caller
 * routes it to the clean "unreadable deck code" path instead of hanging the tab
 * on a giant allocation (DeckViewPage's try/catch can't rescue a freeze).
 */
function runLengthDecode(pairs: Array<[string, number]>): string[] {
  const out: string[] = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new Error("decodeDeck: malformed run-length pair");
    }
    const [id, count] = pair;
    if (typeof id !== "string") {
      throw new Error("decodeDeck: run-length id must be a string");
    }
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_RUN_COUNT
    ) {
      throw new Error("decodeDeck: run-length count out of range");
    }
    if (out.length + count > MAX_DECODED_CARDS) {
      throw new Error("decodeDeck: decoded deck exceeds maximum size");
    }
    for (let i = 0; i < count; i += 1) out.push(id);
  }
  return out;
}

/** Encode a deck to a shareable string. */
export function encodeDeck(deck: ShareableDeck): string {
  if (!deck || typeof deck.commanderId !== "string" || !Array.isArray(deck.cards)) {
    throw new Error("encodeDeck: invalid deck shape");
  }
  const wire: DeckWire = {
    v: 1,
    c: deck.commanderId,
    d: runLengthEncode(deck.cards),
  };
  return `${DECK_CODEC_VERSION}.${encodeBase64Url(JSON.stringify(wire))}`;
}

/** Decode a shareable string back to a deck. Inverse of `encodeDeck`. */
export function decodeDeck(code: string): ShareableDeck {
  if (typeof code !== "string") throw new Error("decodeDeck: code must be a string");
  const dot = code.indexOf(".");
  if (dot < 0) throw new Error("decodeDeck: missing version prefix");
  const version = code.slice(0, dot);
  if (version !== DECK_CODEC_VERSION) {
    throw new Error(`decodeDeck: unsupported version "${version}"`);
  }
  const body = code.slice(dot + 1);
  const wire = JSON.parse(decodeBase64Url(body)) as DeckWire;
  if (!wire || wire.v !== 1 || typeof wire.c !== "string" || !Array.isArray(wire.d)) {
    throw new Error("decodeDeck: corrupt payload");
  }
  return { commanderId: wire.c, cards: runLengthDecode(wire.d) };
}
