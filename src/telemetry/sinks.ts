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

/**
 * The DEFAULT sink the app wires at match-end: persistent localStorage in the
 * browser, in-memory fallback elsewhere. A singleton so every match-end shares
 * one buffer for the session.
 */
export const defaultSink: TelemetrySink = new LocalStorageSink();
