/**
 * CSV formatter for exporting card and benefit data
 *
 * Handles:
 * - Field selection and ordering
 * - Proper CSV escaping and quoting
 * - Header row generation
 * - Field formatting (dates, monetary values)
 * - Large file streaming (10k+ records)
 */

import { ExportOptions } from './schema';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CSVRow {
  [key: string]: string | number | null | undefined;
}

export interface CSVFormatOptions {
  includeHeaders: boolean;
  dateFormat: 'ISO' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  monetaryFormat: 'Cents' | 'Dollars';
  includeEmptyFields: boolean;
}

// ============================================================================
// CSV Escaping and Formatting
// ============================================================================

/**
 * Escapes a field value for CSV output
 *
 * CSV RFC 4180 rules:
 * - If field contains comma, quote, or newline: wrap in double quotes
 * - Double quotes within field: escape as double double-quotes
 *
 * @param value Field value to escape
 * @returns Escaped CSV field
 */
function escapeCSVField(value: any): string {
  // Convert to string
  let str = value === null || value === undefined ? '' : String(value);

  // Check if escaping needed
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape double quotes by doubling them
    str = str.replace(/"/g, '""');
    // Wrap in quotes
    return `"${str}"`;
  }

  return str;
}

/**
 * Formats a date value for CSV export
 *
 * @param date Date to format
 * @param format Format preference ('ISO' | 'MM/DD/YYYY' | 'DD/MM/YYYY')
 * @returns Formatted date string
 */
function formatDateField(date: Date | null | undefined, format: string): string {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  switch (format) {
    case 'MM/DD/YYYY': {
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const year = d.getFullYear();
      return `${month}/${day}/${year}`;
    }
    case 'DD/MM/YYYY': {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    default: // ISO
      return d.toISOString().split('T')[0];
  }
}

/**
 * Formats a monetary value for CSV export
 *
 * @param cents Amount in cents
 * @param format Format preference ('Cents' | 'Dollars')
 * @returns Formatted monetary string
 */
function formatMonetaryField(cents: number | null | undefined, format: string): string {
  if (cents === null || cents === undefined) return '';

  if (format === 'Dollars') {
    // Convert cents to dollars with 2 decimal places
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  }

  // Format as cents
  return String(cents);
}

/**
 * Formats a field value based on its type
 *
 * @param value Field value
 * @param fieldType Type of field ('string' | 'date' | 'monetary' | 'enum')
 * @param options Formatting options
 * @returns Formatted field value
 */
function formatField(
  value: any,
  fieldType: string,
  options: CSVFormatOptions
): string {
  if (value === null || value === undefined) return '';

  switch (fieldType) {
    case 'date':
      return formatDateField(value instanceof Date ? value : new Date(value), options.dateFormat);

    case 'monetary':
      return formatMonetaryField(typeof value === 'number' ? value : parseInt(value, 10), options.monetaryFormat);

    case 'enum':
    case 'string':
    default:
      return String(value);
  }
}

// ============================================================================
// CSV Generation
// ============================================================================

/**
 * Generates a CSV header row from selected field names
 *
 * @param fieldNames Selected field names
 * @returns CSV header row
 */
export function generateCSVHeader(fieldNames: string[]): string {
  const escaped = fieldNames.map(escapeCSVField);
  return escaped.join(',') + '\n';
}

/**
 * Converts a row object to CSV format
 *
 * @param row Data row as object
 * @param fields Field definitions with types
 * @param options CSV formatting options
 * @returns CSV row string
 */
export function rowToCSV(
  row: CSVRow,
  fields: Array<{ id: string; type: string }>,
  options: CSVFormatOptions
): string {
  const values = fields.map((field) => {
    const value = row[field.id];
    const formatted = formatField(value, field.type, options);

    // Skip empty fields if configured
    if (!options.includeEmptyFields && !formatted) {
      return '';
    }

    return escapeCSVField(formatted);
  });

  return values.join(',') + '\n';
}

/**
 * Generates complete CSV content from data rows
 *
 * Handles large datasets efficiently by streaming-friendly output
 *
 * @param rows Data rows
 * @param fields Field definitions
 * @param fieldNames Selected field names (for header)
 * @param options CSV options
 * @returns Complete CSV content as string
 */
export function generateCSV(
  rows: CSVRow[],
  fields: Array<{ id: string; type: string }>,
  fieldNames: string[],
  options: CSVFormatOptions
): string {
  let csv = '';

  // Add header if requested
  if (options.includeHeaders) {
    csv += generateCSVHeader(fieldNames);
  }

  // Add data rows
  for (const row of rows) {
    csv += rowToCSV(row, fields, options);
  }

  return csv;
}

/**
 * Creates a CSV header generator for streaming
 *
 * Use for large exports where full content can't fit in memory
 *
 * @param fieldNames Field names for header
 * @returns Function that returns next chunk of CSV
 */
export function createCSVStreamer(
  fieldNames: string[],
  options: CSVFormatOptions,
  fields: Array<{ id: string; type: string }>
) {
  let headerSent = false;
  let rowIndex = 0;

  return {
    /**
     * Get header chunk if not yet sent
     */
    getHeader(): string {
      if (!headerSent && options.includeHeaders) {
        headerSent = true;
        return generateCSVHeader(fieldNames);
      }
      return '';
    },

    /**
     * Add a row to the stream
     */
    addRow(row: CSVRow): string {
      rowIndex++;
      return rowToCSV(row, fields, options);
    },

    /**
     * Get total rows processed
     */
    getRowCount(): number {
      return rowIndex;
    },
  };
}

// ============================================================================
// CSV Validation and Stats
// ============================================================================

/**
 * Calculates size of CSV content
 *
 * Useful for determining if streaming is needed
 *
 * @param content CSV content
 * @returns Size in bytes
 */
export function getCSVSize(content: string): number {
  return new TextEncoder().encode(content).length;
}

/**
 * Validates CSV content is properly formatted
 *
 * @param content CSV content
 * @returns true if valid CSV
 */
export function validateCSV(content: string): boolean {
  if (!content) return false;

  // Basic checks
  const lines = content.split('\n');
  if (lines.length < 1) return false;

  // Verify header count matches row counts (basic check)
  const headerCount = (lines[0].match(/,/g) || []).length + 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Count unescaped commas
    let commaCount = 0;
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"' && (j === 0 || line[j - 1] !== '"')) {
        inQuotes = !inQuotes;
      } else if (line[j] === ',' && !inQuotes) {
        commaCount++;
      }
    }

    // Allow one extra comma (last position)
    if (commaCount + 1 > headerCount) {
      return false;
    }
  }

  return true;
}
