'use client';

/**
 * EditableValueField Component
 *
 * Provides inline editing of benefit values with:
 * - Click-to-edit activation
 * - Auto-save on blur/Enter
 * - Optimistic UI updates
 * - Loading states and error handling
 * - Value validation and warnings
 * - Keyboard navigation and accessibility
 *
 * Implements FR1-FR4 from Custom Values specification
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui/use-toast';
import {
  parseCurrencyInput,
  formatCurrencyDisplay,
  calculateDifference,
  isUnusuallyHigh,
  isUnusuallyLow,
  getUnusuallyHighWarning,
  getUnusuallyLowWarning,
} from '@/lib/custom-values/validation';
import { updateUserDeclaredValue } from '@/actions/custom-values';

interface EditableValueFieldProps {
  benefitId: string;
  currentValue: number; // in cents
  masterValue: number; // in cents
  onSave?: (value: number) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export const EditableValueField = React.forwardRef<
  HTMLDivElement,
  EditableValueFieldProps
>(
  ({ benefitId, currentValue, masterValue, onSave, isLoading = false, disabled = false }, ref) => {
    const { success, error } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(formatDisplayValue(currentValue));
    const [displayValue, setDisplayValue] = useState(currentValue);
    const [isSaving, setIsSaving] = useState(false);
    const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);
    const [validationWarning, setValidationWarning] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingValue, setPendingValue] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Format value for display (in dollars, no currency symbol for input)
    function formatDisplayValue(valueInCents: number): string {
      return (valueInCents / 100).toFixed(2);
    }

    // Handle entering edit mode
    const handleEditClick = useCallback(() => {
      if (disabled || isLoading) return;
      setIsEditing(true);
      setInputValue(formatDisplayValue(displayValue));
      setValidationWarning('');
      // Focus after state update
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }, [disabled, isLoading, displayValue]);

    // Handle input change with validation
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);

        // Try to parse the input
        const parsed = parseCurrencyInput(value);
        if (parsed !== null) {
          // Check for warnings
          if (isUnusuallyHigh(parsed, masterValue)) {
            const warning = getUnusuallyHighWarning(parsed, masterValue);
            setValidationWarning(warning);
          } else if (isUnusuallyLow(parsed, masterValue)) {
            const warning = getUnusuallyLowWarning(parsed, masterValue);
            setValidationWarning(warning);
          } else {
            setValidationWarning('');
          }
        }
      },
      [masterValue]
    );

    // Handle save (with optional confirmation for high values)
    const handleSave = useCallback(async (valueToSave: number) => {
      if (isSaving) return;

      setIsSaving(true);
      loadingTimeoutRef.current = setTimeout(() => {
        setShowLoadingSpinner(true);
      }, 200);

      try {
        // Call server action
        const result = await updateUserDeclaredValue(benefitId, valueToSave);

        if (result.success) {
          // Optimistic update successful
          setDisplayValue(valueToSave);
          setIsEditing(false);
          success('Value updated successfully');

          // Call optional callback
          if (onSave) {
            await onSave(valueToSave);
          }
        } else {
          // Server error
          const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to update value';
          error('Update Failed', errorMsg);
          // Reset to previous value
          setInputValue(formatDisplayValue(displayValue));
        }
      } catch (err) {
        // Network or other error
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        error('Update Failed', errorMsg);
        // Reset to previous value
        setInputValue(formatDisplayValue(displayValue));
      } finally {
        setIsSaving(false);
        setShowLoadingSpinner(false);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      }
    }, [benefitId, displayValue, isSaving, onSave, success, error]);

    // Handle blur or Enter key
    const handleBlurOrEnter = useCallback(async () => {
      if (!isEditing || isSaving) return;

      const parsed = parseCurrencyInput(inputValue);
      if (parsed === null) {
        // Invalid input - revert
        setInputValue(formatDisplayValue(displayValue));
        setIsEditing(false);
        setValidationWarning('');
        error('Invalid Value', 'Please enter a valid amount');
        return;
      }

      // Check if value changed
      if (parsed === displayValue) {
        setIsEditing(false);
        return;
      }

      // Check if we need confirmation
      if (isUnusuallyHigh(parsed, masterValue)) {
        setPendingValue(parsed);
        setShowConfirmDialog(true);
        return;
      }

      // Save directly
      await handleSave(parsed);
    }, [isEditing, isSaving, inputValue, displayValue, masterValue, handleSave, error]);

    // Handle keyboard events
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleBlurOrEnter();
        } else if (e.key === 'Escape') {
          setIsEditing(false);
          setInputValue(formatDisplayValue(displayValue));
          setValidationWarning('');
        }
      },
      [handleBlurOrEnter, displayValue]
    );

    // Calculate difference display
    const diff = calculateDifference(displayValue, masterValue);
    const diffPercent = parseFloat((diff.percent * 100).toFixed(2));

    return (
      <div ref={ref} className="space-y-3">
        {/* Display Mode */}
        {!isEditing ? (
          <div className="space-y-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="font-medium">Current:</span>
                <span className="text-lg font-semibold">{formatCurrencyDisplay(displayValue)}</span>
              </div>
              <div className="flex justify-between items-baseline text-gray-600 dark:text-gray-400">
                <span>Master:</span>
                <span>{formatCurrencyDisplay(masterValue)}</span>
              </div>
              {displayValue !== masterValue && (
                <div
                  className={`flex justify-between items-baseline text-xs ${
                    diffPercent > 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}
                >
                  <span>Difference:</span>
                  <span>
                    {formatCurrencyDisplay(diff.amount)} ({diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleEditClick}
              disabled={disabled || isLoading}
              size="sm"
              variant="outline"
              className="w-full"
              aria-label="Edit benefit value"
            >
              Edit Value
            </Button>
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-2">
            <div className="space-y-1">
              <label htmlFor={`value-input-${benefitId}`} className="text-xs font-medium">
                New Value ($)
              </label>
              <div className="relative">
                <Input
                  ref={inputRef}
                  id={`value-input-${benefitId}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleBlurOrEnter}
                  onKeyDown={handleKeyDown}
                  disabled={isSaving}
                  className="text-base font-mono"
                  aria-label="New benefit value in dollars"
                  aria-describedby={validationWarning ? `warning-${benefitId}` : undefined}
                />
                {showLoadingSpinner && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Validation Warning */}
            {validationWarning && (
              <div id={`warning-${benefitId}`} className="text-xs text-orange-600 p-2 bg-orange-50 rounded">
                ⚠️ {validationWarning}
              </div>
            )}

            {/* Master Value Reminder */}
            <div className="text-xs text-gray-500">
              Master value: {formatCurrencyDisplay(masterValue)}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={async () => await handleBlurOrEnter()}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setInputValue(formatDisplayValue(displayValue));
                  setValidationWarning('');
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for High Values */}
        {showConfirmDialog && pendingValue !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-lg max-w-sm space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Confirm High Value</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {getUnusuallyHighWarning(pendingValue, masterValue)}
                </p>
                <p className="text-sm mt-2">
                  New value: <span className="font-semibold">{formatCurrencyDisplay(pendingValue)}</span>
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setPendingValue(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    setShowConfirmDialog(false);
                    await handleSave(pendingValue);
                    setPendingValue(null);
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

EditableValueField.displayName = 'EditableValueField';
