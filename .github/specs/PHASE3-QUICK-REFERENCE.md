# Phase 3 Quick Reference

## Files Created

```
src/applypilot/
├── db_migrations.py                 # Database migration system
├── registry/
│   ├── __init__.py
│   ├── website_registry.py          # Job board registry (CRUD)
│   └── credentials.py               # Credential management
├── scheduler/
│   ├── __init__.py
│   └── schedule_manager.py          # Schedule configuration
└── autopilot/
    ├── __init__.py
    └── orchestrator.py              # Poll cycle orchestration
```

**Also Updated**:
- `src/applypilot/cli.py` - Added 4 new commands
- `src/applypilot/database.py` - Auto-run migrations on init

---

## Core Classes & Methods

### WebsiteRegistry
```python
from applypilot.registry import WebsiteRegistry

registry = WebsiteRegistry()
entry = registry.get_registry_entry("indeed.com")
entries = registry.list_entries(active_only=True)
id = registry.create_entry(domain, company_name, job_board_type, ...)
success = registry.update_entry(domain, **updates)
success = registry.delete_entry(domain)
```

### CredentialManager
```python
from applypilot.registry import CredentialManager

creds = CredentialManager()

# Shared (for all sites)
creds.set_shared_credentials(username, password)
shared = creds.get_shared_credentials()

# Site-specific
creds.set_site_credentials(domain, username, password)
site_creds = creds.get_site_credentials(domain)
all_creds = creds.list_site_credentials()
creds.delete_site_credentials(domain)
```

### ScheduleManager
```python
from applypilot.scheduler import ScheduleManager, detect_platform

manager = ScheduleManager()
config = manager.create_schedule(interval_hours=8, start_time="08:00")
manager.enable_schedule()
manager.disable_schedule()
status = manager.get_schedule_status()

platform = detect_platform()  # 'linux', 'darwin', 'windows'
```

### PollOrchestrator
```python
from applypilot.autopilot import PollOrchestrator

orchestrator = PollOrchestrator()
result = orchestrator.run_poll_cycle(dry_run=False)
# result['poll_cycle_id'], result['status'], result['stages'], result['errors']
```

### Database Migrations
```python
from applypilot.db_migrations import run_all_migrations, get_current_schema_version
from applypilot.database import get_connection

conn = get_connection()
run_all_migrations(conn)
version = get_current_schema_version(conn)
```

---

## CLI Commands

### Poll (Manual Trigger)
```bash
applypilot poll
```

### Schedule (Configure Polling)
```bash
# Create schedule
applypilot schedule --interval 8h --time 08:00

# Enable/disable
applypilot schedule --enable
applypilot schedule --disable

# Check status
applypilot schedule --status
```

### Credentials (Manage Auth)
```bash
# Set shared credentials
applypilot credentials set --shared --username user@email.com --password pass123

# Get shared credentials
applypilot credentials get --shared

# Set site-specific
applypilot credentials set --domain indeed.com --username X --password Y

# Get site-specific
applypilot credentials get --domain indeed.com

# List all
applypilot credentials list

# Delete
applypilot credentials delete --domain indeed.com
```

### Registry (Manage Job Boards)
```bash
# List all
applypilot registry list

# Add new board
applypilot registry add --domain ats.mycompany.com --company-name "My Company" --board-type custom_ats

# Update board
applypilot registry update --domain indeed.com --company-name "Indeed Inc"
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `schema_migrations` | Track applied migrations |
| `website_registry` | Job board playbooks |
| `site_credentials` | Site-specific auth |
| `schedule_config` | Polling schedule |
| `poll_history` | Poll cycle audit trail |
| `daemon_state` | Process health metrics |

---

## Pre-populated Registry Entries

| Domain | Company | Type |
|--------|---------|------|
| indeed.com | Indeed Inc | indeed |
| linkedin.com | LinkedIn | linkedin |
| boards.greenhouse.io | Greenhouse | greenhouse |
| workday.com | Workday | workday |

---

## Testing

```bash
# Verify imports
PYTHONPATH=./src python3 -c "
from applypilot.db_migrations import run_all_migrations
from applypilot.registry import WebsiteRegistry, CredentialManager
from applypilot.scheduler import ScheduleManager
from applypilot.autopilot import PollOrchestrator
print('✓ All imports OK')
"

# Check database
sqlite3 ~/.applypilot/database.db "SELECT * FROM website_registry LIMIT 1;"

# List registry via CLI
applypilot registry list
```

---

## Key Features

✅ Automatic database migrations on startup  
✅ Pre-populated job board registry (4 default sites)  
✅ Dual credential storage (shared + site-specific)  
✅ Cross-platform schedule support (Linux/macOS/Windows)  
✅ Complete poll cycle orchestration  
✅ Audit trail in poll_history table  
✅ Rate limiting (2 apps/min)  
✅ Deduplication (don't re-apply)  
✅ CLI commands with validation  
✅ 100% backward compatible  

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| ImportError: No module named 'applypilot' | Set PYTHONPATH=./src |
| CLI commands not showing | Update applypilot/cli.py |
| Registry empty after init | Migrations should auto-populate |
| Schedule not enabling | Create schedule first: `applypilot schedule --interval 8h --time 08:00` |
| Credentials not saved | Check ~/.applypilot/.env and database |

---

## Next Phase (Phase 4)

- Claude Code integration for form-filling
- Dynamic system prompt generation
- Application success/failure capture
- Auto-learning playbook updates
