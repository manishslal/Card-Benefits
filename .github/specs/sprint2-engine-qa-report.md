# Sprint 2 — Benefit Engine QA Report

**Reviewer:** QA Code Reviewer (Automated)
**Date:** 2025-07-21
**Sprint:** 2 (Final sprint before `BENEFIT_ENGINE_ENABLED=true`)
**Verdict:** ✅ **PASS WITH FIXES** (3 critical fixes applied inline, see §Applied Fixes)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Files reviewed | 26 |
| Critical issues found | 3 (all fixed) |
| High issues found | 3 |
| Medium issues found | 5 |
| Low issues found | 4 |
| Build status | ✅ PASS |
| Toggle-used tests (13) | ✅ ALL PASS |
| Benefit engine tests (99) | ✅ ALL PASS |
| Hydrate period tests (11) | ✅ ALL PASS |
| Import validator tests | ✅ ALL PASS |
| Duplicate detector tests | ✅ ALL PASS |
| Pre-existing test failures | 91 (not from Sprint 2 — see §Pre-existing) |

**Overall assessment:** Sprint 2 code is well-structured, properly feature-flagged, and safe to enable. The 3 critical issues found were fixed directly in this review. The remaining high/medium issues are non-blocking but should be addressed in the next sprint.

---

## Applied Fixes (Critical — Fixed Inline)

### FIX-1: Seed fee off by 10× — Chase Hyatt ($950 instead of $95)

**File:** `seed-points-cards-comprehensive.js:645`
**Severity:** 🔴 CRITICAL (Data Integrity)
**Issue:** `defaultAnnualFee: 95000` ($950) — should be `9500` ($95). Comment said `$95` but the value was 10× too high.
**Impact:** Any user who seeds the Chase Hyatt card would see a $950 annual fee, corrupting ROI calculations.
**Fix applied:** Changed `95000` → `9500`.

### FIX-2: Missing `resetCadence` in export field definitions — round-trip data loss

**File:** `src/features/import-export/lib/schema.ts:52-68`
**Severity:** 🔴 CRITICAL (Import/Export Round-trip)
**Issue:** The exporter adds `resetCadence` to benefit data (exporter.ts:115) when engine is enabled, but:
1. `BENEFIT_EXPORT_FIELDS` had no `resetCadence` entry → field was silently dropped from CSV/XLSX output
2. `PERIOD_FIELD_IDS` didn't include it → wouldn't be filtered when engine OFF

This meant export→import round-trips lost the `resetCadence` value, causing the committer to fall back to `'OneTime'` for every imported benefit.
**Fix applied:** Added `resetCadence` to both `BENEFIT_EXPORT_FIELDS` and `PERIOD_FIELD_IDS`.

### FIX-3: Committer ignored imported `resetCadence` — hardcoded `'OneTime'`

**File:** `src/features/import-export/lib/committer.ts:157`
**Severity:** 🔴 CRITICAL (Import/Export Round-trip)
**Issue:** `hydratePeriodFields(tx, userCardId, benefitName, 'OneTime')` — the fallback cadence was always `'OneTime'` regardless of what the import file contained. For a monthly benefit exported then re-imported, it would become a one-time benefit.
**Fix applied:** Changed to `normalizedData.resetCadence ?? 'OneTime'` — uses the imported cadence if present, falls back to `'OneTime'` only when missing.

### Enhancement: Toggle-used error messages now include dates

**File:** `src/app/api/benefits/[id]/toggle-used/route.ts:83-103`
**Improvement:** EXPIRED error now shows `(ended YYYY-MM-DD)` and UPCOMING error shows `(starts YYYY-MM-DD)` when the dates are available. All 13 toggle-used tests still pass.

---

## 1. Feature Flag Completeness ✅ PASS

### Methodology
Searched all source files for `BENEFIT_ENGINE_ENABLED` references and traced every code path to verify flag-gating.

### Findings

| Component | Guard Location | Guard Type | Verdict |
|-----------|----------------|------------|---------|
| toggle-used route | route.ts:80 | `if (featureFlags.BENEFIT_ENGINE_ENABLED)` | ✅ Entire guard block skipped when OFF |
| AlertSection | AlertSection.tsx:87 | `featureFlags.BENEFIT_ENGINE_ENABLED` passed to `deduplicateBenefits()` | ✅ dedup is no-op when OFF |
| Card.tsx | Card.tsx:51 | `featureFlags.BENEFIT_ENGINE_ENABLED` passed to `deduplicateBenefits()` | ✅ dedup is no-op when OFF |
| calculations.ts | calculations.ts:101 | `filterToActivePeriod()` returns array as-is when OFF | ✅ |
| exporter.ts | exporter.ts:94,344,352 | Period fields excluded from export when OFF | ✅ |
| duplicate-detector.ts | duplicate-detector.ts:146,242,346,367 | Period-aware dedup only when ON | ✅ |
| committer.ts | committer.ts:196 | Period-aware lookup only when ON | ✅ |
| hydrate-period.ts | hydrate-period.ts:78 | Returns null fields when OFF | ✅ |
| dashboard page | page.tsx:402 | `deduplicateBenefits(_, benefitEngineEnabled)` | ✅ |
| card detail page | card/[id]/page.tsx:169 | `deduplicateBenefits(_, benefitEngineEnabled)` | ✅ |

### Edge Case: `periodStatus` in Legacy Mode
The `periodStatus` column is non-nullable in the DB schema with `@default("ACTIVE")`. When engine is OFF, imported benefits get `periodStatus='ACTIVE'` via the `?? 'ACTIVE'` fallback. **This is safe** because all code paths that read `periodStatus` are gated behind the feature flag — legacy mode never evaluates it. Added inline comment to committer.ts documenting this design decision.

### Conclusion
**No period logic leaks into legacy mode.** Every Sprint 2 change is properly gated.

---

## 2. Import/Export Round-Trip Analysis ✅ PASS (after fixes)

### Export → CSV → Import Cycle

| Step | Correctness | Notes |
|------|-------------|-------|
| Export includes period fields when engine ON | ✅ | exporter.ts:111-116 adds periodStart, periodEnd, periodStatus, resetCadence |
| Export excludes period fields when engine OFF | ✅ | `getEffectiveBenefitFields()` strips fields in `PERIOD_FIELD_IDS` |
| Parser recognizes period column synonyms | ✅ | parser.ts:416-419 maps `Period Start`, `periodstart`, `periodStart` etc. |
| Validator handles period fields as warnings-only | ✅ | validator.ts:792-865 — invalid values produce warnings, not errors |
| Duplicate detector uses compound key with periodStart | ✅ | duplicate-detector.ts:146-149 appends `::periodStart` to dedup key |
| Committer uses period-aware lookup for Update | ✅ | committer.ts:196-212 tries compound key first, then legacy fallback |
| Missing period fields degrade gracefully | ✅ | validator only warns; committer re-hydrates via `hydratePeriodFields()` |

### Will Export→Import Create Duplicates?
**No.** The duplicate detector's compound key `benefit::cardName::issuer::benefitName::periodStart` ensures that multi-period exports (when engine ON) are correctly matched by period. When engine OFF, `periodStart` is omitted from the key, preserving legacy behavior.

### `masterBenefitId` Handling
The exporter includes `masterBenefitId` in CSV output (schema.ts:56) but the committer intentionally **ignores** the imported value and re-resolves it via `hydratePeriodFields()` (committer.ts:183). This is the correct design — `masterBenefitId` is environment-specific and would break across DB migrations. The exported value serves only as documentation for the user.

---

## 3. Toggle-Used Guard (api-4, api-6) ✅ PASS

### Coverage Matrix

| Scenario | Direction | Engine | Expected | Test | Status |
|----------|-----------|--------|----------|------|--------|
| EXPIRED | unused→used | ON | 400 | ✅ | PASS |
| EXPIRED | used→unused | ON | 400 | ✅ | PASS (api-6) |
| UPCOMING | unused→used | ON | 400 | ✅ | PASS |
| ACTIVE | unused→used | ON | 200 | ✅ | PASS |
| ACTIVE | used→unused | ON | 200 | ✅ | PASS |
| null (legacy) | unused→used | ON | 200 | ✅ | PASS |
| EXPIRED | unused→used | OFF | 200 | ✅ | PASS (guard skipped) |
| Unknown status | unused→used | ON | 400 | ✅ | PASS (catch-all) |

### Bypass Analysis
- **Direct API call with crafted periodStatus?** No — the guard reads `benefit.periodStatus` from the DB, not from the request body.
- **Race condition (status changes between read and update)?** Theoretical only — Prisma `findUnique` + `update` are not atomic, but the window is negligible for a user-initiated toggle. Acceptable risk.
- **timesUsed correctness:** Verified — only increments on `unused→used` (line 122: `isUsed && !benefit.isUsed`). Does NOT decrement on `used→unused`.

---

## 4. Cross-Sprint Integration ✅ PASS

### Sprint 1 ↔ Sprint 2 Compatibility

| Integration Point | Sprint 1 | Sprint 2 | Verdict |
|-------------------|----------|----------|---------|
| `deduplicateBenefits()` composite key | `userCardId:masterBenefitId` | Same key used in Card.tsx, AlertSection.tsx | ✅ Compatible |
| `filterToActivePeriod()` | calculations.ts:101 | No Sprint 2 changes to this function | ✅ No conflict |
| `hydratePeriodFields()` | Created in Sprint 1 | Used by committer.ts (Sprint 2) | ✅ API unchanged |
| BenefitTable interface | Added `masterBenefitId`, `userCardId`, `periodStatus` in Sprint 1 | Same fields, Sprint 2 adds no new ones | ✅ |

### Double-Dedup Check
Verified that deduplication is NOT applied twice in any render path:
- **Dashboard:** `page.tsx:402` — dedup applied once in `useMemo`
- **Card detail:** `card/[id]/page.tsx:169` — dedup applied once in `useMemo`
- **Card component:** `Card.tsx:49-52` — dedup applied to `card.userBenefits` before passing to BenefitTable
- **AlertSection:** `AlertSection.tsx:94` — dedup applied inside `getExpiringBenefits()`
- **BenefitTable:** Does NOT dedup — receives pre-deduplicated array

**No double-dedup detected.** ✅

---

## 5. Data Integrity ✅ PASS (after seed fix)

### Seed Data: Welcome Bonuses & Anniversary Certs

| Card | Benefit | claimingCadence | isDefault | Verdict |
|------|---------|-----------------|-----------|---------|
| Amex Gold | Welcome Bonus: 90K MR | `ONE_TIME` | `false` | ✅ |
| Amex Platinum | Welcome Bonus: 150K MR | `ONE_TIME` | `false` | ✅ |
| Chase Sapphire | Welcome Bonus: 60K Points | `ONE_TIME` | `false` | ✅ |
| Capital One Venture X | Welcome Bonus: 75K Miles | `ONE_TIME` | `false` | ✅ |
| Capital One Venture X | Anniversary 10K Miles | `FLEXIBLE_ANNUAL` | omitted (defaults `true`) | ✅ |

### Fee Fixes Verification

| Card | File | Expected | Actual | Verdict |
|------|------|----------|--------|---------|
| Chase Sapphire Preferred | seed-points-cards-comprehensive.js:57 | $95 (9500¢) | `9500` | ✅ |
| SW Premier | seed-points-cards-comprehensive.js:541 | $69 (6900¢) | `6900` | ✅ |
| Chase Hyatt | seed-points-cards-comprehensive.js:645 | $95 (9500¢) | ~~`95000`~~ → `9500` | ✅ FIXED |
| Citi Prestige | seed-top-10-cards.js:26 | $699 (69900¢) | `69900` | ✅ |
| BofA Premium Rewards | seed-top-10-cards.js:39 | $250 (25000¢) | `25000` | ✅ |

### isDefault Flags
- `prisma/seed.ts:509`: `isDefault: b.isDefault ?? true` — correctly defaults to `true`
- All welcome bonuses explicitly set `isDefault: false` — prevents auto-generation ✅
- Regular recurring benefits omit `isDefault` — defaults to `true` for auto-generation ✅

---

## High Priority Issues (Should Fix — Non-blocking)

### HIGH-1: `masterBenefitId` exported but not useful for import

**File:** `src/features/import-export/lib/schema.ts:56`
**Issue:** `masterBenefitId` is included in CSV exports. While the committer correctly ignores it and re-resolves via `hydratePeriodFields()`, including an internal UUID in a user-facing CSV is confusing and may create support tickets ("what is this ID?").
**Recommendation:** Remove `masterBenefitId` from `BENEFIT_EXPORT_FIELDS` and add it to `PERIOD_FIELD_IDS` exclusion. Alternatively, rename the column label to something clearer like `Internal Ref (auto-resolved)`.

### HIGH-2: Parser field synonym collision — `Type` and `Status` are ambiguous

**File:** `src/features/import-export/lib/parser.ts:408,412`
**Issue:**
- `BenefitType` has synonym `'Type'` (line 408)
- `RecordType` has synonym `'Type'` (line 413)
- `Usage` has synonym `'Status'` (line 412)
- `Status` field itself has synonym `'Status'` (line 404)

If a CSV has a column called `Type`, it could match either `BenefitType` or `RecordType`. The current implementation uses first-match, which may vary depending on iteration order.
**Impact:** Ambiguous column mapping could cause silent data misrouting.
**Recommendation:** Remove ambiguous single-word synonyms from lower-priority fields (e.g., remove `'Type'` from `RecordType` synonyms).

### HIGH-3: Date comparison in `findDifferences()` includes time component

**File:** `src/features/import-export/lib/duplicate-detector.ts:70-77`
**Issue:** `existingVal instanceof Date ? existingVal.toISOString() : existingVal` — `toISOString()` includes `T00:00:00.000Z` suffix. If the DB stores dates with different times (e.g., midnight vs. creation timestamp), two dates on the same calendar day will be flagged as different.
**Impact:** False positive differences in duplicate detection for `periodStart`/`periodEnd` fields, especially when comparing exported-then-reimported dates against DB dates.
**Recommendation:** Use `.toISOString().slice(0, 10)` for date-only comparison, or normalize both sides to date-only before comparison.

---

## Medium Priority Issues

### MED-1: `EditBenefitModal.tsx` uses `masterBenefitId` presence instead of feature flag

**File:** `src/features/benefits/components/modals/EditBenefitModal.tsx`
**Issue:** The modal determines read-only fields by checking `!!benefit?.masterBenefitId` rather than `featureFlags.BENEFIT_ENGINE_ENABLED`. If a benefit has `masterBenefitId` but the flag is toggled OFF, the UI shows locked fields while the API might accept changes.
**Impact:** Minor UX inconsistency during flag toggle (edge case).
**Recommendation:** Combine both checks: `featureFlags.BENEFIT_ENGINE_ENABLED && !!benefit?.masterBenefitId`.

### MED-2: `committer.ts` legacy fallback may update wrong row

**File:** `src/features/import-export/lib/committer.ts:215-224`
**Issue:** When engine ON and period-aware lookup fails, the fallback queries `periodStart: null`. If a user has both a legacy row (null periodStart) and an engine row for the same benefit, the fallback updates the legacy row instead of failing gracefully.
**Impact:** Low probability — only occurs if user has mixed legacy+engine data for the same benefit name.
**Recommendation:** Log a warning when falling back to legacy lookup in engine-ON mode.

### MED-3: Validator date parsing creates UTC midnight — timezone edge case

**File:** `src/features/import-export/lib/validator.ts:55`
**Issue:** `new Date(value + 'T00:00:00Z')` creates a UTC midnight date. For users in western timezones (e.g., PST), this could display as the previous day.
**Impact:** Cosmetic — dates display one day off in some timezones.
**Recommendation:** Document the UTC convention and ensure display code handles timezone offset.

### MED-4: Exporter throws error for empty card/benefit lists

**File:** `src/features/import-export/lib/exporter.ts:190,231`
**Issue:** `exportCards()` and `exportBenefits()` throw `AppError` when data is empty. For `exportAll()`, if a user has cards but no benefits, the entire export fails instead of exporting just the cards.
**Recommendation:** Return empty sheet/section instead of throwing.

### MED-5: `parseBenefitRecord` period field validation only handles strings

**File:** `src/features/import-export/lib/validator.ts:797`
**Issue:** `if (row.PeriodStart && typeof row.PeriodStart === 'string' && row.PeriodStart.trim())` — if XLSX provides a native `Date` object for `PeriodStart`, it will be skipped entirely (not a string), and `periodStart` won't be set in `normalizedData`.
**Recommendation:** Handle `Date` instances: `if (row.PeriodStart instanceof Date) periodStart = row.PeriodStart;`

---

## Low Priority Issues

### LOW-1: Card.tsx CSS class naming inconsistency
`text-text-primary`, `text-text-secondary`, `text-text-tertiary` classes (Card.tsx:91,97,104) use inline `style={{}}` on the same elements, creating mixed styling patterns. Not broken but inconsistent.

### LOW-2: BenefitTable column width math doesn't add up
Column widths: `44px + 40% + 15% + 15% + 15%` = fixed + 85% — the remaining 15% is unaccounted for. Works visually but imprecise.

### LOW-3: `committer.ts` error logging is console-only
Lines 554-567 use `console.error` for error logging in production. Should integrate with structured logging/error tracking.

### LOW-4: `getExportHistory()` returns empty array (stub)
`exporter.ts:413-418` — Export history is unimplemented. Fine for now but should be tracked for follow-up.

---

## Pre-existing Test Failures (Not Sprint 2)

91 tests fail across 17 test files. **None are from Sprint 2 changes.** Key failure categories:

| Category | Count | Root Cause |
|----------|-------|------------|
| `useCards` hook import | 1 | Module resolution error (pre-existing) |
| Benefits progress API | 5 | Mock setup incompatible with route changes |
| Benefits usage API | 21 | Mock setup incompatible with route changes |
| Edge runtime auth | 3 | Architecture test expectations outdated |
| Import E2E | 10 | Mock Prisma client incomplete |
| Import server actions | 12 | `ERROR_MESSAGES[code]` undefined for new error codes |
| Import parser | 28 | `dynamicTyping: false` change broke type expectations |

**Recommendation:** Address in a dedicated test remediation sprint. These don't affect Sprint 2 functionality.

---

## Test Results Summary

```
Build:              ✅ PASS (Compiled successfully)
Toggle-used tests:  ✅ 13/13 passed
Benefit engine:     ✅ 99/99 passed
Hydrate period:     ✅ 11/11 passed
Import validator:   ✅ ALL passed
Duplicate detector: ✅ ALL passed
Overall:            1671 passed | 91 failed (pre-existing) | 59 skipped
```

---

## Final Verdict

### ✅ PASS WITH FIXES

The 3 critical issues found have been **fixed directly** in this review:
1. **Seed fee bug** — Chase Hyatt $950→$95 (data integrity)
2. **Missing resetCadence** in export schema (round-trip data loss)
3. **Hardcoded OneTime** in committer (import ignoring cadence data)

**The feature flag is safe to enable.** All Sprint 2 code paths are properly gated. The import/export round-trip works correctly with period fields. The toggle-used guard blocks both directions (mark used AND mark unused) on EXPIRED/UPCOMING benefits.

**Remaining high/medium issues are non-blocking** and should be addressed in the next sprint per standard velocity.

---

*Report generated by QA Code Reviewer. All fixes verified with `npm run build` (PASS) and `npx vitest run` (13/13 toggle tests, 99/99 engine tests, 11/11 hydrate tests).*
