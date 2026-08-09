# ApplyPilot Improvements v2 - Technical Specification
## Scheduled Polling + Website Registry Model

## Executive Summary & Goals

ApplyPilot's current setup process requires users to manually provide configuration on every run, and the pipeline requires explicit orchestration at each stage. This v2 specification replaces the complex daemon mode with a simpler **scheduled polling** model integrated with cron/Windows Task Scheduler, and introduces a **Website Registry** system that enables Claude to intelligently apply to jobs with site-specific knowledge and auto-learning capabilities.

### Primary Objectives

- **Reduce friction**: Users can start discovering jobs within seconds, not minutes
- **Enable passive job hunting**: Set up once with `applypilot schedule`, let system poll at configured intervals
- **Simplify operations**: Replace daemon process management with standard OS schedulers (cron/Task Scheduler)
- **Intelligent application**: Claude Code uses site-specific playbooks to fill forms accurately
- **Auto-learning**: System captures application patterns and builds playbooks for improved future success
- **Operational visibility**: Comprehensive logging and optional notifications keep users informed
- **Reliability**: Robust error handling, retries, rate-limit management, and health checks

### Success Criteria

- Setup completes in <2 minutes for experienced users; <5 minutes for first-time users
- Users can run `applypilot init && applypilot schedule --interval 8h --time 08:00` and walk away
- Scheduled polls run automatically on Windows/Linux/macOS without manual daemon management
- Claude automatically applies to 75%+ of scored jobs on registered sites without manual intervention
- Failed applications are logged with actionable error messages and auto-learning suggestions
- Users can manually trigger poll with `applypilot run` anytime
- Website registry covers 50+ popular job boards and custom ATS platforms

---

## Current State Analysis & Pain Points

### **Daemon Mode Limitations (Why We're Replacing It)**

1. **Process Management Complexity**: PID files, forking, signal handling, log rotation—all manual overhead
2. **Cross-Platform Issues**: Daemon implementation differs drastically on macOS/Linux/Windows
3. **Docker Mismatch**: Daemons don't align well with containerized deployments
4. **Monitoring Blind Spot**: Process can silently crash; no automatic recovery
5. **User Expectations Mismatch**: Users expect application-level scheduling, not OS-level process management
6. **Development Complexity**: Introduces concurrency bugs, signal handling edge cases
7. **Testing Difficulty**: Daemon mode is hard to test reliably; async/background behavior prone to flakes

### **Application Intelligence Gap (Why Website Registry)**

1. **One-Size-Fits-All Approach**: Claude Code treats all websites identically despite vastly different form structures
2. **High Failure Rate**: Without site-specific knowledge, Claude struggles with:
   - Custom form layouts (multi-step applications)
   - Non-standard field names (e.g., "primary_skills" vs "skills")
   - Login flows that vary by site
   - File upload field naming conventions
3. **No Learning**: When Claude fails at a site, system doesn't capture or reuse that learning
4. **Credential Chaos**: No standardized way to handle site-specific vs. shared credentials
5. **Manual Workarounds**: Users end up maintaining their own "playbooks" externally

---

## Functional Requirements

### **Requirement Group 1: Scheduled Polling (Replaces Daemon Mode)**

#### R1.1 Schedule Command with Cron/Task Scheduler Integration
- New `applypilot schedule` command with options:
  - `--interval DURATION`: Poll every N hours (e.g., `8h`, `6h`, `24h`)
  - `--time HH:MM`: Time of day for first poll (e.g., `08:00` = 8 AM)
  - `--enable`: Activate the schedule (create cron entry or Task Scheduler job)
  - `--disable`: Deactivate the schedule (remove cron entry or Task Scheduler job)
  - `--status`: Show current schedule configuration
  - `--list`: List all configured schedules
- **Output**: 
  ```
  ✓ Schedule created successfully
  Schedule: Every 8 hours starting at 08:00
  Next poll: 2024-12-20 08:00:00 UTC
  Cron job added: /etc/cron.d/applypilot (Linux/macOS)
  Task Scheduler job added: ApplyPilot (Windows)
  ```

#### R1.2 Manual Poll Trigger
- New `applypilot run` command (renamed from `applypilot autopilot`):
  - Executes one complete poll cycle immediately
  - Options: `--skip-apply` (discover/enrich/score but don't apply), `--dry-run` (test without committing)
  - Respects rate limits from database (doesn't spam the same site twice within minimum interval)
  - Useful for testing, immediate job discovery, or manual intervention
  - Output: Same structured logging as scheduled polls

#### R1.3 No Process Management Burden
- **No PID files**: Cron/Task Scheduler handle lifecycle
- **No forking logic**: Each poll is a separate process invocation
- **No signal handling**: OS scheduler provides reliability
- **No custom health checks**: Cron/Task Scheduler provide implicit monitoring (can alert on exit code)
- **Docker-friendly**: Works identically in containers; no special daemon mode needed

#### R1.4 Polling & Deduplication Logic
- Track `last_polled_at` per job board in database
- Only re-poll boards not polled in ≥ `--poll-interval` hours
- **Offset staggering**: If poll-interval is 8h and 3 job boards exist, stagger polls by ~2.7h to avoid thundering herd
  - Math: Each board gets base time + `(board_index * poll_interval / num_boards)`
  - Example: 3 boards, 8h interval:
    - Board 1: 08:00
    - Board 2: 10:40
    - Board 3: 13:20

---

### **Requirement Group 2: Website Registry & Enhanced Application Logic**

#### R2.1 Website Registry Database Table
- **Purpose**: Central source of truth for site-specific application instructions
- **Table: `website_registry`**
  ```sql
  website_registry:
    - id (PK, UUID)
    - company_name: str (e.g., "Indeed Inc")
    - domain: str (e.g., "indeed.com") - unique
    - job_board_type: enum (indeed, linkedin, greenhouse, workday, custom_ats, career_page)
    - login_flow_instructions: TEXT (step-by-step, e.g., "1. Click login, 2. Enter email, 3. Enter password, 4. Click Continue")
    - form_fields_mapping: JSON (maps standardized fields to site-specific field names/IDs)
      Example:
      {
        "full_name": {
          "selector": "#applicant_name",
          "type": "text",
          "required": true
        },
        "email": {
          "selector": "#email_input",
          "type": "email",
          "required": true
        },
        "phone": {
          "selector": "#phone_number",
          "type": "tel",
          "required": true
        },
        "resume": {
          "selector": "input[type=file][name=resume]",
          "type": "file",
          "required": true
        }
      }
    - resume_upload_selector: str (CSS selector for file input, e.g., "#resume-upload")
    - cover_letter_upload_selector: str (optional)
    - credential_type: enum (shared, site_specific, both)
    - form_submit_selector: str (CSS selector for submit button)
    - success_indicators: JSON (list of selectors/text to confirm success)
      Example: ["text:Thank you for applying", "text:Application received"]
    - error_indicators: JSON (list of selectors/text indicating failure)
      Example: ["text:Error submitting", "text:Please try again"]
    - notes: TEXT (additional guidance, e.g., "This site requires 2FA after login")
    - created_at: TIMESTAMP
    - updated_at: TIMESTAMP
    - is_active: BOOL (soft-delete / deprecation)
    - version: INT (for tracking playbook iterations)
  ```

#### R2.2 Credential Management (Encryption at Rest)
- **Shared Credentials** (used for all sites unless overridden):
  - Stored in encrypted `.env` file: `~/.applypilot/.env.encrypted`
  - Fields: `SHARED_USERNAME`, `SHARED_PASSWORD`
  - Encryption: AES-256-GCM using PBKDF2-derived key from master password
  - Master password: Stored in system keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
  - Rotation: Users can re-encrypt with `applypilot credentials --rotate`

- **Site-Specific Credentials** (when a site requires unique login):
  - New table: `site_credentials`
    ```sql
    site_credentials:
      - id (PK, UUID)
      - website_registry_id (FK)
      - username: str (encrypted)
      - password: str (encrypted)
      - created_at: TIMESTAMP
      - updated_at: TIMESTAMP
      - is_active: BOOL
    ```
  - Storage: Same encryption as shared credentials
  - Access: Claude context includes only necessary credentials for current application attempt

#### R2.3 Claude Integration with Site Context
- **System Prompt Template** (see detailed section below):
  - Claude receives: site name, application instructions, form field mappings, login flow
  - Claude receives: available credentials (shared or site-specific)
  - Claude is explicitly told: "Use the site-specific instructions to navigate forms correctly"
  - Claude is told: "Extract form fields from HTML and match to the provided mappings"

- **Application Workflow**:
  1. Identify target job board (from job source or domain analysis)
  2. Look up website registry entry by domain
  3. If found in registry:
     - Retrieve login flow instructions
     - Retrieve form field mappings
     - Retrieve applicable credentials (shared + site-specific if applicable)
     - Pass to Claude Code with structured context
  4. If NOT found in registry:
     - Use fallback generic form-filling strategy
     - Claude attempts to infer field names and structure
     - Capture form structure for auto-learning

#### R2.4 Auto-Learning Capability
- **Capture on Failure**:
  - When Claude fails to apply to a site:
    - Capture the HTML structure of the form encountered
    - Capture any error messages or warnings
    - Log the attempted field mappings
    - Suggest site to user: "Failed on Indeed form. Would you like to save a playbook for next time?"

- **Playbook Suggestion Workflow**:
  - User prompted: "Should ApplyPilot learn this site? (y/n)"
  - If yes: System generates suggested `website_registry` entry from captured form
  - User can review/edit the suggested entry in CLI or web interface
  - Saved to database with version=1, is_active=True

- **Iterative Improvement**:
  - Each successful application is logged with applied field mappings
  - Over time, system builds confidence in site-specific strategies
  - User can run: `applypilot registry --optimize` to analyze success/failure patterns and suggest improvements

#### R2.5 Application Flow with Registry
- **Apply to Job (with Registry)**:
  1. Load target job from database
  2. Identify domain (e.g., "indeed.com")
  3. Query `website_registry` for matching domain entry
  4. If registry entry found AND is_active:
     - Prepare Claude context with login instructions + form mappings
     - Load applicable credentials from keyring
     - Invoke Claude Code with site-specific context
     - Result: Structured response with success/failure, fields encountered, errors
  5. If registry entry NOT found:
     - Prepare Claude with generic form-filling strategy
     - Claude attempts best-effort field filling
     - Result: Structured response + suggestion to auto-learn
  6. Log result to database
  7. Update job application status

---

### **Requirement Group 3: Comprehensive Logging & Error Handling**

#### R3.1 Structured Logging for Poll Cycles
- **Log File Location**: `~/.applypilot/logs/poll-cycle-YYYY-MM-DD-HH-MM-SS.log`
- **Format** (JSON for easy parsing):
  ```json
  {
    "timestamp": "2024-12-15T10:30:45Z",
    "poll_cycle_id": "cycle_8d4f9c3a2b1e",
    "stage": "discovery",
    "action": "discover_complete",
    "job_board": "indeed.com",
    "new_jobs": 42,
    "duplicates_skipped": 5,
    "duration_s": 125,
    "errors": []
  }
  ```

#### R3.2 Application-Specific Logging
- Each application attempt logged:
  ```json
  {
    "timestamp": "2024-12-15T11:05:30Z",
    "action": "application_attempt",
    "job_id": "job_3c9a2f1d",
    "job_title": "Senior Software Engineer",
    "domain": "indeed.com",
    "registry_status": "found",
    "registry_version": 3,
    "result": "success",
    "duration_s": 45,
    "fields_filled": ["full_name", "email", "phone", "resume"],
    "errors": []
  }
  ```

#### R3.3 Error Classification
- **Recoverable Errors** (retry in next cycle):
  - Network timeout
  - Site temporarily down (5xx)
  - Rate limit (429)
  - Transient service error
  
- **Skippable with Warning** (flag for manual review):
  - CAPTCHA encountered
  - Suspicious activity detected
  - Human verification required
  
- **Non-recoverable** (mark as failed, don't retry):
  - Invalid application URL
  - Job posting closed
  - Site blocking access
  - Invalid credentials
  - Application already submitted to this job

#### R3.4 Notifications (Slack/Email)
- Slack integration (same as original spec):
  - `--slack-webhook-url`: Post job matches and application summaries
  - `--notify-on {matches, applications, errors, all}`
  
- Email integration (same as original spec):
  - `--email-to`, `--smtp-server`, etc.
  
- Notification Throttling: Max 1 notification per 5 minutes

---

## Implementation Phases (Revised)

### **Phase 1: Enhanced Init & Dependency Detection** (Weeks 1-2)
*(No changes from original v1 spec; runs in parallel with Phase 2)*

**Objective**: Refactor `applypilot init` with intelligent dependency detection, tier degradation, and integrated diagnostics.

**Key Deliverables**:
- Refactored `applypilot init` command with SKIP/DEFER options
- New `DependencyDetector` class
- New `DiagnosticCheckpoint` class with API key validation
- New `InitState` model for persisting init metadata
- Updated wizard UX with tier-based checklists

**Estimated Scope**: Medium (~40-60 story points)

**Phase Dependencies**: None

---

### **Phase 2: Database Schema Enhancements** (Week 1, in parallel)
*(Expands original v1 spec with Website Registry tables)*

**Objective**: Add schema to support scheduling, website registry, and enhanced credential management.

**Key Deliverables**:
- New database columns: `last_polled_at`, `poll_cycle_id`, `apply_attempts`, `apply_error`, `apply_error_at`, `apply_status`, `poll_cycle_id`
- New `website_registry` table with site-specific application instructions
- New `site_credentials` table for managing site-specific login credentials
- New `poll_history` table for tracking poll cycles and deduplication
- Database migration strategy with backward compatibility
- Schema versioning

**Estimated Scope**: Medium (~30-40 story points)

**Phase Dependencies**: None

---

### **Phase 3: Scheduling System & Website Registry** (Weeks 2-3)
*(Replaces "Autopilot Core Loop"; includes registry setup)*

**Objective**: Implement `applypilot schedule` command with cron/Task Scheduler integration and seed Website Registry with popular job boards.

**Key Deliverables**:
- New `ScheduleManager` class:
  - Parse `--interval` and `--time` arguments
  - Generate cron expressions (Linux/macOS) or PowerShell Task Scheduler commands (Windows)
  - Write cron entry to `/etc/cron.d/applypilot` or user's crontab
  - Create Windows Task Scheduler job via PowerShell
  - Retrieve and display current schedule status
  
- `applypilot schedule` subcommands:
  - `--enable`: Activate polling schedule
  - `--disable`: Remove schedule
  - `--status`: Show current configuration
  - `--list`: List all schedules
  
- `applypilot run` command (new entry point):
  - Execute single poll cycle immediately
  - `--skip-apply`: Test discovery/enrich/score without applying
  - `--dry-run`: Simulate without database writes
  - `--max-applications N`: Limit applications per run
  
- Website Registry initialization:
  - Seed database with 50+ popular job boards (Indeed, LinkedIn, Greenhouse, Workday, etc.)
  - Pre-populated form field mappings for each site
  - Pre-populated login flow instructions
  - Pre-populated success/error indicators
  
- CLI command for registry management:
  - `applypilot registry --list`: Show all registered sites
  - `applypilot registry --add`: Manual entry creation
  - `applypilot registry --edit DOMAIN`: Update existing entry
  - `applypilot registry --optimize`: Analyze success/failure patterns and suggest improvements

**Estimated Scope**: Large (~70-90 story points)

**Phase Dependencies**: Phase 2 (database schema), Phase 1 (init)

---

### **Phase 4: Enhanced Claude Integration & Credential Management** (Weeks 3-4)
*(New phase; replaces/expands daemon mode from v1)*

**Objective**: Integrate Claude Code with Website Registry for intelligent site-specific applications; implement secure credential storage.

**Key Deliverables**:
- Enhanced `ApplicationExecutor` class:
  - Look up website registry by domain
  - Prepare Claude context with site-specific instructions
  - Call Claude Code with structured prompts
  - Parse Claude response (success/failure, fields encountered, errors)
  - Auto-learning suggestion workflow
  
- Credential management:
  - `CredentialVault` class:
    - Encrypt/decrypt shared credentials using system keyring
    - Manage site-specific credentials from `site_credentials` table
    - Key derivation: PBKDF2 from master password (stored in keyring)
    - Encryption: AES-256-GCM
  - `applypilot credentials` command:
    - `--set-shared`: Store shared credentials (username/password)
    - `--add-site DOMAIN`: Add site-specific credentials
    - `--list`: Show which credentials are configured (no values)
    - `--rotate`: Re-encrypt with new master password
  
- Claude system prompt template:
  - Dynamic generation based on site registry entry
  - Includes form field mappings as structured JSON
  - Includes login flow steps
  - Clear instructions for error handling and recovery
  
- Application result capture:
  - Structured logging of all application attempts
  - Capture form field names/selectors encountered
  - Capture any validation errors or site-specific messages
  - Flag for auto-learning if failure occurs

**Estimated Scope**: Large (~70-90 story points)

**Phase Dependencies**: Phase 3 (scheduling + registry), Phase 1 (init)

---

### **Phase 5: Error Handling, Logging & Auto-Learning** (Weeks 4-5)
*(Consolidates error handling, logging, and adds auto-learning workflow)*

**Objective**: Comprehensive error handling, structured logging, and auto-learning capability for Website Registry.

**Key Deliverables**:
- Error handling framework:
  - Error classification (recoverable, skippable, non-recoverable)
  - Retry logic: Exponential backoff (1s, 4s, 16s) for recoverable errors
  - Rate limiting: Respect HTTP 429 responses, pause + retry
  - Timeout handling: Configurable timeouts per stage
  
- Structured logging system:
  - JSON log format for easy parsing/alerting
  - Daily log rotation with compression and archiving
  - Log aggregation endpoint (optional—for centralized logging)
  - Query tools: `applypilot logs --filter stage=application --since 24h`
  
- Auto-learning workflow:
  - Capture form structures on failure
  - Generate suggested `website_registry` entry
  - User confirmation UI: "Learn this site for next time? (y/n)"
  - Version tracking: Each playbook gets incremented version
  
- Health check & monitoring:
  - HTTP health endpoint (port 8000 if running in Docker/server mode)
  - Responds with: uptime, job stats, last poll time, application success rate
  - Can be queried by external monitoring (Prometheus, DataDog, etc.)

**Estimated Scope**: Large (~60-80 story points)

**Phase Dependencies**: Phase 4 (Claude integration), Phase 3 (scheduling)

---

## Website Registry: Key Design Features

### **Purpose & Benefits**

The Website Registry is the central knowledge base for site-specific application patterns. Instead of Claude Code blindly attempting to fill every form generically, it leverages pre-configured, tested playbooks that dramatically increase success rates.

### **Registry Entry Structure** (Example: Indeed)

```json
{
  "id": "registry_indeed_001",
  "company_name": "Indeed Inc",
  "domain": "indeed.com",
  "job_board_type": "indeed",
  "login_flow_instructions": "1. Click 'Sign In' button in top-right\n2. Enter email address in 'Email or phone' field\n3. Click 'Continue'\n4. Enter password in 'Password' field\n5. Click 'Sign In'\n6. Handle 2FA if prompted: check email for code and enter",
  "form_fields_mapping": {
    "full_name": {
      "selector": "#applicant_name",
      "type": "text",
      "required": true,
      "note": "First and last name"
    },
    "email": {
      "selector": "#email",
      "type": "email",
      "required": true
    },
    "phone": {
      "selector": "#phone_number",
      "type": "tel",
      "required": true,
      "format": "(XXX) XXX-XXXX"
    },
    "address": {
      "selector": "#address",
      "type": "text",
      "required": false
    },
    "resume": {
      "selector": "input[name='resume'][type='file']",
      "type": "file",
      "required": true,
      "format": "pdf|docx|doc"
    }
  },
  "resume_upload_selector": "input[name='resume'][type='file']",
  "cover_letter_upload_selector": null,
  "credential_type": "shared",
  "form_submit_selector": "button:contains('Submit'):not(:disabled)",
  "success_indicators": ["text:Application submitted", "text:Thank you for applying"],
  "error_indicators": ["text:Error submitting", "text:Please try again", "text:Required field"],
  "notes": "Indeed forms are usually single-page. Resume can be uploaded or pasted. Phone format strictly (XXX) XXX-XXXX.",
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z",
  "is_active": true,
  "version": 1
}
```

### **50+ Pre-Populated Sites** (Seed Data Includes)

1. Indeed
2. LinkedIn
3. Greenhouse
4. Workday
5. ZipRecruiter
6. CareerBuilder
7. Dice (Tech jobs)
8. Vault (Law, Finance, Consulting)
9. Built In (Startup jobs)
10. Stack Overflow Jobs
11. GitHub Jobs
12. HackerRank Jobs
13. LeetCode Jobs
14. Blind (Tech anonymously)
15. Levels.fyi (Compensation)
16. AngelList (Startup jobs)
17. Crunchboard (Startup jobs)
18. Product Hunt (Product roles)
19. RemoteOK (Remote jobs)
20. We Work Remotely
21. FlexJobs (Remote, flexible)
22. JustRemote (Remote jobs)
23. Upwork (Freelance)
24. Freelancer (Freelance)
25. Toptal (Freelance)
26. Gun.io (Contract dev)
27. Geektastic (Talent community)
28. CodeSignal (Assessment-based)
29. Hired (Recruiter outreach)
30. Vettery (Recruiter outreach)
31. Pangian (Remote recruiter)
32. Working Nomads (Remote)
33. Nomad List (Remote community)
34. X-Team (Remote gaming)
35. Gigster (Project-based)
36. Catalant (Consulting)
37. McKinsey Careers (Consulting)
38. BCG Careers (Consulting)
39. Google Careers
40. Microsoft Careers
41. Amazon Careers
42. Apple Careers
43. Meta Careers
44. Netflix Careers
45. Stripe Careers
46. Airbnb Careers
47. Tesla Careers
48. SpaceX Careers
49. Custom ATS (Generic fallback)
50. Generic Career Page (Fallback)

---

## Daemon Mode vs Scheduled Polling: Comparison Table

| Feature | Daemon Mode (v1) | Scheduled Polling (v2) | Winner |
|---------|------------------|------------------------|--------|
| **Process Complexity** | High (fork, PID, signals) | Low (OS handles it) | v2 |
| **Cross-Platform Support** | Tricky (different on Mac/Linux/Windows) | Native (cron, Task Scheduler) | v2 |
| **Docker Friendly** | No (daemon antipattern in containers) | Yes (each poll is separate process) | v2 |
| **Process Management** | Manual (daemon stop/start/status) | Automatic (cron/Task Scheduler) | v2 |
| **Monitoring/Alerting** | Hard (custom health check needed) | Easy (cron can email on failure) | v2 |
| **Development Complexity** | High (concurrency, async bugs) | Low (simple synchronous poll) | v2 |
| **Testing** | Hard (background process testing) | Easy (can test in isolation) | v2 |
| **Resource Overhead** | Always running (≥50 MB memory) | Minimal (only during poll) | v2 |
| **Instant Feedback** | Yes (daemon responds immediately) | No (wait for next scheduled time) | v1 |
| **Manual Trigger** | Limited (daemon mode only) | Yes (`applypilot run` anytime) | v2 |
| **Credential Security** | Encrypted (added in v2) | Encrypted + keyring (v2 feature) | v2 |
| **Application Intelligence** | Generic form-filling | Site-specific playbooks | v2 |
| **Error Recovery** | Manual restart needed | Automatic (cron retries) | v2 |
| **System Integration** | Custom, ApplyPilot-specific | Standard OS scheduling | v2 |
| **Learning Curve** | Medium (daemon concepts) | Low (familiar cron/Task Scheduler) | v2 |

**Verdict**: Scheduled Polling (v2) is simpler, more reliable, better integrated with OS, and easier to develop/test. The only disadvantage (no instant response) is mitigated by manual `applypilot run` command.

---

## Data Schema Summary

### Core Tables (from Phase 2)

**website_registry**: Site-specific application playbooks (50+ pre-populated entries)
**site_credentials**: Site-specific login credentials (encrypted)
**poll_history**: Track poll cycles and deduplication
**schedule_config**: Store active schedule configurations
**jobs** (modified): Add application status tracking columns

### Encryption Strategy

- **Shared Credentials**: `~/.applypilot/.env.encrypted` (AES-256-GCM)
- **Site-Specific Credentials**: `site_credentials` table (encrypted columns)
- **Master Password**: System keyring (macOS Keychain, Windows Credential Manager, Linux KDE)
- **Encryption**: PBKDF2 key derivation (100k iterations), AES-256-GCM cipher

### Key Indexes

- `website_registry(domain)` - Fast domain lookup
- `jobs(apply_status)` - Quick filter for pending applications
- `poll_history(completed_at)` - Recent poll queries
- `site_credentials(website_registry_id)` - Credential retrieval per site

---

## Migration Path Summary

### For Existing v1 Users

```bash
# 1. Backup
cp -r ~/.applypilot ~/.applypilot.backup.v1

# 2. Stop daemon
applypilot daemon stop

# 3. Upgrade
pip install --upgrade applypilot

# 4. Migrate database
applypilot db --migrate

# 5. Seed registry
applypilot db --seed-registry

# 6. Set credentials
applypilot credentials --set-shared

# 7. Configure schedule
applypilot schedule --enable --interval 8h --time 08:00

# 8. Test
applypilot run --dry-run

# 9. Live
applypilot run
```

### What's Preserved vs. Changed

- ✓ **Preserved**: All existing job data, user profile, search config
- ✓ **Preserved**: Scoring logic, enrichment, tailor, cover letter generation
- ✗ **Changed**: `applypilot autopilot --daemon` → `applypilot schedule --enable`
- ✗ **Changed**: Daemon process management → OS scheduler (cron/Task Scheduler)
- ✗ **Changed**: Generic application → Site-specific playbooks via registry
- ✓ **New**: Auto-learning, website registry, encrypted credentials, structured logging

---

## High-Level Implementation Summary

### Phase 3: Core Scheduling & Registry
- `ScheduleManager` class (cron/Task Scheduler integration)
- `applypilot schedule` and `applypilot run` commands
- Website registry seed data (50+ sites)
- Registry management CLI

### Phase 4: Intelligent Application
- `CredentialVault` (encrypted credential storage)
- `ClaudeIntegration` (site-specific context)
- `ApplicationExecutor` (registry-aware application)
- Auto-learning workflow
- `applypilot credentials` command

### Phase 5: Error Handling & Observability
- `ErrorClassifier` (error categorization)
- Retry logic (exponential backoff)
- Structured JSON logging
- Log rotation and archiving
- Health check endpoint
- Registry version tracking and optimization

---

## Key Architectural Decisions

1. **Scheduled Polling over Daemon**: Simpler operations, better cross-platform, easier testing
2. **Website Registry**: Centralized playbooks for site-specific form-filling
3. **Auto-Learning**: Progressive improvement without manual intervention
4. **Encrypted Credentials**: AES-256-GCM at rest, system keyring for master password
5. **Structured Logging**: JSON format for easy parsing and monitoring
6. **Modular Phases**: Independent development, clear interfaces, parallel work
7. **Graceful Degradation**: Unknown site → fallback to generic form-filling
8. **Manual Override**: `applypilot run` for user agency + scheduled automation

---

## Success Metrics (Post-Implementation)

- Application success rate: 75%+ on registered sites
- Setup time: <5 minutes for new users
- Poll cycle duration: <5 minutes for 100 jobs
- Auto-learning: 10+ new sites learned per month
- Error detection: 95%+ of failures properly classified
- User satisfaction: <2 manual interventions per week per user

---

**End of ApplyPilot Improvements v2 Specification**

All changes from v1 → v2:
- **Removed**: Daemon mode, PID file management, continuous background process
- **Added**: Scheduled polling (cron/Task Scheduler), Website Registry, auto-learning, encrypted credentials, structured logging
- **Enhanced**: Claude integration, error handling, application intelligence
- **Simplified**: Operations, cross-platform support, testing, monitoring

