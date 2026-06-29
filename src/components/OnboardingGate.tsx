import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isOnboarded } from "../lib/localProgress";

/**
 * Route guard for the advanced surfaces — deck forge, full 10k-card collection,
 * Reliquary/shop, draft. Reads the localProgress onboarding flags (tutorial
 * complete OR first win).
 *
 * 2026-06-29: previously this SILENTLY redirected an un-onboarded pilot to
 * /tutorial (`<Navigate to="/tutorial">`) — a player who reached a gated URL
 * just got teleported with no explanation. Now it renders a clear interstitial
 * ("Finish the tutorial to unlock X" + Start Tutorial / Back) and stashes the
 * intended destination so the tutorial drops them back where they were headed.
 */

/** Human label for the gated area, derived from the path. */
function areaLabel(pathname: string): string {
  const p = pathname.toLowerCase();
  if (p.startsWith("/collection")) return "the Collection";
  if (p.startsWith("/deck")) return "the Deck forge";
  if (p.startsWith("/market") || p.startsWith("/bazaar")) return "the Bazaar";
  if (p.startsWith("/draft")) return "Sealed runs";
  if (p.startsWith("/vault")) return "the Vault";
  return "this area";
}

export const ONBOARD_RETURN_KEY = "crypt:onboardReturn";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (isOnboarded()) {
    return <>{children}</>;
  }

  const label = areaLabel(location.pathname);

  const startTutorial = () => {
    try {
      sessionStorage.setItem(ONBOARD_RETURN_KEY, location.pathname + location.search);
    } catch {
      /* private mode — return-destination is best-effort */
    }
    navigate("/tutorial");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Finish the tutorial to unlock ${label}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(4,4,6,0.82)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "calc(100% - 40px)",
          padding: "26px 22px",
          borderRadius: 16,
          background: "rgba(11, 11, 13, 0.98)",
          border: "1px solid #C8A75D",
          boxShadow: "0 0 36px rgba(200,167,93,0.4)",
          color: "#F5F2E8",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", color: "#E9C984" }}>
          ⬡ SEALED UNTIL FIRST RUN
        </p>
        <h2 style={{ margin: "10px 0 6px", fontSize: 22 }}>Finish the tutorial</h2>
        <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "#d6d0c2" }}>
          Complete the tutorial to unlock {label}. It takes about a minute and
          teaches the loop.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={startTutorial}
            style={{
              appearance: "none",
              cursor: "pointer",
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(180deg, #C8A75D, #E9C984)",
              color: "#060507",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            Start Tutorial
          </button>
          <button
            type="button"
            onClick={() => navigate("/home")}
            style={{
              appearance: "none",
              cursor: "pointer",
              padding: "11px 16px",
              borderRadius: 12,
              border: "1px solid rgba(200,167,93,0.4)",
              background: "transparent",
              color: "#E9C984",
              fontSize: 14,
              letterSpacing: "0.04em",
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
