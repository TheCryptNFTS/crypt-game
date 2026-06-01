import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import CryptRouteFallback from "./components/CryptRouteFallback";
import { OnboardingGate } from "./components/OnboardingGate";

// Splash is the critical first-paint surface — keep it eager so the entry
// chunk can render instantly. Everything else is route-level code-split via
// React.lazy() so `vite build` emits a chunk per page instead of one 34MB
// monolith. The AppShell already wraps its <Outlet/> in <Suspense>; the two
// chrome-less routes (/, /tutorial, /onboarding) get their own Suspense boundary.
import SplashLoginPage from "./pages/SplashLoginPage";

const TutorialPage = lazy(() => import("./pages/TutorialPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const PlayHubPage = lazy(() => import("./pages/PlayHubPage"));
const PuzzlePage = lazy(() => import("./pages/PuzzlePage"));
const LiveCryptMatchPage = lazy(() => import("./pages/LiveCryptMatchPage"));
const DeckBuilderPage = lazy(() => import("./pages/DeckBuilderPage"));
const CollectionPage = lazy(() => import("./pages/CollectionPage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const RankLadderPage = lazy(() => import("./pages/RankLadderPage"));
const SpectatePage = lazy(() => import("./pages/SpectatePage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const DailyPackPage = lazy(() => import("./pages/DailyPackPage"));
const MatchResultsPage = lazy(() => import("./pages/MatchResultsPage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const RewardsPage = lazy(() => import("./pages/RewardsPage"));

const tutorialElement = (
  <Suspense fallback={<CryptRouteFallback />}>
    <TutorialPage />
  </Suspense>
);
const onboardingElement = (
  <Suspense fallback={<CryptRouteFallback />}>
    <OnboardingPage />
  </Suspense>
);

/**
 * The app's real router (the previously-missing "app entry"). Splash, onboarding,
 * and the forced tutorial live OUTSIDE the chrome; everything else hangs off the
 * shared AppShell. The newcomer-complexity gate is enforced HERE, at the router
 * level: the advanced surfaces (deck forge, full collection, Reliquary/shop,
 * marketplace) are wrapped in <OnboardingGate>, which bounces an un-onboarded
 * pilot back into the tutorial. Play + the tutorial are the only surfaces a
 * brand-new player can reach.
 */
export const router = createBrowserRouter([
  { path: "/", element: <SplashLoginPage /> },
  { path: "/onboarding", element: onboardingElement },
  { path: "/tutorial", element: tutorialElement },
  {
    element: <AppShell />,
    children: [
      { path: "/home", element: <HomePage /> },
      { path: "/play", element: <PlayHubPage /> },
      // Solo puzzle / practice mode — ungated like /play (no opponent, no chain).
      { path: "/puzzles", element: <PuzzlePage /> },
      { path: "/match", element: <LiveCryptMatchPage /> },
      { path: "/spectate", element: <SpectatePage /> },
      { path: "/draft", element: <DraftPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/friends", element: <FriendsPage /> },
      { path: "/leaderboard", element: <LeaderboardPage /> },
      { path: "/ladder", element: <RankLadderPage /> },
      { path: "/daily-pack", element: <DailyPackPage /> },
      { path: "/match-results", element: <MatchResultsPage /> },
      { path: "/rewards", element: <RewardsPage /> },

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
      {
        path: "/market",
        element: (
          <OnboardingGate>
            <MarketplacePage />
          </OnboardingGate>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
