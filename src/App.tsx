import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import MatchPage from "./pages/MatchPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";
import CollectionPage from "./pages/CollectionPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/match" replace />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/deck" element={<DeckBuilderPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
