'use client';

import React from 'react';

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
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold mb-2 text-[var(--color-text)]"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`
              w-full px-4 py-3 rounded-md border-2 font-primary
              bg-[var(--color-bg)] text-[var(--color-text)]
              border-[var(--color-border)]
              transition-all duration-200
              placeholder:text-[var(--color-text-secondary)]
              focus:outline-none focus:border-[var(--color-primary)]
              focus:shadow-[0_0_0_4px_rgba(64,128,255,0.1)]
              disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed
              ${error ? '!border-[var(--color-error)] !shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : ''}
              ${success ? '!border-[var(--color-success)] !shadow-[0_0_0_4px_rgba(16,185,129,0.1)]' : ''}
              ${icon ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />
          {icon && (
            <span className="absolute right-4 flex items-center justify-center text-[var(--color-text-secondary)]">
              {icon}
            </span>
          )}
        </div>

        {error && (
          <p className="text-xs text-[var(--color-error)] mt-1">{error}</p>
        )}

        {!error && hint && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{hint}</p>
        )}

        {success && !error && (
          <p className="text-xs text-[var(--color-success)] mt-1">✓ Looks good!</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
