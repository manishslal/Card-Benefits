/**
 * Import committer - executes database transactions for import
 *
 * Responsibilities:
 * - Create/update UserCards with version control
 * - Create/update UserBenefits with version control
 * - Handle duplicate resolutions (Skip/Update/Merge)
 * - Create ImportRecord entries for audit trail
 * - Execute all changes in a single transaction
 * - Rollback on any error to maintain consistency
 *
 * Transaction Strategy:
 * - All writes happen in Prisma.$transaction()
 * - If any error occurs, entire transaction rolls back
 * - ImportJob status is updated after commit
 * - Error details are logged for debugging
 */

import { prisma } from '@/shared/lib';
import { AppError } from '@/shared/lib';
import { ImportRecordData } from './schema';
import type { Prisma } from '@prisma/client';
import { hydratePeriodFields } from '@/lib/benefit-engine/hydrate-period';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CommitterOptions {
  importJobId: string;
  playerId: string;
  userId: string;
  records: ImportRecordData[];
}

export interface CommitResult {
  success: true;
  cardsCreated: number;
  cardsUpdated: number;
  benefitsCreated: number;
  benefitsUpdated: number;
  recordsSkipped: number;
  totalProcessed: number;
}

export interface CommitError {
  success: false;
  error: string;
  code: string;
  details?: Record<string, any>;
  rollback: boolean;
}

export type CommitOperationResult = CommitResult | CommitError;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates or updates a UserCard
 *
 * For create: Generate new ID, set timestamps
 * For update: Preserve createdAt, update specific fields only
 *   - RenewalDate
 *   - AnnualFee
 *   - CustomName
 *   - Status (isOpen)
 */
async function commitCard(
  tx: Prisma.TransactionClient,
  playerId: string,
  cardName: string,
  issuer: string,
  normalizedData: Record<string, any>,
  action: 'Create' | 'Update',
  importJobId: string
): Promise<{ id: string; action: 'Create' | 'Update' }> {
  // Find MasterCard
  const masterCard = await tx.masterCard.findFirst({
    where: { cardName, issuer },
  });

  if (!masterCard) {
    throw new AppError('RESOURCE_NOT_FOUND', {
      resource: 'MasterCard',
      cardName,
      issuer,
    });
  }

  if (action === 'Create') {
    // Create new UserCard
    const userCard = await tx.userCard.create({
      data: {
        playerId,
        masterCardId: masterCard.id,
        actualAnnualFee: normalizedData.annualFee,
        renewalDate: new Date(normalizedData.renewalDate),
        customName: normalizedData.customName,
        isOpen: normalizedData.status === 'Active',
        importedFrom: importJobId,
        importedAt: new Date(),
        version: 1,
      },
    });
    return { id: userCard.id, action: 'Create' };
  } else {
    // Update existing UserCard
    const userCard = await tx.userCard.update({
      where: {
        playerId_masterCardId: {
          playerId,
          masterCardId: masterCard.id,
        },
      },
      data: {
        // Only allow updating these fields
        actualAnnualFee: normalizedData.annualFee,
        renewalDate: new Date(normalizedData.renewalDate),
        customName: normalizedData.customName,
        isOpen: normalizedData.status === 'Active',
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    return { id: userCard.id, action: 'Update' };
  }
}

/**
 * Creates or updates a UserBenefit
 *
 * For create: Clone from MasterBenefit or use provided data
 * For update: Update specific fields only
 *   - StickerValue
 *   - DeclaredValue
 *   - ExpirationDate
 *   - Status (isUsed)
 */
async function commitBenefit(
  tx: Prisma.TransactionClient,
  playerId: string,
  userCardId: string,
  benefitName: string,
  normalizedData: Record<string, any>,
  action: 'Create' | 'Update',
  importJobId: string
): Promise<{ id: string; action: 'Create' | 'Update' }> {
  if (action === 'Create') {
    // Hydrate period fields from benefit engine when enabled
    const periodFields = await hydratePeriodFields(
      tx,
      userCardId,
      benefitName,
      'OneTime' // default for imported benefits
    );

    // Create new UserBenefit
    const benefit = await tx.userBenefit.create({
      data: {
        userCardId,
        playerId,
        name: benefitName,
        type: normalizedData.benefitType,
        stickerValue: periodFields.effectiveStickerValue ?? normalizedData.stickerValue,
        userDeclaredValue: normalizedData.declaredValue,
        expirationDate: periodFields.periodEnd
          ? periodFields.periodEnd
          : normalizedData.expirationDate
            ? new Date(normalizedData.expirationDate)
            : null,
        isUsed: normalizedData.usage === 'Claimed',
        resetCadence: periodFields.resolvedResetCadence,
        importedFrom: importJobId,
        importedAt: new Date(),
        version: 1,
        // Period fields (null when engine is off)
        periodStart: periodFields.periodStart,
        periodEnd: periodFields.periodEnd,
        periodStatus: periodFields.periodStatus ?? 'ACTIVE',
        masterBenefitId: periodFields.masterBenefitId,
      },
    });
    return { id: benefit.id, action: 'Create' };
  } else {
    // Update existing UserBenefit — find by (userCardId, name) for legacy rows
    // that have periodStart=NULL. Can't use compound unique key lookup because
    // PostgreSQL doesn't match NULLs in unique constraint lookups.
    const existing = await tx.userBenefit.findFirst({
      where: {
        userCardId,
        name: benefitName,
        periodStart: null,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error(
        `UserBenefit not found for update: userCardId=${userCardId}, name=${benefitName}`
      );
    }

    const benefit = await tx.userBenefit.update({
      where: { id: existing.id },
      data: {
        // Only allow updating these fields
        stickerValue: normalizedData.stickerValue,
        userDeclaredValue: normalizedData.declaredValue,
        expirationDate: normalizedData.expirationDate
          ? new Date(normalizedData.expirationDate)
          : null,
        isUsed: normalizedData.usage === 'Claimed',
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    return { id: benefit.id, action: 'Update' };
  }
}

/**
 * Processes a single import record in the transaction
 *
 * Determines action (Create/Update/Skip) based on:
 * - Whether record is a duplicate
 * - User's resolution decision for the duplicate
 * - Record validation status
 *
 * Data validation:
 * - Ensures normalizedData exists and is not null
 * - Validates all required fields are present before database access
 * - Returns error for missing or invalid data
 */
async function processRecord(
  tx: Prisma.TransactionClient,
  record: ImportRecordData,
  importJobId: string,
  playerId: string
): Promise<{
  createdCardId?: string;
  createdBenefitId?: string;
  updatedCardId?: string;
  updatedBenefitId?: string;
  appliedData?: string;
  action: 'Created' | 'Updated' | 'Skipped';
}> {
  // Check if user resolved to skip this duplicate
  if (record.isDuplicate && record.userResolution === 'Skip') {
    return { action: 'Skipped' };
  }

  // Check if record has critical errors
  if (record.status === 'Error') {
    return { action: 'Skipped' };
  }

  // Validate that normalizedData exists and contains required fields
  if (!record.normalizedData || typeof record.normalizedData !== 'object') {
    throw new AppError('VALIDATION_FIELD', {
      field: 'normalizedData',
      rowNumber: record.rowNumber,
      reason: 'Record normalized data is missing or invalid',
      suggestion: 'Ensure the record was properly validated before commit',
    });
  }

  // Determine if this is a create or update
  const isUpdate = record.isDuplicate && record.userResolution === 'Update';
  const action = isUpdate ? 'Update' : 'Create';

  // Process based on record type
  if (record.recordType === 'Card') {
    // Validate card-specific required fields exist in normalized data
    const { cardName, issuer } = record.normalizedData;

    if (!cardName || typeof cardName !== 'string' || !cardName.trim()) {
      throw new AppError('VALIDATION_FIELD', {
        field: 'cardName',
        rowNumber: record.rowNumber,
        reason: 'Card name is missing or invalid in normalized data',
        suggestion: 'Ensure card name was properly validated',
      });
    }

    if (!issuer || typeof issuer !== 'string' || !issuer.trim()) {
      throw new AppError('VALIDATION_FIELD', {
        field: 'issuer',
        rowNumber: record.rowNumber,
        reason: 'Issuer is missing or invalid in normalized data',
        suggestion: 'Ensure issuer was properly validated',
      });
    }

    const { id, action: resultAction } = await commitCard(
      tx,
      playerId,
      cardName,
      issuer,
      record.normalizedData,
      action as 'Create' | 'Update',
      importJobId
    );

    if (resultAction === 'Create') {
      return {
        createdCardId: id,
        action: 'Created',
        appliedData: JSON.stringify(record.normalizedData),
      };
    } else {
      return {
        updatedCardId: id,
        action: 'Updated',
        appliedData: JSON.stringify(record.normalizedData),
      };
    }
  } else if (record.recordType === 'Benefit') {
    // Validate benefit-specific required fields exist in normalized data
    const { cardName, issuer, benefitName } = record.normalizedData;

    if (!cardName || typeof cardName !== 'string' || !cardName.trim()) {
      throw new AppError('VALIDATION_FIELD', {
        field: 'cardName',
        rowNumber: record.rowNumber,
        reason: 'Card name is missing or invalid in normalized data',
        suggestion: 'Ensure card name was properly validated',
      });
    }

    if (!issuer || typeof issuer !== 'string' || !issuer.trim()) {
      throw new AppError('VALIDATION_FIELD', {
        field: 'issuer',
        rowNumber: record.rowNumber,
        reason: 'Issuer is missing or invalid in normalized data',
        suggestion: 'Ensure issuer was properly validated',
      });
    }

    if (!benefitName || typeof benefitName !== 'string' || !benefitName.trim()) {
      throw new AppError('VALIDATION_FIELD', {
        field: 'benefitName',
        rowNumber: record.rowNumber,
        reason: 'Benefit name is missing or invalid in normalized data',
        suggestion: 'Ensure benefit name was properly validated',
      });
    }

    // First, find or create the card
    const masterCard = await tx.masterCard.findFirst({
      where: {
        cardName,
        issuer,
      },
    });

    if (!masterCard) {
      throw new AppError('RESOURCE_NOT_FOUND', {
        resource: 'MasterCard',
        cardName,
        issuer,
      });
    }

    const userCard = await tx.userCard.findFirst({
      where: {
        playerId,
        masterCardId: masterCard.id,
      },
    });

    if (!userCard) {
      throw new AppError('RESOURCE_NOT_FOUND', {
        resource: 'UserCard',
        cardName,
      });
    }

    const { id, action: resultAction } = await commitBenefit(
      tx,
      playerId,
      userCard.id,
      benefitName,
      record.normalizedData,
      action as 'Create' | 'Update',
      importJobId
    );

    if (resultAction === 'Create') {
      return {
        createdBenefitId: id,
        action: 'Created',
        appliedData: JSON.stringify(record.normalizedData),
      };
    } else {
      return {
        updatedBenefitId: id,
        action: 'Updated',
        appliedData: JSON.stringify(record.normalizedData),
      };
    }
  }

  return { action: 'Skipped' };
}

// ============================================================================
// Main Commit Function
// ============================================================================

/**
 * Commits all validated records to the database in a transaction
 *
 * @param options Import operation options
 * @returns CommitResult on success, CommitError on failure
 *
 * The transaction:
 * 1. Processes each record in order
 * 2. Creates/updates cards and benefits
 * 3. Creates ImportRecord entries for audit
 * 4. Rolls back entire transaction if any error occurs
 * 5. Updates ImportJob status after commit
 */
export async function commitImport(
  options: CommitterOptions
): Promise<CommitOperationResult> {
  const { importJobId, playerId, records } = options;

  try {
    // Execute all operations in a single atomic transaction
    // This ensures data and status updates both succeed or both fail together
    const result = await prisma.$transaction(
      async (tx) => {
        let cardsCreated = 0;
        let cardsUpdated = 0;
        let benefitsCreated = 0;
        let benefitsUpdated = 0;
        let recordsSkipped = 0;

        // Process each record
        for (const record of records) {
          const processed = await processRecord(tx, record, importJobId, playerId);

          // Update ImportRecord with results
          await tx.importRecord.update({
            where: { id: record.id },
            data: {
              status: 'Applied',
              createdCardId: processed.createdCardId,
              createdBenefitId: processed.createdBenefitId,
              updatedCardId: processed.updatedCardId,
              updatedBenefitId: processed.updatedBenefitId,
              appliedData: processed.appliedData,
              appliedAt: new Date(),
            },
          });

          // Update counters
          if (processed.action === 'Created') {
            if (record.recordType === 'Card') {
              cardsCreated++;
            } else {
              benefitsCreated++;
            }
          } else if (processed.action === 'Updated') {
            if (record.recordType === 'Card') {
              cardsUpdated++;
            } else {
              benefitsUpdated++;
            }
          } else {
            recordsSkipped++;
          }
        }

        // UPDATE IMPORT JOB STATUS INSIDE TRANSACTION
        // This ensures status update happens atomically with data commit
        await tx.importJob.update({
          where: { id: importJobId },
          data: {
            status: 'Committed',
            processedRecords:
              cardsCreated + cardsUpdated + benefitsCreated + benefitsUpdated,
            cardsCreated,
            cardsUpdated,
            benefitsCreated,
            benefitsUpdated,
            skippedRecords: recordsSkipped,
            committedAt: new Date(),
            completedAt: new Date(),
          },
        });

        return {
          cardsCreated,
          cardsUpdated,
          benefitsCreated,
          benefitsUpdated,
          recordsSkipped,
          totalProcessed: records.length,
        };
      },
      {
        // Configure transaction timeout and isolation level
        maxWait: 60000, // 60 seconds
        timeout: 120000, // 120 seconds
      }
    );

    return {
      success: true,
      cardsCreated: result.cardsCreated,
      cardsUpdated: result.cardsUpdated,
      benefitsCreated: result.benefitsCreated,
      benefitsUpdated: result.benefitsUpdated,
      recordsSkipped: result.recordsSkipped,
      totalProcessed: result.totalProcessed,
    };
  } catch (error) {
    // Transaction automatically rolls back on error
    // Update ImportJob to failed state
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    try {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'Failed',
          errorLog: JSON.stringify({
            error: errorMessage,
            timestamp: new Date(),
          }),
          completedAt: new Date(),
        },
      });
    } catch (updateError) {
      // Silently fail if we can't update status
      console.error('Failed to update ImportJob status:', updateError);
    }

    return {
      success: false,
      error: 'Import commit failed',
      code: 'IMPORT_COMMIT_FAILED',
      details: {
        reason: errorMessage,
      },
      rollback: true,
    };
  }
}
