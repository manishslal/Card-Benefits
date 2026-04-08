# Admin Benefit Editing — QA Review Report

**Date:** 2025-07-11
**Reviewer:** QA Automation Engineer (Senior)
**Build Status:** ✅ PASSES (`npx next build` exit code 0)
**Scope:** 8 files spanning Zod validation, API endpoints, React modal, card detail page, and TypeScript types

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 3 | ✅ All 3 FIXED directly |
| 🟠 HIGH | 4 | ⬜ Documented for engineer |
| 🟡 MEDIUM | 6 | ⬜ Documented for engineer |
| 🔵 LOW | 4 | ⬜ Documented for engineer |

**Verdict:** After the three critical fixes applied in this review, the code is conditionally deployable. The HIGH issues should be addressed in the next sprint cycle, particularly H-1 (cents mismatch in Add form) which silently corrupts monetary data.

---

## 🔴 CRITICAL Issues (FIXED)

### C-1: Benefit Type Enum Mismatch — Edit Modal Completely Broken

**File:** `src/app/admin/_components/EditBenefitModal.tsx` lines 29-34
**What was wrong:** The modal defined `VALID_TYPES = ['StatementCredit', 'UsagePerk']` while the database/Zod schema uses `['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER']`.
**Impact:**
  - **Pre-fill failure:** Line 109 checks `VALID_TYPES.includes(benefit.type)`. Since DB types like `'INSURANCE'` don't match, every existing benefit's type dropdown renders as blank (`''`).
  - **Submit failure:** Form sends `type: ''` which fails the `BenefitTypeEnum` Zod validation on the server → 400 error. Admins cannot save ANY edit without first re-selecting a type, but the available options (StatementCredit/UsagePerk) ALSO fail Zod validation. **The entire Edit modal was non-functional.**

**Fix applied:**
```tsx
// BEFORE (broken)
const VALID_TYPES = ['StatementCredit', 'UsagePerk'];

// AFTER (fixed)
const VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];
```
TYPE_OPTIONS updated to match.

---

### C-2: variableAmounts Validation Allows Arbitrary JSON Keys

**File:** `src/features/admin/validation/schemas.ts` line 225-227
**What was wrong:** `z.record(z.string(), z.number().int().min(0))` accepts *any* string key. An attacker or buggy client could send keys like `"__proto__"`, `"constructor"`, `"0"`, `"13"`, `"999"`, or extremely long strings. The spec requires only month strings `"1"` through `"12"`.
**Impact:** Prototype pollution risk via `__proto__` keys; invalid month data stored in JSONB column; downstream consumers of `variableAmounts` could crash on unexpected keys.

**Fix applied:**
```ts
variableAmounts: z
  .record(z.string(), z.number().int().min(0))
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (val === null || val === undefined) return true;
      const validMonths = new Set(['1','2','3','4','5','6','7','8','9','10','11','12']);
      return Object.keys(val).every((k) => validMonths.has(k));
    },
    { message: 'variableAmounts keys must be month numbers 1-12' }
  ),
```

---

### C-3: Generic DELETE Endpoint Bypasses "In Use" Safety Check

**File:** `src/app/api/admin/benefits/[id]/route.ts` line 361
**What was wrong:** `const userBenefitCount = 0; // No direct relation available` — hardcoded to 0. The guard at line 363 (`if (userBenefitCount > 0 && !query.force)`) can NEVER trigger. Benefits actively used by users can be deleted through `DELETE /api/admin/benefits/{id}` without any warning or force flag.
**Impact:** Data loss — deleting a benefit that users are tracking silently removes it, potentially corrupting dashboards and reporting. The card-scoped endpoint correctly counts via `prisma.userBenefit.count({ where: { name: benefit.name } })`.

**Fix applied:**
```ts
// BEFORE
const userBenefitCount = 0; // No direct relation available

// AFTER
const userBenefitCount = await prisma.userBenefit.count({
  where: { name: benefit.name },
});
```

---

## 🟠 HIGH Priority Issues (must fix)

### H-1: Add Benefit Form Sends Raw Dollars Instead of Cents

**File:** `src/app/admin/cards/[id]/page.tsx` lines 165, 192-193
**Description:** The "Add Benefit" form (separate from the Edit modal) sends `stickerValue: parseFloat(benefitFormData.stickerValue)`. If a user enters `500` meaning $500, the server receives `500` and stores it as 500 cents ($5.00). The Edit modal correctly uses `parseCurrency()` which does `Math.round(dollars * 100)`.
**Impact:** Every benefit created via "Add Benefit" has its value stored at 1/100th of what the admin intended. This corrupts the `stickerValue` column and affects all downstream calculations (auto-suggestion, period tracking, user dashboards).
**How to fix:** Replace `parseFloat(benefitFormData.stickerValue)` with `parseCurrency(benefitFormData.stickerValue)` — import `parseCurrency` from `@/shared/lib/format-currency`. Alternatively, convert using `Math.round(parseFloat(benefitFormData.stickerValue) * 100)`.

---

### H-2: Suggested Amount Not Recalculated When stickerValue Changes

**File:** `src/app/admin/_components/EditBenefitModal.tsx` lines 150-168
**Description:** `handleCadenceChange` computes the suggested per-period amount only when the claimingCadence dropdown changes. If the admin changes the stickerValue *after* selecting a cadence, the blue hint stays stale — e.g., showing "Suggested: $41.67" after the annual total was changed from $500 to $300.
**Impact:** Misleading guidance. The admin may accept the stale suggestion as the claimingAmount, resulting in incorrect per-period amounts.
**How to fix:** Add a `useEffect` that recalculates `suggestedAmount` whenever either `formData.stickerValue` or `formData.claimingCadence` changes:
```tsx
useEffect(() => {
  if (formData.claimingCadence && formData.stickerValue) {
    const totalCents = parseCurrency(formData.stickerValue);
    const periods = PERIODS_PER_YEAR[formData.claimingCadence] ?? 1;
    const perPeriodCents = Math.round(totalCents / periods);
    setSuggestedAmount(`Suggested: ${formatCurrency(perPeriodCents, true)} based on annual total`);
  } else {
    setSuggestedAmount(null);
  }
}, [formData.stickerValue, formData.claimingCadence]);
```

---

### H-3: Variable Amount Override Rows with Empty Amount Silently Dropped

**File:** `src/app/admin/_components/EditBenefitModal.tsx` lines 279-289
**Description:** When building the `variableAmountsPayload`, entries where `entry.amount` is falsy (empty string) are skipped. If a user adds a month override but forgets to enter an amount, the override row is silently excluded from the API payload with no visual feedback.
**Impact:** Data loss from user perspective — admin sets up 3 month overrides, one has no amount, save succeeds but only 2 overrides are persisted. Admin doesn't notice until later.
**How to fix:** Either (a) validate in `validateForm()` that every variableAmounts entry has a non-empty amount, or (b) show an inline error on empty-amount rows before submit.

---

### H-4: `BenefitUpdateRequest` TypeScript Type Missing New Fields

**File:** `src/features/admin/types/admin.ts` lines 165-171
**Description:** The `BenefitUpdateRequest` interface does not include `claimingCadence`, `claimingAmount`, `variableAmounts`, or `isActive`. While the modal uses its own form state (not this type), any code that imports `BenefitUpdateRequest` for type-safe API calls will miss these fields.
**Impact:** TypeScript won't catch missing fields when other code uses this type to build PATCH payloads. Increases risk of incomplete updates.
**How to fix:**
```ts
export interface BenefitUpdateRequest {
  name?: string;
  stickerValue?: number;
  resetCadence?: ResetCadence;
  isDefault?: boolean;
  description?: string;
  claimingCadence?: string | null;
  claimingAmount?: number | null;
  variableAmounts?: Record<string, number> | null;
  isActive?: boolean;
}
```

---

## 🟡 MEDIUM Priority Issues (should fix)

### M-1: Labels Missing `htmlFor` / Inputs Missing `id` — Accessibility Violation

**File:** `src/app/admin/_components/EditBenefitModal.tsx` (entire form, lines 348-605)
**Description:** All `<label>` elements use `className={labelClasses}` but no `htmlFor` attribute. No `<input>` or `<select>` has an `id`. This breaks the label-input association required by WCAG 2.1 SC 1.3.1 (Info and Relationships).
**Impact:** Screen readers cannot associate labels with controls. Clicking a label doesn't focus its input. Fails accessibility audits.
**How to fix:** Add matching `id`/`htmlFor` pairs. Example:
```tsx
<label htmlFor="benefit-name" className={labelClasses}>Name *</label>
<input id="benefit-name" type="text" name="name" ... />
```

---

### M-2: No `aria-describedby` for Error/Helper Messages

**File:** `src/app/admin/_components/EditBenefitModal.tsx` (all field error paragraphs)
**Description:** Error messages (`<p className={errorClasses}>`) and helper text (`<p className={helperClasses}>`) are visually positioned near inputs but not programmatically linked via `aria-describedby`.
**Impact:** Screen reader users won't hear validation errors when a field is focused. WCAG 2.1 SC 3.3.1 violation.
**How to fix:** Add `aria-describedby="name-error"` on inputs and `id="name-error"` on their error paragraphs.

---

### M-3: No Input Validation Feedback Until Submit for Dollar Fields

**File:** `src/app/admin/_components/EditBenefitModal.tsx` lines 396-410, 465-488
**Description:** Dollar input fields accept any text (e.g., `"abc"`, `"$$$"`). `parseCurrency` silently returns 0 for invalid input, but the user receives no feedback until they submit the form. By then, their intended value has been silently zeroed.
**Impact:** Admin may unknowingly set a $0 claiming amount. No visual indicator of invalid input.
**How to fix:** Add `onBlur` validation or `inputMode="decimal"` + a `pattern` attribute to constrain input. Alternatively, use `type="number"` with `step="0.01"`.

---

### M-4: `handleCadenceChange` useCallback Has Unstable `fieldErrors` Dependency

**File:** `src/app/admin/_components/EditBenefitModal.tsx` line 168
**Description:** The `useCallback` dependency array includes `fieldErrors`, which is a new object on every state update. This defeats memoization — the callback is recreated on every keystroke in any field that has validation errors.
**Impact:** Minor performance issue; the cadence `<select>` re-renders unnecessarily on every keystroke.
**How to fix:** Remove `fieldErrors` from the dependency array. Instead, access `fieldErrors` via a ref or move the field-error clearing logic outside the callback.

---

### M-5: Month Override Select Missing `aria-label`

**File:** `src/app/admin/_components/EditBenefitModal.tsx` lines 516-531
**Description:** Each month `<select>` in the variableAmounts section has no `aria-label`. The delete button correctly has `aria-label={`Remove ${MONTH_NAMES[...]} override`}`, but the selects don't.
**Impact:** Screen readers announce the select as unlabeled, making month overrides inaccessible.
**How to fix:** Add `aria-label={`Select month for override ${idx + 1}`}` to each select.

---

### M-6: Card Detail Page Loading Spinner Uses Emoji Instead of Accessible Indicator

**File:** `src/app/admin/cards/[id]/page.tsx` lines 275-279
**Description:** The loading state uses `<div className="inline-block animate-spin">⏳</div>`. Emojis may not render consistently across platforms and carry no accessible semantics.
**Impact:** Visual inconsistency; screen readers may announce "hourglass" which is confusing.
**How to fix:** Replace with an SVG spinner or a Lucide `Loader2` icon with `aria-label="Loading"` and `role="status"`.

---

## 🔵 LOW Priority Issues (consider for future)

### L-1: No Validation That claimingCadence and claimingAmount Are Set Together

**Files:** `schemas.ts` lines 217-224, `EditBenefitModal.tsx` lines 197-244
**Description:** The schema allows setting `claimingCadence` without `claimingAmount` or vice versa. A cadence without an amount (or an amount without a cadence) is semantically invalid.
**How to fix:** Add a `.refine()` on `UpdateBenefitSchema` that checks: if either `claimingCadence` or `claimingAmount` is non-null, the other must also be non-null.

---

### L-2: `description` Field Not Exposed in Edit Modal

**Files:** `schemas.ts` line 215, `EditBenefitModal.tsx`
**Description:** `UpdateBenefitSchema` accepts a `description` field, but the Edit modal has no UI for it. Admins must use raw API calls to edit descriptions.
**How to fix:** Add a `<textarea>` for description in the modal, or remove `description` from the update schema if it's not intended to be editable.

---

### L-3: `as any` Bypasses TypeScript Safety on Prisma Data

**Files:** `route.ts` (generic) line 202, `[benefitId]/route.ts` line 220
**Description:** Both PATCH handlers use `data: prismaData as any` to pass the update payload to Prisma. This bypasses TypeScript's protection against sending invalid field names.
**How to fix:** Build a properly-typed `Prisma.MasterBenefitUpdateInput` object instead of using `Record<string, unknown>`.

---

### L-4: Add Benefit Modal and Edit Benefit Modal Have Inconsistent Reset Cadence Options

**Files:** `EditBenefitModal.tsx` lines 426-431, `page.tsx` lines 522-526
**Description:** The Edit modal offers `ANNUAL`, `PER_TRANSACTION`, `PER_DAY`, `MONTHLY`, `ONE_TIME`. The Add modal offers `DAILY`, `MONTHLY`, `ANNUAL`, `ONE_TIME`. Note "PER_DAY" vs "DAILY" and "PER_TRANSACTION" is missing from the Add form.
**How to fix:** Standardize both forms to use the same enum values. The Zod `ResetCadenceEnum` is the source of truth: `ANNUAL`, `PER_TRANSACTION`, `PER_DAY`, `MONTHLY`, `ONE_TIME`.

---

## Specification Alignment Analysis

| Spec Requirement | Status | Notes |
|---|---|---|
| Dollar↔cents: `cents = Math.round(dollars * 100)` | ✅ Correct in Edit modal | ❌ Missing in Add form (H-1) |
| Dollar↔cents: `dollars = cents / 100` | ✅ `formatCurrency` does this correctly | |
| Auto-suggestion: `stickerValue / periodsPerYear` | ✅ Formula correct | ⚠️ Not recalculated on stickerValue change (H-2) |
| MONTHLY=12, QUARTERLY=4, SEMI_ANNUAL=2, FLEXIBLE_ANNUAL=1, ONE_TIME=1 | ✅ `PERIODS_PER_YEAR` matches exactly | |
| Can't select same month twice | ✅ `isUsedElsewhere` disables used months | |
| Remove override works | ✅ `handleRemoveOverride` filters by index | |
| Clearing field sends null (not undefined) | ✅ `claimingCadence: '' → null`, `claimingAmount: '' → null` | |
| `Prisma.JsonNull` for variableAmounts=null | ✅ Both endpoints handle this | |
| Admin role verified on all endpoints | ✅ `verifyAdminRole()` called first in all handlers | |
| No mass assignment (Zod whitelist) | ✅ Schema whitelists specific fields | |
| variableAmounts keys 1-12 only | ✅ **Fixed** — `.refine()` added | |
| Dark mode contrast | ✅ All elements have `dark:` variants | |
| isActive default behavior | ✅ Schema defaults to `true` in Prisma | |

---

## Test Coverage Recommendations

### Priority 1 — Unit Tests for Currency Conversion Round-Trip
```
- parseCurrency("500.00") → 50000
- formatCurrency(50000, false) → "500.00"
- Round-trip: formatCurrency(parseCurrency("123.45"), false) === "123.45"
- Edge: parseCurrency("") → 0
- Edge: parseCurrency("abc") → 0
- Edge: parseCurrency("$1,234.56") → 123456
```

### Priority 2 — Zod Schema: variableAmounts Validation
```
- Valid: { "1": 1500, "12": 3500 } → passes
- Invalid: { "0": 100 } → rejected (key out of range)
- Invalid: { "13": 100 } → rejected
- Invalid: { "__proto__": 100 } → rejected
- Invalid: { "1": -50 } → rejected (negative value)
- Invalid: { "1": 15.5 } → rejected (non-integer)
- Valid: null → passes
- Valid: undefined → passes (field omitted)
```

### Priority 3 — API Endpoint: PATCH /api/admin/benefits/[id]
```
- Admin auth required (401 without session)
- Valid update with new claimingCadence → 200 + audit log created
- variableAmounts set to null → Prisma.JsonNull used
- Duplicate name check → 409
- Non-existent benefit → 404
```

### Priority 4 — API Endpoint: DELETE /api/admin/benefits/[id]
```
- Benefit in use + no force flag → 409 (was broken, now fixed)
- Benefit in use + deactivateInstead → 200, isActive=false
- Benefit in use + force=true → 200, deleted
- Benefit not in use → 200, deleted
```

### Priority 5 — EditBenefitModal Integration
```
- Pre-fill renders correct values for all fields
- Type dropdown shows correct selection for INSURANCE, CASHBACK, etc.
- Submit sends correct cents values for stickerValue and claimingAmount
- Adding/removing month overrides works
- Empty claimingCadence sends null, not empty string
```

---

## Build Verification

```
$ npx next build
✓ Compiled successfully
✓ Exit code 0
✓ All routes generated without errors
```

Both pre-fix and post-fix builds pass. No TypeScript errors introduced.
