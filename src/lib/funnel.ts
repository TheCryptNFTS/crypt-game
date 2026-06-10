/**
 * FTUE FUNNEL (teardown §11 P2, director addition): the 5-event measurement the
 * retention work (P5) depends on — without it every onboarding/retention change
 * is tuned blind. Stages fire ONCE PER DEVICE (localStorage-deduped) so the
 * counts read directly as stage conversion:
 *
 *   splash_view → tutorial_start → tutorial_complete → first_match_result → d1_return
 *
 * PII-free by construction: stage names and ISO dates only, routed through the
 * existing privacy-safe `analytics.track` (console in dev, beacon when
 * VITE_ANALYTICS_URL is configured, no-op otherwise).
 */

import { track } from "./analytics";

const KEY = "crypt.funnel.v1";

type FunnelStage =
  | "splash_view"
  | "tutorial_start"
  | "tutorial_complete"
  | "first_match_result"
  | "d1_return";

type FunnelState = {
  seen?: Partial<Record<FunnelStage, true>>;
  /** ISO day (YYYY-MM-DD) of the device's first visit — the d1_return anchor. */
  firstDay?: string;
};

function load(): FunnelState {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as FunnelState;
  } catch {
    return {};
  }
}

function save(state: FunnelState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — funnel is strictly best-effort */
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fire a funnel stage once per device. Safe to call on every mount. */
export function funnelOnce(stage: Exclude<FunnelStage, "d1_return">): void {
  if (typeof window === "undefined") return;
  const s = load();
  if (s.seen?.[stage]) return;
  s.seen = { ...(s.seen ?? {}), [stage]: true };
  if (!s.firstDay) s.firstDay = today();
  save(s);
  track(stage);
}

/**
 * D1+ return: fires once, the first time the app boots on a LATER calendar day
 * than the device's first visit. Call once at app boot.
 */
export function trackReturnVisit(): void {
  if (typeof window === "undefined") return;
  const s = load();
  if (!s.firstDay) {
    s.firstDay = today();
    save(s);
    return;
  }
  if (s.seen?.d1_return) return;
  if (today() > s.firstDay) {
    s.seen = { ...(s.seen ?? {}), d1_return: true };
    save(s);
    track("d1_return", { firstDay: s.firstDay });
  }
}
