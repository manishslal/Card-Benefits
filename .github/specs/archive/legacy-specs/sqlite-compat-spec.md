# SQLite Compatibility Fix — `mode: 'insensitive'` Removal

**Spec version:** 1.0  
**Date:** 2025-07-14  
**Status:** Ready for implementation  
**Affected file:** `src/lib/prisma.ts`

---

## 1. Problem Statement

### What breaks

The project has migrated from PostgreSQL to SQLite for local development. The function `searchMasterCards` in `src/lib/prisma.ts` passes `mode: 'insensitive'` inside two Prisma `contains` filter clauses:

```ts
where: {
  ...(issuer && { issuer: { contains: issuer, mode: 'insensitive' } }),
  ...(cardName && { cardName: { contains: cardName, mode: 'insensitive' } }),
},
```

### Why it breaks

`mode: 'insensitive'` is a **PostgreSQL-only Prisma query option**. When Prisma targets a SQLite data source, it performs schema-level validation of the query at runtime and rejects any query that contains `mode: 'insensitive'`. This throws a Prisma validation error before the query is ever sent to the database:

```
PrismaClientValidationError: Argument `mode` is not supported for SQLite.
```

The error is not a degraded-result problem — the entire query call throws, meaning any UI surface that calls `searchMasterCards` will fail completely whenever a non-empty `issuer` or `cardName` filter is supplied.

---

## 2. Proposed Solution

### Change

Remove the `mode: 'insensitive'` property from both `contains` filter objects inside `searchMasterCards`. No other logic changes are required.

### Why this is safe for SQLite

SQLite's built-in `LIKE` operator (which Prisma's `contains` translates to under the hood) is **case-insensitive for ASCII characters by default**. This means searches for `"american express"`, `"American Express"`, or `"AMERICAN EXPRESS"` will all match the same rows without any extra handling, preserving the intended search behaviour for the ASCII card names and issuer strings stored in this dataset.

> **Note — SQLite ASCII-only caveat:** SQLite's default case-insensitivity applies only to ASCII characters (A–Z / a–z). Unicode characters (e.g. accented letters, CJK characters) are treated case-sensitively unless a custom ICU collation or a SQLite extension is loaded. Because the card names and issuer names in this dataset are ASCII-only, this limitation has no practical impact and requires no additional handling at this time.

---

## 3. Files to Change

| File | Change type |
|---|---|
| `src/lib/prisma.ts` | Remove `mode: 'insensitive'` from two Prisma filter objects |

No schema changes, no migration, no new dependencies.

---

## 4. Exact Code Change

### Before

```ts
async searchMasterCards(issuer?: string, cardName?: string) {
  return prisma.masterCard.findMany({
    where: {
      ...(issuer && { issuer: { contains: issuer, mode: 'insensitive' } }),
      ...(cardName && { cardName: { contains: cardName, mode: 'insensitive' } }),
    },
    include: { masterBenefits: true },
  });
},
```

### After

```ts
async searchMasterCards(issuer?: string, cardName?: string) {
  return prisma.masterCard.findMany({
    where: {
      ...(issuer && { issuer: { contains: issuer } }),
      ...(cardName && { cardName: { contains: cardName } }),
    },
    include: { masterBenefits: true },
  });
},
```

### Diff

```diff
  async searchMasterCards(issuer?: string, cardName?: string) {
    return prisma.masterCard.findMany({
      where: {
-       ...(issuer && { issuer: { contains: issuer, mode: 'insensitive' } }),
-       ...(cardName && { cardName: { contains: cardName, mode: 'insensitive' } }),
+       ...(issuer && { issuer: { contains: issuer } }),
+       ...(cardName && { cardName: { contains: cardName } }),
      },
      include: { masterBenefits: true },
    });
  },
```

---

## 5. Edge Cases

### 5a. Future migration back to PostgreSQL

If the project switches back to PostgreSQL (or any other Prisma provider that supports `mode`), the `mode: 'insensitive'` option **should be re-added** to both `contains` clauses. Without it, PostgreSQL's `LIKE` operator is case-sensitive by default — searches for `"american express"` would **not** match a stored value of `"American Express"`, silently returning fewer or zero results.

**Recommended action when returning to PostgreSQL:**  
Restore both `mode: 'insensitive'` properties and add a comment referencing this spec so future developers understand why the property is necessary.

```ts
// PostgreSQL requires mode: 'insensitive' for case-insensitive LIKE.
// SQLite handles ASCII case-insensitivity natively; see .github/specs/sqlite-compat-spec.md.
...(issuer && { issuer: { contains: issuer, mode: 'insensitive' } }),
...(cardName && { cardName: { contains: cardName, mode: 'insensitive' } }),
```

### 5b. Both filters undefined / empty string

When both `issuer` and `cardName` are `undefined` (or empty strings that evaluate to falsy), the spread operators produce no `where` conditions, and the query returns all `masterCard` rows. This is the correct "no filter" behaviour.

> **Important:** An empty string `""` evaluates to falsy in JavaScript, so it is silently ignored — the same as `undefined`. This is consistent with the original intent but should be understood by callers: passing `""` is not the same as passing a literal empty-string search.

### 5c. Very long or special-character search strings

Prisma escapes values passed to `contains` before handing them to SQLite. SQL injection through the filter values is not a concern. However, if a caller passes a string containing SQLite `LIKE` wildcards (`%`, `_`), Prisma's `contains` wraps the value in `%…%` and does **not** escape internal wildcards, meaning a search for `"Chase%"` may behave unexpectedly. This is a pre-existing behaviour unchanged by this fix; callers should sanitise or reject wildcard characters if strict literal matching is required.

### 5d. Unicode / non-ASCII card names or issuers

As noted in Section 2, SQLite's case-insensitivity does not extend to non-ASCII characters. If non-ASCII issuer or card names are introduced in the future, the search function will behave case-sensitively for those characters. Mitigations at that point could include: normalising values to lowercase before insert (and lowercasing the search term at query time), or enabling the ICU SQLite extension. No action is required now.

### 5e. Concurrent calls / race conditions

`searchMasterCards` is a read-only query with no side effects. No concurrency or race condition concerns apply.

---

## 6. Test Cases

The following manual test cases should be verified by the QA agent against the running SQLite-backed application after the fix is applied.

---

### TC-01 — No filters returns all cards

**Steps:**
1. Call `searchMasterCards()` with no arguments (or `undefined, undefined`).

**Expected result:**
- Returns an array containing every row in the `masterCard` table.
- Each result includes the nested `masterBenefits` array.
- No error is thrown.

---

### TC-02 — Issuer search is case-insensitive (ASCII)

**Steps:**
1. Confirm at least one `masterCard` row exists with `issuer = "American Express"` (exact casing stored in DB).
2. Call `searchMasterCards("american express")` (all lowercase).
3. Call `searchMasterCards("AMERICAN EXPRESS")` (all uppercase).
4. Call `searchMasterCards("American Express")` (mixed case, exact match).

**Expected result:**
- All three calls return the same set of rows — all cards from the "American Express" issuer.
- No `PrismaClientValidationError` or any other error is thrown.

---

### TC-03 — Card name partial-string search

**Steps:**
1. Confirm at least one `masterCard` row exists whose `cardName` contains the substring `"Sapphire"` (e.g., `"Chase Sapphire Preferred"`).
2. Call `searchMasterCards(undefined, "sapphire")` (lowercase partial).
3. Call `searchMasterCards(undefined, "SAPPHIRE")` (uppercase partial).

**Expected result:**
- Both calls return all cards whose `cardName` contains `"sapphire"` (case-insensitive for ASCII).
- Results include the nested `masterBenefits` array.
- No error is thrown.

---

### TC-04 — Both filters combined

**Steps:**
1. Call `searchMasterCards("chase", "sapphire")`.

**Expected result:**
- Returns only cards where `issuer` contains `"chase"` **and** `cardName` contains `"sapphire"` (both conditions applied simultaneously, case-insensitive for ASCII).
- Cards from other issuers are excluded even if their `cardName` contains `"sapphire"`.
- No error is thrown.

---

### TC-05 — Undefined / empty filters behave as "no filter"

**Steps:**
1. Call `searchMasterCards(undefined, undefined)`.
2. Call `searchMasterCards("", "")`.

**Expected result:**
- Both calls return all cards (same result as TC-01).
- Empty string arguments are treated as absent filters — no empty-string `LIKE` clause is applied.
- No error is thrown.

---

## 7. Out of Scope

The following are explicitly **not** part of this fix:

- Changes to the Prisma schema (`prisma/schema.prisma`)
- Database migrations
- Changes to any API route, server action, or UI component
- Adding Unicode case-insensitivity support
- Replacing Prisma with raw SQL

---

## 8. Implementation Notes for the Engineer

- The change is **two lines** in a single file.
- No new imports or exports are needed.
- TypeScript types are unaffected — removing `mode` from the filter object is valid because `mode` is optional in Prisma's `StringFilter` type.
- After applying the change, restart the dev server and run through TC-01 through TC-05 above to confirm no regression.
