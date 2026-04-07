/**
 * Benefit Filter Utilities
 * 
 * Advanced filtering logic for benefits with composition
 */

import type { UserBenefit } from '@prisma/client';
import type { BenefitFilterCriteria } from '../types/benefits';

/**
 * Filter benefits by status
 * ACTIVE: benefit not expired, period not reset
 * USED: benefit has usage records
 * EXPIRING: days until reset ≤ 7
 * EXPIRED: past expiration date
 */
export function filterByStatus(
  benefits: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[],
  statuses: string[]
): (UserBenefit & { currentUsage?: number; daysRemaining?: number })[] {
  if (statuses.length === 0) return benefits;

  return benefits.filter(benefit => {
    const expirationDate = benefit.expirationDate ? new Date(benefit.expirationDate) : null;
    const now = new Date();
    const daysRemaining = benefit.daysRemaining ?? 0;

    let status: string;

    if (expirationDate && expirationDate < now) {
      status = 'EXPIRED';
    } else if (daysRemaining <= 7 && daysRemaining > 0) {
      status = 'EXPIRING';
    } else if (benefit.isUsed || (benefit.currentUsage ?? 0) > 0) {
      status = 'USED';
    } else {
      status = 'ACTIVE';
    }

    return statuses.includes(status);
  });
}

/**
 * Filter benefits by reset cadence
 */
export function filterByCadence(
  benefits: UserBenefit[],
  cadences: string[]
): UserBenefit[] {
  if (cadences.length === 0) return benefits;
  return benefits.filter(b => cadences.includes(b.resetCadence));
}

/**
 * Filter benefits by value range
 */
export function filterByValueRange(
  benefits: UserBenefit[],
  minValue?: number,
  maxValue?: number
): UserBenefit[] {
  return benefits.filter(benefit => {
    const value = benefit.userDeclaredValue ?? benefit.stickerValue;
    if (minValue && value < minValue) return false;
    if (maxValue && value > maxValue) return false;
    return true;
  });
}

/**
 * Filter benefits by category (custom or inferred from benefit type)
 */
export function filterByCategory(
  benefits: UserBenefit[],
  categories: string[]
): UserBenefit[] {
  if (categories.length === 0) return benefits;

  const categoryMap: Record<string, string[]> = {
    travel: ['airline', 'hotel', 'rental car', 'transportation'],
    dining: ['restaurants', 'dining', 'food'],
    shopping: ['shopping', 'retail'],
    entertainment: ['entertainment', 'movies', 'events'],
    wellness: ['wellness', 'gym', 'health'],
    insurance: ['insurance', 'protection'],
  };

  return benefits.filter(benefit => {
    const benefitNameLower = benefit.name.toLowerCase();
    const benefitTypeLower = benefit.type.toLowerCase();

    return categories.some(category => {
      const keywords = categoryMap[category] || [];
      return (
        keywords.some(keyword => 
          benefitNameLower.includes(keyword) || 
          benefitTypeLower.includes(keyword)
        ) ||
        benefitNameLower.includes(category) ||
        benefitTypeLower.includes(category)
      );
    });
  });
}

/**
 * Search benefits by text in name or description
 */
export function searchBenefits(
  benefits: UserBenefit[],
  searchText: string
): UserBenefit[] {
  if (!searchText.trim()) return benefits;

  const query = searchText.toLowerCase();
  return benefits.filter(b => b.name.toLowerCase().includes(query));
}

/**
 * Apply all filters together
 */
export function applyFilters(
  benefits: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[],
  criteria: BenefitFilterCriteria
): (UserBenefit & { currentUsage?: number; daysRemaining?: number })[] {
  let filtered = benefits;

  if (criteria.status && criteria.status.length > 0) {
    filtered = filterByStatus(filtered, criteria.status);
  }

  if (criteria.cadence && criteria.cadence.length > 0) {
    filtered = filterByCadence(filtered, criteria.cadence);
  }

  if (criteria.valueRange) {
    filtered = filterByValueRange(
      filtered,
      criteria.valueRange.min,
      criteria.valueRange.max
    );
  }

  if (criteria.categories && criteria.categories.length > 0) {
    filtered = filterByCategory(filtered, criteria.categories);
  }

  if (criteria.searchText) {
    filtered = searchBenefits(filtered, criteria.searchText);
  }

  return filtered;
}

/**
 * Get filter summary statistics
 */
export function getFilterSummary(
  benefits: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[],
  filtered: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[]
) {
  const statusGroups: Record<string, number> = { ACTIVE: 0, USED: 0, EXPIRING: 0, EXPIRED: 0 };
  const cadenceGroups: Record<string, number> = {};

  filtered.forEach(benefit => {
    // Count by cadence
    cadenceGroups[benefit.resetCadence] = (cadenceGroups[benefit.resetCadence] || 0) + 1;
  });

  const totalPotentialValue = filtered.reduce(
    (sum, b) => sum + (b.userDeclaredValue ?? b.stickerValue),
    0
  );

  return {
    byStatus: statusGroups,
    byCadence: cadenceGroups,
    totalPotentialValue,
  };
}
