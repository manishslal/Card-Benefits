# SQLite Compatibility Fix — QA Review Report

**Report version:** 1.0  
**Date:** 2025-07-14  
**Reviewer:** QA Agent  
**Spec under review:** `.github/specs/sqlite-compat-spec.md` v1.0  
**File reviewed:** `src/lib/prisma.ts`  
**Change description:** Removal of `mode: 'insensitive'` from two Prisma `contains` filters inside `searchMasterCards`

---

## Executive Summary

The fix is **technically correct and complete**. The two `mode: 'insensitive'` properties have been removed from `searchMasterCards` exactly as the spec prescribes. A meaningful explanatory comment is present. No live occurrences of `mode: 'insensitive'` remain anywhere in the `src/` directory. TypeScript types are unaffected. No callers were broken.

One **medium-priority advisory** is raised: the function `searchMasterCards` has **zero callers** in the codebase — it is defined but never invoked from any route, action, or component. This is a pre-existing gap (not introduced by this change), but it means TC-01 through TC-05 cannot be exercised through any existing UI path and must be driven by a direct test script.

One **low-priority deviation** from the spec is noted: the explanatory comment omits the spec file path cross-reference recommended in spec section 5a.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 (advisory, pre-existing) |
| Low | 1 |

**Overall verdict: ✅ APPROVED**

---

## Critical Issues

_None._

---

## High Priority Issues

_None._

---

## Medium Priority Issues

### M-01 — `searchMasterCards` is a dead function with no callers

**Location:** `src/lib/prisma.ts` — entire `searchMasterCards` function  
**Introduced by this change:** No (pre-existing)

**What's wrong:**  
A full-codebase scan (`grep -rn "searchMasterCards"`) finds exactly one hit — the function's own definition on line 24. No route, server action, component, or utility ever calls `db.searchMasterCards(...)`. The function is dead code.

**Impact:**
- The bug fixed by this change (the `PrismaClientValidationError`) can never be triggered through the running application in its current state, because no code path reaches this function.
- TC-01 through TC-05 cannot be verified end-to-end through the UI. They require a purpose-written test script that directly invokes `db.searchMasterCards()`.
- The absence of a caller also means there is no type-safety enforcement at call sites — any future caller could inadvertently pass wrong argument types without being caught at a higher level.

**How to address:**  
Either wire `searchMasterCards` to a real API route / server action (e.g., a card search endpoint), or add a minimal integration test file that exercises the function directly against the SQLite dev database. Neither action is required to approve this specific fix, but the dead-code state should be tracked.

---

## Low Priority Issues

### L-01 — Explanatory comment omits spec file cross-reference recommended in spec §5a

**Location:** `src/lib/prisma.ts`, lines 27–30

**What's wrong:**  
Spec section 5a ("Future migration back to PostgreSQL") explicitly recommends:

> "add a comment referencing this spec so future developers understand why the property is necessary"

The example in the spec reads:
```ts
// PostgreSQL requires mode: 'insensitive' for case-insensitive LIKE.
// SQLite handles ASCII case-insensitivity natively; see .github/specs/sqlite-compat-spec.md.
```

The implemented comment conveys the correct technical rationale but omits the `see .github/specs/sqlite-compat-spec.md` path reference. A future developer performing the PostgreSQL migration will not know where to find the full context.

**Impact:** Low — the comment is still informative. Only the spec cross-reference is missing.

**How to address:**  
Append `// See .github/specs/sqlite-compat-spec.md for full context.` (or equivalent) to the existing comment block.

---

## Specification Alignment Analysis

| Spec requirement | Status | Notes |
|---|---|---|
| Remove `mode: 'insensitive'` from `issuer` filter | ✅ Done | Line 32: `...(issuer && { issuer: { contains: issuer } })` |
| Remove `mode: 'insensitive'` from `cardName` filter | ✅ Done | Line 33: `...(cardName && { cardName: { contains: cardName } })` |
| No other logic changes to `searchMasterCards` | ✅ Confirmed | Function signature, `include`, spread logic unchanged |
| Explanatory comment present | ✅ Present | Lines 27–30 — see L-01 for minor deviation |
| No schema changes | ✅ Confirmed | `prisma/schema.prisma` untouched |
| No new imports or exports | ✅ Confirmed | |
| TypeScript types unaffected | ✅ Confirmed | `mode` is optional in Prisma's `StringFilter`; removal is type-safe |
| No other files changed | ✅ Confirmed | Only `src/lib/prisma.ts` contains the fix |
| Comment cross-references spec file (§5a recommendation) | ⚠️ Missing | See L-01 |

---

## Scan: Missed Occurrences of `mode: 'insensitive'`

**Scope scanned:** All `.ts` and `.tsx` files under `src/`  
**Command used:** `grep -rn "mode.*insensitive" src/ --include="*.ts" --include="*.tsx"`

**Result:**

```
src/lib/prisma.ts:27:  // `mode: 'insensitive'` is intentionally omitted — SQLite's LIKE operator is
src/lib/prisma.ts:29:  // If migrating back to PostgreSQL, re-add `mode: 'insensitive'` to both filters
```

Both matches are **comment text only** — they are not live code. There are **zero live uses** of `mode: 'insensitive'` remaining anywhere in the `src/` directory.

**Other `contains` usages in `src/`:**  
One additional hit was found in `src/lib/calculations.ts:107`, which is a JSDoc comment using the word "contains" in prose — it is not a Prisma query operator and is completely unrelated to this fix.

**Verdict: No missed occurrences. The scan is clean.**

---

## Regression Check

### TypeScript types
Removing `mode` from `{ contains: issuer, mode: 'insensitive' }` produces `{ contains: issuer }`. In Prisma's generated `StringFilter` type, `mode` is declared as an optional property (`mode?: QueryMode`). Removing it is fully type-safe and introduces no TypeScript errors.

### Function signature
`searchMasterCards(issuer?: string, cardName?: string)` — unchanged. No callers to break.

### Return type
`prisma.masterCard.findMany({ include: { masterBenefits: true } })` — unchanged. The return type inferred by TypeScript is identical to before the fix.

### Other files
`src/actions/wallet.ts`, `src/actions/benefits.ts`, `src/components/CardTrackerPanel.tsx`, `src/lib/calculations.ts`, `src/lib/benefitDates.ts`, `src/types/index.ts` — none of these reference `searchMasterCards` or the `mode` property. Zero regressions.

---

## Test Case Verdicts: TC-01 through TC-05

> **Important caveat for all test cases:** `searchMasterCards` has no callers in the current codebase (see M-01). All five test cases must be exercised by directly invoking `db.searchMasterCards()` in a test script or a temporary route. The implementation itself is correct and should pass all five once invoked.

---

### TC-01 — No filters returns all cards

**Verdict: ✅ READY TO TEST**

The implementation uses `...(issuer && {...})` and `...(cardName && {...})`. When both arguments are `undefined`, the spread produces no `where` conditions. Prisma will return all `masterCard` rows with nested `masterBenefits`. No code path in this function can throw a `PrismaClientValidationError` after the fix. Behaviour is correct.

---

### TC-02 — Issuer search is case-insensitive (ASCII)

**Verdict: ✅ READY TO TEST**

With `mode: 'insensitive'` removed and the Prisma schema confirmed to use `provider = "sqlite"`, Prisma will translate `{ contains: issuer }` to a SQLite `LIKE '%value%'` clause. SQLite's `LIKE` is ASCII-case-insensitive by default. Searches for `"american express"`, `"AMERICAN EXPRESS"`, and `"American Express"` will all produce the same results. No `PrismaClientValidationError` will be thrown.

---

### TC-03 — Card name partial-string search

**Verdict: ✅ READY TO TEST**

Same reasoning as TC-02. `{ contains: cardName }` on `cardName` will generate a `LIKE '%value%'` query in SQLite. Partial case-insensitive matches (e.g., `"sapphire"` matching `"Chase Sapphire Preferred"`) are supported natively by SQLite's LIKE for ASCII characters.

---

### TC-04 — Both filters combined

**Verdict: ✅ READY TO TEST**

When both `issuer` and `cardName` are truthy, the spread produces:
```ts
where: {
  issuer: { contains: issuer },
  cardName: { contains: cardName },
}
```
Prisma composes this as a logical AND (both conditions must be satisfied). This is correct and unchanged from the original intent. SQLite will receive: `WHERE issuer LIKE '%chase%' AND cardName LIKE '%sapphire%'` (case-insensitive for ASCII). Behaviour is correct.

---

### TC-05 — Undefined / empty filters behave as "no filter"

**Verdict: ✅ READY TO TEST**

`undefined` arguments produce no `where` clause — same as TC-01. Empty string `""` arguments evaluate to falsy in the spread conditions (`issuer && {...}` is falsy when `issuer === ""`), so no `where` clause is emitted for either filter. Both `searchMasterCards(undefined, undefined)` and `searchMasterCards("", "")` return all cards — consistent with the spec's stated expectation.

---

## Summary Table

| Test Case | Description | Verdict |
|---|---|---|
| TC-01 | No filters returns all cards | ✅ READY TO TEST |
| TC-02 | Issuer search is case-insensitive (ASCII) | ✅ READY TO TEST |
| TC-03 | Card name partial-string search | ✅ READY TO TEST |
| TC-04 | Both filters combined | ✅ READY TO TEST |
| TC-05 | Undefined / empty filters behave as "no filter" | ✅ READY TO TEST |

---

## Recommended Next Steps

1. **Address L-01 (optional, low effort):** Add `// See .github/specs/sqlite-compat-spec.md for full context.` to the comment block at lines 27–30 to fully satisfy spec §5a.

2. **Track M-01 as a separate issue:** Open a work item to wire `searchMasterCards` to a real API route or add an integration test so the function is exercised and TC-01 through TC-05 can be validated against a live SQLite database.

3. **Run TC-01 through TC-05** using a direct test script (e.g., a Jest integration test or a temporary Next.js API route) once M-01 is addressed or a test harness is added.

---

## Overall Verdict

> # ✅ APPROVED
>
> The SQLite compatibility fix is technically correct, complete, and precisely aligned with the specification. The two `mode: 'insensitive'` properties have been removed from the correct locations. No live occurrences were missed. No TypeScript types, function signatures, or callers were broken. The explanatory comment is present and accurate (with a minor omission noted as L-01). All five spec test cases are ready to execute once a test harness is in place.
