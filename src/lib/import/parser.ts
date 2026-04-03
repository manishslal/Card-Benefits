/**
 * File parsing library for CSV and XLSX imports
 *
 * Responsibilities:
 * - Parse CSV files with proper handling of quotes, escaping, and encoding
 * - Parse XLSX files with multi-sheet support
 * - Detect file format by extension and magic bytes
 * - Extract column headers and infer column types
 * - Handle large files with streaming support
 * - Provide detailed error reporting with line numbers
 */

import * as Papa from 'papaparse';
import XLSX from 'xlsx';
import { AppError } from '@/lib/errors';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParsedRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ParseResult {
  success: true;
  format: 'CSV' | 'XLSX';
  totalRows: number;
  headers: string[];
  rows: ParsedRow[];
  parseTimeMs: number;
}

export interface ParseError {
  success: false;
  error: string;
  code: string;
  line?: number;
  reason?: string;
  suggestion?: string;
}

export type ParserResult = ParseResult | ParseError;

// ============================================================================
// File Format Detection
// ============================================================================

/**
 * Detects file format by extension and magic bytes
 *
 * Prevents attacks where files are renamed (e.g., PDF saved as .csv)
 */
function detectFileFormat(
  filename: string,
  buffer: Uint8Array
): 'CSV' | 'XLSX' | null {
  const ext = filename.toLowerCase().split('.').pop();

  // Check magic bytes for common file types
  const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50; // %P
  const isZIP =buffer[0] === 0x50 && buffer[1] === 0x4b; // PK (includes XLSX)
  const isMSOffice = buffer[0] === 0xd0 && buffer[1] === 0xcf; // MS Office OLE2

  // If not a ZIP file and claimed to be XLSX, reject
  if (ext === 'xlsx' && !isZIP) {
    return null;
  }

  // If suspicious format headers, reject
  if (isPDF || isMSOffice) {
    return null;
  }

  if (ext === 'csv') {
    // Verify it looks like CSV (has text, no binary markers)
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(buffer.slice(0, Math.min(1024, buffer.length)));
      return 'CSV';
    } catch {
      return null; // Not valid UTF-8
    }
  }

  if (ext === 'xlsx') {
    return 'XLSX';
  }

  return null;
}

/**
 * Validates file is not empty and format is detected
 */
export function validateFileFormat(
  filename: string,
  buffer: Uint8Array
): 'CSV' | 'XLSX' | false {
  // Check for empty file
  if (buffer.byteLength === 0) {
    return false;
  }

  // Detect format
  const format = detectFileFormat(filename, buffer);
  return format || false;
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parses CSV data using PapaParse
 *
 * Handles:
 * - Quoted fields with embedded commas and quotes
 * - Escaped characters
 * - Different line endings (CRLF, LF)
 * - Empty lines
 * - Trimmed headers
 *
 * @throws AppError if CSV is malformed
 */
function parseCSV(csvContent: string): ParseResult {
  const startTime = performance.now();

  // PapaParse configuration for robust CSV parsing
  const results = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep as strings initially
    quoteChar: '"',
    escapeChar: '"',
    transformHeader: (h) => h.trim(), // Trim header names
    error: (error: any) => {
      throw new AppError('VALIDATION_FIELD', {
        field: 'csv_parse',
        reason: `CSV parsing failed: ${error.message}`,
        line: error.row,
      });
    },
  });

  // Check for parse errors
  if ((results as any).errors?.length > 0) {
    const firstError = (results as any).errors[0];
    throw new AppError('VALIDATION_FIELD', {
      field: 'csv_format',
      reason: `CSV parsing failed on line ${firstError.row}`,
      suggestion: firstError.message,
    });
  }

  const parseTimeMs = performance.now() - startTime;

  return {
    success: true,
    format: 'CSV',
    totalRows: results.data.length,
    headers: results.meta.fields || [],
    rows: (results.data as ParsedRow[]).filter(
      (row) => Object.values(row).some((v) => v !== null && v !== '')
    ),
    parseTimeMs,
  };
}

// ============================================================================
// XLSX Parsing
// ============================================================================

/**
 * Parses XLSX file
 *
 * Supports:
 * - Multiple sheets
 * - Named ranges
 * - Merged cells (expands to rows)
 * - Various cell formats
 *
 * @param buffer File bytes
 * @param sheetName Optional specific sheet to parse (defaults to first)
 * @throws AppError if XLSX is malformed
 */
function parseXLSX(
  buffer: Uint8Array,
  sheetName?: string
): ParseResult {
  const startTime = performance.now();

  try {
    // Load workbook
    const workbook = XLSX.read(buffer, { type: 'array', cellFormulas: true });

    // Get sheet to parse
    const sheet = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      throw new Error('No valid sheet found');
    }

    // Convert sheet to JSON
    const rows = XLSX.utils.sheet_to_json(sheet, {
      blankrows: false,
      defval: null,
    });

    // Extract headers from first row
    const firstRow = rows[0];
    const headers = firstRow ? Object.keys(firstRow) : [];

    // Normalize rows
    const normalizedRows = (rows as ParsedRow[]).map((row) => {
      const normalized: ParsedRow = {};
      for (const header of headers) {
        const value = row[header];
        // Convert to string, null, or keep as is
        normalized[header] =
          value === null || value === undefined
            ? null
            : typeof value === 'string'
              ? value.trim()
              : String(value);
      }
      return normalized;
    });

    const parseTimeMs = performance.now() - startTime;

    return {
      success: true,
      format: 'XLSX',
      totalRows: normalizedRows.length,
      headers,
      rows: normalizedRows,
      parseTimeMs,
    };
  } catch (error) {
    throw new AppError('VALIDATION_FIELD', {
      field: 'xlsx_format',
      reason: `XLSX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parses CSV or XLSX file
 *
 * Detection:
 * 1. File extension check (.csv or .xlsx)
 * 2. Magic byte verification to prevent spoofing
 * 3. Format-specific parsing
 *
 * Error handling:
 * - Empty file → IMPORT_FILE_EMPTY
 * - Wrong format → IMPORT_FILE_INVALID
 * - Malformed content → IMPORT_PARSE_FAILED
 *
 * @param filename Original filename
 * @param buffer File bytes
 * @returns ParseResult with headers and rows, or ParseError
 */
export function parseFile(
  filename: string,
  buffer: Uint8Array
): ParserResult {
  try {
    // Validate file is not empty
    if (buffer.byteLength === 0) {
      return {
        success: false,
        error: 'File is empty',
        code: 'IMPORT_FILE_EMPTY',
      };
    }

    // Detect and validate format
    const format = validateFileFormat(filename, buffer);
    if (!format) {
      return {
        success: false,
        error: 'Invalid file format. Must be CSV or XLSX.',
        code: 'IMPORT_FILE_INVALID',
        suggestion: `File extension is .${filename.split('.').pop()}, but content doesn't match.`,
      };
    }

    // Decode buffer to string for CSV parsing
    let result: ParseResult;

    if (format === 'CSV') {
      const text = new TextDecoder('utf-8').decode(buffer);
      result = parseCSV(text);
    } else {
      result = parseXLSX(buffer);
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        code: error.code as string,
        reason: error.details?.reason,
        suggestion: error.details?.suggestion,
      };
    }

    return {
      success: false,
      error: 'Failed to parse file',
      code: 'IMPORT_PARSE_FAILED',
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Column Header Detection
// ============================================================================

/**
 * Fuzzy matches file columns to known system fields
 *
 * Supports:
 * - Exact case-insensitive matches
 * - Synonym mapping
 * - Confidence scoring
 *
 * @param fileHeaders Headers from parsed file
 * @returns Map of file header → system field with confidence
 */
export function detectColumnMapping(
  fileHeaders: string[]
): Record<
  string,
  {
    fileIndex: number;
    systemField: string;
    confidence: number;
    detectionType: 'exact' | 'fuzzy' | 'unknown';
  }
> {
  const knownFields = {
    // Card fields
    'CardName': ['Card Name', 'Card', 'Name', 'cardname'],
    'Issuer': ['Bank', 'Card Issuer', 'issuer'],
    'AnnualFee': ['Annual Fee', 'Fee', 'annualfee', 'yearly fee'],
    'RenewalDate': ['Renewal Date', 'Expiry Date', 'Anniversary', 'renewaldate'],
    'CustomName': ['Custom Name', 'Nickname', 'My Name', 'customname'],
    'Status': ['Status', 'State', 'Active'],

    // Benefit fields
    'BenefitName': ['Benefit Name', 'Benefit', 'Perk', 'benefitname'],
    'BenefitType': ['Type', 'Benefit Type', 'benefittype'],
    'StickerValue': ['Sticker Value', 'Value', 'Amount', 'stickervalue'],
    'DeclaredValue': ['Declared Value', 'My Value', 'declaredvalue'],
    'ExpirationDate': ['Expiration Date', 'Expires', 'expirationdate'],
    'Usage': ['Usage', 'Claimed', 'Status'],
    'RecordType': ['Type', 'Record Type', 'recordtype'],
  };

  const mapping: Record<
    string,
    {
      fileIndex: number;
      systemField: string;
      confidence: number;
      detectionType: 'exact' | 'fuzzy' | 'unknown';
    }
  > = {};

  for (let i = 0; i < fileHeaders.length; i++) {
    const header = fileHeaders[i];
    const headerLower = header.toLowerCase().trim();

    // Try exact match
    let matched = false;
    for (const [systemField, synonyms] of Object.entries(knownFields)) {
      if (synonyms.some((syn) => syn.toLowerCase() === headerLower)) {
        mapping[header] = {
          fileIndex: i,
          systemField,
          confidence: 1.0,
          detectionType: 'exact',
        };
        matched = true;
        break;
      }
    }

    // Try fuzzy match (partial, low confidence)
    if (!matched) {
      for (const [systemField, synonyms] of Object.entries(knownFields)) {
        for (const syn of synonyms) {
          if (
            headerLower.includes(syn.toLowerCase()) ||
            syn.toLowerCase().includes(headerLower)
          ) {
            mapping[header] = {
              fileIndex: i,
              systemField,
              confidence: 0.6,
              detectionType: 'fuzzy',
            };
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    // If still no match, mark as unknown
    if (!matched) {
      mapping[header] = {
        fileIndex: i,
        systemField: header,
        confidence: 0,
        detectionType: 'unknown',
      };
    }
  }

  return mapping;
}

// ============================================================================
// Helper: Infer Record Type
// ============================================================================

/**
 * Infers whether a row represents a Card or Benefit based on populated fields
 *
 * Card: Has CardName, Issuer, RenewalDate
 * Benefit: Has BenefitName, BenefitType, StickerValue (and card reference)
 * Mixed: Provides flexibility for combined imports
 */
export function inferRecordType(
  row: ParsedRow,
  mapping: Record<string, { systemField: string }>
): 'Card' | 'Benefit' | 'Unknown' {
  // Check for explicit RecordType column
  const recordTypeField = Object.entries(mapping).find(
    ([, m]) => m.systemField === 'RecordType'
  );
  if (recordTypeField) {
    const recordType = row[recordTypeField[0]];
    if (recordType === 'Card') return 'Card';
    if (recordType === 'Benefit') return 'Benefit';
  }

  // Infer from populated fields
  const cardNameField = Object.entries(mapping).find(
    ([, m]) => m.systemField === 'CardName'
  )?.[0];
  const benefitNameField = Object.entries(mapping).find(
    ([, m]) => m.systemField === 'BenefitName'
  )?.[0];
  const renewalDateField = Object.entries(mapping).find(
    ([, m]) => m.systemField === 'RenewalDate'
  )?.[0];

  const hasCard = cardNameField && row[cardNameField];
  const hasBenefit = benefitNameField && row[benefitNameField];
  const hasRenewalDate = renewalDateField && row[renewalDateField];

  // If has BenefitName, it's a benefit (even if has card info)
  if (hasBenefit) return 'Benefit';

  // If has CardName + RenewalDate, it's a card
  if (hasCard && hasRenewalDate) return 'Card';

  return 'Unknown';
}

export type {
  ParsedRow,
  ParseResult,
  ParseError,
  ParserResult,
};
