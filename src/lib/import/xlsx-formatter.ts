/**
 * XLSX formatter for exporting card and benefit data
 *
 * Handles:
 * - Workbook and worksheet creation
 * - Cell formatting (dates, monetary, colors)
 * - Column widths and header styling
 * - Data validation and formulas
 * - Large dataset support (10k+ rows)
 */

import XLSX from 'xlsx';

// ============================================================================
// Type Definitions
// ============================================================================

export interface XLSXCell {
  value: XLSXCellValue;
  type: 'string' | 'number' | 'date' | 'formula';
  format?: string;
  comment?: string;
}

export interface XLSXFormatOptions {
  dateFormat: string;
  monetaryFormat: string;
  includeHeaders: boolean;
  headerColor: string;
  headerFontSize: number;
}

// ============================================================================
// Cell Formatting
// ============================================================================

/**
 * Formats a date value for XLSX
 *
 * @param date Date to format
 * @param format Format code ('yyyy-mm-dd' | 'mm/dd/yyyy' | etc)
 * @returns Excel cell with formatted date
 */
export function formatDateCell(date: Date | null | undefined, format: string = 'yyyy-mm-dd'): XLSX.CellObject | null {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  return {
    v: d,
    t: 'd',
    z: format,
  };
}

/**
 * Formats a monetary value for XLSX
 *
 * @param cents Amount in cents
 * @param format Format code ('$#,##0.00' | '0' | etc)
 * @returns Excel cell with formatted monetary
 */
export function formatMonetaryCell(cents: number | null | undefined, format: string = '$#,##0.00'): XLSX.CellObject | null {
  if (cents === null || cents === undefined) return null;

  const dollars = cents / 100;

  return {
    v: dollars,
    t: 'n',
    z: format,
  };
}

// ============================================================================
// Column Management
// ============================================================================

/**
 * Calculates optimal column width based on content
 *
 * @param values Values in column
 * @param headerName Header name
 * @param maxWidth Maximum width to allow
 * @returns Recommended width
 */
function calculateColumnWidth(values: XLSXCellValue[], headerName: string, maxWidth: number = 50): number {
  let maxLength = headerName.length;

  for (const value of values) {
    if (value === null || value === undefined) continue;

    const str = String(value);
    if (str.length > maxLength) {
      maxLength = str.length;
    }
  }

  // Add padding and ensure readable minimum
  const width = Math.min(maxWidth, Math.max(8, maxLength + 2));
  return width;
}

/**
 * Generates column definitions with optimal widths
 *
 * @param headers Column headers
 * @param data Row data
 * @returns Column definitions for XLSX
 */
export function generateColumns(
  headers: string[],
  data: XLSXCellValue[][]
): Array<{ wch: number }> {
  const columns: Array<{ wch: number }> = [];

  for (let i = 0; i < headers.length; i++) {
    const colValues = data.map((row) => row[i]);
    const width = calculateColumnWidth(colValues, headers[i]);
    columns.push({ wch: width });
  }

  return columns;
}

// ============================================================================
// Workbook Creation
// ============================================================================

/**
 * Generates a complete XLSX workbook from data
 *
 * Features:
 * - Headers with bold formatting
 * - Proper column widths
 * - Date and monetary formatting
 * - Frozen header row
 *
 * @param sheetName Name of worksheet
 * @param headers Column headers
 * @param data Row data (array of arrays)
 * @param fieldTypes Field type information
 * @returns XLSX workbook bytes
 */
export function generateXLSX(
  sheetName: string,
  headers: string[],
  data: XLSXCellValue[][],
  fieldTypes: Array<{ type: string }>
): Uint8Array {
  // Create workbook and worksheet
  const worksheet: XLSX.WorkSheet = {};

  // Add headers
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    worksheet[cellRef] = {
      v: headers[i],
      t: 's',
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E78' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
    };
  }

  // Add data rows
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      const value = row[colIdx];

      // Handle different field types
      if (value === null || value === undefined) {
        worksheet[cellRef] = { v: '', t: 's' };
      } else if (fieldTypes[colIdx]?.type === 'date' && value instanceof Date) {
        worksheet[cellRef] = {
          v: value,
          t: 'd',
          z: 'yyyy-mm-dd',
        };
      } else if (fieldTypes[colIdx]?.type === 'monetary' && typeof value === 'number') {
        worksheet[cellRef] = {
          v: value / 100, // Convert cents to dollars
          t: 'n',
          z: '$#,##0.00',
        };
      } else {
        worksheet[cellRef] = { v: String(value), t: 's' };
      }
    }
  }

  // Set worksheet properties
  worksheet['!cols'] = generateColumns(headers, data);
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: headers.length - 1 } });

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

/**
 * Creates multiple worksheets for mixed data (cards and benefits)
 *
 * @param cardHeaders Card column headers
 * @param cardData Card data rows
 * @param benefitHeaders Benefit column headers
 * @param benefitData Benefit data rows
 * @param cardFieldTypes Card field types
 * @param benefitFieldTypes Benefit field types
 * @returns XLSX workbook bytes
 */
export function generateXLSXMultiSheet(
  cardHeaders: string[],
  cardData: XLSXCellValue[][],
  benefitHeaders: string[],
  benefitData: XLSXCellValue[][],
  cardFieldTypes: Array<{ type: string }>,
  benefitFieldTypes: Array<{ type: string }>
): Uint8Array {
  // Create cards worksheet
  const cardWs: XLSX.WorkSheet = {};

  // Add cards headers
  for (let i = 0; i < cardHeaders.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    cardWs[cellRef] = {
      v: cardHeaders[i],
      t: 's',
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E78' } },
      },
    };
  }

  // Add cards data
  for (let rowIdx = 0; rowIdx < cardData.length; rowIdx++) {
    const row = cardData[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      const value = row[colIdx];

      if (value === null || value === undefined) {
        cardWs[cellRef] = { v: '', t: 's' };
      } else if (cardFieldTypes[colIdx]?.type === 'date' && value instanceof Date) {
        cardWs[cellRef] = { v: value, t: 'd', z: 'yyyy-mm-dd' };
      } else if (cardFieldTypes[colIdx]?.type === 'monetary' && typeof value === 'number') {
        cardWs[cellRef] = { v: value / 100, t: 'n', z: '$#,##0.00' };
      } else {
        cardWs[cellRef] = { v: String(value), t: 's' };
      }
    }
  }

  cardWs['!cols'] = generateColumns(cardHeaders, cardData);
  cardWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  cardWs['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: cardData.length, c: cardHeaders.length - 1 },
  });

  // Create benefits worksheet
  const benefitWs: XLSX.WorkSheet = {};

  // Add benefits headers
  for (let i = 0; i < benefitHeaders.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    benefitWs[cellRef] = {
      v: benefitHeaders[i],
      t: 's',
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E78' } },
      },
    };
  }

  // Add benefits data
  for (let rowIdx = 0; rowIdx < benefitData.length; rowIdx++) {
    const row = benefitData[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      const value = row[colIdx];

      if (value === null || value === undefined) {
        benefitWs[cellRef] = { v: '', t: 's' };
      } else if (benefitFieldTypes[colIdx]?.type === 'date' && value instanceof Date) {
        benefitWs[cellRef] = { v: value, t: 'd', z: 'yyyy-mm-dd' };
      } else if (benefitFieldTypes[colIdx]?.type === 'monetary' && typeof value === 'number') {
        benefitWs[cellRef] = { v: value / 100, t: 'n', z: '$#,##0.00' };
      } else {
        benefitWs[cellRef] = { v: String(value), t: 's' };
      }
    }
  }

  benefitWs['!cols'] = generateColumns(benefitHeaders, benefitData);
  benefitWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  benefitWs['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: benefitData.length, c: benefitHeaders.length - 1 },
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, cardWs, 'Cards');
  XLSX.utils.book_append_sheet(workbook, benefitWs, 'Benefits');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

/**
 * Validates XLSX workbook structure
 *
 * @param buffer XLSX file bytes
 * @returns true if valid XLSX
 */
export function validateXLSX(buffer: Uint8Array): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    return workbook.SheetNames.length > 0;
  } catch {
    return false;
  }
}
