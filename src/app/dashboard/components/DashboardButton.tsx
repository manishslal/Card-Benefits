'use client';

import React from 'react';

/**
 * Dashboard button variant styles
 */
export type DashboardButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';

/**
 * Dashboard button size variants
 */
export type DashboardButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for DashboardButton component
 */
interface DashboardButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DashboardButtonVariant;
  size?: DashboardButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

/**
 * Get size classes for button
 */
function getSizeClasses(size: DashboardButtonSize): string {
  switch (size) {
    case 'sm':
      return 'px-3 py-1.5 text-sm';
    case 'lg':
      return 'px-6 py-3 text-base';
    case 'md':
    default:
      return 'px-4 py-2 text-sm';
  }
}

/**
 * Get variant classes for button
 */
function getVariantClasses(variant: DashboardButtonVariant): string {
  switch (variant) {
    case 'primary':
      return `
        bg-blue-600 dark:bg-blue-700 
        hover:bg-blue-700 dark:hover:bg-blue-600
        text-white
        focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `;
    case 'secondary':
      return `
        bg-gray-100 dark:bg-gray-700
        hover:bg-gray-200 dark:hover:bg-gray-600
        text-gray-900 dark:text-white
        focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `;
    case 'ghost':
      return `
        bg-transparent
        hover:bg-gray-100 dark:hover:bg-gray-800
        text-gray-900 dark:text-white
        focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `;
    case 'danger':
      return `
        bg-red-100 dark:bg-red-900/30
        hover:bg-red-200 dark:hover:bg-red-900/50
        text-red-700 dark:text-red-400
        focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `;
    case 'success':
      return `
        bg-green-100 dark:bg-green-900/30
        hover:bg-green-200 dark:hover:bg-green-900/50
        text-green-700 dark:text-green-400
        focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `;
    case 'warning':
      return `
        bg-orange-100 dark:bg-orange-900/30
        hover:bg-orange-200 dark:hover:bg-orange-900/50
        text-orange-700 dark:text-orange-400
        focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `;
    default:
      return '';
  }
}

/**
 * DashboardButton Component
 *
 * A reusable button component that handles all dashboard button styles.
 * Supports multiple variants (primary, secondary, ghost, danger, success, warning)
 * and sizes (sm, md, lg).
 *
 * Features:
 * - Design system color tokens via CSS variables
 * - Dark mode support
 * - Loading state with optional spinner
 * - Icon support with positioning
 * - WCAG AA accessible focus states
 * - Smooth transitions
 *
 * React 19 patterns:
 * - Ref as prop (React 19 - no forwardRef needed)
 * - Standard button HTML attributes
 *
 * @example
 * ```tsx
 * <DashboardButton variant="primary" size="md">
 *   Save Changes
 * </DashboardButton>
 *
 * <DashboardButton variant="danger" icon={<TrashIcon />}>
 *   Delete
 * </DashboardButton>
 * ```
 */
export const DashboardButton = React.forwardRef<
  HTMLButtonElement,
  DashboardButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'left',
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = getSizeClasses(size);
    const variantClasses = getVariantClasses(variant);

    const combinedClassName = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-lg
      ${sizeClasses}
      ${variantClasses}
      ${isLoading ? 'opacity-75 cursor-wait' : ''}
      ${className}
    `.replace(/\s+/g, ' ').trim();

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={combinedClassName}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && icon}
            {children}
            {icon && iconPosition === 'right' && icon}
          </>
        )}
      </button>
    );
  }
);

DashboardButton.displayName = 'DashboardButton';
