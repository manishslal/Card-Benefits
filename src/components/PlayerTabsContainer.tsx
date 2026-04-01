'use client';

import { useState } from 'react';
import PlayerTabs from './PlayerTabs';
import CardGridWithPlayer from './CardGrid';

/**
 * PlayerTabsContainer Component
 * 
 * Container component that manages the state for:
 * 1. PlayerTabs - Tab navigation for filtering
 * 2. CardGridWithPlayer - Responsive card grid filtered by selected player
 * 
 * This component handles the coordinated state between tab selection
 * and card grid filtering.
 */

interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string; // Can be 'StatementCredit' | 'UsagePerk'
  resetCadence: string;
  timesUsed: number;
}

interface MasterCard {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
}

interface UserCard {
  id: string;
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date;
  isOpen: boolean;
  masterCard: MasterCard;
  userBenefits: UserBenefit[];
}

interface Player {
  id: string;
  playerName: string;
  isActive: boolean;
  userCards: UserCard[];
}

interface PlayerTabsContainerProps {
  players: Player[];
}

export default function PlayerTabsContainer({ players }: PlayerTabsContainerProps) {
  // Track which player is selected (null = "View All")
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Convert players to tab format with card counts
  const playerTabs = players.map((player) => ({
    id: player.id,
    playerName: player.playerName,
    cardCount: player.userCards.filter((c) => c.isOpen).length,
  }));

  return (
    <>
      {/* Player Tabs */}
      <PlayerTabs
        players={playerTabs}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
      />

      {/* Card Grid (filtered by selected player) */}
      <CardGridWithPlayer
        players={players}
        selectedPlayerId={selectedPlayerId}
      />
    </>
  );
}
