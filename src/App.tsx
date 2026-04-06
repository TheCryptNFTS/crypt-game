import { useState, useCallback } from "react";
import type { Screen } from "./types/ui";
import { Navigation } from "./components/layout/Navigation";
import { HomeScreen } from "./components/screens/HomeScreen";
import { CollectionScreen } from "./components/screens/CollectionScreen";
import { DeckBuilderScreen } from "./components/screens/DeckBuilderScreen";
import { MatchScreen } from "./components/screens/MatchScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { CardDetailModal } from "./components/ui/CardDetailModal";
import { getDisplayCardById } from "./lib/cardAdapter";
import type { DisplayCard } from "./types/ui";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleNavigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
  }, []);

  const handleSelectCard = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedCardId(null);
  }, []);

  const selectedCard: DisplayCard | null = selectedCardId 
    ? getDisplayCardById(selectedCardId) 
    : null;

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return <HomeScreen onNavigate={handleNavigate} onSelectCard={handleSelectCard} />;
      case "collection":
        return <CollectionScreen onSelectCard={handleSelectCard} />;
      case "deck-builder":
        return <DeckBuilderScreen onSelectCard={handleSelectCard} />;
      case "match":
        return <MatchScreen onSelectCard={handleSelectCard} />;
      case "profile":
        return <ProfileScreen onNavigate={handleNavigate} />;
      default:
        return <HomeScreen onNavigate={handleNavigate} onSelectCard={handleSelectCard} />;
    }
  };

  return (
    <div className="min-h-screen bg-crypt-bg text-crypt-text">
      <Navigation currentScreen={currentScreen} onNavigate={handleNavigate} />
      
      {renderScreen()}

      <CardDetailModal 
        card={selectedCard} 
        onClose={handleCloseModal}
      />
    </div>
  );
}
