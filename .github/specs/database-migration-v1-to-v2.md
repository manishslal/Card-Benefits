# ApplyPilot Database Migration Guide: v1 → v2
## From Phases 1-2 to Phases 3-5 Schema

---

## Overview

This guide walks through upgrading the ApplyPilot database schema from **v1** (Phases 1-2: simplified setup) to **v2** (Phases 3-5: scheduled polling + website registry).

**Key Changes:**
- Add support for polling tracking (`poll_cycle_id`, `last_polled_at`)
- Add application attempt tracking (`apply_attempts`, `apply_error_type`)
- Add website registry system (new tables: `website_registry`, `site_credentials`)
- Add schedule configuration tracking (new table: `schedule_config`)
- Add daemon/poll monitoring (new table: `daemon_state`)

**Migration Type**: **Additive** (no breaking changes, fully backward compatible)  
**Estimated Time**: 5-10 minutes  
**Rollback**: Safe (can drop v2 tables, v1 data unchanged)

---

## Step-by-Step Migration

### **Phase 1: Backup Current Database**

```bash
# Create backup before any migrations
cp ~/.applypilot/database.db ~/.applypilot/database.db.v1.backup
echo "✓ Backup created at ~/.applypilot/database.db.v1.backup"
```

---

### **Phase 2: Add New Columns to `jobs` Table**

These columns support polling, retries, and application tracking.

```sql
-- Connect to database
sqlite3 ~/.applypilot/database.db

-- Add columns for polling & retry tracking
ALTER TABLE jobs ADD COLUMN poll_cycle_id TEXT;
ALTER TABLE jobs ADD COLUMN last_polled_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN skipped_reason TEXT;
ALTER TABLE jobs ADD COLUMN apply_attempts INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN apply_error_type TEXT;  -- e.g., "CAPTCHA", "RATE_LIMIT", "NETWORK"
ALTER TABLE jobs ADD COLUMN apply_error_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_poll_cycle ON jobs(poll_cycle_id);
CREATE INDEX IF NOT EXISTS idx_jobs_last_polled ON jobs(last_polled_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_apply_attempts ON jobs(apply_attempts);
CREATE INDEX IF NOT EXISTS idx_jobs_apply_error_type ON jobs(apply_error_type);

-- Verify columns added
PRAGMA table_info(jobs);
-- Should show all new columns

.exit
```

**Verification:**
```bash
sqlite3 ~/.applypilot/database.db "PRAGMA table_info(jobs);" | grep -E "(poll_cycle_id|last_polled_at|apply_attempts|apply_error_type)"
# Should show 6 new columns
```

---

### **Phase 3: Create Website Registry Table**

This table stores site-specific application instructions for Claude.

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

CREATE TABLE IF NOT EXISTS website_registry (
  id TEXT PRIMARY KEY,  -- UUID
  company_name TEXT NOT NULL,  -- e.g., "Indeed Inc"
  domain TEXT UNIQUE NOT NULL,  -- e.g., "indeed.com"
  job_board_type TEXT NOT NULL,  -- enum: indeed, linkedin, greenhouse, workday, custom_ats, career_page
  
  -- Login & form navigation
  login_flow_instructions TEXT,  -- Step-by-step guide (e.g., "1. Click login, 2. Enter email, 3. Click Continue")
  form_fields_mapping TEXT NOT NULL,  -- JSON: field mappings {field_name: {selector, type, required}}
  resume_upload_selector TEXT,  -- CSS selector for resume file input
  cover_letter_upload_selector TEXT,  -- Optional
  form_submit_selector TEXT NOT NULL,  -- CSS selector for submit button
  
  -- Success/failure detection
  success_indicators TEXT,  -- JSON: ["text:Thank you", "url:*/thankyou*"]
  error_indicators TEXT,  -- JSON: ["text:Error", "text:Please try again"]
  
  -- Credentials
  credential_type TEXT DEFAULT 'shared',  -- shared, site_specific, both
  
  -- Metadata & versioning
  notes TEXT,  -- Additional guidance for Claude
  version INTEGER DEFAULT 1,  -- Playbook version (increments on auto-learn)
  is_active BOOLEAN DEFAULT 1,  -- Soft-delete support
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_job_board_type CHECK(job_board_type IN 
    ('indeed', 'linkedin', 'greenhouse', 'workday', 'custom_ats', 'career_page')
  ),
  CONSTRAINT valid_credential_type CHECK(credential_type IN 
    ('shared', 'site_specific', 'both')
  )
);

CREATE INDEX IF NOT EXISTS idx_website_registry_domain ON website_registry(domain);
CREATE INDEX IF NOT EXISTS idx_website_registry_job_board_type ON website_registry(job_board_type);
CREATE INDEX IF NOT EXISTS idx_website_registry_is_active ON website_registry(is_active);

EOF

echo "✓ website_registry table created"
```

---

### **Phase 4: Create Site Credentials Table**

For sites requiring unique login credentials (LinkedIn ≠ Indeed).

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

CREATE TABLE IF NOT EXISTS site_credentials (
  id TEXT PRIMARY KEY,  -- UUID
  website_registry_id TEXT NOT NULL,
  
  -- Encrypted credentials
  username TEXT NOT NULL,  -- Encrypted at application layer
  password TEXT NOT NULL,  -- Encrypted at application layer
  
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (website_registry_id) REFERENCES website_registry(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_site_credentials_website_id ON site_credentials(website_registry_id);
CREATE INDEX IF NOT EXISTS idx_site_credentials_is_active ON site_credentials(is_active);

EOF

echo "✓ site_credentials table created"
```

---

### **Phase 5: Create Schedule Configuration Table**

Tracks user's polling schedule settings.

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

CREATE TABLE IF NOT EXISTS schedule_config (
  id TEXT PRIMARY KEY,  -- Always "default" (single row for now)
  
  -- Schedule settings
  poll_interval_hours INTEGER DEFAULT 8,
  poll_start_time TEXT DEFAULT '08:00',  -- HH:MM format
  is_enabled BOOLEAN DEFAULT 0,
  
  -- OS scheduler info
  scheduler_type TEXT,  -- 'cron' (Linux/macOS), 'task_scheduler' (Windows), 'manual'
  scheduler_job_id TEXT,  -- ID of cron job or Windows Task Scheduler task
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(id)
);

-- Insert default row
INSERT OR IGNORE INTO schedule_config (id) VALUES ('default');

EOF

echo "✓ schedule_config table created"
```

---

### **Phase 6: Create Poll History Table**

Audit trail of all polling cycles.

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

CREATE TABLE IF NOT EXISTS poll_history (
  id TEXT PRIMARY KEY,  -- UUID or "poll-2024-12-20-08-00"
  
  -- Timing
  poll_started_at TIMESTAMP NOT NULL,
  poll_completed_at TIMESTAMP,
  poll_duration_s INTEGER,
  
  -- Discovery results
  new_jobs_count INTEGER,
  deduped_jobs_count INTEGER,
  discovery_errors TEXT,  -- JSON
  
  -- Pipeline results
  enriched_count INTEGER DEFAULT 0,
  scored_count INTEGER DEFAULT 0,
  above_threshold_count INTEGER DEFAULT 0,
  tailored_count INTEGER DEFAULT 0,
  cover_letters_count INTEGER DEFAULT 0,
  
  -- Application results
  apply_attempted_count INTEGER DEFAULT 0,
  apply_success_count INTEGER DEFAULT 0,
  apply_failure_count INTEGER DEFAULT 0,
  
  -- Status & errors
  status TEXT DEFAULT 'running',  -- running, completed, interrupted, error
  errors TEXT,  -- JSON list of all errors
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poll_history_started_at ON poll_history(poll_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_history_status ON poll_history(status);

EOF

echo "✓ poll_history table created"
```

---

### **Phase 7: Create Daemon State Table**

Health & metadata for long-running processes.

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

CREATE TABLE IF NOT EXISTS daemon_state (
  id TEXT PRIMARY KEY,  -- Always "default"
  
  -- Process tracking
  daemon_pid INTEGER,
  daemon_started_at TIMESTAMP,
  
  -- Health metrics
  last_heartbeat_at TIMESTAMP,
  memory_usage_mb INTEGER,
  cpu_usage_percent REAL,
  
  -- Stats
  total_polls INTEGER DEFAULT 0,
  successful_polls INTEGER DEFAULT 0,
  failed_polls INTEGER DEFAULT 0,
  last_poll_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(id)
);

EOF

echo "✓ daemon_state table created"
```

---

### **Phase 8: Create Migration Tracking Table**

For future migrations and rollback support.

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,  -- e.g., "add_polling_support"
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT  -- For integrity verification
);

-- Record this migration
INSERT INTO schema_migrations (version, name, checksum) 
VALUES (2, 'v1_to_v2_polling_website_registry', 'migration_v1_to_v2_2024');

EOF

echo "✓ schema_migrations table created and migration recorded"
```

---

### **Phase 9: Verify Migration**

```bash
# Check all tables exist
sqlite3 ~/.applypilot/database.db << 'EOF'
.tables
-- Should show: jobs, poll_history, website_registry, site_credentials, schedule_config, daemon_state, schema_migrations

-- Verify column additions to jobs
PRAGMA table_info(jobs);

-- Check indexes
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('jobs', 'poll_history', 'website_registry');

EOF

echo "✓ Migration complete and verified"
```

---

## Data Migration (Optional: Pre-populate Website Registry)

Once v2 tables exist, you can pre-populate the website registry with 50+ job board playbooks.

### **Pre-populated Website Registry Seed Data**

```sql
sqlite3 ~/.applypilot/database.db << 'EOF'

-- Indeed.com
INSERT OR IGNORE INTO website_registry 
(id, company_name, domain, job_board_type, login_flow_instructions, 
 form_fields_mapping, resume_upload_selector, form_submit_selector, 
 success_indicators, error_indicators, credential_type, notes, version, is_active)
VALUES (
  'indeed-com-001',
  'Indeed Inc',
  'indeed.com',
  'indeed',
  '1. Click "Sign in" link
2. Enter email → Click Next
3. Enter password → Click Sign in
4. Handle 2FA if prompted',
  '{
    "full_name": {"selector": "#applicant_name", "type": "text", "required": true},
    "email": {"selector": "#email", "type": "email", "required": true},
    "phone": {"selector": "#phone", "type": "tel", "required": true},
    "location": {"selector": "#location", "type": "text", "required": false},
    "resume": {"selector": "input[type=file][name=resume]", "type": "file", "required": true}
  }',
  'input[type=file][name=resume]',
  '#submit-button',
  '["text:Thank you for applying", "text:Application received", "url:*/applied"]',
  '["text:Error", "text:Please try again", "text:failed"]',
  'shared',
  'Indeed requires login. Uses standard form layout.',
  1,
  1
);

-- LinkedIn.com
INSERT OR IGNORE INTO website_registry 
(id, company_name, domain, job_board_type, login_flow_instructions, 
 form_fields_mapping, resume_upload_selector, form_submit_selector, 
 success_indicators, error_indicators, credential_type, notes, version, is_active)
VALUES (
  'linkedin-com-001',
  'LinkedIn',
  'linkedin.com',
  'linkedin',
  '1. Click "Sign in"
2. Enter email
3. Enter password
4. Handle potential security verification',
  '{
    "full_name": {"selector": "#name", "type": "text", "required": true},
    "email": {"selector": "#email-address", "type": "email", "required": true},
    "phone": {"selector": "#phone-number", "type": "tel", "required": false},
    "resume": {"selector": "input[type=file]", "type": "file", "required": false}
  }',
  'input[type=file]',
  'button[aria-label="Apply now"]',
  '["text:Application sent", "text:You applied", "class:success-message"]',
  '["text:Something went wrong", "text:Please try again"]',
  'site_specific',
  'LinkedIn uses React forms. May require site-specific login. Resume optional (profile used).',
  1,
  1
);

-- Greenhouse.io (ATS)
INSERT OR IGNORE INTO website_registry 
(id, company_name, domain, job_board_type, login_flow_instructions, 
 form_fields_mapping, resume_upload_selector, form_submit_selector, 
 success_indicators, error_indicators, credential_type, notes, version, is_active)
VALUES (
  'greenhouse-io-001',
  'Greenhouse',
  'boards.greenhouse.io',
  'greenhouse',
  '1. Fill form directly (no login required for most applications)
2. If login required: Email → Password → Continue',
  '{
    "full_name": {"selector": "input[name=''first_name'']", "type": "text", "required": true},
    "email": {"selector": "input[name=''email'']", "type": "email", "required": true},
    "phone": {"selector": "input[name=''phone'']", "type": "tel", "required": true},
    "resume": {"selector": "input[type=file][name=''resume'']", "type": "file", "required": true}
  }',
  'input[type=file][name="resume"]',
  'button[type=submit]',
  '["text:Thank you", "text:Application received", "url:*/confirm"]',
  '["text:Error", "text:Required field"]',
  'shared',
  'Greenhouse is a standard ATS used by 1000+ companies. Most apps don''t require login.',
  1,
  1
);

-- Workday (Common Enterprise ATS)
INSERT OR IGNORE INTO website_registry 
(id, company_name, domain, job_board_type, login_flow_instructions, 
 form_fields_mapping, resume_upload_selector, form_submit_selector, 
 success_indicators, error_indicators, credential_type, notes, version, is_active)
VALUES (
  'workday-generic-001',
  'Workday (Generic)',
  '*.workday.com',
  'workday',
  '1. Enter email
2. Click Next
3. Enter password
4. Complete MFA if required
5. Navigate to application form',
  '{
    "full_name": {"selector": "input[data-name=''applicantName'']", "type": "text", "required": true},
    "email": {"selector": "input[type=email]", "type": "email", "required": true},
    "phone": {"selector": "input[data-name=''phone'']", "type": "tel", "required": true},
    "resume": {"selector": "input[type=file]", "type": "file", "required": true}
  }',
  'input[type=file]',
  'button[aria-label*="Submit"]',
  '["text:Application submitted", "text:Thank you", "class:confirmation"]',
  '["text:Error", "text:Invalid", "text:Required"]',
  'site_specific',
  'Workday is complex enterprise ATS. Each company uses custom setup. May require per-company credentials.',
  1,
  1
);

COMMIT;
EOF

echo "✓ Pre-populated 4 job board playbooks (Indeed, LinkedIn, Greenhouse, Workday)"
```

---

## Rollback Procedure

If you need to rollback to v1:

```bash
# Restore from backup
cp ~/.applypilot/database.db ~/.applypilot/database.db.v2
cp ~/.applypilot/database.db.v1.backup ~/.applypilot/database.db

echo "✓ Rolled back to v1 database"
echo "  Original v2 database saved as database.db.v2"
echo "  v1 database restored from database.db.v1.backup"
```

---

## Verification Checklist

After migration, verify everything:

```bash
# Check all tables exist
sqlite3 ~/.applypilot/database.db ".tables"
# Expected output: daemon_state  jobs  poll_history  schedule_config  schema_migrations  site_credentials  website_registry

# Check jobs table has new columns
sqlite3 ~/.applypilot/database.db "PRAGMA table_info(jobs);" | tail -n 10
# Should show: poll_cycle_id, last_polled_at, skipped_reason, apply_attempts, apply_error_type, apply_error_at

# Check schema_migrations recorded
sqlite3 ~/.applypilot/database.db "SELECT * FROM schema_migrations;"
# Should show version 2 record

# Check website_registry populated (if you ran seed data)
sqlite3 ~/.applypilot/database.db "SELECT COUNT(*) FROM website_registry;"
# Should show 4+ records

# Test database integrity
sqlite3 ~/.applypilot/database.db "PRAGMA integrity_check;"
# Should return: ok

echo "✓✓✓ Migration verification complete!"
```

---

## Performance Optimization (Post-Migration)

```sql
-- Run vacuum to optimize database file
sqlite3 ~/.applypilot/database.db "VACUUM;"

-- Analyze tables for query optimizer
sqlite3 ~/.applypilot/database.db "ANALYZE;"

-- Check database size
ls -lh ~/.applypilot/database.db
```

---

## Summary

| Step | Table/Action | Status |
|------|-------------|--------|
| 1 | Backup v1 database | ✓ |
| 2 | Add polling columns to `jobs` | ✓ |
| 3 | Create `website_registry` | ✓ |
| 4 | Create `site_credentials` | ✓ |
| 5 | Create `schedule_config` | ✓ |
| 6 | Create `poll_history` | ✓ |
| 7 | Create `daemon_state` | ✓ |
| 8 | Record migration | ✓ |
| 9 | Verify migration | ✓ |
| 10 | Pre-populate registry (optional) | ✓ |

**Total tables added**: 6  
**Total columns added to `jobs`**: 6  
**Total indexes created**: 15+  
**Backward compatibility**: 100% (can still run v1 pipelines)

---

## Next Steps

Once migration is complete:
1. Verify all tables with checklist above
2. Back up your v2 database
3. Ready to implement Phase 3 (Scheduler + Polling)
