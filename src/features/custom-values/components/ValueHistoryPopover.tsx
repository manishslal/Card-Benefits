'use client';

/**
 * ValueHistoryPopover Component
 *
 * Displays a popover showing the change history for a benefit's custom value.
 * Features:
 * - Shows all value changes in reverse chronological order (newest first)
 * - Displays who changed it, when, and what the old/new values were
 * - "Revert to this value" button for each entry
 * - Loading and error states
 * - Keyboard accessible (Escape to close)
 * - Mobile-friendly with proper positioning
 * - Dark mode support
 *
 * Uses Radix UI Popover for accessible popover behavior.
 */

import React, { useState, useCallback } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/components/ui/use-toast';
import { getBenefitValueHistory, revertUserDeclaredValue } from '@/features/custom-values/actions';
import { formatCurrencyDisplay } from '@/lib/custom-values/validation';
import type { BenefitValueChange } from '@/features/custom-values/types';

interface ValueHistoryPopoverProps {
  benefitId: string;
  benefitName: string;
  currentValue: number | null; // in cents
  stickerValue: number; // in cents
  onRevertSuccess?: () => void;
}

export const ValueHistoryPopover: React.FC<ValueHistoryPopoverProps> = ({
  benefitId,
  benefitName,
  currentValue,
  stickerValue,
  onRevertSuccess,
}) => {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<BenefitValueChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revertingIndex, setRevertingIndex] = useState<number | null>(null);

  // Fetch history when popover opens
  const handleOpenChange = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      
      if (isOpen && history.length === 0) {
        setIsLoading(true);
        setLoadError(null);
        
        try {
          const result = await getBenefitValueHistory(benefitId, 20);
          
          if (result.success) {
            setHistory(result.data.history);
          } else {
            setLoadError(result.error || 'Failed to load history');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setLoadError(errorMsg);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [benefitId, history.length]
  );

  // Handle revert to a historical value
  const handleRevert = useCallback(
    async (historyIndex: number) => {
      if (revertingIndex !== null) return; // Prevent multiple concurrent reverts

      setRevertingIndex(historyIndex);
      
      try {
        const result = await revertUserDeclaredValue(benefitId, historyIndex);
        
        if (result.success) {
          success(`Reverted to ${formatCurrencyDisplay(result.data.valueAfter)}`);
          // Refresh history after revert
          setHistory([]);
          // Call callback if provided
          if (onRevertSuccess) {
            onRevertSuccess();
          }
          // Close popover
          setOpen(false);
        } else {
          error('Revert Failed', result.error || 'Failed to revert value');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        error('Revert Failed', errorMsg);
      } finally {
        setRevertingIndex(null);
      }
    },
    [benefitId, revertingIndex, success, error, onRevertSuccess]
  );

  // Format a date for display
  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {/* Trigger Button - History Icon */}
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={`View value history for ${benefitName}`}
          title="View value change history"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </Button>
      </PopoverPrimitive.Trigger>

      {/* Popover Content */}
      <PopoverPrimitive.Content
        className="z-50 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-slate-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        sideOffset={4}
        align="end"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Value History
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {benefitName}
            </span>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                Loading history...
              </span>
            </div>
          )}

          {/* Error State */}
          {!isLoading && loadError && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {loadError}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !loadError && history.length === 0 && (
            <div className="rounded-md bg-gray-50 p-3 text-center text-xs text-gray-600 dark:bg-slate-800 dark:text-gray-400">
              No change history for this benefit
            </div>
          )}

          {/* History List */}
          {!isLoading && !loadError && history.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {history.map((entry, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-slate-800"
                >
                  {/* Value and Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 text-xs">
                      <div className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrencyDisplay(entry.value)}
                      </div>
                      <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                        {formatDate(entry.changedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Source and Reason */}
                  {(entry.source !== 'manual' || entry.reason) && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.source !== 'manual' && (
                        <span className="inline-block rounded bg-gray-200 px-1.5 py-0.5 dark:bg-slate-700">
                          {entry.source}
                        </span>
                      )}
                      {entry.reason && (
                        <p className="mt-1 italic">{entry.reason}</p>
                      )}
                    </div>
                  )}

                  {/* Revert Button */}
                  {index !== 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => handleRevert(index)}
                      disabled={revertingIndex !== null}
                      aria-label={`Revert to ${formatCurrencyDisplay(entry.value)}`}
                    >
                      {revertingIndex === index ? 'Reverting...' : 'Revert to this'}
                    </Button>
                  )}

                  {/* Current Value Indicator */}
                  {index === 0 && currentValue === entry.value && (
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      ✓ Current value
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Master Value Indicator */}
          {!isLoading && !loadError && (
            <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Master value:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrencyDisplay(stickerValue)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Popover Arrow */}
        <PopoverPrimitive.Arrow
          className="fill-white dark:fill-slate-900"
          width={12}
          height={6}
        />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
};

ValueHistoryPopover.displayName = 'ValueHistoryPopover';
