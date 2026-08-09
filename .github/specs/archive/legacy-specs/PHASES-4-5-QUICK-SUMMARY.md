# ApplyPilot Phases 4-5: Quick Summary

## What's Being Built

Phases 4-5 turn ApplyPilot from a working MVP into a **production-grade autonomous job application system**.

### Phase 4: Error Handling, Retries & Logging (18 days)
- ✅ Smart error classification (transient vs permanent vs form errors)
- ✅ Exponential backoff retry logic (3 attempts per job max)
- ✅ Structured JSON logging (machine-parseable, daily rotation)
- ✅ Batch mode for token efficiency (apply to 5 jobs/cycle, not 28)
- ✅ 40-50% reduction in Claude API token usage

### Phase 5: Notifications, Monitoring & Docker (19 days)
- ✅ Slack notifications (job matches, successes, daily summaries, errors)
- ✅ Email daily digests
- ✅ Health monitoring (HTTP /health endpoint on port 8000)
- ✅ `applypilot status` command (rich terminal output)
- ✅ Docker containerization (with graceful shutdown)
- ✅ Complete audit trail (applications table logs every attempt)

---

## Database Schema Optimization (Key Changes)

### **Before (Phase 3)**
```
jobs table: 30+ columns (bloated)
├─ Intermediate state fields (score_calculated, resume_tailored_at, cover_generated_at)
├─ 6+ boolean columns (applied, failed, skipped, pending, etc.)
├─ Duplicate timestamps (created_at, discovered_at, scored_at, tailored_at, etc.)
└─ Full job descriptions in main table (bloats rows)
```

### **After (Phase 4 Optimized)**
```
jobs table: 17 columns (lean, query-fast)
├─ CORE (always populated)
│  ├─ id, url, title, company, location
│  ├─ discovered_at, source, fit_score, threshold_met
│  └─ apply_status (single enum: new/pending/applied/failed/skipped)
├─ Artifacts (paths only, not full content)
│  ├─ tailored_resume_path
│  └─ cover_letter_path
├─ Error tracking (brief only)
│  ├─ apply_attempts
│  ├─ last_error (100 chars max)
│  └─ last_error_type (enum)
└─ Metadata (created_at, updated_at)

job_details table (SPARSE - optional enrichment)
├─ full_description, requirements, benefits
├─ salary_min, salary_max
└─ Only populated if user wants detailed history

applications table (IMMUTABLE LOG - new)
├─ Every application attempt (success/failure)
├─ Includes retry_count, next_retry_at, error_type
├─ Includes Claude token usage (for cost tracking)
└─ Enables analytics: success rate, error patterns

error_backoff table (RATE LIMIT TRACKING - new)
├─ Tracks rate limits per job_board_domain
├─ Stores backoff_until timestamp
├─ Used to avoid hammering sites

notification_log table (AUDIT TRAIL - new)
├─ Every notification sent/failed
├─ Includes delivery_status and retry_count
└─ For compliance/debugging
```

### **Impact**
- ✅ Main query (get jobs ready to apply): **<10ms** (was 500ms+)
- ✅ Fewer updates per poll cycle (17 columns, not 30+)
- ✅ Full audit trail (what was applied, when, why failed)
- ✅ Token cost tracking (per-job, per-cycle analytics)

---

## Phase 4 Implementation Tasks (18 days)

| Task | Duration | Who | Deliverable |
|------|----------|-----|-------------|
| P4.1: Schema Migration | 2d | Backend | New DB schema + migration script |
| P4.2: Error Classification | 3d | Backend | `ErrorClassifier` class, 20+ error types |
| P4.3: Retry Logic | 4d | Backend | `RetryManager` + exponential backoff |
| P4.4: Structured Logging | 2d | Backend | JSON logs, daily rotation, 7-day retention |
| P4.5: Batch Mode | 3d | Backend | Apply to N jobs/cycle, pre-scoring filter |
| P4.6: CLI Log Commands | 1d | CLI | `applypilot logs --filter --since --error` |
| P4.7: Integration Tests | 3d | QA | 95%+ pass rate, all error paths covered |

---

## Phase 5 Implementation Tasks (19 days)

| Task | Duration | Who | Deliverable |
|------|----------|-----|-------------|
| P5.1: Slack Integration | 2d | Backend | `SlackNotifier`, webhook setup, throttling |
| P5.2: Email Integration | 2d | Backend | `EmailNotifier`, daily summaries at HH:MM |
| P5.3: Status Command | 2d | CLI | `applypilot status` with rich terminal output |
| P5.4: Health Endpoint | 2d | Backend | HTTP /health on port 8000, JSON response |
| P5.5: Docker Image | 3d | DevOps | Dockerfile, entrypoint, graceful shutdown |
| P5.6: Docker Compose | 1d | DevOps | docker-compose.yml, volume mounts |
| P5.7: Notification Audit | 1d | Backend | `notification_log` table, retry logic |
| P5.8: Kubernetes YAML | 1d | DevOps | K8s deployment, ConfigMap, Secret, Service |
| P5.9: Documentation | 2d | Tech Writer | CLI help, troubleshooting, deployment guides |
| P5.10: E2E Tests | 3d | QA | Full poll cycle + notifications + Docker |

---

## Error Classification Framework

### **Transient Errors (RETRY UP TO 3 TIMES)**
- Network timeout → Retry with backoff: 1s, 4s, 16s
- HTTP 429 (Rate Limit) → Pause 60s, then retry (3x)
- HTTP 503 (Service Unavailable) → Backoff: 10s, 30s, 90s
- Claude API overloaded → Backoff: 30s, 60s, 120s
- CAPTCHA detected → Mark as pending, retry in 5 min (1x only)
- Connection reset → Retry with exponential backoff

### **Permanent Errors (SKIP - DON'T RETRY)**
- HTTP 404 (Job not found) → Job removed from board
- HTTP 401/403 (Auth failed) → Invalid credentials
- Invalid URL → Job URL malformed
- Site blocked → IP banned or site down 24h+
- Application closed → Site says "Applications closed"
- Duplicate application → Already applied to this job
- Job expired → Posted >90 days ago

### **Form Errors (LOG FOR LEARNING - 1x ATTEMPT)**
- Selector not found → Form field moved/renamed
- Validation error → Field validation failed
- File upload failed → Resume upload rejected
- Unsupported file type → Site wants DOCX, we provided PDF
- Required field missing → Form requires field user didn't provide
- Custom form logic → Site has conditional fields

---

## Token Efficiency Breakdown

### **Old Model (Per-Job)**
```
28 jobs × 1,500 tokens per job = 42,000 tokens/cycle
Cost: ~$0.126/cycle × 30 cycles/month = $3.78/month
```

### **New Model (Batch + Pre-Scoring)**
```
5 jobs/cycle (batch-size=5)
Pre-scoring filters out 30% of jobs locally (no Claude call)
Result: 5 jobs × 1,500 tokens = 7,500 tokens/cycle
Cost: ~$0.0225/cycle × 30 cycles/month = $0.68/month

SAVINGS: 82% reduction ($3.78 → $0.68)
```

---

## Logging Example

### **Log File** (`~/.applypilot/logs/autopilot-2024-12-20.log`)

```json
{"timestamp":"2024-12-20T08:00:00Z","level":"INFO","stage":"poll_start","message":"Poll cycle started","poll_cycle_id":"pc_20241220_080000"}
{"timestamp":"2024-12-20T08:00:05Z","level":"INFO","stage":"discovery","message":"Jobs discovered","count":42,"duration_s":5.2}
{"timestamp":"2024-12-20T08:00:25Z","level":"INFO","stage":"scoring","message":"Jobs scored","count":38,"passed_threshold":28,"duration_s":20.1}
{"timestamp":"2024-12-20T08:02:15Z","level":"INFO","stage":"application","action":"success","job_id":"job_12345","title":"Senior Engineer","company":"Acme","duration_s":85.2,"claude_tokens":{"input":1250,"output":340}}
{"timestamp":"2024-12-20T08:03:00Z","level":"WARN","stage":"application","action":"rate_limit","job_board":"linkedin.com","error":"HTTP 429","backoff_until":"2024-12-20T08:04:00Z"}
{"timestamp":"2024-12-20T08:03:05Z","level":"ERROR","stage":"application","action":"failed","job_id":"job_12346","error_type":"FORM_ERROR","error":"Selector '#phone' not found"}
{"timestamp":"2024-12-20T08:10:15Z","level":"INFO","stage":"poll_complete","stats":{"new_jobs":42,"applied":18,"failed":8,"skipped":2},"total_tokens":{"input":2395,"output":650}}
```

All logs: JSON format, one object per line, machine-parseable for instant troubleshooting

---

## Notifications

### **Slack Examples**

```
🎯 3 new jobs match your criteria (Avg fit: 8.2/10)
✅ Senior Backend Engineer @ Acme Corp (9/10) - Applied successfully
⚠️ 1 form error, 1 rate limit, 2 pending retry
📊 Today: 127 jobs found, 18 applied, 94% success
```

### **Email Daily Digest**

```
ApplyPilot Daily Summary - Dec 20

📊 Statistics
• Jobs found: 127
• Applications submitted: 18
• Success rate: 94%
• Avg fit score: 7.8/10

🚀 Top Job
Senior Backend Engineer @ Acme Corp (Fit: 9/10)

Next poll: 2024-12-20 16:00:00
```

---

## Health Check

### **Command**
```bash
curl http://localhost:8000/health
```

### **Response**
```json
{
  "status": "healthy",
  "uptime_seconds": 54000,
  "memory_mb": 127,
  "database_healthy": true,
  "last_poll": "2024-12-20T08:00:00Z",
  "success_rate_7d": 0.94,
  "next_poll": "2024-12-20T16:00:00Z"
}
```

---

## Docker Deployment

### **docker-compose.yml**
```yaml
services:
  applypilot:
    build: .
    volumes:
      - applypilot_data:/app/data
      - applypilot_logs:/app/logs
    environment:
      - APPLYPILOT_POLL_INTERVAL=8
      - APPLYPILOT_BATCH_SIZE=5
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### **Deploy**
```bash
docker-compose up -d
docker logs applypilot -f
curl http://localhost:8000/health
```

---

## `applypilot status` Output

```
ApplyPilot Status
=================

Schedule:
  Status: Enabled
  Interval: Every 8 hours
  Next poll: 2024-12-20 16:00:00 UTC
  Last poll: 2024-12-20 08:00:00 UTC ✅

Recent Stats (24h):
  Polls: 3
  Jobs: 127 discovered, 89 scored, 15 applied
  Success rate: 86.7%

Application History:
  ✅ Senior Engineer @ Acme (Fit: 9/10)
  ✅ Backend Dev @ TechCorp (Fit: 8/10)
  ❌ DevOps @ StartupXYZ (Form error)
  ⏱️ Frontend @ CloudSys (Rate limited, retry at 08:05)

Health:
  Memory: 127 MB / 512 MB
  Database: OK
  Last error: None
  Uptime: 3 days
```

---

## Timeline & Estimates

| Phase | Duration | Complexity | Scope |
|-------|----------|-----------|-------|
| **P4: Error Handling** | **18 days** | **High** | Schema migration, error classification, retry logic, logging, batch mode |
| **P5: Monitoring** | **19 days** | **High** | Slack/email, health checks, status command, Docker, Kubernetes, tests |
| **Total** | **~5 weeks** | **Phases 4-5 together** | **Production-ready system** |

---

## Key Metrics (Success Criteria)

### **Phase 4**
- ✅ 95%+ error classification accuracy
- ✅ No rate limit violations (HTTP 429s)
- ✅ Transient errors retry correctly
- ✅ All logs valid JSON (parseable by `jq`)
- ✅ Token usage reduced 40-50%
- ✅ Batch mode respects configured limit
- ✅ 95%+ test pass rate

### **Phase 5**
- ✅ Slack messages sent successfully
- ✅ Email summaries at configured times
- ✅ Health endpoint responds in <100ms
- ✅ Docker container starts/stops gracefully
- ✅ `docker-compose up` works without errors
- ✅ K8s deployment works with probes
- ✅ 99.9% uptime (3 nines)
- ✅ 95%+ E2E test pass rate

---

## What Gets Built (Deliverables)

### **Phase 4**
1. Optimized database schema (9 tables, v2)
2. `ErrorClassifier` + `RetryManager` classes
3. Structured JSON logging system
4. Batch mode logic + pre-scoring filters
5. CLI log commands (`logs --filter`, `--error`, `--since`)
6. 20+ error type definitions
7. Integration test suite (100+ tests)

### **Phase 5**
1. `SlackNotifier` + `EmailNotifier` classes
2. Health endpoint (HTTP /health)
3. `applypilot status` command
4. Dockerfile + Docker entrypoint
5. docker-compose.yml
6. Kubernetes deployment YAML
7. Notification audit trail (`notification_log` table)
8. E2E test suite
9. Complete documentation

---

## Files to Create/Modify

### **New Python Modules**
- `src/applypilot/error_handler.py` (ErrorClassifier)
- `src/applypilot/retry_manager.py` (RetryManager)
- `src/applypilot/logging_config.py` (JSON structured logging)
- `src/applypilot/notifications/slack_notifier.py`
- `src/applypilot/notifications/email_notifier.py`
- `src/applypilot/health_check.py` (Health endpoint)
- `src/applypilot/docker_entrypoint.py` (Docker startup)

### **New Configuration Files**
- `Dockerfile`
- `docker-compose.yml`
- `k8s/deployment.yaml`
- `k8s/configmap.yaml`
- `k8s/secret.yaml`

### **New CLI Commands**
- `applypilot logs --filter --since --error --tail`
- `applypilot status`
- `applypilot notifications slack --webhook <url>`
- `applypilot notifications email --address <email>`
- `applypilot notifications test`
- `applypilot notifications disable`

### **Modified Files**
- `src/applypilot/cli.py` (Add new commands)
- `src/applypilot/database.py` (Add schema v2 migration)
- `src/applypilot/autopilot/orchestrator.py` (Batch mode logic)
- `requirements.txt` (Add new dependencies)

---

## Backward Compatibility

✅ **Schema Migration**: Old data migrated, no data loss  
✅ **CLI**: New commands don't break old commands  
✅ **Docker**: Backward compatible; old cron jobs still work  
✅ **Rollback**: Keep backup table for 30 days after migration  

---

## Next: After Phase 5

### Phase 6 (Future): Auto-Learning
- Capture form structures on failure
- Auto-suggest registry updates
- Community registry sharing

### Phase 7 (Future): Analytics Dashboard
- Web UI with job timeline charts
- Success rate trends over time
- Salary analysis

### Phase 8 (Future): Multi-Account Support
- Support multiple job seekers
- Account isolation in database
- Separate schedules per account

---

**Full Specification**: `/Users/manishslal/Desktop/Coding-Projects/.github/specs/applypilot-phases-4-5-v2-spec.md`  
**Document Version**: 1.0  
**Date**: December 20, 2024  
**Status**: Ready for Implementation  
**Next Review**: After Phase 4 completion (Week 3)
