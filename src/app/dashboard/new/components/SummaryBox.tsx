'use client';

import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

/**
 * Props for SummaryBox component
 */
interface SummaryBoxProps {
  totalBenefits: number;
  activeCount: number;
  expiringCount: number;
  usedCount: number;
  totalValue: number;
  isLoading?: boolean;
}

/**
 * SummaryBox Component - Minimal Statistics Display
 *
 * Displays key statistics with:
 * - Minimal card styling (subtle border + light background)
 * - Plus Jakarta Sans bold for large numbers (28px)
 * - Inter regular for labels (14px)
 * - Design tokens for colors (no hardcoded hex)
 * - Dark mode support
 *
 * React 19 patterns:
 * - Inline styles with CSS variables
 * - Semantic colors from design system
 */
export function SummaryBox({
  totalBenefits,
  activeCount,
  expiringCount,
  usedCount,
  totalValue,
  isLoading = false,
}: SummaryBoxProps) {
  if (isLoading) {
    return (
      <div 
        className="rounded-lg border p-6"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div 
                className="h-7 rounded w-12 mb-2"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)',
                  marginBottom: 'var(--space-sm)',
                }}
              />
              <div 
                className="h-4 rounded w-16"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)',
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
      label: 'Total',
      value: totalBenefits,
      icon: <TrendingUp size={20} />,
      colorVar: '--color-primary',
    },
    {
      label: 'Active',
      value: activeCount,
      icon: <CheckCircle size={20} />,
      colorVar: '--color-success',
    },
    {
      label: 'Expiring',
      value: expiringCount,
      icon: <AlertCircle size={20} />,
      colorVar: '--color-warning',
    },
    {
      label: 'Used',
      value: usedCount,
      icon: <CheckCircle size={20} />,
      colorVar: '--color-info',
    },
    {
      label: 'Max Value',
      value: `$${totalValue.toLocaleString()}`,
      icon: <DollarSign size={20} />,
      colorVar: '--color-success',
    },
  ];

  return (
    <div 
      className="rounded-lg border p-6"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex flex-col">
            {/* Icon */}
            <div 
              className="mb-2 flex-shrink-0"
              style={{ 
                color: `var(${item.colorVar})`,
              }}
            >
              {item.icon}
            </div>
            
            {/* Number - Plus Jakarta Sans, bold, 28px */}
            <span 
              className="text-2xl font-bold mb-1 leading-none"
              style={{ 
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-text)',
                fontSize: '28px',
              }}
            >
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
            
            {/* Label - Inter, regular, 14px */}
            <span 
              className="text-sm"
              style={{ 
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-secondary)',
                fontSize: '14px',
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
