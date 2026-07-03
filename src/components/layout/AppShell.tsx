import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import CryptRouteFallback from "../CryptRouteFallback";
import { isOnboarded } from "../../lib/localProgress";

const dockClass = (isActive: boolean) =>
  ["crypt-mobile-dock-link", isActive ? "crypt-mobile-dock-link--active" : ""].filter(Boolean).join(" ");

// Routes that live in the "More" overflow sheet — kept out of the primary dock so
// the bar holds a comfortable 5 tabs at 360px (was 9, which crushed the labels and
// hid the in-match action bar under a too-tall dock). The dock height is fixed via
// --crypt-nav-dock-h (index.css) so the match board can reserve exactly that space.
const MORE_ROUTES = ["/friends", "/market", "/help", "/rewards"];

export default function AppShell() {
  const { pathname } = useLocation();
  // Keep the first-run surface minimal: a brand-new pilot only sees Home, Play,
  // and Profile. Vault (full collection) and Deck (forge) appear once onboarded
  // (tutorial done OR first win) — matching the router-level route guards.
  const onboarded = isOnboarded();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  // Close the sheet whenever the route changes (a NavLink tap navigates).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Escape closes the sheet and returns focus to the trigger.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // The active-route highlight for "More" lights when any overflow route is active.
  const moreActive = MORE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  return (
    <div className="flex min-h-full flex-col bg-[color:var(--color-crypt-bg)] crypt-app-root">
      {/* A11y (P11): keyboard/AT users can jump straight past the chrome to
          the main content. Visually hidden until focused. */}
      <a href="#main-content" className="a11y-skip-link">
        Skip to main content
      </a>
      <header className="crypt-app-chrome shrink-0" aria-label="CRYPT">
        <div className="relative flex items-center justify-center px-4 py-3 md:px-8 md:py-3.5">
          <NavLink
            to="/home"
            className="crypt-brand-lockup flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-crypt-ice)]"
          >
            {/* Brand mark = the local gold CRYPT sigil (public/icon.svg), not the
                remote cyan collection PFP. The off-brand cyan skull was poisoning
                the first impression on every shell route; the shipped PWA icon is
                the disciplined black/gold mark and carries no network dependency. */}
            <img
              src="/icon.svg"
              alt="Crypt"
              width={30}
              height={30}
              loading="eager"
              decoding="async"
              className="crypt-brand-icon--header"
              style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", display: "block", flexShrink: 0 }}
            />
            <span className="flex min-w-0 flex-col items-center md:items-start">
              <span className="crypt-wordmark crypt-wordmark--header">CRYPT</span>
              <span className="crypt-brand-tagline">A dark collectible card game</span>
            </span>
          </NavLink>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} role="main" className="crypt-app-main min-h-0 w-full flex-1">
        <Suspense fallback={<CryptRouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Overflow sheet for the secondary destinations. Rendered above the dock and
          dismissed by the backdrop, Escape, or any navigation. */}
      {moreOpen ? (
        <div className="crypt-more-sheet" role="presentation">
          <div
            className="crypt-more-sheet__backdrop"
            onClick={() => {
              setMoreOpen(false);
              moreBtnRef.current?.focus();
            }}
          />
          <div
            className="crypt-more-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
          >
            {onboarded ? (
              <NavLink to="/friends" className={({ isActive }) => dockClass(isActive)}>
                <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--profile" aria-hidden />
                Friends
              </NavLink>
            ) : null}
            {onboarded ? (
              <NavLink to="/market" className={({ isActive }) => dockClass(isActive)}>
                <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--catalog" aria-hidden />
                Bazaar
              </NavLink>
            ) : null}
            <NavLink to="/help" className={({ isActive }) => dockClass(isActive)}>
              <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--play" aria-hidden />
              Help
            </NavLink>
            <NavLink to="/rewards" className={({ isActive }) => dockClass(isActive)}>
              <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--play" aria-hidden />
              Rewards
            </NavLink>
          </div>
        </div>
      ) : null}

      <nav className="crypt-mobile-dock" aria-label="CRYPT · command hub">
        <NavLink
          to="/home"
          end
          className={({ isActive }) =>
            dockClass(isActive || pathname === "/daily-pack")
          }
        >
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--home" aria-hidden />
          Home
        </NavLink>
        <NavLink
          to="/play"
          className={({ isActive }) =>
            dockClass(isActive || pathname === "/match" || pathname.startsWith("/match/"))
          }
        >
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--play" aria-hidden />
          Play
        </NavLink>
        {/* /puzzles is hidden from the dock (teardown §2, director ruling): the
            puzzles are reveal-only demos, not playable. Route resolves by URL;
            re-add the tab when they become real teaching puzzles (V1.1). */}
        {onboarded ? (
          <NavLink to="/collection" className={({ isActive }) => dockClass(isActive)}>
            <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--catalog" aria-hidden />
            Vault
          </NavLink>
        ) : null}
        {onboarded ? (
          <NavLink to="/deck" className={({ isActive }) => dockClass(isActive)}>
            <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--deck" aria-hidden />
            Deck
          </NavLink>
        ) : null}
        <NavLink to="/profile" className={({ isActive }) => dockClass(isActive)}>
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--profile" aria-hidden />
          Profile
        </NavLink>
        {/* Secondary destinations (Friends, Bazaar, Help, Rewards) live behind this
            overflow trigger so the dock stays a comfortable 5-tab row at 360px. The
            trigger lights when any overflow route is active so the highlight logic
            still reflects where you are. */}
        <button
          type="button"
          ref={moreBtnRef}
          className={dockClass(moreActive || moreOpen)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--more" aria-hidden />
          More
        </button>
      </nav>
    </div>
  );
}
