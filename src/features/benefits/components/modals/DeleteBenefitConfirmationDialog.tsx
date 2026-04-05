'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/button';
import { FormError } from '@/components/FormError';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * DeleteBenefitConfirmationDialog Component
 * 
 * Shows a confirmation dialog before deleting a benefit
 * 
 * Props:
 * - benefit: UserBenefit object to delete
 * - isOpen: boolean - whether dialog is visible
 * - onClose: () => void - callback when user closes dialog
 * - onConfirm: () => void - callback when user confirms deletion
 */

interface UserBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
}

interface DeleteBenefitConfirmationDialogProps {
  benefit: UserBenefit | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export function DeleteBenefitConfirmationDialog({
  benefit,
  isOpen,
  onClose,
  onConfirm,
}: DeleteBenefitConfirmationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!benefit) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/benefits/${benefit.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete benefit');
        return;
      }

      // Success
      if (onConfirm) {
        onConfirm();
      }
      onClose();
    } catch (err) {
      console.error('Error deleting benefit:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !benefit) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200 p-6 mx-4"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          {/* Header with title and close button */}
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title
              id="delete-benefit-dialog-title"
              className="text-lg font-bold text-[var(--color-text)]"
            >
              Delete Benefit
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors p-2 rounded-md hover:bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <X size={20} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <DialogPrimitive.Description
              id="delete-benefit-dialog-description"
              className="text-sm text-[var(--color-text-secondary)]"
            >
              Are you sure you want to delete <strong className="text-[var(--color-text)]">"{benefit.name}"</strong>?
            </DialogPrimitive.Description>

            {/* Warning message with WCAG AA contrast */}
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-900 dark:text-red-100">
              This action cannot be undone.
            </div>

            {/* Error message with WCAG AA contrast */}
            {error && (
              <FormError message={error} type="error" />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="danger"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading}
                onClick={handleConfirm}
              >
                {isLoading ? 'Deleting...' : 'Delete Benefit'}
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
