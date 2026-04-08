'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { BenefitGroup } from './BenefitGroup';
import { PastPeriodsSection, PastPeriodEntry } from './PastPeriodsSection';
import { BenefitRowProps } from './BenefitRow';
import { BenefitStatus } from './StatusFilters';

/**
 * Props for BenefitsList component
 */
interface BenefitsListProps {
  benefits: BenefitRowProps[];
  pastPeriods?: PastPeriodEntry[];
  selectedStatuses: BenefitStatus[];
  isLoading?: boolean;
  onMarkUsed?: (benefitId: string) => Promise<void>;
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
}

/**
 * BenefitsList Component
 *
 * Main content area that groups and displays benefits by status.
 * Organizes benefits into sections:
 * - 🟢 ACTIVE (benefits with balance remaining)
 * - 🟠 EXPIRING SOON (7-30 days left)
 * - ✓ USED (already claimed)
 * - 🔴 EXPIRED (period ended)
 * - ⏳ PENDING (future periods)
 * - 📜 PAST PERIODS (collapsed by default)
 *
 * Features:
 * - Smart filtering by selected statuses
 * - Expandable/collapsible sections
 * - Empty state messages
 * - Loading skeletons
 */
export function BenefitsList({
  benefits,
  pastPeriods = [],
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
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2].map((j) => (
                <div key={j} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate total benefits to show
  const totalBenefitsInView = Object.values(filteredGroups).reduce(
    (sum, benefits) => sum + benefits.length,
    0
  );

  // Empty state
  if (totalBenefitsInView === 0 && pastPeriods.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No benefits found
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          Try adjusting your filters or selecting a different period
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Benefits */}
      {filteredGroups.active.length > 0 && (
        <BenefitGroup
          status="active"
          title="ACTIVE"
          icon="🟢"
          benefits={filteredGroups.active}
          isExpanded={expandedSections.has('active')}
          onToggleExpand={handleToggleSection}
          color="green"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Expiring Soon Benefits */}
      {filteredGroups.expiring_soon.length > 0 && (
        <BenefitGroup
          status="expiring_soon"
          title="EXPIRING SOON - 7 DAYS"
          icon="🟠"
          benefits={filteredGroups.expiring_soon}
          isExpanded={expandedSections.has('expiring_soon')}
          onToggleExpand={handleToggleSection}
          color="orange"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Used Benefits */}
      {filteredGroups.used.length > 0 && (
        <BenefitGroup
          status="used"
          title="USED THIS PERIOD"
          icon="✓"
          benefits={filteredGroups.used}
          isExpanded={expandedSections.has('used')}
          onToggleExpand={handleToggleSection}
          color="gray"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Expired Benefits */}
      {filteredGroups.expired.length > 0 && (
        <BenefitGroup
          status="expired"
          title="EXPIRED"
          icon="🔴"
          benefits={filteredGroups.expired}
          isExpanded={expandedSections.has('expired')}
          onToggleExpand={handleToggleSection}
          color="red"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Pending Benefits */}
      {filteredGroups.pending.length > 0 && (
        <BenefitGroup
          status="pending"
          title="PENDING"
          icon="⏳"
          benefits={filteredGroups.pending}
          isExpanded={expandedSections.has('pending')}
          onToggleExpand={handleToggleSection}
          color="blue"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Past Periods */}
      {pastPeriods.length > 0 && (
        <PastPeriodsSection
          periods={pastPeriods}
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

export type { BenefitsListProps };
export { PastPeriodEntry };
