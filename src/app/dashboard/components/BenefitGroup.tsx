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
 * Get color style object for a benefit group using CSS variables
 */
function getGroupColorStyles(color: 'green' | 'orange' | 'red' | 'gray' | 'blue'): React.CSSProperties {
  const colorMap = {
    green: {
      borderColor: 'var(--color-success-light)',
      backgroundColor: 'rgba(10, 125, 87, 0.05)',
    },
    orange: {
      borderColor: 'var(--color-warning)',
      backgroundColor: 'rgba(217, 119, 6, 0.05)',
    },
    red: {
      borderColor: 'var(--color-error)',
      backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    blue: {
      borderColor: 'var(--color-primary)',
      backgroundColor: 'rgba(51, 86, 208, 0.05)',
    },
    gray: {
      borderColor: 'var(--color-border)',
      backgroundColor: 'var(--color-bg-secondary)',
    },
  };

  return colorMap[color] || colorMap.gray;
}

/**
 * Get header background style for a benefit group
 */
function getHeaderBackgroundStyle(color: 'green' | 'orange' | 'red' | 'gray' | 'blue'): React.CSSProperties {
  const colorMap = {
    green: { backgroundColor: 'rgba(10, 125, 87, 0.1)' },
    orange: { backgroundColor: 'rgba(217, 119, 6, 0.1)' },
    red: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    blue: { backgroundColor: 'rgba(51, 86, 208, 0.1)' },
    gray: { backgroundColor: 'var(--color-bg-secondary)' },
  };

  return colorMap[color] || colorMap.gray;
}

/**
 * Get header text color style
 */
function getHeaderTextStyle(color: 'green' | 'orange' | 'red' | 'gray' | 'blue'): React.CSSProperties {
  const colorMap = {
    green: { color: 'var(--color-success)' },
    orange: { color: 'var(--color-warning)' },
    red: { color: 'var(--color-error)' },
    blue: { color: 'var(--color-primary)' },
    gray: { color: 'var(--color-text)' },
  };

  return colorMap[color] || colorMap.gray;
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

  const groupColorStyles = getGroupColorStyles(color);
  const headerBackgroundStyle = getHeaderBackgroundStyle(color);
  const headerTextStyle = getHeaderTextStyle(color);

  return (
    <section 
      className="border rounded-lg mb-6 overflow-hidden"
      style={{
        ...groupColorStyles,
        marginBottom: 'var(--space-lg)',
        borderRadius: 'var(--radius-lg)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Header */}
      <button
        onClick={() => onToggleExpand?.(status)}
        className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
        style={{
          ...headerBackgroundStyle,
          padding: 'var(--space-md)',
        }}
        aria-expanded={isExpanded}
        aria-controls={`benefit-group-${status}`}
      >
        <div className="flex items-center gap-3" style={{ gap: 'var(--space-md)' }}>
          <span className="text-xl">{icon}</span>
          <h2 
            className="font-bold text-lg"
            style={{ 
              fontFamily: 'var(--font-heading)',
              ...headerTextStyle,
              fontSize: 'var(--text-h5)',
            }}
          >
            {title}
            <span className="ml-2 text-sm font-normal opacity-75" style={{ marginLeft: 'var(--space-sm)' }}>
              ({benefits.length})
            </span>
          </h2>
        </div>
        <svg
          className="w-5 h-5 transform transition-transform"
          style={{
            ...headerTextStyle,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transitionDuration: 'var(--duration-base)',
          }}
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
          style={{ 
            backgroundColor: 'var(--color-bg)',
            padding: 'var(--space-md)',
          }}
        >
          <div className="space-y-2" style={{ gap: 'var(--space-sm)' }}>
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
