/**
 * Client-only session stub until real auth exists.
 * TODO: replace with guest / account / wallet session from backend.
 */
const SESSION_KEY = "crypt.app.session";

/**
 * When localStorage throws (private mode, blocked storage, quota), we still need a guest
 * session for the tab — Splash still uses this for “continue as guest”; main chrome no longer redirects on it.
 */
let memoryGuestSession = false;
let memoryOnlyGuestWarned = false;

export type AppSessionStub = "guest" | null;

type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

function emitSessionChange() {
  sessionListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** Subscribe for useSyncExternalStore / cross-surface re-renders after guest login or sign-out. */
export function subscribeSessionStub(onStoreChange: SessionListener) {
  sessionListeners.add(onStoreChange);
  return () => void sessionListeners.delete(onStoreChange);
}

export function getSessionStubSnapshot(): AppSessionStub {
  return getSessionStub();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SESSION_KEY || e.key === null) emitSessionChange();
  });
}

export function getSessionStub(): AppSessionStub {
  if (memoryGuestSession) return "guest";
  try {
    if (localStorage.getItem(SESSION_KEY) === "guest") return "guest";
  } catch {
    /* private mode / blocked */
  }
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "guest") return "guest";
  } catch {
    /* ignore */
  }
  return null;
}

export function setGuestSessionStub(): void {
  memoryGuestSession = true;
  let wroteLocal = false;
  try {
    localStorage.setItem(SESSION_KEY, "guest");
    wroteLocal = true;
  } catch {
    /* still allow this tab to run the shell */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, "guest");
  } catch {
    /* memory-only fallback */
  }
  if (!wroteLocal && !memoryOnlyGuestWarned) {
    memoryOnlyGuestWarned = true;
    console.warn(
      "[CRYPT] Could not write localStorage (private window, blocked storage, or full disk). Guest mode still runs in this tab; open DevTools → Console if the app used to bounce you back to the splash screen."
    );
  }
  emitSessionChange();
}

/** TODO: call when account or wallet login ships */
export function clearSessionStub(): void {
  memoryGuestSession = false;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  emitSessionChange();
}
