import { afterEach, describe, expect, it, vi } from "vitest";
import { postConcede, type ConcedeOutcome } from "../useRemoteCryptMatch";

/**
 * The PvP concede NETWORK path cannot be runtime-exercised locally (it needs a
 * wallet + a live opponent + the staging server). `postConcede` is the extracted,
 * dependency-injected core of the `concede()` handler so that contract IS unit-
 * testable here: success, session-expiry, every error status, and a thrown
 * network error each map to the discriminated outcome the hook reacts to.
 */

const BASE = "https://city.test";
const MATCH = "m_abc";
const AUTH = { authorization: "Bearer t0ken" };

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fn = vi.fn(impl as never);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postConcede", () => {
  it("posts to the concede route with auth + JSON headers and no body", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, { version: 5, view: { matchId: MATCH, winner: "P2" } }),
    );

    await postConcede(BASE, MATCH, AUTH);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/match/${MATCH}/concede`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      accept: "application/json",
      authorization: "Bearer t0ken",
    });
  });

  it("200 -> decided, adopting the returned version + view", async () => {
    const view = { matchId: MATCH, activePlayer: "P1", winner: "P2", mySeat: "P1" };
    mockFetch(() => jsonResponse(200, { version: 7, view }));

    const out = await postConcede(BASE, MATCH, AUTH);

    expect(out).toEqual<ConcedeOutcome>({ kind: "decided", version: 7, view: view as never });
  });

  it("200 idempotent (already-decided) is also a clean decided outcome", async () => {
    const view = { matchId: MATCH, activePlayer: "P2", winner: "P1", mySeat: "P1" };
    mockFetch(() => jsonResponse(200, { version: 9, view }));

    const out = await postConcede(BASE, MATCH, AUTH);

    expect(out.kind).toBe("decided");
  });

  it("401 -> auth (session expired)", async () => {
    mockFetch(() => jsonResponse(401, { error: "unauthorized" }));

    const out = await postConcede(BASE, MATCH, AUTH);

    expect(out).toEqual<ConcedeOutcome>({ kind: "auth" });
  });

  it.each([403, 404, 409, 429, 500])(
    "%i -> failed with the status (player stays in the match)",
    async (status) => {
      mockFetch(() => jsonResponse(status, { error: "nope" }));

      const out = await postConcede(BASE, MATCH, AUTH);

      expect(out).toEqual<ConcedeOutcome>({ kind: "failed", status });
    },
  );

  it("network throw -> failed with status null (no silent success)", async () => {
    mockFetch(() => {
      throw new Error("offline");
    });

    const out = await postConcede(BASE, MATCH, AUTH);

    expect(out).toEqual<ConcedeOutcome>({ kind: "failed", status: null });
  });

  it("a rejected fetch promise -> failed (not an unhandled rejection)", async () => {
    mockFetch(() => Promise.reject(new Error("DNS")));

    const out = await postConcede(BASE, MATCH, AUTH);

    expect(out.kind).toBe("failed");
  });
});
