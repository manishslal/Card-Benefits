# DB Pipeline Audit Fixes — Technical Specification

## Problem Statement

A multi-agent audit of all ApplyPilot pipeline stages (discover → enrich → score → tailor → cover → apply) identified **10 critical** and **11 high** severity bugs where database tables are not correctly setting values, not clearing error states on retry, missing crash-recovery resets, and returning incorrect job sets due to broken stage filters.

## Scope

Fix all 10 CRITICAL and 11 HIGH severity findings across 8 source files. Do **not** touch PDF, devops configs, or Phase 4 (`job_details` schema migration — it is intentionally disabled).

---

## File-by-File Fixes

### 1. `src/applypilot/database.py`

#### 1a. Remove non-existent columns from `get_jobs_by_stage()` JOIN SELECT
- **Bug F28**: The JOIN SELECT query references `jobs.id` and `jobs.is_valid` — neither column exists in the `jobs` table schema (the PK column is `url`, not `id`; `is_valid` was never added).
- **Fix**: Remove `jobs.id` and `jobs.is_valid` from the SELECT list in `get_jobs_by_stage()`.

#### 1b. Add crash-recovery resets to `init_db()`
- **Bug F29 + F2**: After migrations run, there is no startup reset for `scoring_in_progress`. Jobs that were being scored when the process crashed are permanently stuck.
- **Bug F1** (partial): Similarly, `apply_status = 'in_progress'` is never reset on startup.
- **Fix**: At the end of `init_db()` after migrations, execute:
  ```sql
  UPDATE jobs SET scoring_in_progress = 0 WHERE scoring_in_progress = 1
  UPDATE jobs SET apply_status = NULL WHERE apply_status = 'in_progress'
  ```

#### 1c. Reset `scoring_in_progress` in `save_score_data()`
- **Bug F21**: `save_score_data()` writes all score columns but **never** sets `scoring_in_progress = 0`. After a successful score, the job stays locked forever.
- **Fix**: Add `scoring_in_progress = 0` to the UPDATE statement in `save_score_data()`.

#### 1d. Fix `discovered` stage filter
- **Bug F16**: The `discovered` stage filter condition is `"1=1"` — it returns **all** jobs including inactive, errored, and duplicate ones.
- **Fix**: Replace with:
  ```sql
  is_active = 1 AND is_duplicate = 0 AND detail_fetched = 0 AND detail_error IS NULL
  ```

#### 1e. Fix `enriched` stage filter
- **Bug F17**: The `enriched` stage filter is missing `detail_error IS NULL` and `is_duplicate = 0` checks. Errored and duplicate jobs will be passed downstream to scoring.
- **Fix**: Add `AND detail_error IS NULL AND is_duplicate = 0` to the `enriched` condition.

#### 1f. Add `pending_cover` stage filter
- **Bug F4**: There is no `pending_cover` key in the stage filter dict. `cover_letter.py` works around this with a custom inline query, bypassing all the safeguards in `get_jobs_by_stage()`.
- **Fix**: Add a `pending_cover` entry:
  ```sql
  is_active = 1 AND is_duplicate = 0 AND fit_score >= 7
  AND (cover_letter_path IS NULL OR cover_letter_path = '')
  AND COALESCE(cover_attempts, 0) < 5
  AND scored_at IS NOT NULL
  ```
  Note: Do NOT add `AND tailored_resume_path IS NOT NULL` here — per `_UPSTREAM`, cover can run before tailor (cover depends on `score`, not `tailor`). The check in cover_letter.py (fix 4a) handles this separately.

#### 1g. Fix `pending_apply` stage filter
- **Bug F5**: The `pending_apply` filter is missing `is_duplicate = 0` and an `apply_status IS NULL` check. Duplicate jobs and already-in-progress jobs can be double-queued.
- **Fix**: Add `AND is_duplicate = 0 AND (apply_status IS NULL OR apply_status = 'failed')` to the condition.

#### 1h. Fix `store_jobs()` INSERT missing `date_posted`
- **Bug F14**: The `store_jobs()` INSERT statement does not include the `date_posted` column. This column is populated by jobspy but silently dropped.
- **Fix**: Add `date_posted` to the column list and `?` placeholder in the INSERT, passing `job.get("date_posted")` in the values tuple.

#### 1i. Fix `application_url` not COALESCEd in `get_jobs()` query
- **Bug F11 + F15**: `application_url` is written to `job_details` by jobspy, but `get_jobs()` only reads `jobs.application_url` (NULL for these rows). Add COALESCE:
  ```sql
  COALESCE(jobs.application_url, jd.application_url) AS application_url
  ```

#### 1j. Fix `cover_exhausted` stat
- **Bug F30**: `get_stats()` returns `stats["cover_exhausted"] = 0` hardcoded.
- **Fix**: Replace with a real query:
  ```sql
  SELECT COUNT(*) FROM jobs 
  WHERE is_duplicate = 0 AND is_active = 1 AND fit_score >= 7
  AND cover_letter_path IS NULL AND COALESCE(cover_attempts, 0) >= 5
  ```

---

### 2. `src/applypilot/scoring/scorer.py`

#### 2a. Add try-finally to reset `scoring_in_progress` on exception
- **Bug F22**: The scorer sets `scoring_in_progress = 1` via `set_scoring_in_progress()` but has no `try/finally` block. If scoring raises an exception, the job is permanently locked.
- **Fix**: Wrap the scoring logic in:
  ```python
  try:
      set_scoring_in_progress(conn, url, True)
      # ... existing scoring logic ...
      save_score_data(conn, url, score_data)
  except Exception:
      set_scoring_in_progress(conn, url, False)
      raise
  ```

---

### 3. `src/applypilot/scoring/tailor.py`

#### 3a. Clear `tailor_error` on success
- **Bug F23**: The success UPDATE does not clear `tailor_error`. A previously failed job that succeeds on retry keeps its old error message.
- **Fix**: Add `tailor_error = NULL` to the success UPDATE.

#### 3b. Populate `tailor_error` on failure
- **Bug F24** (HIGH): The failure UPDATE only increments `tailor_attempts` but never sets `tailor_error`. The column exists in the schema but is always NULL.
- **Fix**: Add `tailor_error = ?` to the failure UPDATE and pass the error message string.

---

### 4. `src/applypilot/scoring/cover_letter.py`

#### 4a. Fix cover query: add ordering guard but keep cover-before-tailor allowed
- **Bug F6**: The inline query does not check `tailored_resume_path IS NOT NULL`. Since `_UPSTREAM` intentionally allows cover to run before tailor, this is by design. However, the query should still respect `COALESCE(cover_attempts, 0) < 5` properly and use parameterised values.
- **Fix**: Ensure the existing custom query has the `COALESCE(cover_attempts, 0) < 5` condition. Do NOT add `tailored_resume_path IS NOT NULL` since that would break the intended pipeline design.
- **Also**: Refactor the custom query to use `get_jobs_by_stage("pending_cover", conn)` once that filter is added in fix 1f.

---

### 5. `src/applypilot/enrichment/detail.py`

#### 5a. Clear `detail_error` on successful enrichment retry
- **Bug F10**: Both success UPDATE paths (`_write_enrichment_result`) do not clear `detail_error`. A job that previously errored and is successfully re-enriched keeps its old error message.
- **Fix**: Add `detail_error = NULL` to both success UPDATE statements.

#### 5b. Skip enrichment writes for duplicate jobs
- **Bug F12**: When `is_duplicate = 1` is detected mid-enrichment, the code still writes `full_description`, `application_url`, etc. to the DB instead of skipping.
- **Fix**: After duplicate detection, skip the DB write and return early.

---

### 6. `src/applypilot/enrichment/consolidate.py`

#### 6a. Sync `full_description` and `application_url` when consolidating duplicates
- **Bug F13**: `consolidate_duplicates()` marks duplicates with `is_duplicate = 1` but never copies `full_description` or `application_url` from the primary (canonical) job to the duplicate record. Downstream stages that query duplicates expecting these fields will get NULLs.
- **Fix**: When setting `is_duplicate = 1`, also copy `full_description` and `application_url` from the primary job:
  ```sql
  UPDATE jobs SET is_duplicate = 1, 
    full_description = (SELECT full_description FROM jobs WHERE url = ?),
    application_url = COALESCE(application_url, (SELECT application_url FROM jobs WHERE url = ?))
  WHERE url = ?
  ```

---

### 7. `src/applypilot/pipeline.py`

#### 7a. Fix missing `AND` in cover pending SQL
- **Bug F7**: The pending count SQL for cover stage has a string concatenation that produces invalid SQL — a missing `AND` before `COALESCE(cover_attempts, 0) < 5`.
- **Fix**: Add the missing `AND` keyword in the f-string / string concatenation at line ~248.

---

### 8. `src/applypilot/apply/launcher.py`

#### 8a. Fix SQL injection in `mark_result()`
- **Bug F3**: The `attempts` variable is interpolated via f-string directly into SQL. Parameterise it.
- **Fix**: Replace `f"... attempts = {attempts} ..."` with `"... attempts = ? ..."` and pass `attempts` as a parameter.

#### 8b. Populate `apply_error_type` and `apply_error_at` on failure
- **Bug F18** (MEDIUM): The failure UPDATE sets `apply_status = 'failed'` but never populates `apply_error_type` or `apply_error_at` — both columns exist in the schema.
- **Fix**: Add `apply_error_type = ?` and `apply_error_at = CURRENT_TIMESTAMP` to the failure UPDATE.

---

## Out of Scope

- Phase 4 `job_details` migration (intentionally disabled — do not enable)
- `_migration_v12a` naming (cosmetic LOW severity — skip)
- Adding a new DB migration version for `cover_letter_error` column (defer to separate ticket)
- Changes to PDF stage, devops configs, or CLI entrypoints

## Testing

After implementation, run the existing test suite:
```bash
cd /Users/manishslal/Desktop/Coding-Projects/ApplyPilot
python -m pytest tests/ -v
```

All existing tests must pass. Fix any tests that break due to the changed INSERT/UPDATE signatures.
