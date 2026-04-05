/**
 * Type definitions and schemas for export operations
 *
 * Defines:
 * - Export configuration options
 * - Field selection and formatting
 * - Export history tracking
 * - Result metadata
 */

// ============================================================================
// Export Configuration
// ============================================================================

export interface ExportOptions {
  format: 'CSV' | 'XLSX';
  recordType: 'Card' | 'Benefit' | 'All';
  selectedFields: string[];
  includeHeaders: boolean;
  dateFormat: 'ISO' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  monetaryFormat: 'Cents' | 'Dollars';
  includeEmptyFields: boolean;
  compression?: 'none' | 'gzip';
}

// ============================================================================
// Field Definitions
// ============================================================================

export const CARD_EXPORT_FIELDS = [
  { id: 'cardName', label: 'Card Name', type: 'string' },
  { id: 'issuer', label: 'Issuer', type: 'string' },
  { id: 'annualFee', label: 'Annual Fee', type: 'monetary' },
  { id: 'renewalDate', label: 'Renewal Date', type: 'date' },
  { id: 'customName', label: 'Custom Name', type: 'string' },
  { id: 'status', label: 'Status', type: 'enum' },
  { id: 'createdAt', label: 'Created Date', type: 'date' },
  { id: 'updatedAt', label: 'Updated Date', type: 'date' },
] as const;

export const BENEFIT_EXPORT_FIELDS = [
  { id: 'cardName', label: 'Card Name', type: 'string' },
  { id: 'issuer', label: 'Issuer', type: 'string' },
  { id: 'benefitName', label: 'Benefit Name', type: 'string' },
  { id: 'benefitType', label: 'Benefit Type', type: 'enum' },
  { id: 'stickerValue', label: 'Sticker Value', type: 'monetary' },
  { id: 'declaredValue', label: 'Declared Value', type: 'monetary' },
  { id: 'expirationDate', label: 'Expiration Date', type: 'date' },
  { id: 'usage', label: 'Usage', type: 'enum' },
  { id: 'createdAt', label: 'Created Date', type: 'date' },
  { id: 'updatedAt', label: 'Updated Date', type: 'date' },
] as const;

// ============================================================================
// Export Request/Response
// ============================================================================

export interface ExportRequest {
  playerId: string;
  format: 'CSV' | 'XLSX';
  recordType: 'Card' | 'Benefit' | 'All';
  selectedFields: string[];
  dateFormat?: 'ISO' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  monetaryFormat?: 'Cents' | 'Dollars';
  includeHeaders?: boolean;
}

export interface ExportResult {
  exportId: string;
  playerId: string;
  format: 'CSV' | 'XLSX';
  recordType: 'Card' | 'Benefit' | 'All';
  totalRecords: number;
  cardsExported: number;
  benefitsExported: number;
  fileSize: number;
  fileHash: string;
  createdAt: Date;
  expiresAt: Date;
  downloadUrl: string;
}

// ============================================================================
// Export History
// ============================================================================

export interface ExportHistoryEntry {
  id: string;
  playerId: string;
  format: 'CSV' | 'XLSX';
  recordType: string;
  cardsExported: number;
  benefitsExported: number;
  totalRecords: number;
  fileSize: number;
  exportedAt: Date;
}

// ============================================================================
// Export Metadata
// ============================================================================

export interface ExportMetadata {
  version: string;
  exportFormat: 'CSV' | 'XLSX';
  recordType: string;
  totalRecords: number;
  cardsCount: number;
  benefitsCount: number;
  generatedAt: string;
  playerId: string;
  fieldCount: number;
}
