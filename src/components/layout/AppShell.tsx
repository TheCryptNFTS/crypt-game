import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-[color:var(--color-crypt-border)] text-[color:var(--color-crypt-accent)]"
      : "text-zinc-400 hover:text-zinc-100",
  ].join(" ");

export default function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="text-sm font-semibold tracking-wide text-[color:var(--color-crypt-accent)]">
            Crypt
          </div>
          <nav className="flex flex-wrap gap-1 sm:gap-2">
            <NavLink to="/match" className={linkClass}>
              Match
            </NavLink>
            <NavLink to="/deck" className={linkClass}>
              Deck
            </NavLink>
            <NavLink to="/collection" className={linkClass}>
              Collection
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              Profile
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
