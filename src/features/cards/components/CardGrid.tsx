'use client';

import Card from './Card';
import type { UserCard } from '@/features/cards/lib/calculations';

interface Player {
  id: string;
  playerName: string;
  userCards: UserCard[];
}

interface CardGridProps {
  cards: UserCard[];
  playerName: string;
}

interface CardGridWithPlayerProps {
  players: Player[];
  selectedPlayerId: string | null;
}

/**
 * Filter cards based on selected player
 */
function getFilteredCards(
  players: Player[],
  selectedPlayerId: string | null
): Array<{ card: UserCard; playerName: string }> {
  const result: Array<{ card: UserCard; playerName: string }> = [];

  for (const player of players) {
    // If a player is selected, only include their cards
    if (selectedPlayerId && player.id !== selectedPlayerId) continue;

    for (const card of player.userCards.filter((c) => c.isOpen)) {
      result.push({ card, playerName: player.playerName });
    }
  }

  return result;
}

/**
 * CardGrid - Simple grid for a set of cards
 */
export function CardGrid({ cards, playerName }: CardGridProps) {
  if (cards.length === 0) {
    return (
      <section className="my-lg md:my-xl">
        <div
          className="p-lg rounded-lg border text-center"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p className="text-body-md">No cards found for {playerName}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="my-lg md:my-xl">
      <div
        className="grid gap-md md:gap-lg grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

/**
 * CardGridWithPlayer - Grid with player filtering
 * Handles tab-based card filtering
 */
export default function CardGridWithPlayer({
  players,
  selectedPlayerId,
}: CardGridWithPlayerProps) {
  const filteredCards = getFilteredCards(players, selectedPlayerId);

  if (filteredCards.length === 0) {
    return (
      <section className="my-lg md:my-xl">
        <div
          className="p-lg rounded-lg border text-center"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p className="text-body-md">
            {selectedPlayerId
              ? 'No cards found for this player'
              : 'No cards available'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="my-lg md:my-xl">
      <div
        className="grid gap-md md:gap-lg grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredCards.map(({ card }) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
