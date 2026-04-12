'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { BenefitGroup } from './BenefitGroup';
import { PastPeriodsSection, PastPeriodEntry } from './PastPeriodsSection';
import { BenefitRowProps } from './BenefitRow';
import { BenefitStatus } from '../utils/status-colors';

/**
 * Props for BenefitsList component
 */
interface BenefitsListProps {
  benefits: BenefitRowProps[];
  pastPeriods?: PastPeriodEntry[];
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
 * - Expandable/collapsible sections
 * - Empty state messages
 * - Loading skeletons
 */
export function BenefitsList({
  benefits,
  pastPeriods = [],
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
  const totalBenefitsInView = Object.values(groupedBenefits).reduce(
    (sum, benefits) => sum + benefits.length,
    0
  );

  // Empty state
  if (totalBenefitsInView === 0 && pastPeriods.length === 0) {
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
      {/* Active Benefits */}
      {groupedBenefits.active.length > 0 && (
        <BenefitGroup
          status="active"
          title="ACTIVE"
          icon="🟢"
          benefits={groupedBenefits.active}
          isExpanded={expandedSections.has('active')}
          onToggleExpand={handleToggleSection}
          color="green"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Expiring Soon Benefits */}
      {groupedBenefits.expiring_soon.length > 0 && (
        <BenefitGroup
          status="expiring_soon"
          title="EXPIRING SOON - 7 DAYS"
          icon="🟠"
          benefits={groupedBenefits.expiring_soon}
          isExpanded={expandedSections.has('expiring_soon')}
          onToggleExpand={handleToggleSection}
          color="orange"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Used Benefits */}
      {groupedBenefits.used.length > 0 && (
        <BenefitGroup
          status="used"
          title="USED THIS PERIOD"
          icon="✓"
          benefits={groupedBenefits.used}
          isExpanded={expandedSections.has('used')}
          onToggleExpand={handleToggleSection}
          color="gray"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Expired Benefits */}
      {groupedBenefits.expired.length > 0 && (
        <BenefitGroup
          status="expired"
          title="EXPIRED"
          icon="🔴"
          benefits={groupedBenefits.expired}
          isExpanded={expandedSections.has('expired')}
          onToggleExpand={handleToggleSection}
          color="red"
          onMarkUsed={onMarkUsed}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Pending Benefits */}
      {groupedBenefits.pending.length > 0 && (
        <BenefitGroup
          status="pending"
          title="PENDING"
          icon="⏳"
          benefits={groupedBenefits.pending}
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

export type { BenefitsListProps, PastPeriodEntry };
