# ApplyPilot Improvements - Technical Specification

## Executive Summary & Goals

ApplyPilot's current setup process requires users to manually provide configuration on every run, and the pipeline requires explicit orchestration at each stage. This specification outlines two major improvements:

1. **Simplified Setup**: Streamline the `applypilot init` command with intelligent dependency detection, graceful tier degradation, integrated diagnostics, and persistent configuration to eliminate redundant data entry.
2. **Hands-Off Mode (Autopilot)**: A new `applypilot autopilot` command that runs the full 6-stage pipeline continuously in the background, polling job boards at configurable intervals and auto-applying to matching jobs with comprehensive logging and optional notifications.

### Primary Objectives

- **Reduce friction**: Users can start discovering jobs within seconds, not minutes
- **Enable passive job hunting**: Set up once, let ApplyPilot run continuously in the background
- **Graceful degradation**: Users without Tier 3 (full auto-apply) still benefit from Tier 1-2 discovery and scoring
- **Operational visibility**: Comprehensive logging and optional notifications keep users informed
- **Reliability**: Robust error handling, retries, rate-limit management, and health checks

### Success Criteria

- Setup completes in <2 minutes for experienced users; <5 minutes for first-time users
- Users can run `applypilot init && applypilot autopilot` and walk away
- Failed applications are logged with actionable error messages and retry logic
- Daemon can run for weeks without manual intervention (health checks, log rotation)
- Configuration persists across sessions; users never re-enter profile/search data

---

## Current State Analysis & Pain Points

### **Setup/Init Process (Status Quo)**

**Current Flow:**
1. User runs `applypilot init` → Wizard prompts for resume, profile, search config, API keys sequentially
2. User data stored in `~/.applypilot/` (profile.json, resume.txt, searches.yaml, .env)
3. **Problem**: Wizard doesn't check if dependencies are installed (Gemini API key, Claude Code CLI, Chrome)
4. **Problem**: If init fails partway, user must restart the entire flow
5. **Problem**: No validation of API keys until runtime (during first `run` command)
6. **Problem**: Users without Tier 3 see confusing errors about missing Claude Code CLI instead of graceful fallback
7. **Problem**: No integrated diagnostics; users must run separate `doctor` command to troubleshoot

**Current Dependency Checking:**
- `tier.py::check_tier(required)` exists but only checks at pipeline startup
- `doctor` command is separate and not integrated into init
- No early validation of API keys or critical dependencies

### **Pipeline Execution (Status Quo)**

**Current Flow:**
1. User runs `applypilot run discover enrich score tailor cover pdf` (or `all`)
2. Pipeline executes stages sequentially with dependency enforcement
3. Jobs written to SQLite after each stage
4. Logs written to stdout (rich formatting)
5. **Problem**: User must manually re-run pipeline to poll for new jobs
6. **Problem**: No built-in schedule or daemon mode
7. **Problem**: Auto-apply (`applypilot apply`) is a separate command, not integrated into pipeline
8. **Problem**: No background daemon support or Docker container guidance
9. **Problem**: Logging is console-only; no persistent audit trail for long-running processes
10. **Problem**: No handling of rate limits, network failures, or CAPTCHA challenges in a loop

---

## Functional Requirements

### **Requirement Group 1: Simplified Setup**

#### R1.1 Intelligent Dependency Detection
- During `applypilot init`, automatically detect:
  - Python version (≥3.11)
  - Node.js and npx availability (for Tier 3 apply)
  - Chrome/Chromium installation
  - Claude Code CLI installation
  - Gemini API key (check `GEMINI_API_KEY` environment variable)
  - OpenAI API key (check `OPENAI_API_KEY`)
  - Any custom LLM endpoint (check `LLM_URL`)
- **Output**: Display a "Dependency Report" card showing which tiers are available
- **No blocking**: Missing Tier 3 dependencies should NOT block init; offer SKIP/DEFER options instead

#### R1.2 Graceful Tier Degradation with SKIP/DEFER Options
- If Tier 1 (Python 3.11) is missing → Block init with helpful error message
- If Tier 2 (LLM API key) is missing → Offer to:
  - Skip LLM setup now and add API key later to `.env` file
  - Provide link to Gemini/OpenAI signup
- If Tier 3 (Claude Code CLI, Chrome) is missing → Offer to:
  - SKIP: Proceed with Tier 1-2 only (discovery + scoring only)
  - DEFER: Init only Tier 1-2, come back to add Tier 3 later
- **UX**: After init, show a "Ready to Use" checklist with next steps based on tier level

#### R1.3 Integrated Diagnostic Checkpoint
- During `applypilot init`, after gathering user input, run an embedded "diagnostic checkpoint":
  - Test LLM API key (make a minimal API call, catch rate-limit or auth errors)
  - Test resume parsing (ensure resume file is readable, >100 words)
  - Test profile data consistency (no required fields empty)
  - Test search config syntax (YAML valid, at least one search query)
  - For Tier 3: Test Claude Code CLI (`claude code --version`), Test Chrome binary existence
  - Display results as a pass/fail checklist
- **Error Recovery**: If a check fails, prompt user to fix or defer that tier

#### R1.4 Configuration Persistence (Eliminate Redundant Entry)
- Store all init outputs persistently:
  - Profile: `~/.applypilot/profile.json` (name, email, location, skills, experience)
  - Resume: `~/.applypilot/resume.txt` or `resume.pdf`
  - Search Config: `~/.applypilot/searches.yaml` (job titles, locations, filters)
  - API Keys: `~/.applypilot/.env` (GEMINI_API_KEY, OPENAI_API_KEY, etc.)
  - **NEW**: Persist "init state" to `~/.applypilot/init-state.json`:
    - Timestamp of last init
    - Tier level successfully configured (1, 2, or 3)
    - Which features were deferred (Tier 3 apply, CAPTCHA solving, etc.)
    - Init checksum of profile+resume (to detect if user changed data)
- **Rerun Behavior**: If user runs `applypilot init` again:
  - Load existing config and show as defaults (with option to skip fields)
  - Only prompt for changed fields
  - Run diagnostic checkpoint again (in case API keys expired or dependencies uninstalled)

#### R1.5 Early API Key Validation
- In diagnostic checkpoint, validate API keys:
  - **Gemini API Key**: Call `GenerativeAI.generate_content()` with a test prompt, catch quota/auth errors
  - **OpenAI API Key**: Call `ChatCompletion.create()` with a test message, catch auth/quota errors
  - **Provide helpful errors**: e.g., "Gemini API key invalid. Check https://makersuite.google.com/app/apikey" or "Rate limit reached. Upgrade plan or try again in 1 hour"
- **Conditional Flow**: If API key fails:
  - For Tier 2 required → Error blocks init
  - For Tier 3 optional → Warn but allow deferral

---

### **Requirement Group 2: Hands-Off Mode (Autopilot Command)**

#### R2.1 New `applypilot autopilot` Command
- **Purpose**: Run the full 6-stage pipeline (`discover → enrich → score → tailor → cover → pdf → apply`) in a continuous loop
- **Usage**: `applypilot autopilot [OPTIONS]`
- **Key Options**:
  - `--poll-interval HOURS`: Poll job boards every N hours (default: 8)
  - `--score-threshold INT`: Only tailor/apply to jobs scoring ≥ threshold (default: 7)
  - `--max-applications INT`: Stop after applying to N jobs per poll cycle (default: unlimited)
  - `--dry-run`: Discover and score only; don't tailor, cover letters, or apply
  - `--daemon`: Run as background daemon (fork process, detach from terminal)
  - `--log-level {DEBUG, INFO, WARNING, ERROR}`: Log verbosity (default: INFO)
  - `--docker`: Indicate we're running in a Docker container (use shared volumes, skip Chrome binary check)

#### R2.2 Continuous Loop & Polling
- **Main Loop**:
  ```
  while True:
    1. Run discovery (find new jobs since last poll)
    2. Run enrichment (fetch full descriptions for new jobs)
    3. Run scoring (rank jobs against resume)
    4. If score ≥ threshold:
       a. Run tailoring (customize resume per job)
       b. Generate cover letters
       c. Generate PDFs
    5. Run apply (attempt automated application)
    6. Log all results to timestamped log file
    7. Sleep for --poll-interval hours
    8. Health check: restart if process dead or too much memory
  ```
- **Frequency Control**:
  - Track last discovery time per job board in database (`last_polled_at` column)
  - Only re-poll boards that haven't been polled in ≥ `--poll-interval` hours
  - **Offset staggering**: If poll-interval is 8h and 3 job boards exist, stagger polls by ~2.7h to avoid thundering herd

#### R2.3 Auto-Apply Logic & Thresholds
- **Apply Criteria**:
  - Job score ≥ `--score-threshold` (default 7)
  - Tailored resume exists (or can be generated)
  - Cover letter exists (or can be generated)
  - Application URL is known and accessible
  - Not already applied to this job (check `applied_at` column)
- **Application Limits**:
  - `--max-applications`: Max N applications per poll cycle
  - Rate limit to 2 applications per minute (by default) to avoid IP blocking
  - Configurable via `--apply-rate-limit` (applications per minute)

#### R2.4 Graceful Failure Handling & Retries
- **Discoverable Errors** (application failed mid-way):
  - Record error to `apply_error` column in database
  - Increment `apply_attempts` counter
  - Retry up to 3 times with exponential backoff (1s, 4s, 16s) on same job
  - After 3 failures, mark as "apply_failed" and move to next job
- **Skippable Errors** (transient, can retry later):
  - Network timeout → Skip job, retry in next poll cycle
  - CAPTCHA encountered → Skip job, flag for manual review, offer notification
  - Rate limit (429) → Pause apply for 60s, then continue
  - Site temporarily down (503) → Skip job, retry in next cycle
- **Non-recoverable Errors** (log and skip):
  - Invalid application URL → Mark as "invalid_url", don't retry
  - Application already closed → Mark as "job_closed", don't retry
  - Authentication required (blocked site) → Mark as "blocked_site", don't retry

#### R2.5 Comprehensive Logging
- **Log File Location**: `~/.applypilot/logs/autopilot-YYYY-MM-DD.log` (daily rotation)
- **Log Format** (structured, JSON for parsing):
  ```json
  {
    "timestamp": "2024-12-15T10:30:45Z",
    "level": "INFO",
    "stage": "discovery",
    "action": "discover_complete",
    "new_jobs": 42,
    "duration_s": 125,
    "errors": []
  }
  ```
- **Log Entries** (one per significant event):
  - Poll cycle started/completed (with duration and job counts)
  - Discovery: # new jobs, # deduped, errors per board
  - Enrichment: # details fetched, # errors, retry count
  - Scoring: # jobs scored, avg score, # above threshold
  - Tailoring: # tailored, # failed, error details
  - Cover letter generation: # generated, # failed
  - Application: # attempted, # successful, # failed, error details
  - Health check: memory used, CPU, process status
- **Log Rotation**: 
  - Daily rotation (max 7 days of logs)
  - Compressed logs archived to `~/.applypilot/logs/archive/`
  - Trimmed to max 500MB total

#### R2.6 Optional Notifications (Slack/Email)
- **Slack Integration**:
  - `--slack-webhook-url`: Webhook URL for posting job matches
  - `--notify-on {matches, applications, errors, all}`: What to notify on
  - **Message format**:
    ```
    🎯 New Job Match! (Score: 8/10)
    Company: Acme Inc
    Title: Senior Software Engineer
    Salary: $150-180k
    Location: San Francisco, CA
    Link: https://acme.inc/jobs/123
    ---
    Tailored resume ready | Cover letter ready | Auto-applied ✓
    ```
- **Email Integration**:
  - `--email-to`: Email address to receive notifications
  - `--email-from`: SMTP from address
  - `--smtp-server`, `--smtp-port`, `--smtp-password`: SMTP credentials
  - **Message**: Similar format to Slack, sent once per matching job
- **Notification Throttling**: Max 1 notification per 5 minutes to avoid spam

#### R2.7 Daemon Mode & Background Execution
- **Daemon Option** (`--daemon`):
  - Fork process, detach from terminal
  - Write PID file to `~/.applypilot/autopilot.pid`
  - Redirect stdout/stderr to log file
  - No SIGTERM on parent exit (child remains running)
- **Status Checking**:
  - `applypilot daemon status`: Read PID file, check if process alive
  - `applypilot daemon stop`: Read PID file, send SIGTERM, wait 10s for graceful shutdown
  - `applypilot daemon logs [--tail N]`: Tail the latest log file
- **Docker Support**:
  - `--docker` flag indicates running in container
  - Don't daemonize (let Docker container be the daemon)
  - Mount `~/.applypilot/` as volume for persistence
  - Health check endpoint: HTTP endpoint on port 8000 responding with uptime, job stats, last poll time

---

## Implementation Phases

### **Phase 1: Enhanced Init & Dependency Detection** (Weeks 1-2)
**Objective**: Refactor `applypilot init` with intelligent dependency detection, tier degradation, and integrated diagnostics.

**Key Deliverables**:
- Refactored `applypilot init` command with SKIP/DEFER options
- New `DependencyDetector` class
- New `DiagnosticCheckpoint` class with API key validation
- New `InitState` model for persisting init metadata
- Updated wizard UX with tier-based checklists

**Estimated Scope**: Medium (~40-60 story points)

**Phase Dependencies**: None (can start immediately)

---

### **Phase 2: Database Schema Enhancements** (Week 1, in parallel)
**Objective**: Add columns to support polling, daemon state, and continuous operation.

**Key Deliverables**:
- New database columns: `last_polled_at`, `poll_cycle_id`, `apply_attempts`, `apply_error`, `apply_error_at`
- New `daemon_state` table for heartbeat and health metadata
- New `poll_history` table for tracking poll cycles
- Database migration strategy

**Estimated Scope**: Small (~10-15 story points)

**Phase Dependencies**: None (can start immediately)

---

### **Phase 3: Autopilot Core Loop** (Weeks 2-3)
**Objective**: Implement the `applypilot autopilot` command with continuous polling, stage orchestration, and apply logic.

**Key Deliverables**:
- New `AutopilotOrchestrator` class managing the main loop
- Integration of existing pipeline with autopilot-specific options
- Polling scheduler and deduplication logic
- Apply rate limiting and queuing

**Estimated Scope**: Large (~60-80 story points)

**Phase Dependencies**: Phase 1 (init), Phase 2 (database)

---

### **Phase 4: Error Handling, Retries & Logging** (Weeks 3-4)
**Objective**: Robust error handling, retry logic, comprehensive logging.

**Key Deliverables**:
- Retry logic for transient errors (network, rate limits, CAPTCHA)
- Structured logging framework (JSON format)
- Log rotation and archiving
- Health check and memory management
- Error classification and actionable messages

**Estimated Scope**: Large (~60-80 story points)

**Phase Dependencies**: Phase 3 (autopilot core)

---

### **Phase 5: Notifications & Daemon Mode** (Weeks 4-5)
**Objective**: Optional notifications, daemon support, Docker containerization guide.

**Key Deliverables**:
- Slack/email notification integration
- Daemon mode (fork, detach, PID file management)
- `applypilot daemon` subcommand (status, stop, logs)
- Docker setup guide and health check endpoint
- Systemd service file template

**Estimated Scope**: Medium (~40-50 story points)

**Phase Dependencies**: Phase 4 (logging), Phase 3 (autopilot core)

---

## Data Schema / State Management

### **Database Schema Changes**

#### **Existing `jobs` Table (Enhanced)**

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  
  -- Discovery stage
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  salary TEXT,
  description TEXT,
  location TEXT,
  site TEXT,
  strategy TEXT,  -- e.g., "jobspy_linkedin", "workday_acme"
  discovered_at TIMESTAMP NOT NULL,
  
  -- Enrichment stage
  full_description TEXT,
  application_url TEXT,
  detail_scraped_at TIMESTAMP,
  detail_error TEXT,
  
  -- Scoring stage
  fit_score INTEGER,  -- 1-10
  score_reasoning TEXT,
  scored_at TIMESTAMP,
  
  -- Tailoring stage
  tailored_resume_path TEXT,
  tailored_at TIMESTAMP,
  tailor_attempts INTEGER DEFAULT 0,
  tailor_error TEXT,
  
  -- Cover letter stage
  cover_letter_path TEXT,
  cover_letter_at TIMESTAMP,
  cover_attempts INTEGER DEFAULT 0,
  cover_error TEXT,
  
  -- PDF stage
  pdf_resume_path TEXT,
  pdf_generated_at TIMESTAMP,
  
  -- Application stage (NEW)
  applied_at TIMESTAMP,
  apply_attempts INTEGER DEFAULT 0,
  apply_error TEXT,
  apply_error_at TIMESTAMP,
  apply_error_type TEXT,  -- e.g., "CAPTCHA", "RATE_LIMIT", "NETWORK", "BLOCKED_SITE"
  
  -- Polling & daemon state (NEW)
  poll_cycle_id TEXT,  -- FK to poll_history.id
  last_polled_at TIMESTAMP,  -- Last time this job's URL was checked for updates
  skipped_reason TEXT,  -- Why job was not tailored/applied (e.g., "score too low", "duplicate")
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for autopilot queries
CREATE INDEX idx_jobs_discovered_at ON jobs(discovered_at DESC);
CREATE INDEX idx_jobs_fit_score ON jobs(fit_score DESC);
CREATE INDEX idx_jobs_applied_at ON jobs(applied_at);
CREATE INDEX idx_jobs_poll_cycle ON jobs(poll_cycle_id);
CREATE INDEX idx_jobs_site_polled ON jobs(site, last_polled_at);
```

#### **New `poll_history` Table**
Tracks each autopilot poll cycle for auditing and diagnostics.

```sql
CREATE TABLE poll_history (
  id TEXT PRIMARY KEY,  -- UUID or "autopilot-2024-12-15-10-30"
  poll_started_at TIMESTAMP NOT NULL,
  poll_completed_at TIMESTAMP,
  poll_duration_s INTEGER,
  
  -- Discovery results
  new_jobs_count INTEGER,
  deduped_jobs_count INTEGER,
  discovery_errors TEXT,  -- JSON list of errors per board
  
  -- Pipeline results
  enriched_count INTEGER,
  scored_count INTEGER,
  above_threshold_count INTEGER,
  tailored_count INTEGER,
  cover_letters_count INTEGER,
  
  -- Application results
  apply_attempted_count INTEGER,
  apply_success_count INTEGER,
  apply_failure_count INTEGER,
  
  -- Errors and status
  status TEXT,  -- "completed", "interrupted", "error"
  errors TEXT,  -- JSON list of all errors during poll cycle
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_poll_history_started ON poll_history(poll_started_at DESC);
```

#### **New `daemon_state` Table**
Tracks daemon health, heartbeat, and configuration for long-running processes.

```sql
CREATE TABLE daemon_state (
  id TEXT PRIMARY KEY,  -- Always "autopilot" for this implementation
  pid INTEGER,
  started_at TIMESTAMP NOT NULL,
  last_heartbeat TIMESTAMP NOT NULL,
  
  -- Configuration (persisted for reference)
  poll_interval_hours INTEGER,
  score_threshold INTEGER,
  max_applications_per_cycle INTEGER,
  dry_run BOOLEAN,
  
  -- Health metrics
  total_jobs_discovered BIGINT,
  total_jobs_applied BIGINT,
  total_applications_failed BIGINT,
  memory_usage_mb FLOAT,
  cpu_usage_percent FLOAT,
  last_poll_cycle_id TEXT,
  
  -- Flags
  paused BOOLEAN DEFAULT 0,
  pause_reason TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **New `api_key_cache` Table** (Optional)
Cache API key validation status to avoid excessive checks.

```sql
CREATE TABLE api_key_cache (
  key_type TEXT PRIMARY KEY,  -- "GEMINI", "OPENAI", "CAPSOLVER"
  last_validated_at TIMESTAMP,
  is_valid BOOLEAN,
  error_message TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### **Configuration Persistence (New `init-state.json`)**

```json
{
  "version": "1.0",
  "last_init_at": "2024-12-15T10:30:45Z",
  "init_checksum": "sha256:abc123...",
  "tier_configured": 2,
  "tier_capabilities": {
    "discovery": true,
    "enrichment": true,
    "scoring": true,
    "tailoring": false,
    "cover_letters": false,
    "auto_apply": false,
    "captcha_solving": false
  },
  "deferred_features": [
    {
      "name": "auto_apply",
      "reason": "Claude Code CLI not found",
      "setup_instructions": "npm install -g @anthropic-ai/claude-code"
    },
    {
      "name": "captcha_solving",
      "reason": "Not configured",
      "setup_instructions": "Set CAPSOLVER_API_KEY environment variable"
    }
  ],
  "profile_sha256": "def456...",
  "resume_sha256": "ghi789...",
  "searches_config_sha256": "jkl012..."
}
```

---

## User Flows & Workflows

### **Flow 1: First-Time Setup (Simplified Init)**

```
┌─────────────────────────────────────────────────────────────┐
│ User runs: applypilot init                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │ Dependency Detection Phase      │
            ├─────────────────────────────────┤
            │ • Python 3.11+ ✓                │
            │ • Node.js → Not found ⚠️        │
            │ • Chrome → Found                │
            │ • Claude CLI → Not found ⚠️     │
            │ • Gemini API → Not set ⚠️       │
            └─────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │ Tier Assessment                 │
            ├─────────────────────────────────┤
            │ ✓ Tier 1: Available             │
            │ ⚠️  Tier 2: LLM key needed      │
            │ ✗ Tier 3: (disabled)            │
            └─────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
    ┌──────────────────┐     ┌──────────────────────────┐
    │ Resume Input     │     │ Profile Input            │
    │ (Guided upload)  │     │ • Name, Email, Location  │
    └──────────────────┘     │ • Key skills & links     │
              │              └──────────────────────────┘
              │                            │
              └─────────────┬──────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │ Search Config Input             │
            │ • Job titles (Software Engineer)│
            │ • Locations (Remote, SF, NYC)   │
            │ • Excluded companies (optional) │
            └─────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │ Tier 2 Setup (if not configured)│
            ├─────────────────────────────────┤
            │ Gemini API key: [______]        │
            │ (Or) Skip for now & add later   │
            └─────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
      ┌─────────────────┐      ┌───────────────────┐
      │ API Key Provided│      │ API Key Deferred  │
      └─────────────────┘      └───────────────────┘
              │                            │
              ▼                            ▼
    ┌──────────────────┐      ┌───────────────────┐
    │ Test API key:    │      │ Proceeding without│
    │ • Call Gemini    │      │ Tier 2. To enable │
    │ • Validate auth  │      │ later, set env var│
    └──────────────────┘      └───────────────────┘
              │
      ┌───────┴───────┐
      │               │
      ▼ Valid         ▼ Invalid
    ┌───┐      ┌──────────────────┐
    │✓  │      │ Error: Invalid key│
    └───┘      │ Check console     │
      │        └──────────────────┘
      │                 │
      │         (Retry or skip?)
      │                 │
      ▼                 ▼
  ┌─────────────────────────────────┐
  │ Tier 3 Setup (if available)     │
  ├─────────────────────────────────┤
  │ □ Auto-apply (Claude CLI) SKIP  │
  │ □ CAPTCHA solving SKIP          │
  └─────────────────────────────────┘
              │
              ▼
  ┌─────────────────────────────────┐
  │ Diagnostic Checkpoint (All-In)  │
  ├─────────────────────────────────┤
  │ ✓ Resume valid (512 words)      │
  │ ✓ Profile data valid            │
  │ ✓ Searches configured           │
  │ ✓ Gemini API accessible         │
  │ ✗ Claude CLI not found (OK)     │
  │ ✗ Chrome not found (OK, DEFER)  │
  └─────────────────────────────────┘
              │
              ▼
  ┌─────────────────────────────────┐
  │ "Ready to Use" Checklist        │
  ├─────────────────────────────────┤
  │ ✓ Discovery & Scoring ready     │
  │ ⚠️  Auto-apply deferred:        │
  │    To enable, install:          │
  │    npm install -g @anthropic... │
  │    Then run: applypilot init    │
  │                                 │
  │ Next steps:                     │
  │ 1. applypilot run discover      │
  │ 2. Review jobs & scores         │
  │ 3. applypilot autopilot --help  │
  └─────────────────────────────────┘
              │
              ▼
    ┌──────────────────┐
    │ Saved to:        │
    │ ~/.applypilot/   │
    └──────────────────┘
```

---

### **Flow 2: Autopilot Continuous Mode**

```
┌──────────────────────────────────────────────────────────────┐
│ User runs: applypilot autopilot --poll-interval 8 \         │
│            --score-threshold 7 --daemon                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌──────────────────────────────────┐
            │ Autopilot Initialization         │
            ├──────────────────────────────────┤
            │ • Load config (poll-interval, etc)
            │ • Create daemon_state record      │
            │ • Write PID file                  │
            │ • Fork & daemonize                │
            │ • Redirect output to log file     │
            └──────────────────────────────────┘
                            │
                            ▼
            ┌──────────────────────────────────┐
            │ Main Loop (while True):           │
            └──────────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
                ▼                        ▼
         ┌────────────────┐    ┌────────────────────┐
         │ Poll Due Check │    │ Sleep              │
         │ (site-specific │    │ (remaining seconds │
         │ last_polled_at)│    │ until next poll)   │
         └────────────────┘    └────────────────────┘
              │                          ▲
              │ Need poll?               │
              ├──No─────────────────────┘
              │ (sleep and loop)
              │
              ▼ Yes
         ┌────────────────────────────────┐
         │ Poll Cycle Started             │
         │ • Create poll_history record   │
         │ • Log: poll_cycle_id, time     │
         └────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
    ┌──────────────────┐   ┌────────────────────┐
    │ Discovery        │   │ (Parallel if       │
    │ • Find new jobs  │   │  --stream enabled) │
    │ • Dedup vs DB    │   │                    │
    │ • Update DB      │   │ Enrichment         │
    └──────────────────┘   │ • Fetch details    │
         │                 │ • Extract URLs     │
         ▼                 └────────────────────┘
    ┌──────────────────┐           │
    │ Error Handling:  │           ▼
    │ • Board down?    │   ┌────────────────────┐
    │   Skip board,    │   │ Error Handling:    │
    │   retry next cycle  │ • Retry failed      │
    │ • Rate limited?  │   │   enrichments      │
    │   Backoff & retry   │ • Record errors     │
    └──────────────────┘   └────────────────────┘
         │                        │
         └─────────────┬──────────┘
                       ▼
              ┌──────────────────┐
              │ Scoring          │
              │ • Score jobs     │
              │ • Filter <7      │
              │ • Create subset  │
              └──────────────────┘
                       │
      ┌────────────────┴────────────────┐
      │                                 │
      ▼                                 ▼
 ┌──────────────────┐        ┌──────────────────┐
 │ Score ≥ 7?       │        │ Below threshold  │
 └──────────────────┘        │ • Log skipped    │
      │                       │ • Don't tailor   │
      ├─ No → Skip to next    └──────────────────┘
      │
      ▼ Yes
 ┌──────────────────┐
 │ Tailoring        │
 │ • Customize      │
 │   resume per job │
 │ • Save to file   │
 └──────────────────┘
      │
      ├─Error?
      │ └─ Retry up to 3x with backoff
      │    If all fail: Record error, skip apply
      │
      ▼ Success
 ┌──────────────────┐
 │ Cover Letter     │
 │ • Generate       │
 │ • Save to file   │
 └──────────────────┘
      │
      ├─Error?
      │ └─ Retry up to 3x with backoff
      │    If all fail: Use template or skip
      │
      ▼ Success
 ┌──────────────────┐
 │ PDF Generation   │
 │ • Convert resume │
 │ • Store path     │
 └──────────────────┘
      │
      ▼ Success
 ┌──────────────────┐
 │ Apply Orchestrator
 │ • Apply limit?   │
 │ • Rate limit?    │
 │ • Attempt apply  │
 └──────────────────┘
      │
      ├─ CAPTCHA?
      │  └─ Skip job, flag for manual,
      │     send notification
      │
      ├─ Rate limit?
      │  └─ Pause 60s, retry
      │
      ├─ Network error?
      │  └─ Retry next cycle
      │
      ├─ Already applied?
      │  └─ Skip (dedup)
      │
      ├─ Site blocked?
      │  └─ Record, skip permanently
      │
      ▼ Success
 ┌──────────────────┐
 │ Record applied_at │
 │ Send notification │
 │ (optional)        │
 └──────────────────┘
      │
      ▼
 ┌──────────────────┐
 │ Apply rate limit │
 │ (2/min by default)
 └──────────────────┘
      │
      ▼
 ┌──────────────────────────────┐
 │ Poll Cycle End               │
 │ • Update poll_history        │
 │ • Log stats                  │
 │ • Health check               │
 └──────────────────────────────┘
      │
      ▼
 ┌──────────────────┐
 │ Calculate sleep  │
 │ until next poll  │
 └──────────────────┘
      │
      ▼ (Loop back to poll check)
```

---

### **Flow 3: Error Recovery & Retries**

```
Transient Error (Network, Rate Limit, CAPTCHA)
│
├─ Network timeout?
│  └─ Sleep 30s, retry current job (max 3x per cycle)
│     If all fail: Log error, retry next cycle
│
├─ Rate limit (429)?
│  └─ Pause apply for 60s, resume
│
├─ CAPTCHA?
│  └─ Skip job, flag "captcha_encountered"
│     Send notification: "Manual review needed for URL"
│     Retry in next cycle
│
├─ Site temporarily down (5xx)?
│  └─ Skip job, retry next cycle
│
└─ Credentials required?
   └─ Mark as "blocked_site", skip permanently

Non-Transient Error (Invalid URL, Already Closed, Blocked)
│
├─ Invalid URL (404, no application link)?
│  └─ Mark as "invalid_url", don't retry
│
├─ Application already closed?
│  └─ Mark as "job_closed", don't retry
│
├─ Site authentication blocked?
│  └─ Mark as "blocked_site", don't retry
│
└─ Fabrication detected in resume?
   └─ Fail fast, don't apply, log issue, alert user
```

---

## API Routes & Contracts

### **New CLI Commands**

#### **1. `applypilot autopilot [OPTIONS]`**

**Purpose**: Run the full 6-stage pipeline in a continuous loop.

**Command Signature**:
```bash
applypilot autopilot \
  --poll-interval 8 \
  --score-threshold 7 \
  --max-applications 10 \
  --dry-run false \
  --daemon false \
  --log-level INFO \
  --slack-webhook-url "https://hooks.slack.com/..." \
  --notify-on "matches,applications" \
  --apply-rate-limit 2 \
  --docker false
```

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--poll-interval` | int | 8 | Hours between job board polls |
| `--score-threshold` | int | 7 | Min score (1-10) to tailor/apply |
| `--max-applications` | int | unlimited | Max applications per poll cycle |
| `--dry-run` | bool | false | Discover/score only; skip tailor/apply |
| `--daemon` | bool | false | Fork to background, detach from terminal |
| `--log-level` | str | INFO | Logging verbosity (DEBUG/INFO/WARNING/ERROR) |
| `--slack-webhook-url` | str | None | Slack webhook for notifications |
| `--notify-on` | str | "all" | What events trigger notifications (matches/applications/errors/all) |
| `--apply-rate-limit` | int | 2 | Applications per minute |
| `--docker` | bool | false | Running in Docker container |

**Exit Codes**:
- `0`: Successful completion or graceful shutdown
- `1`: Configuration error (missing config, invalid paths)
- `2`: Initialization error (dependency missing, API key invalid)
- `3`: Runtime error (unhandled exception, fatal error)
- `130`: Terminated by SIGINT (Ctrl+C)

**Output** (to stdout and log file):
```
🚀 ApplyPilot Autopilot Started
├─ Poll Interval: 8 hours
├─ Score Threshold: 7/10
├─ Max Applications: unlimited
├─ Dry Run: false
├─ Notifications: Slack (matches, applications)
└─ Log File: ~/.applypilot/logs/autopilot-2024-12-15.log

[2024-12-15 10:30:45] Poll Cycle #1 Started
  • Discovery: Scraping 8 job boards...
  • Found 42 new jobs
  • Enrichment: Fetching details... (35/42 complete)
  • Scoring: 28 jobs above threshold
  • Tailoring: 4 jobs in progress...
  • Applications: 2 successful, 1 failed (CAPTCHA)
  • Poll Cycle Complete: 47 jobs processed, 2 applied
  • Next poll: 2024-12-15 18:30:45

[2024-12-15 18:30:45] Poll Cycle #2 Started
...
```

---

#### **2. `applypilot daemon [SUBCOMMAND]`**

**Purpose**: Manage autopilot daemon (start, stop, status, logs).

**Subcommands**:

##### **a. `applypilot daemon status`**
```bash
applypilot daemon status
```

**Output**:
```
ApplyPilot Daemon Status
├─ Status: Running ✓
├─ PID: 12345
├─ Started: 2024-12-15 10:30:45 UTC
├─ Uptime: 8 hours 15 minutes
├─ Memory: 145 MB
├─ CPU: 0.3%
├─ Last Poll: 2024-12-15 18:30:45 UTC
├─ Total Discovered: 256 jobs
├─ Total Applied: 12 jobs
├─ Poll Cycles: 3
└─ Log File: ~/.applypilot/logs/autopilot-2024-12-15.log
```

##### **b. `applypilot daemon stop`**
```bash
applypilot daemon stop [--force]
```

**Output**:
```
Stopping ApplyPilot Daemon (PID 12345)...
Sent SIGTERM, waiting for graceful shutdown...
✓ Daemon stopped gracefully.
Final stats:
  • Total jobs discovered: 256
  • Total applications: 12
  • Uptime: 8 hours 15 minutes
```

**Options**:
- `--force`: Send SIGKILL instead of SIGTERM (ungraceful)

##### **c. `applypilot daemon logs [OPTIONS]`**
```bash
applypilot daemon logs --tail 50 --follow
```

**Output**: Last 50 lines of current log file, optionally with `--follow` (like `tail -f`)

**Options**:
- `--tail N`: Show last N lines (default 50)
- `--follow`: Follow log file (like `tail -f`)
- `--date YYYY-MM-DD`: Show logs from specific date

---

#### **3. `applypilot init [OPTIONS]` (Refactored)**

**Purpose**: Simplified, dependency-aware setup.

**Command Signature**:
```bash
applypilot init \
  --skip-tier-3 false \
  --validate-api-keys true \
  --reconfigure false
```

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--skip-tier-3` | bool | false | Skip Tier 3 (auto-apply) setup |
| `--validate-api-keys` | bool | true | Test API keys during init |
| `--reconfigure` | bool | false | Re-prompt for all fields (ignore saved config) |

**Output**:
```
🔍 Dependency Detection
├─ Python 3.11+ ✓
├─ Node.js/npx ✗ (optional, needed for auto-apply)
├─ Chrome/Chromium ✓
├─ Claude Code CLI ✗ (optional, needed for auto-apply)
├─ Gemini API Key ✗ (required for scoring)
└─ OpenAI API Key ✗ (alternative to Gemini)

📋 Tier Assessment
├─ Tier 1 (Discovery): Available ✓
├─ Tier 2 (Scoring): Available if LLM key set ⚠️
└─ Tier 3 (Auto-Apply): Disabled (missing dependencies) ✗

[Interactive Prompts...]

✅ Diagnostic Checkpoint
├─ Resume valid ✓ (512 words)
├─ Profile data valid ✓
├─ Searches configured ✓ (3 search queries)
├─ Gemini API accessible ✓
└─ Claude CLI not found (OK for now) ⚠️

🚀 Ready to Use!
├─ Tier 1-2 ready: Discovery & Scoring
├─ To enable auto-apply (Tier 3):
│  1. npm install -g @anthropic-ai/claude-code
│  2. applypilot init
└─ Next step: applypilot run discover
```

---

#### **4. `applypilot doctor` (Existing, Unchanged)**

**Purpose**: Diagnostic utility (existing, no changes needed for this spec).

```bash
applypilot doctor
```

---

### **Configuration Additions (`.env` Variables)**

New environment variables supported:

```bash
# New Autopilot Configuration
APPLYPILOT_POLL_INTERVAL=8                          # Default poll interval (hours)
APPLYPILOT_SCORE_THRESHOLD=7                        # Default score threshold (1-10)
APPLYPILOT_MAX_APPLICATIONS_PER_CYCLE=unlimited     # Max applications per poll
APPLYPILOT_APPLY_RATE_LIMIT=2                       # Applications per minute
APPLYPILOT_DRY_RUN=false                            # Discover/score only, no tailor/apply

# Notification Configuration
APPLYPILOT_SLACK_WEBHOOK_URL=https://hooks.slack.com/... # Slack webhook
APPLYPILOT_NOTIFY_ON=matches,applications,errors    # Event types for notifications
APPLYPILOT_EMAIL_TO=user@example.com                # Email recipient
APPLYPILOT_EMAIL_FROM=noreply@applypilot.dev        # SMTP from address
APPLYPILOT_SMTP_SERVER=smtp.gmail.com               # SMTP server
APPLYPILOT_SMTP_PORT=587                            # SMTP port
APPLYPILOT_SMTP_PASSWORD=***                        # SMTP password (or use --env-file)

# Daemon Configuration
APPLYPILOT_DAEMON_ENABLED=true                      # Allow daemon mode
APPLYPILOT_HEALTH_CHECK_PORT=8000                   # Health check HTTP port
APPLYPILOT_LOG_DIR=~/.applypilot/logs               # Log directory
APPLYPILOT_LOG_RETENTION_DAYS=7                     # Keep N days of logs
APPLYPILOT_LOG_MAX_SIZE_MB=500                      # Max total size of logs

# Retry Configuration
APPLYPILOT_RETRY_MAX_ATTEMPTS=3                     # Max retries for failed applications
APPLYPILOT_RETRY_BACKOFF_SECONDS=1,4,16             # Backoff schedule (exponential)
APPLYPILOT_NETWORK_TIMEOUT_SECONDS=30               # Network timeout

# Docker
APPLYPILOT_DOCKER=false                             # Running in Docker container
```

---

## Edge Cases & Error Handling

### **Edge Case 1: API Key Expiration or Rate Limit**

**Scenario**: During autopilot run, Gemini API key expires or rate limit is hit.

**Detection**:
- API call returns 401 (auth error) or 429 (rate limit)
- Error logged with timestamp and job ID

**Handling**:
- **Auth error (401)**: Immediately pause autopilot, send notification, log error with instructions to update `.env`, write status to `daemon_state.pause_reason = "API_KEY_EXPIRED"`
- **Rate limit (429)**: Parse retry-after header, sleep for recommended duration (usually 60s), resume with reduced apply rate (1 app/min instead of 2)
- **Recovery**: User updates `.env`, sends SIGTERM to daemon, restarts with fresh credentials

**Implementation**:
```python
def handle_api_error(error):
    if error.status_code == 401:
        daemon_state.paused = True
        daemon_state.pause_reason = "API_KEY_EXPIRED"
        notify_user("API key expired. Update .env and restart daemon.")
    elif error.status_code == 429:
        retry_after = error.headers.get("Retry-After", 60)
        sleep(int(retry_after))
        apply_rate_limit.reduce(multiplier=0.5)  # 2 apps/min -> 1 app/min
```

---

### **Edge Case 2: CAPTCHA Encountered During Apply**

**Scenario**: Application flow requires CAPTCHA solving; Claude Code CLI can't solve it.

**Detection**:
- Apply job returns status "CAPTCHA_REQUIRED" or fails with known CAPTCHA selectors

**Handling**:
- Mark job as "apply_error_type: CAPTCHA"
- Skip job (don't retry)
- Flag job with `skipped_reason = "CAPTCHA"` for manual review
- Send optional Slack notification: "🔐 Manual Review Needed: CAPTCHA at Company X"
- In next poll cycle, check if CAPTCHA flag persists (it likely will), mark permanently blocked

**Implementation**:
```python
if "captcha" in apply_error.lower() or captcha_selector_detected():
    job.apply_error_type = "CAPTCHA"
    job.skipped_reason = "CAPTCHA"
    notify_slack("🔐 Manual review needed", job)
    continue_next_job()
```

---

### **Edge Case 3: Job Already Applied (Deduplication)**

**Scenario**: User manually applied to a job earlier in the day; autopilot tries to apply again.

**Detection**:
- Claude Code CLI detects "Already applied" or "You've already submitted" message on screen
- Application URL matches an existing job in DB with `applied_at` set

**Handling**:
- Check `jobs.applied_at IS NOT NULL` before attempting apply
- If already applied, log "Skipped (already applied)" and increment counter
- Never increment `apply_attempts` for dedup case

**Implementation**:
```python
if job.applied_at is not None:
    logger.info(f"Job already applied: {job.url}")
    stats.skipped_already_applied += 1
    continue
```

---

### **Edge Case 4: Job Posting Closed/Removed**

**Scenario**: Job board returns 404 or "This job is no longer available" during enrichment or apply.

**Detection**:
- HTTP 404 response from job URL
- Page text contains "no longer accepting applications" or "this position is closed"

**Handling**:
- Mark job as `apply_error_type = "JOB_CLOSED"`
- Set `skipped_reason = "job_closed"`
- Don't retry in future cycles
- Log info-level message (not error, since it's expected)

**Implementation**:
```python
if response.status_code == 404 or is_job_closed_marker(page_text):
    job.apply_error_type = "JOB_CLOSED"
    job.skipped_reason = "job_closed"
    logger.info(f"Job closed: {job.url}")
    continue
```

---

### **Edge Case 5: Network Failure During Poll Cycle**

**Scenario**: Internet connection drops during discovery phase; discovery fails partway through.

**Detection**:
- Socket timeout or connection refused error
- Partial job results (e.g., 20 jobs from JobSpy, but LinkedIn scraper fails)

**Handling**:
- Catch exception in `discovery()` phase
- Log partial results and error details
- Increment `poll_history.discovery_errors` with failed board names
- Continue to enrichment with jobs discovered so far (don't fail entire poll)
- Set `poll_history.status = "completed_with_errors"`
- In next cycle, reattempt failed boards

**Implementation**:
```python
discovered_jobs = []
for board in boards:
    try:
        jobs = discover_from_board(board)
        discovered_jobs.extend(jobs)
    except NetworkError as e:
        logger.warning(f"Board {board} failed: {e}")
        discovery_errors.append({"board": board, "error": str(e)})
        continue  # Try next board, don't fail entire poll

poll_history.discovery_errors = json.dumps(discovery_errors)
logger.info(f"Discovery complete: {len(discovered_jobs)} jobs, {len(discovery_errors)} boards failed")
```

---

### **Edge Case 6: Retry Exhaustion**

**Scenario**: Application fails after 3 retries with exponential backoff; job never applied.

**Detection**:
- `apply_attempts >= 3` for a specific job

**Handling**:
- Mark job as `apply_error_type = "RETRY_EXHAUSTED"`
- Record final error message to `apply_error` column
- Move to next job (don't retry in future cycles)
- Log warning with suggestions (e.g., "Check manually", "Report bug")

**Implementation**:
```python
for attempt in range(1, 4):  # 3 attempts max
    try:
        apply_to_job(job)
        return True
    except Exception as e:
        if attempt < 3:
            wait_time = 2 ** (attempt - 1)  # 1s, 2s, 4s
            sleep(wait_time)
            continue
        else:
            job.apply_error_type = "RETRY_EXHAUSTED"
            job.apply_error = str(e)
            logger.warning(f"Job {job.id} failed after 3 retries. Check manually.")
            return False
```

---

### **Edge Case 7: Tailored Resume Generation Fails**

**Scenario**: LLM fails to generate a tailored resume (e.g., LLM hallucinating, timeout, or edge case in resume).

**Detection**:
- `tailor_resume()` throws exception or returns empty/invalid resume

**Handling**:
- Retry up to 3 times with exponential backoff
- If all retries fail, `tailor_attempts = 3`, `tailor_error = "LLM failure: {details}"`
- Skip cover letter generation (dependent on tailored resume)
- Skip application (no tailored resume available)
- Log error with full LLM response for debugging
- User can manually tailor resume or retry in next cycle

**Implementation**:
```python
job.tailor_attempts = 0
for attempt in range(1, 4):
    try:
        tailored_resume = tailor_resume(job, resume_text)
        if not is_valid_resume(tailored_resume):
            raise ValueError("Generated resume is invalid")
        job.tailored_resume_path = save_resume(tailored_resume)
        return True
    except Exception as e:
        job.tailor_attempts = attempt
        job.tailor_error = str(e)
        if attempt < 3:
            sleep(2 ** (attempt - 1))
            continue
        else:
            logger.error(f"Tailor failed after 3 attempts: {job.id}")
            return False
```

---

### **Edge Case 8: Poll Cycle Takes Longer Than Poll Interval**

**Scenario**: Autopilot discovery/enrichment/scoring/application takes 12 hours, but poll interval is 8 hours.

**Detection**:
- `poll_completed_at - poll_started_at > poll_interval_hours`

**Handling**:
- Log warning: "Poll cycle took 12h, exceeding poll_interval 8h. Consider increasing poll interval."
- Immediately start next poll cycle (don't sleep)
- Update `daemon_state.last_poll_cycle_id` to track current cycle
- Prevent overlapping poll cycles by checking if previous cycle still running

**Implementation**:
```python
poll_start = now()
run_full_pipeline()
poll_end = now()
poll_duration = (poll_end - poll_start).total_seconds() / 3600

if poll_duration > poll_interval_hours:
    logger.warning(f"Poll took {poll_duration}h, exceeds interval {poll_interval_hours}h")
    sleep_time = 0  # Start next poll immediately
else:
    sleep_time = (poll_interval_hours * 3600) - (poll_duration * 3600)

sleep(max(0, sleep_time))
```

---

### **Edge Case 9: Site Authentication/Blocking**

**Scenario**: Job application site requires account login that ApplyPilot can't bypass (SSO, 2FA).

**Detection**:
- Claude Code CLI detects login page or 401 response
- Apply attempt results in "Sign in required" or redirect to SSO

**Handling**:
- Mark site as `blocked_site = true` in database
- Record `apply_error_type = "BLOCKED_SITE"`
- Create `blocked_sites` table or add to `sites.yaml` config
- Skip all future applications to this site (check before attempting apply)
- Log info-level message with site name for future reference

**Implementation**:
```python
if is_login_page_detected(page) or is_sso_required(page):
    site = extract_domain(job.application_url)
    add_to_blocked_sites(site)
    job.apply_error_type = "BLOCKED_SITE"
    logger.info(f"Site {site} requires auth, added to blocklist")
    continue
```

---

### **Edge Case 10: Memory/CPU Exhaustion**

**Scenario**: Autopilot daemon runs for days; memory grows unbounded; process crashes.

**Detection**:
- Monitor memory usage every poll cycle
- If memory > 500MB or CPU > 50% sustained, log warning
- If memory > 1GB, pause apply and trigger cleanup

**Handling**:
- Implement health check in daemon main loop:
  ```python
  if get_memory_usage_mb() > 1000:
      logger.warning("Memory usage critical (>1GB), pausing apply...")
      daemon_state.paused = True
      daemon_state.pause_reason = "MEMORY_EXHAUSTED"
      cleanup_cache()  # Close old DB connections, clear temp files
      sleep(300)  # Pause for 5 minutes
      daemon_state.paused = False
  ```
- Implement log rotation to prevent log files from growing too large
- Consider resource limits in Docker container

---

### **Edge Case 11: Duplicate Job URLs (Same Job, Multiple Boards)**

**Scenario**: JobSpy and Workday both post the same job from TechCorp; URL appears twice in database.

**Detection**:
- During discovery, `jobs.url UNIQUE` constraint catches exact duplicates
- During enrichment, extract application URL and check if already processed

**Handling**:
- Unique constraint on `jobs.url` prevents DB insertion
- Log info-level: "Duplicate job URL, skipping"
- If application URLs differ (different forms), consider as separate jobs
- If same URL, same company, same title → Count as duplicate and deduplicate in discovery

**Implementation**:
```sql
-- Existing constraint prevents true duplicates
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,  -- This prevents duplicate URLs
  ...
);
```

---

### **Edge Case 12: Application Data Validation Failure**

**Scenario**: Tailored resume contains hallucinated skills or fabricated experience (LLM edge case).

**Detection**:
- `scoring/validator.py` checks for banned phrases, impossible skill combos, personal data leaks
- Validator raises exception before applying

**Handling**:
- Fail gracefully: Log error, record `apply_error = "Validation failed: {reason}"`
- Don't apply the job (protection against sending fake credentials)
- Alert user with log message and optional notification
- Consider re-tailoring or skipping job

**Implementation**:
```python
try:
    validate_tailored_resume(job.tailored_resume_path, job.profile)
except ValidationError as e:
    logger.error(f"Resume validation failed: {e}")
    job.apply_error = f"Validation failed: {e}"
    continue  # Skip apply
```

---

## Component Architecture

### **Component Overview**

```
┌──────────────────────────────────────────────────────────────┐
│                     ApplyPilot Autopilot                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CLI Layer (typer)                                   │   │
│  ├─ applypilot autopilot [OPTIONS]                     │   │
│  ├─ applypilot daemon {status, stop, logs}             │   │
│  ├─ applypilot init [OPTIONS] [REFACTORED]             │   │
│  └─ applypilot run [stages] [existing]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Configuration & State Management                     │   │
│  ├─ DependencyDetector (NEW)                           │   │
│  ├─ DiagnosticCheckpoint (NEW)                         │   │
│  ├─ InitState (NEW: persist init metadata)             │   │
│  ├─ ConfigManager (existing, enhanced)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Autopilot Core (NEW)                                │   │
│  ├─ AutopilotOrchestrator (main loop)                  │   │
│  ├─ PollScheduler (track last_polled_at per site)      │   │
│  ├─ ApplyRateLimiter (2 apps/min, configurable)        │   │
│  ├─ DaemonManager (fork, detach, PID, health)          │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pipeline (existing, autopilot-aware)                │   │
│  ├─ Discovery (with poll deduplication)                │   │
│  ├─ Enrichment (incremental, retry logic)              │   │
│  ├─ Scoring (batch LLM calls)                          │   │
│  ├─ Tailoring (with retries, validator)                │   │
│  ├─ CoverLetters (with retries)                        │   │
│  ├─ PDFGeneration (existing)                           │   │
│  └─ Apply (with graceful error handling)               │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Error Handling & Retry (NEW)                        │   │
│  ├─ RetryOrchestrator (exponential backoff)            │   │
│  ├─ ErrorClassifier (transient vs. non-transient)      │   │
│  ├─ BlocklistManager (blocked sites, closed jobs)      │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Logging & Monitoring (NEW)                          │   │
│  ├─ StructuredLogger (JSON format)                     │   │
│  ├─ LogRotation (daily, max 7 days, compress)          │   │
│  ├─ HealthMonitor (memory, CPU, uptime)                │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Notifications (NEW)                                 │   │
│  ├─ SlackNotifier (job matches, apply results)         │   │
│  ├─ EmailNotifier (SMTP integration)                   │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                                │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Database Layer (SQLite + WAL)                        │   │
│  ├─ jobs table (enhanced with poll/apply columns)      │   │
│  ├─ poll_history table (NEW: audit poll cycles)        │   │
│  ├─ daemon_state table (NEW: heartbeat, config)        │   │
│  ├─ api_key_cache table (NEW: validation cache)        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### **Component Responsibilities**

#### **1. DependencyDetector (NEW)**
**File**: `src/applypilot/wizard/dependency_detector.py`

**Responsibility**: Detect installed dependencies and map to tier levels.

**Inputs**:
- System environment (PATH, installed binaries, Python version)
- Environment variables (API keys)

**Outputs**:
- `Tier1Available: bool` (Python ≥3.11)
- `Tier2Available: bool` (+ LLM API key)
- `Tier3Available: bool` (+ Claude CLI + Chrome)
- `DependencyReport: Dict[str, status]` (detailed findings)

**Key Methods**:
- `detect_python_version() -> str`
- `detect_node_version() -> str | None`
- `detect_chrome_binary() -> str | None`
- `detect_claude_cli() -> str | None`
- `detect_api_keys() -> Dict[str, bool]` (Gemini, OpenAI, CAPSOLVER)
- `get_tier_level() -> int` (1, 2, or 3)

---

#### **2. DiagnosticCheckpoint (NEW)**
**File**: `src/applypilot/wizard/diagnostic_checkpoint.py`

**Responsibility**: Validate configuration and dependencies during init.

**Inputs**:
- Profile JSON
- Resume file
- Searches YAML
- Environment variables

**Outputs**:
- `CheckResult: List[Dict{name, status, message}]` (pass/fail per check)

**Key Methods**:
- `validate_resume() -> bool` (readable, >100 words, parseable)
- `validate_profile() -> bool` (no empty required fields, valid email)
- `validate_searches() -> bool` (YAML valid, ≥1 search query)
- `validate_api_key(provider) -> bool` (Gemini: minimal LLM call, OpenAI: list models)
- `validate_claude_cli() -> bool` (`claude code --version` succeeds)
- `validate_chrome() -> bool` (binary exists, launchable)
- `run_all_checks() -> CheckResult`

---

#### **3. InitState (NEW)**
**File**: `src/applypilot/config/init_state.py`

**Responsibility**: Persist and retrieve init metadata to enable reruns without full reconfiguration.

**Inputs**:
- Profile, resume, searches config

**Outputs**:
- `InitState: JSON` (serialized to `~/.applypilot/init-state.json`)

**Key Methods**:
- `save(profile, resume, searches, tier_level, deferred_features)`
- `load() -> InitState | None`
- `compute_checksum(data) -> str` (SHA256)
- `has_config_changed(new_profile) -> bool`

**Schema**:
```python
@dataclass
class InitState:
    version: str
    last_init_at: datetime
    init_checksum: str  # Combined hash of all config
    tier_configured: int
    tier_capabilities: Dict[str, bool]
    deferred_features: List[Dict]
    profile_sha256: str
    resume_sha256: str
    searches_config_sha256: str
```

---

#### **4. AutopilotOrchestrator (NEW)**
**File**: `src/applypilot/autopilot/orchestrator.py`

**Responsibility**: Main event loop, poll scheduling, stage orchestration.

**Inputs**:
- CLI options (poll_interval, score_threshold, max_applications, etc.)

**Outputs**:
- Running daemon or one-shot poll cycle
- Database updates (poll_history, jobs)
- Log entries

**Key Methods**:
- `run() -> None` (main event loop)
- `poll_cycle() -> PollResult` (one cycle of discovery → apply)
- `should_poll(site) -> bool` (check last_polled_at)
- `calculate_next_poll_time() -> datetime`
- `health_check() -> HealthStatus` (memory, CPU, uptime)

---

#### **5. PollScheduler (NEW)**
**File**: `src/applypilot/autopilot/poll_scheduler.py`

**Responsibility**: Track poll times per site, stagger polls, dedup jobs.

**Inputs**:
- Job board name
- Last poll timestamp from database

**Outputs**:
- Should poll: bool
- Next poll time: datetime
- New jobs (deduped)

**Key Methods**:
- `should_poll(site, poll_interval_hours) -> bool`
- `stagger_polls(sites: List[str], interval_hours) -> Dict[site, offset_hours]`
- `dedup_new_jobs(jobs, db) -> List[Job]` (by URL)

---

#### **6. ApplyRateLimiter (NEW)**
**File**: `src/applypilot/autopilot/rate_limiter.py`

**Responsibility**: Throttle application attempts to avoid IP blocking.

**Inputs**:
- Job to apply
- Rate limit (applications per minute)

**Outputs**:
- Allow/deny decision
- Wait time (if denied)

**Key Methods**:
- `allow_apply(job) -> bool`
- `record_application(job) -> None`
- `get_wait_time() -> float`
- `reduce_rate(multiplier) -> None` (on rate limit errors)

---

#### **7. DaemonManager (NEW)**
**File**: `src/applypilot/autopilot/daemon_manager.py`

**Responsibility**: Fork process, write PID file, manage daemon lifecycle.

**Inputs**:
- CLI options (--daemon, --log-level)

**Outputs**:
- Daemonized process or foreground process
- PID file at `~/.applypilot/autopilot.pid`

**Key Methods**:
- `daemonize() -> None` (fork, detach, redirect IO)
- `write_pid_file(pid) -> None`
- `read_pid_file() -> int | None`
- `is_running(pid) -> bool`
- `send_signal(signal: int) -> None`

---

#### **8. RetryOrchestrator (NEW)**
**File**: `src/applypilot/autopilot/retry_orchestrator.py`

**Responsibility**: Implement retry logic with exponential backoff for transient errors.

**Inputs**:
- Function to retry
- Max attempts
- Backoff schedule

**Outputs**:
- Success/failure result
- Retry count

**Key Methods**:
- `retry_with_backoff(func, max_attempts, backoff_schedule) -> Result`
- `classify_error(error) -> ErrorType` (transient, non-transient)

---

#### **9. StructuredLogger (NEW)**
**File**: `src/applypilot/autopilot/structured_logger.py`

**Responsibility**: JSON-formatted logging for machine parsing.

**Inputs**:
- Event data (stage, action, counts, duration, errors)

**Outputs**:
- Structured log entries to file and stdout

**Key Methods**:
- `log_poll_started(poll_cycle_id) -> None`
- `log_discovery_complete(new_jobs, deduped, errors) -> None`
- `log_application_result(job, status, error) -> None`
- `log_health_check(memory_mb, cpu_percent, uptime) -> None`
- `get_logger() -> Logger`

---

#### **10. SlackNotifier (NEW)**
**File**: `src/applypilot/autopilot/notifications/slack.py`

**Responsibility**: Send Slack messages on job matches and application results.

**Inputs**:
- Webhook URL
- Notification type (job match, application success/failure)
- Job metadata

**Outputs**:
- Slack message posted

**Key Methods**:
- `notify_job_match(job, score) -> bool`
- `notify_application_success(job) -> bool`
- `notify_application_failure(job, error) -> bool`
- `notify_error(error_msg) -> bool`

---

#### **11. HealthMonitor (NEW)**
**File**: `src/applypilot/autopilot/health_monitor.py`

**Responsibility**: Track daemon health, memory, CPU, uptime.

**Inputs**:
- Process ID
- Monitoring interval

**Outputs**:
- HealthStatus: memory, CPU, uptime, process alive

**Key Methods**:
- `get_health_status() -> HealthStatus`
- `is_memory_exceeded(limit_mb) -> bool`
- `is_cpu_exceeded(limit_percent) -> bool`

---

### **Component Dependencies**

```
CLI (cli.py)
  ├─ AutopilotOrchestrator
  │  ├─ PollScheduler
  │  ├─ ApplyRateLimiter
  │  ├─ RetryOrchestrator
  │  ├─ StructuredLogger
  │  ├─ Pipeline (existing)
  │  ├─ HealthMonitor
  │  └─ DaemonManager
  │
  ├─ DependencyDetector
  ├─ DiagnosticCheckpoint
  ├─ InitState
  └─ Notifications (Slack, Email)

Database Layer (SQLite)
  ├─ jobs table (enhanced)
  ├─ poll_history table (NEW)
  ├─ daemon_state table (NEW)
  └─ api_key_cache table (NEW)
```

---

## Implementation Tasks

### **Phase 1: Enhanced Init & Dependency Detection**

#### **Task 1.1** - DependencyDetector Class
- **File**: `src/applypilot/wizard/dependency_detector.py`
- **Acceptance Criteria**:
  - Detects Python ≥3.11
  - Detects Node.js/npx in PATH
  - Detects Chrome/Chromium binary location
  - Detects Claude Code CLI installation
  - Checks GEMINI_API_KEY, OPENAI_API_KEY environment variables
  - Returns Tier 1/2/3 level
  - Unit tests cover all detection methods
- **Complexity**: Medium

#### **Task 1.2** - DiagnosticCheckpoint Class
- **File**: `src/applypilot/wizard/diagnostic_checkpoint.py`
- **Acceptance Criteria**:
  - Validates resume (readable, >100 words)
  - Validates profile JSON (required fields, valid email)
  - Validates searches YAML (syntactically valid, ≥1 search)
  - Tests Gemini API key with minimal LLM call
  - Tests OpenAI API key (if provided)
  - Tests Claude CLI availability
  - Tests Chrome binary launch
  - Returns structured CheckResult list (pass/fail for each)
  - Unit tests for all validators
- **Complexity**: Large

#### **Task 1.3** - InitState Persistence
- **File**: `src/applypilot/config/init_state.py`
- **Acceptance Criteria**:
  - Saves init metadata to `~/.applypilot/init-state.json`
  - Loads existing init state on rerun
  - Detects if profile/resume/searches changed (checksum)
  - Records deferred features with setup instructions
  - Unit tests for save/load, checksum validation
- **Complexity**: Small

#### **Task 1.4** - Refactor `applypilot init` Command
- **File**: `src/applypilot/wizard/init.py` + `src/applypilot/cli.py`
- **Acceptance Criteria**:
  - Runs DependencyDetector at start
  - Displays Dependency Report card
  - Offers SKIP/DEFER options for Tier 3
  - Runs DiagnosticCheckpoint after user input
  - Displays results as pass/fail checklist
  - Saves config with InitState
  - On rerun, loads defaults from InitState (unless --reconfigure)
  - E2E test: init → run discover → verify new jobs
- **Complexity**: Large

#### **Task 1.5** - "Ready to Use" Checklist UI
- **File**: `src/applypilot/wizard/init.py`
- **Acceptance Criteria**:
  - Shows tier-based checklist (Tier 1 ✓, Tier 2 ✓, Tier 3 ⚠️ deferred)
  - Lists deferred features with setup links
  - Suggests next steps (e.g., "applypilot run discover")
  - Unit tests for checklist rendering
- **Complexity**: Small

---

### **Phase 2: Database Schema Enhancements**

#### **Task 2.1** - Add Poll/Apply Columns to `jobs` Table
- **File**: `src/applypilot/database.py`
- **Acceptance Criteria**:
  - Adds columns: `last_polled_at`, `poll_cycle_id`, `apply_attempts`, `apply_error`, `apply_error_at`, `apply_error_type`, `skipped_reason`
  - Creates indexes for `discovered_at`, `fit_score`, `applied_at`, `poll_cycle_id`, `site + last_polled_at`
  - Writes migration or ensures schema compatibility
  - Unit tests: query with new columns, index usage
- **Complexity**: Small

#### **Task 2.2** - Create `poll_history` Table
- **File**: `src/applypilot/database.py`
- **Acceptance Criteria**:
  - Creates table with poll cycle metadata (started_at, completed_at, duration, job counts, errors, status)
  - Indexes on `poll_started_at`
  - Migration script or schema update
  - Unit tests: insert and query poll_history records
- **Complexity**: Small

#### **Task 2.3** - Create `daemon_state` Table
- **File**: `src/applypilot/database.py`
- **Acceptance Criteria**:
  - Creates table with daemon heartbeat, config, health metrics
  - Upsert logic (always one record per daemon)
  - Indexes on `updated_at`
  - Migration or schema update
  - Unit tests: write and read daemon state
- **Complexity**: Small

#### **Task 2.4** - Database Migration Strategy
- **File**: `src/applypilot/database.py`
- **Acceptance Criteria**:
  - Handles existing databases without breaking
  - Adds new columns gracefully
  - Documentation for manual migration (if needed)
  - E2E test: upgrade old schema to new schema
- **Complexity**: Small

---

### **Phase 3: Autopilot Core Loop**

#### **Task 3.1** - AutopilotOrchestrator Main Loop
- **File**: `src/applypilot/autopilot/orchestrator.py`
- **Acceptance Criteria**:
  - Implements main event loop (while True)
  - Calls `poll_cycle()` at configured intervals
  - Calculates sleep time until next poll
  - Handles SIGTERM gracefully (cleanup, save state)
  - Unit tests: mock pipeline, verify loop behavior
  - E2E test: run for 2 poll cycles, verify database updates
- **Complexity**: Large

#### **Task 3.2** - Poll Cycle Pipeline Integration
- **File**: `src/applypilot/autopilot/poll_cycle.py`
- **Acceptance Criteria**:
  - Orchestrates 6 stages: discover → enrich → score → tailor → cover → pdf → apply
  - Calls existing Pipeline class with autopilot-specific options
  - Creates poll_history record and updates poll_cycle_id on jobs
  - Updates daemon_state with cycle results
  - E2E test: full poll cycle with 5 test jobs
- **Complexity**: Large

#### **Task 3.3** - PollScheduler Component
- **File**: `src/applypilot/autopilot/poll_scheduler.py`
- **Acceptance Criteria**:
  - Checks `last_polled_at` per site
  - Returns should_poll: bool
  - Stagger polls for multiple sites (no thundering herd)
  - Dedup new jobs by URL
  - Unit tests: scheduling logic, staggering, dedup
- **Complexity**: Medium

#### **Task 3.4** - ApplyRateLimiter Component
- **File**: `src/applypilot/autopilot/rate_limiter.py`
- **Acceptance Criteria**:
  - Throttles to configurable rate (default 2 apps/min)
  - Tracks apply times in memory (sliding window)
  - Returns allow/deny + wait time
  - Implements `reduce_rate()` for rate-limit errors
  - Unit tests: rate limiting logic, window calculations
- **Complexity**: Medium

#### **Task 3.5** - Apply Logic Integration
- **File**: `src/applypilot/apply/launcher.py` (enhanced) + orchestrator
- **Acceptance Criteria**:
  - Checks if already applied before attempting
  - Calls existing apply logic with retry support
  - Records applied_at on success
  - Records apply_error + apply_error_type on failure
  - Increments apply_attempts
  - E2E test: apply to 3 test jobs, verify DB updates
- **Complexity**: Medium

---

### **Phase 4: Error Handling, Retries & Logging**

#### **Task 4.1** - RetryOrchestrator with Exponential Backoff
- **File**: `src/applypilot/autopilot/retry_orchestrator.py`
- **Acceptance Criteria**:
  - Retries function up to 3 times
  - Exponential backoff: 1s, 4s, 16s
  - Classifies errors: transient vs. non-transient
  - Returns result or raises after exhaustion
  - Unit tests: retry logic, backoff timing, error classification
- **Complexity**: Medium

#### **Task 4.2** - Error Classification & Handling
- **File**: `src/applypilot/autopilot/error_handler.py`
- **Acceptance Criteria**:
  - Classifies errors: NETWORK, RATE_LIMIT, CAPTCHA, BLOCKED_SITE, JOB_CLOSED, RETRY_EXHAUSTED, VALIDATION_FAILED
  - Defines handling strategy per error type
  - Records error to database
  - Unit tests: classify 10+ error types
- **Complexity**: Medium

#### **Task 4.3** - StructuredLogger with JSON Output
- **File**: `src/applypilot/autopilot/structured_logger.py`
- **Acceptance Criteria**:
  - Logs to `~/.applypilot/logs/autopilot-YYYY-MM-DD.log` in JSON format
  - Includes timestamp, level, stage, action, counts, duration, errors
  - One JSON object per line for parsing
  - Unit tests: log format, JSON validity
  - E2E test: run poll cycle, verify log entries
- **Complexity**: Medium

#### **Task 4.4** - Log Rotation & Archiving
- **File**: `src/applypilot/autopilot/log_manager.py`
- **Acceptance Criteria**:
  - Daily log rotation (max 7 days)
  - Compresses old logs (gzip)
  - Archives to `~/.applypilot/logs/archive/`
  - Max total size 500MB
  - Unit tests: rotation logic, compression, cleanup
- **Complexity**: Small

#### **Task 4.5** - Comprehensive Logging Points
- **Files**: Throughout orchestrator, apply, tailoring, etc.
- **Acceptance Criteria**:
  - Poll started/completed events
  - Discovery: new jobs, deduped, errors per board
  - Enrichment: details fetched, errors, retries
  - Scoring: jobs scored, avg score, above threshold
  - Tailoring: tailored count, failed, error details
  - Cover letters: generated, failed
  - Application: attempted, successful, failed, error types
  - Health check: memory, CPU, process status
  - E2E test: full poll cycle, verify all events logged
- **Complexity**: Large

#### **Task 4.6** - Health Monitoring
- **File**: `src/applypilot/autopilot/health_monitor.py`
- **Acceptance Criteria**:
  - Monitors memory usage, CPU, uptime
  - Logs health every poll cycle
  - Triggers cleanup if memory > 1GB or CPU > 50%
  - Unit tests: health collection, thresholds
- **Complexity**: Medium

---

### **Phase 5: Notifications & Daemon Mode**

#### **Task 5.1** - Slack Notifier Integration
- **File**: `src/applypilot/autopilot/notifications/slack.py`
- **Acceptance Criteria**:
  - Posts to webhook on job match
  - Posts on application success/failure
  - Includes job title, company, score, link
  - Throttles to 1 notification per 5 minutes
  - Unit tests: message formatting, webhook posting
- **Complexity**: Medium

#### **Task 5.2** - Email Notifier Integration
- **File**: `src/applypilot/autopilot/notifications/email.py`
- **Acceptance Criteria**:
  - Sends via SMTP
  - Supports Gmail + custom servers
  - Similar message format to Slack
  - Throttling (1 per 5 minutes)
  - Unit tests: SMTP connection, message format
- **Complexity**: Medium

#### **Task 5.3** - Notification Configuration
- **File**: `src/applypilot/config.py` + CLI options
- **Acceptance Criteria**:
  - CLI options: --slack-webhook-url, --notify-on, --email-to, --smtp-server, --smtp-port, --smtp-password
  - Environment variables: APPLYPILOT_SLACK_WEBHOOK_URL, APPLYPILOT_EMAIL_TO, etc.
  - Validates config at init time
  - Unit tests: config loading, validation
- **Complexity**: Small

#### **Task 5.4** - DaemonManager (Fork, Detach, PID)
- **File**: `src/applypilot/autopilot/daemon_manager.py`
- **Acceptance Criteria**:
  - Daemonizes process (fork, detach, redirect IO)
  - Writes PID file to `~/.applypilot/autopilot.pid`
  - Reads PID file
  - Checks if PID process still running
  - Unit tests: daemonize logic, PID file management
- **Complexity**: Medium

#### **Task 5.5** - `applypilot daemon` Subcommand
- **File**: `src/applypilot/cli.py`
- **Acceptance Criteria**:
  - Subcommands: status, stop, logs
  - `daemon status`: Show PID, uptime, memory, last poll, stats
  - `daemon stop`: Send SIGTERM, wait for graceful shutdown
  - `daemon logs --tail N --follow`: Tail log file
  - E2E test: start daemon, check status, view logs, stop
- **Complexity**: Medium

#### **Task 5.6** - Health Check Endpoint (Docker)
- **File**: `src/applypilot/autopilot/health_endpoint.py`
- **Acceptance Criteria**:
  - HTTP GET /health on port 8000
  - Returns JSON: uptime, last poll, job stats, process status
  - Configurable via --health-check-port
  - E2E test: run daemon, curl /health, verify response
- **Complexity**: Small

#### **Task 5.7** - Docker Setup Guide & Systemd Template
- **Files**: `docs/docker.md`, `systemd/applypilot-daemon.service`
- **Acceptance Criteria**:
  - Docker Compose example with volume mounts
  - Systemd service file for Linux
  - Instructions for running as background service
  - Example notifications setup
- **Complexity**: Small

---

### **Summary of Implementation Tasks**

**Total Tasks**: 27
**Estimated Effort**: ~370-450 story points across 5 phases

**Phase 1 (Init & Dependencies)**: 5 tasks, ~60 story points
**Phase 2 (Database)**: 4 tasks, ~30 story points
**Phase 3 (Autopilot Core)**: 5 tasks, ~100 story points
**Phase 4 (Error Handling & Logging)**: 6 tasks, ~120 story points
**Phase 5 (Notifications & Daemon)**: 7 tasks, ~110 story points

---

## Security & Compliance Considerations

### **1. API Key Management**
- **Requirement**: Never log API keys; validate early
- **Implementation**:
  - Store keys in `~/.applypilot/.env` (not in Git)
  - Validate in DiagnosticCheckpoint during init
  - Test with minimal calls (not full requests)
  - Never include keys in logs or error messages
  - Consider key rotation strategy for long-running daemons

### **2. Resume & Personal Data Protection**
- **Requirement**: Prevent hallucination or accidental leakage in tailored resumes
- **Implementation**:
  - Validator checks for banned phrases (e.g., SSN, full address)
  - Validator checks for impossible skill combos (fabrication detection)
  - Validator ensures profile data consistency
  - Validator prevents "leakage" of other users' data (if multi-user)
  - Never store password or credit card info in resume

### **3. Authentication for Notifications**
- **Requirement**: Secure Slack webhooks, email SMTP passwords
- **Implementation**:
  - Store webhook URLs in `~/.applypilot/.env` (not hardcoded)
  - SMTP passwords via environment variable or secure prompt
  - Support OAuth for Slack (future enhancement)
  - Validate webhook accessibility during init

### **4. Audit & Logging**
- **Requirement**: Comprehensive audit trail for compliance
- **Implementation**:
  - Log all application attempts (timestamp, job ID, URL, result)
  - Log all config changes (profile updates, API key changes)
  - Log all errors and retries (for troubleshooting)
  - Structured JSON logs for SIEM integration
  - Retention: 7 days by default, configurable

### **5. Rate Limiting & IP Blocking Prevention**
- **Requirement**: Avoid being blocked by job boards or IP blacklisting
- **Implementation**:
  - Default 2 applications per minute
  - Configurable via `--apply-rate-limit`
  - Respect Retry-After headers on 429 responses
  - Implement jitter (random delay) in request timing
  - Monitor for blocked sites (403, 401 patterns)

### **6. CAPTCHA Handling**
- **Requirement**: Don't attempt to bypass CAPTCHA (ethical/legal risk)
- **Implementation**:
  - Detect CAPTCHA presence and skip job
  - Flag for manual review
  - Optional notification to user
  - Never use third-party CAPTCHA solving service without explicit user consent
  - Document limitations in README

### **7. Network Security**
- **Requirement**: Secure communication with external APIs
- **Implementation**:
  - Use HTTPS only for API calls and webhooks
  - Validate SSL certificates
  - Don't accept self-signed certs (unless explicitly configured for localhost)
  - Timeout network requests (30s default)

### **8. Permissions & Access Control**
- **Requirement**: Protect user data files from other processes
- **Implementation**:
  - Store `~/.applypilot/` with 0700 permissions (user-only read/write)
  - Protect `.env` file with 0600 permissions (API keys)
  - Warn if files are world-readable

---

## Performance & Scalability Considerations

### **1. Expected Load & Growth**
- **Initial**: 1 user, 5-20 jobs discovered per poll (once every 8 hours)
- **Growth**: 100 users, 1000s of jobs in database, continuous polling
- **Database Size**: ~1KB per job record; 10,000 jobs = 10MB SQLite DB
- **Log Size**: ~100 lines per poll cycle; 3 cycles/day = 300 lines/day = ~30KB/day; 7-day retention = 210KB

### **2. Database Optimization**
- **Indexes**:
  - `jobs(discovered_at DESC)`: Quick discovery stats
  - `jobs(fit_score DESC)`: Quick filter by score
  - `jobs(applied_at)`: Track apply progress
  - `jobs(poll_cycle_id)`: Group by poll cycle
  - `jobs(site, last_polled_at)`: Check if site needs poll

- **Query Optimization**:
  - Use LIMIT when fetching new jobs for processing
  - Batch inserts/updates (100 jobs per transaction)
  - WAL mode enabled for concurrent reads/writes

### **3. Caching Strategies**
- **API Key Validation Cache**: Cache result for 1 hour (check: `api_key_cache` table)
- **Job Deduplication**: In-memory set of URLs during discovery (clear per cycle)
- **Blocked Sites**: In-memory set or database table (check before apply)

### **4. Rate Limiting & Polling**
- **Job Board Polling**: Stagger by site; don't poll all 8 boards simultaneously
- **Application Rate**: 2 apps/min default; configurable
- **LLM Calls**: Batch scoring calls if possible (1 call per 10 jobs)
- **API Quotas**: Track Gemini API usage; warn if approaching quota

### **5. Memory Management**
- **Health Monitor**: Check memory every poll cycle
- **Trigger Cleanup**: If memory > 1GB, clear caches, close idle DB connections
- **Process Resource Limits**: Document systemd service file with MemoryLimit=500M

### **6. Concurrent Operations**
- **Existing Pipeline**: Supports --workers N for parallel discovery/enrichment
- **Autopilot**: Single-threaded main loop (simplicity), but pipeline can parallelize
- **SQLite**: WAL mode allows concurrent reads during writes
- **Thread Safety**: Use thread-local DB connections (existing pattern)

### **7. Scalability Path (Future)**
- PostgreSQL migration for multi-user deployments
- Distributed job scraping (multiple machines)
- Redis caching layer for rate limits, blocked sites
- Async/await for non-blocking I/O

---

## Configuration Additions (.env Variables)

### **New Environment Variables**

```bash
# Autopilot Polling
APPLYPILOT_POLL_INTERVAL=8                          # Default poll interval (hours)
APPLYPILOT_SCORE_THRESHOLD=7                        # Default score threshold (1-10)
APPLYPILOT_MAX_APPLICATIONS_PER_CYCLE=unlimited     # Max applications per poll
APPLYPILOT_APPLY_RATE_LIMIT=2                       # Applications per minute

# Notifications
APPLYPILOT_SLACK_WEBHOOK_URL=https://hooks.slack.com/...
APPLYPILOT_NOTIFY_ON=matches,applications,errors    # Event types
APPLYPILOT_EMAIL_TO=user@example.com
APPLYPILOT_EMAIL_FROM=noreply@applypilot.dev
APPLYPILOT_SMTP_SERVER=smtp.gmail.com
APPLYPILOT_SMTP_PORT=587
APPLYPILOT_SMTP_PASSWORD=***

# Daemon & Logging
APPLYPILOT_DAEMON_ENABLED=true
APPLYPILOT_HEALTH_CHECK_PORT=8000
APPLYPILOT_LOG_DIR=~/.applypilot/logs
APPLYPILOT_LOG_RETENTION_DAYS=7
APPLYPILOT_LOG_MAX_SIZE_MB=500

# Retry & Network
APPLYPILOT_RETRY_MAX_ATTEMPTS=3
APPLYPILOT_RETRY_BACKOFF_SECONDS=1,4,16
APPLYPILOT_NETWORK_TIMEOUT_SECONDS=30

# Docker
APPLYPILOT_DOCKER=false
```

### **Example `.env` File**
```bash
# LLM Configuration
GEMINI_API_KEY=your-api-key-here
LLM_MODEL=gemini-2.0-flash

# Autopilot Settings
APPLYPILOT_POLL_INTERVAL=8
APPLYPILOT_SCORE_THRESHOLD=7
APPLYPILOT_NOTIFY_ON=matches,applications

# Slack Notifications
APPLYPILOT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Implementation Phases & Timeline

| Phase | Duration | Tasks | Story Points | Deliverable |
|-------|----------|-------|--------------|-------------|
| **1. Enhanced Init** | 2 weeks | 5 | ~60 | Refactored init with dependency detection, tier degradation, diagnostics |
| **2. Database** | 1 week (parallel) | 4 | ~30 | New schema tables, indexes, migrations |
| **3. Autopilot Core** | 2 weeks | 5 | ~100 | Main loop, polling, scheduling, apply integration |
| **4. Error & Logging** | 2 weeks | 6 | ~120 | Retries, error classification, structured logging, health monitoring |
| **5. Notifications & Daemon** | 1-2 weeks | 7 | ~110 | Slack/email, daemon mode, health endpoint, documentation |
| **Total** | **~8 weeks** | **27** | **~420** | Fully functional autopilot with simplified setup |

---

## Glossary & Definitions

- **Tier 1**: Discovery only (Python 3.11+)
- **Tier 2**: Discovery + Scoring (+ LLM API key)
- **Tier 3**: Full automation (+ Claude Code CLI, Chrome)
- **Poll Cycle**: One iteration of the 6-stage pipeline
- **Poll Interval**: Hours between poll cycles (default 8)
- **Score Threshold**: Minimum job score (1-10) to tailor/apply (default 7)
- **Transient Error**: Network timeout, rate limit, CAPTCHA (retry in next cycle)
- **Non-Transient Error**: Invalid URL, job closed, auth required (skip permanently)
- **Daemonize**: Fork process, detach from terminal, run in background
- **Health Check**: Monitor daemon memory, CPU, uptime
- **Rate Limiter**: Throttle application attempts to avoid IP blocking
- **Init State**: Persisted metadata about user setup (tier, deferred features, checksums)

---

## Success Criteria Checklist

✓ **Setup**: Users can run `applypilot init` without confusion about missing dependencies
✓ **Tier Degradation**: Users without Tier 3 still get value from Tier 1-2
✓ **Autopilot**: Command-line interface is intuitive and well-documented
✓ **Polling**: New jobs discovered every N hours without user intervention
✓ **Applications**: Auto-apply to qualifying jobs (score ≥ threshold)
✓ **Logging**: Comprehensive, structured logs for debugging and auditing
✓ **Notifications**: Users informed of matches and application results
✓ **Error Recovery**: Transient errors retried; non-transient errors handled gracefully
✓ **Daemon Mode**: Process runs indefinitely with health checks and resource limits
✓ **Documentation**: Setup guide, autopilot guide, Docker setup, troubleshooting
✓ **Testing**: Unit tests for all new components; E2E test for full poll cycle

---

## Appendix: Example Workflows

### **Scenario 1: First-Time User (5 Minutes)**

```bash
# User runs init (interactive)
$ applypilot init

# System shows dependency report
🔍 Dependency Detection
├─ Python 3.11 ✓
├─ Node.js/npx ✗ (optional)
├─ Chrome ✓
├─ Claude Code CLI ✗ (optional)
├─ Gemini API ✗ (required)

# User provides data
Resume: ~/resume.pdf
Name: John Doe
Email: john@example.com
...
Gemini API Key: [provided]

# Diagnostic checkpoint runs
✅ Resume valid
✅ Profile data valid
✅ Searches configured
✅ Gemini API accessible
⚠️  Claude CLI not found

# User sees checklist
Ready to Use!
✓ Tier 1-2: Discovery & Scoring
⚠️  Tier 3: Auto-apply disabled (optional)

# Next steps
$ applypilot run discover  # Test discovery
$ applypilot autopilot     # Start polling
```

### **Scenario 2: Autopilot Continuous Mode (Hands-Off)**

```bash
# User starts autopilot daemon
$ applypilot autopilot --poll-interval 8 \
                       --score-threshold 7 \
                       --daemon \
                       --slack-webhook-url "https://..."

# Daemon starts, detaches, writes PID
🚀 ApplyPilot Autopilot Started
├─ Daemon PID: 12345
├─ Poll Interval: 8 hours
├─ Log File: ~/.applypilot/logs/autopilot-2024-12-15.log

# In background, daemon runs every 8 hours:
# Poll 1: Discover 42 jobs → Enrich → Score → Tailor 28 → Apply 8
# Poll 2: Discover 35 jobs (new) → ...
# Poll 3: Discover 40 jobs (new) → ...

# User checks status anytime
$ applypilot daemon status

ApplyPilot Daemon Status
├─ Status: Running ✓
├─ PID: 12345
├─ Uptime: 8 hours 15 minutes
├─ Total Applied: 24 jobs
├─ Last Poll: 2024-12-15 18:30:45
└─ Next Poll: 2024-12-16 02:30:45

# User tails logs
$ applypilot daemon logs --tail 50 --follow

[2024-12-15 10:30:45] Poll Cycle #1 Started
  • Discovery: 42 new jobs
  • Scoring: 28 above threshold
  • Applications: 8 successful, 1 failed (CAPTCHA)
  • Next poll: 2024-12-15 18:30:45

# User stops daemon when done
$ applypilot daemon stop

Stopping ApplyPilot Daemon (PID 12345)...
✓ Daemon stopped gracefully.
Final stats:
  • Total jobs discovered: 256
  • Total applications: 24
```

### **Scenario 3: Error Recovery**

```bash
# Daemon running, API key expires
[2024-12-15 14:30:45] Poll Cycle #7 Started
  ✗ Scoring failed: Gemini API key invalid (401)
  ! Daemon paused: API_KEY_EXPIRED

# User fixes .env
$ echo "GEMINI_API_KEY=new-key-here" >> ~/.applypilot/.env

# User restarts daemon
$ applypilot daemon stop
$ applypilot autopilot --daemon ...

# Daemon resumes normally
[2024-12-15 14:45:00] Daemon started (recovered)
  ✓ Gemini API accessible
  • Resuming Poll Cycle #7...
```

---

## References & Related Docs

- **Existing ApplyPilot Docs**: 
  - Pipeline architecture
  - Tier system (Tier 1/2/3)
  - Job board strategies (JobSpy, Workday, smart-extract)
  
- **External Standards**:
  - OpenAPI/REST API design for `/health` endpoint
  - JSON logging format (RFC 5424, JSON Lines)
  - POSIX signals (SIGTERM, SIGKILL)
  - Systemd service files

---

**Document Version**: 1.0
**Last Updated**: 2024-12-15
**Status**: Ready for Engineering
