'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { BenefitRow, BenefitRowProps } from './BenefitRow';
import { BenefitStatus } from './StatusFilters';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Props for BenefitsList component
 */
interface BenefitsListProps {
  benefits: BenefitRowProps[];
  selectedStatuses: BenefitStatus[];
  isLoading?: boolean;
  onMarkUsed?: (benefitId: string) => Promise<void>;
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
}

/**
 * Benefit group configuration
 */
interface BenefitGroupConfig {
  status: BenefitStatus;
  title: string;
  color: string;
}

const BENEFIT_GROUPS: Record<BenefitStatus, BenefitGroupConfig> = {
  active: {
    status: 'active',
    title: 'Active Benefits',
    color: 'var(--color-success)',
  },
  expiring_soon: {
    status: 'expiring_soon',
    title: 'Expiring Soon',
    color: 'var(--color-warning)',
  },
  used: {
    status: 'used',
    title: 'Used This Period',
    color: 'var(--color-info)',
  },
  expired: {
    status: 'expired',
    title: 'Expired',
    color: 'var(--color-text-secondary)',
  },
  pending: {
    status: 'pending',
    title: 'Pending',
    color: 'var(--color-text-secondary)',
  },
};

/**
 * BenefitsList Component
 *
 * Main content area that groups and displays benefits by status.
 * Features:
 * - Smart filtering by selected statuses
 * - Expandable/collapsible sections
 * - Empty state messages
 * - Loading skeletons
 * - Uses semantic colors for status groups
 */
export function BenefitsList({
  benefits,
  selectedStatuses,
  isLoading = false,
  onMarkUsed,
  onEdit,
  onDelete,
}: BenefitsListProps) {
  const [expandedSections, setExpandedSections] = useState<Set<BenefitStatus>>(
    new Set(['active', 'expiring_soon', 'used'])
  );

  // Group benefits by status
  const groupedBenefits = useMemo(() => {
    const groups: Record<BenefitStatus, BenefitRowProps[]> = {
      active: [],
      expiring_soon: [],
      used: [],
      expired: [],
      pending: [],
    };

    benefits.forEach((benefit) => {
      const status = benefit.status as BenefitStatus;
      if (groups[status]) {
        groups[status].push(benefit);
      }
    });

    return groups;
  }, [benefits]);

  // Filter groups based on selected statuses
  const filteredGroups = useMemo(() => {
    if (selectedStatuses.length === 0) {
      return groupedBenefits;
    }

    const filtered: Record<BenefitStatus, BenefitRowProps[]> = {
      active: [],
      expiring_soon: [],
      used: [],
      expired: [],
      pending: [],
    };

    selectedStatuses.forEach((status) => {
      filtered[status] = groupedBenefits[status];
    });

    return filtered;
  }, [groupedBenefits, selectedStatuses]);

  const handleToggleSection = useCallback((status: BenefitStatus) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border p-4 animate-pulse"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="h-4 rounded w-1/4 mb-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}></div>
            <div className="space-y-3">
              {[1, 2].map((j) => (
                <div key={j} className="h-3 rounded w-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate total benefits to show
  const totalBenefitsInView = Object.values(filteredGroups).reduce(
    (sum, benefitList) => sum + benefitList.length,
    0
  );

  // Empty state
  if (totalBenefitsInView === 0) {
    return (
      <div 
        className="rounded-lg border p-12 text-center"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          No benefits found
        </p>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Try adjusting your filters or selecting a different period
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(filteredGroups).map(([statusKey, statusBenefits]) => {
        const status = statusKey as BenefitStatus;
        if (statusBenefits.length === 0) return null;

        const config = BENEFIT_GROUPS[status];
        const isExpanded = expandedSections.has(status);

        return (
          <div key={status}>
            {/* Group Header */}
            <button
              onClick={() => handleToggleSection(status)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border mb-3 transition-all"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: config.color + '40',
                color: config.color,
              }}
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <h3 className="font-bold text-sm">
                  {config.title} ({statusBenefits.length})
                </h3>
              </div>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {/* Benefits in Group */}
            {isExpanded && (
              <div className="space-y-3">
                {statusBenefits.map((benefit) => (
                  <BenefitRow
                    key={benefit.id}
                    {...benefit}
                    onMarkUsed={onMarkUsed}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
