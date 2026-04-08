'use client';

import React, { useState } from 'react';
import Button from '@/shared/components/ui/button';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircle, X } from 'lucide-react';
import { Card } from './types';

interface CardDeleteConfirmationProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * CardDeleteConfirmation Component
 *
 * Confirmation dialog for deleting a card.
 * Features:
 * - Clear warning message with card name
 * - Destructive action button styling
 * - Loading state during deletion
 * - Error handling
 * - Accessibility: focus management, ARIA labels
 * - Matches DeleteBenefitConfirmationDialog pattern
 */
export function CardDeleteConfirmation({
  card,
  isOpen,
  onClose,
  onConfirm,
}: CardDeleteConfirmationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!card) return;

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Error deleting card:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to delete card. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !card) return null;

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />

        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 border"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Close button */}
          <div className="absolute top-4 right-4">
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="p-2 rounded-md transition-colors focus:outline-none focus:ring-2"
                style={{
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={24} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Header with icon */}
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle
              size={24}
              style={{ color: 'var(--color-error)' }}
              aria-hidden="true"
            />
            <DialogPrimitive.Title
              className="text-xl font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              Delete Card
            </DialogPrimitive.Title>
          </div>

          {/* Description */}
          <DialogPrimitive.Description
            className="text-sm mb-6"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Are you sure you want to delete <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{card.name}</span>? This action cannot be undone.
          </DialogPrimitive.Description>

          {/* Additional info */}
          <p
            className="text-xs mb-6 p-3 rounded-md"
            style={{
              backgroundColor: 'var(--color-warning-light)',
              color: 'var(--color-warning-dark)',
            }}
          >
            This will remove the card from your account but won't affect existing benefits.
          </p>

          {/* Error message */}
          {error && (
            <p
              className="text-sm mb-4 p-3 rounded-md"
              style={{
                backgroundColor: 'var(--color-error-light)',
                color: 'var(--color-error)',
              }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
