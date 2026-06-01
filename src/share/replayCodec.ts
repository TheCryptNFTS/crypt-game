/**
 * MATCH REPLAY CODEC — serialize a deterministic match to a shareable string and
 * decode it back. The engine is deterministic: `(seed, actions)` (plus the
 * bootstrap decks/commanders) fully determine the final state, so a replay needs
 * only those — NOT a state dump. Re-deriving = feed the decoded seed+actions back
 * through the SAME `applyAction` the live game uses.
 *
 * Pure encode/decode here (no engine import, browser-safe). The re-derivation
 * helper that calls the reducer lives in the dev proof, so this module stays
 * engine-free and importable anywhere.
 */

import { encodeBase64Url, decodeBase64Url } from "./base64url";
import type { ShareableDeck } from "./deckCodec";

export const REPLAY_CODEC_VERSION = "r1";

/**
 * Everything needed to re-derive a match deterministically. `actions` is the
 * exact applied action log (including any auto-resolved RESOLVE_CHOICE entries),
 * so replaying `(seed, actions)` reproduces the byte-identical final state.
 * `actions` is typed loosely (the engine's `Action` union) and serialised as-is;
 * the codec does not interpret it.
 */
export interface ShareableReplay {
  seed: number;
  /** Engine actions in applied order. Opaque to the codec. */
  actions: unknown[];
  /** Optional bootstrap so a viewer can rebuild the exact starting match. */
  p1?: ShareableDeck;
  p2?: ShareableDeck;
  openingHandSize?: number;
}

interface ReplayWire {
  v: 1;
  s: number;
  a: unknown[];
  p1?: ShareableDeck;
  p2?: ShareableDeck;
  h?: number;
}

/** Encode a replay to a shareable string. */
export function encodeReplay(replay: ShareableReplay): string {
  if (!replay || typeof replay.seed !== "number" || !Array.isArray(replay.actions)) {
    throw new Error("encodeReplay: invalid replay shape");
  }
  const wire: ReplayWire = {
    v: 1,
    s: replay.seed,
    a: replay.actions,
  };
  if (replay.p1) wire.p1 = replay.p1;
  if (replay.p2) wire.p2 = replay.p2;
  if (typeof replay.openingHandSize === "number") wire.h = replay.openingHandSize;
  return `${REPLAY_CODEC_VERSION}.${encodeBase64Url(JSON.stringify(wire))}`;
}

/** Decode a shareable string back to a replay. Inverse of `encodeReplay`. */
export function decodeReplay(code: string): ShareableReplay {
  if (typeof code !== "string") throw new Error("decodeReplay: code must be a string");
  const dot = code.indexOf(".");
  if (dot < 0) throw new Error("decodeReplay: missing version prefix");
  const version = code.slice(0, dot);
  if (version !== REPLAY_CODEC_VERSION) {
    throw new Error(`decodeReplay: unsupported version "${version}"`);
  }
  const wire = JSON.parse(decodeBase64Url(code.slice(dot + 1))) as ReplayWire;
  if (!wire || wire.v !== 1 || typeof wire.s !== "number" || !Array.isArray(wire.a)) {
    throw new Error("decodeReplay: corrupt payload");
  }
  const out: ShareableReplay = { seed: wire.s, actions: wire.a };
  if (wire.p1) out.p1 = wire.p1;
  if (wire.p2) out.p2 = wire.p2;
  if (typeof wire.h === "number") out.openingHandSize = wire.h;
  return out;
}
