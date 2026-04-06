/**
 * CardFilterDropdown Component
 * 
 * Renders a dropdown to filter benefits by card.
 * - Displays unique card names from benefits data
 * - Default option: "All Cards" (clears filter)
 * - onChange handler: Updates parent state and URL query param
 * - Dark mode support with Tailwind CSS
 */

'use client';

interface CardFilterDropdownProps {
  cards: Array<{ id: string; cardName: string }>;
  selectedCard: string | null;
  onCardSelect: (cardId: string | null) => void;
  disabled?: boolean;
}

export function CardFilterDropdown({
  cards,
  selectedCard,
  onCardSelect,
  disabled = false,
}: CardFilterDropdownProps) {
  return (
    <select
      value={selectedCard || ''}
      onChange={(e) => onCardSelect(e.target.value || null)}
      disabled={disabled}
      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Filter benefits by card"
    >
      <option value="">All Cards</option>
      {cards.map((card) => (
        <option key={card.id} value={card.id}>
          {card.cardName}
        </option>
      ))}
    </select>
  );
}
