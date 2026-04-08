/**
 * QA-002: Filter utilities for moving client-side filtering to database queries
 * This module converts filter criteria to Prisma where clauses for optimal database performance
 */

import { Prisma } from '@prisma/client';
import { featureFlags } from '@/lib/feature-flags';

export interface FilterCriteria {
  status?: string[];
  minValue?: number;
  maxValue?: number;
  resetCadence?: string[];
  expirationBefore?: string;
  searchTerm?: string;
}

/**
 * Build a Prisma where clause from filter criteria
 * This moves filtering logic to the database layer instead of JavaScript
 * 
 * @param criteria - Filter criteria from request
 * @param playerId - The player ID to filter by
 * @returns Prisma where clause
 */
export function buildBenefitWhereClause(
  criteria: FilterCriteria,
  playerId: string
): Prisma.UserBenefitWhereInput {
  const where: Prisma.UserBenefitWhereInput = {
    playerId,
  };

  // Filter by value range
  if (criteria.minValue !== undefined || criteria.maxValue !== undefined) {
    const valueConditions: Prisma.IntFilter[] = [];

    if (criteria.minValue !== undefined) {
      valueConditions.push({ gte: criteria.minValue });
    }
    if (criteria.maxValue !== undefined) {
      valueConditions.push({ lte: criteria.maxValue });
    }

    if (valueConditions.length > 0) {
      where.stickerValue = {
        ...valueConditions[0],
        ...(valueConditions[1] || {}),
      };
    }
  }

  // Filter by reset cadence
  if (criteria.resetCadence && criteria.resetCadence.length > 0) {
    where.resetCadence = { in: criteria.resetCadence };
  }

  // Filter by expiration date
  if (criteria.expirationBefore) {
    const expirationDate = new Date(criteria.expirationBefore);
    where.expirationDate = { lte: expirationDate };
  }

  // Filter by search term (name)
  if (criteria.searchTerm && criteria.searchTerm.length > 0) {
    where.name = { contains: criteria.searchTerm, mode: 'insensitive' };
  }

  // Period filter: exclude EXPIRED/UPCOMING when engine is on
  if (featureFlags.BENEFIT_ENGINE_ENABLED) {
    // If user explicitly filters for 'expired' status, show EXPIRED rows
    if (criteria.status?.includes('expired')) {
      where.periodStatus = 'EXPIRED';
    } else {
      where.periodStatus = 'ACTIVE';
    }
  }

  return where;
}

/**
 * Apply status filter post-database (since status is calculated)
 * This function filters benefits by their current status
 * 
 * @param benefits - Benefits from database
 * @param statuses - Desired statuses to filter by
 * @returns Filtered benefits
 */
export function filterByStatus(
  benefits: any[],
  statuses: string[],
  now: Date = new Date()
): any[] {
  if (!statuses || statuses.length === 0) {
    return benefits;
  }

  return benefits.filter((benefit) => {
    const status = determineStatus(benefit, now);
    return statuses.includes(status);
  });
}

/**
 * Determine the status of a benefit
 * 
 * @param benefit - The benefit to check
 * @param now - Current date
 * @returns Status string: 'used', 'unused', 'active', 'expiring_soon', 'expired'
 */
function determineStatus(benefit: any, now: Date): string {
  if (benefit.resetCadence === 'ONE_TIME') {
    return benefit.isUsed ? 'used' : 'unused';
  }

  // Check expiration
  if (benefit.expirationDate) {
    if (benefit.expirationDate < now) {
      return 'expired';
    }

    const daysUntilExpiration = Math.floor(
      (benefit.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration <= 7) {
      return 'expiring_soon';
    }
  }

  return 'active';
}
