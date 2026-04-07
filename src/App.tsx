import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ShellLayout from "./components/layout/ShellLayout";
import SplashLoginPage from "./pages/SplashLoginPage";

const HomePage = lazy(() => import("./pages/HomePage"));
const PlayHubPage = lazy(() => import("./pages/PlayHubPage"));
const MatchPage = lazy(() => import("./pages/MatchPage"));
const MatchResultsPage = lazy(() => import("./pages/MatchResultsPage"));
const DeckBuilderPage = lazy(() => import("./pages/DeckBuilderPage"));
const CollectionPage = lazy(() => import("./pages/CollectionPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const DailyPackPage = lazy(() => import("./pages/DailyPackPage"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashLoginPage />} />
        <Route element={<ShellLayout />}>
          <Route path="home" element={<HomePage />} />
          <Route path="daily-pack" element={<DailyPackPage />} />
          <Route path="play" element={<PlayHubPage />} />
          <Route path="match" element={<MatchPage />} />
          <Route path="match/result" element={<MatchResultsPage />} />
          <Route path="deck" element={<DeckBuilderPage />} />
          <Route path="collection" element={<CollectionPage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
