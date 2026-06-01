import { useCallback, useEffect, useRef, useState } from "react";
import {
  listEmotes,
  sendEmote,
  pollEmotes,
  type EmotePreset,
  type EmoteEvent,
} from "../../services/socialApi";

/**
 * PvP-ONLY in-match emote bar. Mounts a small row of preset buttons (from the
 * server's `listEmotes`) plus auto-fading speech-bubble callouts for incoming
 * emotes. Everything degrades to nothing when offline/guest/solo — `listEmotes`
 * returns null, so we render nothing and never error.
 *
 * Transport: click -> `sendEmote(matchId, id)`; a poll loop pulls
 * `pollEmotes(matchId, since)` and renders the deltas as transient bubbles. The
 * client also rate-limits (buttons disabled briefly after a send) to mirror the
 * server's limit and discourage spam.
 *
 * `from` on an EmoteEvent identifies the sender; we compare against `myId` to
 * position the bubble on the correct side (yours vs opponent's). `prefers-
 * reduced-motion` is honored by the CSS (instant show, no fade) — JS still
 * removes bubbles on a timer either way.
 */

type Props = {
  /** The live PvP match id. Required — the bar only mounts in PvP. */
  matchId: string;
  /** This client's seat/identity, to position own vs opponent bubbles. */
  myId: string;
};

/** How long a bubble lingers before it's removed. */
const BUBBLE_TTL_MS = 3200;
/** Client-side send cooldown — mirror the server limit, prevent spam. */
const SEND_COOLDOWN_MS = 2500;
/** Poll cadence for incoming emotes. */
const POLL_MS = 1500;

type Bubble = {
  key: string;
  emoteId: string;
  label: string;
  mine: boolean;
};

export function EmoteBar({ matchId, myId }: Props) {
  const [presets, setPresets] = useState<EmotePreset[] | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [cooling, setCooling] = useState(false);

  // Latest server timestamp we've seen, so each poll only asks for newer events.
  const sinceRef = useRef(0);
  const mountedRef = useRef(true);
  const labelById = useRef<Map<string, string>>(new Map());
  const cooldownTimer = useRef<number | null>(null);
  const bubbleTimers = useRef<number[]>([]);

  // Load the preset list once. Null = offline/guest/solo -> render nothing.
  useEffect(() => {
    mountedRef.current = true;
    let alive = true;
    listEmotes()
      .then((list) => {
        if (!alive) return;
        if (list && list.length) {
          labelById.current = new Map(list.map((p) => [p.id, p.label]));
          setPresets(list);
        } else {
          setPresets(null);
        }
      })
      .catch(() => {
        if (alive) setPresets(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const pushBubble = useCallback((ev: EmoteEvent) => {
    const label = labelById.current.get(ev.emoteId) ?? ev.emoteId;
    const key = `${ev.from}-${ev.at}-${ev.emoteId}-${Math.random().toString(36).slice(2)}`;
    const bubble: Bubble = { key, emoteId: ev.emoteId, label, mine: ev.from === myId };
    setBubbles((cur) => [...cur, bubble].slice(-6));
    const t = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setBubbles((cur) => cur.filter((b) => b.key !== key));
    }, BUBBLE_TTL_MS);
    bubbleTimers.current.push(t);
  }, [myId]);

  // Poll for incoming emotes. Only runs once presets loaded (PvP + signed in).
  useEffect(() => {
    if (!presets) return;
    let timer: number | null = null;
    let alive = true;

    const tick = async () => {
      try {
        const events = await pollEmotes(matchId, sinceRef.current);
        if (!alive || !mountedRef.current) return;
        if (events && events.length) {
          for (const ev of events) {
            if (ev.at > sinceRef.current) sinceRef.current = ev.at;
            pushBubble(ev);
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (alive) timer = window.setTimeout(tick, POLL_MS);
    };

    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [presets, matchId, pushBubble]);

  // Cleanup all timers on unmount.
  useEffect(
    () => () => {
      mountedRef.current = false;
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
      for (const t of bubbleTimers.current) window.clearTimeout(t);
    },
    [],
  );

  const onSend = useCallback(
    async (id: string) => {
      if (cooling) return;
      setCooling(true);
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
      cooldownTimer.current = window.setTimeout(() => {
        if (mountedRef.current) setCooling(false);
      }, SEND_COOLDOWN_MS);
      try {
        await sendEmote(matchId, id);
      } catch {
        /* best-effort; the cooldown still applies to avoid spam retries */
      }
    },
    [cooling, matchId],
  );

  // Offline / guest / solo / no presets -> render nothing (graceful degrade).
  if (!presets) return null;

  return (
    <>
      <div className="emotebar" role="group" aria-label="Match emotes">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="emotebar__btn"
            disabled={cooling}
            onClick={() => void onSend(p.id)}
            title={p.label}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="emotebar-bubbles" aria-live="polite">
        {bubbles.map((b) => (
          <div
            key={b.key}
            className={`emotebar-bubble ${b.mine ? "emotebar-bubble--mine" : "emotebar-bubble--theirs"}`}
          >
            {b.label}
          </div>
        ))}
      </div>
    </>
  );
}
