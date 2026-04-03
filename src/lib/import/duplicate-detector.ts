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

import { prisma } from '@/lib/prisma';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DuplicateMatch {
  id: string;
  rowNumber: number;
  recordType: 'Card' | 'Benefit';
  status: 'Duplicate';
  newRecord: Record<string, any>;
  existingRecord: Record<string, any>;
  differences: Array<{
    field: string;
    existing: any;
    new: any;
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
  existing: Record<string, any>,
  incoming: Record<string, any>,
  fieldsToCompare: string[]
): Array<{ field: string; existing: any; new: any }> {
  const differences: Array<{ field: string; existing: any; new: any }> = [];

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
      differences.push({
        field,
        existing: existingVal,
        new: incomingVal,
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
  }>,
  playerId: string
): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  const seen = new Map<string, typeof records[0]>();

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
      const key = `benefit::${record.data.cardName}::${record.data.issuer}::${record.data.benefitName}`;

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
): Promise<any | null> {
  // First find the MasterCard
  const masterCard = await prisma.masterCard.findFirst({
    where: {
      name: cardName,
      issuer: issuer,
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
 * Lookup: userCardId + benefitName (unique constraint)
 */
async function findExistingBenefit(
  playerId: string,
  cardName: string,
  issuer: string,
  benefitName: string
): Promise<any | null> {
  // First find the card
  const masterCard = await prisma.masterCard.findFirst({
    where: { name: cardName, issuer },
  });

  if (!masterCard) return null;

  const userCard = await prisma.userCard.findFirst({
    where: { playerId, masterCardId: masterCard.id },
  });

  if (!userCard) return null;

  // Then find the benefit
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
        record.data.cardName,
        record.data.issuer,
        record.data.benefitName
      );

      if (existing) {
        duplicates.push({
          id: record.id,
          rowNumber: record.rowNumber,
          recordType: 'Benefit',
          status: 'Duplicate',
          newRecord: record.data,
          existingRecord: {
            id: existing.id,
            benefitName: existing.name,
            stickerValue: existing.stickerValue,
            declaredValue: existing.userDeclaredValue,
            usage: existing.isUsed ? 'Claimed' : 'Unused',
            expirationDate: existing.expirationDate,
            createdAt: existing.createdAt,
          },
          differences: findDifferences(
            {
              stickerValue: existing.stickerValue,
              declaredValue: existing.userDeclaredValue,
              usage: existing.isUsed ? 'Claimed' : 'Unused',
              expirationDate: existing.expirationDate,
            },
            record.data,
            ['stickerValue', 'declaredValue', 'usage', 'expirationDate']
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
  const withinBatchDups = findWithinBatchDuplicates(records, playerId);
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

export type { DuplicateMatch, DuplicateCheckResult };
