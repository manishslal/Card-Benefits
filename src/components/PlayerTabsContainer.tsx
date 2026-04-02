'use client';

import { useMemo } from 'react';
import type { Player, UserCard, UserBenefit } from '@prisma/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CardTrackerPanel from './CardTrackerPanel';
import { Users } from 'lucide-react';

/**
 * PlayerTabsContainer Component (Refactored with shadcn Tabs)
 *
 * Premium tab-based navigation using shadcn/ui Tabs component.
 * Displays credit cards grouped by player with an "All Wallet" summary view.
 *
 * Features:
 * 1. shadcn/ui Tabs for premium tab navigation
 * 2. Player names as tab triggers with card count badges
 * 3. "All Wallet" tab to view all cards across players
 * 4. Responsive CSS Grid layout for cards
 * 5. Lucide icons for visual consistency
 *
 * Type Safety:
 * - Uses exact Prisma types imported from @prisma/client
 * - Expects UserCard with masterCard and userBenefits already loaded
 * - No custom type definitions to avoid mismatches
 */

type PlayerWithCards = Player & {
  userCards: (UserCard & {
    masterCard: {
      id: string;
      issuer: string;
      cardName: string;
      defaultAnnualFee: number;
      cardImageUrl: string;
    };
    userBenefits: UserBenefit[];
  })[];
};

interface PlayerTabsContainerProps {
  players: PlayerWithCards[];
}

export default function PlayerTabsContainer({ players }: PlayerTabsContainerProps) {
  // Calculate total cards across all players
  const totalCards = useMemo(
    () => players.reduce((sum, player) => sum + player.userCards.filter(c => c.isOpen).length, 0),
    [players]
  );

  // Default to "all" tab
  const defaultTabValue = 'all-wallet';

  return (
    <Tabs defaultValue={defaultTabValue} className="w-full mt-lg">
      {/* Tab Navigation - Responsive: scroll on mobile, grid on desktop */}
      <TabsList 
        className="w-full h-auto p-1 overflow-x-auto md:overflow-visible flex md:grid md:gap-2"
      >
        {/* "All Wallet" Tab */}
        <TabsTrigger value="all-wallet" className="flex-shrink-0 md:flex-1 gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap">
          <Users className="w-4 h-4" />
          <span>All Wallet</span>
          <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
            {totalCards}
          </span>
        </TabsTrigger>

        {/* Player Tabs */}
        {players.map((player) => {
          const openCards = player.userCards.filter(c => c.isOpen).length;
          return (
            <TabsTrigger 
              key={player.id} 
              value={player.id} 
              className="flex-shrink-0 md:flex-1 gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap"
            >
              <span>{player.playerName}</span>
              <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                {openCards}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* "All Wallet" Content - All cards from all players */}
      <TabsContent value="all-wallet" className="mt-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {players.length === 0 ? (
            <div className="col-span-full text-center py-xl">
              <p style={{ color: 'var(--color-text-secondary)' }}>No cards found</p>
            </div>
          ) : (
            players.map((player) =>
              player.userCards
                .filter(card => card.isOpen)
                .map((card) => (
                  <CardTrackerPanel
                    key={card.id}
                    userCard={card}
                    playerName={player.playerName}
                  />
                ))
            )
          )}
        </div>
      </TabsContent>

      {/* Individual Player Tabs */}
      {players.map((player) => (
        <TabsContent key={player.id} value={player.id} className="mt-md">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {player.userCards.filter(c => c.isOpen).length === 0 ? (
              <div className="col-span-full text-center py-xl">
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {player.playerName} has no active cards
                </p>
              </div>
            ) : (
              player.userCards
                .filter(card => card.isOpen)
                .map((card) => (
                  <CardTrackerPanel
                    key={card.id}
                    userCard={card}
                    playerName={player.playerName}
                  />
                ))
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
