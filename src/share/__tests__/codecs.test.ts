import { describe, it, expect } from "vitest";
import { encodeBase64Url, decodeBase64Url } from "../base64url";
import {
  encodeDeck,
  decodeDeck,
  DECK_CODEC_VERSION,
  type ShareableDeck,
} from "../deckCodec";
import {
  encodeReplay,
  decodeReplay,
  REPLAY_CODEC_VERSION,
  type ShareableReplay,
} from "../replayCodec";

/**
 * Round-trip + bad-input tests for the share codecs. All pure, browser-safe.
 */

describe("base64url", () => {
  it("round-trips ASCII", () => {
    expect(decodeBase64Url(encodeBase64Url("hello"))).toBe("hello");
  });

  it("round-trips empty string", () => {
    expect(decodeBase64Url(encodeBase64Url(""))).toBe("");
  });

  it("round-trips UTF-8 / multibyte characters", () => {
    const s = "Frēlon ⬡ City — 你好 😀";
    expect(decodeBase64Url(encodeBase64Url(s))).toBe(s);
  });

  it("produces URL-safe output (no +, /, or = padding)", () => {
    // Build an input whose base64 would normally contain + and /.
    const out = encodeBase64Url("\xff\xfe\xfd\xfc\xfb\xfa");
    expect(out).not.toMatch(/[+/=]/);
  });

  it("round-trips a long JSON blob", () => {
    const blob = JSON.stringify({ a: Array.from({ length: 50 }, (_, i) => i), s: "x".repeat(100) });
    expect(decodeBase64Url(encodeBase64Url(blob))).toBe(blob);
  });
});

describe("deckCodec", () => {
  const deck: ShareableDeck = {
    commanderId: "cmd-001",
    cards: ["a", "a", "b", "c", "c", "c", "a"],
  };

  it("encode -> decode is an exact, order-preserving round-trip", () => {
    const decoded = decodeDeck(encodeDeck(deck));
    expect(decoded).toEqual(deck);
    expect(decoded.cards).toEqual(deck.cards); // order preserved
  });

  it("emits the versioned prefix", () => {
    expect(encodeDeck(deck).startsWith(`${DECK_CODEC_VERSION}.`)).toBe(true);
  });

  it("round-trips an empty card list", () => {
    const d: ShareableDeck = { commanderId: "x", cards: [] };
    expect(decodeDeck(encodeDeck(d))).toEqual(d);
  });

  it("run-length collapse preserves runs that re-appear later", () => {
    const d: ShareableDeck = { commanderId: "c", cards: ["x", "x", "y", "x"] };
    expect(decodeDeck(encodeDeck(d)).cards).toEqual(["x", "x", "y", "x"]);
  });

  it("rejects an invalid deck shape on encode", () => {
    expect(() => encodeDeck(null as unknown as ShareableDeck)).toThrow(/invalid deck/);
    expect(() => encodeDeck({ commanderId: 1, cards: [] } as unknown as ShareableDeck)).toThrow();
    expect(() => encodeDeck({ commanderId: "c", cards: "no" } as unknown as ShareableDeck)).toThrow();
  });

  it("rejects a non-string code on decode", () => {
    expect(() => decodeDeck(123 as unknown as string)).toThrow(/must be a string/);
  });

  it("rejects a missing version prefix", () => {
    expect(() => decodeDeck("noversionhere")).toThrow(/missing version prefix/);
  });

  it("rejects an unsupported version", () => {
    expect(() => decodeDeck("v9.abc")).toThrow(/unsupported version/);
  });

  it("rejects a corrupt payload", () => {
    const badBody = encodeBase64Url(JSON.stringify({ v: 2, c: "x", d: [] }));
    expect(() => decodeDeck(`${DECK_CODEC_VERSION}.${badBody}`)).toThrow(/corrupt payload/);
  });
});

describe("replayCodec", () => {
  const replay: ShareableReplay = {
    seed: 42,
    actions: [{ type: "PLAY", id: "a" }, { type: "END_TURN" }],
    p1: { commanderId: "c1", cards: ["a", "a"] },
    p2: { commanderId: "c2", cards: ["b"] },
    openingHandSize: 5,
  };

  it("encode -> decode round-trips the full replay", () => {
    expect(decodeReplay(encodeReplay(replay))).toEqual(replay);
  });

  it("emits the versioned prefix", () => {
    expect(encodeReplay(replay).startsWith(`${REPLAY_CODEC_VERSION}.`)).toBe(true);
  });

  it("omits optional fields when absent", () => {
    const minimal: ShareableReplay = { seed: 1, actions: [] };
    const decoded = decodeReplay(encodeReplay(minimal));
    expect(decoded).toEqual(minimal);
    expect(decoded.p1).toBeUndefined();
    expect(decoded.p2).toBeUndefined();
    expect(decoded.openingHandSize).toBeUndefined();
  });

  it("preserves seed === 0 and an empty action log", () => {
    const r: ShareableReplay = { seed: 0, actions: [] };
    expect(decodeReplay(encodeReplay(r))).toEqual(r);
  });

  it("treats opaque actions as-is", () => {
    const r: ShareableReplay = { seed: 7, actions: [1, "x", { k: true }, null] };
    expect(decodeReplay(encodeReplay(r)).actions).toEqual([1, "x", { k: true }, null]);
  });

  it("rejects an invalid replay shape on encode", () => {
    expect(() => encodeReplay({ seed: "no", actions: [] } as unknown as ShareableReplay)).toThrow(/invalid replay/);
    expect(() => encodeReplay({ seed: 1, actions: {} } as unknown as ShareableReplay)).toThrow();
  });

  it("rejects bad codes on decode", () => {
    expect(() => decodeReplay(5 as unknown as string)).toThrow(/must be a string/);
    expect(() => decodeReplay("nope")).toThrow(/missing version prefix/);
    expect(() => decodeReplay("zz.abc")).toThrow(/unsupported version/);
  });

  it("rejects a corrupt payload", () => {
    const badBody = encodeBase64Url(JSON.stringify({ v: 2, s: 1, a: [] }));
    expect(() => decodeReplay(`${REPLAY_CODEC_VERSION}.${badBody}`)).toThrow(/corrupt payload/);
  });

  it("deck codes are NOT accepted by the replay decoder (distinct namespaces)", () => {
    const deckCode = encodeDeck({ commanderId: "c", cards: [] });
    expect(() => decodeReplay(deckCode)).toThrow(/unsupported version/);
  });
});
