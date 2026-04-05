/**
 * CardCompactView Component - Minimal Card View
 *
 * Displays a minimal card representation for space-constrained layouts.
 * Shows only: Name, Annual Fee, Status Badge
 * Maintains full functionality via menu button.
 */

'use client';

import React, { useState } from 'react';
import { CardTileProps } from '@/features/cards/types';
import {
  getStatusBadgeColor,
  getStatusLabel,
  formatCurrency
} from '@/features/cards/lib/calculations';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import clsx from 'clsx';

/**
 * CardCompactView Component
 *
 * Minimal representation of a card showing only essential information.
 * Used in space-constrained layouts (sidebars, mobile, etc).
 */
export function CardCompactView({
  card,
  isSelected,
  onSelect,
  onCardClick,
  onMenuAction
}: CardTileProps): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const statusColor = getStatusBadgeColor(card.status);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-menu]') ||
        (e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    onCardClick(card);
  };

  const handleMenuAction = (action: string) => {
    onMenuAction(action, card.id);
    setIsMenuOpen(false);
  };

  return (
    <div
      className={clsx(
        'group relative flex items-center gap-3 rounded-lg border px-3 py-2',
        'transition-all duration-200 cursor-pointer',
        'bg-white dark:bg-gray-900',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      )}
      onClick={handleCardClick}
    >
      {/* Selection checkbox */}
      <input
        type="checkbox"
        className="h-4 w-4 rounded accent-blue-500 cursor-pointer"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(card.id);
        }}
        aria-label={`Select ${card.cardName}`}
      />

      {/* Card name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {card.customName || card.cardName}
        </p>
      </div>

      {/* Annual fee badge */}
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {formatCurrency(card.effectiveAnnualFee)}
      </div>

      {/* Status badge */}
      <span
        className={clsx(
          'inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap',
          statusColor
        )}
      >
        {getStatusLabel(card.status)}
      </span>

      {/* Menu button */}
      <div className="ml-1" data-menu>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleMenuAction('view')}
            >
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleMenuAction('edit')}
            >
              Edit Card
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {card.status !== 'ARCHIVED' ? (
              <DropdownMenuItem
                onClick={() => handleMenuAction('archive')}
              >
                Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleMenuAction('unarchive')}
              >
                Unarchive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => handleMenuAction('delete')}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default CardCompactView;
