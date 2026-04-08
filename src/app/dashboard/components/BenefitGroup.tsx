'use client';

import React from 'react';
import { BenefitRow, BenefitRowProps } from './BenefitRow';
import { BenefitStatus } from './StatusFilters';

/**
 * Props for BenefitGroup component
 */
interface BenefitGroupProps {
  status: BenefitStatus;
  title: string;
  icon: string;
  benefits: BenefitRowProps[];
  isExpanded?: boolean;
  onToggleExpand?: (status: BenefitStatus) => void;
  color: 'green' | 'orange' | 'red' | 'gray' | 'blue';
  onMarkUsed?: (benefitId: string) => Promise<void>;
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
}

/**
 * Get color classes for a benefit group using CSS variables
 */
function getGroupColorClasses(color: 'green' | 'orange' | 'red' | 'gray' | 'blue') {
  switch (color) {
    case 'green':
      return 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10';
    case 'orange':
      return 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-900/10';
    case 'red':
      return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10';
    case 'blue':
      return 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/10';
    default:
      return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/10';
  }
}

/**
 * BenefitGroup Component
 *
 * Groups benefits by status (Active, Expiring, Used, etc.)
 * Displays a header with count and collapsible benefits list.
 *
 * Features:
 * - Expandable/collapsible sections
 * - Visual status indicators with colors and icons using CSS variables
 * - Shows count of benefits in group
 * - Smooth animations
 * - Uses semantic colors from design system
 *
 * React 19 patterns:
 * - Semantic color tokens via CSS variables
 */
export function BenefitGroup({
  status,
  title,
  icon,
  benefits,
  isExpanded = true,
  onToggleExpand,
  color,
  onMarkUsed,
  onEdit,
  onDelete,
}: BenefitGroupProps) {
  if (benefits.length === 0) {
    return null;
  }

  const colorClasses = getGroupColorClasses(color);
  const headerBackgroundClass = color === 'green' 
    ? 'bg-green-100 dark:bg-green-900/30'
    : color === 'orange'
    ? 'bg-orange-100 dark:bg-orange-900/30'
    : color === 'red'
    ? 'bg-red-100 dark:bg-red-900/30'
    : color === 'blue'
    ? 'bg-blue-100 dark:bg-blue-900/30'
    : 'bg-gray-100 dark:bg-gray-900/30';

  const headerTextClass = color === 'green'
    ? 'text-green-900 dark:text-green-100'
    : color === 'orange'
    ? 'text-orange-900 dark:text-orange-100'
    : color === 'red'
    ? 'text-red-900 dark:text-red-100'
    : color === 'blue'
    ? 'text-blue-900 dark:text-blue-100'
    : 'text-gray-900 dark:text-gray-100';

  return (
    <section className={`border rounded-lg mb-6 ${colorClasses} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => onToggleExpand?.(status)}
        className={`w-full ${headerBackgroundClass} px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity`}
        aria-expanded={isExpanded}
        aria-controls={`benefit-group-${status}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h2 
            className={`font-bold text-lg ${headerTextClass}`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {title}
            <span className="ml-2 text-sm font-normal opacity-75">
              ({benefits.length})
            </span>
          </h2>
        </div>
        <svg
          className={`w-5 h-5 ${headerTextClass} transform transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div 
          id={`benefit-group-${status}`} 
          className="px-4 py-4"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <div className="space-y-2">
            {benefits.map((benefit) => (
              <BenefitRow 
                key={benefit.id} 
                {...benefit}
                onMarkUsed={onMarkUsed}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
