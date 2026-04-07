/**
 * Hook for calculating benefit progress
 * Memoized calculation of progress indicators
 */

'use client';

import { useMemo } from 'react';
import { Benefit, UsageRecord, BenefitProgress } from '@/types/benefits';

export function useProgressCalculation(
  benefit: Benefit | null,
  usageRecords: UsageRecord[]
): BenefitProgress | null {
  return useMemo(() => {
    if (!benefit) {
      return null;
    }

    // Handle benefits with no limit
    if (!benefit.limit) {
      return {
        benefitId: benefit.id,
        used: 0,
        limit: null,
        percentage: 0,
        status: 'active',
        unit: benefit.category,
      };
    }

    // Calculate total used
    const used = usageRecords.reduce((sum, record) => sum + record.usageAmount, 0);

    // Calculate percentage (capped at 150% for visualization)
    let percentage = (used / benefit.limit) * 100;
    percentage = Math.min(percentage, 150);

    // Determine status based on percentage
    let status: 'active' | 'warning' | 'critical' | 'exceeded' | 'unused' = 'active';
    
    if (percentage === 0) {
      status = 'unused';
    } else if (percentage < 50) {
      status = 'active';
    } else if (percentage < 80) {
      status = 'warning';
    } else if (percentage < 100) {
      status = 'critical';
    } else {
      status = 'exceeded';
    }

    return {
      benefitId: benefit.id,
      used,
      limit: benefit.limit,
      percentage: Math.round(percentage * 10) / 10,
      status,
      unit: benefit.category || 'cents',
    };
  }, [benefit, usageRecords]);
}
