'use client';

/**
 * BulkValueEditor Component
 *
 * Allows batch editing of multiple benefit values at once.
 * Features:
 * - Multi-select checkboxes for benefits to edit
 * - Single input field to apply value to all selected benefits
 * - Apply/Cancel buttons
 * - Loading states and error handling
 * - Responsive design (mobile: stacked, tablet/desktop: side-by-side)
 * - Dark mode support
 * - Atomic save: all succeed or all fail (no partial updates)
 * - WCAG 2.1 AA accessibility
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { useToast } from '@/shared/components/ui/use-toast';
import { bulkUpdateUserDeclaredValues } from '@/features/custom-values/actions';
import {
  parseCurrencyInput,
  formatCurrencyDisplay,
} from '@/lib/custom-values/validation';
import type { BenefitForBulkEdit } from '@/features/custom-values/types';

interface BulkValueEditorProps {
  selectedBenefits: BenefitForBulkEdit[];
  onApply: (updates: Array<{ benefitId: string; valueInCents: number }>) => Promise<void>;
  onCancel: () => void;
}

export const BulkValueEditor = React.forwardRef<HTMLDivElement, BulkValueEditorProps>(
  ({ selectedBenefits, onApply, onCancel }, ref) => {
    const { success, error } = useToast();
    const [bulkValue, setBulkValue] = useState('');
    const [selectedBenefitIds, setSelectedBenefitIds] = useState<Set<string>>(
      new Set(selectedBenefits.map((b) => b.id))
    );
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState('');

    // Count selected benefits
    const selectedCount = selectedBenefitIds.size;

    // Validate bulk value input
    const handleBulkValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setBulkValue(e.target.value);
      setValidationError('');
    }, []);

    // Toggle benefit selection
    const toggleBenefit = useCallback((benefitId: string) => {
      setSelectedBenefitIds((prev) => {
        const next = new Set(prev);
        if (next.has(benefitId)) {
          next.delete(benefitId);
        } else {
          next.add(benefitId);
        }
        return next;
      });
    }, []);

    // Toggle all benefits
    const toggleAll = useCallback(() => {
      if (selectedBenefitIds.size === selectedBenefits.length) {
        setSelectedBenefitIds(new Set());
      } else {
        setSelectedBenefitIds(new Set(selectedBenefits.map((b) => b.id)));
      }
    }, [selectedBenefits, selectedBenefitIds]);

    // Handle apply
    const handleApply = useCallback(async () => {
      if (selectedCount === 0) {
        setValidationError('Please select at least one benefit');
        return;
      }

      const parsed = parseCurrencyInput(bulkValue);
      if (parsed === null) {
        setValidationError('Please enter a valid amount');
        return;
      }

      setIsSaving(true);
      setValidationError('');

      try {
        const updates = Array.from(selectedBenefitIds).map((benefitId) => ({
          benefitId,
          valueInCents: parsed,
        }));

        await bulkUpdateUserDeclaredValues(updates);
        success(`Updated ${selectedCount} benefit${selectedCount !== 1 ? 's' : ''}`);
        await onApply(updates);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update benefits';
        error('Update Failed', errorMsg);
      } finally {
        setIsSaving(false);
      }
    }, [selectedCount, selectedBenefitIds, bulkValue, onApply, success, error]);

    // Get selected benefits info
    const selectedBenefitsInfo = useMemo(() => {
      return selectedBenefits.filter((b) => selectedBenefitIds.has(b.id));
    }, [selectedBenefits, selectedBenefitIds]);

    return (
      <div
        ref={ref}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-900"
      >
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Bulk Update Benefits
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select benefits and apply a single value to all selected items
          </p>
        </div>

        {/* Benefits Selection Table */}
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                    checked={selectedCount === selectedBenefits.length && selectedBenefits.length > 0}
                    onChange={toggleAll}
                    aria-label="Select all benefits"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-gray-100">
                  Benefit
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                  Current Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {selectedBenefits.map((benefit) => (
                <tr
                  key={benefit.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                      checked={selectedBenefitIds.has(benefit.id)}
                      onChange={() => toggleBenefit(benefit.id)}
                      aria-label={`Select ${benefit.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {benefit.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Master: {formatCurrencyDisplay(benefit.stickerValue)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {benefit.currentValue !== null
                        ? formatCurrencyDisplay(benefit.currentValue)
                        : formatCurrencyDisplay(benefit.stickerValue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Count */}
        {selectedCount > 0 && (
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            {selectedCount} benefit{selectedCount !== 1 ? 's' : ''} selected
            {selectedBenefitsInfo.length > 0 && (
              <div className="mt-1 text-xs">
                {selectedBenefitsInfo.map((b) => b.name).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Bulk Value Input */}
        <div className="space-y-2">
          <label htmlFor="bulk-value" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Value to Apply to Selected
          </label>
          <Input
            id="bulk-value"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={bulkValue}
            onChange={handleBulkValueChange}
            disabled={selectedCount === 0 || isSaving}
            className="text-base font-mono"
            aria-label="Value to apply to all selected benefits"
            aria-describedby={validationError ? 'bulk-error' : undefined}
          />
          {validationError && (
            <div id="bulk-error" className="text-xs text-red-600 dark:text-red-400">
              {validationError}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleApply}
            disabled={selectedCount === 0 || isSaving}
            className="flex-1"
          >
            {isSaving ? 'Applying...' : `Apply to ${selectedCount}`}
          </Button>
          <Button
            onClick={onCancel}
            disabled={isSaving}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }
);

BulkValueEditor.displayName = 'BulkValueEditor';
