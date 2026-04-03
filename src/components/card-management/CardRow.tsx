/**
 * CardRow Component - List View
 *
 * Displays a single card as a table row with sortable columns.
 * Shows: Name, Issuer, Annual Fee, Renewal, Status, Benefits, ROI
 * Includes inline action buttons and checkboxes for bulk selection.
 */

'use client';

import React, { useState } from 'react';
import {
  CardRowProps
} from '@/types/card-management';
import {
  getDaysUntilRenewal,
  getRenewalStatus,
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
import { Edit2, Archive, MoreVertical, Trash2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * CardRow Component
 *
 * Renders a table row for card display with all essential information
 * and action buttons for quick operations
 */
export function CardRow({
  card,
  isSelected,
  onSelect,
  onCardClick,
  onAction
}: CardRowProps): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const daysUntilRenewal = getDaysUntilRenewal(card.renewalDate);
  const renewalStatus = getRenewalStatus(daysUntilRenewal);
  const statusColor = getStatusBadgeColor(card.status);
  const renewalColor = getRenewalStatusColor(renewalStatus);

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    if ((e.target as HTMLElement).closest('[data-interactive]') ||
        (e.target as HTMLElement).closest('input[type="checkbox"]') ||
        (e.target as HTMLElement).closest('button')) {
      return;
    }
    onCardClick(card);
  };

  const handleAction = (action: string) => {
    onAction(action, card.id);
    setIsMenuOpen(false);
  };

  return (
    <tr
      className={clsx(
        'border-b transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
        isSelected && 'bg-blue-50 dark:bg-blue-900/20',
        card.status === 'ARCHIVED' && 'opacity-60'
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      <td className="w-12 px-4 py-3" data-interactive>
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
      </td>

      {/* Card Name + Custom Name */}
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {card.customName || card.cardName}
          </p>
          {card.customName && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {card.cardName}
            </p>
          )}
        </div>
      </td>

      {/* Issuer */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {card.issuer}
      </td>

      {/* Annual Fee */}
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
        {formatCurrency(card.effectiveAnnualFee)}
      </td>

      {/* Renewal */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {card.renewalDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}
          </span>
          <span
            className={clsx(
              'inline-block w-fit rounded px-2 py-0.5 text-xs font-medium',
              renewalColor
            )}
          >
            {daysUntilRenewal > 0 ? `${daysUntilRenewal}d` : 'Overdue'}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={clsx(
            'inline-block rounded-full px-2 py-1 text-xs font-medium',
            statusColor
          )}
        >
          {getStatusLabel(card.status)}
        </span>
      </td>

      {/* Benefits Count */}
      <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
        {card.benefitsCount}
      </td>

      {/* Card ROI */}
      <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
        {formatPercentage(card.cardROI)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3" data-interactive>
        <div className="flex items-center gap-1">
          {/* Quick action buttons */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => handleAction('edit')}
            title="Edit card"
          >
            <Edit2 className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() =>
              handleAction(card.status === 'ARCHIVED' ? 'unarchive' : 'archive')
            }
            title={card.status === 'ARCHIVED' ? 'Unarchive card' : 'Archive card'}
          >
            <Archive className="h-4 w-4" />
          </Button>

          {/* More menu */}
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
                onClick={() => handleAction('view')}
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleAction('delete')}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

export default CardRow;
