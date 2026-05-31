import React from "react";
import { AppSection } from "../../app-state/useGameAppState";

type Props = {
  current: AppSection;
  items: { id: AppSection; label: string }[];
  onNavigate: (section: AppSection) => void;
};

const ICONS: Record<AppSection, string> = {
  home: "◆",
  play: "▲",
  collection: "◈",
  shop: "⬢",
  progression: "✦",
  profile: "◉",
};

export function AppSidebar({ current, items, onNavigate }: Props) {
  return (
    <aside className="app-sidebar app-sidebar--vault">
      <div className="app-sidebar__brand-block">
        <div className="app-sidebar__brand-logo-wrap">
          <img
            src="/brand/crypt-icon-gold.png"
            alt="Crypt icon"
            className="app-sidebar__brand-icon"
          />
          <img
            src="/brand/crypt-logo-primary.png"
            alt="Crypt"
            className="app-sidebar__brand-logo"
          />
        </div>

        <div className="app-sidebar__brand-copy">
          <div className="app-sidebar__eyebrow">Vault Access</div>
          <p className="app-sidebar__sub">
            Build power. Earn status. Secure relics.
          </p>
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`app-sidebar__nav-item ${current === item.id ? "is-active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="app-sidebar__nav-icon">{ICONS[item.id]}</span>
            <span className="app-sidebar__nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__footer-card">
          <span className="app-sidebar__footer-k">Season</span>
          <strong className="app-sidebar__footer-v">Ashfall // Phase I</strong>
        </div>
        <div className="app-sidebar__footer-card">
          <span className="app-sidebar__footer-k">Brand</span>
          <strong className="app-sidebar__footer-v">Prestige / Relic / Ritual</strong>
        </div>
      </div>
    </aside>
  );
}
