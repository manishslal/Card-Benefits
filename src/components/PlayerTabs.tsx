'use client';

import { useState } from 'react';

/**
 * PlayerTabs Component
 * 
 * Tab navigation for filtering cards by household member (player)
 * 
 * Features:
 * - All players displayed as tabs
 * - Active tab: underline (4px) with primary color
 * - Inactive tabs: lighter text color
 * - Keyboard navigation: Arrow keys to switch tabs
 * - Horizontal scroll on mobile if tabs exceed width
 * - Click tab to select and filter cards
 * 
 * Design:
 * - Height: 44px (mobile), 48px (desktop)
 * - Border-bottom: 1px solid border
 * - Tab format: "PlayerName (Count)" or "View All (Total)"
 * - Focus states for accessibility
 */

interface Player {
  id: string;
  playerName: string;
  cardCount: number;
}

interface PlayerTabsProps {
  players: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
}

export default function PlayerTabs({
  players,
  selectedPlayerId,
  onSelectPlayer,
}: PlayerTabsProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Calculate total card count
  const totalCards = players.reduce((sum, p) => sum + p.cardCount, 0);

  /**
   * Handle keyboard navigation
   * Left/Right arrows to switch between tabs
   */
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = index > 0 ? index - 1 : players.length;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = index < players.length ? index + 1 : 0;
    } else {
      return;
    }

    setFocusedIndex(nextIndex);

    // Select the player at the new index (or all if at "View All" position)
    if (nextIndex < players.length) {
      onSelectPlayer(players[nextIndex].id);
    } else {
      onSelectPlayer(null);
    }
  };

  return (
    <div
      className="border-b overflow-x-auto"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        height: 'var(--height-tab-mobile)',
      }}
    >
      <div
        className="flex gap-lg px-md md:px-tablet lg:px-desktop min-w-full"
        role="tablist"
      >
        {/* Individual player tabs */}
        {players.map((player, index) => {
          const isSelected = selectedPlayerId === player.id;
          const isFocused = focusedIndex === index;

          return (
            <button
              key={player.id}
              role="tab"
              aria-selected={isSelected}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => {
                setFocusedIndex(index);
                onSelectPlayer(player.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="flex items-center whitespace-nowrap font-medium transition-colors duration-200 text-body-sm md:text-body-md"
              style={{
                color: isSelected
                  ? 'var(--color-primary-500)'
                  : 'var(--color-text-secondary)',
                borderBottom: isSelected
                  ? '4px solid var(--color-primary-500)'
                  : '4px solid transparent',
                paddingBottom: 'calc(var(--height-tab-mobile) - 4px - 12px)',
              }}
              onFocus={() => setFocusedIndex(index)}
            >
              {player.playerName} <span className="ml-xs opacity-60">({player.cardCount})</span>
            </button>
          );
        })}

        {/* "View All" tab */}
        <button
          role="tab"
          aria-selected={selectedPlayerId === null}
          tabIndex={focusedIndex === players.length ? 0 : -1}
          onClick={() => {
            setFocusedIndex(players.length);
            onSelectPlayer(null);
          }}
          onKeyDown={(e) => handleKeyDown(e, players.length)}
          className="flex items-center whitespace-nowrap font-medium transition-colors duration-200 text-body-sm md:text-body-md ml-lg"
          style={{
            color:
              selectedPlayerId === null
                ? 'var(--color-primary-500)'
                : 'var(--color-text-secondary)',
            borderBottom:
              selectedPlayerId === null
                ? '4px solid var(--color-primary-500)'
                : '4px solid transparent',
            paddingBottom: 'calc(var(--height-tab-mobile) - 4px - 12px)',
          }}
          onFocus={() => setFocusedIndex(players.length)}
        >
          View All <span className="ml-xs opacity-60">({totalCards})</span>
        </button>
      </div>
    </div>
  );
}
