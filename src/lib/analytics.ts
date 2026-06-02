/**
 * ANALYTICS — a tiny, privacy-safe event API for CRYPT.
 *
 *   track(event, props?)   — record a named product event with flat props
 *   pageview(path)         — record a route view (path only, never the query)
 *   reportError(err, ctx?) — record a captured error (message + name + ctx)
 *
 * DESIGN GUARANTEES
 *   - NO PII: we never read wallet, hex, cookies, localStorage user data, or
 *     query strings. `pageview` strips `?…#…` before recording. Callers are
 *     trusted to pass non-PII props, and we shallow-copy + JSON-clamp them so a
 *     stray object can't smuggle a live reference through.
 *   - NO third-party SDK: events batch in-memory and flush to a PLUGGABLE sink.
 *     Default sink is console in dev, no-op in prod — UNLESS a beacon endpoint
 *     is configured via import.meta.env.VITE_ANALYTICS_URL, in which case the
 *     batch is POSTed via navigator.sendBeacon (guarded, best-effort).
 *   - BROWSER-SAFE: every window / navigator / document access is guarded, so
 *     importing this module under SSR / node / tests touches no web globals.
 *
 * This module is intentionally decoupled from the match telemetry sink in
 * src/telemetry/* — that pipeline records decided-match stats; THIS one records
 * product analytics (pageviews, UI events, render crashes).
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** A single recorded analytics event. Flat, serialisable, PII-free. */
export interface AnalyticsEvent {
  /** "track" | "pageview" | "error" — the event family. */
  type: "track" | "pageview" | "error";
  /** Event name ("page_view", an error name, or a caller-supplied label). */
  name: string;
  /** Epoch ms at capture. */
  ts: number;
  /** Flat, JSON-clamped properties. Never contains PII by contract. */
  props?: Record<string, unknown>;
}

/** Where batched events go. Synchronous, best-effort, never throws to caller. */
export interface AnalyticsSink {
  /** Flush a batch of events. Implementations MUST swallow their own errors. */
  flush(events: AnalyticsEvent[]): void;
}

/* ----------------------------------------------------------------------------
 * Browser-safe global guards
 * ------------------------------------------------------------------------- */

function hasWindow(): boolean {
  try {
    return typeof window !== "undefined";
  } catch {
    return false;
  }
}

function hasSendBeacon(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function";
  } catch {
    return false;
  }
}

/** Read a Vite env var without assuming import.meta.env exists (node/tests). */
function env(key: string): string | undefined {
  try {
    const e = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return e ? e[key] : undefined;
  } catch {
    return undefined;
  }
}

function isDev(): boolean {
  return env("DEV") === "true" || env("MODE") === "development";
}

/* ----------------------------------------------------------------------------
 * PII clamp — shallow-copy props and drop anything non-scalar / over-long, so a
 * caller can't accidentally leak an object graph or a giant blob.
 * ------------------------------------------------------------------------- */

const MAX_STR = 256;

function clampProps(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (typeof v === "string") {
      out[k] = v.length > MAX_STR ? v.slice(0, MAX_STR) : v;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
    // objects / arrays / functions are dropped — they're the PII risk surface.
  }
  return Object.keys(out).length ? out : undefined;
}

/** Strip query + hash so a pageview path never carries PII or tokens. */
function sanitizePath(path: string): string {
  const q = path.indexOf("?");
  const h = path.indexOf("#");
  let end = path.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  const clean = path.slice(0, end);
  return clean || "/";
}

/* ----------------------------------------------------------------------------
 * Default sinks
 * ------------------------------------------------------------------------- */

/** Logs batches to the console — used in dev so events are visible. */
class ConsoleAnalyticsSink implements AnalyticsSink {
  flush(events: AnalyticsEvent[]): void {
    try {
      for (const e of events) {
        // eslint-disable-next-line no-console
        console.debug("[analytics]", e.type, e.name, e.props ?? {});
      }
    } catch {
      /* console unavailable — ignore */
    }
  }
}

/** Discards everything. Default in prod when no beacon endpoint is configured. */
class NoopAnalyticsSink implements AnalyticsSink {
  flush(_events: AnalyticsEvent[]): void {
    void _events;
  }
}

/**
 * POSTs the batch as JSON to a configured endpoint via navigator.sendBeacon.
 * No-op (and never constructed) when the endpoint is unset or sendBeacon is
 * missing. Failures are swallowed — analytics is strictly best-effort.
 */
class BeaconAnalyticsSink implements AnalyticsSink {
  constructor(private readonly url: string) {}

  flush(events: AnalyticsEvent[]): void {
    if (!events.length || !hasSendBeacon()) return;
    try {
      const body = JSON.stringify({ events });
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(this.url, blob);
    } catch {
      /* beacon failed (size / network) — drop the batch silently */
    }
  }
}

/** Pick the default sink from the environment. Beacon wins when configured. */
function pickDefaultSink(): AnalyticsSink {
  const url = env("VITE_ANALYTICS_URL");
  if (url && hasSendBeacon()) return new BeaconAnalyticsSink(url);
  if (isDev()) return new ConsoleAnalyticsSink();
  return new NoopAnalyticsSink();
}

/* ----------------------------------------------------------------------------
 * Batching core
 * ------------------------------------------------------------------------- */

const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 50;

let sink: AnalyticsSink = pickDefaultSink();
let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lifecycleBound = false;

/** Swap the active sink (tests / custom transports). Flushes the pending batch first. */
export function setAnalyticsSink(next: AnalyticsSink): void {
  flush();
  sink = next;
}

/** Flush the current queue to the sink immediately. Safe to call any time. */
export function flush(): void {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    sink.flush(batch);
  } catch {
    /* a misbehaving sink must never break the app */
  }
}

/** Flush on page hide / unload so we don't lose the tail of a session. */
function bindLifecycle(): void {
  if (lifecycleBound || !hasWindow()) return;
  lifecycleBound = true;
  try {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  } catch {
    /* listener registration failed — flush still happens on the timer */
  }
}

function enqueue(event: AnalyticsEvent): void {
  bindLifecycle();
  queue.push(event);
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (timer == null) {
    timer = setTimeout(flush, FLUSH_INTERVAL_MS);
    // Don't keep a node process alive for a flush (tests / SSR).
    if (typeof timer === "object" && timer && typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as { unref: () => void }).unref();
    }
  }
}

/* ----------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

/** Record a named product event with optional flat, non-PII props. */
export function track(event: string, props?: Record<string, unknown>): void {
  enqueue({ type: "track", name: event, ts: Date.now(), props: clampProps(props) });
}

/** Record a route view. The path is sanitised: query + hash are stripped. */
export function pageview(path: string): void {
  enqueue({ type: "pageview", name: "page_view", ts: Date.now(), props: { path: sanitizePath(path) } });
}

/**
 * Record a captured error. We send the message + name + optional flat context,
 * NOT the stack by default (stacks can carry file paths / tokens). Pass
 * `ctx.includeStack` truthy only when you've vetted the surface.
 */
export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const props: Record<string, unknown> = {
    message: e.message,
    name: e.name,
    ...(clampProps(ctx) ?? {}),
  };
  enqueue({ type: "error", name: e.name || "Error", ts: Date.now(), props: clampProps(props) });
}

/* ----------------------------------------------------------------------------
 * Route-change pageview hook — usable from main / any component INSIDE the
 * Router. It lazily imports react-router's useLocation at call time so this
 * module has no hard react-router dependency (keeps it usable in isolation).
 * If you're outside Router context, subscribe to the data router instead (see
 * trackRouterPageviews below).
 * ------------------------------------------------------------------------- */

let lastTrackedPath: string | null = null;

function recordPageviewOnce(path: string): void {
  const clean = sanitizePath(path);
  if (clean === lastTrackedPath) return;
  lastTrackedPath = clean;
  pageview(clean);
}

/**
 * Subscribe a data router (createBrowserRouter) to pageview tracking WITHOUT
 * editing the router module. Returns an unsubscribe fn. Browser-safe: if the
 * router lacks a subscribe API it records the current location once and bails.
 */
export function trackRouterPageviews(router: {
  state?: { location?: { pathname?: string; search?: string } };
  subscribe?: (cb: (state: { location?: { pathname?: string } }) => void) => () => void;
}): () => void {
  const current = router.state?.location;
  if (current?.pathname != null) {
    recordPageviewOnce(current.pathname);
  }
  if (typeof router.subscribe !== "function") {
    return () => {};
  }
  return router.subscribe((state) => {
    const p = state.location?.pathname;
    if (p != null) recordPageviewOnce(p);
  });
}

/**
 * React hook variant — call inside a component rendered within the Router to
 * fire a deduped pageview on every location change. Primary wiring in main.tsx
 * uses trackRouterPageviews (no Router context needed); this hook is provided
 * for any in-tree component that prefers the idiomatic form.
 */
export function usePageviews(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    recordPageviewOnce(pathname);
  }, [pathname]);
}
