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
 * Get variant styles for button using CSS variables
 */
function getVariantStyles(variant: DashboardButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: 'var(--color-primary)',
        color: '#ffffff',
        borderColor: 'var(--color-primary)',
      };
    case 'secondary':
      return {
        backgroundColor: 'var(--color-bg-secondary)',
        color: 'var(--color-text)',
        borderColor: 'var(--color-border)',
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        color: 'var(--color-text)',
        borderColor: 'transparent',
      };
    case 'danger':
      return {
        backgroundColor: 'var(--color-error-light)',
        color: 'var(--color-error)',
        borderColor: 'var(--color-error)',
      };
    case 'success':
      return {
        backgroundColor: 'var(--color-success-light)',
        color: 'var(--color-success)',
        borderColor: 'var(--color-success)',
      };
    case 'warning':
      return {
        backgroundColor: 'var(--color-warning-light)',
        color: 'var(--color-warning)',
        borderColor: 'var(--color-warning)',
      };
    default:
      return {};
  }
}

/**
 * Get variant classes for button - combine with inline styles
 */
function getVariantClasses(variant: DashboardButtonVariant): string {
  return `
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    focus-visible:ring-[var(--color-primary)]
  `;
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
    const variantStyles = getVariantStyles(variant);

    const combinedClassName = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-lg border
      ${sizeClasses}
      ${variantClasses}
      ${isLoading ? 'opacity-75 cursor-wait' : ''}
      ${className}
    `.replace(/\s+/g, ' ').trim();

    // Create hover and active styles based on variant
    const getHoverStyles = (): React.CSSProperties => {
      switch (variant) {
        case 'primary':
          return { backgroundColor: 'var(--color-primary-dark)' };
        case 'secondary':
          return { backgroundColor: 'var(--color-gray-200)' };
        case 'ghost':
          return { backgroundColor: 'var(--color-bg-secondary)' };
        case 'danger':
          return { backgroundColor: 'var(--color-error)' };
        case 'success':
          return { backgroundColor: 'var(--color-success)' };
        case 'warning':
          return { backgroundColor: 'var(--color-warning)' };
        default:
          return {};
      }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !isLoading) {
        Object.assign(e.currentTarget.style, getHoverStyles());
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      Object.assign(e.currentTarget.style, variantStyles);
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={combinedClassName}
        style={variantStyles}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
