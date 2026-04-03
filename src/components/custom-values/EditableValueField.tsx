/**
 * src/components/custom-values/EditableValueField.tsx
 *
 * Inline editable field for benefit values.
 * Supports click-to-edit, client-side validation, auto-save on blur/Enter,
 * loading states, and error recovery with full accessibility support.
 *
 * Design:
 * - Display mode: Shows effective value with formatting
 * - Edit mode: Input field with numeric validation
 * - Auto-save: Debounced 500ms after last keystroke
 * - Spinner: Shows after 200ms if save still in progress
 * - Accessibility: Full keyboard navigation, screen reader support, ARIA labels
 * - Mobile: Touch-friendly with numeric keyboard (input type="number")
 * - Error recovery: Reverts to previous value on save failure
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatCurrencyDisplay, parseCurrencyInput } from '@/lib/custom-values/validation';
import type { EditableValueFieldProps } from '@/lib/types/custom-values';

/**
 * EditableValueField Component
 * Provides inline editing of benefit values with auto-save
 */
export const EditableValueField = React.forwardRef<HTMLDivElement, EditableValueFieldProps>(
  (
    {
      benefitId,
      stickerValue,
      currentValue,
      onSave,
      onError,
      disabled = false,
      showPresets = false,
      presetOptions = [],
    },
    ref,
  ) => {
    // ──────────────────────────────────────────────────────────────────────────
    // State Management
    // ──────────────────────────────────────────────────────────────────────────

    const [isEditing, setIsEditing] = useState(false);
    const [pendingValue, setPendingValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showSpinner, setShowSpinner] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [previousValue, setPreviousValue] = useState<number | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const spinnerTimerRef = useRef<NodeJS.Timeout | null>(null);
    const saveAbortRef = useRef<AbortController | null>(null);

    // Display value (current or sticker if no current)
    const effectiveValue = currentValue ?? stickerValue;
    const displayValue = formatCurrencyDisplay(effectiveValue);

    // ──────────────────────────────────────────────────────────────────────────
    // Cleanup Effects
    // ──────────────────────────────────────────────────────────────────────────

    // Clean up timers on unmount
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      };
    }, []);

    // ──────────────────────────────────────────────────────────────────────────
    // Event Handlers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Activate edit mode and select input text
     */
    const handleActivateEdit = useCallback(() => {
      if (disabled || isEditing) return;

      setIsEditing(true);
      setPendingValue(formatCurrencyDisplay(effectiveValue).replace(/[^\d.]/g, ''));
      setSaveError(null);
      setValidationError(null);
      setPreviousValue(effectiveValue);

      // Focus and select input after state update
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }, [disabled, isEditing, effectiveValue]);

    /**
     * Cancel editing and revert to previous value
     */
    const handleCancel = useCallback(() => {
      setIsEditing(false);
      setPendingValue('');
      setValidationError(null);
      setSaveError(null);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }, []);

    /**
     * Handle input change with client-side validation
     */
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setPendingValue(input);

        // Parse and validate
        const parsed = parseCurrencyInput(input);
        if (input && parsed === null) {
          setValidationError('Please enter a valid dollar amount');
        } else {
          setValidationError(null);
        }

        // Clear previous save error when user types
        setSaveError(null);

        // Debounce auto-save (only if valid input)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        if (input && parsed !== null) {
          debounceTimerRef.current = setTimeout(() => {
            handleSave(parsed);
          }, 500); // Debounce 500ms
        }
      },
      [],
    );

    /**
     * Save the value to server
     */
    const handleSave = useCallback(
      async (valueToSave: number) => {
        // Validate before saving
        if (valueToSave === effectiveValue) {
          // No change, just close edit mode
          setIsEditing(false);
          return;
        }

        setIsSaving(true);
        setPreviousValue(effectiveValue);

        // Show spinner after 200ms
        spinnerTimerRef.current = setTimeout(() => {
          setShowSpinner(true);
        }, 200);

        try {
          await onSave(valueToSave);

          // Success
          setIsEditing(false);
          setPendingValue('');
          setValidationError(null);
          setSaveError(null);
        } catch (error) {
          // Error: revert to previous value
          setSaveError(error instanceof Error ? error.message : 'Failed to save');
          if (onError) {
            onError(error instanceof Error ? error.message : 'Failed to save');
          }
          // Value reverts to display automatically
        } finally {
          setIsSaving(false);
          setShowSpinner(false);
          if (spinnerTimerRef.current) {
            clearTimeout(spinnerTimerRef.current);
          }
        }
      },
      [effectiveValue, onSave, onError],
    );

    /**
     * Handle keyboard shortcuts
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const parsed = parseCurrencyInput(pendingValue);
          if (parsed !== null) {
            handleSave(parsed);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      },
      [pendingValue, handleSave, handleCancel],
    );

    /**
     * Handle blur (save if valid)
     */
    const handleBlur = useCallback(() => {
      if (validationError || !pendingValue) {
        handleCancel();
        return;
      }

      const parsed = parseCurrencyInput(pendingValue);
      if (parsed !== null) {
        // Save is already debounced, but clear timer and save immediately on blur
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        handleSave(parsed);
      } else {
        handleCancel();
      }
    }, [validationError, pendingValue, handleCancel, handleSave]);

    // ──────────────────────────────────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────────────────────────────────

    if (isEditing) {
      return (
        <div
          ref={ref}
          className="relative inline-flex items-center gap-2"
          role="region"
          aria-label="Edit benefit value"
        >
          {/* Input field */}
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            placeholder={displayValue}
            value={pendingValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isSaving || disabled}
            aria-label={`Edit benefit value (current: ${displayValue})`}
            aria-invalid={validationError ? 'true' : 'false'}
            aria-describedby={validationError ? 'value-error' : undefined}
            className={`
              flex-1 px-3 py-2 text-sm
              border-2 rounded-md
              font-mono text-right
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                validationError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-blue-500 focus:ring-blue-500'
              }
            `}
            step="0.01"
            min="0"
            max="9999999.99"
          />

          {/* Spinner indicator */}
          {isSaving && showSpinner && (
            <div
              className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Saving..."
            />
          )}

          {/* Validation error message */}
          {validationError && (
            <div
              id="value-error"
              className="absolute -bottom-6 left-0 text-xs text-red-500 whitespace-nowrap"
              role="alert"
            >
              {validationError}
            </div>
          )}

          {/* Save error message */}
          {saveError && (
            <div
              className="absolute -bottom-6 left-0 text-xs text-red-500 whitespace-nowrap"
              role="alert"
            >
              {saveError}
            </div>
          )}
        </div>
      );
    }

    // Display mode
    return (
      <div
        ref={ref}
        className="inline-flex items-center gap-3"
        onClick={handleActivateEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivateEdit();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${displayValue}, click to edit`}
        className={`
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-100'}
          px-3 py-2 rounded-md transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        `}
      >
        <span className="text-sm font-semibold text-gray-900">{displayValue}</span>
        {currentValue && currentValue !== stickerValue && (
          <span className="text-xs text-gray-500">(your value)</span>
        )}
        {(!currentValue || currentValue === stickerValue) && (
          <span className="text-xs text-gray-400">(master value)</span>
        )}

        {!disabled && (
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        )}
      </div>
    );
  },
);

EditableValueField.displayName = 'EditableValueField';

export default EditableValueField;
