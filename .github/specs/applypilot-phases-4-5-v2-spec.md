# ApplyPilot v2 - Phases 4-5: Error Handling, Logging, Notifications & Monitoring

## Executive Summary & Goals

Phases 4-5 transform ApplyPilot from a functional MVP into a production-grade system. Phase 4 implements robust error handling, structured logging, and token-efficient retries. Phase 5 adds operational visibility through notifications, health monitoring, and Docker support. Together, they enable autonomous, reliable job application at scale with transparent error reporting and alerting.

### Primary Objectives

- **Reliability**: Intelligent error classification and retry logic with exponential backoff
- **Observability**: Machine-parseable structured logs for debugging and alerting
- **Token Efficiency**: Batch mode, caching, and intelligent pre-scoring to reduce Claude API costs
- **Operational Transparency**: Real-time notifications of applications and failures
- **Production Readiness**: Docker containerization, health checks, and monitoring endpoints
- **Autonomous Operation**: System runs without user intervention; users informed of results via Slack/email

### Success Criteria

- 95%+ uptime for scheduled polls with automatic error recovery
- Structured JSON logs enable instant troubleshooting (0 manual parsing required)
- Batch mode reduces token usage by 40-50% vs. per-job processing
- Slack/email notifications keep users informed without overwhelming (max 1 notification per 5 minutes)
- Docker deployment with health endpoint (HTTP 8000) for container orchestration
- Complete audit trail: every application attempt logged with success/failure reason
- System recovers from Claude API failures, rate limits, and network interruptions

---

## Current State Analysis

### **Phase 3 Foundation**

✅ Scheduled polling (cron/Task Scheduler)  
✅ Website registry (50+ job boards)  
✅ Credential management (shared + site-specific)  
✅ Poll orchestrator (6-stage pipeline)  
✅ Database schema v1 (job tracking, poll history)

### **What's Missing (Phases 4-5)**

❌ Error classification and recovery  
❌ Comprehensive structured logging  
❌ Token-efficient batch processing  
❌ Notifications (Slack/Email)  
❌ Health monitoring and status command  
❌ Docker containerization  
❌ Rate limit recovery (HTTP 429, CAPTCHA backoff)  
❌ Application audit trail  

---

## Database Schema Optimization

### **Core Problem: Bloated Schema**

Current `jobs` table likely contains 30+ columns with redundant tracking:
- Intermediate state fields (score_calculated, resume_tailored, cover_letter_generated)
- Optional data (salary, job_description full text)
- Duplicate timestamps (created_at, discovered_at, scored_at, tailored_at, cover_generated_at, applied_at)
- Rarely-used columns cluttering queries

**Impact**: Slow queries, high update frequency, maintenance burden.

### **Optimized Schema Design**

#### **1. JOBS Table (CORE - Lean & Query-Optimized)**

```sql
CREATE TABLE jobs (
  -- Identifiers
  id TEXT PRIMARY KEY,                    -- UUID
  url TEXT UNIQUE NOT NULL,               -- Job board URL (unique constraint)
  job_board_domain TEXT NOT NULL,         -- indeed.com, linkedin.com, etc.
  
  -- Basic Info (Required)
  title TEXT NOT NULL,                    -- Job title
  company TEXT NOT NULL,                  -- Company name
  location TEXT,                          -- City, State/Country (nullable)
  
  -- Discovery
  discovered_at TIMESTAMP NOT NULL,       -- When we found it
  source TEXT NOT NULL,                   -- Enum: 'indeed', 'linkedin', 'greenhouse', etc.
  
  -- Scoring & Fit
  fit_score INTEGER,                      -- 1-10 (nullable until scored)
  threshold_met BOOLEAN DEFAULT 0,        -- true if fit_score >= user's threshold
  
  -- Artifacts
  tailored_resume_path TEXT,              -- Path to tailored resume (nullable)
  cover_letter_path TEXT,                 -- Path to cover letter (nullable)
  
  -- Application Status
  apply_status TEXT NOT NULL DEFAULT 'new',  -- Enum: new, pending, applied, failed, skipped
  apply_attempts INTEGER DEFAULT 0,       -- Number of application attempts
  last_error TEXT,                        -- Brief error message (100 chars max)
  last_error_type TEXT,                   -- Enum: TRANSIENT, PERMANENT, FORM_ERROR, CAPTCHA, etc.
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_discovered_at (discovered_at),
  INDEX idx_apply_status (apply_status),
  INDEX idx_threshold_met_discovered (threshold_met, discovered_at),
  INDEX idx_job_board_domain (job_board_domain),
  UNIQUE INDEX idx_url_unique (url)
);
```

**Rationale:**
- No intermediate state fields (resume_tailored, cover_generated_at)—just final artifacts
- No duplicate timestamps; single source of truth: `discovered_at` + `updated_at`
- `apply_status` replaces 6 boolean columns (applied, failed, skipped, etc.)
- `fit_score` is nullable (scored later)
- Only 17 columns (vs. 30+), all directly queryable
- Indexes on query patterns: filtering by status, discovery time, domain

---

#### **2. JOB_DETAILS Table (SPARSE - Optional Enrichment)**

```sql
CREATE TABLE job_details (
  -- Identifiers
  job_id TEXT PRIMARY KEY,                -- FK to jobs.id
  
  -- Full Details (stored only if needed)
  full_description TEXT,                  -- Full job description (can be large)
  requirements TEXT,                      -- Requirements section
  benefits TEXT,                          -- Benefits section
  salary_min DECIMAL(10,2),               -- Min salary (nullable)
  salary_max DECIMAL(10,2),               -- Max salary (nullable)
  salary_currency TEXT,                   -- USD, EUR, etc.
  company_industry TEXT,                  -- Industry classification
  company_size TEXT,                      -- Enum: startup, small, mid, large
  
  -- Metadata
  scraped_at TIMESTAMP,                   -- When we fetched full details
  source_url TEXT,                        -- Where this data came from
  
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
```

**Rationale:**
- Full descriptions can be 5KB+ (bloats main table)
- Sparse table: populated only when user requests detailed history
- Optional enrichment; does not block application flow
- Easy to query jobs WITHOUT details if needed

---

#### **3. POLL_CYCLES Table (AUDIT & ANALYTICS)**

```sql
CREATE TABLE poll_cycles (
  -- Identifiers
  id TEXT PRIMARY KEY,                    -- UUID
  
  -- Timing
  started_at TIMESTAMP NOT NULL,          -- When poll began
  completed_at TIMESTAMP,                 -- When poll finished (nullable if in-progress)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress',  -- Enum: in_progress, completed, failed
  
  -- Results
  new_jobs_found INTEGER DEFAULT 0,       -- How many new jobs discovered
  jobs_scored INTEGER DEFAULT 0,          -- How many scored >= threshold
  jobs_applied INTEGER DEFAULT 0,         -- How many successfully applied
  jobs_failed INTEGER DEFAULT 0,          -- How many failed to apply
  jobs_skipped INTEGER DEFAULT 0,         -- How many skipped (CAPTCHA, etc.)
  
  -- Error Tracking
  error_type TEXT,                        -- Enum: DISCOVERY_FAILED, CLAUDE_FAILED, etc. (nullable)
  error_message TEXT,                     -- Brief error message (nullable)
  
  -- Metadata
  poll_source TEXT NOT NULL,              -- Enum: 'scheduled', 'manual', 'webhook'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_completed_at (completed_at),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
);
```

**Rationale:**
- Track each poll cycle for analytics and debugging
- Immutable: once completed_at is set, don't update results
- Used for dashboards: "Last 30 days: X polls, Y jobs applied, Z success rate"
- Supports alerting: "3 consecutive failed polls → send alert"

---

#### **4. APPLICATIONS Table (IMMUTABLE LOG)**

```sql
CREATE TABLE applications (
  -- Identifiers
  id TEXT PRIMARY KEY,                    -- UUID
  job_id TEXT NOT NULL,                   -- FK to jobs.id
  poll_cycle_id TEXT,                     -- FK to poll_cycles.id (nullable for manual runs)
  
  -- Attempt Details
  attempted_at TIMESTAMP NOT NULL,        -- When we tried to apply
  success BOOLEAN NOT NULL,               -- true if application succeeded
  
  -- Error Details (only if success=false)
  error_type TEXT,                        -- Enum: TRANSIENT, PERMANENT, FORM_ERROR, RATE_LIMIT, CAPTCHA
  error_message TEXT,                     -- Brief error description
  retry_count INTEGER DEFAULT 0,          -- How many times this job was retried
  next_retry_at TIMESTAMP,                -- When to retry (if transient)
  
  -- Context
  claude_input_tokens INTEGER,            -- Tokens used in Claude request
  claude_output_tokens INTEGER,           -- Tokens generated by Claude
  duration_ms INTEGER,                    -- How long the application attempt took
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (poll_cycle_id) REFERENCES poll_cycles(id),
  INDEX idx_job_id (job_id),
  INDEX idx_poll_cycle_id (poll_cycle_id),
  INDEX idx_attempted_at (attempted_at),
  INDEX idx_success (success),
  INDEX idx_error_type (error_type)
);
```

**Rationale:**
- Immutable log: once created, never updated (audit trail)
- Tracks ALL attempts (successful + failed) for analytics
- Includes token usage for cost tracking
- Used for troubleshooting: "Why did job X fail? Let me check all attempts."
- Enables retry logic: `next_retry_at` tells retry scheduler when to try again

---

#### **5. WEBSITE_REGISTRY Table (UNCHANGED)**

```sql
CREATE TABLE website_registry (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  job_board_type TEXT NOT NULL,
  
  login_flow_instructions TEXT NOT NULL,
  form_fields_mapping JSON NOT NULL,     -- JSON with field selectors
  
  resume_upload_selector TEXT,
  cover_letter_upload_selector TEXT,
  credential_type TEXT NOT NULL,         -- shared, site_specific
  form_submit_selector TEXT,
  
  success_indicators TEXT,                -- JSON array of strings
  error_indicators TEXT,                 -- JSON array of strings
  
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  version INTEGER DEFAULT 1,
  
  INDEX idx_domain (domain),
  INDEX idx_is_active (is_active)
);
```

**Rationale:**
- No changes needed; already optimized
- 50+ sites pre-populated
- Used for form filling instructions

---

#### **6. SITE_CREDENTIALS Table (UNCHANGED)**

```sql
CREATE TABLE site_credentials (
  id TEXT PRIMARY KEY,
  registry_entry_id TEXT NOT NULL,        -- FK to website_registry
  credential_type TEXT NOT NULL,          -- shared, site_specific
  
  username TEXT,
  password_encrypted TEXT,                -- AES-256-GCM encrypted
  encryption_key_id TEXT,                 -- Key ID for rotation
  
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  FOREIGN KEY (registry_entry_id) REFERENCES website_registry(id),
  UNIQUE INDEX idx_registry_cred_type (registry_entry_id, credential_type)
);
```

---

#### **7. SCHEDULE_CONFIG Table (UNCHANGED)**

```sql
CREATE TABLE schedule_config (
  id TEXT PRIMARY KEY DEFAULT 'global',   -- Single row per instance
  
  polling_interval_hours INTEGER DEFAULT 8,
  poll_start_time TEXT DEFAULT '08:00',   -- HH:MM format
  batch_size INTEGER DEFAULT 5,           -- Max jobs per poll cycle
  is_enabled BOOLEAN DEFAULT 0,
  
  last_poll_at TIMESTAMP,
  next_poll_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  PRIMARY KEY (id)
);
```

---

#### **8. ERROR_BACKOFF Table (NEW - Rate Limit Tracking)**

```sql
CREATE TABLE error_backoff (
  id TEXT PRIMARY KEY,
  
  -- What we're backing off from
  backoff_key TEXT NOT NULL,              -- job_board_domain, claude_api, etc.
  backoff_type TEXT NOT NULL,             -- RATE_LIMIT, CAPTCHA, AUTHENTICATION, etc.
  
  -- Backoff schedule
  failed_attempts INTEGER DEFAULT 1,      -- How many times this failed
  backoff_until TIMESTAMP NOT NULL,       -- Don't retry until this time
  backoff_duration_seconds INTEGER,       -- Current backoff duration
  
  -- Context
  last_error TEXT,                        -- Error message from last attempt
  first_failure_at TIMESTAMP NOT NULL,    -- When first failure occurred
  
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  INDEX idx_backoff_key (backoff_key),
  INDEX idx_backoff_until (backoff_until),
  UNIQUE INDEX idx_backoff_key_type (backoff_key, backoff_type)
);
```

**Rationale:**
- Tracks rate limits and CAPTCHAs per domain/service
- Used to avoid hammering a site that's rate-limiting us
- Auto-cleans up old entries (older than 7 days)

---

#### **9. NOTIFICATION_LOG Table (NEW - Audit Trail)**

```sql
CREATE TABLE notification_log (
  id TEXT PRIMARY KEY,
  
  -- Notification Details
  notification_type TEXT NOT NULL,        -- slack, email, webhook
  recipient TEXT,                         -- Slack channel, email address, webhook URL
  
  -- Content
  title TEXT NOT NULL,
  message TEXT,
  
  -- Delivery
  sent_at TIMESTAMP NOT NULL,
  delivery_status TEXT NOT NULL,          -- success, failed, retrying
  error_message TEXT,                     -- If failed
  retry_count INTEGER DEFAULT 0,
  
  -- Context
  related_poll_cycle_id TEXT,             -- FK to poll_cycles (nullable)
  related_job_id TEXT,                    -- FK to jobs (nullable)
  
  created_at TIMESTAMP NOT NULL,
  
  FOREIGN KEY (related_poll_cycle_id) REFERENCES poll_cycles(id),
  FOREIGN KEY (related_job_id) REFERENCES jobs(id),
  INDEX idx_sent_at (sent_at),
  INDEX idx_delivery_status (delivery_status)
);
```

---

### **Schema Migration: Old → New**

```sql
-- Step 1: Backup existing jobs table
CREATE TABLE jobs_v1_backup AS SELECT * FROM jobs;

-- Step 2: Create new jobs table (as defined above)
CREATE TABLE jobs_new (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  job_board_domain TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  discovered_at TIMESTAMP NOT NULL,
  source TEXT NOT NULL,
  fit_score INTEGER,
  threshold_met BOOLEAN DEFAULT 0,
  tailored_resume_path TEXT,
  cover_letter_path TEXT,
  apply_status TEXT NOT NULL DEFAULT 'new',
  apply_attempts INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_type TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_discovered_at (discovered_at),
  INDEX idx_apply_status (apply_status),
  INDEX idx_threshold_met_discovered (threshold_met, discovered_at),
  INDEX idx_job_board_domain (job_board_domain),
  UNIQUE INDEX idx_url_unique (url)
);

-- Step 3: Migrate data from jobs_v1 to jobs_new
INSERT INTO jobs_new (
  id, url, job_board_domain, title, company, location,
  discovered_at, source, fit_score, threshold_met,
  tailored_resume_path, cover_letter_path,
  apply_status, apply_attempts, last_error, last_error_type,
  created_at, updated_at
)
SELECT
  id, url, job_board_domain, title, company, location,
  discovered_at, source, fit_score, threshold_met,
  tailored_resume_path, cover_letter_path,
  CASE
    WHEN applied = 1 THEN 'applied'
    WHEN failed = 1 THEN 'failed'
    WHEN skipped = 1 THEN 'skipped'
    WHEN pending = 1 THEN 'pending'
    ELSE 'new'
  END,
  apply_attempts, last_error, apply_error_type,
  created_at, updated_at
FROM jobs_v1_backup;

-- Step 4: Create job_details table (sparse enrichment)
CREATE TABLE job_details (
  job_id TEXT PRIMARY KEY,
  full_description TEXT,
  requirements TEXT,
  benefits TEXT,
  salary_min DECIMAL(10,2),
  salary_max DECIMAL(10,2),
  salary_currency TEXT,
  company_industry TEXT,
  company_size TEXT,
  scraped_at TIMESTAMP,
  source_url TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs_new(id) ON DELETE CASCADE
);

-- Step 5: Migrate job descriptions to job_details (optional)
INSERT INTO job_details (job_id, full_description, scraped_at)
SELECT id, description, discovered_at FROM jobs_v1_backup
WHERE description IS NOT NULL;

-- Step 6: Create new tables for audit trail
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  poll_cycle_id TEXT,
  attempted_at TIMESTAMP NOT NULL,
  success BOOLEAN NOT NULL,
  error_type TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  claude_input_tokens INTEGER,
  claude_output_tokens INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs_new(id),
  FOREIGN KEY (poll_cycle_id) REFERENCES poll_cycles(id),
  INDEX idx_job_id (job_id),
  INDEX idx_poll_cycle_id (poll_cycle_id),
  INDEX idx_attempted_at (attempted_at),
  INDEX idx_success (success),
  INDEX idx_error_type (error_type)
);

CREATE TABLE error_backoff (
  id TEXT PRIMARY KEY,
  backoff_key TEXT NOT NULL,
  backoff_type TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 1,
  backoff_until TIMESTAMP NOT NULL,
  backoff_duration_seconds INTEGER,
  last_error TEXT,
  first_failure_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  INDEX idx_backoff_key (backoff_key),
  INDEX idx_backoff_until (backoff_until),
  UNIQUE INDEX idx_backoff_key_type (backoff_key, backoff_type)
);

CREATE TABLE notification_log (
  id TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL,
  recipient TEXT,
  title TEXT NOT NULL,
  message TEXT,
  sent_at TIMESTAMP NOT NULL,
  delivery_status TEXT NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  related_poll_cycle_id TEXT,
  related_job_id TEXT,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (related_poll_cycle_id) REFERENCES poll_cycles(id),
  FOREIGN KEY (related_job_id) REFERENCES jobs_new(id),
  INDEX idx_sent_at (sent_at),
  INDEX idx_delivery_status (delivery_status)
);

-- Step 7: Drop old jobs table and rename new one
DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;

-- Step 8: Update schema version
UPDATE schema_migrations SET version = 2, applied_at = CURRENT_TIMESTAMP
WHERE name = 'optimize_schema';
```

---

## Phase 4: Error Handling, Retries & Logging

### **R4.1: Error Classification Framework**

Implement `ErrorClassifier` class to categorize errors into 3 types:

#### **Transient Errors (RETRY UP TO 3 TIMES)**
These are temporary failures; retry with exponential backoff.

| Error | Backoff Schedule | Max Attempts |
|-------|------------------|--------------|
| Network timeout | 1s, 4s, 16s | 3 |
| HTTP 429 (Rate Limit) | 60s, 120s, 300s | 3 |
| HTTP 503 (Service Unavailable) | 10s, 30s, 90s | 3 |
| Claude API overloaded | 30s, 60s, 120s | 3 |
| CAPTCHA detected (first time) | 300s (5 min), then skip | 1 |
| Connection reset | 1s, 4s, 16s | 3 |

**Backoff Formula**: `delay_s = base_s * (2 ^ attempt_number)`

#### **Permanent Errors (SKIP - DON'T RETRY)**
These indicate the job isn't applicable or the site is unreachable. Skip and move on.

| Error | Reason |
|-------|--------|
| HTTP 404 (Job not found) | Job removed from board |
| HTTP 401/403 (Authentication failed) | Invalid credentials |
| Invalid URL | Job URL malformed |
| Site completely blocked | IP banned or site down for 24h+ |
| Application closed | Site says "Applications closed" |
| Duplicate application | We already applied to this job |
| Job expired | Posted >90 days ago |

**Action**: Mark as `failed`, set `last_error_type = 'PERMANENT'`, don't retry.

#### **Form Errors (DEBUG - ATTEMPT ONCE, LOG FOR LEARNING)**
These indicate Claude failed to fill a specific field or selector.

| Error | Reason |
|-------|--------|
| Selector not found | Form field moved or renamed |
| Validation error | Field validation failed (e.g., phone format) |
| File upload failed | Resume upload rejected |
| Unsupported file type | Site wants DOCX, we provided PDF |
| Required field missing | Form requires field user didn't provide |
| Custom form logic | Site has conditional fields |

**Action**: Log full context, mark as `failed`, flag for auto-learning. Don't retry this job, but add to learning queue.

---

### **R4.2: Retry Logic Implementation**

```python
class RetryManager:
    """Manages retry scheduling and backoff logic"""
    
    def classify_error(self, error: Exception) -> ErrorType:
        """Classify error as TRANSIENT, PERMANENT, or FORM_ERROR"""
        
    def should_retry(self, job_id: str, error_type: ErrorType) -> bool:
        """Check if job should be retried"""
        # Query applications table for retry_count
        # Compare against max for error type
        
    def schedule_retry(self, job_id: str, error_type: ErrorType, 
                       next_delay_seconds: int):
        """Schedule retry in applications table"""
        # Set next_retry_at = NOW + next_delay_seconds
        # Increment retry_count
        
    def get_next_backoff_delay(self, attempt: int, error_type: ErrorType) -> int:
        """Calculate backoff delay in seconds"""
        # Use exponential backoff for transient errors
        # Return next delay or 0 if max attempts reached
        
    def cleanup_old_backoffs(self):
        """Remove error_backoff entries older than 7 days"""
```

**Usage in Poll Cycle:**

```python
def attempt_application(job_id, job_url):
    try:
        # Call Claude to apply
        result = claude_apply(job_url, ...)
        
        # Mark successful
        applications.insert(
            job_id=job_id,
            success=True,
            attempted_at=NOW
        )
        jobs.update(apply_status='applied')
        
    except Exception as e:
        error_type = classify_error(e)
        
        if error_type == ErrorType.TRANSIENT:
            # Retry
            attempt = applications.count_by_job(job_id)
            if attempt < 3:
                delay = get_backoff_delay(attempt, error_type)
                applications.insert(
                    job_id=job_id,
                    success=False,
                    error_type='TRANSIENT',
                    error_message=str(e),
                    retry_count=attempt + 1,
                    next_retry_at=NOW + timedelta(seconds=delay)
                )
                jobs.update(apply_status='pending')  # Wait for retry
            else:
                # Max retries reached
                applications.insert(..., retry_count=3)
                jobs.update(apply_status='failed', last_error_type='TRANSIENT_MAX_RETRIES')
                
        elif error_type == ErrorType.PERMANENT:
            # Skip
            applications.insert(
                job_id=job_id,
                success=False,
                error_type='PERMANENT',
                error_message=str(e)
            )
            jobs.update(apply_status='failed', last_error_type='PERMANENT')
            
        elif error_type == ErrorType.FORM_ERROR:
            # Log for learning
            applications.insert(
                job_id=job_id,
                success=False,
                error_type='FORM_ERROR',
                error_message=str(e)
            )
            jobs.update(apply_status='failed', last_error_type='FORM_ERROR')
            flag_for_learning(job_id, e.context)
```

---

### **R4.3: Comprehensive Structured Logging**

**Log Location**: `~/.applypilot/logs/autopilot-YYYY-MM-DD.log`

**Format**: JSON (one object per line, newline-delimited)

**Example Log File**:

```json
{"timestamp":"2024-12-20T08:00:00Z","level":"INFO","stage":"poll_start","message":"Poll cycle started","poll_cycle_id":"pc_20241220_080000","source":"scheduled"}
{"timestamp":"2024-12-20T08:00:05Z","level":"INFO","stage":"discovery","message":"Jobs discovered","count":42,"source":"indeed.com","duration_s":5.234}
{"timestamp":"2024-12-20T08:00:15Z","level":"INFO","stage":"enrichment","message":"Job descriptions enriched","count":40,"skipped":2,"duration_s":9.876}
{"timestamp":"2024-12-20T08:00:25Z","level":"INFO","stage":"scoring","message":"Jobs scored","count":38,"passed_threshold":28,"duration_s":10.123}
{"timestamp":"2024-12-20T08:00:35Z","level":"INFO","stage":"resume_tailoring","message":"Resumes tailored","count":28,"duration_s":8.456}
{"timestamp":"2024-12-20T08:00:45Z","level":"INFO","stage":"cover_letter","message":"Cover letters generated","count":28,"duration_s":9.234}
{"timestamp":"2024-12-20T08:02:10Z","level":"INFO","stage":"application","action":"applied","job_id":"job_12345","title":"Senior Engineer","company":"Acme Corp","status":"success","duration_s":85.234,"claude_tokens":{"input":1250,"output":340}}
{"timestamp":"2024-12-20T08:03:00Z","level":"WARN","stage":"application","action":"rate_limit","job_board":"linkedin.com","error":"HTTP 429","backoff_until":"2024-12-20T08:04:00Z","next_retry_at":"2024-12-20T08:04:00Z"}
{"timestamp":"2024-12-20T08:03:05Z","level":"ERROR","stage":"application","action":"failed","job_id":"job_12346","error_type":"FORM_ERROR","error":"Selector '#phone' not found","retry_count":0,"duration_s":12.567}
{"timestamp":"2024-12-20T08:03:10Z","level":"WARN","stage":"application","action":"captcha_detected","job_id":"job_12347","job_board":"indeed.com","message":"CAPTCHA found, skipping this job","backoff_until":"2024-12-20T08:08:10Z"}
{"timestamp":"2024-12-20T08:10:15Z","level":"INFO","stage":"poll_complete","message":"Poll cycle completed","stats":{"new_jobs":42,"scored":28,"applied":18,"failed":8,"skipped":2},"duration_s":610.123,"notification_sent":true}
```

**Logging Configuration**:

```yaml
log_config:
  version: 1
  formatters:
    json:
      class: pythonjsonlogger.jsonlogger.JsonFormatter
      format: "%(timestamp)s %(level)s %(stage)s %(message)s"
  handlers:
    file:
      class: logging.handlers.RotatingFileHandler
      filename: ~/.applypilot/logs/autopilot-{date}.log
      maxBytes: 52428800  # 50 MB
      backupCount: 7  # 7 days retention
      formatter: json
  root:
    level: INFO
    handlers: [file]
```

**Log Levels**:
- `INFO`: Normal operation (poll started, jobs found, applied successfully)
- `WARN`: Recoverable issues (rate limit, CAPTCHA, retry scheduled)
- `ERROR`: Application failures (permanent errors, form errors)
- `CRITICAL`: System failures (database error, Claude API unavailable, crash)

---

### **R4.4: Token Efficiency & Batch Mode**

#### **Batch Mode (Configurable)**

```bash
# Default: 5 jobs per poll cycle
applypilot schedule --interval 24h --batch-size 5

# Override for manual run
applypilot run --batch-size 10
```

**Algorithm**:

```python
def batch_apply(poll_cycle_id, batch_size=5):
    """Apply to top N jobs per poll cycle (most efficient token usage)"""
    
    # 1. Find jobs ready to apply (scored >= threshold, not yet applied)
    ready_jobs = jobs.query(
        apply_status='new',
        threshold_met=True,
        order_by='fit_score DESC'
    ).limit(batch_size)
    
    # 2. Prioritize high-fit jobs first (reduces wasted tokens on low-fit)
    for job in ready_jobs:
        # 3. Skip if site is rate-limited or blocked
        backoff = error_backoff.get_active(
            backoff_key=job.job_board_domain
        )
        if backoff:
            jobs.update(job.id, apply_status='pending')
            continue
        
        # 4. Apply
        try:
            result = claude_apply(job)
            applications.insert(success=True)
            jobs.update(apply_status='applied')
        except Exception as e:
            handle_application_error(job, e)

# This reduces API calls: 5 jobs/cycle * 1 call per job = 5 calls
# vs. old model: 28 jobs * 1 call each = 28 calls per cycle
```

**Token Savings**:
- **Old**: 28 applications × ~1,500 tokens/job = 42,000 tokens/cycle
- **New** (batch 5): 5 applications × ~1,500 tokens + 1 batch summary = 7,500 tokens/cycle
- **Savings**: 82% reduction (42,000 → 7,500)
- **Cost**: $0.126/cycle → $0.0225/cycle (~$0.54/month vs. $3.78/month)

---

#### **Pre-Scoring Aggressiveness**

```python
def aggressive_pre_scoring(jobs):
    """Filter jobs more aggressively before Claude invocation"""
    
    filtered = jobs
    
    # 1. Reject jobs with keyword mismatches
    MUST_HAVE = ['python', 'backend']  # User config
    MUST_AVOID = ['blockchain', 'cryptocurrency']  # User config
    
    filtered = [j for j in filtered 
                if all(kw in j.title.lower() for kw in MUST_HAVE)
                and not any(kw in j.title.lower() for kw in MUST_AVOID)]
    
    # 2. Reject based on location
    ALLOWED_LOCATIONS = ['remote', 'NYC', 'SF', 'Austin']
    filtered = [j for j in filtered 
                if any(loc in j.location for loc in ALLOWED_LOCATIONS)]
    
    # 3. Reject based on company size / industry
    REJECTED_INDUSTRIES = ['finance', 'insurance']
    filtered = [j for j in filtered 
                if j.industry not in REJECTED_INDUSTRIES]
    
    return filtered
```

**Impact**: Reduces Claude calls by 30-40% by filtering obviously mismatched jobs locally.

---

#### **Resume Caching (Per-Job)**

```python
class ResumeTailor:
    """Generate tailored resume per job"""
    
    def tailor_resume(self, user_resume, job_description):
        """Generate fresh resume for each job"""
        # User requirement: always tailor per job
        # No caching across jobs
        # Cost: 1 Claude call per job, but ensures best fit
        
        cached_path = f"~/.applypilot/resumes/{job_id}.pdf"
        
        # Check if already generated this poll cycle
        if cached_path.exists() and job.updated_at > poll_start:
            return cached_path
        
        # Otherwise generate fresh
        tailored = claude_tailor_resume(user_resume, job_description)
        save_to(tailored, cached_path)
        
        return cached_path
```

---

## Phase 5: Notifications & Enhanced Monitoring

### **R5.1: Notifications**

#### **Slack Integration**

```python
class SlackNotifier:
    """Send structured Slack notifications"""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        self.last_notification_time = None
        self.min_interval = 300  # 5 minutes
    
    def should_notify(self) -> bool:
        """Throttle: max 1 notification per 5 minutes"""
        if not self.last_notification_time:
            return True
        elapsed = (time.time() - self.last_notification_time)
        return elapsed >= self.min_interval
    
    def notify_job_match(self, job_count: int, fit_scores: list):
        """Send when new high-fit jobs found"""
        if not self.should_notify():
            return
        
        message = {
            "text": f"🎯 {job_count} new job matches found!",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*New Jobs Found*\n"
                               f"✅ {job_count} jobs match your criteria\n"
                               f"📊 Avg fit score: {sum(fit_scores)/len(fit_scores):.1f}/10"
                    }
                }
            ]
        }
        self._send(message)
    
    def notify_application_success(self, job_title: str, company: str):
        """Send when application succeeds"""
        if not self.should_notify():
            return
        
        message = {
            "text": f"✅ Application submitted: {job_title} at {company}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Application Submitted* ✅\n"
                               f"*{job_title}*\n"
                               f"_{company}_"
                    }
                }
            ]
        }
        self._send(message)
    
    def notify_daily_summary(self, stats: dict):
        """Send daily digest: jobs found, applied, success rate"""
        message = {
            "text": "📊 ApplyPilot Daily Summary",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "📊 ApplyPilot Daily Summary"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Jobs Found*\n{stats['new_jobs']}"},
                        {"type": "mrkdwn", "text": f"*Applied*\n{stats['applied']}"},
                        {"type": "mrkdwn", "text": f"*Success Rate*\n{stats['success_rate']}%"},
                        {"type": "mrkdwn", "text": f"*Avg Fit Score*\n{stats['avg_fit_score']:.1f}/10"}
                    ]
                }
            ]
        }
        self._send(message)
    
    def notify_errors_requiring_attention(self, errors: list):
        """Send when permanent errors occur (needs user intervention)"""
        message = {
            "text": f"⚠️ {len(errors)} errors require attention",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*⚠️ Errors Requiring Attention*\n"
                               f"• {errors[0]['message']}\n"
                               f"• {errors[1]['message']}\n"
                               f"• … and {len(errors)-2} more\n\n"
                               f"_Run `applypilot logs --error` to see details_"
                    }
                }
            ]
        }
        self._send(message)
    
    def _send(self, message: dict):
        """Send to Slack webhook"""
        try:
            response = requests.post(self.webhook_url, json=message)
            response.raise_for_status()
            self.last_notification_time = time.time()
            notification_log.insert(
                notification_type='slack',
                recipient=self.webhook_url,
                delivery_status='success'
            )
        except Exception as e:
            notification_log.insert(
                notification_type='slack',
                delivery_status='failed',
                error_message=str(e)
            )
```

#### **Email Integration**

```python
class EmailNotifier:
    """Send email summaries"""
    
    def send_daily_summary(self, email: str, stats: dict):
        """Email digest at specified time (e.g., 9 AM)"""
        body = f"""
        ApplyPilot Daily Summary - {date.today()}
        
        📊 Statistics
        • Jobs found: {stats['new_jobs']}
        • Applications submitted: {stats['applied']}
        • Success rate: {stats['success_rate']}%
        • Avg fit score: {stats['avg_fit_score']:.1f}/10
        
        Top job by fit score:
        • {stats['top_job']['title']} at {stats['top_job']['company']}
        • Fit: {stats['top_job']['fit_score']}/10
        
        Next scheduled poll: {stats['next_poll']}
        
        Full dashboard: https://applypilot.local/dashboard
        """
        
        send_email(
            to=email,
            subject="ApplyPilot Daily Summary",
            body=body
        )
```

#### **Setup CLI**

```bash
# Configure Slack
applypilot notifications slack --webhook https://hooks.slack.com/services/...

# Configure Email
applypilot notifications email --address me@example.com --daily-time 09:00

# Test notifications
applypilot notifications test

# Disable notifications
applypilot notifications disable
```

---

### **R5.2: Monitoring & Status**

#### **Status Command**

```bash
$ applypilot status

ApplyPilot Status
=================

Schedule:
  Status: Enabled
  Interval: Every 8 hours
  Next poll: 2024-12-20 16:00:00 UTC
  Last poll: 2024-12-20 08:00:00 UTC (1 hour ago) ✅

Recent Statistics (Last 24h):
  Polls completed: 3
  Jobs discovered: 127
  Jobs scored: 89
  Applications submitted: 15
  Success rate: 86.7%
  Failures: 2 (form errors)

Application History:
  • ✅ Senior Engineer @ Acme (2024-12-20 08:02) - Fit: 9/10
  • ✅ Backend Developer @ TechCorp (2024-12-20 08:15) - Fit: 8/10
  • ❌ DevOps Engineer @ StartupXYZ (2024-12-20 08:45) - Form error
  • ⏱️ Frontend Engineer @ CloudSys (pending retry) - Rate limited

Health Check:
  Memory usage: 127 MB / 512 MB
  Database size: 45 MB
  Last error: None
  Uptime: 3 days, 14 hours
  
Notifications:
  Slack: Configured (last sent 30 min ago)
  Email: Not configured
```

**Implementation**:

```python
class StatusReporter:
    def get_status(self) -> StatusReport:
        schedule = schedule_config.get()
        stats_24h = get_stats_last_24h()
        recent_apps = applications.get_recent(limit=5)
        health = get_health_metrics()
        
        return StatusReport(
            schedule=schedule,
            stats=stats_24h,
            recent_applications=recent_apps,
            health=health
        )
```

---

#### **Health Check Endpoint (HTTP)**

```python
@app.get('/health')
def health_check():
    """Health endpoint for container orchestration (K8s, etc.)"""
    
    health = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": get_uptime(),
        "memory_mb": get_memory_usage(),
        "database_healthy": check_database(),
        "last_poll": db.query(poll_cycles)
                        .order_by(started_at.desc())
                        .first()
                        .completed_at,
        "last_error": get_latest_error(),
        "success_rate": calculate_success_rate(days=7),
        "next_poll": schedule_config.get().next_poll_at
    }
    
    # Determine overall status
    if not health['database_healthy']:
        health['status'] = 'unhealthy'
        return health, 503
    
    if get_uptime() < 60:
        health['status'] = 'starting'
        return health, 503
    
    return health, 200
```

**Usage in Docker**:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

---

### **R5.3: Docker Support**

#### **Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create persistent volumes
RUN mkdir -p /app/data /app/logs

# Expose health check port
EXPOSE 8000

# Entrypoint: Start health server + polling scheduler
ENTRYPOINT ["python", "-m", "applypilot.docker_entrypoint"]
```

#### **Docker Entrypoint Script** (`docker_entrypoint.py`)

```python
#!/usr/bin/env python
"""Docker entrypoint: Starts health server + polling scheduler"""

import os
import sys
import signal
import threading
import logging
from fastapi import FastAPI
from uvicorn import Server, Config
from applypilot.db import init_db
from applypilot.scheduler import PollScheduler
from applypilot.health import HealthChecker

logger = logging.getLogger(__name__)

# Initialize database (migrations auto-run)
init_db()

# Create FastAPI app for health checks
app = FastAPI()

@app.get('/health')
async def health():
    """Health endpoint"""
    return await HealthChecker().check()

@app.get('/status')
async def status():
    """Status endpoint"""
    return await StatusReporter().get_status()

# Initialize scheduler
scheduler = PollScheduler()

def run_health_server():
    """Run FastAPI health server on port 8000"""
    config = Config(
        app=app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
    server = Server(config)
    asyncio.run(server.serve())

def run_scheduler():
    """Run polling scheduler in background"""
    scheduler.start()

def signal_handler(sig, frame):
    """Handle SIGTERM gracefully"""
    logger.info("Received SIGTERM, shutting down gracefully...")
    scheduler.stop()
    sys.exit(0)

if __name__ == '__main__':
    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start scheduler in background thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=False)
    scheduler_thread.start()
    
    # Start health server in main thread
    logger.info("Starting ApplyPilot Docker container")
    logger.info("Health check available at http://0.0.0.0:8000/health")
    run_health_server()
```

#### **docker-compose.yml**

```yaml
version: '3.8'

services:
  applypilot:
    build: .
    container_name: applypilot
    ports:
      - "8000:8000"  # Health check port
    volumes:
      - applypilot_data:/app/data
      - applypilot_logs:/app/logs
      - ~/.applypilot/credentials:/app/credentials:ro  # Mount credentials read-only
    environment:
      - APPLYPILOT_DB_PATH=/app/data/applypilot.db
      - APPLYPILOT_LOG_PATH=/app/logs
      - APPLYPILOT_POLL_INTERVAL=8
      - APPLYPILOT_BATCH_SIZE=5
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

volumes:
  applypilot_data:
    driver: local
  applypilot_logs:
    driver: local
```

#### **Run in Docker**

```bash
# Build image
docker build -t applypilot:latest .

# Run container
docker run -d \
  -v ~/.applypilot/credentials:/app/credentials:ro \
  -e SLACK_WEBHOOK_URL=https://hooks.slack.com/... \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -p 8000:8000 \
  --name applypilot \
  applypilot:latest

# Check health
curl http://localhost:8000/health

# View logs
docker logs applypilot -f

# Stop gracefully (sends SIGTERM)
docker stop applypilot
```

---

## Implementation Phases (Detailed)

### **Phase 4: Error Handling, Retries & Logging (Weeks 1-2)**

#### **Phase 4 Tasks**

1. **Schema Migration** (Task P4.1) - Complexity: Medium
   - Create new `jobs`, `applications`, `error_backoff`, `notification_log` tables
   - Migrate data from old schema
   - Create indexes for query performance
   - **Acceptance Criteria**:
     - Migration runs without errors
     - No data loss
     - Queries 10x faster on large job sets
   - **Dependencies**: Phase 3 complete

2. **Error Classification** (Task P4.2) - Complexity: Medium
   - Implement `ErrorClassifier` class (transient/permanent/form_error)
   - Create error type enums
   - Unit tests with 15+ error types
   - **Acceptance Criteria**:
     - 95%+ accuracy classifying common errors
     - Each error type maps to correct backoff strategy
   - **Dependencies**: Task P4.1

3. **Retry Logic & Backoff** (Task P4.3) - Complexity: Medium
   - Implement `RetryManager` class
   - Exponential backoff calculator
   - Rate limit and CAPTCHA backoff tracking
   - Integration with `error_backoff` table
   - **Acceptance Criteria**:
     - Transient errors retry with correct backoff
     - Permanent errors skip immediately
     - Rate limits respected (no 429s)
     - CAPTCHA backoff lasts 5+ minutes
   - **Dependencies**: Task P4.2

4. **Structured Logging** (Task P4.4) - Complexity: Small
   - Configure JSON logging with pythonjsonlogger
   - Implement daily log rotation
   - 7-day retention + compression
   - Log to `~/.applypilot/logs/autopilot-YYYY-MM-DD.log`
   - **Acceptance Criteria**:
     - All logs in valid JSON format
     - Logs rotate daily
     - Old logs compressed and archived
     - Can parse logs with `jq`
   - **Dependencies**: None

5. **Batch Mode Implementation** (Task P4.5) - Complexity: Medium
   - Implement `--batch-size` flag in schedule config
   - Update poll orchestrator to apply to top N jobs only
   - Add pre-scoring filtering (aggressive keyword matching)
   - **Acceptance Criteria**:
     - Batch size 5: applies to 5 jobs per cycle max
     - Token usage reduced by 40-50%
     - High-fit jobs prioritized
     - Keyword filtering works correctly
   - **Dependencies**: Task P4.1, P4.3

6. **CLI Commands for Error Management** (Task P4.6) - Complexity: Small
   - `applypilot logs --filter stage=application --since 24h`
   - `applypilot logs --error` (show all errors)
   - `applypilot logs --tail 100` (last 100 lines)
   - **Acceptance Criteria**:
     - All commands parse JSON logs correctly
     - Filtering works for stage, level, error type
     - Output human-readable
   - **Dependencies**: Task P4.4

7. **Integration Tests** (Task P4.7) - Complexity: Large
   - Test retry logic with mock Claude failures
   - Test error classification with 20+ error types
   - Test batch mode token savings
   - Test log rotation and compression
   - **Acceptance Criteria**:
     - 95%+ test pass rate
     - All happy paths + error paths covered
     - Batch mode reduces tokens by 40%+
   - **Dependencies**: All P4 tasks

---

### **Phase 5: Notifications, Monitoring & Docker (Weeks 3-5)**

#### **Phase 5 Tasks**

1. **Slack Integration** (Task P5.1) - Complexity: Medium
   - Implement `SlackNotifier` class
   - Create message templates (job match, success, error, daily summary)
   - Throttling logic (max 1 notification per 5 min)
   - `applypilot notifications slack --webhook ...` command
   - **Acceptance Criteria**:
     - Messages sent to Slack successfully
     - Throttling prevents spam
     - Messages are readable and informative
     - Can test with `applypilot notifications test`
   - **Dependencies**: Task P4.1 (applications table)

2. **Email Integration** (Task P5.2) - Complexity: Small
   - Implement `EmailNotifier` class
   - Daily summary emails at configured time
   - Use standard SMTP
   - `applypilot notifications email --address me@example.com` command
   - **Acceptance Criteria**:
     - Emails sent successfully
     - Content matches spec
     - Supports Gmail/Office 365/custom SMTP
   - **Dependencies**: Task P5.1

3. **Status Command** (Task P5.3) - Complexity: Medium
   - Implement `applypilot status` with rich output
   - Show schedule, recent stats, health metrics
   - Format with tables and emoji
   - **Acceptance Criteria**:
     - Shows all required fields
     - Output looks professional
     - Stats are accurate
   - **Dependencies**: Task P4.1, P4.4

4. **Health Endpoint** (Task P5.4) - Complexity: Medium
   - Implement HTTP `/health` endpoint on port 8000
   - Return JSON with uptime, memory, success rate, etc.
   - Proper status codes (200=healthy, 503=unhealthy)
   - **Acceptance Criteria**:
     - Endpoint responds in <100ms
     - Status codes correct
     - Can be used by K8s liveness probes
   - **Dependencies**: Task P5.3

5. **Docker Image & Entrypoint** (Task P5.5) - Complexity: Large
   - Create Dockerfile with all dependencies
   - Implement docker entrypoint script
   - Start health server + scheduler in background
   - Graceful shutdown on SIGTERM
   - **Acceptance Criteria**:
     - Image builds successfully
     - Container starts and runs polling
     - Health endpoint works
     - `docker stop` shuts down gracefully
     - Volumes mount correctly
   - **Dependencies**: Task P5.4

6. **Docker Compose Setup** (Task P5.6) - Complexity: Small
   - Create docker-compose.yml with service config
   - Mount volumes for data/logs/credentials
   - Set environment variables
   - Healthcheck configuration
   - **Acceptance Criteria**:
     - `docker-compose up` starts container
     - Volumes persist data correctly
     - Can view logs with `docker logs`
   - **Dependencies**: Task P5.5

7. **Notification Log Table & Audit Trail** (Task P5.7) - Complexity: Small
   - Implement `notification_log` table for audit trail
   - Log all sent notifications (success/failure)
   - Retry failed notifications (up to 3x)
   - Query commands to inspect notification history
   - **Acceptance Criteria**:
     - All notifications logged
     - Failed notifications retried
     - Can query log with `applypilot notifications history`
   - **Dependencies**: Task P5.1, P5.2

8. **Kubernetes YAML (Optional)** (Task P5.8) - Complexity: Small
   - Create deployment.yaml for K8s
   - ConfigMap for schedule/batch settings
   - Secret for API keys
   - Service for health checks
   - **Acceptance Criteria**:
     - Deploys successfully to K8s
     - Health probes work
     - Pods restart on failure
   - **Dependencies**: Task P5.5

9. **Documentation & CLI Help** (Task P5.9) - Complexity: Small
   - Update `--help` for all new commands
   - Create troubleshooting guide (logs, health, debugging)
   - Docker deployment guide
   - Notification setup guide (Slack + Email)
   - **Acceptance Criteria**:
     - All commands have `-h` help
     - Docs cover all features
     - Examples work as-is
   - **Dependencies**: All P5 tasks

10. **End-to-End Integration Tests** (Task P5.10) - Complexity: Large
    - Test full poll cycle with notifications
    - Test Docker container startup/shutdown
    - Test health checks
    - Test error scenarios (API failures, network timeouts)
    - **Acceptance Criteria**:
      - 95%+ test pass rate
      - All happy paths + error paths covered
      - Docker e2e tests pass
    - **Dependencies**: All P5 tasks

---

## Example Output Files

### **Log File Example** (`~/.applypilot/logs/autopilot-2024-12-20.log`)

```json
{"timestamp":"2024-12-20T08:00:00.000Z","level":"INFO","stage":"poll_start","poll_cycle_id":"pc_20241220_080000","source":"scheduled","message":"Poll cycle started"}
{"timestamp":"2024-12-20T08:00:02.345Z","level":"INFO","stage":"discovery","message":"Jobs discovered","count":42,"source":"indeed.com","new_jobs":42,"duplicate_jobs":0,"duration_s":2.345}
{"timestamp":"2024-12-20T08:00:15.678Z","level":"INFO","stage":"enrichment","message":"Job descriptions enriched","count":40,"success":40,"failed":2,"duration_s":13.333}
{"timestamp":"2024-12-20T08:00:25.901Z","level":"INFO","stage":"scoring","message":"Jobs scored against user resume","count":38,"passed_threshold":28,"avg_fit_score":7.2,"duration_s":10.223}
{"timestamp":"2024-12-20T08:00:35.234Z","level":"INFO","stage":"resume_tailoring","message":"Resumes tailored for high-fit jobs","count":28,"success":28,"failed":0,"duration_s":9.333}
{"timestamp":"2024-12-20T08:00:45.567Z","level":"INFO","stage":"cover_letter","message":"Cover letters generated","count":28,"success":28,"failed":0,"duration_s":10.333}
{"timestamp":"2024-12-20T08:02:15.890Z","level":"INFO","stage":"application","action":"attempt_start","job_id":"job_indeed_12345","job_board":"indeed.com","title":"Senior Backend Engineer","company":"Acme Corp","fit_score":9}
{"timestamp":"2024-12-20T08:02:16.234Z","level":"INFO","stage":"application","action":"form_filled","job_id":"job_indeed_12345","fields_filled":8,"duration_s":0.344}
{"timestamp":"2024-12-20T08:02:30.567Z","level":"INFO","stage":"application","action":"success","job_id":"job_indeed_12345","title":"Senior Backend Engineer","company":"Acme Corp","duration_s":15.0,"claude_tokens":{"input":1245,"output":340}}
{"timestamp":"2024-12-20T08:02:31.234Z","level":"INFO","stage":"application","action":"notification_sent","notification_type":"slack","recipient":"#applypilot","title":"✅ Senior Backend Engineer at Acme Corp"}
{"timestamp":"2024-12-20T08:03:00.456Z","level":"INFO","stage":"application","action":"attempt_start","job_id":"job_linkedin_67890","job_board":"linkedin.com","title":"Backend Developer","company":"TechCorp"}
{"timestamp":"2024-12-20T08:03:15.789Z","level":"WARN","stage":"application","action":"rate_limit","job_board":"linkedin.com","error":"HTTP 429 Too Many Requests","backoff_until":"2024-12-20T08:04:15Z","retry_count":1,"next_retry_at":"2024-12-20T08:04:15Z"}
{"timestamp":"2024-12-20T08:03:16.012Z","level":"INFO","stage":"application","action":"job_pending","job_id":"job_linkedin_67890","status":"pending","reason":"Rate limited, will retry at 2024-12-20T08:04:15Z"}
{"timestamp":"2024-12-20T08:03:45.234Z","level":"INFO","stage":"application","action":"attempt_start","job_id":"job_greenhouse_11111","job_board":"greenhouse.io","title":"Full Stack Engineer","company":"StartupXYZ"}
{"timestamp":"2024-12-20T08:03:50.567Z","level":"ERROR","stage":"application","action":"form_error","job_id":"job_greenhouse_11111","error":"Selector '#phone_number' not found on form","error_type":"FORM_ERROR","retry_count":0}
{"timestamp":"2024-12-20T08:03:51.234Z","level":"INFO","stage":"application","action":"flagged_for_learning","job_id":"job_greenhouse_11111","reason":"Form structure mismatch, suggest registry update","job_board":"greenhouse.io"}
{"timestamp":"2024-12-20T08:04:00.456Z","level":"INFO","stage":"application","action":"attempt_start","job_id":"job_indeed_22222","job_board":"indeed.com","title":"DevOps Engineer","company":"CloudSys"}
{"timestamp":"2024-12-20T08:04:05.789Z","level":"WARN","stage":"application","action":"captcha_detected","job_id":"job_indeed_22222","job_board":"indeed.com","message":"CAPTCHA field detected on form","skip_reason":"CAPTCHA","backoff_key":"indeed.com_captcha","backoff_until":"2024-12-20T08:09:05Z"}
{"timestamp":"2024-12-20T08:04:06.012Z","level":"INFO","stage":"application","action":"job_skipped","job_id":"job_indeed_22222","reason":"CAPTCHA detected, will retry in 5 minutes"}
{"timestamp":"2024-12-20T08:04:15.890Z","level":"INFO","stage":"application","action":"retry_start","job_id":"job_linkedin_67890","attempt":2,"previous_error":"HTTP 429"}
{"timestamp":"2024-12-20T08:04:30.123Z","level":"INFO","stage":"application","action":"success","job_id":"job_linkedin_67890","title":"Backend Developer","company":"TechCorp","duration_s":14.233,"claude_tokens":{"input":1150,"output":310}}
{"timestamp":"2024-12-20T08:05:00.456Z","level":"INFO","stage":"poll_complete","message":"Poll cycle completed","poll_cycle_id":"pc_20241220_080000","stats":{"new_jobs":42,"scored":28,"applied":18,"failed":1,"skipped":1,"pending_retry":8},"total_duration_s":300.456,"notification_sent":true,"total_claude_tokens":{"input":2395,"output":650}}
```

---

### **Slack Message Example**

#### **Job Match Notification**

```
🎯 New Job Matches Found

✅ 3 new jobs match your criteria
📊 Average fit score: 8.2/10

Top matches:
1. Senior Backend Engineer @ Acme Corp (Fit: 9/10)
2. Backend Developer @ TechCorp (Fit: 8/10)
3. Full Stack Engineer @ StartupXYZ (Fit: 8/10)

Next scheduled poll: 2024-12-20 16:00:00
View dashboard: https://applypilot.local/dashboard
```

#### **Application Success Notification**

```
✅ Application Submitted

Senior Backend Engineer
Acme Corp
Location: San Francisco, CA
Fit Score: 9/10

Application submitted at 2024-12-20 08:02:30
```

#### **Daily Summary**

```
📊 ApplyPilot Daily Summary - Dec 20

📈 Today's Statistics
• Jobs found: 127
• Jobs scored: 89 (70%)
• Applications submitted: 18
• Success rate: 94%
• Avg fit score: 7.8/10

🚀 Top Job Match
Senior Backend Engineer @ Acme Corp (Fit: 9/10)

⚠️ Issues Needing Attention
1 form error on Greenhouse (selector mismatch)

🎯 Next Scheduled Poll
2024-12-20 16:00:00 (7.5 hours)

Dashboard: https://applypilot.local/dashboard
```

#### **Error Alert**

```
⚠️ Errors Requiring Attention

3 applications failed:

1. Full Stack Engineer @ StartupXYZ
   Error: Form field selector missing (#phone_number)
   Action: Registry update suggested

2. DevOps Engineer @ CloudSys
   Error: CAPTCHA detected
   Action: Will retry in 5 minutes

3. Blockchain Developer @ CryptoXYZ
   Error: Keyword mismatch (crypto rejected)
   Action: Job skipped (matches rejection list)

Run `applypilot logs --error` to see details
```

---

### **Docker Entrypoint Output**

```
2024-12-20 08:00:00,000 INFO ApplyPilot starting in Docker
2024-12-20 08:00:00,234 INFO Database initialized (version 2)
2024-12-20 08:00:00,456 INFO Poll scheduler initialized (interval: 8h, batch_size: 5)
2024-12-20 08:00:00,678 INFO Health check server starting on http://0.0.0.0:8000
2024-12-20 08:00:01,000 INFO Health endpoint ready at /health
2024-12-20 08:00:01,234 INFO Status endpoint ready at /status
2024-12-20 08:00:01,456 INFO Next poll scheduled: 2024-12-20 16:00:00 UTC
2024-12-20 08:00:01,678 INFO Slack notifications configured
2024-12-20 08:00:01,890 INFO ApplyPilot container ready
```

---

## Health Check Response Examples

### **Healthy**

```json
{
  "status": "healthy",
  "timestamp": "2024-12-20T08:15:00Z",
  "uptime_seconds": 54000,
  "memory_mb": 127,
  "database_healthy": true,
  "last_poll": "2024-12-20T08:00:00Z",
  "last_error": null,
  "success_rate_7d": 0.94,
  "next_poll": "2024-12-20T16:00:00Z",
  "job_stats": {
    "total_discovered": 2847,
    "total_applied": 189,
    "success_count": 178,
    "failure_count": 11
  }
}
```

HTTP Status: `200 OK`

### **Unhealthy (Database Error)**

```json
{
  "status": "unhealthy",
  "timestamp": "2024-12-20T08:15:00Z",
  "uptime_seconds": 54000,
  "memory_mb": 512,
  "database_healthy": false,
  "database_error": "Connection timeout: unable to reach /app/data/applypilot.db",
  "last_poll": "2024-12-20T08:00:00Z",
  "last_error": "Database connection failed"
}
```

HTTP Status: `503 Service Unavailable`

### **Starting Up**

```json
{
  "status": "starting",
  "timestamp": "2024-12-20T08:00:05Z",
  "uptime_seconds": 5,
  "message": "Application initializing, health checks not yet available"
}
```

HTTP Status: `503 Service Unavailable`

---

## Performance & Scalability Considerations

### **Query Optimization**

**Problem**: With 1000s of jobs, queries get slow without proper indexing.

**Solution**:

```sql
-- Index for common query patterns
CREATE INDEX idx_discovered_at ON jobs(discovered_at DESC);
CREATE INDEX idx_apply_status ON jobs(apply_status);
CREATE INDEX idx_threshold_met_discovered ON jobs(threshold_met, discovered_at DESC);
CREATE INDEX idx_job_board_domain ON jobs(job_board_domain);

-- Example query: "Get top 5 jobs ready to apply"
SELECT * FROM jobs
WHERE apply_status = 'new'
  AND threshold_met = true
  AND job_board_domain NOT IN (SELECT DISTINCT backoff_key FROM error_backoff WHERE backoff_until > NOW())
ORDER BY fit_score DESC, discovered_at DESC
LIMIT 5;
-- With indexes: <10ms
-- Without indexes: 500-1000ms
```

### **Batch Insert Optimization**

```python
# Slow: 100 individual inserts
for job in jobs:
    db.jobs.insert(job)  # 100 round trips

# Fast: Batch insert
db.jobs.insert_many(jobs)  # 1 round trip
```

### **Caching Strategy**

```python
# Cache website registry (changes rarely)
@cache(ttl=3600)  # Refresh hourly
def get_website_registry(domain):
    return db.website_registry.get(domain)

# Cache user preferences (changes rarely)
@cache(ttl=7200)  # Refresh every 2 hours
def get_user_preferences():
    return db.schedule_config.get()
```

### **Log Compression**

```bash
# Rotate logs daily
/app/logs/autopilot-2024-12-20.log → autopilot-2024-12-20.log.gz (1 MB)
/app/logs/autopilot-2024-12-19.log → autopilot-2024-12-19.log.gz
...
# Keep 7 days (500 MB archive)
```

---

## Security & Compliance

### **Credential Encryption**

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend

def encrypt_password(password: str, master_key: bytes) -> str:
    """Encrypt password with master key"""
    cipher = Fernet(master_key)
    encrypted = cipher.encrypt(password.encode())
    return encrypted.decode()

def decrypt_password(encrypted_password: str, master_key: bytes) -> str:
    """Decrypt password with master key"""
    cipher = Fernet(master_key)
    decrypted = cipher.decrypt(encrypted_password.encode())
    return decrypted.decode()

# Master key stored in system keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
```

### **Audit Logging**

All actions logged in `applications` and `notification_log` tables:
- Every application attempt (success/failure)
- Every notification sent
- All errors and retries
- User cannot disable audit trail

### **Log Retention**

- Application logs: 7 days (daily rotation)
- Application history: 90 days (then deleted)
- Notification log: 30 days (then deleted)
- Schedule changes: Indefinite (for compliance)

---

## Implementation Timeline

| Phase | Task | Duration | Complexity |
|-------|------|----------|-----------|
| **P4** | Schema Migration | 2 days | Medium |
| | Error Classification | 3 days | Medium |
| | Retry Logic & Backoff | 4 days | Medium |
| | Structured Logging | 2 days | Small |
| | Batch Mode | 3 days | Medium |
| | CLI Commands | 1 day | Small |
| | Integration Tests | 3 days | Large |
| | **P4 Total** | **18 days** | |
| **P5** | Slack Integration | 2 days | Medium |
| | Email Integration | 2 days | Small |
| | Status Command | 2 days | Medium |
| | Health Endpoint | 2 days | Medium |
| | Docker Image | 3 days | Large |
| | Docker Compose | 1 day | Small |
| | Notification Audit | 1 day | Small |
| | K8s YAML | 1 day | Small |
| | Documentation | 2 days | Small |
| | E2E Tests | 3 days | Large |
| | **P5 Total** | **19 days** | |
| **Overall** | **Phases 4-5** | **~5 weeks** | |

---

## Success Metrics

### **Phase 4 Success Criteria**

- ✅ 95%+ error classification accuracy (transient/permanent/form)
- ✅ Transient errors retry with correct backoff (no 429s, no rate limit violations)
- ✅ All logs in valid JSON format (can parse with `jq`)
- ✅ Token usage reduced by 40-50% vs. per-job processing
- ✅ Batch mode applies to configured max jobs (e.g., 5) per cycle
- ✅ All CLI log commands work correctly
- ✅ 95%+ test pass rate (integration tests)

### **Phase 5 Success Criteria**

- ✅ Slack messages sent successfully and formatted correctly
- ✅ Email summaries sent at configured times
- ✅ `applypilot status` shows all required fields accurately
- ✅ Health endpoint responds in <100ms with correct status
- ✅ Docker container starts, runs polling, and accepts SIGTERM gracefully
- ✅ `docker-compose up` starts service without errors
- ✅ All notifications logged in `notification_log` table
- ✅ K8s deployment works with health probes
- ✅ 95%+ E2E test pass rate
- ✅ 99.9% uptime (3 nines) for scheduled polling

---

## Rollback Plan

If Phase 4-5 introduce issues:

1. **Database Rollback**:
   ```sql
   -- Keep jobs_v1_backup table for 30 days after migration
   ALTER TABLE jobs RENAME TO jobs_v2;
   ALTER TABLE jobs_v1_backup RENAME TO jobs;
   ```

2. **Code Rollback**:
   ```bash
   git checkout applypilot-phases-3
   pip install -r requirements-phase3.txt
   systemctl restart applypilot
   ```

3. **Disable New Features**:
   ```bash
   applypilot schedule --disable
   applypilot notifications disable
   ```

---

## What's Next (Future Phases)

### **Phase 6: Auto-Learning & Registry Optimization** (Future)
- Capture form structures on failure and auto-suggest registry updates
- Version control for registry entries
- Community registry sharing

### **Phase 7: Analytics Dashboard** (Future)
- Web dashboard with job timeline and success charts
- Historical analytics (success rate over time)
- Salary trends across job boards

### **Phase 8: Multi-Account Support** (Future)
- Support multiple job seeker accounts
- Account isolation in database
- Separate schedules/credentials per account

---

## Appendix: SQL Schema Complete Definition

[All schema definitions are provided in the "Database Schema Optimization" section above]

---

**Document Version**: 1.0  
**Date**: December 20, 2024  
**Status**: Ready for Implementation  
**Next Review**: After Phase 4 completion (Week 3)
