'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
}

/**
 * Input Component - Design System Implementation
 * Includes label, hint text, error states, and icons
 * 
 * Hydration-Safe: Uses stable IDs (passed via id prop) instead of Math.random()
 * to prevent server/client mismatch. Status icons and messages only render after mount.
 * 
 * Accessibility Features:
 * - Associated label with htmlFor
 * - aria-required for required fields
 * - aria-describedby for errors and hints
 * - role="alert" on error messages
 * - Error icon for color-independent status
 * - Success icon for color-independent status
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      hint,
      error,
      success = false,
      icon,
      disabled,
      id,
      required,
      ...props
    },
    ref
  ) => {
    // FIX: Use stable ID from prop instead of generating random one
    // This ensures server and client render the same HTML, preventing hydration mismatch
    const inputId = id;
    
    // FIX: Hydration guard - only render interactive elements after mount
    // This ensures icons and error messages appear after client hydration
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
      setMounted(true);
    }, []);
    
    const errorId = inputId ? `${inputId}-error` : '';
    const hintId = inputId ? `${inputId}-hint` : '';

    // Build aria-describedby dynamically based on what's present
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
            htmlFor={inputId}
            className="block text-sm font-semibold mb-2 text-[var(--color-text)]"
          >
            {label}
            {required && <span className="text-[var(--color-error)]" aria-label="required"> *</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-required={required}
            aria-describedby={ariaDescribedBy}
            aria-invalid={!!error}
            className={`
              w-full px-4 py-3 rounded-md border-2 font-primary
              bg-[var(--color-bg)] text-[var(--color-text)]
              border-[var(--color-border)]
              transition-all duration-200
              placeholder:text-[var(--color-text-secondary)]
              focus:outline-none focus:border-[var(--color-primary)]
              focus:shadow-[0_0_0_4px_rgba(51,86,208,0.1)]
              focus:ring-3 focus:ring-[var(--color-primary)]/10
              disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed
              ${error ? '!border-[var(--color-error)] !shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : ''}
              ${success ? '!border-[var(--color-success)] !shadow-[0_0_0_4px_rgba(16,185,129,0.1)]' : ''}
              ${icon || error || success ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />
          {/* Status icons - only render after mount to prevent hydration mismatch */}
          {mounted && error && (
            <span className="absolute right-4 flex items-center justify-center text-[var(--color-error)]" aria-hidden="true">
              <AlertCircle size={20} />
            </span>
          )}
          {mounted && !error && success && (
            <span className="absolute right-4 flex items-center justify-center text-[var(--color-success)]" aria-hidden="true">
              <CheckCircle size={20} />
            </span>
          )}
          {mounted && !error && !success && icon && (
            <span className="absolute right-4 flex items-center justify-center text-[var(--color-text-secondary)]">
              {icon}
            </span>
          )}
        </div>

        {/* Error message with role="alert" for screen readers - only render after mount */}
        {mounted && error && (
          <p 
            id={errorId}
            role="alert" 
            className="text-xs text-[var(--color-error)] mt-2 flex items-center gap-1"
          >
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        {/* Hint text - only render after mount */}
        {mounted && !error && hint && (
          <p 
            id={hintId}
            className="text-xs text-[var(--color-text-secondary)] mt-2"
          >
            {hint}
          </p>
        )}

        {/* Success message - only render after mount */}
        {mounted && success && !error && (
          <p className="text-xs text-[var(--color-success)] mt-2 flex items-center gap-1">
            <CheckCircle size={14} aria-hidden="true" />
            Looks good!
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
