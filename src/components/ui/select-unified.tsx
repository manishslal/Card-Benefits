'use client';

import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Unified Select Component - Consistent Across App
 * 
 * Built on Radix UI Select primitives for:
 * - Keyboard navigation (arrow keys, Enter, Escape, Typeahead)
 * - Screen reader support (ARIA roles and labels)
 * - Mobile-friendly (touch support)
 * - Customizable styling (Design system colors)
 * 
 * Accessibility Features:
 * - aria-label or aria-labelledby for context
 * - aria-invalid and aria-describedby for errors
 * - aria-required for required fields
 * - Proper ARIA roles for dropdown
 * - Keyboard navigation: Up/Down arrows, Enter, Escape
 * - Typeahead search support
 * - Focus management
 */

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface UnifiedSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  id?: string;
  name?: string;
}

/**
 * SelectContent Wrapper
 */
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md bg-[var(--color-bg)] text-[var(--color-text)] shadow-md border border-[var(--color-border)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-2 data-[state=open]:slide-in-from-left-2 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
        className
      )}
      {...props}
    />
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

/**
 * SelectItem Component - Individual Select Option
 */
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-8 text-sm outline-none focus:bg-[var(--color-bg-secondary)] focus:text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

/**
 * Main UnifiedSelect Component
 */
const UnifiedSelect = React.forwardRef<HTMLButtonElement, UnifiedSelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option...',
      label,
      hint,
      error,
      required = false,
      disabled = false,
      id,
      name,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    const labelId = `${selectId}-label`;

    const ariaDescribedBy = [
      error ? errorId : '',
      hint && !error ? hintId : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            id={labelId}
            htmlFor={selectId}
            className="block text-sm font-semibold mb-2 text-[var(--color-text)]"
          >
            {label}
            {required && <span className="text-[var(--color-error)]" aria-label="required"> *</span>}
          </label>
        )}

        <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
          <SelectPrimitive.Trigger
            ref={ref}
            id={selectId}
            name={name}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={ariaDescribedBy}
            aria-labelledby={labelId}
            className={cn(
              'flex items-center justify-between w-full px-4 py-3 rounded-md border-2 font-primary text-left',
              'bg-[var(--color-bg)] text-[var(--color-text)]',
              'border-[var(--color-border)] transition-all duration-200',
              'placeholder:text-[var(--color-text-secondary)]',
              'focus:outline-none focus:border-[var(--color-primary)]',
              'focus:shadow-[0_0_0_4px_rgba(51,86,208,0.1)] focus:ring-3 focus:ring-[var(--color-primary)]/10',
              'disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50',
              error && '!border-[var(--color-error)] !shadow-[0_0_0_4px_rgba(239,68,68,0.1)]'
            )}
            {...props}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)] opacity-50" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectContent>
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPrimitive.Viewport>
          </SelectContent>
        </SelectPrimitive.Root>

        {/* Error Message */}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--color-error)] mt-2 flex items-center gap-1"
          >
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        {/* Hint Text */}
        {!error && hint && (
          <p id={hintId} className="text-xs text-[var(--color-text-secondary)] mt-2">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

UnifiedSelect.displayName = 'UnifiedSelect';

export {
  UnifiedSelect,
  SelectContent,
  SelectItem,
  SelectPrimitive,
};
