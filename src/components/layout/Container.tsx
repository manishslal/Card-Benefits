'use client';

import React from 'react';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'full' | 'md' | 'lg' | 'max';
  responsive?: boolean;
}

/**
 * Container Component - Responsive Layout Wrapper
 */
const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      className = '',
      maxWidth = 'max',
      responsive = true,
      children,
      ...props
    },
    ref
  ) => {
    const maxWidthClasses = {
      full: 'max-w-full',
      md: 'max-w-[600px]',
      lg: 'max-w-[1024px]',
      max: 'max-w-[1280px]',
    };

    const responsivePadding = responsive
      ? 'px-4 sm:px-6 lg:px-8 md:px-6'
      : '';

    return (
      <div
        ref={ref}
        className={`
          w-full mx-auto
          ${maxWidthClasses[maxWidth]}
          ${responsivePadding}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

export default Container;
