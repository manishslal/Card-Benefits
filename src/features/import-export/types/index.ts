/**
 * Type definitions for import/export feature
 * 
 * Re-exports all type definitions from consolidated schema files for backward compatibility
 * and clean public API
 */

// Export all export-related types from schema
export type {
  ExportOptions,
  ExportRequest,
  ExportResult,
  ExportHistoryEntry,
  ExportMetadata,
} from '../lib/schema';
export { CARD_EXPORT_FIELDS, BENEFIT_EXPORT_FIELDS, PERIOD_FIELD_IDS } from '../lib/schema';

// Export all import-related types from schema-import
export type {
  ImportRecordData,
  ColumnMapping,
  ImportSummary,
  ImportPreview,
  ImportResult,
  ValidationError,
  DuplicateResolution,
} from '../lib/schema-import';

// Export parser types
export type { ParsedRow, ParseResult, ParseError, ParserResult } from '../lib/parser';

// Export validator types
export type { ValidationResult } from '../lib/validator';

// Export other utility types
export type { CommitterOptions, CommitResult, CommitError, CommitOperationResult } from '../lib/committer';
export type { DuplicateMatch, DuplicateCheckResult } from '../lib/duplicate-detector';
export type { XLSXCell, XLSXFormatOptions } from '../lib/xlsx-formatter';
export type { CSVRow, CSVFormatOptions } from '../lib/csv-formatter';


