import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isOnboarded } from "../lib/localProgress";

/**
 * Route guard that keeps the advanced (high-complexity) surfaces — deck forge,
 * full 10k-card collection, Reliquary/shop — out of a brand-new pilot's first
 * run. Reads the localProgress onboarding flags (tutorial complete OR first
 * win). Until then, any attempt to reach a gated route bounces into the forced
 * tutorial, so the first-run surface stays minimal: Play + the tutorial.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  if (!isOnboarded()) {
    return <Navigate to="/tutorial" replace />;
  }
  return <>{children}</>;
}
