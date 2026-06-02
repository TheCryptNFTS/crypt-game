import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shareBaseUrl,
  absoluteUrl,
  tweetUrl,
  copyToClipboard,
  shareOrCopy,
} from "../share";

/**
 * Pure-logic tests for the social-share helpers. These run in the node env (no
 * DOM), so they exercise the SSR/non-browser branches: shareBaseUrl's fallback,
 * URL formatting, and shareOrCopy's copy-fallback path via a stubbed navigator.
 */

describe("shareBaseUrl", () => {
  it("falls back to the play domain when window is undefined", () => {
    // node env: typeof window === "undefined"
    expect(shareBaseUrl()).toBe("https://play.freeloncity.com");
  });
});

describe("absoluteUrl", () => {
  it("returns http(s) URLs unchanged", () => {
    expect(absoluteUrl("https://x.com/a")).toBe("https://x.com/a");
    expect(absoluteUrl("http://x.com/a")).toBe("http://x.com/a");
  });

  it("prefixes a leading-slash path with the base", () => {
    expect(absoluteUrl("/d/ABC")).toBe("https://play.freeloncity.com/d/ABC");
  });

  it("inserts a slash for a bare path", () => {
    expect(absoluteUrl("d/ABC")).toBe("https://play.freeloncity.com/d/ABC");
  });

  it("does not double a slash", () => {
    const out = absoluteUrl("/x");
    expect(out.indexOf("//d") < 0 || true).toBe(true);
    expect(out).toBe("https://play.freeloncity.com/x");
  });
});

describe("tweetUrl", () => {
  it("builds an intent URL with the text param", () => {
    const url = tweetUrl("hello world");
    expect(url.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
    const qs = new URL(url).searchParams;
    expect(qs.get("text")).toBe("hello world");
    expect(qs.get("hashtags")).toBe("CRYPT,FreelonCity");
    expect(qs.get("url")).toBeNull();
  });

  it("includes the url param when provided", () => {
    const url = tweetUrl("hi", "https://play.freeloncity.com/d/ABC");
    const qs = new URL(url).searchParams;
    expect(qs.get("url")).toBe("https://play.freeloncity.com/d/ABC");
  });

  it("url-encodes special characters in text", () => {
    const url = tweetUrl("a&b=c d");
    const qs = new URL(url).searchParams;
    expect(qs.get("text")).toBe("a&b=c d");
    // Raw query must have escaped the ampersand so it is not a separator.
    expect(url).toContain("text=a%26b%3Dc+d");
  });
});

describe("copyToClipboard", () => {
  const g = globalThis as Record<string, unknown>;

  afterEach(() => {
    delete g.navigator;
    delete g.document;
    vi.restoreAllMocks();
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    g.navigator = { clipboard: { writeText } };
    const ok = await copyToClipboard("payload");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("payload");
  });

  it("falls back to execCommand when clipboard rejects", async () => {
    g.navigator = { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } };
    const appended: unknown[] = [];
    const execCommand = vi.fn().mockReturnValue(true);
    g.document = {
      createElement: () => ({ style: {}, select: vi.fn(), value: "" }),
      body: { appendChild: (n: unknown) => appended.push(n), removeChild: vi.fn() },
      execCommand,
    };
    const ok = await copyToClipboard("p");
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(appended.length).toBe(1);
  });

  it("returns false when both clipboard and execCommand are unavailable", async () => {
    // No navigator.clipboard and no document -> both paths throw/return false.
    g.navigator = {};
    const ok = await copyToClipboard("p");
    expect(ok).toBe(false);
  });
});

describe("shareOrCopy", () => {
  const g = globalThis as Record<string, unknown>;

  beforeEach(() => {
    delete g.navigator;
    delete g.document;
  });
  afterEach(() => {
    delete g.navigator;
    delete g.document;
    vi.restoreAllMocks();
  });

  it("returns 'shared' when the native share sheet succeeds", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    g.navigator = { share };
    const res = await shareOrCopy({ text: "t", url: "u" });
    expect(res).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: undefined, text: "t", url: "u" });
  });

  it("falls back to copy and returns 'copied' when share is absent", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    g.navigator = { clipboard: { writeText } };
    const res = await shareOrCopy({ text: "hello", url: "https://x" });
    expect(res).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello  https://x");
  });

  it("joins text and url, dropping a missing url", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    g.navigator = { clipboard: { writeText } };
    await shareOrCopy({ text: "only" });
    expect(writeText).toHaveBeenCalledWith("only");
  });

  it("falls back to copy when share() rejects (user cancel)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    g.navigator = {
      share: vi.fn().mockRejectedValue(new Error("cancel")),
      clipboard: { writeText },
    };
    const res = await shareOrCopy({ text: "t" });
    expect(res).toBe("copied");
  });

  it("returns 'failed' when share absent and copy impossible", async () => {
    g.navigator = {};
    const res = await shareOrCopy({ text: "t" });
    expect(res).toBe("failed");
  });
});
