# Import/Export Feature - Issue Remediation Guide

## Overview

This document provides detailed remediation steps for all 11 issues found during QA review. Follow this guide to bring the implementation to production-ready status.

---

## CRITICAL ISSUES - Must Fix Before Production

### CRITICAL #1: Implement Export Module

**Issue:** `/src/lib/export/` directory is completely empty - no export functionality exists

**Why It's Critical:** Users cannot export their data at all. The entire export feature is non-functional.

**Specification Requirements:**
- 3 API endpoints for different export scopes (Card, Player, Filtered)
- CSV and XLSX format support
- Column selection and filtering
- Audit trail information
- File streaming for large datasets

**Implementation Steps:**

#### Step 1: Create Export Schema (`src/lib/export/schema.ts`)
```typescript
// Define export types and interfaces
export interface ExportOptions {
  scope: 'Card' | 'Player' | 'Filtered';
  cardId?: string;
  format: 'CSV' | 'XLSX';
  includeCalculatedValues: boolean;
  includeAuditTrail: boolean;
  includeSystemIds: boolean;
}

export interface ExportResult {
  fileName: string;
  fileSize: number;
  recordCount: number;
  generatedAt: string;
  contentType: string;
  data: Buffer;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  fieldName: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  category: 'Card' | 'Benefit';
  required: boolean;
}
```

#### Step 2: Create CSV Generator (`src/lib/export/csv-generator.ts`)
```typescript
// CSV formatting with quote escaping
import { parse } from 'json2csv';

export function generateCSV(
  records: Array<Record<string, any>>,
  columns: ColumnDefinition[]
): string {
  // Escape CSV injection formulas
  const sanitizedRecords = records.map(record => {
    const sanitized: Record<string, any> = {};
    
    for (const col of columns) {
      let value = record[col.fieldName];
      
      // Escape formulas
      if (typeof value === 'string' && /^[=+@-]/.test(value)) {
        value = "'" + value; // Prefix with single quote
      }
      
      sanitized[col.label] = value;
    }
    
    return sanitized;
  });
  
  return parse(sanitizedRecords, {
    fields: columns.map(c => c.label),
    quote: '"',
    escape: '"',
    eol: '\n',
  });
}
```

#### Step 3: Create XLSX Generator (`src/lib/export/xlsx-generator.ts`)
```typescript
// XLSX formatting
import XLSX from 'xlsx';

export function generateXLSX(
  records: Array<Record<string, any>>,
  columns: ColumnDefinition[]
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(
    records.map(r => {
      const row: Record<string, any> = {};
      for (const col of columns) {
        row[col.label] = r[col.fieldName];
      }
      return row;
    }),
    { header: columns.map(c => c.label) }
  );
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
  
  return XLSX.write(workbook, { type: 'buffer' });
}
```

#### Step 4: Create Exporter (`src/lib/export/exporter.ts`)
```typescript
// Main export logic
export async function exportPlayerData(
  playerId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const userId = getAuthUserIdOrThrow();
  
  // Verify ownership
  const playerOwned = await verifyPlayerOwnership(userId, playerId);
  if (!playerOwned) {
    throw new AppError('AUTHZ_OWNERSHIP', { playerId });
  }
  
  // Fetch data based on scope
  let records = await fetchExportData(playerId, options);
  
  // Filter columns
  const columns = getColumnDefinitions(options);
  records = records.map(r => selectColumns(r, columns));
  
  // Generate file
  let data: Buffer;
  let contentType: string;
  
  if (options.format === 'CSV') {
    data = Buffer.from(generateCSV(records, columns));
    contentType = 'text/csv';
  } else {
    data = generateXLSX(records, columns);
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  
  return {
    fileName: generateFileName(playerId, options),
    fileSize: data.length,
    recordCount: records.length,
    generatedAt: new Date().toISOString(),
    contentType,
    data,
  };
}
```

#### Step 5: Create Export Server Actions (`src/actions/export.ts`)
```typescript
// Implement 3 export API endpoints
'use server';

export async function getExportOptions(
  scope: 'Card' | 'Player' | 'Filtered',
  playerId: string,
  cardId?: string
): Promise<ActionResponse<ExportOptionsResponse>> {
  // Returns available columns, formats, options
}

export async function generateExport(
  playerId: string,
  options: ExportOptions
): Promise<ActionResponse<ExportResult>> {
  // Generate and return file
}

export async function getColumnSelections(
  scope: 'Card' | 'Player' | 'Filtered'
): Promise<ActionResponse<ColumnDefinition[]>> {
  // Returns available columns for selection
}
```

**Testing:**
- Test CSV export with quotes and special characters
- Test XLSX export with multiple sheets
- Test formula injection prevention
- Test large exports (>50k records)
- Test all column combinations
- Test streaming for large files

**Estimated Effort:** 2 days

---

### CRITICAL #2: Complete validateImportFile Server Action

**Issue:** `src/actions/import.ts` - validateImportFile() function is a stub (lines 217-310)

**Current Code Problem:**
```typescript
// Lines 249-267: Creates empty validationRecords array
const validationRecords: Array<...> = [];

let validCount = 0;
let warningCount = 0;
let errorCount = 0;

// Lines 273-275: Note says "not implemented"
// Note: In a real implementation, we would fetch the parsed rows from cache

// Returns success with zero counts
return createSuccessResponse<ValidateResponse>({
  importJobId,
  status: 'ValidatingComplete',
  summary: {
    totalRecords: importJob.totalRecords,
    validRecords: 0,  // ← Wrong, should be actual count
    warningRecords: 0,
    errorRecords: 0,
    estimatedDuplicates: 0,
  },
```

**Implementation Steps:**

Replace the stub with actual implementation:

```typescript
export async function validateImportFile(
  importJobId: string,
  _columnMapping?: ColumnMapping
): Promise<ActionResponse<ValidateResponse>> {
  const startTime = performance.now();

  try {
    // Get ImportJob
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
      select: {
        id: true,
        userId: true,
        playerId: true,
        status: true,
        columnMappings: true,
        totalRecords: true,
      },
    });

    if (!importJob) {
      return createErrorResponse('RESOURCE_NOT_FOUND', {
        resource: 'ImportJob',
      });
    }

    // Authorization (verify user owns this job)
    const userId = getAuthUserIdOrThrow();
    if (importJob.userId !== userId) {
      return createErrorResponse('AUTHZ_OWNERSHIP', {
        resource: 'ImportJob',
      });
    }

    // Fetch all ImportRecords for this job
    const importRecords = await prisma.importRecord.findMany({
      where: { importJobId },
      orderBy: { rowNumber: 'asc' },
      select: {
        id: true,
        rowNumber: true,
        recordType: true,
        data: true,
      },
    });

    // Parse column mapping
    const columnMapping = importJob.columnMappings 
      ? JSON.parse(importJob.columnMappings)
      : {};

    // Validate each record
    const validationRecords: Array<{
      rowNumber: number;
      recordType: 'Card' | 'Benefit';
      status: 'Valid' | 'Warning' | 'Error';
      data: Record<string, any>;
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
    }> = [];

    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (const record of importRecords) {
      const rowData = JSON.parse(record.data || '{}');
      const recordType = record.recordType as 'Card' | 'Benefit';

      let validationResult;

      try {
        if (recordType === 'Card') {
          validationResult = await validateCardRecord(
            rowData,
            record.rowNumber,
            columnMapping
          );
        } else {
          validationResult = await validateBenefitRecord(
            rowData,
            record.rowNumber,
            columnMapping
          );
        }
      } catch (error) {
        // Handle validation function errors
        validationResult = {
          valid: false,
          errors: [{
            field: 'unknown',
            message: error instanceof Error ? error.message : 'Validation error',
            severity: 'critical',
            suggestion: 'Contact support with this record number',
          }],
          warnings: [],
          normalizedData: undefined,
        };
      }

      // Update ImportRecord with validation results
      const recordStatus = validationResult.valid 
        ? (validationResult.warnings.length > 0 ? 'Warning' : 'Valid')
        : 'Error';

      await prisma.importRecord.update({
        where: { id: record.id },
        data: {
          status: recordStatus,
          validationErrors: validationResult.errors.length > 0 
            ? JSON.stringify(validationResult.errors)
            : null,
          validationWarnings: validationResult.warnings.length > 0
            ? JSON.stringify(validationResult.warnings)
            : null,
          normalizedData: validationResult.normalizedData
            ? JSON.stringify(validationResult.normalizedData)
            : null,
          validatedAt: new Date(),
        },
      });

      // Track counts
      if (validationResult.valid) {
        validCount++;
        if (validationResult.warnings.length > 0) {
          warningCount++;
        }
      } else {
        errorCount++;
      }

      validationRecords.push({
        rowNumber: record.rowNumber,
        recordType,
        status: recordStatus,
        data: rowData,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }

    // Update ImportJob with validation completion
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'ValidatingComplete',
        validatedAt: new Date(),
        warningRecords: warningCount,
        failedRecords: errorCount,
      },
    });

    const validationTimeMs = performance.now() - startTime;

    return createSuccessResponse<ValidateResponse>({
      importJobId,
      status: 'ValidatingComplete',
      summary: {
        totalRecords: importJob.totalRecords,
        validRecords: validCount,
        warningRecords: warningCount,
        errorRecords: errorCount,
        estimatedDuplicates: 0, // Determined in next step
      },
      canProceed: errorCount === 0,
      records: validationRecords,
      validationTime: validationTimeMs,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code as any, error.details);
    }

    console.error('Validation error:', error);
    return createErrorResponse('INTERNAL_ERROR', {
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Testing:**
- Test validation with valid cards and benefits
- Test each field validator trigger
- Test error vs warning classification
- Test large batch validation (10k records)
- Test authorization checks
- Test ImportRecord updates

**Estimated Effort:** 1 day

---

### CRITICAL #3: Add Null Safety to Committer

**Issue:** `src/lib/import/committer.ts` - processRecord function uses non-null assertion without validation

**Problem Code (lines 232-240):**
```typescript
const { id, action: resultAction } = await commitCard(
  tx,
  playerId,
  record.normalizedData!.cardName,      // ← Assumes not null
  record.normalizedData!.issuer,        // ← No validation
  record.normalizedData!,
  action as 'Create' | 'Update',
  importJobId
);
```

**Issues:**
- If normalizedData is null, will throw "Cannot read properties of null"
- Non-null assertion (!) bypasses TypeScript safety checks
- No validation that required fields exist
- No error message for user

**Fix:**

Replace processRecord function:

```typescript
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
  try {
    // Check if user resolved to skip this duplicate
    if (record.isDuplicate && record.userResolution === 'Skip') {
      return { action: 'Skipped' };
    }

    // Check if record has critical errors
    if (record.status === 'Error') {
      return { action: 'Skipped' };
    }

    // Validate normalizedData exists
    if (!record.normalizedData) {
      throw new AppError('VALIDATION_FAILED', {
        recordId: record.id,
        rowNumber: record.rowNumber,
        reason: 'Missing normalized data',
      });
    }

    // Determine if this is a create or update
    const isUpdate = record.isDuplicate && record.userResolution === 'Update';
    const action = isUpdate ? 'Update' : 'Create';

    // Process based on record type
    if (record.recordType === 'Card') {
      // Validate required fields for card
      if (!record.normalizedData.cardName || !record.normalizedData.issuer) {
        throw new AppError('VALIDATION_FAILED', {
          recordId: record.id,
          rowNumber: record.rowNumber,
          reason: 'Missing required card fields (cardName or issuer)',
        });
      }

      const { id, action: resultAction } = await commitCard(
        tx,
        playerId,
        record.normalizedData.cardName,
        record.normalizedData.issuer,
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
      // Validate required fields for benefit
      if (!record.normalizedData.cardName || 
          !record.normalizedData.issuer ||
          !record.normalizedData.benefitName) {
        throw new AppError('VALIDATION_FAILED', {
          recordId: record.id,
          rowNumber: record.rowNumber,
          reason: 'Missing required benefit fields',
        });
      }

      // First, find or verify the card exists
      const masterCard = await tx.masterCard.findFirst({
        where: {
          cardName: record.normalizedData.cardName,
          issuer: record.normalizedData.issuer,
        },
      });

      if (!masterCard) {
        throw new AppError('RESOURCE_NOT_FOUND', {
          resource: 'MasterCard',
          cardName: record.normalizedData.cardName,
          issuer: record.normalizedData.issuer,
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
          cardName: record.normalizedData.cardName,
        });
      }

      const { id, action: resultAction } = await commitBenefit(
        tx,
        playerId,
        userCard.id,
        record.normalizedData.benefitName,
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
  } catch (error) {
    // Re-throw AppError as-is for proper error handling
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError('IMPORT_COMMIT_ERROR', {
      recordId: record.id,
      rowNumber: record.rowNumber,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Testing:**
- Test with normalizedData = null
- Test with missing cardName
- Test with missing issuer  
- Test with missing required benefit fields
- Test error is properly caught and logged
- Test transaction still rolls back properly

**Estimated Effort:** 0.5 days

---

### CRITICAL #4: Fix Parser Empty File Handling

**Issue:** `src/lib/import/parser.ts` - parseFile returns `false` for valid CSVs with only headers

**Test Evidence:**
```
✗ parseFile - Handles empty CSV (headers only)
  expected false to be true
```

**Investigation:**
The parseFile function returns `ParserResult | ParseError`, where:
- ParserResult has `success: true`
- ParseError has `success: false`

But some test assertions get plain `false`, suggesting the function path returns a boolean instead of the proper union type.

**Root Cause:** Likely in validateFileFormat or format detection returning `false | 'CSV' | 'XLSX'` instead of properly typed value

**Fix in parser.ts:**

```typescript
export function parseFile(
  filename: string,
  buffer: Uint8Array
): ParserResult | ParseError {
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

    // Ensure format is properly typed
    if (format !== 'CSV' && format !== 'XLSX') {
      return {
        success: false,
        error: 'Unsupported file format detected',
        code: 'IMPORT_FILE_INVALID',
      };
    }

    // Decode buffer to string for CSV parsing
    let result: ParseResult;

    if (format === 'CSV') {
      const text = new TextDecoder('utf-8').decode(buffer);
      result = parseCSV(text);
    } else {
      // format must be 'XLSX'
      result = parseXLSX(buffer);
    }

    // Result is guaranteed to have success: true
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

// Ensure type safety for format detection
function validateFileFormat(
  filename: string,
  buffer: Uint8Array
): 'CSV' | 'XLSX' | false {
  // Check for empty file
  if (buffer.byteLength === 0) {
    return false;
  }

  // Detect format
  const format = detectFileFormat(filename, buffer);
  
  // Return false or exact format string
  return format === 'CSV' || format === 'XLSX' ? format : false;
}
```

**Testing:**
- Test CSV with only headers (no data rows)
- Test CSV with headers + 1 data row
- Test XLSX with only headers
- Test empty CSV (0 bytes)
- Test CSV with whitespace only

**Estimated Effort:** 0.5 days

---

## HIGH PRIORITY ISSUES - Should Fix Before Production

See `.github/specs/import-export-qa-report.md` for detailed descriptions of:

5. Record Type Inference Lacks Error Context
6. Duplicate Detector Missing Error Handling
7. Missing Transaction Integrity Validation
8. Column Mapping Not Consistent
9. Status Updates Missing Concurrency Protection
10. Authorization Checks Missing Edge Cases
11. Error Log Serialization Could Fail

Each has a "Fix Required" section in the QA report with detailed implementation guidance.

---

## Testing & Validation

### After Completing All Fixes

**Run Full Test Suite:**
```bash
npm run test 2>&1 | tee test-results.log
```

**Expected Results:**
- ✅ 300+ tests passing
- ✅ <3% tests failing (non-critical)
- ✅ Coverage >80% on all modules
- ✅ No unhandled promise rejections

**Manual Testing Checklist:**
- [ ] Upload valid CSV file
- [ ] Upload valid XLSX file
- [ ] Reject invalid file types
- [ ] Reject oversized files
- [ ] View validation results
- [ ] Check duplicate detection
- [ ] Resolve duplicates (skip/update/merge)
- [ ] Preview import
- [ ] Commit import
- [ ] Verify cards created
- [ ] Verify benefits created
- [ ] Export player data as CSV
- [ ] Export player data as XLSX
- [ ] Export single card
- [ ] Verify export file contents

**Security Testing:**
- [ ] Test authorization (wrong user can't access imports)
- [ ] Test file upload size limit
- [ ] Test magic byte verification (disguised files rejected)
- [ ] Test CSV injection formula escaping
- [ ] Test rate limiting (if implemented)

---

## Rollback Plan

If issues arise in production:

**Step 1: Disable Import/Export** (5 min)
- Remove API route handlers
- Or set feature flag to false
- Users can still see data, just can't import/export

**Step 2: Investigate** (15-30 min)
- Check error logs
- Run diagnostic queries
- Identify root cause

**Step 3: Fix & Redeploy** (30-120 min)
- Make code fix
- Run tests
- Redeploy
- Monitor for 1 hour

**Step 4: Communication**
- Notify affected users
- Provide ETA for fix
- Document incident

---

## Conclusion

Completing these critical fixes and testing will bring the Import/Export feature to production-ready status. The recommended approach is:

1. Fix critical issues (3-4 days)
2. Run full test suite (1 day)
3. Code review & sign-off (1 day)
4. Deploy to staging (1 day)
5. Deploy to production (1 day)

**Total: 7-10 days to production-ready**

