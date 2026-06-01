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

function runLengthDecode(pairs: Array<[string, number]>): string[] {
  const out: string[] = [];
  for (const [id, count] of pairs) {
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
