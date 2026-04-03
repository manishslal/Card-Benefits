/**
 * Server actions for export operations
 *
 * Provides three endpoints:
 * - POST /export/options - Get available export fields and options
 * - POST /export/generate - Generate and return export file
 * - GET /export/history - Get export history for player
 */

'use server';

import { generateExport, getExportHistory } from '@/lib/export/exporter';
import { CARD_EXPORT_FIELDS, BENEFIT_EXPORT_FIELDS, ExportRequest } from '@/lib/export/schema';
import { createErrorResponse, createSuccessResponse, AppError, ActionResponse } from '@/lib/errors';
import { getSession } from '@/lib/auth-server';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ExportOptionsResponse {
  cardFields: typeof CARD_EXPORT_FIELDS;
  benefitFields: typeof BENEFIT_EXPORT_FIELDS;
  formats: Array<{ id: 'CSV' | 'XLSX'; label: string }>;
  recordTypes: Array<{ id: string; label: string }>;
  dateFormats: Array<{ id: string; label: string }>;
  monetaryFormats: Array<{ id: string; label: string }>;
}

export interface ExportGenerateResponse {
  exportId: string;
  format: string;
  recordType: string;
  totalRecords: number;
  cardsExported: number;
  benefitsExported: number;
  fileSize: number;
  downloadUrl: string;
  createdAt: string;
}

// ============================================================================
// Export Options Action
// ============================================================================

/**
 * Returns available export fields and configuration options
 *
 * Requires authentication. Returns list of selectable fields grouped by
 * record type, supported formats, and date/monetary format options.
 */
export async function getExportOptions(): Promise<ActionResponse<ExportOptionsResponse>> {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return createErrorResponse('AUTH_MISSING');
    }

    return createSuccessResponse({
      cardFields: CARD_EXPORT_FIELDS,
      benefitFields: BENEFIT_EXPORT_FIELDS,
      formats: [
        { id: 'CSV', label: 'CSV (Comma-Separated Values)' },
        { id: 'XLSX', label: 'Excel Workbook (.xlsx)' },
      ],
      recordTypes: [
        { id: 'Card', label: 'Cards Only' },
        { id: 'Benefit', label: 'Benefits Only' },
        { id: 'All', label: 'Cards & Benefits' },
      ],
      dateFormats: [
        { id: 'ISO', label: 'ISO 8601 (2024-12-31)' },
        { id: 'MM/DD/YYYY', label: 'US Format (12/31/2024)' },
        { id: 'DD/MM/YYYY', label: 'International Format (31/12/2024)' },
      ],
      monetaryFormats: [
        { id: 'Dollars', label: 'Dollars ($100.00)' },
        { id: 'Cents', label: 'Cents (10000)' },
      ],
    });
  } catch (error) {
    console.error('Error in getExportOptions:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}

// ============================================================================
// Export Generate Action
// ============================================================================

/**
 * Generates and returns export file
 *
 * Requires authentication and valid export parameters. Returns file as
 * base64-encoded string for client download.
 *
 * Rate limits: 10 exports per hour per player
 */
export async function generateExportFile(request: ExportRequest): Promise<ActionResponse<ExportGenerateResponse>> {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return createErrorResponse('AUTH_MISSING');
    }

    // Validate request
    if (!request.playerId) {
      return createErrorResponse('VALIDATION_FIELD', {
        field: 'playerId',
        reason: 'Player ID is required',
      });
    }

    if (!request.format || !['CSV', 'XLSX'].includes(request.format)) {
      return createErrorResponse('VALIDATION_FIELD', {
        field: 'format',
        reason: 'Format must be CSV or XLSX',
      });
    }

    if (!request.recordType || !['Card', 'Benefit', 'All'].includes(request.recordType)) {
      return createErrorResponse('VALIDATION_FIELD', {
        field: 'recordType',
        reason: 'Record type must be Card, Benefit, or All',
      });
    }

    if (!Array.isArray(request.selectedFields) || request.selectedFields.length === 0) {
      return createErrorResponse('VALIDATION_FIELD', {
        field: 'selectedFields',
        reason: 'At least one field must be selected',
      });
    }

    // Generate export
    const exportData = await generateExport(request);

    // Convert content to base64 for transmission
    let base64Content: string;
    if (typeof exportData.content === 'string') {
      base64Content = Buffer.from(exportData.content, 'utf-8').toString('base64');
    } else {
      base64Content = Buffer.from(exportData.content).toString('base64');
    }

    // Determine file extension
    const ext = request.format === 'CSV' ? 'csv' : 'xlsx';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `export-${request.recordType.toLowerCase()}-${timestamp}.${ext}`;

    // Return response with download data
    return createSuccessResponse({
      exportId: `export-${Date.now()}`,
      format: request.format,
      recordType: request.recordType,
      totalRecords: exportData.cardsCount + exportData.benefitsCount,
      cardsExported: exportData.cardsCount,
      benefitsExported: exportData.benefitsCount,
      fileSize: exportData.fileSize,
      downloadUrl: `data:application/${request.format === 'CSV' ? 'csv' : 'vnd.openxmlformats-officedocument.spreadsheetml.sheet'};base64,${base64Content}`,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in generateExportFile:', error);

    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    return createErrorResponse('INTERNAL_ERROR', {
      reason: error instanceof Error ? error.message : 'Unknown export error',
    });
  }
}

// ============================================================================
// Export History Action
// ============================================================================

/**
 * Retrieves export history for authenticated player
 *
 * Returns last 20 exports with timestamps and file sizes
 */
export async function getExportHistoryAction(): Promise<ActionResponse<any[]>> {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return createErrorResponse('AUTH_MISSING');
    }

    // Get player ID from session
    const playerId = session.user.id;

    // Fetch export history
    const history = await getExportHistory(playerId);

    return createSuccessResponse(history);
  } catch (error) {
    console.error('Error in getExportHistoryAction:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}
