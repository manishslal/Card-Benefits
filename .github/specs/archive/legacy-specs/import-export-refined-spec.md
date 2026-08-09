# Card Benefits Tracker - Import/Export Feature Specification (Refined)

**Specification Version:** 2.0 (Refined)  
**Original Document:** SPEC_PHASE4_IMPORT_EXPORT.md  
**Date:** April 2, 2024  
**Status:** Ready for Full-Stack Implementation  
**Target Engineer Role:** Full-Stack Engineer (Next.js + Prisma + React)

---

## Table of Contents

1. [Executive Summary & Goals](#executive-summary--goals)
2. [Requirements Clarification](#requirements-clarification)
3. [Data Schema Specification](#data-schema-specification)
4. [API Route Specifications](#api-route-specifications)
5. [User Flows & State Management](#user-flows--state-management)
6. [Edge Cases & Handling Strategies](#edge-cases--handling-strategies)
7. [Security Implementation](#security-implementation)
8. [Performance Targets](#performance-targets)
9. [Component Architecture](#component-architecture)
10. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary & Goals

### Overview

The Card Benefits Tracker requires comprehensive import/export functionality to enable bulk management of credit card and benefit data through CSV and XLSX file formats. This specification provides a complete blueprint for a multi-step import wizard with validation, duplicate detection, and conflict resolution, plus flexible export options for data backup and analysis.

### Primary Objectives

- **Bulk Data Management:** Import up to 50,000 records (cards + benefits) in a single operation with < 60-second parsing time
- **Data Integrity:** Prevent corruption through transaction-based rollback and multi-stage validation
- **User-Friendly Workflow:** 5-step wizard with preview-before-commit pattern to build confidence
- **Duplicate Handling:** Intelligent detection and user-controlled resolution (skip/update/merge)
- **Round-Trip Compatibility:** Export data and re-import without data loss or transformation
- **Audit Trail:** Complete tracking of who imported what, when, and with what results
- **Flexible Export:** Multiple scopes (single card, filtered, all cards) and formats (CSV, XLSX)

### Success Criteria

✅ **Functional Completeness:**
- All 7 API endpoints implemented and tested
- 5-step import wizard fully functional with state preservation
- 3 export scopes working (card, player, filtered)
- Both CSV and XLSX formats supported

✅ **Data Quality:**
- Zero data loss during round-trip import/export
- Proper handling of all documented edge cases
- Transaction rollback prevents partial states
- Audit trail captures all operations

✅ **Performance:**
- Parse 10MB files in < 30 seconds
- Process 10,000-record imports in < 30 seconds total
- Export 10,000 records in < 10 seconds
- Memory usage stays below 500MB

✅ **Security:**
- All endpoints require authentication
- User ownership verified for all player operations
- CSV injection prevention (formula escaping)
- Input validation on all fields
- Rate limiting on import endpoint (10/hour, 5 per 10min)

✅ **Testing:**
- 80%+ code coverage on all new modules
- 130+ unit tests across all components
- 30+ integration tests for workflows
- 15+ E2E tests for user journeys
- All edge cases tested

---

## Requirements Clarification

### Key Assumptions Validated ✓

#### File Size Limits (CRITICAL)

The original spec mentions "10MB" in most examples but "50MB" in amendments. **For implementation, use:**
- **Client-side validation: 50MB** (per Amendment #2)
- **Server-side validation: 52,428,800 bytes** (exactly 50MB)
- **Maximum records: 50,000 rows** (any mix of cards and benefits)

**Rationale:** Prevents DoS while accommodating future growth. Most users will import < 1000 records.

#### File Format Auto-Detection

- Detect based on **file extension** (.csv, .xlsx) with **server-side magic byte verification**
- CSV: Check for UTF-8 validity and presence of comma or newline
- XLSX: Verify ZIP magic bytes `50 4B 03 04` (0x50='P', 0x4B='K')
- **Do NOT trust extension alone**

#### Column Mapping

The original spec says "auto-detect" but real-world files have custom column names. **Implementation approach:**
1. Parse headers and attempt exact case-insensitive match
2. Apply fuzzy matching with synonym dictionary
3. Show user a mapping UI with confidence scores
4. Save successful mappings as "UserImportProfile" for future reuse
5. User can override auto-mapping before proceeding

#### Record Type Identification

For mixed CSV files:
- If "RecordType" column exists: use it ('Card' or 'Benefit')
- If separate files: infer from which system fields are populated
- If ambiguous: ask user in validation step

#### Duplicate Resolution

Three explicit options per duplicate:
- **Skip:** Ignore this record, don't import it
- **Update:** Merge new data with existing record (overwrites specific fields)
- **Merge:** Keep both (for benefits with same name, creates variant)

**Note:** "Update" behavior varies by record type:
- **Card Update:** Only update AnnualFee, RenewalDate, CustomName (preserve createdAt)
- **Benefit Update:** Update StickerValue, DeclaredValue, Status, ExpirationDate

#### Rollback Scope

When rollback is triggered:
- **Roll back:** All UserCard, UserBenefit, ImportRecord inserts/updates in this import
- **Preserve:** ImportJob record (for audit trail) and error logs
- **Preserve:** Preview data (user can fix and retry)
- **Preserve:** Pre-rollback backups of affected records (for manual recovery)

#### Transaction Boundaries

All database operations in import **must** use Prisma transactions:
```
BEGIN TRANSACTION
  ├─ Create ImportJob (status: 'Processing')
  ├─ For each validated record:
  │   ├─ Insert/update UserCard or UserBenefit
  │   └─ Create ImportRecord entry
  └─ Verify integrity → COMMIT or ROLLBACK
```

**Critical:** Do NOT commit ImportJob until all records processed and verified.

---

## Data Schema Specification

### New Database Tables

#### ImportJob Table

Tracks entire import operation with full audit trail.

```prisma
model ImportJob {
  // Primary Key
  id                String    @id @default(cuid())

  // Relationships & Context
  playerId          String
  userId            String
  player            Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // File Metadata
  fileName          String                              // Original uploaded filename
  fileFormat        String                              // 'CSV' | 'XLSX'
  fileSize          Int                                 // Bytes uploaded
  fileHash          String?                             // SHA-256 for integrity checking (optional)

  // Import Status & Counts
  status            String    @default("Uploaded")      // 'Uploaded'|'Parsing'|'Validating'|'PreviewReady'|'Processing'|'Committed'|'Failed'|'FAILED_ROLLBACK_REQUIRED'|'Cancelled'
  totalRecords      Int                                 // Total rows in file
  processedRecords  Int       @default(0)              // Successfully created/updated
  skippedRecords    Int       @default(0)              // User chose to skip
  failedRecords     Int       @default(0)              // Validation failures (blocking)
  warningRecords    Int       @default(0)              // Validation warnings (non-blocking)

  // Import Type Breakdown
  importType        String                              // 'Cards'|'Benefits'|'Mixed'
  cardsCreated      Int       @default(0)
  cardsUpdated      Int       @default(0)
  benefitsCreated   Int       @default(0)
  benefitsUpdated   Int       @default(0)

  // Data Storage
  errorLog          String?                             // JSON array of error objects
  previewData       String?                             // JSON preview before commit (can be large)
  conflictLog       String?                             // JSON log of duplicate resolution decisions

  // Column Mapping
  columnMappings    String?                             // JSON map of file columns to system fields
  detectionConfidence  Float? @default(1.0)            // Avg confidence of auto-mapped columns

  // Timestamps
  createdAt         DateTime  @default(now())
  uploadedAt        DateTime?                           // When file fully uploaded
  parsedAt          DateTime?                           // When parsing completed
  validatedAt       DateTime?                           // When validation completed
  committedAt       DateTime?                           // When transaction committed
  completedAt       DateTime?                           // Final completion timestamp

  // Relationships
  records           ImportRecord[]

  // Indexes for common queries
  @@index([playerId])
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@index([playerId, createdAt])
}
```

**Field Type Definitions & Constraints:**

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| id | String (CUID) | PK, Not Null | Unique import identifier |
| playerId | String | FK, Not Null | Which player's wallet |
| userId | String | FK, Not Null | Who initiated import |
| fileName | String | Max 255, Not Null | For user reference in history |
| fileFormat | String | 'CSV' or 'XLSX', Not Null | Determines parser |
| fileSize | Int | > 0, ≤ 52,428,800, Not Null | For validation and logging |
| fileHash | String | Optional | For deduplication (check if same file uploaded twice) |
| status | String | Enum, Not Null | Drives UI state transitions |
| totalRecords | Int | ≥ 0, Not Null | Gives user expectation |
| processedRecords | Int | ≥ 0, Default 0 | Running count during import |
| skippedRecords | Int | ≥ 0, Default 0 | User chose to skip these |
| failedRecords | Int | ≥ 0, Default 0 | Critical errors (blocking) |
| warningRecords | Int | ≥ 0, Default 0 | Non-blocking issues |
| importType | String | Enum, Not Null | For analytics |
| cardsCreated | Int | ≥ 0 | Rollup stat for summary |
| cardsUpdated | Int | ≥ 0 | Rollup stat for summary |
| benefitsCreated | Int | ≥ 0 | Rollup stat for summary |
| benefitsUpdated | Int | ≥ 0 | Rollup stat for summary |
| errorLog | String (JSON) | Optional, Max 100KB | Serialize error array for debugging |
| previewData | String (JSON) | Optional, Max 5MB | Large data structure stored as JSON |
| conflictLog | String (JSON) | Optional | Track user's duplicate resolution decisions |
| columnMappings | String (JSON) | Optional | Save for future profile reuse |
| detectionConfidence | Float | 0.0-1.0, Default 1.0 | Avg confidence of fuzzy matches |
| createdAt | DateTime | Not Null, Default now() | Start of import process |
| uploadedAt | DateTime | Optional | After successful file upload |
| parsedAt | DateTime | Optional | After parsing completed |
| validatedAt | DateTime | Optional | After validation step |
| committedAt | DateTime | Optional | After transaction committed |
| completedAt | DateTime | Optional | Final status timestamp |

#### ImportRecord Table

Granular tracking of each imported record.

```prisma
model ImportRecord {
  // Primary Key
  id                String    @id @default(cuid())

  // Relationships
  importJobId       String
  importJob         ImportJob @relation(fields: [importJobId], references: [id], onDelete: Cascade)

  // Record Context
  recordType        String                              // 'Card' | 'Benefit'
  rowNumber         Int                                 // Line in original file (1-indexed)
  sequenceIndex     Int                                 // Order in final batch (for deduplication within batch)

  // Original Data
  data              String                              // JSON: original row as parsed
  normalizedData    String?                             // JSON: after parsing & type conversion

  // Validation Status
  status            String    @default("Valid")        // 'Valid'|'Duplicate'|'Conflict'|'Warning'|'Error'|'Skipped'|'Applied'
  validationErrors  String?                             // JSON array of error messages
  validationWarnings String?                            // JSON array of warnings

  // Duplicate Detection
  isDuplicate       Boolean   @default(false)
  duplicateOf       String?                             // ID of existing record this duplicates
  userResolution    String?                             // 'Skip'|'Update'|'Merge' (how user resolved it)

  // Applied Results
  createdCardId     String?                             // If card was created
  createdBenefitId  String?                             // If benefit was created
  updatedCardId     String?                             // If card was updated
  updatedBenefitId  String?                             // If benefit was updated
  appliedData       String?                             // JSON: what was actually stored

  // Metadata
  processedAt       DateTime?
  appliedAt         DateTime?

  // Indexes
  @@index([importJobId])
  @@index([status])
  @@index([rowNumber])
  @@index([isDuplicate])
}
```

**Field Type Definitions & Constraints:**

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| id | String (CUID) | PK, Not Null | Unique record identifier |
| importJobId | String | FK, Not Null | Links to parent import |
| recordType | String | 'Card' or 'Benefit', Not Null | Type of record |
| rowNumber | Int | ≥ 1, Not Null | For user reference in error messages |
| sequenceIndex | Int | ≥ 0 | Order in processing batch |
| data | String (JSON) | Not Null, Max 10KB | Original parsed row |
| normalizedData | String (JSON) | Optional | After type conversion |
| status | String | Enum, Not Null | Current processing status |
| validationErrors | String (JSON) | Optional | Array of error objects |
| validationWarnings | String (JSON) | Optional | Array of warning objects |
| isDuplicate | Boolean | Default false | Quick query for duplicates |
| duplicateOf | String | Optional | ID of original record |
| userResolution | String | Enum, Optional | How user resolved duplicate |
| createdCardId | String | Optional | FK to new UserCard |
| createdBenefitId | String | Optional | FK to new UserBenefit |
| updatedCardId | String | Optional | FK to updated UserCard |
| updatedBenefitId | String | Optional | FK to updated UserBenefit |
| appliedData | String (JSON) | Optional | What was stored in database |
| processedAt | DateTime | Optional | When validation completed |
| appliedAt | DateTime | Optional | When database write committed |

### Schema Changes to Existing Tables

#### UserCard Additions

```prisma
model UserCard {
  // ... existing fields ...
  
  // Import Audit Fields
  importedFrom     String?    // ImportJob ID for audit trail
  importedAt       DateTime?  // When bulk imported (vs manual creation)
  version          Int        @default(1)  // For optimistic locking (conflict detection)
  updatedAt        DateTime   @updatedAt   // Auto-managed, used for version checking
}
```

#### UserBenefit Additions

```prisma
model UserBenefit {
  // ... existing fields ...
  
  // Import Audit Fields
  importedFrom     String?    // ImportJob ID for audit trail
  importedAt       DateTime?  // When bulk imported (vs manual creation)
  version          Int        @default(1)  // For optimistic locking
  updatedAt        DateTime   @updatedAt   // Auto-managed
}
```

#### Add to User Model (for import profiles)

```prisma
model UserImportProfile {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name              String                              // User-friendly name (e.g., "My standard export format")
  description       String?
  fileFormat        String                              // 'CSV' | 'XLSX'
  
  columnMappings    String                              // JSON: {"FileColumn": "SystemField"}
  mappingConfidence Float    @default(1.0)
  
  usageCount        Int      @default(0)               // How many times used
  lastUsedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([lastUsedAt])
}
```

### CSV/XLSX Format Specification

#### Cards Import CSV

**Headers (in order):**
```
CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status
```

**Example:**
```csv
CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status
Chase Sapphire Reserve,Chase,55000,2024-12-31,My Sapphire,Active
American Express Gold,Amex,25000,2025-06-15,,Active
Capital One Venture X,Capital One,39500,2025-03-20,Venture Card,Active
```

**Field Specifications:**

| Column | Type | Required | Format | Validation | Notes |
|--------|------|----------|--------|-----------|-------|
| CardName | String | YES | Text, max 100 chars | Must match existing MasterCard.name | Case-sensitive match against catalog |
| Issuer | String | YES | Text, max 50 chars | Must match existing MasterCard.issuer | Combined with CardName for unique lookup |
| AnnualFee | Integer | NO | Numeric cents | ≥ 0, ≤ 999,999,999 | If omitted, uses MasterCard default. 55000 = $550.00 |
| RenewalDate | Date | YES | ISO 8601 (YYYY-MM-DD) | Must be future date | Validates >= today + 1 day |
| CustomName | String | NO | Text, max 100 chars | Any characters | User's personal nickname for card |
| Status | String | NO | 'Active' or 'Inactive' | Enum | Defaults to 'Active' |

#### Benefits Import CSV

**Headers (in order):**
```
CardName,Issuer,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
```

**Example:**
```csv
CardName,Issuer,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
Chase Sapphire Reserve,Chase,Travel Credit,StatementCredit,30000,30000,2024-12-31,Claimed
Chase Sapphire Reserve,Chase,Dining Credit,StatementCredit,10000,8000,2024-12-31,Unused
American Express Gold,Amex,Dining Credit,StatementCredit,12000,12000,2025-06-15,Unused
```

**Field Specifications:**

| Column | Type | Required | Format | Validation | Notes |
|--------|------|----------|--------|-----------|-------|
| CardName | String | YES | Text | Must exist in import or DB | Links benefit to card |
| Issuer | String | YES | Text | Must match card's issuer | Combined with CardName for lookup |
| BenefitName | String | YES | Text, max 150 chars | Unique per card | Duplicate detection by card+name |
| BenefitType | String | YES | Enum | 'StatementCredit' or 'UsagePerk' | Determines category |
| StickerValue | Integer | YES | Numeric cents | > 0, ≤ 999,999,999 | 30000 = $300.00 |
| DeclaredValue | Integer | NO | Numeric cents | ≥ StickerValue | If omitted, uses StickerValue. User's valuation |
| ExpirationDate | Date | NO | ISO 8601 | Future or null | Auto-calculated if omitted (1 year from today) |
| Usage | String | NO | Enum | 'Claimed' or 'Unused' | Defaults to 'Unused' |

#### Combined Import CSV (Cards + Benefits mixed)

**Headers (in order):**
```
RecordType,CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
```

**Example:**
```csv
RecordType,CardName,Issuer,AnnualFee,RenewalDate,CustomName,Status,BenefitName,BenefitType,StickerValue,DeclaredValue,ExpirationDate,Usage
Card,Chase Sapphire Reserve,Chase,55000,2024-12-31,My Sapphire,Active,,,,,
Benefit,Chase Sapphire Reserve,Chase,,,,,Travel Credit,StatementCredit,30000,30000,2024-12-31,Claimed
Benefit,Chase Sapphire Reserve,Chase,,,,,Dining Credit,StatementCredit,10000,8000,2024-12-31,Unused
Card,American Express Gold,Amex,25000,2025-06-15,,Active,,,,,
```

**Processing Rules:**
1. If RecordType column exists: use it to determine record type
2. If RecordType missing: infer from populated fields
3. Empty cells treated as NULL/omitted values
4. Validate card existence before processing benefits

#### XLSX Export Structure

**Sheet 1: Summary**
- Metadata (export date, export scope, user, etc.)
- Counts (cards, benefits, total value)
- Filter criteria (if filtered export)
- Instructions for re-import

**Sheet 2: Cards**
- Column headers from "Cards CSV Header" specification
- One card per row
- Auto-width columns
- Optional data validation (dropdowns for Status, BenefitType)

**Sheet 3: Benefits**
- Column headers from "Benefits CSV Header" specification
- One benefit per row
- Linked to sheet 2 via CardName+Issuer

---

## API Route Specifications

### Authentication & Headers

All requests require:
```
Authorization: Bearer <session-token>  (or Cookie: session=...)
Content-Type: application/json         (except multipart/form-data for upload)
```

All responses follow standard structure:
```json
{
  "success": boolean,
  "data": T,
  "error": {
    "code": string,
    "message": string,
    "details": object
  }
}
```

### Import Endpoints

#### 1. POST `/api/import/upload`

**Purpose:** Upload CSV/XLSX file and create ImportJob

**Request:**
```
Method: POST
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
  playerId: string (CUID)
  file: File (binary)
```

**Response Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "Uploaded",
    "fileName": "cards_and_benefits.csv",
    "fileSize": 2048,
    "fileFormat": "CSV",
    "totalRecords": 10,
    "columnMappings": {
      "0": "CardName",
      "1": "Issuer",
      "2": "AnnualFee",
      "3": "RenewalDate"
    },
    "mappingConfidence": 0.95,
    "createdAt": "2024-04-02T15:30:00.000Z"
  }
}
```

**Response Errors:**

*400 Bad Request* - Invalid file type:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_FILE_INVALID",
    "message": "File must be CSV or XLSX format",
    "details": { "receivedType": "txt" }
  }
}
```

*413 Payload Too Large* - File exceeds limit:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_FILE_TOO_LARGE",
    "message": "File exceeds 50MB limit. Your file is 75.5MB",
    "details": { "maxBytes": 52428800, "receivedBytes": 79156531 }
  }
}
```

*400 Bad Request* - Empty file:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_FILE_EMPTY",
    "message": "File is empty. Please select a file with data",
    "details": {}
  }
}
```

*403 Forbidden* - Not authorized:
```json
{
  "success": false,
  "error": {
    "code": "AUTHZ_PLAYER_OWNERSHIP",
    "message": "You don't have permission to import to this player",
    "details": { "playerId": "..." }
  }
}
```

---

#### 2. POST `/api/import/{importJobId}/parse`

**Purpose:** Parse uploaded file, detect columns, show preview

**Request:**
```
Method: POST
Content-Type: application/json
Authorization: Bearer <token>

Body: {}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "PreviewReady",
    "fileName": "cards_and_benefits.csv",
    "detectedHeaders": ["CardName", "Issuer", "AnnualFee", "RenewalDate"],
    "columnMapping": {
      "CardName": { "fileIndex": 0, "confidence": 1.0, "detectionType": "exact" },
      "Issuer": { "fileIndex": 1, "confidence": 1.0, "detectionType": "exact" },
      "AnnualFee": { "fileIndex": 2, "confidence": 0.85, "detectionType": "fuzzy" },
      "RenewalDate": { "fileIndex": 3, "confidence": 0.90, "detectionType": "fuzzy" }
    },
    "preview": [
      {
        "rowNumber": 1,
        "recordType": "Card",
        "data": {
          "cardName": "Chase Sapphire Reserve",
          "issuer": "Chase",
          "annualFee": 550,
          "renewalDate": "2024-12-31"
        }
      },
      {
        "rowNumber": 2,
        "recordType": "Card",
        "data": {
          "cardName": "American Express Gold",
          "issuer": "Amex",
          "annualFee": 250,
          "renewalDate": "2025-06-15"
        }
      }
    ],
    "totalRecords": 10,
    "previewLimit": 5,
    "hasMore": true,
    "parseTime": 1.2
  }
}
```

**Response Errors:**

*400 Bad Request* - Unparseable format:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_PARSE_FAILED",
    "message": "Could not parse CSV file. Possible issues: unterminated quotes, invalid encoding",
    "details": {
      "line": 5,
      "reason": "Unterminated quote in column 'CardName'",
      "suggestion": "Check row 5 for improperly quoted fields"
    }
  }
}
```

---

#### 3. POST `/api/import/{importJobId}/validate`

**Purpose:** Validate all records against schema and business rules

**Request:**
```
Method: POST
Content-Type: application/json
Authorization: Bearer <token>

Body: {
  "columnMapping": {
    "CardName": 0,
    "Issuer": 1,
    "AnnualFee": 2,
    "RenewalDate": 3
  }
}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "ValidatingComplete",
    "summary": {
      "totalRecords": 100,
      "validRecords": 95,
      "warningRecords": 3,
      "errorRecords": 2,
      "estimatedDuplicates": 0
    },
    "canProceed": true,
    "records": [
      {
        "rowNumber": 1,
        "recordType": "Card",
        "status": "Valid",
        "data": {
          "cardName": "Chase Sapphire Reserve",
          "issuer": "Chase",
          "annualFee": 550,
          "renewalDate": "2024-12-31"
        },
        "errors": [],
        "warnings": []
      },
      {
        "rowNumber": 5,
        "recordType": "Card",
        "status": "Error",
        "data": {
          "cardName": "Unknown Card",
          "issuer": "Bank"
        },
        "errors": [
          {
            "field": "cardName",
            "message": "Card 'Unknown Card' by 'Bank' not found in system catalog",
            "severity": "critical",
            "suggestion": "Add this card to the system first via Admin panel, or use an existing card name"
          }
        ],
        "warnings": []
      },
      {
        "rowNumber": 8,
        "recordType": "Benefit",
        "status": "Warning",
        "data": {
          "benefitName": "Travel Credit",
          "stickerValue": 300,
          "expirationDate": "2020-12-31"
        },
        "errors": [],
        "warnings": [
          {
            "field": "expirationDate",
            "message": "Expiration date is in the past (2020-12-31)",
            "severity": "warning",
            "suggestion": "Update to current year or mark as Claimed/Inactive"
          }
        ]
      }
    ],
    "validationTime": 2.5
  }
}
```

**Field Type Definitions (Error Objects):**

```typescript
interface ValidationError {
  field: string;                    // CSV column name
  message: string;                  // User-friendly error message
  severity: 'critical' | 'warning'; // critical = blocking, warning = informational
  suggestion: string;               // How to fix it
}

interface ValidationRecord {
  rowNumber: number;        // 1-indexed line in file
  recordType: 'Card' | 'Benefit';
  status: 'Valid' | 'Warning' | 'Error';
  data: Record<string, any>;
  errors: ValidationError[];
  warnings: ValidationError[];
}
```

**Response Errors:**

*400 Bad Request* - Validation failed to run:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_VALIDATION_INTERNAL",
    "message": "Validation could not complete. Check logs.",
    "details": { "reason": "Database connection failed" }
  }
}
```

---

#### 4. POST `/api/import/{importJobId}/duplicates`

**Purpose:** Detect and report duplicate records

**Request:**
```
Method: POST
Content-Type: application/json
Authorization: Bearer <token>

Body: {}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "DuplicateCheckComplete",
    "duplicatesSummary": {
      "cardDuplicates": 2,
      "benefitDuplicates": 5,
      "totalDuplicates": 7
    },
    "duplicates": [
      {
        "id": "dup_1",
        "rowNumber": 12,
        "recordType": "Card",
        "status": "Duplicate",
        "userDecision": null,
        "newRecord": {
          "cardName": "Chase Sapphire Reserve",
          "issuer": "Chase",
          "annualFee": 550,
          "renewalDate": "2025-06-15"
        },
        "existingRecord": {
          "id": "card_abc123",
          "cardName": "Chase Sapphire Reserve",
          "issuer": "Chase",
          "annualFee": 550,
          "renewalDate": "2024-12-31",
          "customName": "My Sapphire",
          "status": "Active",
          "createdAt": "2024-01-15T10:00:00Z"
        },
        "differences": [
          {
            "field": "renewalDate",
            "existing": "2024-12-31",
            "new": "2025-06-15"
          }
        ],
        "suggestedActions": ["Skip", "Update", "KeepBoth"]
      },
      {
        "id": "dup_2",
        "rowNumber": 15,
        "recordType": "Benefit",
        "status": "Duplicate",
        "userDecision": null,
        "newRecord": {
          "cardName": "Chase Sapphire Reserve",
          "issuer": "Chase",
          "benefitName": "Travel Credit",
          "stickerValue": 300,
          "declaredValue": 300,
          "usage": "Unused"
        },
        "existingRecord": {
          "id": "ben_xyz789",
          "benefitName": "Travel Credit",
          "stickerValue": 300,
          "declaredValue": 300,
          "usage": "Claimed",
          "createdAt": "2024-01-20T14:22:00Z"
        },
        "differences": [
          {
            "field": "usage",
            "existing": "Claimed",
            "new": "Unused"
          }
        ],
        "suggestedActions": ["Skip", "Update"]
      }
    ],
    "hasDuplicates": true
  }
}
```

---

#### 5. PATCH `/api/import/{importJobId}/duplicates`

**Purpose:** Apply user's duplicate resolution decisions

**Request:**
```
Method: PATCH
Content-Type: application/json
Authorization: Bearer <token>

Body: {
  "decisions": [
    {
      "duplicateId": "dup_1",
      "action": "Update",
      "fieldsToUpdate": ["renewalDate"]
    },
    {
      "duplicateId": "dup_2",
      "action": "Skip"
    }
  ]
}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "DuplicatesResolved",
    "decisionsApplied": 7,
    "conflictLog": [
      {
        "duplicateId": "dup_1",
        "decision": "Update",
        "appliedAt": "2024-04-02T15:31:00.000Z"
      }
    ]
  }
}
```

**Response Errors:**

*400 Bad Request* - Invalid decision:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_INVALID_DECISION",
    "message": "Invalid duplicate resolution action",
    "details": {
      "duplicateId": "dup_1",
      "action": "InvalidAction",
      "validActions": ["Skip", "Update", "Merge"]
    }
  }
}
```

---

#### 6. GET `/api/import/{importJobId}/preview`

**Purpose:** Get final preview before commit

**Request:**
```
Method: GET
Content-Type: application/json
Authorization: Bearer <token>

Query: {}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "PreviewReady",
    "summary": {
      "totalRecords": 97,
      "cardsToCreate": 5,
      "cardsToUpdate": 0,
      "cardsToSkip": 0,
      "benefitsToCreate": 45,
      "benefitsToUpdate": 10,
      "benefitsToSkip": 37
    },
    "estimatedImpact": {
      "cardsBeforeImport": 3,
      "cardsAfterImport": 8,
      "benefitsBeforeImport": 25,
      "benefitsAfterImport": 80,
      "newAnnualValue": 250000,
      "projectedROIChange": 1.15
    },
    "preview": [
      {
        "id": "rec_1",
        "rowNumber": 1,
        "action": "Create",
        "recordType": "Card",
        "data": {
          "cardName": "Chase Sapphire Reserve",
          "issuer": "Chase",
          "annualFee": 550,
          "renewalDate": "2024-12-31"
        }
      }
    ],
    "previewLimit": 100,
    "hasMorePreviewRecords": false,
    "readyToCommit": true
  }
}
```

---

#### 7. POST `/api/import/{importJobId}/commit`

**Purpose:** Execute import transaction and finalize

**Request:**
```
Method: POST
Content-Type: application/json
Authorization: Bearer <token>

Body: {
  "confirmRollback": true  // User acknowledges rollback on error
}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
    "status": "Committed",
    "results": {
      "cardsCreated": 5,
      "cardsUpdated": 0,
      "benefitsCreated": 45,
      "benefitsUpdated": 10,
      "recordsSkipped": 37,
      "totalProcessed": 97,
      "totalRecords": 100
    },
    "committedAt": "2024-04-02T15:35:20.000Z",
    "summary": "Successfully imported 50 cards and 55 benefits. 37 records skipped per your choices.",
    "auditTrail": {
      "importedBy": "user_123",
      "importedFor": "player_456",
      "importedAt": "2024-04-02T15:35:20.000Z",
      "fileHash": "sha256:abc123..."
    }
  }
}
```

**Response Errors:**

*409 Conflict* - Data modified during import:
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_WALLET_MODIFIED",
    "message": "Your wallet was modified by another session. Import rolled back completely.",
    "details": {
      "rollback": true,
      "reason": "Unique constraint violation: Card already added manually",
      "affectedCard": "Chase Sapphire Reserve"
    }
  }
}
```

*500 Internal Error* - Rollback failure (critical):
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ROLLBACK_FAILED",
    "message": "Import failed and rollback could not complete. Administrator notified.",
    "details": {
      "importJobId": "imp_6h7k8j9l2m3n4p5q6r7s",
      "status": "FAILED_ROLLBACK_REQUIRED",
      "action": "Contact support with this ID for manual recovery"
    }
  }
}
```

---

### Export Endpoints

#### 1. GET `/api/export/options`

**Purpose:** Get available export options for a scope

**Request:**
```
Method: GET
Authorization: Bearer <token>

Query Parameters:
  scope: 'Card' | 'Player' | 'Filtered'
  cardId?: string       (required if scope='Card')
  filterType?: string   ('DateRange' | 'BenefitType' | 'Status' | 'Custom')
  filterValue?: string  (JSON-encoded filter criteria)
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "scope": "Card",
    "cardId": "card_123",
    "cardName": "Chase Sapphire Reserve",
    "recordCounts": {
      "cards": 1,
      "benefits": 12,
      "totalRecords": 13
    },
    "availableFormats": ["CSV", "XLSX"],
    "exportOptions": {
      "includeCalculatedValues": {
        "label": "Include ROI and Annual Value calculations",
        "default": true,
        "available": true
      },
      "includeAuditTrail": {
        "label": "Include created/updated timestamps",
        "default": true,
        "available": true
      },
      "includeSystemIds": {
        "label": "Include system IDs (for advanced users)",
        "default": false,
        "available": true
      }
    },
    "columnSelection": [
      {
        "columnId": "cardName",
        "label": "Card Name",
        "selected": true,
        "required": true,
        "category": "Card"
      },
      {
        "columnId": "issuer",
        "label": "Issuer",
        "selected": true,
        "required": true,
        "category": "Card"
      },
      {
        "columnId": "annualFee",
        "label": "Annual Fee",
        "selected": true,
        "required": false,
        "category": "Card"
      }
    ],
    "estimatedFileSize": 15000,
    "estimatedGenerationTime": 1.5
  }
}
```

---

#### 2. POST `/api/export/generate`

**Purpose:** Generate and download export file

**Request:**
```
Method: POST
Content-Type: application/json
Authorization: Bearer <token>

Body: {
  "scope": "Card",
  "cardId": "card_123",
  "format": "CSV",
  "options": {
    "includeCalculatedValues": true,
    "includeAuditTrail": true,
    "includeSystemIds": false
  },
  "customColumns": ["cardName", "issuer", "annualFee", "renewalDate"]
}
```

**Response Success (200 OK):**
```
Content-Type: text/csv (or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
Content-Disposition: attachment; filename="CardBenefits_20240402_153000.csv"
Content-Length: 2048

[File binary content]
```

**Response Errors:**

*400 Bad Request* - Invalid scope:
```json
{
  "success": false,
  "error": {
    "code": "EXPORT_INVALID_SCOPE",
    "message": "Invalid export scope",
    "details": {
      "scope": "InvalidScope",
      "validScopes": ["Card", "Player", "Filtered"]
    }
  }
}
```

*404 Not Found* - No data to export:
```json
{
  "success": false,
  "error": {
    "code": "EXPORT_NO_DATA",
    "message": "Nothing to export. Add cards to your wallet first.",
    "details": {
      "scope": "Player",
      "recordCount": 0
    }
  }
}
```

---

#### 3. GET `/api/export/history`

**Purpose:** Get list of past exports for user

**Request:**
```
Method: GET
Authorization: Bearer <token>

Query Parameters:
  limit: number (default: 20, max: 100)
  offset: number (default: 0)
  scope?: string ('Card' | 'Player' | 'Filtered')
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "exports": [
      {
        "id": "exp_123",
        "exportedAt": "2024-04-02T15:30:00.000Z",
        "scope": "Card",
        "cardId": "card_123",
        "cardName": "Chase Sapphire Reserve",
        "format": "CSV",
        "fileName": "CardBenefits_20240402_153000.csv",
        "fileSize": 2048,
        "recordCount": 13,
        "createdBy": "user_456"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## User Flows & State Management

### Import Wizard State Machine

```
Initial State: IDLE
  ↓
[User clicks "Import"]
  ↓
STEP_1_UPLOAD → [File selected & validated] → STEP_2_PARSE
  ↓
  [File invalid] → ERROR (retry file)
  ↓
STEP_2_PARSE → [Parsing complete] → STEP_3_VALIDATE
  ↓
  [Parse error] → ERROR (invalid format)
  ↓
STEP_3_VALIDATE → [All records checked] → STEP_4_DUPLICATES
  ↓
  [Critical errors] → ERROR (requires file fix)
  ↓
STEP_4_DUPLICATES → [Resolutions chosen] → STEP_5_PREVIEW
  ↓
  [No duplicates] → STEP_5_PREVIEW (skip to preview)
  ↓
STEP_5_PREVIEW → [Ready to commit] → COMMITTING
  ↓
  [User cancels] → CANCELLED
  ↓
COMMITTING → [Success] → COMMITTED
  ↓
  [Conflict/Error] → FAILED (with rollback)
  ↓
COMPLETED or FAILED → Return to Dashboard
```

### Import Wizard Context Structure

```typescript
interface ImportWizardContext {
  // Overall state
  currentStep: 1 | 2 | 3 | 4 | 5;
  status: 'idle' | 'uploading' | 'parsing' | 'validating' | 'duplicate-check' | 'preview-ready' | 'committing' | 'committed' | 'failed' | 'cancelled';
  
  // Job reference
  importJobId: string | null;
  
  // Step 1: Upload
  uploadedFile: File | null;
  fileSize: number;
  fileFormat: 'CSV' | 'XLSX' | null;
  uploadProgress: number; // 0-100
  
  // Step 2: Parse
  detectedHeaders: string[];
  columnMapping: Record<string, string>; // fileColumn → systemField
  mappingConfidence: number; // 0-1
  previewRows: any[];
  totalRecords: number;
  
  // Step 3: Validate
  validationResults: {
    totalRecords: number;
    validRecords: number;
    warningRecords: number;
    errorRecords: number;
  };
  validationRecords: ValidationRecord[];
  canProceed: boolean; // No critical errors
  
  // Step 4: Duplicates
  duplicates: DuplicateRecord[];
  duplicateDecisions: Record<string, 'Skip' | 'Update' | 'Merge'>;
  
  // Step 5: Preview
  previewSummary: {
    cardsToCreate: number;
    cardsToUpdate: number;
    benefitsToCreate: number;
    benefitsUpdated: number;
    totalToImport: number;
  };
  
  // Errors
  currentError: Error | null;
  
  // History
  visitedSteps: number[]; // For back navigation
}
```

### UI State Transitions

**Step 1 → Step 2:**
- File uploaded successfully ✓
- File format validated ✓
- File size < 50MB ✓
- File content readable ✓

**Step 2 → Step 3:**
- User confirmed column mapping OR
- User accepted auto-mapping ✓

**Step 3 → Step 4:**
- No critical errors in validation ✓
- (Warnings allowed)

**Step 4 → Step 5:**
- User resolved all duplicates (chose action for each) OR
- No duplicates detected ✓

**Step 5 → Commit:**
- User clicked "Confirm & Import" ✓
- State snapshot frozen (prevent back-navigation after commit)

**Commit → Complete:**
- All database transactions committed OR
- All rolled back on error

---

## Edge Cases & Handling Strategies

### Category 1: File Format & Structure Issues

#### Edge Case #1: Malformed CSV (Unterminated Quotes)

**Scenario:**
```csv
CardName,Issuer,AnnualFee,RenewalDate
"Chase Sapphire Reserve,Chase,550,2024-12-31
```
(Missing closing quote)

**Detection:**
- During parse phase in Step 2
- CSV parser encounters unterminated quote and throws error
- Line number identified

**Handling:**
```typescript
// In importParser.ts
try {
  const rows = Papa.parse(csvContent);
  if (rows.errors.length > 0) {
    throw new ParseError({
      message: "CSV parsing failed",
      line: rows.errors[0].row,
      reason: rows.errors[0].code // 'UnterminatedQuote', 'BadDelimiter'
    });
  }
} catch (e) {
  return {
    success: false,
    error: 'IMPORT_PARSE_FAILED',
    details: {
      line: e.line,
      suggestion: 'Check for unclosed quotes in column headers or data'
    }
  };
}
```

**User Experience:**
- Show: "Could not parse CSV file. Issue on line 2: Unterminated quote"
- Suggestion: "Check that all quoted fields have closing quotes"
- Action: Allow user to fix file locally and re-upload

**Test Cases:**
- Unterminated quote at line 5
- Unterminated quote at line 1 (header)
- Multiple unterminated quotes
- Mixed terminated/unterminated

---

#### Edge Case #2: Invalid File Type (Disguised as CSV)

**Scenario:** User uploads `document.pdf` renamed as `data.csv`

**Detection:**
- Server-side magic byte check (Amendment #2)
- File extension: `.csv` ✓
- Magic bytes: Not CSV-like (could be PDF, ZIP, etc.)

**Handling:**
```typescript
// In uploadImportFile action
const buffer = await file.arrayBuffer();
const uint8Array = new Uint8Array(buffer);

// Check for common fake formats
const isPDF = uint8Array[0] === 0x25 && uint8Array[1] === 0x50; // %P
const isZIP = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B; // PK
const isExcel = uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF; // MS Office

if (isPDF || isZIP || isExcel) {
  return {
    success: false,
    error: 'IMPORT_FILE_INVALID',
    message: 'File appears to be a different format than claimed'
  };
}

// For CSV, verify it's valid UTF-8
const text = new TextDecoder().decode(buffer.slice(0, 1024));
if (text.includes('\ufffd')) { // Unicode replacement character = bad encoding
  return {
    success: false,
    error: 'IMPORT_FILE_INVALID_ENCODING',
    message: 'File is not valid UTF-8 encoded CSV'
  };
}
```

**User Experience:**
- Show: "File format doesn't match. This appears to be a PDF file."
- Action: Reject, ask user to provide correct CSV/XLSX file

**Test Cases:**
- PDF with .csv extension
- Zip file with .csv extension
- Binary file with .csv extension
- XLSX with .csv extension

---

#### Edge Case #3: Empty File

**Scenario:** User uploads empty CSV (0 bytes)

**Detection:**
- Client-side before upload: `file.size === 0`
- Server-side on upload endpoint: check file size before processing

**Handling:**
```typescript
// Client-side
if (file.size === 0) {
  return {
    valid: false,
    error: 'File is empty. Please select a file with data.'
  };
}

// Server-side
if (buffer.byteLength === 0) {
  throw new ValidationError('IMPORT_FILE_EMPTY', 'File is empty');
}
```

**User Experience:**
- Show: "Your file is empty. Please select a file with card data."
- Action: Reject, allow re-upload

**Test Cases:**
- 0 byte file
- File with only whitespace
- File with only header row (no data)

---

### Category 2: Data Format & Type Issues

#### Edge Case #4: Invalid Date Format

**Scenario:**
```csv
CardName,Issuer,AnnualFee,RenewalDate
Chase Sapphire Reserve,Chase,550,12/31/2024
```
(User enters MM/DD/YYYY instead of ISO 8601)

**Detection:**
- During validation phase in Step 3
- Date parsing against ISO 8601 pattern `YYYY-MM-DD`
- `12/31/2024` doesn't match

**Handling:**
```typescript
// In importValidator.ts
function validateRenewalDate(value: string): ValidationResult {
  // Try to parse as ISO 8601
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!isoRegex.test(value)) {
    return {
      valid: false,
      error: `RenewalDate must be ISO 8601 format (YYYY-MM-DD), got '${value}'`,
      severity: 'critical',
      suggestion: 'Convert to format like 2024-12-31 and try again'
    };
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: `RenewalDate is not a valid date: '${value}'`,
      severity: 'critical',
      suggestion: 'Check that the date is real (e.g., 2024-02-30 is invalid)'
    };
  }
  
  if (date <= new Date()) {
    return {
      valid: false,
      error: `RenewalDate must be in future (got '${value}')`,
      severity: 'critical',
      suggestion: 'This card appears to be closed. Use Status=\'Inactive\' instead'
    };
  }
  
  return { valid: true };
}
```

**User Experience:**
- Show: "Row 2, Column 'RenewalDate': must be ISO 8601 format (YYYY-MM-DD), got '12/31/2024'"
- Suggestion: "Convert the date to format like 2024-12-31"
- Action: Block import, require user to fix file

**Test Cases:**
- MM/DD/YYYY format
- DD/MM/YYYY format (UK style)
- Excel date serial (43000)
- Text like "next year"
- Partial dates like "2024-12"
- Invalid dates like "2024-02-30"

---

#### Edge Case #5: Negative Annual Fee

**Scenario:**
```csv
CardName,Issuer,AnnualFee,RenewalDate
Chase Sapphire Reserve,Chase,-550,2024-12-31
```

**Detection:**
- Validation phase Step 3
- Numeric validation: AnnualFee < 0

**Handling:**
```typescript
function validateAnnualFee(value: number | string): ValidationResult {
  const numeric = Number(value);
  
  if (isNaN(numeric)) {
    return {
      valid: false,
      error: `AnnualFee must be numeric, got '${value}'`,
      severity: 'critical'
    };
  }
  
  if (numeric < 0) {
    return {
      valid: false,
      error: `AnnualFee must be non-negative (got ${numeric})`,
      severity: 'critical',
      suggestion: `Did you mean ${Math.abs(numeric)}? Or this card has no fee?`
    };
  }
  
  if (numeric > 999999999) {
    return {
      valid: false,
      error: `AnnualFee exceeds maximum (${numeric} cents = $${(numeric/100).toFixed(2)})`,
      severity: 'critical'
    };
  }
  
  return { valid: true, value: numeric };
}
```

**User Experience:**
- Show: "Row 2, Column 'AnnualFee': must be non-negative (got -550)"
- Suggestion: "Did you mean 550? Or use 0 if this card has no fee"
- Action: Block import

**Test Cases:**
- Small negative values (-1)
- Large negative values (-999999)
- Negative decimals (-550.50)
- Text negative ("-550")

---

#### Edge Case #6: Past Renewal Date

**Scenario:**
```csv
CardName,Issuer,AnnualFee,RenewalDate
Chase Sapphire Reserve,Chase,550,2020-12-31
```

**Detection:**
- Validation phase Step 3
- Date validation: RenewalDate <= today

**Handling:**
```typescript
function validateRenewalDate(value: string): ValidationResult {
  // ... parse validation ...
  
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date <= today) {
    return {
      valid: false,
      error: `RenewalDate must be in future (got '${value}', today is '${today.toISOString().split('T')[0]}')`,
      severity: 'critical',
      suggestion: 'This card appears to be closed or expired. Mark Status=\'Inactive\' if no longer in use'
    };
  }
  
  // Warn if very far in future (>10 years)
  const tenYearsLater = new Date();
  tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
  if (date > tenYearsLater) {
    return {
      valid: true,
      warnings: [{
        message: `RenewalDate is very far in future (${value}). Is this a typo?`
      }]
    };
  }
  
  return { valid: true };
}
```

**User Experience:**
- Show: "Row 2, Column 'RenewalDate': must be in future (got '2020-12-31')"
- Suggestion: "This card appears to be closed. Use Status='Inactive' instead"
- Action: Block import

**Test Cases:**
- Far past dates (1990-01-01)
- Recent past (yesterday)
- Today's date
- Very far future (2100-01-01) - show warning

---

### Category 3: Business Logic & Catalog Issues

#### Edge Case #7: Card Not in Master Catalog

**Scenario:**
```csv
CardName,Issuer,AnnualFee,RenewalDate
My Custom Card,MyBank,550,2024-12-31
```

**Detection:**
- Validation phase Step 3
- Query MasterCard table for matching cardName + issuer
- Not found → validation error

**Handling:**
```typescript
async function validateCardName(
  cardName: string,
  issuer: string
): Promise<ValidationResult> {
  const masterCard = await db.masterCard.findFirst({
    where: {
      name: cardName,
      issuer: issuer
    }
  });
  
  if (!masterCard) {
    return {
      valid: false,
      error: `Card '${cardName}' by '${issuer}' not found in system catalog`,
      severity: 'critical',
      suggestion: 'Add this card to the system first via Admin panel, or use an existing card name',
      details: {
        cardName,
        issuer,
        action: 'Check available cards or contact admin'
      }
    };
  }
  
  return { valid: true, data: { masterCardId: masterCard.id } };
}
```

**User Experience:**
- Show: "Row 2: Card 'My Custom Card' by 'MyBank' not found in system"
- Suggestion: "This card is not in the system catalog. Ask your admin to add it, or use an existing card"
- Link: "View available cards in the catalog"
- Action: Block import of this record (skip if user allows)

**Test Cases:**
- Completely nonexistent card
- Card name matches but issuer wrong (partial match)
- Typo in card name ("Sapphire" vs "Sapphire Reserve")
- Card exists but issuer is null

---

#### Edge Case #8: Duplicate Benefit Name on Same Card

**Scenario:** User imports:
```csv
RecordType,CardName,Issuer,BenefitName,BenefitType,StickerValue
Benefit,Chase Sapphire,Chase,Travel Credit,StatementCredit,30000
Benefit,Chase Sapphire,Chase,Travel Credit,StatementCredit,30000
```

**Detection:**
- Two records in same import with identical benefitName + cardName
- Unique constraint during commit (if allowed through)

**Handling:**
```typescript
// In duplicate detection phase
function findDuplicateBenefitsWithinBatch(
  benefitRecords: ImportRecord[]
): ImportRecord[] {
  const seen = new Map<string, ImportRecord>();
  const duplicates: ImportRecord[] = [];
  
  for (const record of benefitRecords) {
    const key = `${record.data.cardName}::${record.data.issuer}::${record.data.benefitName}`;
    
    if (seen.has(key)) {
      // This is a duplicate within the batch
      record.isDuplicate = true;
      record.duplicateOf = seen.get(key)!.id;
      duplicates.push(record);
    } else {
      seen.set(key, record);
    }
  }
  
  return duplicates;
}

// Show user in duplicate check step
{
  "duplicatesSummary": {
    "withinBatchDuplicates": 1,
    "againstDatabaseDuplicates": 5
  },
  "duplicates": [
    {
      "id": "dup_101",
      "rowNumber": 2,
      "recordType": "Benefit",
      "reason": "Duplicate benefit in this import",
      "newRecord": { "benefitName": "Travel Credit", "stickerValue": 30000 },
      "duplicateOf": "row 1 of this import",
      "suggestedActions": ["Skip", "KeepBoth"]
    }
  ]
}
```

**User Experience:**
- Show in Step 4: "You have 2 'Travel Credit' benefits in this import on the same card. Which do you want?"
- Options: [Skip second one] [Keep both (create variants)]
- Action: User chooses, import proceeds with decision

**Test Cases:**
- Exact duplicate within import
- Duplicate benefit within import on same card
- Duplicate within import on different cards (allow)
- Duplicate in import + database (handle both)

---

### Category 4: Concurrency & Race Conditions

#### Edge Case #9: Wallet Modified During Preview

**Scenario:**
1. User starts import, reaches preview step
2. Another session adds same card manually
3. User clicks "Commit"
4. Unique constraint violation: (playerId, masterCardId) already exists

**Detection:**
- During commit transaction (Step 7 API call)
- Prisma error `P2002`: unique constraint violation

**Handling:**
```typescript
async function performImportWithRollback(
  importJobId: string,
  recordsToImport: ImportRecord[]
): Promise<ImportResult> {
  const transaction = await prisma.$transaction(async (tx) => {
    // ... insert all records ...
    
    return {
      cardsCreated: 5,
      benefitsCreated: 45
    };
  }).catch(async (error) => {
    // Catch constraint violations
    if (error.code === 'P2002') {
      // Unique constraint violated
      const meta = error.meta;
      const target = meta?.target; // ['playerId', 'masterCardId']
      
      // Rollback is automatic with Prisma transaction
      // Log it
      await db.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'Failed',
          errorLog: JSON.stringify({
            error: 'CONFLICT_UNIQUE_CONSTRAINT',
            details: error.message,
            target,
            rollback: true
          })
        }
      });
      
      return {
        success: false,
        error: {
          code: 'CONFLICT_WALLET_MODIFIED',
          message: 'Your wallet was modified during import. Import rolled back completely.',
          details: {
            target,
            suggestion: 'Try importing again'
          }
        }
      };
    }
    
    // Other errors
    throw error;
  });
}
```

**User Experience:**
- Show: "Your wallet was modified by another session. The import was rolled back completely (no changes made)."
- Action: User can retry, start new import, or resolve the conflict manually first

**Test Cases:**
- Card added manually during import
- Card deleted during import
- Benefit added during import
- Multiple concurrent imports on same player

---

#### Edge Case #10: Concurrent Imports on Same Player

**Scenario:**
1. Import A starts on player_123 (reading wallet data)
2. Import B starts on player_123 simultaneously
3. Both try to create same benefit during commit

**Detection:**
- Unique constraint during commit

**Handling:**
```typescript
// Prevent concurrent modifying imports on same player
async function lockPlayerForImport(playerId: string): Promise<boolean> {
  try {
    // Set status = 'IMPORTING' to lock
    await db.player.update({
      where: { id: playerId, status: { not: 'IMPORTING' } },
      data: { status: 'IMPORTING' }
    });
    return true;
  } catch {
    // Player already locked
    return false;
  }
}

// In commit endpoint
if (!await lockPlayerForImport(playerId)) {
  return {
    success: false,
    error: 'CONFLICT_IMPORT_IN_PROGRESS',
    message: 'Another import is in progress for this player. Please wait.',
    details: { action: 'Retry in a few moments' }
  };
}

try {
  // ... perform import ...
} finally {
  // Release lock
  await db.player.update({
    where: { id: playerId },
    data: { status: 'Active' }
  });
}
```

**User Experience:**
- Show: "Another import is already in progress for this player. Please wait a moment and try again."
- Action: Queue the import or reject with retry suggestion

**Test Cases:**
- Two simultaneous imports
- Import while manual edit in progress
- Import while export in progress

---

### Category 5: Data Transformation & Special Characters

#### Edge Case #11: Special Characters in Data (Quotes, Commas, Unicode)

**Scenario:**
```csv
CardName,Issuer,BenefitName,Notes
Chase "Premium" Reserve,Chase,Dining "Credit" for All,"Use at any restaurant, even ""fancy"" ones"
```

**Detection:**
- Proper CSV parsing handles this (PapaParse)
- But requires proper escaping

**Handling:**
```typescript
// PapaParse with proper config
const results = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false, // Keep everything as string initially
  quoteChar: '"',
  escapeChar: '"',
  transformHeader: (h) => h.trim(), // Trim header names
});

// Test cases should cover:
// 1. Quotes in data: Chase "Sapphire" Reserve
// 2. Commas in quoted fields: "Reserve, Preferred"
// 3. Newlines in quoted fields: "Multi\nline benefit"
// 4. Unicode: "Dining Card for Français"
// 5. Emojis: "🍽️ Dining Credit"
// 6. Control characters: Tabs, null bytes

// When storing, keep as-is (no sanitization except formula escaping)
function sanitizeForStorage(value: string): string {
  // Only escape formula prefixes
  if (/^[=+@-\[]/.test(value.trim())) {
    return "'" + value; // Prefix with single quote
  }
  return value;
}

// When exporting back to CSV, use proper escaping
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Wrap in quotes and escape internal quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

**User Experience:**
- Should work seamlessly (PapaParse handles it)
- On round-trip (export + import), data preserved exactly

**Test Cases:**
- Field with quotes: "Chase "Reserve""
- Field with commas: "Dining, Travel"
- Field with newlines: "Multi\nline name"
- Field with emoji: "🍽️ Credit"
- Field with accents: "Café Points"
- Field with null bytes (reject)

---

### Category 6: Large Files & Performance

#### Edge Case #12: Large File Import (50K+ Records)

**Scenario:** User uploads 50MB CSV with 50,000 records

**Detection:**
- Client-side: File size check before upload
- Server-side: Content-Length header check + file size validation

**Handling:**
```typescript
// Client-side validation
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

if (file.size > MAX_SIZE_BYTES) {
  return {
    error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_SIZE_MB}MB.`
  };
}

// Server-side streaming parser for large files
async function parseCSVStreaming(
  stream: ReadableStream,
  maxRows: number = 50000
): Promise<{ rows: any[]; totalRows: number }> {
  const rows: any[] = [];
  let rowCount = 0;
  
  return new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => {
        if (rowCount >= maxRows) {
          stream.destroy();
          return;
        }
        rows.push(row);
        rowCount++;
      })
      .on('end', () => {
        if (rowCount >= maxRows) {
          resolve({
            rows,
            totalRows: rowCount,
            error: `File contains ${rowCount}+ records. Max is ${maxRows}. Split into multiple files.`
          });
        } else {
          resolve({ rows, totalRows: rowCount });
        }
      })
      .on('error', reject);
  });
}

// Show progress during validation (batch by 1000)
async function validateAllRecords(
  records: any[],
  onProgress: (processed: number) => void
) {
  const batchSize = 1000;
  const results: ValidationResult[] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(validateRecord)
    );
    results.push(...batchResults);
    
    onProgress(i + batchSize);
  }
  
  return results;
}

// Commit in smaller transactions (1000 records per batch)
async function commitInBatches(
  records: ImportRecord[],
  batchSize: number = 1000
) {
  const batches = chunk(records, batchSize);
  let totalProcessed = 0;
  
  for (const batch of batches) {
    const result = await prisma.$transaction(async (tx) => {
      // Create cards
      // Create benefits
      // Create ImportRecords
      return { created: batch.length };
    });
    
    totalProcessed += result.created;
    // Update ImportJob with progress
  }
}
```

**User Experience:**
- Show progress bar during parsing, validation, and commit
- Estimated time remaining
- Cancel button to abort
- "Processing 50,000 records..." → "Step 2/3: Validation (23% complete)"

**Test Cases:**
- 50,000 records CSV
- Memory usage stays < 500MB
- Parse < 30 seconds
- Validation < 30 seconds
- Commit < 30 seconds
- Browser doesn't freeze (show progress)

---

#### Edge Case #13: Empty Wallet Export

**Scenario:** Player has no cards, tries to export

**Detection:**
- Query UserCard table for playerId
- Returns empty set

**Handling:**
```typescript
async function generateExport(scope: string, playerId: string) {
  if (scope === 'Player') {
    const cards = await db.userCard.findMany({
      where: { playerId }
    });
    
    if (cards.length === 0) {
      return {
        success: false,
        error: 'EXPORT_NO_DATA',
        message: 'Nothing to export. Add cards to your wallet first.',
        details: { recordCount: 0 }
      };
    }
  }
  
  // ... proceed with export ...
}
```

**User Experience:**
- Show: "You haven't added any cards yet. Add cards to your wallet first."
- Hide "Export" button on empty dashboard
- If user forces export: return empty file with headers only (graceful fallback)

**Test Cases:**
- Player with no cards
- Player with cards but no benefits
- Filtered export with no matches

---

### Category 7: Data Consistency & Round-Trip

#### Edge Case #14: Null/Optional Fields in Export/Re-Import

**Scenario:**
```
Original Benefit: { benefitName: "Travel", declaredValue: null, expirationDate: null }
Export to CSV: { benefitName: "Travel", declaredValue: "", expirationDate: "" }
Re-import CSV: { benefitName: "Travel", declaredValue: undefined, expirationDate: undefined }
Database: null values preserved
```

**Detection:**
- Export: Empty cell for null
- Re-import: Empty cell parsed as undefined/null

**Handling:**
```typescript
// Export: Treat null as empty string
function serializeValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value);
}

// Import: Treat empty string as null
function deserializeValue(value: string, fieldType: string): any {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  
  if (fieldType === 'Date') {
    return new Date(value);
  }
  if (fieldType === 'Number') {
    return Number(value);
  }
  
  return value;
}

// Round-trip test
const original = {
  benefitName: "Travel Credit",
  declaredValue: null,
  expirationDate: null
};

const exported = serializeForCSV(original);
const reimported = deserializeFromCSV(exported);

assert.deepEqual(original, reimported); // ✓ Should be identical
```

**User Experience:**
- Invisible to user
- Data automatically preserved on round-trip

**Test Cases:**
- All null fields
- Mix of null and populated fields
- Null optional fields with required fields populated
- Verify exact round-trip consistency

---

## Security Implementation

### Input Validation & Sanitization

#### CSV Injection Prevention

**Threat:** Cell containing `=SUM(A1:A10)` executes as formula in Excel

**Prevention:**
```typescript
function detectFormulaStart(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const firstChar = value.trim().charAt(0);
  return ['=', '+', '-', '@', '['].includes(firstChar);
}

function sanitizeForExport(value: string): string {
  if (detectFormulaStart(value)) {
    // Prefix with single quote (Excel displays as text)
    return "'" + value;
  }
  return value;
}

// Test cases
assert.equal(sanitizeForExport("=SUM(A1)"), "'=SUM(A1)");
assert.equal(sanitizeForExport("+1+1"), "'+1+1");
assert.equal(sanitizeForExport("Normal text"), "Normal text");
```

#### Field Length Validation

```typescript
const FIELD_CONSTRAINTS = {
  cardName: { maxLength: 100, pattern: /^[a-zA-Z0-9\s\-&().']+$/ },
  benefitName: { maxLength: 150, pattern: /^[a-zA-Z0-9\s\-&().']+$/ },
  customName: { maxLength: 100, pattern: /^[a-zA-Z0-9\s\-&().']*$/ },
  notes: { maxLength: 500 }
};

function validateFieldLength(field: string, value: string, constraints: Constraint): ValidationResult {
  if (value.length > constraints.maxLength) {
    return {
      valid: false,
      error: `${field} exceeds maximum length of ${constraints.maxLength}`,
      received: value.length
    };
  }
  
  if (constraints.pattern && !constraints.pattern.test(value)) {
    return {
      valid: false,
      error: `${field} contains invalid characters`
    };
  }
  
  return { valid: true };
}
```

#### Authorization Checks

```typescript
// Verify user owns player before any import/export
async function verifyPlayerOwnership(
  userId: string,
  playerId: string
): Promise<boolean> {
  const player = await db.player.findFirst({
    where: {
      id: playerId,
      userId // Only return if this user created it
    }
  });
  
  return !!player;
}

// Use in every endpoint
export async function uploadImportFile(playerId: string, file: File) {
  const userId = await getAuthUserIdOrThrow();
  
  if (!await verifyPlayerOwnership(userId, playerId)) {
    throw new AuthorizationError('AUTHZ_PLAYER_OWNERSHIP');
  }
  
  // ... proceed ...
}
```

### Rate Limiting

```typescript
// In API route
import { Ratelimit } from '@upstash/ratelimit';

const uploadRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 m'), // 5 uploads per 10 minutes
  analytics: true
});

const importRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 imports per hour
  analytics: true
});

export async function uploadImportFile(playerId: string, file: File) {
  const userId = await getAuthUserIdOrThrow();
  
  const { success } = await uploadRateLimit.limit(userId);
  if (!success) {
    throw new RateLimitError('Too many upload attempts. Try again in 10 minutes.');
  }
  
  // ... proceed ...
}
```

### Audit Logging

```typescript
// Log every import/export operation
async function logImportOperation(
  userId: string,
  playerId: string,
  action: 'Started' | 'Completed' | 'Failed',
  details: object
) {
  await db.auditLog.create({
    data: {
      userId,
      action: `IMPORT_${action}`,
      resourceType: 'ImportJob',
      resourceId: playerId,
      details: JSON.stringify(details),
      timestamp: new Date(),
      ipAddress: getClientIP(), // From request headers
      userAgent: getUserAgent() // From request headers
    }
  });
}

// Query for suspicious activity
const logs = await db.auditLog.findMany({
  where: {
    action: 'IMPORT_Failed',
    timestamp: { gte: new Date(Date.now() - 3600000) } // Last hour
  },
  orderBy: { timestamp: 'desc' },
  take: 100
});
```

---

## Performance Targets

### Baseline Performance Goals

| Operation | Input Size | Target Time | Acceptable | Unacceptable |
|-----------|-----------|------------|-----------|-------------|
| Parse CSV | 1,000 records | < 3s | < 5s | > 10s |
| Parse CSV | 10,000 records | < 15s | < 20s | > 30s |
| Validation | 1,000 records | < 8s | < 12s | > 20s |
| Validation | 10,000 records | < 80s | < 100s | > 150s |
| Duplicate Check | 1,000 records | < 5s | < 10s | > 20s |
| Duplicate Check | 10,000 records | < 50s | < 100s | > 150s |
| Commit | 1,000 records | < 15s | < 20s | > 45s |
| Commit | 10,000 records | < 150s | < 180s | > 300s |
| Export | 1,000 records | < 3s | < 5s | > 15s |
| Export | 10,000 records | < 30s | < 45s | > 90s |

### Memory Usage Targets

| Operation | Records | Target Memory | Acceptable | Alert |
|-----------|---------|---|---|---|
| Parsing | 10,000 | < 150MB | < 200MB | > 300MB |
| Validation | 10,000 | < 200MB | < 250MB | > 400MB |
| Commit | 10,000 | < 250MB | < 300MB | > 500MB |

### Query Performance

**Database Query Indexes (required):**

```prisma
// ImportJob queries
@@index([playerId])
@@index([status])
@@index([createdAt])
@@index([userId])

// User existing models
// UserCard - add if missing
@@index([playerId])
@@index([playerId, masterCardId]) // For duplicate detection

// UserBenefit - add if missing
@@index([userCardId])
@@index([userCardId, name]) // For duplicate detection
```

**Query Optimization:**

```typescript
// ❌ SLOW: N+1 queries
for (const cardId of cardIds) {
  const card = await db.userCard.findUnique({ where: { id: cardId } });
  const benefits = await db.userBenefit.findMany({ where: { userCardId: cardId } });
}

// ✓ FAST: Batch query with eager loading
const cards = await db.userCard.findMany({
  where: { id: { in: cardIds } },
  include: { benefits: true } // Eager load
});

// Or use raw SQL for complex queries
const cards = await db.$queryRaw`
  SELECT uc.*, COUNT(ub.id) as benefit_count
  FROM UserCard uc
  LEFT JOIN UserBenefit ub ON ub.userCardId = uc.id
  WHERE uc.playerId = $1
  GROUP BY uc.id
`;
```

### Caching Strategy

```typescript
// Cache master card catalog (rarely changes)
const masterCardCache = new Map<string, MasterCard>();
let masterCardCacheExpiry = Date.now();

async function getMasterCardCatalog(forceRefresh = false): Promise<MasterCard[]> {
  const now = Date.now();
  const CACHE_TTL = 3600000; // 1 hour
  
  if (!forceRefresh && masterCardCacheExpiry > now && masterCardCache.size > 0) {
    return Array.from(masterCardCache.values());
  }
  
  // Refresh from database
  const cards = await db.masterCard.findMany({
    where: { isActive: true }
  });
  
  masterCardCache.clear();
  for (const card of cards) {
    masterCardCache.set(`${card.name}::${card.issuer}`, card);
  }
  
  masterCardCacheExpiry = now + CACHE_TTL;
  return cards;
}

// Preload cache on app startup
if (typeof window === 'undefined') { // Server-only
  getMasterCardCatalog().catch(console.error);
}
```

---

## Component Architecture

### React Component Hierarchy

```
<ImportExportDashboard>
  ├─ <ImportWizardModal>
  │  ├─ Step1Upload
  │  │  ├─ DropZone
  │  │  ├─ FileInfo
  │  │  └─ ValidationErrors
  │  ├─ Step2Parse
  │  │  ├─ ColumnMappingUI
  │  │  ├─ Preview
  │  │  └─ ConfidenceIndicators
  │  ├─ Step3Validate
  │  │  ├─ ValidationSummary
  │  │  ├─ ErrorList (with pagination)
  │  │  └─ WarningList
  │  ├─ Step4Duplicates
  │  │  ├─ DuplicateList
  │  │  ├─ RecordComparison
  │  │  └─ ActionSelector
  │  └─ Step5Preview
  │     ├─ ImportSummary
  │     ├─ ImpactCalculation
  │     └─ ConfirmButton
  │
  └─ <ExportModal>
     ├─ ScopeSelector
     │  ├─ CardSelect
     │  ├─ FilterBuilder
     │  └─ PreviewCount
     ├─ FormatSelector
     │  ├─ CSVOption
     │  ├─ XLSXOption
     │  └─ ColumnSelection
     └─ DownloadButton
```

### Service Layer Architecture

```typescript
// src/lib/import/
├─ parser.ts           // CSV/XLSX parsing
├─ validator.ts         // Validation rules engine
├─ duplicateDetector.ts // Duplicate detection logic
├─ committer.ts        // Transaction & database writes
└─ schema.ts           // Type definitions

// src/lib/export/
├─ collector.ts        // Data collection & filtering
├─ formatters.ts       // CSV & XLSX generation
└─ schema.ts           // Type definitions

// src/actions/
├─ import.ts           // Server actions for import
├─ export.ts           // Server actions for export
└─ schema.ts           // Validation schemas (Zod)

// src/components/
├─ ImportWizard/
│  ├─ index.tsx
│  ├─ Step1Upload.tsx
│  ├─ Step2Parse.tsx
│  ├─ Step3Validate.tsx
│  ├─ Step4Duplicates.tsx
│  ├─ Step5Preview.tsx
│  └─ hooks/
│     ├─ useImportWizard.ts     // State management
│     └─ useImportValidation.ts
│
└─ ExportModal/
   ├─ index.tsx
   ├─ ScopeSelector.tsx
   ├─ FormatSelector.tsx
   └─ hooks/
      └─ useExportOptions.ts
```

### State Management

**Use React Context + useReducer for import wizard:**

```typescript
// Create context
const ImportWizardContext = createContext<ImportWizardContextType>(null);

// Reducer for state transitions
function importWizardReducer(
  state: ImportWizardState,
  action: ImportWizardAction
): ImportWizardState {
  switch (action.type) {
    case 'FILE_UPLOADED':
      return { ...state, uploadedFile: action.file, currentStep: 2 };
    case 'PARSING_COMPLETE':
      return { ...state, columnMapping: action.mapping, currentStep: 3 };
    case 'VALIDATION_COMPLETE':
      return { ...state, validationResults: action.results, currentStep: 4 };
    // ... more cases ...
  }
}

// Use in component
const [state, dispatch] = useReducer(importWizardReducer, initialState);
```

---

## Implementation Checklist

### Phase 1: Foundation (Days 1-2) - Estimated 20-25 hours

**Database & Models**
- [ ] Create ImportJob Prisma model with all fields
- [ ] Create ImportRecord Prisma model with relationships
- [ ] Add importedFrom, importedAt fields to UserCard
- [ ] Add importedFrom, importedAt fields to UserBenefit
- [ ] Create UserImportProfile model
- [ ] Run migrations: `npx prisma migrate dev`
- [ ] Verify indexes created: Check schema for @@index decorators
- [ ] Test model relationships in test database

**File Parsing Library**
- [ ] Create `src/lib/import/parser.ts`
- [ ] Implement CSV parsing with PapaParse (with config for quotes, escaping)
- [ ] Implement XLSX parsing with xlsx library
- [ ] Add format auto-detection (extension + magic bytes)
- [ ] Handle edge cases: empty files, malformed CSV, encoding issues
- [ ] Add progress tracking for large files (streaming)
- [ ] Write unit tests (25+ test cases):
  - [ ] Valid CSV with various quote/escape patterns
  - [ ] Valid XLSX with multiple sheets
  - [ ] Malformed CSV (unterminated quotes, bad encoding)
  - [ ] Empty files, large files, special characters
  - [ ] File type validation (magic bytes)

**Validation Rules Engine**
- [ ] Create `src/lib/import/validator.ts`
- [ ] Implement CardName validation (must exist in MasterCard)
- [ ] Implement Issuer validation
- [ ] Implement AnnualFee validation (non-negative, max value)
- [ ] Implement RenewalDate validation (ISO 8601, future date)
- [ ] Implement CustomName validation (length, characters)
- [ ] Implement BenefitName validation (length, uniqueness per card)
- [ ] Implement BenefitType validation (enum)
- [ ] Implement StickerValue validation (numeric, positive)
- [ ] Implement DeclaredValue validation (≥ StickerValue)
- [ ] Implement ExpirationDate validation (optional, future)
- [ ] Implement Usage validation (enum: Claimed/Unused)
- [ ] Add error categorization (critical vs warning)
- [ ] Add helpful error messages with suggestions
- [ ] Write unit tests (40+ test cases):
  - [ ] Each field validation in isolation
  - [ ] Valid complete records
  - [ ] Invalid records with critical errors
  - [ ] Records with warnings
  - [ ] Business rule violations
  - [ ] Database lookups (MasterCard existence)

**Column Mapping Detection**
- [ ] Create fuzzy matching algorithm (synonyms)
- [ ] Implement confidence scoring (exact vs fuzzy)
- [ ] Store successful mappings in UserImportProfile
- [ ] Reuse profiles on subsequent imports
- [ ] Write unit tests (15+ cases):
  - [ ] Exact case-insensitive matching
  - [ ] Fuzzy matching with synonyms
  - [ ] Confidence scoring
  - [ ] Profile reuse detection

**API Endpoints (Foundation)**
- [ ] POST `/api/import/upload` - File upload endpoint
  - [ ] Validate file format + size (50MB limit)
  - [ ] Store file temporarily
  - [ ] Parse headers and auto-detect format
  - [ ] Create ImportJob record with status='Uploaded'
  - [ ] Return columnMappings to client
- [ ] POST `/api/import/{jobId}/parse` - Parse & preview
  - [ ] Load uploaded file
  - [ ] Extract rows with column mapping
  - [ ] Return preview (first 5 rows)
  - [ ] Return detected headers
- [ ] POST `/api/import/{jobId}/validate` - Validate records
  - [ ] Load all records
  - [ ] Validate each record
  - [ ] Categorize errors/warnings
  - [ ] Return validation summary with detailed record results
  - [ ] Update ImportJob.status = 'ValidatingComplete'

### Phase 2: Import Workflow (Days 3-4) - Estimated 25-30 hours

**Duplicate Detection**
- [ ] Create `src/lib/import/duplicateDetector.ts`
- [ ] Implement card duplicate detection (playerId + masterCardId)
- [ ] Implement benefit duplicate detection (userCardId + name)
- [ ] Detect duplicates within batch (same record appears twice)
- [ ] Compare existing vs new records
- [ ] Generate difference report
- [ ] Suggest resolution actions
- [ ] Write unit tests (30+ cases):
  - [ ] Card duplicates
  - [ ] Benefit duplicates
  - [ ] No duplicates
  - [ ] Duplicates within batch
  - [ ] Comparison accuracy

**Duplicate Detection API**
- [ ] POST `/api/import/{jobId}/duplicates` - Detect duplicates
  - [ ] Query database for existing cards/benefits
  - [ ] Match against import records
  - [ ] Return duplicate list with comparisons
- [ ] PATCH `/api/import/{jobId}/duplicates` - Apply resolutions
  - [ ] Store user's decisions (skip/update/merge)
  - [ ] Validate decisions
  - [ ] Update ImportRecord with decisions

**Import Committer (Transaction Logic)**
- [ ] Create `src/lib/import/committer.ts`
- [ ] Implement transaction wrapper
- [ ] Implement card creation logic
- [ ] Implement card update logic (renewal date, fee, custom name)
- [ ] Implement benefit creation logic
- [ ] Implement benefit cloning from MasterCard
- [ ] Implement benefit update logic
- [ ] Handle duplicate resolutions (skip/update/merge)
- [ ] Create ImportRecord entries for audit trail
- [ ] Implement rollback on error
- [ ] Handle constraint violations (P2002)
- [ ] Write unit tests (35+ cases):
  - [ ] Create new cards
  - [ ] Create new benefits
  - [ ] Update existing cards
  - [ ] Update existing benefits
  - [ ] Skip duplicates
  - [ ] Merge operations
  - [ ] Transaction rollback scenarios
  - [ ] Constraint violation handling

**Final Preview & Commit APIs**
- [ ] GET `/api/import/{jobId}/preview` - Get final preview
  - [ ] Calculate summary (create/update/skip counts)
  - [ ] Estimate impact on wallet (card count, ROI change)
  - [ ] Return preview of first 100 records
- [ ] POST `/api/import/{jobId}/commit` - Execute import
  - [ ] Verify wallet hasn't been modified (optimistic locking)
  - [ ] Execute committer transaction
  - [ ] Handle commit success/failure
  - [ ] Return detailed results

**Import Wizard UI Components**
- [ ] Create `src/components/ImportWizard/index.tsx` - Main container
- [ ] Create `Step1Upload.tsx` - File upload with drag-drop
  - [ ] Drag-drop zone implementation
  - [ ] File validation (format, size)
  - [ ] Upload progress indicator
  - [ ] Error display with remediation guidance
- [ ] Create `Step2Parse.tsx` - Column mapping UI
  - [ ] Show detected headers
  - [ ] Show auto-detected mappings with confidence
  - [ ] Allow manual mapping override
  - [ ] Show preview of first 5 rows
- [ ] Create `Step3Validate.tsx` - Validation results
  - [ ] Show summary (valid/warning/error counts)
  - [ ] Show error list with pagination
  - [ ] Show row/column references in errors
  - [ ] Color-code severity (error=red, warning=yellow)
- [ ] Create `Step4Duplicates.tsx` - Duplicate resolution
  - [ ] Show duplicate list
  - [ ] Show side-by-side comparison (existing vs new)
  - [ ] Allow action selection (skip/update/merge)
  - [ ] Show impact of each action
- [ ] Create `Step5Preview.tsx` - Final preview
  - [ ] Show summary of changes (create/update/skip)
  - [ ] Estimate wallet impact
  - [ ] Show "Confirm & Import" button
  - [ ] Disable back button after commit starts

**Wizard State Management**
- [ ] Create `useImportWizard.ts` hook
  - [ ] Step tracking
  - [ ] State persistence
  - [ ] Navigation (forward/backward)
  - [ ] Error handling
- [ ] Create TypeScript types for all state shapes
- [ ] Write integration tests (20+ cases):
  - [ ] Step progression
  - [ ] Back navigation
  - [ ] Data preservation across steps
  - [ ] Error recovery

**Server Actions for Import**
- [ ] Create `src/actions/import.ts`
- [ ] Implement `uploadImportFile` action
- [ ] Implement `validateImportFile` action
- [ ] Implement `checkDuplicates` action
- [ ] Implement `updateDuplicateResolutions` action
- [ ] Implement `getImportPreview` action
- [ ] Implement `commitImport` action
- [ ] Implement `cancelImport` action
- [ ] Add authorization checks (user owns player)
- [ ] Add error handling (convert to user-friendly messages)
- [ ] Create Zod schemas for input validation
- [ ] Write tests (20+ cases):
  - [ ] Happy path full workflow
  - [ ] Authorization failures
  - [ ] Input validation
  - [ ] Error handling

### Phase 3: Export Functionality (Days 5-6) - Estimated 20-25 hours

**Export Data Collection**
- [ ] Create `src/lib/export/collector.ts`
- [ ] Implement card data collection for scope
- [ ] Implement benefit data collection with card linking
- [ ] Implement filtering (date range, benefit type, status)
- [ ] Calculate ROI per card
- [ ] Calculate annual value
- [ ] Handle optional/null fields correctly
- [ ] Write tests (15+ cases):
  - [ ] Single card export
  - [ ] All cards export
  - [ ] Filtered exports
  - [ ] Empty exports (graceful)
  - [ ] Null field handling

**Export Format Generators**
- [ ] Create `src/lib/export/formatters.ts`
- [ ] Implement CSV formatter
  - [ ] Proper quoting and escaping
  - [ ] Formula injection prevention
  - [ ] Special character handling
  - [ ] Headers in standard order
- [ ] Implement XLSX formatter
  - [ ] Multi-sheet structure (Summary, Cards, Benefits)
  - [ ] Summary sheet with metadata
  - [ ] Auto-width columns
  - [ ] Optional: data validation (dropdowns)
- [ ] Round-trip validation (export + re-import = same state)
- [ ] Write tests (30+ cases):
  - [ ] CSV output validity
  - [ ] XLSX output validity
  - [ ] Round-trip consistency
  - [ ] Special characters
  - [ ] Formula injection escaping
  - [ ] Large exports

**Export APIs**
- [ ] GET `/api/export/options` - Get export configuration options
  - [ ] Show available formats
  - [ ] Show available scopes
  - [ ] Show record count for scope
  - [ ] Show column selection options
  - [ ] Estimate file size
- [ ] POST `/api/export/generate` - Generate & download file
  - [ ] Validate options
  - [ ] Collect data
  - [ ] Generate file
  - [ ] Stream download
  - [ ] Log export operation
- [ ] GET `/api/export/history` - Get past exports
  - [ ] List with pagination
  - [ ] Filter by scope
  - [ ] Show metadata (size, date, record count)

**Export UI Components**
- [ ] Create `src/components/ExportModal/index.tsx`
- [ ] Create `ScopeSelector.tsx`
  - [ ] Radio buttons (Card, Player, Filtered)
  - [ ] Card selection (if scope=Card)
  - [ ] Filter builder (if scope=Filtered)
  - [ ] Show estimated record count
- [ ] Create `FormatSelector.tsx`
  - [ ] Radio buttons (CSV, XLSX)
  - [ ] Format comparison
  - [ ] Options for each format (calculated values, audit trail, IDs)
- [ ] Create `ColumnSelection.tsx`
  - [ ] Checkbox list of columns
  - [ ] Mark required columns
  - [ ] Move columns up/down
  - [ ] Reset to defaults
- [ ] Create download button with progress

**Export Server Actions**
- [ ] Create `src/actions/export.ts`
- [ ] Implement `generateExport` action
- [ ] Implement `getExportHistory` action
- [ ] Add authorization checks
- [ ] Add rate limiting
- [ ] Write tests (15+ cases)

**Export History Tracking**
- [ ] Store exports in ImportJob table (exportType field)
- [ ] Create export history list component
- [ ] Implement cleanup of old exports (> 30 days)
- [ ] Add re-download functionality

### Phase 4: Polish & Testing (Days 7-8) - Estimated 20-25 hours

**End-to-End Testing (Playwright)**
- [ ] Write E2E test: Upload valid CSV, validate, preview, commit
- [ ] Write E2E test: Upload with duplicates, resolve, commit
- [ ] Write E2E test: Export single card, verify download
- [ ] Write E2E test: Export all cards as XLSX
- [ ] Write E2E test: Round-trip (import → export → import)
- [ ] Write E2E test: Error recovery (fix file, retry)
- [ ] Write E2E test: Large file (10K records)
- [ ] Write E2E test: Concurrent imports (should lock)
- [ ] Write E2E test: Authorization (other user's player)
- [ ] Target: 15+ passing E2E tests

**Performance Testing**
- [ ] Test parsing performance (1K, 10K, 50K records)
- [ ] Measure memory usage during operations
- [ ] Identify and optimize N+1 queries
- [ ] Add database indexes if needed
- [ ] Verify streaming works for large files
- [ ] Test pagination in preview UI
- [ ] Benchmark commit transaction time
- [ ] Document performance characteristics

**Security Testing**
- [ ] Test CSV injection prevention (formulas)
- [ ] Test file upload validation (size, format, type)
- [ ] Test authorization on all endpoints
- [ ] Test input validation on all fields
- [ ] Test rate limiting (10/hour imports)
- [ ] Test XSS prevention (special characters in names)
- [ ] Test SQL injection prevention (through Prisma)
- [ ] Check for hardcoded secrets in code

**Edge Case Testing**
- [ ] Test all 14 documented edge cases
- [ ] Test malformed CSV files
- [ ] Test past dates, negative fees
- [ ] Test special characters (quotes, commas, unicode)
- [ ] Test concurrent operations
- [ ] Test file cleanup (verify no orphans)
- [ ] Test rollback scenarios
- [ ] Test with various locales/timezones

**Error Handling & Recovery**
- [ ] Test network errors during upload
- [ ] Test retry logic for failed operations
- [ ] Test user cancellation at each step
- [ ] Test session timeout handling
- [ ] Test partial commit failure
- [ ] Test error message clarity

**Documentation**
- [ ] Write user guide for import workflow
- [ ] Write user guide for export workflow
- [ ] Create example CSV files (valid, edge cases)
- [ ] Create example XLSX files
- [ ] Document troubleshooting steps
- [ ] Document API endpoints (OpenAPI/Swagger)
- [ ] Write developer guide for extending import

**Quality Assurance**
- [ ] Code review with team lead
- [ ] Run linter: `npm run lint`
- [ ] Run type checking: `tsc --noEmit`
- [ ] Run all tests: `npm test`
- [ ] Verify test coverage >= 80%: `npm run test:coverage`
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test on mobile (responsive)
- [ ] Check accessibility (WCAG 2.1 AA) with axe
- [ ] Performance audit (Lighthouse)

---

## Acceptance Criteria Summary

### For Full-Stack Engineer

Your implementation is complete when:

#### Functionality ✓
- [ ] All 7 API endpoints implemented and documented
- [ ] 5-step import wizard fully functional with all transitions
- [ ] 3 export scopes working (card, player, filtered)
- [ ] CSV and XLSX formats both supported
- [ ] Round-trip import/export preserves data exactly
- [ ] Duplicate detection and resolution working
- [ ] Rollback on error working correctly
- [ ] Column mapping auto-detection working
- [ ] All state transitions tested

#### Data Quality ✓
- [ ] No data loss during import/export
- [ ] All fields properly typed and validated
- [ ] Null/optional fields handled correctly
- [ ] Audit trail (importedFrom, importedAt) captured
- [ ] Transaction atomicity verified (no partial states)

#### Performance ✓
- [ ] Parse 10,000 records in < 30 seconds
- [ ] Validate 10,000 records in < 30 seconds
- [ ] Commit 10,000 records in < 45 seconds
- [ ] Export 10,000 records in < 10 seconds
- [ ] Memory usage stays < 500MB for 50K records
- [ ] No N+1 queries detected

#### Security ✓
- [ ] All endpoints require authentication
- [ ] User ownership verified for all operations
- [ ] CSV injection prevented (formula escaping)
- [ ] All inputs validated before use
- [ ] Rate limiting enforced
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Audit log captures all operations

#### Testing ✓
- [ ] 130+ unit tests written (80%+ coverage)
- [ ] 30+ integration tests written
- [ ] 15+ E2E tests passing
- [ ] All edge cases tested and handled
- [ ] Error scenarios tested
- [ ] Performance benchmarks met

#### Documentation ✓
- [ ] User guide for import/export
- [ ] Example files provided
- [ ] API documentation complete
- [ ] Code comments on complex logic
- [ ] README with troubleshooting

---

## Version History & Notes

**Document Version:** 2.0 (Refined)
**Original Spec:** SPEC_PHASE4_IMPORT_EXPORT.md (1.0)
**Refinements Applied:**
- ✓ Clarified file size limits (50MB confirmed)
- ✓ Expanded data schema with field-by-field constraints
- ✓ Provided exact API signatures for all 7 endpoints
- ✓ Documented all 18 edge cases with handling strategies (14 detailed above + 4 in original)
- ✓ Created detailed implementation checklist with Phase breakdown
- ✓ Added performance targets and optimization strategies
- ✓ Enhanced security section with code examples
- ✓ Provided React component architecture
- ✓ Included state machine diagrams
- ✓ Created acceptance criteria checklist

**Next Steps for Engineer:**
1. Review this spec thoroughly (takes ~2 hours)
2. Set up database models (1-2 hours)
3. Implement Phase 1 foundation (20-25 hours)
4. Implement Phase 2 workflow (25-30 hours)
5. Implement Phase 3 export (20-25 hours)
6. Polish & test Phase 4 (20-25 hours)
7. **Total estimated effort: 85-110 hours** (2-3 weeks for one engineer, 1 week with pair programming)

---

**This specification is production-ready and sufficient for a full-stack engineer to implement without further clarification.**
