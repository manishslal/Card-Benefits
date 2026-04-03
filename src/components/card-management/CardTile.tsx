/**
 * CardTile Component - Grid View
 *
 * Displays a single card as a tile card in grid layout.
 * Shows card name, status, annual fee, renewal countdown, and quick stats.
 * Responsive design with desktop/tablet/mobile optimizations.
 */

'use client';

import React, { useState } from 'react';
import {
  CardTileProps
} from '@/types/card-management';
import {
  getDaysUntilRenewal,
  getRenewalStatus,
  formatRenewalCountdown,
  getRenewalStatusColor,
  getStatusBadgeColor,
  getStatusLabel,
  formatCurrency,
  formatPercentage
} from '@/lib/card-calculations';
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
 * CardTile Component
 *
 * Props:
 * - card: CardDisplayModel - Card data to display
 * - isSelected: boolean - Whether card is selected for bulk operations
 * - onSelect: Function - Called when checkbox is clicked
 * - onCardClick: Function - Called when card is clicked
 * - onMenuAction: Function - Called with action name and cardId when menu action selected
 *
 * Design:
 * ┌─────────────────────────────┐
 * │ [Logo] Card Name   [⋮]      │
 * │ Status Badge                │
 * │ Annual Fee: $550            │
 * │ Renews in 45 days (yellow)  │
 * │ 7 Benefits | 12.5% ROI      │
 * └─────────────────────────────┘
 */
export function CardTile({
  card,
  isSelected,
  onSelect,
  onCardClick,
  onMenuAction
}: CardTileProps): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const daysUntilRenewal = getDaysUntilRenewal(card.renewalDate);
  const renewalStatus = getRenewalStatus(daysUntilRenewal);
  const renewalCountdown = formatRenewalCountdown(daysUntilRenewal);
  const statusColor = getStatusBadgeColor(card.status);
  const renewalColor = getRenewalStatusColor(renewalStatus);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on menu or checkbox
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
        'group relative overflow-hidden rounded-lg border-2 transition-all duration-200',
        'bg-white dark:bg-gray-900',
        'hover:shadow-lg cursor-pointer',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      )}
      onClick={handleCardClick}
    >
      {/* Gradient accent bar (top) */}
      <div
        className={clsx(
          'h-1 w-full',
          card.status === 'ARCHIVED'
            ? 'bg-gray-300'
            : card.status === 'ACTIVE'
              ? 'bg-green-500'
              : card.status === 'PENDING'
                ? 'bg-blue-500'
                : 'bg-yellow-500'
        )}
      />

      {/* Main content container */}
      <div className="p-4">
        {/* Header row: Logo/Issuer, Card Name, Menu */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex-1">
            {card.cardImageUrl && (
              <img
                src={card.cardImageUrl}
                alt={card.cardName}
                className="mb-2 h-8 w-auto object-contain"
              />
            )}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
              {card.customName || card.cardName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {card.issuer}
            </p>
          </div>

          {/* Menu button */}
          <div className="ml-2" data-menu>
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

        {/* Status badge */}
        <div className="mb-3">
          <span
            className={clsx(
              'inline-block rounded-full px-2 py-1 text-xs font-medium',
              statusColor
            )}
          >
            {getStatusLabel(card.status)}
          </span>
        </div>

        {/* Annual fee row */}
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Annual Fee:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(card.effectiveAnnualFee)}
          </span>
        </div>

        {/* Renewal countdown - color coded */}
        <div className="mb-3">
          <div
            className={clsx(
              'inline-block rounded px-2 py-1 text-xs font-medium',
              renewalColor
            )}
          >
            {renewalCountdown}
          </div>
        </div>

        {/* Stats row: Benefits and ROI */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Benefits
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {card.benefitsCount}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Card ROI
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatPercentage(card.cardROI)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selection checkbox overlay */}
      <div
        className={clsx(
          'absolute left-2 top-2 h-5 w-5 rounded border-2 border-gray-300',
          'bg-white dark:bg-gray-800',
          'transition-all duration-200',
          'opacity-0 group-hover:opacity-100',
          isSelected && 'opacity-100 border-blue-500 bg-blue-500'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(card.id);
        }}
      >
        <input
          type="checkbox"
          className="h-full w-full cursor-pointer accent-blue-500"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(card.id);
          }}
          aria-label={`Select ${card.cardName}`}
        />
      </div>
    </div>
  );
}

export default CardTile;
