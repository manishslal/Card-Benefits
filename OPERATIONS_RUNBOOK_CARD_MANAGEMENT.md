# Card Management - Operations Runbook

**For:** Operations & DevOps Teams  
**Purpose:** Daily operations, incident response, and troubleshooting  
**Last Updated:** April 3, 2024  
**Status:** APPROVED FOR PRODUCTION

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Daily Operations](#daily-operations)
3. [Incident Response](#incident-response)
4. [Common Procedures](#common-procedures)
5. [Monitoring Dashboard](#monitoring-dashboard)
6. [Emergency Contacts](#emergency-contacts)

---

## Quick Reference

### Critical Commands

```bash
# Start application
npm start

# Check health
curl https://app.cardbenefits.com/api/health

# View logs (last 100 lines)
tail -100 logs/app.log

# Check database
npx prisma studio

# View active database connections
sqlite3 prod.db "PRAGMA database_list;"

# Monitor in real-time
watch -n 5 'npm run db:verify'
```

### Alert Severity Levels

| Level | Response Time | Escalation |
|-------|--------------|------------|
| **CRITICAL** | 5 minutes | Immediate (SMS + Call) |
| **HIGH** | 15 minutes | Slack + Email |
| **MEDIUM** | 1 hour | Slack |
| **LOW** | 4 hours | Email |

### Runbook Index

| Issue | Runbook | Time |
|-------|---------|------|
| High Error Rate | [#incident-error-spike](#incident-error-spike) | 10 min |
| Database Down | [#incident-database-unavailable](#incident-database-unavailable) | 5 min |
| Memory Leak | [#incident-memory-leak](#incident-memory-leak) | 15 min |
| Slow Queries | [#incident-slow-queries](#incident-slow-queries) | 20 min |
| Corrupted Data | [#incident-data-corruption](#incident-data-corruption) | 30 min |

---

## Daily Operations

### Morning Checklist (8:00 AM)

```bash
#!/bin/bash
echo "📋 Morning Operations Checklist"

# 1. Health check
echo "1. System Health..."
curl -s https://app.cardbenefits.com/api/health | jq .

# 2. Error rate
echo "2. Error Rate (should be < 0.1%)..."
# Query your monitoring system

# 3. Database size
echo "3. Database Size..."
du -h prod.db

# 4. Card statistics
echo "4. Card Statistics..."
sqlite3 prod.db << 'EOF'
SELECT 
  COUNT(*) as total_cards,
  SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status='ARCHIVED' THEN 1 ELSE 0 END) as archived,
  SUM(CASE WHEN status='DELETED' THEN 1 ELSE 0 END) as deleted
FROM UserCard;
EOF

# 5. Recent errors
echo "5. Recent Errors (last hour)..."
grep -i "error\|failed\|exception" logs/app.log | tail -20

# 6. Backup status
echo "6. Backup Status..."
ls -lh prod.db.backup.* | tail -1
```

### Weekly Review (Fridays)

- [ ] **Performance Metrics**
  - Response time trends
  - Error rate trends
  - Resource usage patterns

- [ ] **Data Integrity**
  - Card count accuracy
  - Archive ratio validation
  - Orphaned records check

- [ ] **Security Audit**
  - Failed login attempts
  - Unusual access patterns
  - Database access logs

- [ ] **Capacity Planning**
  - Database growth rate
  - Storage capacity remaining
  - Resource scaling needs

- [ ] **Documentation**
  - Update runbooks if procedures changed
  - Document any incidents and resolutions
  - Review monitoring alerts effectiveness

### Monthly Tasks (1st of month)

- [ ] **Backup Rotation**
  ```bash
  # Verify backups exist for every day of past month
  ls -l prod.db.backup.* | wc -l
  # Should be ~30 files
  
  # Archive old backups (> 90 days)
  find . -name "prod.db.backup.*" -mtime +90 -exec gzip {} \;
  ```

- [ ] **Secret Rotation**
  ```bash
  # Generate new SESSION_SECRET and CRON_SECRET
  openssl rand -hex 32
  # Update in GitHub Secrets and environment
  ```

- [ ] **Dependency Updates**
  ```bash
  npm outdated
  npm update
  npm audit
  ```

- [ ] **Capacity Planning Review**
  - Disk usage trending
  - Database growth rate
  - Projected storage needs

- [ ] **Load Testing**
  ```bash
  # Run load test to verify performance
  npm run test:load -- --users 1000 --duration 300
  ```

---

## Incident Response

### Incident Response Severity Matrix

#### CRITICAL (Requires Immediate Action)

**Symptoms:**
- Application is completely down
- Error rate > 5%
- Database is unavailable
- Data corruption detected

**Response:**
1. **Declare incident** - Notify all on-call staff
2. **Assess impact** - Number of affected users
3. **Stop the bleed** - Stop processing if needed
4. **Restore service** - Follow procedure below
5. **Investigate** - Root cause analysis
6. **Communicate** - Status updates every 5 minutes

---

### Incident: Error Spike

**Symptoms:**
- Error rate > 1%
- 500 errors in logs
- Failed API requests

**Runbook:**

```bash
#!/bin/bash
# Step 1: Verify the issue
echo "Step 1: Verifying error spike..."
ERROR_COUNT=$(grep -c "500\|ERROR\|EXCEPTION" logs/app.log)
echo "Errors in last 1000 lines: $ERROR_COUNT"

# Step 2: Identify affected endpoint
echo "Step 2: Identifying affected endpoints..."
grep "500\|ERROR" logs/app.log | \
  grep -o "POST \|GET \|PUT \|DELETE " | \
  sort | uniq -c | sort -rn | head -5

# Step 3: Check recent deployments
echo "Step 3: Checking recent changes..."
git log --oneline -10

# Step 4: Check system resources
echo "Step 4: Checking system resources..."
ps aux | grep node
free -h
df -h

# Step 5: Check database
echo "Step 5: Checking database..."
sqlite3 prod.db "PRAGMA integrity_check;" 2>&1 | head -5

# Step 6: Restart if necessary
if [ "$1" == "--restart" ]; then
  echo "Step 6: Restarting application..."
  kill $(pgrep -f "npm start")
  sleep 2
  npm start &
fi
```

**Resolution Decision Tree:**

```
Is error rate from single endpoint?
├─ YES
│  └─ Check recent changes to that endpoint
│     ├─ Revert recent change
│     └─ Redeploy
├─ NO → Check all endpoints
   └─ System issue
      ├─ Restart application
      ├─ Check database
      └─ Investigate logs
```

---

### Incident: Database Unavailable

**Symptoms:**
- Cannot connect to database
- Connection timeout errors
- "database is locked" error

**Runbook:**

```bash
#!/bin/bash
# Step 1: Check if database file exists
if [ ! -f prod.db ]; then
  echo "❌ Database file missing!"
  exit 1
fi

# Step 2: Verify database integrity
echo "Checking database integrity..."
sqlite3 prod.db "PRAGMA integrity_check;"
# If issues found, restore from backup

# Step 3: Check connections
echo "Active database connections:"
sqlite3 prod.db "PRAGMA busy_timeout;" || echo "Cannot access database"

# Step 4: Release locks
echo "Releasing database locks..."
# SQLite locks are released when connection closes
# Kill any hung processes:
lsof prod.db | grep -v COMMAND | awk '{print $2}' | xargs kill -9

# Step 5: Test connection
echo "Testing connection..."
if sqlite3 prod.db "SELECT COUNT(*) FROM UserCard;"; then
  echo "✅ Database accessible"
else
  echo "❌ Database still unavailable"
  echo "Restoring from backup..."
  cp prod.db.backup.latest prod.db
fi

# Step 6: Restart application
npm start &
```

**Critical Checks:**

```sql
-- Check database size
SELECT page_count * page_size as size_bytes 
FROM pragma_page_count(), pragma_page_size();

-- Check table sizes
SELECT name, 
       (SELECT COUNT(*) FROM UserCard) as rows
FROM sqlite_master WHERE type='table';

-- Find locked tables
PRAGMA busy_timeout = 5000;  -- Wait 5 seconds for locks

-- Check for corruption
PRAGMA integrity_check;

-- Rebuild if corrupted
VACUUM;  -- Defragment
ANALYZE;  -- Update statistics
```

---

### Incident: Memory Leak

**Symptoms:**
- Memory usage growing over time
- Application becomes slow
- Eventually crashes with "out of memory"

**Runbook:**

```bash
#!/bin/bash
# Step 1: Monitor memory in real-time
echo "Monitoring memory usage..."
watch -n 1 'ps aux | grep node | grep -v grep | awk "{print \$6/1024 \" MB\"}"'

# Step 2: Identify which process
PS_OUTPUT=$(ps aux | grep node | grep -v grep)
PID=$(echo "$PS_OUTPUT" | awk '{print $2}')
echo "Application PID: $PID"
echo "Memory: $(echo "$PS_OUTPUT" | awk '{print $6}') KB"

# Step 3: Check for connection leaks
echo "Database connections:"
sqlite3 prod.db "SELECT COUNT(*) FROM sqlite_master 
                 WHERE type='table';"

# Step 4: Check for event listeners
echo "Active event listeners:"
node -e "
  const proc = require('process');
  console.log('Event listeners:', proc._getActiveRequests().length);
"

# Step 5: Graceful restart (if memory > threshold)
MEMORY_MB=$(($(ps aux | grep node | grep -v grep | awk '{print $6}') / 1024))
if [ $MEMORY_MB -gt 1000 ]; then
  echo "Memory exceeds 1GB, restarting..."
  # Graceful shutdown
  kill -TERM $PID
  sleep 10
  npm start &
fi
```

**Prevention:**

```typescript
// Ensure proper cleanup in handlers
export async function getPlayerCards(playerId: string) {
  let connection: Prisma.UserDelegate | null = null;
  try {
    // Get cards...
  } finally {
    // Ensure connection is closed
    if (connection) {
      await connection.$disconnect();
    }
  }
}

// Limit query result sets
const cards = await prisma.userCard.findMany({
  take: 25,  // Always limit
  skip: offset,
});

// Clear caches periodically
setInterval(() => {
  // Clear query cache
  queryCache.clear();
}, 60 * 60 * 1000);  // Every hour
```

---

### Incident: Slow Queries

**Symptoms:**
- Response times > 1 second
- "query timeout" errors
- Database CPU usage high

**Runbook:**

```bash
#!/bin/bash
# Step 1: Identify slow queries
echo "Querying slow query log..."
sqlite3 prod.db "
SELECT sql 
FROM sqlite_master 
WHERE sql LIKE '%SELECT%' 
ORDER BY datetime DESC 
LIMIT 10;"

# Step 2: Get query execution plan
echo "Analyzing slow query..."
QUERY='SELECT * FROM UserCard WHERE customName LIKE ?'
sqlite3 prod.db "EXPLAIN QUERY PLAN $QUERY"

# Step 3: Check indexes
echo "Available indexes:"
sqlite3 prod.db "
SELECT name, sql FROM sqlite_master 
WHERE type='index' AND tbl_name='UserCard';"

# Step 4: Add missing index if needed
echo "Creating index if needed..."
sqlite3 prod.db "
CREATE INDEX IF NOT EXISTS idx_usercard_custom_name 
ON UserCard(customName);"

# Step 5: Analyze table statistics
echo "Updating statistics..."
sqlite3 prod.db "ANALYZE UserCard;"

# Step 6: Verify improvement
echo "Testing query performance..."
time sqlite3 prod.db "
SELECT * FROM UserCard 
WHERE playerId = '123' AND status = 'ACTIVE' 
LIMIT 25;"
```

**Index Status Check:**

```bash
#!/bin/bash
# Verify all recommended indexes exist
REQUIRED_INDEXES=(
  "idx_usercard_playerId_status"
  "idx_usercard_renewalDate"
  "idx_usercard_archivedAt"
  "idx_userbenefit_status"
)

for idx in "${REQUIRED_INDEXES[@]}"; do
  if sqlite3 prod.db "SELECT COUNT(*) FROM sqlite_master 
                      WHERE type='index' AND name='$idx';"; then
    echo "✅ Index $idx exists"
  else
    echo "❌ Index $idx missing - creating..."
    # Create index (see schema)
  fi
done
```

---

### Incident: Data Corruption

**Symptoms:**
- Cards disappearing
- Invalid status values
- Duplicate cards
- Orphaned records

**Runbook:**

```bash
#!/bin/bash
# Step 1: Verify integrity
echo "Running integrity check..."
INTEGRITY=$(sqlite3 prod.db "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
  echo "❌ Database corruption detected:"
  echo "$INTEGRITY"
fi

# Step 2: Check for duplicates
echo "Checking for duplicate cards..."
sqlite3 prod.db "
SELECT playerId, masterCardId, COUNT(*) as cnt
FROM UserCard 
GROUP BY playerId, masterCardId 
HAVING COUNT(*) > 1;"

# Step 3: Check for invalid status
echo "Checking for invalid status values..."
sqlite3 prod.db "
SELECT DISTINCT status FROM UserCard 
WHERE status NOT IN ('ACTIVE', 'PENDING', 'PAUSED', 'ARCHIVED', 'DELETED');"

# Step 4: Restore from backup if needed
if [ ! -z "$CORRUPTION_FOUND" ]; then
  echo "Restoring from backup..."
  BACKUP_FILE=$(ls -t prod.db.backup.* | head -1)
  echo "Using backup: $BACKUP_FILE"
  cp "$BACKUP_FILE" prod.db
  echo "✅ Restored from backup"
fi

# Step 5: Cleanup duplicates (if minor corruption)
echo "Removing duplicates (keeping oldest)..."
sqlite3 prod.db "
DELETE FROM UserCard 
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM UserCard 
  GROUP BY playerId, masterCardId
);"

# Step 6: Fix invalid status
echo "Fixing invalid status values..."
sqlite3 prod.db "
UPDATE UserCard SET status = 'ACTIVE' 
WHERE status NOT IN ('ACTIVE', 'PENDING', 'PAUSED', 'ARCHIVED', 'DELETED');"
```

---

## Common Procedures

### Procedure: Add Database Index

```bash
#!/bin/bash
echo "Adding database index: $1"

INDEX_NAME=$1
TABLE_NAME=$2
COLUMNS=$3

sqlite3 prod.db "
CREATE INDEX IF NOT EXISTS $INDEX_NAME 
ON $TABLE_NAME($COLUMNS);"

echo "✅ Index created: $INDEX_NAME"

# Verify
sqlite3 prod.db "
SELECT name FROM sqlite_master 
WHERE type='index' AND name='$INDEX_NAME';"
```

### Procedure: Backup Database

```bash
#!/bin/bash
echo "💾 Creating database backup..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="prod.db.backup.$TIMESTAMP"

# Create backup
cp prod.db "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
echo "✅ Compressed: $BACKUP_FILE.gz"

# Verify backup
if [ -f "$BACKUP_FILE.gz" ]; then
  SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
  echo "✅ Backup size: $SIZE"
else
  echo "❌ Backup failed!"
  exit 1
fi

# Keep only last 30 days
find . -name "prod.db.backup.*" -mtime +30 -exec rm {} \;
echo "✅ Old backups cleaned up"
```

### Procedure: View Real-Time Logs

```bash
#!/bin/bash
echo "📋 Real-time Application Logs"

# Create named pipe for log tailing
tail -f logs/app.log | while IFS= read -r line; do
  # Color code by severity
  if echo "$line" | grep -q "ERROR\|CRITICAL"; then
    echo -e "\033[91m$line\033[0m"  # Red
  elif echo "$line" | grep -q "WARN"; then
    echo -e "\033[93m$line\033[0m"  # Yellow
  else
    echo "$line"
  fi
done

# Or use jq for JSON logs
tail -f logs/app.log | jq '
  if .level == "ERROR" then "\u001b[91m\(.message)\u001b[0m"
  elif .level == "WARN" then "\u001b[93m\(.message)\u001b[0m"
  else .message end
'
```

### Procedure: Database Cleanup

```bash
#!/bin/bash
echo "🧹 Database Cleanup"

# 1. Remove archived cards older than 90 days
echo "Removing old archived cards..."
sqlite3 prod.db "
DELETE FROM UserCard 
WHERE status = 'ARCHIVED' 
AND archivedAt < datetime('now', '-90 days');"

# 2. Remove orphaned benefits
echo "Removing orphaned benefits..."
sqlite3 prod.db "
DELETE FROM UserBenefit 
WHERE userCardId NOT IN (
  SELECT id FROM UserCard
);"

# 3. Defragment database
echo "Defragmenting database..."
sqlite3 prod.db "VACUUM;"

# 4. Update statistics
echo "Updating statistics..."
sqlite3 prod.db "ANALYZE;"

# 5. Report cleanup results
echo "Cleanup complete"
sqlite3 prod.db "
SELECT 
  COUNT(*) as total_cards,
  SUM(CASE WHEN status='ARCHIVED' THEN 1 ELSE 0 END) as archived
FROM UserCard;"
```

---

## Monitoring Dashboard

### Key Metrics Display

```
┌─────────────────────────────────────────────────────┐
│  CARD MANAGEMENT SYSTEM - REAL-TIME DASHBOARD       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ System Health        ████████████░░░░ 85% ✅       │
│ Error Rate           ░░░░░░░░░░░░░░░░ 0.05% ✅    │
│ Response Time        ████░░░░░░░░░░░░ 145ms ✅    │
│ Database Size        ███████░░░░░░░░░ 450MB ✅    │
│                                                     │
│ Cards:                                              │
│   • Total:      5,234 cards                         │
│   • Active:     4,892 cards                         │
│   • Archived:   312 cards                           │
│   • Deleted:    30 cards                            │
│                                                     │
│ Recent Activity:                                    │
│   • Operations (last hour): 1,234                   │
│   • Errors (last hour): 1                           │
│   • Users active: 127                               │
│                                                     │
│ ⚠️  Alerts: 0 active                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Real-Time Monitoring Script

```bash
#!/bin/bash
# Real-time monitoring dashboard

while true; do
  clear
  echo "═══════════════════════════════════════════════════════"
  echo "  CARD MANAGEMENT - OPERATIONAL DASHBOARD"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  
  # System status
  echo "▶ SYSTEM STATUS"
  curl -s https://app.cardbenefits.com/api/health | jq .
  echo ""
  
  # Database statistics
  echo "▶ DATABASE STATISTICS"
  sqlite3 prod.db << 'EOF'
  SELECT 
    'Total Cards' as metric, COUNT(*) as value FROM UserCard
  UNION ALL
  SELECT 'Active Cards', SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END)
  UNION ALL
  SELECT 'Archived Cards', SUM(CASE WHEN status='ARCHIVED' THEN 1 ELSE 0 END);
  EOF
  echo ""
  
  # Error statistics
  echo "▶ ERROR STATISTICS (Last Hour)"
  grep "$(date -d '1 hour ago' +%H:%M)" logs/app.log | \
    grep -c "ERROR\|EXCEPTION" || echo "0 errors"
  echo ""
  
  # Resource usage
  echo "▶ RESOURCE USAGE"
  ps aux | grep -E "node|npm" | grep -v grep | \
    awk '{print "Memory: " $6/1024 " MB, CPU: " $3 "%"}'
  echo ""
  
  # Last updated
  echo "Last updated: $(date '+%H:%M:%S')"
  echo ""
  echo "Press Ctrl+C to exit. Refreshing in 5 seconds..."
  sleep 5
done
```

---

## Emergency Contacts

### Escalation Chain

```
Level 1: On-Call DevOps Engineer
├─ Slack: #card-management-alerts
├─ Phone: [On-call rotation number]
└─ Pager: PagerDuty card-management-team

Level 2: DevOps Lead
├─ Email: devops-lead@company.com
├─ Phone: [Lead phone number]
└─ Available: 24/7 for critical issues

Level 3: CTO / Engineering Manager
├─ Email: cto@company.com
└─ Phone: [CTO phone number]

Level 4: CEO (For critical data loss scenarios)
```

### Incident Notification Template

```
Subject: [INCIDENT] Card Management - {Issue Type}

Body:
---
SEVERITY: {CRITICAL | HIGH | MEDIUM | LOW}
STATUS: ACTIVE (investigating)
STARTED: 2024-04-03 14:32 UTC

IMPACT:
- Affected Users: {Count or percentage}
- Service: Card Management
- Estimated Duration: {Estimated time}

TIMELINE:
14:32 - Issue detected
14:33 - Incident response initiated
[ongoing]

CURRENT ACTIONS:
1. [Action 1]
2. [Action 2]

NEXT UPDATE: 14:43 UTC

---
Incident Commander: {Name}
Contact: {Email / Phone}
```

---

## Quick Links

- 📊 [Monitoring Dashboard](#monitoring-dashboard)
- 🔗 [Production Environment](#)
- 📚 [Documentation](#)
- 🐛 [Known Issues](#)
- 📞 [Emergency Contacts](#emergency-contacts)

---

**For questions or updates to this runbook, contact: devops@company.com**
