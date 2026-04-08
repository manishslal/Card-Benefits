/**
 * Duplicate detection logic for imports
 *
 * Detects three types of duplicates:
 * 1. Exact duplicates within the import batch
 * 2. Duplicates against existing database records
 * 3. Near-duplicates (fuzzy matching)
 *
 * For each duplicate, suggests resolution actions:
 * - Skip: Don't import this record
 * - Update: Merge new data with existing (preserve createdAt)
 * - Merge/KeepBoth: Create as variant (for benefits)
 */

import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type for field values being compared for duplicates
 */
export type FieldValue = string | number | boolean | Date | null | undefined;

export interface DuplicateMatch {
  id: string;
  rowNumber: number;
  recordType: 'Card' | 'Benefit';
  status: 'Duplicate';
  newRecord: Record<string, unknown>;
  existingRecord: Record<string, unknown>;
  differences: Array<{
    field: string;
    existing: FieldValue;
    new: FieldValue;
  }>;
  suggestedActions: Array<'Skip' | 'Update' | 'KeepBoth'>;
  userDecision?: 'Skip' | 'Update' | 'Merge' | null;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  cardDuplicates: number;
  benefitDuplicates: number;
  totalDuplicates: number;
  duplicates: DuplicateMatch[];
}

// ============================================================================
// Duplicate Detection Helpers
// ============================================================================

/**
 * Finds differences between two records
 */
function findDifferences(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  fieldsToCompare: string[]
): Array<{ field: string; existing: FieldValue; new: FieldValue }> {
  const differences: Array<{ field: string; existing: FieldValue; new: FieldValue }> = [];

  for (const field of fieldsToCompare) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];

    // Convert dates for comparison
    const existingComp =
      existingVal instanceof Date
        ? existingVal.toISOString()
        : existingVal;
    const incomingComp =
      incomingVal instanceof Date
        ? incomingVal.toISOString()
        : incomingVal;

    if (existingComp !== incomingComp) {
      // Cast values: we know they're field values from record context
      differences.push({
        field,
        existing: (existingVal as FieldValue),
        new: (incomingVal as FieldValue),
      });
    }
  }

  return differences;
}

// ============================================================================
// Within-Batch Duplicate Detection
// ============================================================================

/**
 * Detects duplicates within the import batch itself
 *
 * For cards: Same (masterCardId, playerId)
 * For benefits: Same (cardName, issuer, benefitName)
 */
export function findWithinBatchDuplicates(
  records: Array<{
    id: string;
    recordType: 'Card' | 'Benefit';
    rowNumber: number;
    data: Record<string, any>;
  }>
): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];

  // Card deduplication keys
  const cardKeys = new Map<string, typeof records[0]>();
  // Benefit deduplication keys
  const benefitKeys = new Map<string, typeof records[0]>();

  for (const record of records) {
    if (record.recordType === 'Card') {
      const key = `card::${record.data.cardName}::${record.data.issuer}`;

      if (cardKeys.has(key)) {
        const original = cardKeys.get(key)!;
        duplicates.push({
          id: record.id,
          rowNumber: record.rowNumber,
          recordType: 'Card',
          status: 'Duplicate',
          newRecord: record.data,
          existingRecord: original.data,
          differences: findDifferences(original.data, record.data, [
            'annualFee',
            'renewalDate',
            'customName',
            'status',
          ]),
          suggestedActions: ['Skip', 'Update'],
          userDecision: null,
        });
      } else {
        cardKeys.set(key, record);
      }
    } else if (record.recordType === 'Benefit') {
      // When engine is enabled, include periodStart in the dedup key to allow
      // multiple period rows for the same benefit (fe-7 fix).
      const periodSuffix =
        featureFlags.BENEFIT_ENGINE_ENABLED && record.data.periodStart
          ? `::${String(record.data.periodStart)}`
          : '';
      const key = `benefit::${record.data.cardName}::${record.data.issuer}::${record.data.benefitName}${periodSuffix}`;

      if (benefitKeys.has(key)) {
        const original = benefitKeys.get(key)!;
        duplicates.push({
          id: record.id,
          rowNumber: record.rowNumber,
          recordType: 'Benefit',
          status: 'Duplicate',
          newRecord: record.data,
          existingRecord: original.data,
          differences: findDifferences(original.data, record.data, [
            'stickerValue',
            'declaredValue',
            'expirationDate',
            'usage',
          ]),
          suggestedActions: ['Skip', 'KeepBoth'],
          userDecision: null,
        });
      } else {
        benefitKeys.set(key, record);
      }
    }
  }

  return duplicates;
}

// ============================================================================
// Database Duplicate Detection
// ============================================================================

/**
 * Checks if a card already exists in the player's wallet
 *
 * Lookup: playerId + masterCardId (unique constraint)
 */
async function findExistingCard(
  playerId: string,
  cardName: string,
  issuer: string
): Promise<Record<string, unknown> | null> {
  // First find the MasterCard
  const masterCard = await prisma.masterCard.findFirst({
    where: {
      cardName,
      issuer,
    },
  });

  if (!masterCard) return null;

  // Then find the UserCard
  const userCard = await prisma.userCard.findFirst({
    where: {
      playerId,
      masterCardId: masterCard.id,
    },
  });

  return userCard || null;
}

/**
 * Checks if a benefit already exists on the card
 *
 * When the benefit engine is enabled and a periodStart is provided,
 * uses the compound key (userCardId, name, periodStart) to match the
 * exact period row. Otherwise falls back to (userCardId, name) lookup.
 * (fe-7 fix: prevents false-positive matches across period rows)
 */
async function findExistingBenefit(
  playerId: string,
  cardName: string,
  issuer: string,
  benefitName: string,
  periodStart?: Date | string | null
): Promise<Record<string, unknown> | null> {
  // First find the card
  const masterCard = await prisma.masterCard.findFirst({
    where: { cardName, issuer },
  });

  if (!masterCard) return null;

  const userCard = await prisma.userCard.findFirst({
    where: { playerId, masterCardId: masterCard.id },
  });

  if (!userCard) return null;

  // Period-aware lookup when engine is enabled and periodStart is available
  if (featureFlags.BENEFIT_ENGINE_ENABLED && periodStart) {
    const parsedDate =
      periodStart instanceof Date ? periodStart : new Date(periodStart);

    const benefit = await prisma.userBenefit.findFirst({
      where: {
        userCardId: userCard.id,
        name: benefitName,
        periodStart: parsedDate,
      },
    });

    return benefit || null;
  }

  // Legacy lookup — match by name only
  const benefit = await prisma.userBenefit.findFirst({
    where: {
      userCardId: userCard.id,
      name: benefitName,
    },
  });

  return benefit || null;
}

/**
 * Detects duplicates of import records against existing database
 */
export async function findDatabaseDuplicates(
  records: Array<{
    id: string;
    recordType: 'Card' | 'Benefit';
    rowNumber: number;
    data: Record<string, any>;
  }>,
  playerId: string
): Promise<DuplicateMatch[]> {
  const duplicates: DuplicateMatch[] = [];

  for (const record of records) {
    if (record.recordType === 'Card') {
      const existing = await findExistingCard(
        playerId,
        record.data.cardName,
        record.data.issuer
      );

      if (existing) {
        duplicates.push({
          id: record.id,
          rowNumber: record.rowNumber,
          recordType: 'Card',
          status: 'Duplicate',
          newRecord: record.data,
          existingRecord: {
            id: existing.id,
            cardName: record.data.cardName,
            issuer: record.data.issuer,
            annualFee: existing.actualAnnualFee,
            renewalDate: existing.renewalDate,
            customName: existing.customName,
            status: existing.isOpen ? 'Active' : 'Inactive',
            createdAt: existing.createdAt,
          },
          differences: findDifferences(
            {
              annualFee: existing.actualAnnualFee,
              renewalDate: existing.renewalDate,
              customName: existing.customName,
              status: existing.isOpen ? 'Active' : 'Inactive',
            },
            record.data,
            ['annualFee', 'renewalDate', 'customName', 'status']
          ),
          suggestedActions: ['Skip', 'Update'],
          userDecision: null,
        });
      }
    } else if (record.recordType === 'Benefit') {
      const existing = await findExistingBenefit(
        playerId,
        record.data.cardName as string,
        record.data.issuer as string,
        record.data.benefitName as string,
        // Pass periodStart for period-aware matching (fe-7 fix)
        record.data.periodStart as Date | string | undefined,
      );

      if (existing) {
        // Build existingRecord, including period fields when engine is enabled
        const existingRecord: Record<string, unknown> = {
          id: existing.id,
          benefitName: existing.name,
          stickerValue: existing.stickerValue,
          declaredValue: existing.userDeclaredValue,
          usage: existing.isUsed ? 'Claimed' : 'Unused',
          expirationDate: existing.expirationDate,
          createdAt: existing.createdAt,
        };

        const diffFields = ['stickerValue', 'declaredValue', 'usage', 'expirationDate'];

        // Include period fields in diff when engine is enabled (fe-7)
        if (featureFlags.BENEFIT_ENGINE_ENABLED) {
          existingRecord.periodStart = existing.periodStart ?? null;
          existingRecord.periodEnd = existing.periodEnd ?? null;
          existingRecord.periodStatus = existing.periodStatus ?? null;
          existingRecord.resetCadence = existing.resetCadence ?? null;
          diffFields.push('periodStart', 'periodEnd', 'periodStatus', 'resetCadence');
        }

        duplicates.push({
          id: record.id,
          rowNumber: record.rowNumber,
          recordType: 'Benefit',
          status: 'Duplicate',
          newRecord: record.data,
          existingRecord,
          differences: findDifferences(
            {
              stickerValue: existing.stickerValue,
              declaredValue: existing.userDeclaredValue,
              usage: existing.isUsed ? 'Claimed' : 'Unused',
              expirationDate: existing.expirationDate,
              ...(featureFlags.BENEFIT_ENGINE_ENABLED && {
                periodStart: existing.periodStart ?? null,
                periodEnd: existing.periodEnd ?? null,
                periodStatus: existing.periodStatus ?? null,
                resetCadence: existing.resetCadence ?? null,
              }),
            },
            record.data,
            diffFields,
          ),
          suggestedActions: ['Skip', 'Update'],
          userDecision: null,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Main duplicate detection function
 *
 * Checks for:
 * 1. Duplicates within batch
 * 2. Duplicates against database
 * 3. Combines both lists for user review
 */
export async function detectDuplicates(
  records: Array<{
    id: string;
    recordType: 'Card' | 'Benefit';
    rowNumber: number;
    data: Record<string, any>;
  }>,
  playerId: string
): Promise<DuplicateCheckResult> {
  // Find both types of duplicates
  const withinBatchDups = findWithinBatchDuplicates(records);
  const databaseDups = await findDatabaseDuplicates(records, playerId);

  // Combine and deduplicate (prefer database duplicates over batch duplicates)
  const allDuplicates = [
    ...databaseDups,
    ...withinBatchDups.filter(
      (bd) =>
        !databaseDups.some((dd) => dd.id === bd.id)
    ),
  ];

  return {
    hasDuplicates: allDuplicates.length > 0,
    cardDuplicates: allDuplicates.filter((d) => d.recordType === 'Card').length,
    benefitDuplicates: allDuplicates.filter(
      (d) => d.recordType === 'Benefit'
    ).length,
    totalDuplicates: allDuplicates.length,
    duplicates: allDuplicates,
  };
}
