'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

interface IconProps extends React.SVGAttributes<SVGElement> {
  name: IconName;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Icon Component - Wraps Lucide React Icons
 * 
 * Provides consistent icon sizing, theming, and accessibility.
 * Works seamlessly with light and dark modes via CSS variables.
 * 
 * @example
 * <Icon name="CreditCard" size={24} />
 * <Icon name="Settings" size="md" className="text-primary" />
 * <Icon name="Sun" aria-label="Toggle light mode" />
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 24, strokeWidth = 2, className = '', ...props }, ref) => {
    const LucideIcon = LucideIcons[name] as React.ComponentType<any>;
    
    if (!LucideIcon) {
      console.warn(`Icon "${name}" not found in lucide-react`);
      return null;
    }

    // Convert size shorthand to pixels
    const sizeMap: Record<string, number> = {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 32,
      xl: 40,
      '2xl': 48,
    };

    const resolvedSize = typeof size === 'string' ? sizeMap[size] || 24 : size;

    return (
      <LucideIcon
        ref={ref}
        size={resolvedSize}
        strokeWidth={strokeWidth}
        className={className}
        color="currentColor"
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

export default Icon;
