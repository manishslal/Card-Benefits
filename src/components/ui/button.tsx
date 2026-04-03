'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon' | 'icon-lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

/**
 * Button Component - Design System Implementation
 * Fully accessible with proper focus states and hover effects
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      asChild = false,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'inline-flex items-center justify-center gap-2 whitespace-nowrap',
      'font-semibold transition-all duration-200 rounded-md border-none',
      'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
      disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      fullWidth && !size.startsWith('icon') ? 'w-full' : '',
      className,
    ].join(' ');

    const variantClasses = {
      primary: `bg-gradient-to-br from-[var(--color-primary)] to-[#3968dd] text-white shadow-md
        ${!disabled && !isLoading ? 'hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0' : ''}`,
      secondary: `border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent
        ${!disabled && !isLoading ? 'hover:bg-[rgba(64,128,255,0.08)]' : ''}`,
      tertiary: `text-[var(--color-primary)] bg-transparent
        ${!disabled && !isLoading ? 'hover:bg-[rgba(64,128,255,0.08)]' : ''}`,
      outline: `border border-[var(--color-border)] text-[var(--color-text)] bg-transparent
        ${!disabled && !isLoading ? 'hover:bg-[var(--color-bg-secondary)]' : ''}`,
      accent: `bg-[var(--color-secondary)] text-white shadow-md
        ${!disabled && !isLoading ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''}`,
      danger: `bg-[var(--color-error)] text-white shadow-md
        ${!disabled && !isLoading ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''}`,
      ghost: `text-[var(--color-text-secondary)] bg-transparent
        ${!disabled && !isLoading ? 'hover:bg-black/4' : ''}`,
    };

    const sizeClasses = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      'icon-xs': 'w-6 h-6 p-1',
      'icon-sm': 'w-8 h-8 p-1.5',
      'icon': 'w-10 h-10 p-2',
      'icon-lg': 'w-12 h-12 p-2.5',
    };

    // If asChild, render as a passthrough wrapper
    if (asChild && React.isValidElement(children)) {
      const childElement = children as React.ReactElement<any>;
      const childClassName = childElement.props?.className || '';
      return React.cloneElement(childElement, {
        ref,
        className: `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${childClassName}`,
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
        style={style}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {leftIcon && <span>{leftIcon}</span>}
          </>
        )}
        {children}
        {!isLoading && rightIcon && <span>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;
