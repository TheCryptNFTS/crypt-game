import type { Screen } from "../../types/ui";

interface NavigationProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: { screen: Screen; label: string; icon: string }[] = [
  { 
    screen: "home", 
    label: "Home",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
  },
  { 
    screen: "collection", 
    label: "Collection",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
  },
  { 
    screen: "deck-builder", 
    label: "Decks",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
  },
  { 
    screen: "match", 
    label: "Battle",
    icon: "M13 10V3L4 14h7v7l9-11h-7z"
  },
  { 
    screen: "profile", 
    label: "Profile",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
  },
];

export function Navigation({ currentScreen, onNavigate }: NavigationProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-crypt-bg/95 backdrop-blur-md border-b border-crypt-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onNavigate("home")}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-crypt-accent to-crypt-gold flex items-center justify-center">
              <span className="font-display font-black text-black text-lg">C</span>
            </div>
            <span className="font-display font-bold text-xl text-crypt-text tracking-wider hidden sm:block">
              CRYPT
            </span>
          </div>

          {/* Nav Items */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.screen}
                onClick={() => onNavigate(item.screen)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                  ${currentScreen === item.screen 
                    ? "bg-crypt-card text-crypt-accent border border-crypt-accent/30" 
                    : "text-crypt-muted hover:text-crypt-text hover:bg-crypt-card/50"
                  }
                `}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className="font-medium hidden md:block">{item.label}</span>
              </button>
            ))}
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-crypt-card border border-crypt-border flex items-center justify-center text-crypt-muted hover:text-crypt-text hover:border-crypt-accent transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-crypt-accent to-crypt-gold flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
              <span className="font-bold text-black text-sm">TC</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
