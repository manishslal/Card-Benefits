/**
 * src/features/cards/lib/roi-calculator.ts
 *
 * ROI (Return on Investment) calculation engine for card benefits.
 * Calculates ROI at benefit, card, player, and household levels.
 *
 * Key concepts:
 * - ROI = (Total Value / Total Fees) * 100
 * - Only counts benefits with isUsed=true
 * - Uses effective value: userDeclaredValue ?? stickerValue
 * - Returns 0 for zero fees (avoids Infinity)
 *
 * Performance targets:
 * - Benefit ROI: < 10ms
 * - Card ROI: < 100ms
 * - Player ROI: < 200ms
 * - Household ROI: < 300ms
 */

import { prisma } from '@/lib/prisma';

/**
 * Cache for ROI values with TTL.
 * Structured as: "${level}:${id}" -> { value, cachedAt }
 */
const roiCache = new Map<
  string,
  {
    value: number;
    cachedAt: Date;
  }
>();

/**
 * Cache TTL: 5 minutes.
 * ROI is recalculated when values change, so stale cache is acceptable.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Calculates ROI for a single benefit.
 *
 * Formula: (benefitValue / annualFee) * 100
 *
 * @param userDeclaredValue - User's custom value in cents (or null if not set)
 * @param stickerValue - Sticker/master value in cents
 * @param annualCardFee - Annual card fee in cents
 * @returns ROI percentage (0-100+), or 0 if fee is 0
 *
 * @example
 * calculateBenefitROI(25000, 30000, 55000) // $250 benefit, $550 fee
 * // Returns: 45.45 (approximately)
 */
export function calculateBenefitROI(
  userDeclaredValue: number | null,
  stickerValue: number,
  annualCardFee: number
): number {
  // Use effective value: declared if set, else sticker
  const effectiveValue = userDeclaredValue ?? stickerValue;

  // Avoid division by zero: if fee is 0, ROI is 0
  if (annualCardFee === 0) {
    return 0;
  }

  // ROI = (value / fee) * 100
  const roi = (effectiveValue / annualCardFee) * 100;

  // Round to 2 decimal places for consistency
  return Math.round(roi * 100) / 100;
}

/**
 * Calculates ROI for a single card.
 *
 * Fetches card with all benefits (isUsed=true) and sums their values.
 *
 * @param cardId - UserCard ID
 * @returns Card ROI percentage, or 0 if no used benefits or zero fee
 */
export async function calculateCardROI(cardId: string): Promise<number> {
  const card = await prisma.userCard.findUnique({
    where: { id: cardId },
    include: {
      masterCard: true,
      userBenefits: {
        where: { isUsed: true },
      },
    },
  });

  if (!card) {
    return 0;
  }

  // Sum all benefit values (using effective value)
  const totalBenefitValue = card.userBenefits.reduce((sum, benefit) => {
    const effectiveValue = benefit.userDeclaredValue ?? benefit.stickerValue;
    return sum + effectiveValue;
  }, 0);

  // Determine annual fee: use override if set, else default
  const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;

  // Avoid division by zero
  if (annualFee === 0) {
    return 0;
  }

  // ROI = (total value / fee) * 100
  const roi = (totalBenefitValue / annualFee) * 100;

  return Math.round(roi * 100) / 100;
}

/**
 * Calculates ROI for a single player (user's own wallet).
 *
 * Aggregates all benefits across all player's cards.
 *
 * @param playerId - Player ID
 * @returns Player ROI percentage, or 0 if no used benefits or zero fees
 */
export async function calculatePlayerROI(playerId: string): Promise<number> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      userCards: {
        where: { isOpen: true },
        include: {
          masterCard: true,
          userBenefits: {
            where: { isUsed: true },
          },
        },
      },
    },
  });

  if (!player) {
    return 0;
  }

  let totalBenefitValue = 0;
  let totalAnnualFees = 0;

  // Iterate all cards and sum their benefits and fees
  for (const card of player.userCards) {
    // Sum benefits on this card
    for (const benefit of card.userBenefits) {
      const effectiveValue = benefit.userDeclaredValue ?? benefit.stickerValue;
      totalBenefitValue += effectiveValue;
    }

    // Add card fee
    const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
    totalAnnualFees += annualFee;
  }

  // Avoid division by zero
  if (totalAnnualFees === 0) {
    return 0;
  }

  // ROI = (total value / total fees) * 100
  const roi = (totalBenefitValue / totalAnnualFees) * 100;

  return Math.round(roi * 100) / 100;
}

/**
 * Calculates ROI for an entire household.
 *
 * Aggregates all benefits from all players in the household.
 *
 * @param householdId - Household (User) ID
 * @returns Household ROI percentage, or 0 if no used benefits or zero fees
 */
export async function calculateHouseholdROI(householdId: string): Promise<number> {
  const household = await prisma.user.findUnique({
    where: { id: householdId },
    include: {
      players: {
        where: { isActive: true },
        include: {
          userCards: {
            where: { isOpen: true },
            include: {
              masterCard: true,
              userBenefits: {
                where: { isUsed: true },
              },
            },
          },
        },
      },
    },
  });

  if (!household) {
    return 0;
  }

  let totalBenefitValue = 0;
  let totalAnnualFees = 0;

  // Iterate all players, all cards, all benefits
  for (const player of household.players) {
    for (const card of player.userCards) {
      // Sum benefits
      for (const benefit of card.userBenefits) {
        const effectiveValue = benefit.userDeclaredValue ?? benefit.stickerValue;
        totalBenefitValue += effectiveValue;
      }

      // Sum fees
      const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
      totalAnnualFees += annualFee;
    }
  }

  // Avoid division by zero
  if (totalAnnualFees === 0) {
    return 0;
  }

  // ROI = (total value / total fees) * 100
  const roi = (totalBenefitValue / totalAnnualFees) * 100;

  return Math.round(roi * 100) / 100;
}

/**
 * Gets ROI for any level, with caching.
 *
 * Checks cache first, returns cached value if fresh (< 5 min old).
 * Otherwise, calculates fresh and caches result.
 *
 * @param level - ROI level: 'BENEFIT', 'CARD', 'PLAYER', 'HOUSEHOLD'
 * @param id - ID of the entity (benefitId, cardId, playerId, userId)
 * @param options - Optional flags
 * @param options.bypassCache - If true, skip cache and calculate fresh
 * @returns ROI percentage
 */
export async function getROI(
  level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD',
  id: string,
  options?: { bypassCache?: boolean }
): Promise<number> {
  const cacheKey = `${level}:${id}`;

  // Check cache unless bypassing
  if (!options?.bypassCache) {
    const cached = roiCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.cachedAt.getTime();
      if (age < CACHE_TTL_MS) {
        return cached.value;
      }
    }
  }

  // Cache miss or bypass: calculate fresh
  let roi = 0;

  switch (level) {
    case 'BENEFIT': {
      // For benefit-level, we'd need more context (fee, other values)
      // This is typically calculated in context where fee is known
      // For now, just return 0 and let callers use calculateBenefitROI directly
      roi = 0;
      break;
    }
    case 'CARD': {
      roi = await calculateCardROI(id);
      break;
    }
    case 'PLAYER': {
      roi = await calculatePlayerROI(id);
      break;
    }
    case 'HOUSEHOLD': {
      roi = await calculateHouseholdROI(id);
      break;
    }
  }

  // Store in cache
  roiCache.set(cacheKey, {
    value: roi,
    cachedAt: new Date(),
  });

  return roi;
}

/**
 * Invalidates ROI cache entries.
 *
 * Called when values change to ensure fresh recalculation on next request.
 *
 * @param affectedKeys - Array of cache keys to invalidate (e.g., ["CARD:card-123", "PLAYER:player-456"])
 */
export function invalidateROICache(affectedKeys: string[]): void {
  for (const key of affectedKeys) {
    roiCache.delete(key);
  }
}

/**
 * Clears entire ROI cache.
 *
 * Used for testing or full invalidation scenarios.
 */
export function clearROICache(): void {
  roiCache.clear();
}

/**
 * Gets current cache stats (for debugging/monitoring).
 */
export function getROICacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number }>;
} {
  const entries: Array<{ key: string; age: number }> = [];

  for (const [key, { cachedAt }] of roiCache.entries()) {
    entries.push({
      key,
      age: Date.now() - cachedAt.getTime(),
    });
  }

  return {
    size: roiCache.size,
    entries,
  };
}
