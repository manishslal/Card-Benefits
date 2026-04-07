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
 * Visual hierarchy with icons and colors to highlight urgency
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
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
      icon: <TrendingUp className="text-blue-500" size={20} />,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-900 dark:text-blue-100',
    },
    {
      label: 'Expiring Soon',
      value: expiringCount,
      icon: <AlertCircle className="text-orange-500" size={20} />,
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-900 dark:text-orange-100',
    },
    {
      label: 'Already Used',
      value: usedCount,
      icon: <CheckCircle className="text-green-500" size={20} />,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-900 dark:text-green-100',
    },
    {
      label: 'Max Value',
      value: `$${totalValue}`,
      icon: <DollarSign className="text-emerald-500" size={20} />,
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-900 dark:text-emerald-100',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
        📊 SUMMARY
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={`${item.bgColor} rounded-lg p-4 flex flex-col items-start gap-2`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-medium ${item.textColor}`}>{item.label}</span>
              {item.icon}
            </div>
            <span className={`text-2xl font-bold ${item.textColor}`}>
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
