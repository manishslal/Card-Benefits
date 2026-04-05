/**
 * Main export engine
 *
 * Orchestrates:
 * - Data retrieval from database
 * - Field selection and filtering
 * - Format-specific generation (CSV/XLSX)
 * - Export history tracking
 * - Performance optimization for large datasets
 */

import { prisma } from '@/shared/lib';
import { AppError } from '@/shared/lib';
import { generateCSV } from './csv-formatter';
import { generateXLSX, generateXLSXMultiSheet } from './xlsx-formatter';
import { ExportRequest, CARD_EXPORT_FIELDS, BENEFIT_EXPORT_FIELDS } from './schema';
import crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ExportData {
  format: 'CSV' | 'XLSX';
  content: string | Uint8Array;
  fileSize: number;
  fileHash: string;
  cardsCount: number;
  benefitsCount: number;
}

// ============================================================================
// Data Retrieval
// ============================================================================

/**
 * Retrieves card data for export
 *
 * Fetches all cards with their associated MasterCard info
 */
async function getCardData(playerId: string): Promise<any[]> {
  const cards = await prisma.userCard.findMany({
    where: { playerId },
    include: {
      masterCard: {
        select: {
          cardName: true,
          issuer: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return cards.map((card) => ({
    cardName: card.masterCard.cardName,
    issuer: card.masterCard.issuer,
    annualFee: card.actualAnnualFee,
    renewalDate: card.renewalDate,
    customName: card.customName,
    status: card.isOpen ? 'Active' : 'Inactive',
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  }));
}

/**
 * Retrieves benefit data for export
 *
 * Fetches all benefits with their associated card info
 */
async function getBenefitData(playerId: string): Promise<any[]> {
  const benefits = await prisma.userBenefit.findMany({
    where: { playerId },
    include: {
      userCard: {
        include: {
          masterCard: {
            select: {
              cardName: true,
              issuer: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return benefits.map((benefit) => ({
    cardName: benefit.userCard.masterCard.cardName,
    issuer: benefit.userCard.masterCard.issuer,
    benefitName: benefit.name,
    benefitType: benefit.type,
    stickerValue: benefit.stickerValue,
    declaredValue: benefit.userDeclaredValue,
    expirationDate: benefit.expirationDate,
    usage: benefit.isUsed ? 'Claimed' : 'Unused',
    createdAt: benefit.createdAt,
    updatedAt: benefit.updatedAt,
  }));
}

// ============================================================================
// Field Selection and Formatting
// ============================================================================

/**
 * Filters row to only selected fields
 */
function selectFields(row: any, selectedFields: string[]): any {
  const result: any = {};
  for (const field of selectedFields) {
    result[field] = row[field] ?? null;
  }
  return result;
}

/**
 * Converts array of objects to array of arrays with selected fields
 */
function dataToArrays(data: any[], selectedFields: string[]): [string[], any[][]] {
  const rows = data.map((row) => selectedFields.map((field) => row[field] ?? ''));
  return [selectedFields, rows];
}

// ============================================================================
// File Hashing and Size
// ============================================================================

/**
 * Calculates SHA-256 hash of content
 */
function hashContent(content: string | Uint8Array): string {
  let buffer: Buffer;

  if (typeof content === 'string') {
    buffer = Buffer.from(content, 'utf-8');
  } else {
    buffer = Buffer.from(content);
  }

  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Gets file size in bytes
 */
function getFileSize(content: string | Uint8Array): number {
  if (typeof content === 'string') {
    return Buffer.byteLength(content, 'utf-8');
  }
  return content.byteLength;
}

// ============================================================================
// Export Generation
// ============================================================================

/**
 * Generates export for cards
 */
async function exportCards(
  playerId: string,
  selectedFields: string[],
  format: 'CSV' | 'XLSX'
): Promise<{ content: string | Uint8Array; cardsCount: number }> {
  // Get card data
  const cardData = await getCardData(playerId);

  if (cardData.length === 0) {
    throw new AppError('VALIDATION_FIELD', {
      field: 'cardData',
      reason: 'No cards found to export',
      suggestion: 'Add at least one card before exporting',
    });
  }

  // Filter to selected fields
  const filteredData = cardData.map((row) => selectFields(row, selectedFields));

  // Generate content based on format
  let content: string | Uint8Array;

  if (format === 'CSV') {
    const fieldDefs = CARD_EXPORT_FIELDS.filter((f) => selectedFields.includes(f.id));
    content = generateCSV(filteredData, fieldDefs, selectedFields, {
      includeHeaders: true,
      dateFormat: 'ISO',
      monetaryFormat: 'Dollars',
      includeEmptyFields: false,
    });
  } else {
    const fieldDefs = CARD_EXPORT_FIELDS.filter((f) => selectedFields.includes(f.id));
    const [, arrays] = dataToArrays(filteredData, selectedFields);
    content = generateXLSX('Cards', selectedFields, arrays, fieldDefs);
  }

  return { content, cardsCount: cardData.length };
}

/**
 * Generates export for benefits
 */
async function exportBenefits(
  playerId: string,
  selectedFields: string[],
  format: 'CSV' | 'XLSX'
): Promise<{ content: string | Uint8Array; benefitsCount: number }> {
  // Get benefit data
  const benefitData = await getBenefitData(playerId);

  if (benefitData.length === 0) {
    throw new AppError('VALIDATION_FIELD', {
      field: 'benefitData',
      reason: 'No benefits found to export',
      suggestion: 'Add at least one benefit before exporting',
    });
  }

  // Filter to selected fields
  const filteredData = benefitData.map((row) => selectFields(row, selectedFields));

  // Generate content based on format
  let content: string | Uint8Array;

  if (format === 'CSV') {
    const fieldDefs = BENEFIT_EXPORT_FIELDS.filter((f) => selectedFields.includes(f.id));
    content = generateCSV(filteredData, fieldDefs, selectedFields, {
      includeHeaders: true,
      dateFormat: 'ISO',
      monetaryFormat: 'Dollars',
      includeEmptyFields: false,
    });
  } else {
    const fieldDefs = BENEFIT_EXPORT_FIELDS.filter((f) => selectedFields.includes(f.id));
    const [, arrays] = dataToArrays(filteredData, selectedFields);
    content = generateXLSX('Benefits', selectedFields, arrays, fieldDefs);
  }

  return { content, benefitsCount: benefitData.length };
}

/**
 * Generates export for all data (cards and benefits)
 */
async function exportAll(
  playerId: string,
  cardSelectedFields: string[],
  benefitSelectedFields: string[],
  format: 'CSV' | 'XLSX'
): Promise<{ content: string | Uint8Array; cardsCount: number; benefitsCount: number }> {
  // Get both data sets
  const [cardData, benefitData] = await Promise.all([getCardData(playerId), getBenefitData(playerId)]);

  if (cardData.length === 0 && benefitData.length === 0) {
    throw new AppError('VALIDATION_FIELD', {
      field: 'exportData',
      reason: 'No cards or benefits found to export',
      suggestion: 'Add at least one card or benefit before exporting',
    });
  }

  let content: string | Uint8Array;

  if (format === 'CSV') {
    // For CSV, we export cards first, then benefits (concatenated)
    const filteredCards = cardData.map((row) => selectFields(row, cardSelectedFields));
    const filteredBenefits = benefitData.map((row) => selectFields(row, benefitSelectedFields));

    const cardFieldDefs = CARD_EXPORT_FIELDS.filter((f) => cardSelectedFields.includes(f.id));
    const benefitFieldDefs = BENEFIT_EXPORT_FIELDS.filter((f) => benefitSelectedFields.includes(f.id));

    const cardCSV = generateCSV(filteredCards, cardFieldDefs, cardSelectedFields, {
      includeHeaders: true,
      dateFormat: 'ISO',
      monetaryFormat: 'Dollars',
      includeEmptyFields: false,
    });

    const benefitCSV = generateCSV(filteredBenefits, benefitFieldDefs, benefitSelectedFields, {
      includeHeaders: true,
      dateFormat: 'ISO',
      monetaryFormat: 'Dollars',
      includeEmptyFields: false,
    });

    // Combine with section separator
    content = `${cardCSV}\n\n--- Benefits ---\n${benefitCSV}`;
  } else {
    // For XLSX, create multiple sheets
    const filteredCards = cardData.map((row) => selectFields(row, cardSelectedFields));
    const filteredBenefits = benefitData.map((row) => selectFields(row, benefitSelectedFields));

    const cardFieldDefs = CARD_EXPORT_FIELDS.filter((f) => cardSelectedFields.includes(f.id));
    const benefitFieldDefs = BENEFIT_EXPORT_FIELDS.filter((f) => benefitSelectedFields.includes(f.id));

    const [, cardArrays] = dataToArrays(filteredCards, cardSelectedFields);
    const [, benefitArrays] = dataToArrays(filteredBenefits, benefitSelectedFields);

    content = generateXLSXMultiSheet(
      cardSelectedFields,
      cardArrays,
      benefitSelectedFields,
      benefitArrays,
      cardFieldDefs,
      benefitFieldDefs
    );
  }

  return { content, cardsCount: cardData.length, benefitsCount: benefitData.length };
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generates export and returns export metadata
 *
 * @param request Export request with options
 * @returns Export result with file info
 */
export async function generateExport(request: ExportRequest): Promise<ExportData> {
  const { playerId, format, recordType, selectedFields } = request;

  try {
    let exportResult;

    // Generate based on record type
    if (recordType === 'Card') {
      const cardFields = selectedFields.length > 0 ? selectedFields : CARD_EXPORT_FIELDS.map((f) => f.id);
      exportResult = await exportCards(playerId, cardFields, format);
    } else if (recordType === 'Benefit') {
      const benefitFields = selectedFields.length > 0 ? selectedFields : BENEFIT_EXPORT_FIELDS.map((f) => f.id);
      exportResult = await exportBenefits(playerId, benefitFields, format);
    } else {
      // All
      const cardFields = selectedFields.length > 0 ? selectedFields : CARD_EXPORT_FIELDS.map((f) => f.id);
      const benefitFields = selectedFields.length > 0 ? selectedFields : BENEFIT_EXPORT_FIELDS.map((f) => f.id);
      exportResult = await exportAll(playerId, cardFields, benefitFields, format);
    }

    // Calculate metadata
    const fileSize = getFileSize(exportResult.content);
    const fileHash = hashContent(exportResult.content);

    return {
      format,
      content: exportResult.content,
      fileSize,
      fileHash,
      cardsCount: (exportResult as any).cardsCount ?? 0,
      benefitsCount: (exportResult as any).benefitsCount ?? 0,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('INTERNAL_ERROR', {
      reason: error instanceof Error ? error.message : 'Unknown export error',
    });
  }
}

/**
 * Retrieves export history for a player
 * 
 * Note: Full export history tracking requires ExportJob model addition to Prisma schema.
 * For MVP, returning empty array. History feature coming in follow-up.
 */
export async function getExportHistory(_playerId: string) {
  // TODO: Implement full export history tracking
  // This requires adding an ExportJob model to prisma/schema.prisma
  // and a migration to create the exports table
  return [];
}
