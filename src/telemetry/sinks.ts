/**
 * TELEMETRY SINKS — concrete implementations of the pluggable `TelemetrySink`.
 *
 *   - InMemorySink     : a plain array buffer. The off-browser fallback and the
 *                        substrate the dev report aggregates over.
 *   - LocalStorageSink : persists to `localStorage` under a single key; falls
 *                        back to in-memory if `localStorage` is unavailable
 *                        (SSR / node / private mode). Browser-safe: every access
 *                        is guarded, so importing this module runs NO node/web
 *                        globals at import time.
 *   - NoopRemoteSink   : a stub for a future network exporter. record() is a
 *                        clean no-op; reads return empty. Pluggable today so the
 *                        wiring is proven without a backend.
 *   - RemoteSink       : a real-ish network exporter. record() POSTs the event
 *                        via navigator.sendBeacon to import.meta.env.
 *                        VITE_TELEMETRY_URL. DISABLED (pure no-op) when the env
 *                        var is unset or sendBeacon is unavailable, so it is
 *                        safe by default and browser-/SSR-safe.
 *
 * No engine imports — telemetry is decoupled from the deterministic reducer.
 */

import { MatchTelemetry, TelemetrySink } from "./types";

/** Default localStorage key for the persistent sink. */
export const TELEMETRY_LS_KEY = "crypt.telemetry.v1";

/** True only when a usable localStorage exists (guarded for node/SSR). */
function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== "undefined" && !!(globalThis as any).localStorage;
  } catch {
    return false;
  }
}

export class InMemorySink implements TelemetrySink {
  private buffer: MatchTelemetry[] = [];

  record(event: MatchTelemetry): void {
    this.buffer.push(event);
  }

  readAll(): MatchTelemetry[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}

export class LocalStorageSink implements TelemetrySink {
  private readonly key: string;
  /** Used whenever localStorage is missing, so the sink never throws. */
  private readonly fallback = new InMemorySink();

  constructor(key: string = TELEMETRY_LS_KEY) {
    this.key = key;
  }

  private read(): MatchTelemetry[] {
    if (!hasLocalStorage()) return this.fallback.readAll();
    try {
      const raw = (globalThis as any).localStorage.getItem(this.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MatchTelemetry[]) : [];
    } catch {
      return [];
    }
  }

  private write(events: MatchTelemetry[]): void {
    if (!hasLocalStorage()) {
      this.fallback.clear();
      for (const e of events) this.fallback.record(e);
      return;
    }
    try {
      (globalThis as any).localStorage.setItem(this.key, JSON.stringify(events));
    } catch {
      /* quota / serialization failure — drop silently, telemetry is best-effort */
    }
  }

  record(event: MatchTelemetry): void {
    const all = this.read();
    all.push(event);
    this.write(all);
  }

  readAll(): MatchTelemetry[] {
    return this.read();
  }

  clear(): void {
    this.write([]);
  }
}

export class NoopRemoteSink implements TelemetrySink {
  record(_event: MatchTelemetry): void {
    /* stub: a real remote sink would POST here. Intentionally inert. */
    void _event;
  }

  readAll(): MatchTelemetry[] {
    return [];
  }

  clear(): void {
    /* no-op */
  }
}

/** Read VITE_TELEMETRY_URL without assuming import.meta.env exists (node/tests). */
function telemetryUrl(): string | undefined {
  try {
    const e = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const url = e ? e.VITE_TELEMETRY_URL : undefined;
    return url && url.length ? url : undefined;
  } catch {
    return undefined;
  }
}

/** True only when navigator.sendBeacon is callable (guarded for node/SSR). */
function hasSendBeacon(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function";
  } catch {
    return false;
  }
}

/**
 * RemoteSink — exports each recorded match to a configurable endpoint via
 * navigator.sendBeacon (fire-and-forget, survives page unload). The endpoint is
 * read from import.meta.env.VITE_TELEMETRY_URL. When that var is UNSET — or when
 * sendBeacon is unavailable (node / SSR / unsupported browser) — this sink is a
 * pure no-op: record() does nothing, readAll() returns []. So it is disabled by
 * default and only "turns on" once an operator configures the endpoint.
 *
 * It does not buffer locally; pair it with LocalStorageSink if you also want a
 * readable on-device history. Failures are swallowed — telemetry is best-effort.
 */
export class RemoteSink implements TelemetrySink {
  private readonly url: string | undefined;

  constructor(url: string | undefined = telemetryUrl()) {
    this.url = url;
  }

  /** True when this sink will actually transmit (endpoint set + sendBeacon present). */
  get enabled(): boolean {
    return !!this.url && hasSendBeacon();
  }

  record(event: MatchTelemetry): void {
    if (!this.enabled) return;
    try {
      const blob = new Blob([JSON.stringify(event)], { type: "application/json" });
      navigator.sendBeacon(this.url as string, blob);
    } catch {
      /* network / serialization failure — drop silently, telemetry is best-effort */
    }
  }

  readAll(): MatchTelemetry[] {
    /* remote sink is write-only from the client's perspective */
    return [];
  }

  clear(): void {
    /* nothing buffered locally to clear */
  }
}

/**
 * The DEFAULT sink the app wires at match-end: persistent localStorage in the
 * browser, in-memory fallback elsewhere. A singleton so every match-end shares
 * one buffer for the session.
 */
export const defaultSink: TelemetrySink = new LocalStorageSink();
