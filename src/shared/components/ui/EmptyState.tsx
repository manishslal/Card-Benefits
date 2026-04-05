'use client';

import React from 'react';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * EmptyState Component - When No Content Available
 * 
 * Accessibility Features:
 * - Semantic heading structure
 * - Clear, descriptive text
 * - Accessible action buttons
 * - Proper focus management
 * 
 * Used for:
 * - No cards in dashboard
 * - No benefits on a card
 * - No search results
 * - No notifications
 * - Empty lists/tables
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 md:py-20">
      {/* Icon */}
      {icon && (
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-4 md:mb-6"
          style={{ backgroundColor: 'var(--color-border)' }}
          role="img"
          aria-hidden="true"
        >
          <div className="text-[var(--color-text-secondary)]">
            {icon}
          </div>
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg md:text-xl font-semibold text-[var(--color-text)] mb-2 text-center">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-[var(--color-text-secondary)] text-sm md:text-base max-w-sm text-center mb-6">
          {description}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        {actionLabel && onAction && (
          <Button
            variant="primary"
            onClick={onAction}
            size="md"
          >
            {actionLabel}
          </Button>
        )}

        {secondaryAction && (
          <Button
            variant="outline"
            onClick={secondaryAction.onClick}
            size="md"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
