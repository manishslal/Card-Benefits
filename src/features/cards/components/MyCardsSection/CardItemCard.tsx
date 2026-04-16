'use client';

import React from 'react';
import { CreditCard, Edit2, Trash2 } from 'lucide-react';
import Button from '@/shared/components/ui/button';
import { Card } from './types';

interface CardItemCardProps {
  card: Card;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  isLoading?: boolean;
}

/**
 * CardItemCard Component
 *
 * Displays a single card with edit and delete actions.
 * Features:
 * - Card name and network
 * - Last 4 digits display (masked)
 * - Card type badge
 * - Active/inactive status indicator
 * - Edit and delete action buttons
 * - Responsive design
 * - Dark mode support
 * - Accessibility: keyboard navigation, ARIA labels
 */
export function CardItemCard({
  card,
  onEdit,
  onDelete,
  isLoading = false,
}: CardItemCardProps) {
  return (
    <div
      className="rounded-lg border p-4 transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header with icon and network name */}
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CreditCard
            className="shrink-0"
            size={24}
            style={{ color: 'var(--color-primary)' }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-sm truncate"
              style={{ color: 'var(--color-text)' }}
              title={card.name}
            >
              {card.name}
            </h3>
            <p
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {card.cardNetwork}
            </p>
          </div>
        </div>

        {/* Active status indicator */}
        <div
          className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 shrink-0"
          style={{
            backgroundColor: card.isActive
              ? 'var(--color-success-light)'
              : 'var(--color-gray-100)',
            color: card.isActive
              ? 'var(--color-success-dark)'
              : 'var(--color-text-secondary)',
          }}
        >
          {card.isActive ? 'Active' : 'Inactive'}
        </div>
      </div>

      {/* Card details grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Last 4 Digits */}
        <div>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Last 4
          </p>
          <p
            className="text-sm font-mono"
            style={{ color: 'var(--color-text)' }}
          >
            •••• {card.lastFourDigits}
          </p>
        </div>

        {/* Card Type */}
        <div>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Type
          </p>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text)' }}
          >
            {card.cardType}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onEdit(card)}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2"
          aria-label={`Edit card ${card.name}`}
        >
          <Edit2 size={16} />
          <span>Edit</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onDelete(card)}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2"
          aria-label={`Delete card ${card.name}`}
        >
          <Trash2 size={16} />
          <span>Delete</span>
        </Button>
      </div>
    </div>
  );
}
