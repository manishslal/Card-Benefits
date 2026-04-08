'use client';

import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

/**
 * Props for SummaryBox component
 */
interface SummaryBoxProps {
  totalBenefits: number;
  expiringCount: number;
  usedCount: number;
  totalValue: number;
  isLoading?: boolean;
}

/**
 * SummaryBox Component
 *
 * Displays at-a-glance statistics about benefits in the selected period:
 * - Total benefits available
 * - Count expiring within 7 days
 * - Count already used
 * - Maximum value available
 *
 * Visual hierarchy with icons and colors to highlight urgency.
 * Uses CSS design tokens for consistent styling and dark mode support.
 *
 * React 19 patterns:
 * - Inline styles with CSS variables for dynamic theming
 * - Semantic colors from design system
 */
export function SummaryBox({
  totalBenefits,
  expiringCount,
  usedCount,
  totalValue,
  isLoading = false,
}: SummaryBoxProps) {
  if (isLoading) {
    return (
      <div 
        className="rounded-lg border shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          borderWidth: '1px',
          borderStyle: 'solid',
          padding: 'var(--space-lg)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div 
                className="h-4 rounded w-3/4 mb-2"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)',
                  marginBottom: 'var(--space-sm)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <div 
                className="h-6 rounded w-1/2"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const summaryItems = [
    {
      label: 'Total Benefits',
      value: totalBenefits,
      icon: <TrendingUp size={20} />,
      bgColorVar: '--color-primary-light',
      textColorVar: '--color-primary-dark',
    },
    {
      label: 'Expiring Soon',
      value: expiringCount,
      icon: <AlertCircle size={20} />,
      bgColorVar: '--color-warning-light',
      textColorVar: '--color-warning-dark',
    },
    {
      label: 'Already Used',
      value: usedCount,
      icon: <CheckCircle size={20} />,
      bgColorVar: '--color-success-light',
      textColorVar: '--color-success-dark',
    },
    {
      label: 'Max Value',
      value: `$${totalValue}`,
      icon: <DollarSign size={20} />,
      bgColorVar: '--color-success-light',
      textColorVar: '--color-success-dark',
    },
  ];

  return (
    <div 
      className="rounded-lg border shadow-sm"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        padding: 'var(--space-lg)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h2 
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-body-sm)',
          marginBottom: 'var(--space-md)',
          gap: 'var(--space-sm)',
        }}
      >
        📊 SUMMARY
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-lg flex flex-col items-start gap-2"
            style={{ 
              backgroundColor: `var(${item.bgColorVar})`,
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              gap: 'var(--space-sm)',
            }}
          >
            <div className="flex items-center justify-between w-full" style={{ gap: 'var(--space-sm)' }}>
              <span 
                className="text-xs font-medium"
                style={{ 
                  color: `var(${item.textColorVar})`,
                  fontSize: 'var(--text-caption)',
                }}
              >
                {item.label}
              </span>
              <div style={{ 
                color: `var(${item.textColorVar})`,
              }}>
                {item.icon}
              </div>
            </div>
            <span 
              className="font-bold"
              style={{ 
                color: `var(${item.textColorVar})`,
                fontSize: 'var(--text-h4)',
              }}
            >
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
