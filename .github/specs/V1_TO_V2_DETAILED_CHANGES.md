# ApplyPilot Improvements: v1 → v2 Detailed Changes

## Document Navigation

- **Full v2 Specification**: `applypilot-improvements-v2-spec.md` (728 lines)
- **Executive Summary**: `APPLYPILOT_V2_SUMMARY.md` (471 lines)
- **This Document**: Detailed section-by-section comparison

---

## 1. PHASE 3: CORE LOOP REPLACEMENT

### v1 Phase 3: "Autopilot Core Loop"
```
Weeks 2-3, ~60-80 story points
Objective: Implement continuous polling via `applypilot autopilot --daemon`

Key Deliverables:
- AutopilotOrchestrator class managing main loop
- Continuous polling, deduplication logic
- Apply rate limiting and queuing
```

### v2 Phase 3: "Scheduling System & Website Registry"
```
Weeks 2-3, ~70-90 story points
Objective: Implement scheduled polling via OS schedulers + website registry

Key Deliverables:
- ScheduleManager class (cron/Task Scheduler integration)
- applypilot schedule command with --enable/--disable/--status/--list
- applypilot run command (single poll cycle)
- Website Registry initialization (50+ sites pre-populated)
- Registry management CLI (--list, --add, --edit, --optimize, --learn)

NEW PARADIGM:
- No daemon process
- No PID file management
- Cron/Task Scheduler handles scheduling
- Each poll is separate process invocation
```

---

## 2. PHASE 4: ERROR HANDLING & DAEMON MODE → ENHANCED CLAUDE + CREDENTIALS

### v1 Phase 4: "Error Handling, Retries & Logging"
```
Weeks 3-4, ~60-80 story points
Objective: Robust error handling, retry logic, comprehensive logging

Key Deliverables:
- Retry logic for transient errors
- Structured logging framework (JSON format)
- Log rotation and archiving
- Health check and memory management
- Error classification and actionable messages
```

### v2 Phase 4: "Enhanced Claude Integration & Credential Management"
```
Weeks 3-4, ~70-90 story points
Objective: Integrate Claude with Website Registry for intelligent applications

Key Deliverables:
- CredentialVault class (AES-256-GCM encryption + keyring)
- applypilot credentials command (--set-shared, --add-site, --list, --rotate, --test)
- Enhanced ApplicationExecutor (registry lookup + site context)
- ClaudeIntegration class (dynamic prompts with site instructions)
- Auto-learning workflow (capture form, generate playbook, user confirmation)
- Credential safety (no logging of secrets)
- Site-specific vs shared credential logic

MAJOR NEW FEATURE: Website Registry Integration
- Register entries by domain
- Pre-configured form field mappings
- Site-specific login instructions
- Encrypted credential storage (both shared + site-specific)
```

---

## 3. PHASE 5: DAEMON MODE → ERROR HANDLING + AUTO-LEARNING

### v1 Phase 5: "Notifications & Daemon Mode"
```
Weeks 4-5, ~40-50 story points
Objective: Optional notifications, daemon support, Docker containerization

Key Deliverables:
- Slack/email notification integration
- Daemon mode (fork, detach, PID file management)
- applypilot daemon subcommand (status, stop, logs)
- Docker setup guide and health check endpoint
- Systemd service file template
```

### v2 Phase 5: "Error Handling, Logging & Auto-Learning"
```
Weeks 4-5, ~60-80 story points
Objective: Comprehensive error handling, logging, and auto-learning

Key Deliverables:
- ErrorClassifier class (recoverable, skippable, non-recoverable)
- Retry logic with exponential backoff (1s, 4s, 16s)
- Structured JSON logging (daily rotation, compression, archiving)
- applypilot logs command (--since, --filter, --follow)
- Auto-learning workflow (capture form on failure, generate playbook)
- Health check endpoint (HTTP GET /health on port 8000)
- Registry version tracking and optimization

REMOVED FROM v2:
- No daemon-specific code (cron/Task Scheduler handles it)
- No PID file management
- No Systemd service templates (use native OS schedulers)

ENHANCED VS v1:
- Auto-learning captures form structure on failure
- Registry version tracking (know which playbook was used)
- Health check is standard HTTP endpoint (works everywhere)
- Error classification drives different retry strategies
```

---

## 4. DATABASE SCHEMA CHANGES

### v1 Schema Additions (Phase 2)
```
New Columns (jobs table):
- last_polled_at
- poll_cycle_id
- apply_attempts
- apply_error
- apply_error_at

New Tables:
- daemon_state (heartbeat, health metadata)
- poll_history (poll cycle tracking)
```

### v2 Schema Changes (Phase 2 EXPANDED)
```
Same columns as v1 PLUS:

New Columns (jobs table):
- website_registry_id (FK to website_registry)
- applied_at (when application was submitted)
- apply_status (enum: pending, applied, apply_failed, apply_skipped)

New Tables (replaces daemon_state with more useful tables):
✗ Removed: daemon_state table (not needed—no daemon)
✓ Added: website_registry (site playbooks, 50+ pre-populated)
✓ Added: site_credentials (encrypted site-specific credentials)
✓ Added: poll_history (tracks poll cycles)
✓ Added: schedule_config (stores active schedule configurations)

Indexes:
- website_registry(domain) - fast domain lookup
- jobs(apply_status) - quick filter for pending applications
- jobs(website_registry_id) - find jobs by site
- poll_history(completed_at) - recent poll queries
- site_credentials(website_registry_id) - credential retrieval per site
```

---

## 5. NEW COMMANDS IN v2

### Removed Commands
```
❌ applypilot daemon status     (replaced by OS-level process checking)
❌ applypilot daemon stop        (cron/Task Scheduler manage process)
❌ applypilot daemon logs        (use applypilot logs instead)
❌ applypilot autopilot --daemon (replaced by applypilot schedule)
```

### New Commands
```
✅ applypilot schedule --enable --interval 8h --time 08:00
   Creates cron entry (Linux/macOS) or Task Scheduler job (Windows)

✅ applypilot schedule --disable
   Removes cron entry or Task Scheduler job

✅ applypilot schedule --status
   Shows current schedule and next poll time

✅ applypilot schedule --list
   Lists all configured schedules

✅ applypilot run
   Execute single poll cycle immediately

✅ applypilot run --dry-run
   Simulate poll without committing to database

✅ applypilot run --skip-apply
   Discover/enrich/score but don't apply

✅ applypilot run --max-applications 5
   Limit applications to 5 per run

✅ applypilot credentials --set-shared
   Store shared username/password (encrypted)

✅ applypilot credentials --add-site linkedin.com
   Store site-specific credentials

✅ applypilot credentials --list
   Show configured credentials (no values)

✅ applypilot credentials --rotate
   Re-encrypt all credentials with new master password

✅ applypilot credentials --test DOMAIN
   Test login without applying

✅ applypilot registry --list
   Show all registered sites (50+ pre-populated)

✅ applypilot registry --add
   Manually add new site entry

✅ applypilot registry --edit DOMAIN
   Update existing registry entry

✅ applypilot registry --enable/--disable DOMAIN
   Toggle site active/inactive

✅ applypilot registry --optimize
   Analyze success/failure patterns, suggest improvements

✅ applypilot registry --learn DOMAIN
   Capture form structure for auto-learning

✅ applypilot logs --since 24h
   Show logs from last 24 hours

✅ applypilot logs --filter stage=application
   Filter logs by criteria

✅ applypilot logs --follow
   Tail logs in real-time

✅ applypilot logs --list
   List available log files
```

---

## 6. CREDENTIAL MANAGEMENT: v1 vs v2

### v1 Credential Storage
```
Problem: No encryption, no site-specific support

Storage:
- ~/.applypilot/.env file (plaintext)
- Fields: SHARED_USERNAME, SHARED_PASSWORD
- Risk: Unencrypted, world-readable, no rotation

Site-Specific: Not supported
```

### v2 Credential Storage
```
Solution: Encryption + keyring + site-specific support

Shared Credentials:
- ~/.applypilot/.env.encrypted (encrypted, not readable)
- Encryption: AES-256-GCM
- Key derivation: PBKDF2 (100k iterations, random salt)
- Master password: System keyring (never on disk)
  * macOS Keychain
  * Windows Credential Manager
  * Linux Secret Service
- Rotation: applypilot credentials --rotate

Site-Specific Credentials:
- site_credentials database table (encrypted columns)
- Different login for each job board
- Example: LinkedIn username ≠ Indeed username
- Same encryption as shared credentials

Access Pattern:
1. Load credentials from storage
2. Decrypt with master password (from keyring)
3. Use in Claude context (minimal info)
4. Clear from memory immediately after

Logging:
- Never log credential values
- Log only operation type: "Credentials set", "Credentials rotated"
- Zero secrets in any log file
```

---

## 7. WEBSITE REGISTRY: ENTIRE NEW SYSTEM

### No Equivalent in v1
The Website Registry is the major architectural innovation in v2.

### v2 Registry Features

#### Pre-Populated Sites (50+)
```
Major Job Boards:
- Indeed, LinkedIn, Glassdoor, ZipRecruiter, CareerBuilder, Dice

Tech-Specific:
- HackerRank, LeetCode, Stack Overflow, GitHub, Blind

Startups:
- AngelList, Product Hunt, Built In

Remote:
- RemoteOK, We Work Remotely, FlexJobs

Consulting/Finance:
- McKinsey, BCG, Vault

Tech Companies:
- Google, Microsoft, Amazon, Apple, Meta, Netflix, Stripe, Tesla

Fallbacks:
- Generic Greenhouse/Workday/ATS
- Custom career page
```

#### Per-Site Entry Contains
```json
{
  "domain": "indeed.com",
  "company_name": "Indeed Inc",
  "job_board_type": "indeed",
  
  "login_flow_instructions": "Step-by-step login guide",
  
  "form_fields_mapping": {
    "full_name": {
      "selector": "CSS selector",
      "type": "text|email|tel|file",
      "required": true/false,
      "format": "optional format string"
    },
    ...
  },
  
  "resume_upload_selector": "CSS selector for file input",
  "cover_letter_upload_selector": "CSS selector (optional)",
  
  "credential_type": "shared|site_specific|both",
  
  "form_submit_selector": "CSS selector for submit button",
  
  "success_indicators": [
    "text:Application submitted",
    "css:.confirmation-message",
    "url:https://site.com/thankyou"
  ],
  
  "error_indicators": [
    "text:Error submitting",
    "css:.error-message"
  ],
  
  "notes": "Site-specific guidance",
  
  "version": 1,
  "is_active": true,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

#### Auto-Learning Workflow
```
Scenario: Claude fails to apply to unknown site

1. Claude attempts application
2. Form structure not recognized
3. System captures:
   - HTML structure
   - Field names/IDs found
   - Error messages
   - Attempted field mappings

4. User prompted:
   "Application to [site] failed. Learn this site? (y/n)"

5. If yes:
   - System generates suggested registry entry
   - User reviews and optionally edits
   - Saved to database with version=1

6. Next poll:
   - Site found in registry
   - Uses playbook instead of generic strategy
   - Much higher success rate

7. Over time:
   - Track success/failure per playbook version
   - Registry evolves
   - applypilot registry --optimize suggests improvements
```

---

## 8. CLAUDE INTEGRATION: v1 vs v2

### v1 Application Approach
```
Simple text prompt to Claude:
"Please fill this form with the following information:
Name: John Doe
Email: john@example.com
Phone: (555) 123-4567
..."

Problems:
- Claude doesn't know the form structure
- Field names/selectors unknown
- Login flow not explained
- No site-specific guidance
- Generic form-filling → frequent failures
- On failure: no learning, just retry or skip
```

### v2 Application Approach
```
Rich structured context to Claude:

1. Site Information:
   - Name: Indeed
   - Type: indeed
   - Domain: indeed.com

2. Login Instructions:
   - Step-by-step guide
   - Expected success indicators
   - 2FA handling guidance

3. Form Field Mappings:
   - Exact CSS selectors for each field
   - Field types (text, email, tel, file)
   - Required vs optional
   - Format specifications

4. Credential Context:
   - Available credentials (shared or site-specific)
   - Which credential type this site uses
   - Credentials not logged (referenced only)

5. Success/Error Indicators:
   - Exact text to look for on success
   - Exact text to look for on failure

6. System Instructions:
   - "Use ONLY the provided selectors"
   - "Match provided form field mappings"
   - "Report detailed errors if application fails"
   - "Suggest form structure if not found"

Result:
- Claude knows exactly what to do
- Failures are more precise
- On failure: form structure captured for auto-learning
- On success: logged with playbook version used
- Over time: higher success rates as registry improves
```

---

## 9. ERROR HANDLING: v1 vs v2

### v1 Error Handling (Phase 4)
```
Retry Logic:
- Transient errors: retry 3 times with 1s, 4s, 16s backoff
- Network timeout: retry
- CAPTCHA: skip
- Rate limit (429): pause 60s, continue
- Non-recoverable: mark as failed, don't retry

Logging:
- Structured JSON to log file
- Daily rotation with compression
- Max 7 days retention

Classification:
- Minimal error categorization
```

### v2 Error Handling (Phase 5 ENHANCED)
```
ErrorClassifier System:
- Recoverable: Network timeout, 5xx errors, transient failures
  → Retry 3 times with exponential backoff
  
- Skippable: CAPTCHA, suspicious activity, human verification needed
  → Flag for manual review, don't retry
  → Log with notification
  
- Non-recoverable: Invalid URL, job closed, blocked site, bad credentials
  → Mark as failed, don't retry

Retry Logic (same as v1 base):
- Exponential backoff: 1s, 4s, 16s
- Rate limit (429): Pause 60s, don't count against retry limit
- Specific handling for each error type

Logging (enhanced):
- Structured JSON logs
- Daily rotation with compression and archiving
- Max 7-day retention, 500MB total
- Query tools: applypilot logs --filter, --since, --follow

Auto-Learning on Failure:
- Capture form structure
- Generate suggested registry entry
- User confirmation workflow
- Saved playbook for future

Health Monitoring:
- HTTP health endpoint (/health on port 8000)
- Returns: uptime, job stats, success rate, memory
- External monitoring integration (Prometheus, DataDog)
```

---

## 10. LOGGING: v1 vs v2

### v1 Logging (Phase 4)
```
Format: JSON-structured logs

Location: ~/.applypilot/logs/autopilot-YYYY-MM-DD.log

Rotation: Daily (max 7 days)

Example:
{
  "timestamp": "2024-12-15T10:30:45Z",
  "level": "INFO",
  "stage": "discovery",
  "action": "discover_complete",
  "new_jobs": 42,
  "duration_s": 125,
  "errors": []
}

Access:
- User must tail log file manually
- Limited query capabilities
```

### v2 Logging (Phase 5 ENHANCED)
```
Format: JSON-structured logs (same as v1)

Location: ~/.applypilot/logs/poll-cycle-YYYY-MM-DD-HH-MM-SS.log

Rotation: Daily + compression + archiving

Additional Features:
- Per-application-attempt logging
- Poll cycle summary
- Registry version tracking
- Error classification logging

Example (per-application):
{
  "timestamp": "2024-12-15T11:05:30Z",
  "action": "application_attempt",
  "job_id": "job_3c9a2f1d",
  "domain": "indeed.com",
  "registry_status": "found",
  "registry_version": 3,
  "result": "success",
  "duration_s": 45,
  "fields_filled": ["full_name", "email", "phone", "resume"],
  "errors": []
}

Query Commands (NEW):
- applypilot logs --since 24h
- applypilot logs --filter stage=application
- applypilot logs --filter status=failed
- applypilot logs --follow (tail mode)
- applypilot logs --list (show available logs)

Cleanup:
- Auto-archive: Logs >1 day gzipped
- Auto-delete: Logs >7 days deleted
- Disk limit: Max 500MB total

Access:
- Rich CLI interface for querying
- Structured JSON for tooling
- Easy to alert/monitor on
```

---

## 11. TESTING & OPERATIONS

### v1 Operations
```
Daemon Mode Challenges:
- Difficult to test background behavior
- PID file management edge cases
- Signal handling bugs common
- Process resurrection manual
- Cross-platform complexity (different OS, different daemon impl)
- No standard monitoring (custom health check needed)
- Debugging background process tricky
```

### v2 Operations
```
Scheduled Polling Advantages:
- Each poll is separate, stateless process
- Easy to test in isolation
- No process management complexity
- Automatic recovery via cron/Task Scheduler
- Same scheduling logic everywhere (native OS schedulers)
- Standard monitoring (cron can email on failure, etc.)
- Easy debugging (run applypilot run manually)
- Docker-native (no special daemon handling)
- Kubernetes-friendly (batch job model)
```

---

## 12. DEPLOYMENT SCENARIOS

### v1 Daemon Deployment
```
Local Machine:
- applypilot autopilot --daemon
- Check status: applypilot daemon status
- Manage: applypilot daemon stop/start
- Docker: Special handling, not recommended

Docker:
- Don't use daemon (antipattern)
- Need custom entrypoint
- Hard to manage process lifecycle

Server/VPS:
- Run daemon in background
- Systemd service template provided
- Manual process monitoring needed
```

### v2 Scheduled Polling Deployment
```
Local Machine:
- applypilot schedule --enable --interval 8h --time 08:00
- Cron/Task Scheduler manage lifecycle automatically
- Manual test: applypilot run
- Manual trigger: applypilot run anytime

Docker:
- Kubernetes CronJob (native resource)
  ```yaml
  apiVersion: batch/v1
  kind: CronJob
  metadata:
    name: applypilot
  spec:
    schedule: "0 0,8,16 * * *"
    jobTemplate:
      spec:
        template:
          spec:
            containers:
            - name: applypilot
              image: applypilot:latest
              command: ["applypilot", "run"]
  ```
- Simple, standard, no special handling

Server/VPS:
- Use native cron: `crontab -e`
- Or: Kubernetes CronJob (if running k8s)
- Or: Native Task Scheduler (if Windows)
- All standard, no ApplyPilot-specific code

Cloud Schedulers:
- AWS CloudWatch Events
- Google Cloud Scheduler
- Azure Logic Apps
- All can trigger `applypilot run` via HTTP/API
```

---

## 13. SUCCESS METRICS

### v1 Success Criteria
```
- Setup completes in <2 minutes
- Users can run applypilot init && applypilot autopilot --daemon
- Daemon can run for weeks without manual intervention
- Configuration persists across sessions
```

### v2 Success Criteria
```
All from v1, PLUS:

- Scheduled polls run automatically without daemon management
- Claude applies to 75%+ of jobs on registered sites (vs. generic)
- Auto-learning: 10+ new sites learned per month
- Setup completes in <5 minutes (including credential setup + schedule)
- 95%+ of application failures properly classified
- <2 manual interventions per week per user
- 90%+ uptime (auto-recovery via cron)
- 50+ job boards in registry (pre-populated)
```

---

## Summary Table: Key Differences

| Aspect | v1 | v2 |
|--------|----|----|
| **Scheduling** | Daemon process | OS scheduler (cron/Task Scheduler) |
| **Application Logic** | Generic form-filling | Site-specific playbooks (50+ pre-populated) |
| **Credentials** | Plaintext .env | Encrypted + keyring + site-specific |
| **Learning** | No | Yes (auto-learning on failure) |
| **New Phases** | Phases 1-5 | Phases 1-5 (different focus) |
| **Removed from v2** | N/A | Daemon code, PID management, Systemd templates |
| **Process Complexity** | High | Low |
| **Docker Support** | Limited | Native (batch job model) |
| **Kubernetes Support** | None | Native (CronJob resource) |
| **Test Coverage** | Hard (async code) | Easy (stateless processes) |
| **Success Rate Target** | Generic ~50% | 75%+ on registered sites |
| **New Commands** | N/A | 12+ new CLI commands |

---

**The core insight**: v2 replaces complex daemon management with standard OS schedulers, adds intelligent site-specific application logic, and introduces auto-learning to continuously improve. This is a fundamental architectural shift toward simplicity, reliability, and intelligence.

