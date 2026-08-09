# Custom Values Feature - QA Remediation Guide

**Status:** Action Required  
**Priority:** 🔴 CRITICAL  
**Target:** Address blocking issues before feature deployment

---

## Quick Reference: Issues by Priority & Time to Fix

### CRITICAL (Must Fix - 13-21 days total)

| Issue | Time | Complexity | Files |
|-------|------|-----------|-------|
| Fix 5 validation test failures | 1h | Low | validation.test.ts |
| Fix JSX parsing errors | 1-2h | Medium | 4 test files |
| Implement EditableValueField component | 3-4h | High | EditableValueField.tsx |
| Add valueHistory schema field | 30m | Low | schema.prisma, migration |
| Implement value history tracking | 1-2h | Medium | custom-values.ts |
| Complete ROI calculations | 1-2h | Medium | custom-values.ts |
| **Subtotal** | **~13h** | | |

### HIGH (Should Fix)

| Issue | Time | Complexity | Files |
|-------|------|-----------|-------|
| Add optimistic locking | 1-2h | Medium | custom-values.ts |
| Implement timeout handling | 1-2h | Medium | EditableValueField.tsx |
| Implement BenefitValueComparison | 2-3h | Medium | BenefitValueComparison.tsx |
| Implement BenefitValuePresets | 2h | Low | BenefitValuePresets.tsx |
| Implement ValueHistoryPopover | 2h | Low | ValueHistoryPopover.tsx |
| Implement BulkValueEditor | 3h | High | BulkValueEditor.tsx |
| **Subtotal** | **~13h** | | |

### Testing & Polish

| Activity | Time |
|----------|------|
| Write integration tests | 4-6h |
| Edge case test coverage | 3-4h |
| Performance profiling | 2h |
| Accessibility testing | 2-3h |
| Mobile testing | 2-3h |
| **Subtotal** | **~13-19h** |

**Total Effort:** 39-53 hours (~1-2 weeks)

---

## CRITICAL FIX #1: Validation Test Failures (1 hour)

### Bug 1: parseCurrencyInput - Double decimal point

**File:** `src/lib/custom-values/validation.ts`, lines 107-146  
**Test:** `validation.test.ts`, line 125

**Current Code:**
```typescript
export function parseCurrencyInput(input: string): number | null {
  let cleaned = input.trim().replace(/[$€£¥₹\s]/g, '');
  if (!cleaned) return null;
  
  const parsed = parseFloat(cleaned);  // parseFloat('25.05.00') = 25.05
  
  if (isNaN(parsed)) return null;
  
  // Problem: No validation of decimal format!
  let cents: number;
  if (parsed >= 1000) {
    cents = Math.round(parsed);
  } else {
    cents = Math.round(parsed * 100);
  }
  
  try {
    validateBenefitValue(cents);
    return cents;  // Returns 2505 for '25.05.00' ❌
  } catch {
    return null;
  }
}
```

**Fix:**
```typescript
export function parseCurrencyInput(input: string): number | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Remove currency symbols and whitespace
  let cleaned = input.trim().replace(/[$€£¥₹\s]/g, '');

  if (!cleaned) {
    return null;
  }

  // ADDITION: Validate decimal format (only 1 decimal point, max 2 places)
  // Valid: "250", "250.00", "250.5"
  // Invalid: "25.05.00", "250.000"
  const decimalRegex = /^\d+(\.\d{1,2})?$/;
  if (!decimalRegex.test(cleaned)) {
    return null;  // ← FIX: Reject invalid formats
  }

  // Try to parse as number
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return null;
  }

  // Decide if input is already in cents (large number) or dollars
  let cents: number;
  if (parsed >= 1000) {
    cents = Math.round(parsed);
  } else {
    cents = Math.round(parsed * 100);
  }

  // Validate the result
  try {
    validateBenefitValue(cents);
    return cents;
  } catch {
    return null;
  }
}
```

**Tests to Verify:**
```typescript
expect(parseCurrencyInput('25.05.00')).toBeNull();  // Now passes ✅
expect(parseCurrencyInput('250.99')).toBe(25099);   // Still works ✅
expect(parseCurrencyInput('250.999')).toBeNull();   // Rejects 3 decimals ✅
```

---

### Bug 2: parseCurrencyInput - Maximum value not checked

**File:** `src/lib/custom-values/validation.ts`, lines 107-146  
**Test:** `validation.test.ts`, line 137

**Current Code:**
```typescript
export function parseCurrencyInput(input: string): number | null {
  // ... parsing logic ...
  
  let cents: number;
  if (parsed >= 1000) {
    cents = Math.round(parsed);  // '10000000' becomes 10000000 cents
  } else {
    cents = Math.round(parsed * 100);
  }
  
  try {
    validateBenefitValue(cents);  // Should reject 10000000 > MAX_BENEFIT_VALUE_CENTS
    return cents;  // But validateBenefitValue fails silently ❌
  } catch {
    return null;
  }
}
```

**The Problem:** Look at this line carefully:
```typescript
try {
  validateBenefitValue(cents);
  return cents;  // Returns here if no exception
} catch {
  return null;   // Returns here if exception thrown
}
```

If `validateBenefitValue()` throws, we return `null`. But the test shows we're returning `10000000`, which means `validateBenefitValue()` is NOT throwing.

**Check validateBenefitValue:**
```typescript
export function validateBenefitValue(valueInCents: any, fieldName: string = 'valueInCents'): void {
  // ... other checks ...
  if (valueInCents > MAX_BENEFIT_VALUE_CENTS) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Value cannot exceed $${(MAX_BENEFIT_VALUE_CENTS / 100).toFixed(2)}`,
      received: valueInCents,
      max: MAX_BENEFIT_VALUE_CENTS,
    });
  }
}
```

This SHOULD throw. Let me trace through the test case:
- Input: `'10000000'`
- After cleaning: `'10000000'`
- parseFloat: `10000000`
- Check `parsed >= 1000`: TRUE
- cents = `Math.round(10000000)` = `10000000`
- MAX_BENEFIT_VALUE_CENTS = `999999999`
- Check `10000000 > 999999999`: FALSE ✅ (it doesn't exceed!)

**Ah!** The issue is that `10000000` cents = $100,000, which is LESS than the max of $9,999,999.99.

The **real problem** is the test expectation is wrong! But checking the test comment:
```typescript
it('should return null if exceeds maximum', () => {
  expect(parseCurrencyInput('10000000')).toBeNull(); // 10M+ cents
});
```

The comment says "10M+ cents" meaning 10 million cents = $100,000 should be valid.

Actually wait—rereading: The test might be asking about `'10000000'` dollars (ten million dollars), which WOULD exceed the max.

The **parsing heuristic is wrong**! We can't tell if `'10000000'` means:
- 10,000,000 cents ($100,000) ← Valid
- 10,000,000 dollars ($10 billion) ← Invalid

**Better Fix:** Require explicit format or use different heuristic:
```typescript
export function parseCurrencyInput(input: string): number | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let cleaned = input.trim().replace(/[$€£¥₹\s]/g, '');

  if (!cleaned) {
    return null;
  }

  // Validate decimal format
  const decimalRegex = /^\d+(\.\d{1,2})?$/;
  if (!decimalRegex.test(cleaned)) {
    return null;
  }

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return null;
  }

  // IMPROVED HEURISTIC:
  // If decimal point present and ≤ 2 decimals: treat as dollars
  // If no decimal point and ≥ 1000: could be either, assume dollars
  // Problem: '10000000' with no decimals is ambiguous
  
  // BEST FIX: Always assume dollars, require cents to be spelled out
  // So: '250' = $250 = 25000 cents
  //     '25000' = $25,000 = 2500000 cents
  
  let cents: number;
  
  // If has decimal point: definitely dollars
  // If >= 1000 without decimal: probably dollars (e.g., '$5000' for $5k)
  // If < 1000: probably dollars
  
  // Just treat everything as dollars and convert
  cents = Math.round(parsed * 100);
  
  // Now validate
  try {
    validateBenefitValue(cents);
    return cents;
  } catch {
    return null;
  }
}
```

**After this fix:**
```typescript
parseCurrencyInput('10000000') 
  = Math.round(10000000 * 100) 
  = 1000000000 cents 
  = $10,000,000 
  > MAX_BENEFIT_VALUE_CENTS
  → throws → returns null ✅
```

---

### Bug 3: isSignificantlyDifferent - Boundary condition

**File:** `src/lib/custom-values/validation.ts`, line 210  
**Test:** `validation.test.ts`, line 205

**Current Code:**
```typescript
export function isSignificantlyDifferent(customValue: number, stickerValue: number): boolean {
  if (stickerValue === 0) {
    return customValue !== 0;
  }

  const diff = calculateDifference(customValue, stickerValue);
  return Math.abs(diff.percent) > SIGNIFICANT_DIFFERENCE_THRESHOLD;  // > not >=
}

// SIGNIFICANT_DIFFERENCE_THRESHOLD = 0.10 (10%)
```

**Problem:**
```typescript
isSignificantlyDifferent(33000, 30000)
// diff.percent = (33000 - 30000) / 30000 = 3000 / 30000 = 0.10
// Check: 0.10 > 0.10 = FALSE ❌
// But test expects TRUE
```

**The Test is Right.** If difference is exactly 10%, it should be considered "significant" (visual highlighting).

**Fix: Change > to >=**
```typescript
export function isSignificantlyDifferent(customValue: number, stickerValue: number): boolean {
  if (stickerValue === 0) {
    return customValue !== 0;
  }

  const diff = calculateDifference(customValue, stickerValue);
  return Math.abs(diff.percent) >= SIGNIFICANT_DIFFERENCE_THRESHOLD;  // Changed > to >=
}
```

**After Fix:**
```typescript
isSignificantlyDifferent(27000, 30000)  // -10% exactly
// diff.percent = -0.10
// Check: |-0.10| >= 0.10 = TRUE ✅

isSignificantlyDifferent(33000, 30000)  // +10% exactly  
// diff.percent = 0.10
// Check: |0.10| >= 0.10 = TRUE ✅

isSignificantlyDifferent(29000, 30000)  // -3.33%
// diff.percent = -0.0333
// Check: |-0.0333| >= 0.10 = FALSE ✅
```

---

### Bug 4: isUnusuallyHigh - Zero sticker value

**File:** `src/lib/custom-values/validation.ts`, lines 238-244  
**Test:** `validation.test.ts`, line 243

**Current Code:**
```typescript
export function isUnusuallyHigh(customValue: number, stickerValue: number): boolean {
  if (stickerValue === 0) {
    return true;  // Always returns TRUE ❌
  }

  const percentOfSticker = customValue / stickerValue;
  return percentOfSticker > HIGH_VALUE_THRESHOLD_PERCENT;
}
```

**Problem:**
```typescript
isUnusuallyHigh(0, 0)   // custom=$0, sticker=$0
// sticker === 0, so return true
// But logically: Setting $0 when sticker is $0 is NOT unusual ❌

isUnusuallyHigh(100, 0)  // custom=$1, sticker=$0
// sticker === 0, so return true
// Logically: Setting $1 when sticker is $0 IS unusual ✅
```

**Fix:**
```typescript
export function isUnusuallyHigh(customValue: number, stickerValue: number): boolean {
  if (stickerValue === 0) {
    // If sticker is $0, only flag if user added a custom value
    return customValue > 0;  // ← Changed from 'true'
  }

  const percentOfSticker = customValue / stickerValue;
  return percentOfSticker > HIGH_VALUE_THRESHOLD_PERCENT;
}
```

**After Fix:**
```typescript
isUnusuallyHigh(0, 0)     // → FALSE ✅
isUnusuallyHigh(100, 0)   // → TRUE ✅
isUnusuallyHigh(50, 0)    // → TRUE ✅
isUnusuallyHigh(25000, 30000)  // 83% → FALSE ✅
isUnusuallyHigh(50000, 30000)  // 167% > 150% → TRUE ✅
```

---

### Bug 5: validateBenefitId - Overly strict format

**File:** `src/lib/custom-values/validation.ts`, lines 290-307  
**Test:** `validation.test.ts`, line 274

**Current Code:**
```typescript
export function validateBenefitId(benefitId: any): void {
  if (!benefitId || typeof benefitId !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Benefit ID is required and must be a string',
    });
  }

  // CUID format validation (used by Prisma's default ID generator)
  // Slightly relaxed regex for CUID acceptance
  const cuidRegex = /^[a-z0-9]+$/i;
  if (!cuidRegex.test(benefitId) || benefitId.length < 16) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Invalid benefit ID format',
      received: benefitId,
    });
  }
}
```

**Problem:**
```typescript
validateBenefitId('abc123def456')  // 12 characters
// regex passes: /^[a-z0-9]+$/i matches
// length check: 12 < 16 → TRUE → throw ❌

validateBenefitId('clv1a2b3c4d5e6f7g8h9i0j1k')  // 24 characters (real CUID)
// regex passes
// length check: 24 < 16 → FALSE → OK ✅
```

**The comment says "slightly relaxed" but then enforces 16+ character minimum.** This is inconsistent.

**Options:**

**Option A:** Remove length check (trust that IDs are valid CUIDs from Prisma):
```typescript
export function validateBenefitId(benefitId: any): void {
  if (!benefitId || typeof benefitId !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Benefit ID is required and must be a string',
    });
  }

  // Allow alphanumeric IDs of any reasonable length
  // Prisma ensures format on database level
  const idRegex = /^[a-z0-9]+$/i;
  if (!idRegex.test(benefitId)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Invalid benefit ID format',
      received: benefitId,
    });
  }
  
  // Optional: set reasonable min/max
  if (benefitId.length < 3 || benefitId.length > 128) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Benefit ID must be between 3 and 128 characters',
      received: benefitId,
    });
  }
}
```

**Option B:** Use proper UUID/CUID validation:
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cuidRegex = /^c[a-z0-9]{24}$/;
if (!uuidRegex.test(benefitId) && !cuidRegex.test(benefitId)) {
  throw new AppError(...);
}
```

**Recommended:** Option A (simplest, most permissive)

**After Fix:**
```typescript
validateBenefitId('abc123def456')  // → No throw ✅
validateBenefitId('clv1a2b3c4d5e6f7g8h9i0j1k')  // → No throw ✅
validateBenefitId('invalid-id!')  // → Throws (has invalid chars) ✅
```

---

## CRITICAL FIX #2: JSX Test Parsing Errors (1-2 hours)

### Files with JSX Syntax Errors

1. `src/__tests__/components/custom-values/EditableValueField.test.tsx` - Line 407
2. `src/__tests__/components/custom-values/ValueHistoryPopover.test.tsx` - Line 56
3. `src/__tests__/components/custom-values/BenefitValueComparison.test.tsx`
4. `src/__tests__/components/custom-values/BulkValueEditor.test.tsx`

### Diagnostic Steps

```bash
# Run tests to see detailed error
npm run test -- EditableValueField.test.tsx --no-coverage

# The error message will show:
# File: EditableValueField.test.tsx:407:7
# "<Component {...props} />" 
# Unexpected JSX expression
```

### Common JSX Issues

**Issue 1: Unbalanced JSX tags**
```typescript
// ❌ Missing closing tag
const element = (
  <div>
    <Component />
  // Missing </div>
);

// ✅ Fixed
const element = (
  <div>
    <Component />
  </div>
);
```

**Issue 2: Invalid attribute syntax**
```typescript
// ❌ Spreading non-object
render(<Component {...'string'} />);

// ✅ Fixed
render(<Component {...props} />);
```

**Issue 3: Invalid expression in JSX**
```typescript
// ❌ Expression without braces
<div className=classes.button</div>

// ✅ Fixed
<div className={classes.button}</div>
```

### Fix Process

1. **Open each test file and check syntax carefully**
2. **Look at line 56 in ValueHistoryPopover.test.tsx** (error shown)
3. **Look at line 407 in EditableValueField.test.tsx** (error shown)
4. **Check for unclosed tags, invalid attributes, missing braces**
5. **Verify vitest.config.ts has proper JSX handling:**

```typescript
// vitest.config.ts should have:
export default defineConfig({
  test: {
    environment: 'jsdom',  // Not 'node'
    globals: true,
  },
});
```

6. **Check tsconfig.json:**
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",  // For React 17+
    // OR
    "jsx": "react",      // For React 16
  }
}
```

7. **Run type check:**
```bash
npm run type-check
```

8. **Verify test syntax by reviewing the actual line numbers in error**

### If Still Failing

The error might be in Rolldown's JSX parser. Try:
```bash
# Clear cache
rm -rf node_modules/.vite
npm run test -- --no-coverage

# Or update vitest
npm install -D vitest@latest
```

---

## CRITICAL FIX #3: Add valueHistory Schema Field (30 minutes)

### Step 1: Update Prisma Schema

**File:** `prisma/schema.prisma`

Find the `UserBenefit` model and add:
```prisma
model UserBenefit {
  id                  String    @id @default(cuid())
  userCardId          String
  masterBenefitId     String
  
  // ... existing fields ...
  
  userDeclaredValue   Int?      // User's custom value override (in cents)
  stickerValue        Int       // Master/default value (in cents)
  
  // ADD THIS FIELD:
  valueHistory        Json?     // Array of BenefitValueChange entries (append-only)
  
  updatedAt           DateTime  @updatedAt
  createdAt           DateTime  @default(now())
  
  // ... rest of model ...
}
```

### Step 2: Create Migration

```bash
cd /Users/manishslal/Desktop/Coding-Projects/Card-Benefits

# Create migration
npx prisma migrate dev --name add_value_history_to_user_benefit

# When prompted, name it: "add_value_history_to_user_benefit"
```

### Step 3: Verify Schema

```bash
# Type-check schema
npx prisma validate

# Generate Prisma client
npx prisma generate
```

### Step 4: Update TypeScript Types

The Prisma client will automatically update to include the new field.

---

## CRITICAL FIX #4: Implement Value History Tracking (1-2 hours)

### Step 1: Un-comment Helper Functions

**File:** `src/actions/custom-values.ts`, lines 42-100

Un-comment these functions:
```typescript
/**
 * Appends a new entry to the valueHistory JSON array.
 * History is immutable and append-only for audit trail compliance.
 */
function appendToValueHistory(
  currentHistory: string | null,
  change: BenefitValueChange
): string {
  let history: BenefitValueChange[] = [];

  // Parse existing history if present
  if (currentHistory) {
    try {
      history = JSON.parse(currentHistory);
      if (!Array.isArray(history)) {
        history = [];
      }
    } catch (e) {
      // If JSON is malformed, start fresh
      history = [];
    }
  }

  // Append new entry
  history.push({
    ...change,
    changedAt: change.changedAt instanceof Date 
      ? change.changedAt.toISOString()
      : change.changedAt,
  });

  return JSON.stringify(history);
}

/**
 * Parses value history from JSON string.
 * Returns empty array if history is null or malformed.
 */
function parseValueHistory(historyJson: string | null): BenefitValueChange[] {
  if (!historyJson) {
    return [];
  }

  try {
    const history = JSON.parse(historyJson);
    return Array.isArray(history) ? history : [];
  } catch (e) {
    return [];
  }
}
```

### Step 2: Update updateUserDeclaredValue() Action

**File:** `src/actions/custom-values.ts`, lines 175-272

Replace lines 220-227 with:
```typescript
    // ── Prepare change record ───────────────────────────────────────────────
    const now = new Date();
    const valueBefore = benefit.userDeclaredValue ?? benefit.stickerValue;
    const changeAmount = valueInCents - valueBefore;
    const changePercent =
      valueBefore === 0 ? 0 : (changeAmount / valueBefore) * 100;

    // ── Create history entry ────────────────────────────────────────────────
    const newHistoryEntry: BenefitValueChange = {
      value: valueInCents,
      changedAt: now.toISOString(),
      changedBy: userId,
      source: 'manual',
      reason: changeReason,
    };
    
    // ── Update benefit with new value and history ─────────────────────────
    const updatedHistory = appendToValueHistory(benefit.valueHistory, newHistoryEntry);
    
    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        userDeclaredValue: valueInCents,
        valueHistory: updatedHistory,  // ← ADD THIS
        updatedAt: now,
      },
    });
```

### Step 3: Update clearUserDeclaredValue() Action

**File:** `src/actions/custom-values.ts`, lines 285-387

Replace lines 330-348 with:
```typescript
    // ── Record change in history ────────────────────────────────────────────
    const now = new Date();
    const newHistoryEntry: BenefitValueChange = {
      value: benefit.stickerValue,  // Reverting to sticker value
      changedAt: now.toISOString(),
      changedBy: 'system',
      source: 'system',
      reason: 'Reset to master value',
    };
    const updatedHistory = appendToValueHistory(benefit.valueHistory, newHistoryEntry);

    // ── Clear the value ─────────────────────────────────────────────────────
    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        userDeclaredValue: null,
        valueHistory: updatedHistory,  // ← ADD THIS
        updatedAt: now,
      },
    });
```

### Step 4: Implement getBenefitValueHistory() Properly

**File:** `src/actions/custom-values.ts`, lines 566-630

Replace the implementation with:
```typescript
export async function getBenefitValueHistory(
  benefitId: string,
  limit: number = 10,
): Promise<ActionResponse<GetBenefitValueHistoryResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateBenefitId(benefitId);

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'limit',
        reason: 'Limit must be between 1 and 100',
        received: limit,
      });
    }

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Authorization ────────────────────────────────────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Fetch benefit ────────────────────────────────────────────────────
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
    });

    if (!benefit) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Parse and return history ─────────────────────────────────────────
    const fullHistory = parseValueHistory(benefit.valueHistory);
    // Return last N entries (newest first)
    const history = fullHistory.slice(-limit).reverse();

    return createSuccessResponse({
      benefitId,
      current: {
        value: benefit.userDeclaredValue,
        type: benefit.userDeclaredValue ? 'custom' : 'sticker',
        changedAt: benefit.updatedAt,
      },
      history,  // ← Now has actual history
      totalChanges: fullHistory.length,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    console.error('[getBenefitValueHistory] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
```

### Step 5: Implement revertUserDeclaredValue() Properly

**File:** `src/actions/custom-values.ts`, lines 644-699

Replace with:
```typescript
export async function revertUserDeclaredValue(
  benefitId: string,
  historyIndex: number,
): Promise<ActionResponse<RevertUserDeclaredValueResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateBenefitId(benefitId);

    if (typeof historyIndex !== 'number' || !Number.isInteger(historyIndex) || historyIndex < 0) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'historyIndex',
        reason: 'Must be a non-negative integer',
        received: historyIndex,
      });
    }

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Authorization ────────────────────────────────────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Fetch benefit with history ───────────────────────────────────────────
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
    });

    if (!benefit) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Get history and find target entry ───────────────────────────────────
    const history = parseValueHistory(benefit.valueHistory);
    
    if (historyIndex >= history.length) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'historyIndex',
        reason: 'History index out of range',
        received: historyIndex,
        max: history.length - 1,
      });
    }

    const targetEntry = history[historyIndex];
    const valueToRestore = targetEntry.value;

    // ── Record the revert as a new history entry ────────────────────────
    const now = new Date();
    const revertEntry: BenefitValueChange = {
      value: valueToRestore,
      changedAt: now.toISOString(),
      changedBy: userId,
      source: 'manual',
      reason: `Reverted to previous value ($${(valueToRestore / 100).toFixed(2)})`,
    };
    
    const updatedHistory = appendToValueHistory(benefit.valueHistory, revertEntry);

    // ── Update benefit ───────────────────────────────────────────────────────
    const now2 = new Date();
    const valueBefore = benefit.userDeclaredValue ?? benefit.stickerValue;
    const changeAmount = valueToRestore - valueBefore;
    const changePercent =
      valueBefore === 0 ? 0 : (changeAmount / valueBefore) * 100;

    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        userDeclaredValue: valueToRestore,
        valueHistory: updatedHistory,
        updatedAt: now2,
      },
    });

    // ── Calculate updated ROI values ────────────────────────────────────────
    let rois;
    try {
      rois = await calculateROIValues(updatedBenefit);
    } catch (calcError) {
      console.error('[revertUserDeclaredValue] ROI calculation failed:', calcError);
      rois = { benefit: 0, card: 0, player: 0, household: 0 };
    }

    return createSuccessResponse({
      benefit: updatedBenefit,
      rois,
      affectedCards: [benefit.userCardId],
      valueBefore,
      valueAfter: valueToRestore,
      changeAmount,
      changePercent: parseFloat(changePercent.toFixed(2)),
      changedAt: now2,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    console.error('[revertUserDeclaredValue] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
```

---

## CRITICAL FIX #5: Complete ROI Calculations (1-2 hours)

### Issue

The `calculateROIValues()` function returns simplified ROI for player and household levels.

**File:** `src/actions/custom-values.ts`, lines 112-156

### Fix: Call proper ROI calculator functions

Replace lines 147-148:
```typescript
    // Placeholder for player and household ROI (full implementation in Phase 2)
    const playerROI = cardROI; // Simplified for Phase 1
    const householdROI = cardROI; // Simplified for Phase 1
```

With:
```typescript
    // ── Calculate player ROI ────────────────────────────────────────────
    // Import at top: import { calculatePlayerROI, calculateHouseholdROI } from '@/lib/custom-values/roi-calculator';
    const cardData = card;  // Already fetched above
    const player = await prisma.player.findUnique({
      where: { id: cardData.playerId },
    });
    
    let playerROI = 0;
    if (player) {
      try {
        playerROI = await calculatePlayerROI(player.id);
      } catch (err) {
        console.warn('[calculateROIValues] Player ROI calculation failed:', err);
      }
    }

    // ── Calculate household ROI ─────────────────────────────────────────
    let householdROI = 0;
    if (player) {
      try {
        householdROI = await calculateHouseholdROI(player.userId);
      } catch (err) {
        console.warn('[calculateROIValues] Household ROI calculation failed:', err);
      }
    }
```

### Also Import at Top

```typescript
import {
  calculatePlayerROI,
  calculateHouseholdROI,
  invalidateROICache,
} from '@/lib/custom-values/roi-calculator';
```

### Add Cache Invalidation

After successful update, add:
```typescript
    // ── Invalidate ROI cache ────────────────────────────────────────────
    if (player) {
      invalidateROICache([
        `CARD:${benefit.userCardId}`,
        `PLAYER:${player.id}`,
        `HOUSEHOLD:${player.userId}`,
      ]);
    }
```

---

## Testing After Fixes

```bash
# Run validation tests only
npm run test -- validation.test.ts

# Should see: 5 tests now pass (previously 5 failed)

# Run component tests
npm run test -- EditableValueField.test.tsx --no-coverage

# Should now parse without errors

# Run all custom-values tests
npm run test -- custom-values --coverage

# Should see: All tests passing, coverage > 80% per file
```

---

## Checklist

- [ ] Fix 5 validation test bugs
- [ ] Fix JSX parsing errors in 4 test files
- [ ] Add `valueHistory` field to UserBenefit schema
- [ ] Create and run migration
- [ ] Un-comment history helper functions
- [ ] Update `updateUserDeclaredValue()` to track history
- [ ] Update `clearUserDeclaredValue()` to track history
- [ ] Implement `getBenefitValueHistory()` properly
- [ ] Implement `revertUserDeclaredValue()` properly
- [ ] Complete ROI calculations (player/household)
- [ ] Add cache invalidation
- [ ] All tests passing
- [ ] Coverage > 80% per file
- [ ] Run type check: `npm run type-check`
- [ ] Manual smoke test: Edit a benefit, verify history appears

---

## Next Steps

After these critical fixes:

1. **Implement EditableValueField component** (3-4h) - Core editing UI
2. **Implement remaining components** (7-8h) - Full feature
3. **Add integration tests** (4-6h) - End-to-end validation
4. **Performance testing** (2h) - Ensure targets met
5. **Accessibility testing** (2-3h) - WCAG 2.1 AA
6. **Mobile testing** (2-3h) - iOS/Android validation

See main QA report for full implementation guidance.
