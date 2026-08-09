# Admin Benefit Editing — Cadence Fields Enhancement

## Technical Specification

**Status**: Draft  
**Author**: Product Architect  
**Date**: 2025-07-18  
**Relates to**: Phase 6C Claiming Cadence, Benefit Engine  

---

## Executive Summary & Goals

The Admin Dashboard's EditBenefitModal currently supports editing only `name`, `type`, `stickerValue`, and `resetCadence`. The benefit engine introduced in Phase 6C depends on three additional columns — `claimingCadence`, `claimingAmount`, and `variableAmounts` — that can only be set via seed scripts or direct SQL today. This spec adds full CRUD support for those fields plus an `isActive` toggle, eliminating the need for code deploys to adjust benefit configuration.

### Primary Objectives

1. Enable admins to set and modify `claimingCadence`, `claimingAmount`, and `variableAmounts` through the UI
2. Add an `isActive` toggle so benefits can be deactivated without deletion
3. Extend the Zod validation schema to cover the new fields server-side
4. Surface cadence data in the benefit list view with missing-data warnings
5. Ensure all changes are captured in the existing audit log

### Success Criteria

- An admin can open EditBenefitModal, change any cadence field, save, and see the updated value reflected immediately
- The API rejects invalid cadence values, negative amounts, and malformed variableAmounts
- Benefits with NULL claimingCadence show a visible warning indicator in the list view
- All field changes (old → new) appear in the AdminAuditLog

---

## Functional Requirements

### FR-1: Claiming Cadence Dropdown

Add a `claimingCadence` select field to EditBenefitModal.

| Attribute | Detail |
|-----------|--------|
| **Field name** | `claimingCadence` |
| **Type** | `<select>` dropdown |
| **Options** | `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`, `FLEXIBLE_ANNUAL`, `ONE_TIME`, plus an empty "Not set" option |
| **Default** | Current database value (may be `null`) |
| **Required** | No — nullable in schema |
| **Helper text** | "How often this benefit can be claimed. Leave blank to inherit from resetCadence." |

**Behavior on change**: When the admin selects a new cadence, auto-calculate a suggested `claimingAmount` using the formula:

```
suggestedAmount = stickerValue ÷ periodsPerYear(cadence)
```

Where `periodsPerYear`:
| Cadence | Periods |
|---------|---------|
| MONTHLY | 12 |
| QUARTERLY | 4 |
| SEMI_ANNUAL | 2 |
| FLEXIBLE_ANNUAL | 1 |
| ONE_TIME | 1 |

Display this as a non-blocking suggestion below the claimingAmount field, e.g.:  
> "Suggested: $15.00/month based on $180.00 annual sticker value"

The admin is free to ignore the suggestion.

### FR-2: Claiming Amount Input

Add a `claimingAmount` dollar input to EditBenefitModal.

| Attribute | Detail |
|-----------|--------|
| **Field name** | `claimingAmount` |
| **Type** | Text input with dollar formatting |
| **Storage** | Integer in cents (same convention as `stickerValue`) |
| **Display** | Dollar amount via `formatCurrency(value, false)` → e.g., "15.00" |
| **Conversion** | Use existing `parseCurrency()` on submit to convert dollars → cents |
| **Required** | No — nullable in schema |
| **Validation** | Non-negative integer after conversion. Max 99999999 cents ($999,999.99) |
| **Helper text** | "Per-period amount in dollars. E.g., $15/month for Uber Cash." |

### FR-3: Variable Amounts Editor

Add a `variableAmounts` structured editor to EditBenefitModal.

**Data shape**: `Record<string, number>` where keys are month numbers `"1"` through `"12"` and values are amounts in cents.

Example: `{ "12": 3500 }` means December override = $35.00.

**UI approach** — "Add Override" pattern (preferred over 12 static fields):

1. Display a "Month Overrides" section header with helper text:  
   > "Override the default per-period amount for specific months (e.g., December Uber bonus)."
2. Below, render a list of existing overrides as editable rows:  
   `[Month dropdown: December] [$35.00 input] [Remove ✕ button]`
3. An "+ Add Override" button appends a new empty row
4. Month dropdown options: January (1) through December (12); already-used months are disabled in the dropdown to prevent duplicates
5. Amount input uses same dollar-to-cents conversion as claimingAmount
6. On submit, assemble the rows into a JSON object: `{ "12": 3500 }`
7. If all overrides are removed, send `variableAmounts: null` to clear the column

**Validation**:
- Month keys must be integers 1–12 (as strings)
- Values must be non-negative integers (cents)
- No duplicate month keys
- Maximum 12 entries

### FR-4: isActive Toggle

Add an `isActive` toggle switch to EditBenefitModal.

| Attribute | Detail |
|-----------|--------|
| **Field name** | `isActive` |
| **Type** | Toggle switch (checkbox styled as toggle) |
| **Default** | Current database value (defaults `true` for new benefits) |
| **Label** | "Active" with sub-label: "Inactive benefits are hidden from users but preserved in the database." |
| **Position** | After all other fields, before action buttons; visually separated with a divider |

### FR-5: API Validation Schema Update

Extend `UpdateBenefitSchema` in `src/features/admin/validation/schemas.ts`.

**New Zod schema fields**:

```typescript
// New enum for claiming cadence values
export const ClaimingCadenceEnum = z.enum([
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'FLEXIBLE_ANNUAL',
  'ONE_TIME',
]);

// Updated UpdateBenefitSchema
export const UpdateBenefitSchema = z.object({
  // ... existing fields unchanged ...
  name: z.string().min(1).max(200).optional(),
  type: BenefitTypeEnum.optional(),
  stickerValue: z.number().int().min(0).optional(),
  resetCadence: ResetCadenceEnum.optional(),
  isDefault: z.boolean().optional(),
  description: z.string().max(1000).optional(),

  // NEW fields
  claimingCadence: ClaimingCadenceEnum.nullable().optional(),
  claimingAmount: z.number().int().min(0).max(99999999).nullable().optional(),
  variableAmounts: z
    .record(
      z.string().regex(/^([1-9]|1[0-2])$/, 'Month key must be 1-12'),
      z.number().int().min(0)
    )
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
```

**Key design decisions**:
- `.nullable().optional()` allows the client to explicitly send `null` (clear the field) or omit it entirely (don't change)
- `variableAmounts` uses `z.record()` with a regex-constrained key to enforce month range 1–12
- The same schema update applies to both API routes (`/api/admin/benefits/[id]` and `/api/admin/cards/[id]/benefits/[benefitId]`)

### FR-6: Benefit List View — Engine Fields

In the admin benefits table (`src/app/admin/benefits/page.tsx`) and the card detail benefits list (`src/app/admin/cards/[id]/page.tsx`):

**Benefits table — new columns** (benefits page):

| Column | Source | Display |
|--------|--------|---------|
| Claiming Cadence | `claimingCadence` | Badge pill: "Monthly", "Quarterly", etc. If `null` → amber warning badge "⚠ Not Set" |
| Claiming Amount | `claimingAmount` | `formatCurrency(value)` or "—" if null |

**Card detail page — enhanced benefit row**:

Currently shows: `{benefit.type} • ${benefit.stickerValue} • {benefit.resetCadence}`

Change to: `{benefit.type} • ${stickerValue} • {resetCadence} • {claimingCadence badge}`

Where the claimingCadence badge is:
- Green pill → cadence is set
- Amber pill with ⚠ → cadence is null (needs attention)

### FR-7: Audit Logging

The existing audit infrastructure (`logResourceUpdate` in `src/features/admin/lib/audit.ts`) already works generically — it compares `oldValues` and `newValues` objects. The only change needed is to include the new fields in both objects.

**PATCH handler changes** (both API routes):

1. Add new fields to the `select` clause when fetching the existing benefit
2. Add new fields to `oldValues` before update
3. Add new fields to `newValues` after update

No changes needed to the audit library itself.

---

## Implementation Phases

### Phase 1: API & Validation (Backend)
**Objective**: Extend the Zod schema and API handlers to accept, validate, and persist the new fields.  
**Deliverables**:
- Updated `UpdateBenefitSchema` with `claimingCadence`, `claimingAmount`, `variableAmounts`, `isActive`
- Updated `ClaimingCadenceEnum` export
- Updated PATCH handlers in both routes to include new fields in select/audit
- Updated `Benefit` TypeScript interface in `src/features/admin/types/admin.ts`

### Phase 2: EditBenefitModal UI (Frontend)
**Objective**: Add the four new form fields to the modal with proper UX.  
**Deliverables**:
- claimingCadence dropdown with auto-suggest logic
- claimingAmount dollar input with cents conversion
- variableAmounts "Add Override" editor
- isActive toggle
- Client-side validation matching the Zod schema
- Proper pre-fill from existing benefit data

### Phase 3: List View Enhancements (Frontend)
**Objective**: Surface cadence information in table views with warning indicators.  
**Deliverables**:
- Two new columns in benefits page table
- Enhanced benefit row in card detail page
- Warning badges for null cadence

### Phase 4: Testing & QA
**Objective**: Validate all paths including edge cases.  
**Deliverables**:
- Manual QA checklist
- Zod schema unit tests
- Component render tests for new form fields

---

## Data Schema / State Management

### MasterBenefit — Relevant Columns (Prisma)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `claimingCadence` | `String?` | Yes | `null` | Enum: MONTHLY, QUARTERLY, SEMI_ANNUAL, FLEXIBLE_ANNUAL, ONE_TIME |
| `claimingAmount` | `Int?` | Yes | `null` | Per-period amount in cents |
| `claimingWindowEnd` | `String?` | Yes | `null` | Not editable in this spec (future work) |
| `variableAmounts` | `Json?` | Yes | `null` | `{ "12": 3500 }` format |
| `isActive` | `Boolean` | No | `true` | Soft-delete flag |

**No migration needed** — these columns already exist in the Prisma schema.

### Frontend Form State

```typescript
// In EditBenefitModal
const [formData, setFormData] = useState({
  // Existing
  name: '',
  type: '',
  stickerValue: '',        // Displayed as dollars, converted to cents on submit
  resetCadence: '',

  // New
  claimingCadence: '',     // '' means null/not-set
  claimingAmount: '',      // Displayed as dollars, converted to cents on submit
  isActive: true,
});

// variableAmounts managed separately as array of rows
const [overrideRows, setOverrideRows] = useState<
  Array<{ month: string; amount: string }>
>([]);
```

### TypeScript Interface Update

```typescript
// src/features/admin/types/admin.ts — Benefit interface
export interface Benefit {
  // ... existing fields ...
  id: string;
  masterCardId: string;
  name: string;
  type: BenefitType;
  stickerValue: number;
  resetCadence: ResetCadence;
  isDefault: boolean;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  masterCard?: { id: string; cardName: string; issuer?: string };

  // NEW
  claimingCadence?: string | null;
  claimingAmount?: number | null;
  variableAmounts?: Record<string, number> | null;
}
```

---

## User Flows & Workflows

### Flow 1: Admin Edits Claiming Cadence (Happy Path)

```
1. Admin navigates to /admin/benefits
2. Clicks "Edit" on a benefit row
3. EditBenefitModal opens, pre-filled with current values
4. Admin sees existing fields (name, type, stickerValue, resetCadence)
   and NEW fields (claimingCadence, claimingAmount, variableAmounts, isActive)
5. Admin selects claimingCadence = "MONTHLY" from dropdown
6. Modal shows suggestion: "Suggested: $15.00/month based on $180.00 annual value"
7. Admin enters claimingAmount = "15.00"
8. Admin clicks "Save"
9. Frontend converts $15.00 → 1500 cents
10. PATCH /api/admin/benefits/{id} with { claimingCadence: "MONTHLY", claimingAmount: 1500 }
11. API validates via UpdateBenefitSchema → passes
12. Prisma updates MasterBenefit row
13. Audit log records: oldValues { claimingCadence: null, claimingAmount: null }
                        → newValues { claimingCadence: "MONTHLY", claimingAmount: 1500 }
14. Modal closes, list refreshes via SWR mutate()
15. Benefit row now shows green "Monthly" badge instead of "⚠ Not Set"
```

### Flow 2: Admin Adds Variable Amount Override

```
1. Admin opens EditBenefitModal for "Uber Cash" benefit
2. claimingCadence already set to MONTHLY, claimingAmount = 1500 ($15.00)
3. Admin clicks "+ Add Override"
4. New row appears: [Month: --select--] [$0.00] [✕]
5. Admin selects December (12), enters "35.00"
6. Admin clicks "+ Add Override" again
7. New row: [Month: --select-- (December disabled)] [$0.00] [✕]
8. Admin selects June (6), enters "25.00"
9. Admin clicks "Save"
10. Frontend assembles: variableAmounts = { "6": 2500, "12": 3500 }
11. PATCH request succeeds
12. Audit log shows variableAmounts change from null → { "6": 2500, "12": 3500 }
```

### Flow 3: Admin Clears Claiming Cadence

```
1. Admin opens EditBenefitModal
2. claimingCadence is currently "QUARTERLY"
3. Admin selects "Not set" (empty option) from dropdown
4. Admin clicks "Save"
5. PATCH sends { claimingCadence: null }
6. API validates null → passes (.nullable().optional())
7. Database updated, cadence cleared
8. List view shows "⚠ Not Set" amber badge
```

### Flow 4: Admin Deactivates a Benefit

```
1. Admin opens EditBenefitModal
2. Scrolls to bottom, sees "Active" toggle (currently ON)
3. Admin toggles OFF
4. Helper text appears: "Inactive benefits are hidden from users but preserved in the database."
5. Admin clicks "Save"
6. PATCH sends { isActive: false }
7. Audit log records isActive: true → false
8. Benefit row in list may show a visual indicator (dimmed row or "Inactive" badge)
```

### Flow 5: Error Path — Invalid Variable Amount

```
1. Admin adds override: Month 13, Amount "-5.00"
2. Client-side validation catches: "Month must be 1-12", "Amount cannot be negative"
3. Red error text appears below the offending fields
4. Submit button remains enabled but form does not submit
5. If client validation is bypassed (API call), Zod schema rejects with 400:
   { code: "VALIDATION_ERROR", details: [{ field: "variableAmounts", message: "..." }] }
```

---

## API Routes & Contracts

### PATCH `/api/admin/benefits/[id]`

**Used by**: EditBenefitModal on the admin benefits list page.

#### Request

```http
PATCH /api/admin/benefits/{benefitId}
Content-Type: application/json
Cookie: session=...
```

```json
{
  "name": "Uber Cash",
  "type": "StatementCredit",
  "stickerValue": 18000,
  "resetCadence": "ANNUAL",
  "claimingCadence": "MONTHLY",
  "claimingAmount": 1500,
  "variableAmounts": { "12": 3500 },
  "isActive": true
}
```

All fields are optional. Only include fields being changed.

#### Response 200

```json
{
  "success": true,
  "data": {
    "id": "clxyz...",
    "masterCardId": "clxyz...",
    "name": "Uber Cash",
    "type": "StatementCredit",
    "stickerValue": 18000,
    "resetCadence": "ANNUAL",
    "claimingCadence": "MONTHLY",
    "claimingAmount": 1500,
    "variableAmounts": { "12": 3500 },
    "isDefault": true,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-07-18T12:00:00.000Z",
    "masterCard": { "id": "...", "cardName": "Amex Gold", "issuer": "American Express" }
  },
  "message": "Benefit updated successfully"
}
```

#### Response 400 (Validation)

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "claimingCadence", "message": "Invalid enum value. Expected 'MONTHLY' | 'QUARTERLY' | ..." },
    { "field": "variableAmounts.13", "message": "Month key must be 1-12" }
  ]
}
```

### PATCH `/api/admin/cards/[id]/benefits/[benefitId]`

Identical schema and behavior. This route adds card-ownership verification before update.

---

## Edge Cases & Error Handling

### EC-1: Null to Value Transitions

| Scenario | Handling |
|----------|----------|
| `claimingCadence` is null, admin sets to MONTHLY | Normal update; claimingAmount remains null unless also set |
| `claimingAmount` is null, admin sets to 1500 | Normal update; works even if claimingCadence is still null |
| `variableAmounts` is null, admin adds one override | Converts from null to `{ "12": 3500 }` |

### EC-2: Value to Null Transitions

| Scenario | Handling |
|----------|----------|
| Admin selects "Not set" for claimingCadence | Sends `claimingCadence: null`; does NOT auto-clear claimingAmount (admin may want to keep it) |
| Admin removes all override rows | Sends `variableAmounts: null` to clear the JSON column |
| Admin sets claimingAmount to empty string | Frontend sends `claimingAmount: null` (empty → null, not 0) |

### EC-3: Backwards Compatibility

| Scenario | Handling |
|----------|----------|
| Existing benefits with no cadence fields | Modal pre-fills claimingCadence as "Not set", claimingAmount as empty, variableAmounts as empty array of rows |
| Old API clients sending only name/type/stickerValue/resetCadence | Works unchanged — new fields are `.optional()` |
| Benefits created before Phase 6C | No migration needed; null values display as warnings |

### EC-4: Data Consistency

| Scenario | Handling |
|----------|----------|
| claimingCadence set but claimingAmount null | Allowed (engine falls back to stickerValue ÷ periods). Show informational helper: "No claiming amount set — engine will derive from sticker value." |
| claimingAmount set but claimingCadence null | Allowed but illogical. Show amber warning: "Claiming amount set without a cadence — the engine may ignore this value." |
| variableAmounts set but claimingCadence null | Allowed but will be ignored by engine. Show warning. |
| variableAmounts override amount exceeds stickerValue | Allowed (admin override). No validation — this is intentional for cases like bonus months. |

### EC-5: Concurrent Editing

| Scenario | Handling |
|----------|----------|
| Two admins edit the same benefit simultaneously | Last-write-wins (Prisma default). Audit log captures both changes with timestamps for forensics. No optimistic locking in this iteration. |
| Admin edits a benefit that was deleted by another admin | PATCH returns 404 "Benefit not found". Modal shows error. |

### EC-6: JSON Parsing Robustness

| Scenario | Handling |
|----------|----------|
| `variableAmounts` stored as malformed JSON in DB | Prisma handles deserialization; if corrupt, catch and show "Could not load month overrides" in modal with option to reset to null |
| Client sends `variableAmounts: {}` (empty object) | Valid — treated as "no overrides". Functionally equivalent to null. API stores `{}` as-is. |
| Client sends `variableAmounts: { "0": 500 }` | Zod regex rejects key "0" — month must be 1–12 |
| Client sends `variableAmounts: { "12": -100 }` | Zod rejects — value must be `min(0)` |

### EC-7: Currency Conversion Edge Cases

| Scenario | Handling |
|----------|----------|
| Admin enters "$15" (no cents) | `parseCurrency("15")` → 1500 cents ✓ |
| Admin enters "15.5" | `parseCurrency("15.5")` → 1550 cents ✓ |
| Admin enters "15.555" | `parseCurrency("15.555")` → `Math.round(1555.5)` → 1556 cents. Acceptable rounding. |
| Admin enters "" (empty) | Treated as null, not 0 |
| Admin enters "0" | Valid → 0 cents. Useful for "no value this period" |

### EC-8: Form State Reset

| Scenario | Handling |
|----------|----------|
| Admin opens modal, changes fields, closes without saving | All changes are discarded. `useEffect` resets form state on next open via `[isOpen, benefit]` dependency. |
| Admin opens modal for benefit A, then immediately opens for benefit B | `useEffect` fires with new `benefit` prop → form resets correctly |

### EC-9: Large variableAmounts

| Scenario | Handling |
|----------|----------|
| All 12 months have overrides | Allowed; UI renders 12 rows. "+ Add Override" button is disabled when all months are used. |
| variableAmounts exceeds 12 entries due to bad data | Zod schema allows at most 12 valid keys (1–12). Extra keys are rejected. Frontend only renders valid months. |

---

## Component Architecture

### EditBenefitModal — Updated Structure

```
EditBenefitModal (existing, enhanced)
├── DialogPrimitive.Root / Portal / Overlay / Content
│   ├── Title: "Edit Benefit"
│   ├── FormError (existing)
│   ├── <form>
│   │   ├── Section 1: Core Fields (existing)
│   │   │   ├── Name input
│   │   │   ├── Type dropdown
│   │   │   ├── Sticker Value ($) input
│   │   │   └── Reset Cadence dropdown
│   │   │
│   │   ├── Divider (visual separator, <hr>)
│   │   │
│   │   ├── Section 2: Engine Fields (NEW)
│   │   │   ├── Section header: "Claiming Configuration"
│   │   │   ├── Claiming Cadence dropdown
│   │   │   ├── Claiming Amount ($) input
│   │   │   │   └── Suggestion text (computed from stickerValue ÷ periods)
│   │   │   └── Variable Amounts editor
│   │   │       ├── Section header: "Month Overrides"
│   │   │       ├── Override rows (dynamic list)
│   │   │       │   └── [Month dropdown] [Amount input] [Remove button]
│   │   │       └── "+ Add Override" button
│   │   │
│   │   ├── Divider
│   │   │
│   │   ├── Section 3: Status (NEW)
│   │   │   └── isActive toggle with label
│   │   │
│   │   └── Action buttons: Cancel | Save
│   └── Close (X) button
```

### New Sub-Component: VariableAmountsEditor

Extract the override rows into a dedicated component for testability:

```typescript
// src/app/admin/_components/VariableAmountsEditor.tsx

interface OverrideRow {
  month: string;  // "1" through "12" or ""
  amount: string; // Dollar display string
}

interface VariableAmountsEditorProps {
  rows: OverrideRow[];
  onChange: (rows: OverrideRow[]) => void;
  disabled?: boolean;
  errors?: Record<number, { month?: string; amount?: string }>;
}
```

**Responsibilities**:
- Renders the list of override rows
- Manages "+ Add Override" / "Remove" actions
- Disables already-used months in the dropdown
- Reports changes up via `onChange`

### Files Modified

| File | Change |
|------|--------|
| `src/features/admin/validation/schemas.ts` | Add `ClaimingCadenceEnum`, extend `UpdateBenefitSchema` |
| `src/features/admin/types/admin.ts` | Add `claimingCadence`, `claimingAmount`, `variableAmounts` to `Benefit` interface |
| `src/app/admin/_components/EditBenefitModal.tsx` | Add new form fields, suggestion logic, overrides editor |
| `src/app/api/admin/benefits/[id]/route.ts` | Add new fields to select clauses and audit logging |
| `src/app/api/admin/cards/[id]/benefits/[benefitId]/route.ts` | Same as above |
| `src/app/admin/benefits/page.tsx` | Add cadence/amount columns, warning badges |
| `src/app/admin/cards/[id]/page.tsx` | Add cadence badge to benefit row display |

### Files Created

| File | Purpose |
|------|---------|
| `src/app/admin/_components/VariableAmountsEditor.tsx` | Extracted sub-component for month override editing |

---

## UI Wireframe Description

### EditBenefitModal — Field Layout

```
┌─────────────────────────────────────────────┐
│  Edit Benefit                           [✕] │
│─────────────────────────────────────────────│
│  [Error banner if any]                      │
│                                             │
│  Name *                                     │
│  ┌─────────────────────────────────────┐    │
│  │ Uber Cash                           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Type *                                     │
│  ┌──────────────────────────────── ▼ ──┐    │
│  │ Statement Credit                    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Sticker Value ($) *                        │
│  ┌─────────────────────────────────────┐    │
│  │ 180.00                              │    │
│  └─────────────────────────────────────┘    │
│  Enter amount in dollars (e.g., 500.00)     │
│                                             │
│  Reset Cadence *                            │
│  ┌──────────────────────────────── ▼ ──┐    │
│  │ Annual                              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ─────────── Claiming Configuration ─────── │
│                                             │
│  Claiming Cadence                           │
│  ┌──────────────────────────────── ▼ ──┐    │
│  │ Monthly                             │    │
│  └─────────────────────────────────────┘    │
│  How often this benefit can be claimed.     │
│  Leave blank to inherit from resetCadence.  │
│                                             │
│  Claiming Amount ($)                        │
│  ┌─────────────────────────────────────┐    │
│  │ 15.00                               │    │
│  └─────────────────────────────────────┘    │
│  Per-period amount in dollars.              │
│  💡 Suggested: $15.00/month based on        │
│     $180.00 annual sticker value            │
│                                             │
│  Month Overrides                            │
│  Override the per-period amount for         │
│  specific months (e.g., December bonus).    │
│                                             │
│  ┌──────────── ▼ ──┐ ┌──────────┐  [✕]    │
│  │ December (12)    │ │ 35.00    │         │
│  └──────────────────┘ └──────────┘         │
│                                             │
│  [+ Add Override]                           │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  ○ Active                                   │
│  Inactive benefits are hidden from users    │
│  but preserved in the database.             │
│                                             │
│                      [Cancel]  [Save]       │
└─────────────────────────────────────────────┘
```

### Benefits Table — New Columns

```
┌────────────────┬──────────────┬──────────────┬──────────┬─────────────────┬─────────────────┬─────────┐
│ Name           │ Card         │ Type         │ Value    │ Claiming Cadence│ Claiming Amount │ Actions │
├────────────────┼──────────────┼──────────────┼──────────┼─────────────────┼─────────────────┼─────────┤
│ Uber Cash      │ Amex Gold    │ Statement... │ $180.00  │ 🟢 Monthly      │ $15.00          │ Edit Del│
│ Airline Credit  │ Amex Plat    │ Statement... │ $200.00  │ ⚠️ Not Set      │ —               │ Edit Del│
│ TSA PreCheck   │ Amex Plat    │ Usage Perk   │ $85.00   │ 🟢 One-Time     │ $85.00          │ Edit Del│
└────────────────┴──────────────┴──────────────┴──────────┴─────────────────┴─────────────────┴─────────┘
```

### Validation Messages

| Field | Condition | Message |
|-------|-----------|---------|
| claimingCadence | Invalid enum value | "Invalid claiming cadence selected" |
| claimingAmount | Negative value | "Claiming amount cannot be negative" |
| claimingAmount | Non-numeric input | "Please enter a valid dollar amount" |
| variableAmounts month | No month selected | "Please select a month" |
| variableAmounts month | Duplicate month | "This month already has an override" |
| variableAmounts amount | Negative value | "Override amount cannot be negative" |
| variableAmounts amount | Empty with month selected | "Please enter an amount or remove this override" |

---

## Accessibility Requirements

### Keyboard Navigation

1. **Tab order**: Core fields → Claiming Cadence → Claiming Amount → Override rows (month, amount, remove) → Add Override → isActive toggle → Cancel → Save
2. **Override rows**: Each row's remove button must be reachable via Tab. After removal, focus moves to the previous row's remove button, or to "+ Add Override" if no rows remain
3. **Escape key**: Closes modal (already implemented via DialogPrimitive)

### ARIA Attributes

| Element | Attribute | Value |
|---------|-----------|-------|
| Claiming Configuration section | `role="group"` | — |
| Claiming Configuration section | `aria-labelledby` | ID of section heading |
| Month Override list | `role="list"` | — |
| Each override row | `role="listitem"` | — |
| Remove override button | `aria-label` | `"Remove override for {month name}"` |
| isActive toggle | `role="switch"` | — |
| isActive toggle | `aria-checked` | `"true"` or `"false"` |
| Suggestion text | `aria-live="polite"` | — (updates when cadence changes) |
| Warning badges in table | `aria-label` | `"Claiming cadence not configured"` |

### Screen Reader Announcements

- When cadence changes and suggestion recalculates: announce new suggestion via `aria-live="polite"` region
- When override row is added: announce "Month override added. Select a month and enter an amount."
- When override row is removed: announce "Override for {month} removed."

### Color Contrast

- Warning badges (amber): Must meet WCAG AA (4.5:1 contrast ratio) against both light and dark backgrounds
- Green "set" badges: Same contrast requirement
- All helper text (slate-500/slate-400): Already meets AA in existing design system

### Focus Management

- On modal open: Focus moves to first interactive element (Name input) — already implemented
- On "+ Add Override" click: Focus moves to the new row's month dropdown
- On override removal: Focus moves to previous row's remove button, or to "+ Add Override"

---

## Implementation Tasks

### Phase 1: API & Validation

| # | Task | Complexity | Acceptance Criteria |
|---|------|------------|-------------------|
| 1.1 | Add `ClaimingCadenceEnum` to `schemas.ts` | Small | New Zod enum exported; values match `MONTHLY \| QUARTERLY \| SEMI_ANNUAL \| FLEXIBLE_ANNUAL \| ONE_TIME` |
| 1.2 | Extend `UpdateBenefitSchema` with new fields | Small | `claimingCadence` (nullable enum), `claimingAmount` (nullable int ≥ 0), `variableAmounts` (nullable record), `isActive` (boolean) all pass Zod validation |
| 1.3 | Update `Benefit` interface in `admin.ts` | Small | `claimingCadence`, `claimingAmount`, `variableAmounts` fields added with correct types |
| 1.4 | Update PATCH handler in `/api/admin/benefits/[id]/route.ts` | Medium | Select clause includes new fields; `oldValues`/`newValues` include new fields; response includes new fields |
| 1.5 | Update PATCH handler in `/api/admin/cards/[id]/benefits/[benefitId]/route.ts` | Medium | Same as 1.4 |
| 1.6 | Update `BenefitItem` interface in both route files | Small | Add `claimingCadence`, `claimingAmount`, `variableAmounts` to response type |

### Phase 2: EditBenefitModal UI

| # | Task | Depends on | Complexity | Acceptance Criteria |
|---|------|------------|------------|-------------------|
| 2.1 | Add claimingCadence dropdown to form | 1.2 | Small | Dropdown renders with all 5 cadence options + "Not set". Pre-fills from benefit data. |
| 2.2 | Add claimingAmount input with dollar conversion | 1.2 | Small | Displays in dollars, converts to cents on submit. Empty → null. |
| 2.3 | Add suggestion calculation logic | 2.1, 2.2 | Small | When cadence changes, suggestion text shows `stickerValue ÷ periods`. Uses `aria-live="polite"`. |
| 2.4 | Create `VariableAmountsEditor` component | 1.2 | Medium | Add/remove override rows. Month deduplication. Dollar-to-cents conversion. Assembles JSON on parent submit. |
| 2.5 | Integrate VariableAmountsEditor into EditBenefitModal | 2.4 | Small | Override rows pre-fill from `benefit.variableAmounts`. On submit, serializes rows to JSON and includes in PATCH payload. |
| 2.6 | Add isActive toggle | 1.2 | Small | Toggle switch with label. Pre-fills from `benefit.isActive`. Sends boolean in PATCH payload. |
| 2.7 | Add client-side validation for new fields | 2.1–2.6 | Medium | All validation messages from spec render correctly. Invalid form prevents submission. |
| 2.8 | Add section dividers and layout structure | 2.1–2.6 | Small | "Claiming Configuration" section header. Visual dividers between sections. Consistent spacing. |

### Phase 3: List View Enhancements

| # | Task | Depends on | Complexity | Acceptance Criteria |
|---|------|------------|------------|-------------------|
| 3.1 | Add Claiming Cadence column to benefits table | 1.3 | Small | New column shows cadence as badge. Null → amber "⚠ Not Set" badge. |
| 3.2 | Add Claiming Amount column to benefits table | 1.3 | Small | New column shows `formatCurrency(amount)` or "—" for null. |
| 3.3 | Update card detail page benefit rows | 1.3 | Small | Benefit summary line includes cadence badge. |
| 3.4 | Ensure API responses include new fields | 1.4, 1.5 | Small | Verify GET endpoints for benefits also return new fields (check select clauses in list endpoints). |

### Phase 4: Testing

| # | Task | Depends on | Complexity | Acceptance Criteria |
|---|------|------------|------------|-------------------|
| 4.1 | Write Zod schema unit tests for new fields | 1.2 | Medium | Tests cover: valid cadence values, null cadence, invalid cadence, valid variableAmounts, invalid month keys, negative amounts, empty object, null |
| 4.2 | Manual QA: Edit benefit with all new fields | 2.1–2.8 | Medium | Complete QA checklist passes for all happy paths and error paths |
| 4.3 | Manual QA: Verify audit log entries | 1.4, 1.5 | Small | Changes to new fields appear in admin audit log with correct old/new values |

---

## Security & Compliance Considerations

### Authorization

- **No changes** — all admin endpoints already require `verifyAdminRole(request)` which validates JWT and checks ADMIN or SUPER_ADMIN role
- The `isActive` toggle does not require elevated permissions (any admin can toggle)

### Input Validation

- All new fields are validated server-side via Zod before reaching Prisma
- `variableAmounts` keys are regex-constrained to prevent injection via JSON keys
- Integer amounts have upper bounds (`max(99999999)`) to prevent overflow

### Audit Trail

- All changes logged via existing `logResourceUpdate` with full old/new value snapshots
- `variableAmounts` changes are logged as JSON objects (the full before/after state, not a diff)
- Audit logs include admin user ID, IP address, and user agent

### Data Integrity

- No cascade effects: changing `claimingCadence` on MasterBenefit does not automatically update linked UserBenefit records (those use the engine's resolution logic at claim time)
- The benefit engine reads these fields at runtime; updating them takes effect on the next period boundary

---

## Performance & Scalability Considerations

### Database

- No new queries — the PATCH handler already updates by primary key
- New fields are included in existing SELECT → negligible overhead
- `claimingCadence` already has an index (`@@index([claimingCadence])`)
- `variableAmounts` is a JSON column; no indexing needed (not queried)

### Frontend

- `VariableAmountsEditor` renders at most 12 rows — no virtualization needed
- Suggestion calculation is a simple division — runs synchronously on cadence change
- Two new table columns in benefits list — no performance impact on existing pagination

### API Payload

- `variableAmounts` JSON adds at most ~200 bytes to the PATCH payload (12 entries)
- Response size increase is similarly negligible

---

## Appendix: Month Name Mapping

Used by VariableAmountsEditor dropdown and display badges:

```typescript
const MONTH_NAMES: Record<string, string> = {
  '1': 'January',
  '2': 'February',
  '3': 'March',
  '4': 'April',
  '5': 'May',
  '6': 'June',
  '7': 'July',
  '8': 'August',
  '9': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};
```

## Appendix: Cadence Display Labels

```typescript
const CADENCE_LABELS: Record<string, string> = {
  'MONTHLY': 'Monthly',
  'QUARTERLY': 'Quarterly',
  'SEMI_ANNUAL': 'Semi-Annual',
  'FLEXIBLE_ANNUAL': 'Flexible Annual',
  'ONE_TIME': 'One-Time',
};
```
