import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import SplashLoginPage from "./pages/SplashLoginPage";
import TutorialPage from "./pages/TutorialPage";
import HomePage from "./pages/HomePage";
import PlayHubPage from "./pages/PlayHubPage";
import LiveCryptMatchPage from "./pages/LiveCryptMatchPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import ProfilePage from "./pages/ProfilePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import SpectatePage from "./pages/SpectatePage";
import DraftPage from "./pages/DraftPage";
import DailyPackPage from "./pages/DailyPackPage";
import MatchResultsPage from "./pages/MatchResultsPage";
import { OnboardingGate } from "./components/OnboardingGate";

/**
 * The app's real router (the previously-missing "app entry"). Splash and the
 * forced tutorial live OUTSIDE the chrome; everything else hangs off the shared
 * AppShell. The newcomer-complexity gate is enforced HERE, at the router level:
 * the advanced surfaces (deck forge, full collection, Reliquary/shop) are wrapped
 * in <OnboardingGate>, which bounces an un-onboarded pilot back into the tutorial.
 * Play + the tutorial are the only surfaces a brand-new player can reach.
 */
export const router = createBrowserRouter([
  { path: "/", element: <SplashLoginPage /> },
  { path: "/tutorial", element: <TutorialPage /> },
  {
    element: <AppShell />,
    children: [
      { path: "/home", element: <HomePage /> },
      { path: "/play", element: <PlayHubPage /> },
      { path: "/match", element: <LiveCryptMatchPage /> },
      { path: "/spectate", element: <SpectatePage /> },
      { path: "/draft", element: <DraftPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/leaderboard", element: <LeaderboardPage /> },
      { path: "/daily-pack", element: <DailyPackPage /> },
      { path: "/match-results", element: <MatchResultsPage /> },

      // Gated advanced surfaces — hidden until the tutorial is done or first win.
      {
        path: "/deck",
        element: (
          <OnboardingGate>
            <DeckBuilderPage />
          </OnboardingGate>
        ),
      },
      {
        path: "/collection",
        element: (
          <OnboardingGate>
            <CollectionPage />
          </OnboardingGate>
        ),
      },
      {
        path: "/shop",
        element: (
          <OnboardingGate>
            <ShopPage />
          </OnboardingGate>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
