# QA Code Review: Database Pipeline Audit Fixes

**Reviewer:** QA Automation Engineer (automated review)
**Date:** 2025-07-15
**Scope:** 10 files modified during the 32-finding multi-agent audit fix cycle
**Test Results:** 1381 passing, 51 pre-existing failures (unrelated), 0 regressions

---

## Executive Summary

**Overall assessment:** The audit fixes are **production-ready** with minor observations. The 6 confirmed bug fixes are correctly implemented, the migration is sound, and the automated-agent-modified files show no regressions or suspicious changes.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 3 |

**Verdict:** ✅ Ready for production. The one high-priority item is a gap in error tracking (not a data-loss risk). All SQL queries reference valid columns, the migration follows existing patterns, and no security issues were found.

---

## Critical Issues

**None found.**

---

## High Priority Issues

### H1. `cover_letter_error` column is defined but never written to

**Location:** `src/applypilot/scoring/cover_letter.py` lines 501–520
**What's wrong:** Migration v14 and `_ALL_COLUMNS` both add `cover_letter_error TEXT`, and the migration docstring says it's "consistent with the tailor_error pattern." However, the cover letter generation code never writes to this column:

- **On success** (line 505–511): Sets `cover_letter_path`, `cover_letter_at`, increments `cover_attempts`. Does NOT clear `cover_letter_error=NULL`.
- **On failure** (line 515–520): Only increments `cover_attempts`. Does NOT set `cover_letter_error=?`.

Compare with the tailor pattern (tailor.py lines 588–599):
```python
# SUCCESS: clears error
"UPDATE jobs SET tailored_resume_path=?, tailored_at=?, tailor_error=NULL WHERE url=?"

# FAILURE: records error
"UPDATE jobs SET tailor_attempts=COALESCE(tailor_attempts,0)+1, tailor_error=? WHERE url=?"
```

**Impact:** The `cover_letter_error` column will always be `NULL` for every job, making cover letter error diagnostics impossible. The column exists but provides zero value.

**How to fix:** Update the cover letter DB persistence block to match the tailor pattern:
- Success UPDATE: add `cover_letter_error=NULL`
- Failure UPDATE: add `cover_letter_error=?` with `r.get("error", "unknown_error")`

---

## Medium Priority Issues

### M1. `cover_letter.py` success path increments `cover_attempts` (inconsistent with tailor pattern)

**Location:** `src/applypilot/scoring/cover_letter.py` line 507
**What's wrong:** The cover letter success path increments `cover_attempts`:

```sql
UPDATE jobs SET cover_letter_path=?, cover_letter_at=?,
    cover_attempts=COALESCE(cover_attempts,0)+1 WHERE url=?
```

But the tailor success path (tailor.py line 590–593) does **not** increment `tailor_attempts`:
```sql
UPDATE jobs SET tailored_resume_path=?, tailored_at=?,
    tailor_error=NULL WHERE url=?
```

Both stages use the same retry-gating pattern (`COALESCE(attempts, 0) < 5`), but cover letters "waste" retry budget on successes while tailor does not.

**Impact:** A job that succeeds on attempt 3 for cover letter generation will have `cover_attempts=3`, leaving only 2 retries if the cover letter path is later cleared and needs regeneration. This is functionally harmless in normal operation (successful jobs have `cover_letter_path IS NOT NULL` so they won't be re-selected), but it's an inconsistency that could cause confusion during debugging or manual re-processing.

**Suggested fix:** Remove `cover_attempts` increment from the success path to match the tailor pattern. Or document the design difference if intentional.

### M2. Streaming-mode pending count for `cover` stage requires tailored resume

**Location:** `src/applypilot/pipeline.py` line 245–249 vs `src/applypilot/database.py` line 670–675
**What's wrong:** Two different definitions of "pending cover" work:

| Source | Requires tailored resume? | Requires fit_score ≥ 7? | Requires scored_at? |
|--------|--------------------------|------------------------|---------------------|
| `pipeline.py` `_PENDING_SQL["cover"]` | ✅ `tailored_resume_path IS NOT NULL` | ❌ | ❌ |
| `database.py` `conditions["pending_cover"]` | ❌ | ✅ `fit_score >= 7` | ✅ `scored_at IS NOT NULL` |

The pipeline design explicitly states cover depends on score, not tailor (`_UPSTREAM["cover"] = "score"`). The actual job fetching (`get_jobs_by_stage(stage="pending_cover")`) uses the database.py definition, which is correct. But the streaming-mode progress counter in pipeline.py will undercount pending cover work for scored-but-not-tailored jobs.

**Impact:** In streaming mode, the cover stage counter may show 0 pending when there are actually eligible jobs. The stage will still process them correctly when it runs, so this is a cosmetic/diagnostic issue, not a data correctness issue.

**Suggested fix:** Align `_PENDING_SQL["cover"]` with the `pending_cover` condition in database.py.

---

## Low Priority Issues

### L1. TOCTOU pattern in `reactivate_batch()` and `deactivate_batch()`

**Location:** `src/applypilot/enrichment/batch_manager.py` lines 291–322 and 342–373
**What's wrong:** Both functions do SELECT COUNT then UPDATE, returning the SELECT count rather than `cursor.rowcount` from the UPDATE:

```python
cursor = conn.execute("SELECT COUNT(*) FROM jobs WHERE ...")
count = cursor.fetchone()[0]
if count == 0:
    return 0
conn.execute("UPDATE jobs SET is_active = ... WHERE ...")
conn.commit()
return count  # ← This is the SELECT count, not the actual rows updated
```

Between the SELECT and UPDATE, another thread could modify rows, causing the returned count to differ from actual updates.

**Impact:** Minimal in practice. SQLite's journal-mode locking and the fact that these are manual admin operations make concurrent modification extremely unlikely. The count is used only for logging.

**Suggested fix:** Use `cursor.rowcount` from the UPDATE instead of the SELECT count, and eliminate the early-return SELECT entirely.

### L2. `store_jobs()` INSERT references `date_posted` not in CREATE TABLE

**Location:** `src/applypilot/database.py` line 620 (INSERT) vs lines 268–306 (CREATE TABLE)
**What's wrong:** The `CREATE TABLE IF NOT EXISTS jobs` statement does not include `date_posted`, but `store_jobs()` INSERTs into it. The column exists in `_ALL_COLUMNS` and is added by `ensure_columns()` which runs during `init_db()`.

**Impact:** None in practice — `ensure_columns()` always runs before any data operations, so the column will exist. But the schema definition is split across two locations (CREATE TABLE for the original columns, `_ALL_COLUMNS` for everything), which can confuse code readers.

**Suggested fix:** No action needed. This is a documentation/readability concern only. If desired, add `date_posted TEXT` to the CREATE TABLE for clarity.

### L3. `approved_with_judge_warning` not explicitly checked in cover letter success path

**Location:** `src/applypilot/scoring/cover_letter.py` line 502
**What's wrong:** The cover letter success check is `if r.get("path")` (truthy path string), while the tailor stage explicitly checks `{"approved", "approved_with_judge_warning"}` statuses (tailor.py line 587–589). The cover letter approach works correctly because successful generation always produces a non-empty path, but it relies on an implicit contract rather than explicit status checking.

**Impact:** None currently. The implicit check is equivalent to the explicit check for all existing code paths. But if a future code change produces a result with `path=None` and a non-error status, the behavior would diverge.

---

## Specification Alignment Analysis

### ✅ `store_jobs()` — Explicit `is_active=1, is_duplicate=0` (database.py lines 619–624)

**Correct.** Newly discovered jobs should always be active and non-duplicate. Previously, these defaulted via column defaults, but explicit setting is more defensive and avoids reliance on `DEFAULT` constraints which may not apply during certain INSERT patterns.

### ✅ `tailor_attempts` — Only incremented on failure (tailor.py lines 588–599)

**Correct.** The `pending_tailor` filter uses `tailored_resume_path IS NULL AND COALESCE(tailor_attempts, 0) < 5`. Since successful jobs get `tailored_resume_path` set (non-NULL), they will never be re-selected regardless of attempts count. Not incrementing on success is both logically correct and preserves retry budget for manual re-processing scenarios.

### ✅ `_migration_v14` — `cover_letter_error` column (db_migrations.py lines 887–899)

**Correct.** The migration:
- Uses idempotent PRAGMA check before ALTER TABLE ✅
- Follows the exact pattern of other migrations ✅
- Is registered in `_MIGRATIONS` list at position 14 ✅
- `CURRENT_SCHEMA_VERSION` is bumped to 14 ✅
- Column is also in `_ALL_COLUMNS` for new database creation ✅

### ✅ `_migration_v12` rename (db_migrations.py line 612)

**Correct.** The function is now `_migration_v12` (was `_migration_v12a`). The `_MIGRATIONS` list references it correctly at index 12. The migration content (CREATE VIEW IF NOT EXISTS jobs_primary) is unchanged.

### ✅ `detail.py` fallback error handlers (detail.py lines 914–948)

**Correct.** Two fallback error handlers are properly implemented:
1. **Partial write fallback** (line 914–921): Sets `detail_error='partial_write_failed'` when the main enrichment UPDATE succeeds but a subsequent step fails. This prevents the job from being retried (has `detail_scraped_at` set).
2. **Full error fallback** (line 938–948): Sets `detail_error=str(e)[:500]` when even the error-recording UPDATE fails. The 500-char truncation prevents TEXT column overflow and is consistent with other error recording patterns.

### ✅ `batch_manager.py` — No bad column references

**Correct.** All three functions verified clean:
- `supersede_old_batches()`: References only `is_active`, `site`, `enrichment_batch_id`, `applied_at`, `is_duplicate` — all exist ✅
- `reactivate_batch()`: References only `enrichment_batch_id`, `is_active`, `applied_at`, `is_duplicate` — all exist ✅
- `deactivate_batch()`: References only `enrichment_batch_id`, `is_active`, `applied_at`, `is_duplicate` — all exist ✅

No references to removed `skipped_reason` column or invalid `enrichment_batch_id=NULL` patterns. ✅

### ✅ Automated-agent-modified files — No suspicious changes

All 5 automated-agent-modified files reviewed for injection, backdoors, or regressions:

| File | Status | Notes |
|------|--------|-------|
| `apply/launcher.py` | ✅ Clean | SQL queries use parameterized `?`, no hardcoded credentials, `_db_retry` pattern is sound |
| `pipeline.py` | ✅ Clean | Stage runners properly structured, error handling is consistent |
| `scoring/cover_letter.py` | ✅ Clean (see H1, M1) | Functional but missing `cover_letter_error` usage |
| `scoring/scorer.py` | ✅ Clean | Multi-criteria scoring logic is correct, proper use of `ScoreData` |
| `enrichment/consolidate.py` | ✅ Clean | PRIMARY-WINS strategy correctly implemented, proper idempotency |

---

## Security Review

| Check | Result |
|-------|--------|
| SQL injection | ✅ All dynamic queries use `?` parameter placeholders. The `where` variable in `get_jobs_by_stage()` is built from hardcoded condition strings, not user input (documented at line 716). |
| Error message exposure | ✅ Error strings are truncated (`[:500]`, `[:200]`, `[:100]`) before storage, preventing oversized writes. |
| Database locking | ✅ `BEGIN IMMEDIATE` used for critical atomic operations (consolidation, job acquisition). |
| Thread safety | ✅ Thread-local connections via `threading.local()`. ThreadPoolExecutor workers use separate DB connections. |
| Credential leakage | ✅ No credentials, API keys, or secrets found in any modified file. |
| f-string in SQL | ⚠️ `list_recent_batches()` (batch_manager.py line 230) uses `f"...IN ({placeholders})..."` but `placeholders` is built from `",".join(["?"] * len(batch_ids))` so this is safe — it's parameterized placeholder construction, not value interpolation. |

---

## Test Coverage Recommendations

### Priority 1: Validate the `cover_letter_error` fix (when H1 is addressed)

```
Test: After cover letter generation fails, verify cover_letter_error IS NOT NULL
Test: After cover letter generation succeeds, verify cover_letter_error IS NULL
Test: Verify cover_letter_error is truncated to reasonable length
```

### Priority 2: `store_jobs()` explicit defaults

```
Test: Insert a job via store_jobs(), verify is_active=1 and is_duplicate=0
Test: Insert duplicate URL, verify IntegrityError is caught and existing row unchanged
Test: Verify returned counts (new_count, duplicate_count) are accurate
```

### Priority 3: `tailor_attempts` counter behavior

```
Test: After successful tailor, verify tailor_attempts is NOT incremented
Test: After failed tailor, verify tailor_attempts IS incremented by 1
Test: After 5 failures, verify job is no longer selected by pending_tailor query
Test: After success, verify tailor_error is cleared to NULL
```

### Priority 4: Migration v14 idempotency

```
Test: Run _migration_v14 on a fresh DB (column doesn't exist) — should add it
Test: Run _migration_v14 twice — second run should be a no-op
Test: Verify CURRENT_SCHEMA_VERSION == 14
Test: Verify _MIGRATIONS list has exactly 14 entries
```

### Priority 5: Batch manager column safety

```
Test: Call supersede_old_batches() — should not raise OperationalError
Test: Call reactivate_batch() — should not raise OperationalError
Test: Call deactivate_batch() — should not raise OperationalError
Test: Verify no SQL references to skipped_reason column in batch_manager.py
```

### Priority 6: Detail enrichment error paths

```
Test: Simulate main UPDATE failure → verify fallback sets detail_error='partial_write_failed'
Test: Simulate both UPDATE failures → verify second fallback sets detail_error=str(e)[:500]
Test: Verify detail_scraped_at is always set (prevents infinite retry)
```

---

## Summary of All Findings

| ID | Severity | File | Description | Action |
|----|----------|------|-------------|--------|
| H1 | High | cover_letter.py | `cover_letter_error` column never written to | Fix: add SET/CLEAR in success/failure UPDATEs |
| M1 | Medium | cover_letter.py | Success path increments `cover_attempts` (inconsistent with tailor) | Consider aligning with tailor pattern |
| M2 | Medium | pipeline.py | Streaming pending count for cover requires tailored_resume | Align with database.py pending_cover definition |
| L1 | Low | batch_manager.py | TOCTOU in reactivate/deactivate (SELECT then UPDATE) | Use UPDATE rowcount instead |
| L2 | Low | database.py | `date_posted` in INSERT but not CREATE TABLE | Documentation only |
| L3 | Low | cover_letter.py | Implicit success check via path truthiness | Document the design choice |

**Bottom line:** The 6 confirmed bug fixes are well-implemented. The migration is sound. No regressions detected. The one actionable item (H1) is a gap in error tracking that should be addressed before production monitoring relies on `cover_letter_error`.
