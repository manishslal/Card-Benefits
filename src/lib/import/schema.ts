/**
 * Type definitions and schemas for import operations
 */

import { ParsedRow } from './parser';

// ============================================================================
// Import Record Types
// ============================================================================

export interface ImportRecordData {
  id: string;
  rowNumber: number;
  recordType: 'Card' | 'Benefit';
  sequenceIndex: number;
  data: ParsedRow;
  normalizedData?: Record<string, any>;
  status: 'Valid' | 'Error' | 'Warning' | 'Duplicate' | 'Skipped' | 'Applied';
  errors: Array<{
    field: string;
    message: string;
    severity: 'critical' | 'warning';
    suggestion: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    severity: 'critical' | 'warning';
    suggestion: string;
  }>;
  isDuplicate: boolean;
  duplicateOf?: string;
  userResolution?: 'Skip' | 'Update' | 'Merge';
  createdCardId?: string;
  createdBenefitId?: string;
  updatedCardId?: string;
  updatedBenefitId?: string;
}

// ============================================================================
// Column Mapping
// ============================================================================

export interface ColumnMapping {
  [fileHeader: string]: {
    fileIndex: number;
    systemField: string;
    confidence: number;
    detectionType: 'exact' | 'fuzzy' | 'unknown';
  };
}

// ============================================================================
// Import Summary
// ============================================================================

export interface ImportSummary {
  totalRecords: number;
  validRecords: number;
  warningRecords: number;
  errorRecords: number;
  cardsToCreate: number;
  cardsToUpdate: number;
  cardsToSkip: number;
  benefitsToCreate: number;
  benefitsToUpdate: number;
  benefitsToSkip: number;
  estimatedDuplicates: number;
  canProceed: boolean;
}

// ============================================================================
// Import Preview
// ============================================================================

export interface ImportPreview {
  totalRecords: number;
  cardsToCreate: number;
  cardsToUpdate: number;
  cardsToSkip: number;
  benefitsToCreate: number;
  benefitsToUpdate: number;
  benefitsToSkip: number;
  estimatedImpact: {
    cardsBeforeImport: number;
    cardsAfterImport: number;
    benefitsBeforeImport: number;
    benefitsAfterImport: number;
    newAnnualValue: number;
    projectedROIChange: number;
  };
  preview: Array<{
    id: string;
    rowNumber: number;
    action: 'Create' | 'Update' | 'Skip';
    recordType: 'Card' | 'Benefit';
    data: Record<string, any>;
  }>;
  previewLimit: number;
  hasMorePreviewRecords: boolean;
  readyToCommit: boolean;
}

// ============================================================================
// Import Result
// ============================================================================

export interface ImportResult {
  importJobId: string;
  status: string;
  results: {
    cardsCreated: number;
    cardsUpdated: number;
    benefitsCreated: number;
    benefitsUpdated: number;
    recordsSkipped: number;
    totalProcessed: number;
    totalRecords: number;
  };
  committedAt: string;
  summary: string;
  auditTrail: {
    importedBy: string;
    importedFor: string;
    importedAt: string;
    fileHash?: string;
  };
}

// ============================================================================
// Error/Warning Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'warning';
  suggestion: string;
}

// ============================================================================
// Duplicate Resolution
// ============================================================================

export interface DuplicateResolution {
  duplicateId: string;
  action: 'Skip' | 'Update' | 'Merge';
  fieldsToUpdate?: string[];
}

export type { ParsedRow };
