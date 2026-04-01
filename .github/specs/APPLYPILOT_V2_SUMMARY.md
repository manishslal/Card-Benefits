# ApplyPilot v2 Specification - Executive Summary

## Location
`/Users/manishslal/Desktop/Coding-Projects/.github/specs/applypilot-improvements-v2-spec.md`

**Size**: 728 lines, ~29 KB of comprehensive technical architecture

---

## What Changed from v1 → v2

### ✅ **REPLACED: Daemon Mode**
**v1 (Old)**:
```bash
applypilot autopilot --daemon
# Runs continuous background process
# Manages PID files, forking, signals, health checks manually
# Complex cross-platform implementation
# Hard to test, debug, deploy
```

**v2 (New)**:
```bash
# Step 1: Enable scheduling (one-time setup)
applypilot schedule --enable --interval 8h --time 08:00

# Step 2: Poll runs automatically via OS scheduler
# → Cron (Linux/macOS) or Windows Task Scheduler
# → Simple, reliable, native to each platform

# Step 3: Manual poll anytime needed
applypilot run
```

**Benefits**:
- ✓ No PID file management
- ✓ No forking/signal handling complexity
- ✓ Native OS scheduling (same everywhere)
- ✓ Easy Docker integration (poll = one-shot process)
- ✓ Automatic failure recovery (cron retries)
- ✓ Works with standard monitoring tools
- ✓ Much simpler to develop/test

---

### ✅ **NEW: Website Registry** (Central Knowledge Base for Sites)

**Purpose**: Each job board (Indeed, LinkedIn, Greenhouse, etc.) has different form structures, field names, login flows. Instead of Claude guessing, use pre-configured site-specific playbooks.

**Example: Indeed Registry Entry**
```json
{
  "domain": "indeed.com",
  "job_board_type": "indeed",
  "login_flow_instructions": "1. Click Sign In → 2. Email → 3. Password → 4. Continue",
  "form_fields_mapping": {
    "full_name": { "selector": "#applicant_name", "type": "text", "required": true },
    "email": { "selector": "#email", "type": "email", "required": true },
    "phone": { "selector": "#phone_number", "type": "tel", "format": "(XXX) XXX-XXXX" },
    "resume": { "selector": "input[name='resume']", "type": "file", "required": true }
  },
  "form_submit_selector": "button:contains('Submit')",
  "success_indicators": ["text:Application submitted", "text:Thank you for applying"],
  "error_indicators": ["text:Error submitting", "text:Please try again"],
  "version": 1,
  "is_active": true
}
```

**What v2 Includes**:
- **50+ Pre-Populated Sites**: Indeed, LinkedIn, Greenhouse, Workday, ZipRecruiter, etc.
- **Site-Specific Instructions**: Login flows, form field selectors, success/error indicators
- **Version Tracking**: Know which playbook version was used for each application
- **Auto-Learning**: Failed applications → system captures form structure → user saves as playbook

**Result**: 75%+ application success rate on registered sites (vs. generic form-filling failing frequently)

---

### ✅ **ENHANCED: Claude Integration with Site Context**

**v1**: Claude gets minimal context, tries generic form-filling
```
"Please fill this form with: name=John Doe, email=john@example.com, ..."
```

**v2**: Claude gets rich site context
```json
{
  "site_name": "Indeed",
  "login_instructions": "1. Sign in... 2. Continue...",
  "form_fields": {
    "full_name": { "selector": "#applicant_name", "required": true },
    "resume": { "selector": "input[name='resume']", "type": "file" }
  },
  "success_indicators": ["text:Application submitted"],
  "error_indicators": ["text:Error submitting"],
  "instructions": "Use these exact selectors to fill the form..."
}
```

**Result**: Claude knows exactly what to do on each site → fewer errors, clearer error messages

---

### ✅ **NEW: Encrypted Credential Storage**

**v1**: Credentials in plaintext `.env` file

**v2**: Encryption + System Keyring Integration
```
Shared Credentials:
  ~/.applypilot/.env.encrypted
  - Encrypted: AES-256-GCM
  - Key derivation: PBKDF2 (100k iterations)
  - Master password: Stored in system keyring (macOS Keychain, Windows Credential Manager, Linux KDE)

Site-Specific Credentials (e.g., LinkedIn username ≠ Indeed username):
  site_credentials table (database)
  - Same encryption scheme
  - Allows different login for each site
```

**Commands**:
```bash
applypilot credentials --set-shared              # Store shared username/password
applypilot credentials --add-site linkedin.com   # Store LinkedIn-specific credentials
applypilot credentials --list                    # Show configured credentials (no values)
applypilot credentials --rotate                  # Re-encrypt with new master password
```

---

### ✅ **NEW: Auto-Learning System**

**Scenario**: Claude fails to apply to a new job board (not in registry)

**Current Flow**:
1. Application attempt fails → form structure not recognized
2. System captures: HTML structure, field names found, error messages
3. User prompted: "Would you like to learn this site? (y/n)"
4. If yes: System generates suggested registry entry
5. User reviews/edits (optional)
6. Saved to database with version=1, is_active=true
7. Next poll: Uses new playbook → higher success rate

**Benefit**: System learns and improves over time without manual maintenance

---

### ✅ **NEW: Structured JSON Logging**

**v1**: Console output + basic file logging
```
[14:30:45] Discovery: 42 new jobs
[14:35:20] Application: Job #123 failed
```

**v2**: Structured JSON logs for easy parsing/monitoring
```json
{
  "timestamp": "2024-12-15T14:30:45Z",
  "poll_cycle_id": "cycle_8d4f9c3a2b1e",
  "stage": "discovery",
  "action": "discover_complete",
  "job_board": "indeed.com",
  "new_jobs": 42,
  "duration_s": 125,
  "errors": []
}
```

**New Command**:
```bash
applypilot logs --since 24h                    # Last 24 hours
applypilot logs --filter stage=application     # Only applications
applypilot logs --follow                       # Tail mode
```

**Benefits**:
- Easy to parse and alert on
- Log rotation (daily) + compression + archiving
- 7-day retention by default, max 500MB total
- Queryable for debugging

---

## Implementation Phases (v2)

| Phase | Name | Focus | Duration |
|-------|------|-------|----------|
| **1** | Enhanced Init & Dependency Detection | Refactor init command, dependency detection | Weeks 1-2 |
| **2** | Database Schema Enhancements | New tables: website_registry, site_credentials, poll_history | Week 1 (parallel) |
| **3** | Scheduling System & Website Registry | `applypilot schedule`, `applypilot run`, seed 50+ sites | Weeks 2-3 |
| **4** | Claude Integration & Credentials | CredentialVault, site-specific context, auto-learning | Weeks 3-4 |
| **5** | Error Handling, Logging & Auto-Learning | ErrorClassifier, retry logic, structured logging, health check | Weeks 4-5 |

**Total Scope**: ~300 story points across all phases

---

## Key Database Tables (New/Modified)

### `website_registry` (NEW)
Stores site-specific application instructions for 50+ job boards
```
Columns: id, company_name, domain (unique), job_board_type, 
         login_flow_instructions, form_fields_mapping (JSON),
         resume_upload_selector, credential_type, form_submit_selector,
         success_indicators, error_indicators, notes,
         version, is_active, created_at, updated_at
```

### `site_credentials` (NEW)
Encrypted site-specific login credentials
```
Columns: id, website_registry_id (FK), username (encrypted),
         password (encrypted), is_active, created_at, updated_at
```

### `poll_history` (NEW)
Track poll cycles for debugging and deduplication
```
Columns: id, poll_cycle_id (unique), started_at, completed_at,
         status, jobs_discovered, jobs_applied, success_count,
         failure_count, errors, duration_seconds
```

### `schedule_config` (NEW)
Store active polling schedules
```
Columns: id, interval_hours, start_time_utc, enabled,
         cron_expression, task_name (Windows),
         next_poll_time, last_poll_time, created_at, updated_at
```

### `jobs` (MODIFIED)
Added application tracking columns
```
New columns: website_registry_id (FK), applied_at, apply_attempts,
             apply_error, apply_error_at, apply_status, poll_cycle_id
```

---

## Example User Workflow (v2)

### 1️⃣ **Initial Setup**
```bash
$ applypilot init
# Wizard: profile, skills, search config
✓ Profile saved

$ applypilot credentials --set-shared
# Prompt: shared username/password
✓ Credentials encrypted and stored in system keyring

$ applypilot schedule --enable --interval 8h --time 08:00
# Creates cron entry (Linux/macOS) or Task Scheduler job (Windows)
✓ Schedule enabled. Next poll: 2024-12-20 08:00:00 UTC
```

### 2️⃣ **Manual Poll (Test)**
```bash
$ applypilot run --dry-run
Discovery: 42 new jobs
Scored: 38 jobs above threshold
Would apply: 22 jobs
(No actual changes—dry run mode)

$ applypilot run --max-applications 5
Discovery: 42 new jobs
Applications attempted: 5
Successful: 4
Failed: 1 (captured form structure for auto-learning)
Suggested new playbook: customcorp.com
Would you like to learn this site? (y/n) y
✓ New playbook saved
```

### 3️⃣ **Automatic Polling**
```bash
# Cron/Task Scheduler runs applypilot run at configured times
# 2024-12-20 08:00:00 → Poll cycle 1 (new jobs from Indeed, LinkedIn)
# 2024-12-20 16:00:00 → Poll cycle 2 (update existing boards)
# All results logged to ~/.applypilot/logs/poll-cycle-*.log

# User can check results anytime:
$ applypilot logs --since 24h
# Shows all polls and applications from last 24 hours

$ applypilot registry --list
# Shows all 50+ registered sites + any learned sites
# Success rate per site

$ applypilot schedule --status
# Shows current schedule and next poll time
```

---

## 50+ Pre-Populated Job Boards (Seed Data)

### Major Job Boards
Indeed, LinkedIn, Glassdoor, Ziprecruiter, CareerBuilder, Dice, Vault, Built In, Stack Overflow Jobs, GitHub Jobs

### Tech-Specific
HackerRank, LeetCode, Blind, Levels.fyi, AngelList, Crunchboard, Product Hunt, CodeSignal

### Remote-Specific
RemoteOK, We Work Remotely, FlexJobs, JustRemote, Working Nomads, Nomad List

### Freelance & Contract
Upwork, Freelancer, Toptal, Gun.io, Gigtster, X-Team

### Startup & Consulting
McKinsey, BCG, Catalant, Vettery, Pangian, Hired

### Tech Company Careers
Google, Microsoft, Amazon, Apple, Meta, Netflix, Stripe, Airbnb, Tesla, SpaceX

### Fallbacks
Greenhouse (ATS template), Workday (ATS template), Custom ATS (Generic), Career Page (Generic)

---

## Migration Path (v1 → v2)

### For Existing Users

```bash
# 1. Backup
cp -r ~/.applypilot ~/.applypilot.backup.v1

# 2. Stop daemon (if running)
applypilot daemon stop

# 3. Upgrade
pip install --upgrade applypilot

# 4. Migrate database (automatic)
applypilot db --migrate

# 5. Seed website registry
applypilot db --seed-registry

# 6. Set credentials
applypilot credentials --set-shared

# 7. Configure schedule
applypilot schedule --enable --interval 8h --time 08:00

# 8. Test (dry-run)
applypilot run --dry-run

# 9. Go live
applypilot run
```

### What's Preserved
✓ All existing job data
✓ User profile
✓ Search configuration
✓ Scoring logic

### What Changes
✗ `applypilot autopilot --daemon` → `applypilot schedule`
✗ Daemon process → OS scheduler (cron/Task Scheduler)
✗ Generic form-filling → Site-specific playbooks
✓ NEW: Auto-learning, encrypted credentials, structured logging

---

## Daemon Mode vs Scheduled Polling - Quick Comparison

| Feature | v1 Daemon | v2 Scheduled | Winner |
|---------|-----------|--------------|--------|
| Complexity | High (fork, PID, signals) | Low (OS handles it) | v2 |
| Cross-platform | Tricky | Native (cron/Task Scheduler) | v2 |
| Docker-friendly | No | Yes | v2 |
| Testing | Hard | Easy | v2 |
| Memory overhead | Always running (≥50 MB) | Only during poll | v2 |
| Instant feedback | Yes | No (wait for next poll) | v1 |
| Manual trigger | Limited | Yes (`applypilot run`) | v2 |
| Application success | Generic (~50%) | Site-specific (~75%) | v2 |
| Error recovery | Manual restart | Automatic (cron) | v2 |

**Verdict**: v2 wins on 8 of 10 criteria. More reliable, simpler, better integrated.

---

## Security Highlights (v2)

✓ **Encrypted Credentials**: AES-256-GCM encryption for all credentials
✓ **System Keyring**: Master password never on disk
✓ **Site-Specific Login**: Can use different password for each job board
✓ **Zero Logging of Secrets**: No credentials in logs, even on error
✓ **PBKDF2 Key Derivation**: Strong key derivation (100k iterations)
✓ **Credential Rotation**: `applypilot credentials --rotate` to re-encrypt
✓ **Audit Trail**: Track when credentials added/removed

---

## Performance Expectations (v2)

- **Poll cycle**: <5 minutes for 100 jobs with 10 applications
- **Database size**: ~5-10 MB (SQLite) for 10k jobs
- **Memory usage**: <200 MB during poll (vs. ≥50 MB always-on daemon)
- **Log retention**: 7 days by default, max 500 MB total
- **Application rate**: 2 applications per minute (configurable, prevents blocking)
- **Registry entries**: 50+ pre-populated, scales to 500+ with auto-learning

---

## Key Success Metrics (Post-Implementation)

- ✓ 75%+ application success on registered sites
- ✓ Setup time: <5 minutes for new users
- ✓ 90%+ of application failures properly classified
- ✓ 10+ new sites auto-learned per month
- ✓ Zero unplanned process crashes (auto-recovery via cron)
- ✓ <2 manual interventions per week per user

---

## Files & Documentation

**Main Specification**: `/Users/manishslal/Desktop/Coding-Projects/.github/specs/applypilot-improvements-v2-spec.md`
- 728 lines
- Comprehensive technical architecture
- All phases, tables, edge cases, flows, implementation tasks
- Example registry entries
- Claude system prompt template
- Migration guide
- Comparison tables

**This Summary**: `/Users/manishslal/Desktop/Coding-Projects/.github/specs/APPLYPILOT_V2_SUMMARY.md`
- Quick reference
- Key changes explained
- Example workflows
- Migration steps
- Security/performance highlights

---

## Next Steps for Implementation

1. **Phase 1-2** (Weeks 1-2):
   - Refactor init with dependency detection
   - Add database schema (website_registry, site_credentials, etc.)

2. **Phase 3** (Weeks 2-3):
   - Implement `ScheduleManager` class (cron/Task Scheduler)
   - Add `applypilot schedule` and `applypilot run` commands
   - Seed registry with 50+ job boards

3. **Phase 4** (Weeks 3-4):
   - Implement `CredentialVault` (encryption + keyring)
   - Enhance Claude integration with site context
   - Build auto-learning workflow

4. **Phase 5** (Weeks 4-5):
   - Implement error classification and retry logic
   - Add structured JSON logging with rotation
   - Build health check endpoint
   - Registry version tracking and optimization

---

**Total Implementation Estimate**: ~5 weeks (~300 story points)

