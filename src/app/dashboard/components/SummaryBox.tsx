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
        className="rounded-lg border p-6 shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)'
        }}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div 
                className="h-4 rounded w-3/4 mb-2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
              />
              <div 
                className="h-6 rounded w-1/2"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
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
      bgColor: 'rgba(59, 130, 246, 0.1)',
      textColor: '#1e40af',
      darkTextColor: '#93c5fd',
    },
    {
      label: 'Expiring Soon',
      value: expiringCount,
      icon: <AlertCircle size={20} />,
      bgColor: 'rgba(234, 88, 12, 0.1)',
      textColor: '#7c2d12',
      darkTextColor: '#fed7aa',
    },
    {
      label: 'Already Used',
      value: usedCount,
      icon: <CheckCircle size={20} />,
      bgColor: 'rgba(34, 197, 94, 0.1)',
      textColor: '#15803d',
      darkTextColor: '#86efac',
    },
    {
      label: 'Max Value',
      value: `$${totalValue}`,
      icon: <DollarSign size={20} />,
      bgColor: 'rgba(5, 150, 105, 0.1)',
      textColor: '#0d5e3f',
      darkTextColor: '#6ee7b7',
    },
  ];

  return (
    <div 
      className="rounded-lg border p-6 shadow-sm"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)'
      }}
    >
      <h2 
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        📊 SUMMARY
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-lg p-4 flex flex-col items-start gap-2"
            style={{ backgroundColor: item.bgColor }}
          >
            <div className="flex items-center justify-between w-full">
              <span 
                className="text-xs font-medium"
                style={{ 
                  color: item.textColor,
                  colorScheme: 'light'
                }}
              >
                {item.label}
              </span>
              <div style={{ 
                color: item.textColor,
                colorScheme: 'light'
              }}>
                {item.icon}
              </div>
            </div>
            <span 
              className="text-2xl font-bold"
              style={{ 
                color: item.textColor,
                colorScheme: 'light'
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
