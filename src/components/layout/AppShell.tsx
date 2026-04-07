import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import CryptRouteFallback from "../CryptRouteFallback";

const dockClass = (isActive: boolean) =>
  ["crypt-mobile-dock-link", isActive ? "crypt-mobile-dock-link--active" : ""].filter(Boolean).join(" ");

export default function AppShell() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-full flex-col bg-[color:var(--color-crypt-bg)] crypt-app-root">
      <header className="crypt-app-chrome shrink-0" aria-label="CRYPT · Crypt Legends">
        <div className="relative flex items-center justify-center px-4 py-3 md:px-8 md:py-3.5">
          <NavLink
            to="/home"
            className="crypt-brand-lockup flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-crypt-ice)]"
          >
            <span className="crypt-brand-icon crypt-brand-icon--header" aria-hidden />
            <span className="flex min-w-0 flex-col items-center md:items-start">
              <span className="crypt-wordmark crypt-wordmark--header">CRYPT</span>
              <span className="crypt-brand-tagline">Crypt Legends · dark TCG</span>
            </span>
          </NavLink>
        </div>
      </header>
      <main className="crypt-app-main min-h-0 w-full flex-1">
        <Suspense fallback={<CryptRouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="crypt-mobile-dock" aria-label="Crypt Legends · command hub">
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
        <NavLink to="/collection" className={({ isActive }) => dockClass(isActive)}>
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--catalog" aria-hidden />
          Vault
        </NavLink>
        <NavLink to="/deck" className={({ isActive }) => dockClass(isActive)}>
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--deck" aria-hidden />
          Deck
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => dockClass(isActive)}>
          <span className="crypt-mobile-dock-glyph crypt-mobile-dock-glyph--profile" aria-hidden />
          Profile
        </NavLink>
      </nav>
    </div>
  );
}
