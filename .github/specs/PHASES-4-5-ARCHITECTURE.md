# ApplyPilot v2 Phases 4-5: Architecture & System Design

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ApplyPilot v2 (Phases 4-5)                           │
│                     Production-Ready Job Application System                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   Cron/Task      │
                              │  Scheduler (OS)  │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
            (every 8 hours)    (manual trigger)   (Docker entrypoint)
                    │                  │                  │
                    ▼                  ▼                  ▼
        ┌─────────────────────────────────────────────────────────┐
        │         CLI Layer / Docker Entrypoint                   │
        │  ┌────────────────────────────────────────────────────┐ │
        │  │ applypilot poll                                    │ │
        │  │ applypilot run --batch-size 5                      │ │
        │  │ applypilot status                                  │ │
        │  │ applypilot schedule --status                       │ │
        │  │ applypilot logs --filter stage=application         │ │
        │  └────────────────────────────────────────────────────┘ │
        └──────────────────────┬─────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌────────────┐       ┌────────────┐       ┌────────────┐
    │   Poll     │       │  Health    │       │ Notification
    │ Orchestrator       │  Check (/)  │       │ Publisher
    │ (6-stage)  │       │ Server     │       │
    └────────────┘       │(port 8000)│       └────────────┘
        │                 └────────────┘              │
        │                                             │
        │                        ┌────────────────────┴──────────────┐
        │                        │                                   │
        ▼                        ▼                                   ▼
    ┌──────────────┐      ┌────────────────┐              ┌──────────────────┐
    │  Discovery   │      │ Error Handler  │              │   Notifications   │
    │   Stage      │      │   & Classifier │              │  ┌──────────────┐ │
    └──────────────┘      │                │              │  │ SlackNotifier│ │
          │               │ • ErrorClassify│              │  ├──────────────┤ │
          │               │ • RetryManager │              │  │ EmailNotifier│ │
          │               │ • Backoff Calc │              │  └──────────────┘ │
          │               │                │              │                   │
          │               │ error_backoff  │              │ notification_log  │
          │               │  table (rate   │              │   table (audit)   │
          │               │  limits)       │              └──────────────────┘
          │               └────────────────┘                        │
          │                      │                                  │
          ▼                      ▼                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                       Database Layer (SQLite)                       │
    │  ┌─────────────────────────────────────────────────────────────┐   │
    │  │ CORE TABLES (Optimized Schema v2)                          │   │
    │  │ ┌──────────────────┐  ┌──────────────────┐                 │   │
    │  │ │ jobs (17 cols)   │  │ applications    │                 │   │
    │  │ │ ├─ id, url       │  │ ├─ Immutable log│                 │   │
    │  │ │ ├─ fit_score     │  │ ├─ success,fail │                 │   │
    │  │ │ ├─ apply_status  │  │ ├─ retry_count  │                 │   │
    │  │ │ ├─ apply_attempts   │ ├─ error_type  │                 │   │
    │  │ │ └─ last_error    │  │ └─ tokens used  │                 │   │
    │  │ └──────────────────┘  └──────────────────┘                 │   │
    │  │                                                             │   │
    │  │ ┌──────────────────┐  ┌──────────────────┐                 │   │
    │  │ │ job_details      │  │ poll_cycles     │                 │   │
    │  │ │ (sparse)         │  │ ├─ started_at   │                 │   │
    │  │ │ ├─ full_desc     │  │ ├─ stats        │                 │   │
    │  │ │ ├─ requirements  │  │ └─ error_type   │                 │   │
    │  │ │ └─ salary        │  └──────────────────┘                 │   │
    │  │ └──────────────────┘                                       │   │
    │  │                                                             │   │
    │  │ ┌──────────────────┐  ┌──────────────────┐                 │   │
    │  │ │ error_backoff    │  │notification_log │                 │   │
    │  │ │ (rate limiting)  │  │ (audit trail)   │                 │   │
    │  │ │ ├─ backoff_key   │  │ ├─ sent_at      │                 │   │
    │  │ │ ├─ backoff_until │  │ ├─ delivery_stat│                 │   │
    │  │ │ └─ failed_attempts   │ └─ error_msg    │                 │   │
    │  │ └──────────────────┘  └──────────────────┘                 │   │
    │  │                                                             │   │
    │  │ ┌──────────────────────────────────────────────────┐       │   │
    │  │ │ REFERENCE TABLES (Unchanged from Phase 3)        │       │   │
    │  │ │ ├─ website_registry (50+ job boards)             │       │   │
    │  │ │ ├─ site_credentials (encrypted logins)           │       │   │
    │  │ │ ├─ schedule_config (polling schedule)            │       │   │
    │  │ │ └─ schema_migrations (version tracking)          │       │   │
    │  │ └──────────────────────────────────────────────────┘       │   │
    │  └─────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────────┘
          ▲                    ▲                    ▲
          │                    │                    │
    ┌─────┴──────┬─────────────┼────────────┬──────┴──────┐
    │            │             │            │             │
    ▼            ▼             ▼            ▼             ▼
  [Logs]   [Metrics]   [Audit Trail]  [Alerts]   [Backups]
   JSON     Query         Query         Sent      Daily
   Logs     analytics     debugging     Slack    Archive
  Local    dashboard                   Email
 ~/.applypilot/
   logs/
```

---

## Phase 4: Error Handling Pipeline

```
Application Attempt
        │
        ▼
┌──────────────────┐
│   Try to Apply   │  ← Claude fills form at job_url
│   via Claude API │
└────────┬─────────┘
         │
         ├─ SUCCESS → applications.insert(success=true)
         │            jobs.update(apply_status='applied')
         │            → Continue to next job
         │
         ├─ EXCEPTION → Caught & Classified
         │              ▼
         │        ┌─────────────────────┐
         │        │ ErrorClassifier     │
         │        │ .classify_error()   │
         │        └─────────┬───────────┘
         │                  │
         │        ┌─────────┴──────────────┐
         │        │                       │
         │        ▼                       ▼
         ├─→ TRANSIENT              PERMANENT
         │   └─ Retry?              └─ Skip!
         │      │                      │
         │      ├─ Attempt < 3         jobs.update(
         │      │  YES → Calc backoff  apply_status='failed',
         │      │        Schedule retry last_error_type='PERMANENT')
         │      │        applications.insert(
         │      │          retry_count=N,
         │      │          next_retry_at=NOW+delay)
         │      │
         │      └─ Attempt = 3
         │         Mark as failed
         │         applications.insert(retry_count=3)
         │
         ├─→ FORM_ERROR
         │   └─ Log for learning
         │      Flag registry update
         │      applications.insert(error_type='FORM_ERROR')
         │
         └─→ RATE_LIMIT
             └─ Add to error_backoff table
                Backoff until: NOW + 60s
                Skip remaining jobs from this domain
                Schedule retry in 5 min
```

---

## Phase 5: Notification Architecture

```
Poll Cycle Complete
        │
        ▼
    ┌─────────────────────────────────────┐
    │  Generate Summary Statistics        │
    │  • jobs_found, applied, failed      │
    │  • success_rate, avg_fit_score      │
    │  • errors requiring attention       │
    └──────────┬──────────────────────────┘
               │
        ┌──────┴─────────────────────────────────────┐
        │                                            │
        ▼                                            ▼
    ┌─────────────────────────┐        ┌─────────────────────────┐
    │   Notification Logic    │        │   Throttle Check        │
    │                         │        │                         │
    │ IF errors_count > 0:    │        │ last_notification_at    │
    │  → Send error alert     │        │ + 5_minutes > NOW ?      │
    │                         │        │                         │
    │ IF success_count > 0:   │        │ Skip notification       │
    │  → Send success notif   │        │ (rate limited)          │
    │                         │        │                         │
    │ IF daily_digest_time:   │        │ Otherwise:              │
    │  → Send email summary   │        │ Send notification       │
    │                         │        │ Update last_notif_time  │
    └─────────────┬───────────┘        └──────────┬──────────────┘
                  │                               │
        ┌─────────┴───────────────────────────────┴──────────┐
        │                                                    │
        ▼                                                    ▼
    ┌──────────────────────┐                    ┌──────────────────────┐
    │  SlackNotifier       │                    │  EmailNotifier       │
    │  .notify_*()         │                    │  .send_*()           │
    │                      │                    │                      │
    │ ├─ job_match()       │                    │ ├─ daily_summary()   │
    │ ├─ app_success()     │                    │ └─ error_alert()     │
    │ ├─ daily_summary()   │                    │                      │
    │ └─ errors_alert()    │                    │ SMTP (Gmail, O365)   │
    │                      │                    │                      │
    │ POST to Webhook      │                    │ Send via SMTP        │
    └────────┬─────────────┘                    └────────┬─────────────┘
             │                                          │
             ▼                                          ▼
    ┌──────────────────────┐                    ┌──────────────────────┐
    │  Slack Channel       │                    │  Email Inbox         │
    │  #applypilot         │                    │  user@example.com    │
    │                      │                    │                      │
    │  ✅ Application sent │                    │  ApplyPilot Summary  │
    │  📊 Daily stats      │                    │  • 15 jobs applied   │
    │  ⚠️ Errors alert     │                    │  • 94% success rate  │
    └──────────────────────┘                    └──────────────────────┘
             │
             ▼
    ┌────────────────────────────────────┐
    │  notification_log table            │
    │  (audit trail)                     │
    │                                    │
    │  id | notification_type | status   │
    │  ---|-------------------|------    │
    │  1  | slack             | success  │
    │  2  | email             | success  │
    │  3  | slack             | failed   │
    │      (will retry)                  │
    └────────────────────────────────────┘
```

---

## Phase 5: Health Check System

```
HTTP GET /health
    │
    ▼
┌────────────────────────────────────┐
│  HealthChecker.check()             │
│                                    │
│  1. Check database connection      │
│  2. Check file system (logs, data) │
│  3. Get last poll time             │
│  4. Calculate success rate         │
│  5. Check memory usage             │
│  6. Check uptime                   │
└────────┬───────────────────────────┘
         │
    ┌────┴────────────────────────────────────┐
    │                                         │
    ▼                                         ▼
 All checks OK?                      Any check FAILED?
    │                                         │
    ▼                                         ▼
 status='healthy'              status='unhealthy'
 HTTP 200 OK                   HTTP 503 SERVICE UNAVAILABLE
    │                                         │
    ▼                                         ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│ {                        │    │ {                        │
│   "status": "healthy",   │    │   "status": "unhealthy", │
│   "uptime_s": 54000,     │    │   "database_healthy": false,
│   "memory_mb": 127,      │    │   "error": "DB timeout"  │
│   "database_healthy": ok,│    │ }                        │
│   "last_poll": "08:00",  │    └──────────────────────────┘
│   "success_rate": 0.94   │
│ }                        │
└──────────────────────────┘
    │
    ▼
Kubernetes Liveness Probe
container.livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3

IF 3 consecutive failures → Pod is restarted
```

---

## Docker Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Docker Image                          │
│  FROM python:3.11-slim                                       │
│  ├─ Python 3.11 + dependencies (requirements.txt)           │
│  ├─ ApplyPilot source code                                  │
│  ├─ EXPOSE 8000 (health check port)                         │
│  └─ ENTRYPOINT python -m applypilot.docker_entrypoint       │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐
        │  applypilot_data │  │applypilot_logs   │  │ ~/.applypilot/     │
        │  volume          │  │ volume           │  │ credentials (RO)   │
        │                  │  │                  │  │                    │
        │ /app/data/       │  │ /app/logs/       │  │ Mounted at startup │
        │ applypilot.db    │  │ autopilot-*.log  │  │ (read-only)        │
        └──────────────────┘  └──────────────────┘  └────────────────────┘
                │                      │                      │
                ▼                      ▼                      ▼
        ┌──────────────────────────────────────────────────────────┐
        │          Docker Container Running                        │
        │  ┌──────────────────────────────────────────────────────┐ │
        │  │ docker_entrypoint.py                                 │ │
        │  │ ├─ Initialize database (migrations auto-run)         │ │
        │  │ ├─ Start PollScheduler in background thread         │ │
        │  │ ├─ Start FastAPI health server (main thread)        │ │
        │  │ ├─ Set up signal handlers (SIGTERM → graceful)      │ │
        │  │ └─ LOG: "ApplyPilot ready"                          │ │
        │  └──────────────────────────────────────────────────────┘ │
        │                                                           │
        │  ┌─────────────────┐          ┌────────────────────────┐ │
        │  │ PollScheduler   │          │ FastAPI Health Server  │ │
        │  │ (Background)    │          │ (Main Thread)          │ │
        │  │                 │          │                        │ │
        │  │ • Checks sched  │          │ • GET /health → JSON   │ │
        │  │ • Runs polls    │          │ • GET /status → JSON   │ │
        │  │ • Applies jobs  │          │ • Listens on 0.0.0.0  │ │
        │  │ • Retries       │          │ • Port 8000            │ │
        │  │ • Sends notifs  │          │ • <100ms response      │ │
        │  │ • Logs to file  │          │                        │ │
        │  └─────────────────┘          └────────────────────────┘ │
        │                                                           │
        │  ┌──────────────────────────────────────────────────────┐ │
        │  │ Signal Handlers                                      │ │
        │  │ • SIGTERM → Graceful shutdown (5s grace period)     │ │
        │  │ • SIGINT  → Graceful shutdown                       │ │
        │  │ • Stops scheduler, closes DB, exits                 │ │
        │  └──────────────────────────────────────────────────────┘ │
        └──────────────────────────────────────────────────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │   Health Check (external) │
    │   curl localhost:8000/    │
    │        health             │
    │                           │
    │   Response: 200 OK        │
    │   {"status": "healthy"}   │
    │                           │
    │   Kubernetes will:        │
    │   • Keep pod running      │
    │   • Route traffic         │
    │   • Monitor liveness      │
    └───────────────────────────┘
```

---

## 6-Stage Poll Cycle with Error Recovery

```
START: applypilot poll (scheduled or manual)
        │
        ▼
┌─────────────────────────────────────┐
│ STAGE 1: DISCOVERY                  │
│ • Fetch job listings from boards    │
│ • Check if already applied          │
│ • Log: jobs discovered              │
└──────────┬──────────────────────────┘
           │
    ┌──────┴────────────────┐
    │ Success? Errors?      │
    │ Transient? Permanent? │
    │ Rate limited?         │
    ▼
    [Error classification]
    ├─ Transient → Retry later (schedule retry)
    ├─ Permanent → Skip this board, continue others
    └─ OK → Proceed to Stage 2
    │
    ▼
┌─────────────────────────────────────┐
│ STAGE 2: ENRICHMENT                 │
│ • Fetch full job descriptions       │
│ • Parse requirements & benefits     │
│ • Log: jobs enriched                │
└──────────┬──────────────────────────┘
           │
           ├─ Error → Classify → Retry/Skip
           │
           ▼
┌─────────────────────────────────────┐
│ STAGE 3: SCORING                    │
│ • Match job requirements vs resume  │
│ • Calculate fit_score (1-10)        │
│ • Filter by threshold (e.g., >= 7)  │
│ • Log: jobs scored                  │
└──────────┬──────────────────────────┘
           │
           ├─ Error → Classify → Retry/Skip
           │
           ├─ Scored < threshold → Skip job
           │
           ▼
┌─────────────────────────────────────┐
│ STAGE 4: RESUME TAILORING           │
│ • Generate resume tailored to job   │
│ • Save as resume_{job_id}.pdf       │
│ • Log: resumes tailored             │
└──────────┬──────────────────────────┘
           │
           ├─ Error → Classify → Retry/Skip
           │
           ▼
┌─────────────────────────────────────┐
│ STAGE 5: COVER LETTER               │
│ • Generate cover letter for job     │
│ • Save as cover_{job_id}.pdf        │
│ • Log: cover letters generated      │
└──────────┬──────────────────────────┘
           │
           ├─ Error → Classify → Retry/Skip
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ STAGE 6: APPLICATION (BATCH MODE)                    │
│                                                      │
│ FOR EACH job IN top_N_by_fit_score (default=5):    │
│                                                      │
│  1. Check error_backoff table                        │
│     IF backoff_until > NOW → Skip (rate limited)     │
│                                                      │
│  2. Attempt application                              │
│     • Call Claude to fill form                       │
│     • Upload resume + cover letter                   │
│     • Submit application                             │
│     • Log: application attempt                       │
│                                                      │
│  3. Capture result                                   │
│     IF success:                                      │
│       • applications.insert(success=true)            │
│       • jobs.update(apply_status='applied')          │
│       • Send Slack notification                      │
│                                                      │
│     IF error:                                        │
│       • Classify error                               │
│       • applications.insert(success=false, ...)      │
│       • If transient: Schedule retry (next_retry_at) │
│       • If permanent: jobs.update(apply_status=fail) │
│       • If form error: Flag for learning             │
│       • Send error notification if critical          │
│                                                      │
│  4. Update poll_cycles table with stats              │
│     • applied_count++                                │
│     • failed_count++                                 │
│     • skipped_count++                                │
│                                                      │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────┐
    │ POLL COMPLETE        │
    │                      │
    │ • Log: poll finished │
    │ • Notify (Slack/Email
    │ • Send status info   │
    │ • Save stats         │
    │ • Schedule next poll │
    └──────────────────────┘
           │
           ▼
    ┌──────────────────────┐
    │ SUCCESS!             │
    │ Next poll in 8h      │
    └──────────────────────┘
```

---

## Logging Architecture

```
┌────────────────────────────────────────────────────────────┐
│               Structured JSON Logging                      │
│  (All logs: machine-parseable, one JSON object per line)  │
└────────────────────────────────────────────────────────────┘

Python Code:
┌───────────────────────────────────────────────────────────┐
│ import logging                                            │
│ from pythonjsonlogger import jsonlogger                   │
│                                                            │
│ logger = logging.getLogger()                              │
│ handler = RotatingFileHandler(                            │
│     filename="~/.applypilot/logs/autopilot-{date}.log",  │
│     maxBytes=50MB,                                        │
│     backupCount=7  # 7 days                               │
│ )                                                          │
│ formatter = jsonlogger.JsonFormatter()                    │
│ handler.setFormatter(formatter)                           │
│ logger.addHandler(handler)                                │
│                                                            │
│ # Usage:                                                  │
│ logger.info("Application success",                        │
│   extra={                                                 │
│     "stage": "application",                               │
│     "action": "success",                                  │
│     "job_id": "job_12345",                                │
│     "company": "Acme Corp",                               │
│     "duration_s": 85.2,                                   │
│     "claude_tokens": {"input": 1250, "output": 340}       │
│   }                                                        │
│ )                                                          │
└───────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────────┐
│ ~/.applypilot/logs/autopilot-2024-12-20.log               │
│ (One JSON object per line)                                │
│                                                            │
│ {"timestamp":"2024-12-20T08:00:00Z","level":"INFO",...}  │
│ {"timestamp":"2024-12-20T08:00:05Z","level":"INFO",...}  │
│ {"timestamp":"2024-12-20T08:00:10Z","level":"WARN",...}  │
│ {"timestamp":"2024-12-20T08:00:15Z","level":"ERROR",...} │
│ ...                                                        │
│ (50 MB max, rotates daily, compressed to .gz)             │
└────────────────────────────────────────────────────────────┘
          │
          ▼
      ┌─────────────────────────────────────────────┐
      │  Querying Logs (Human-Friendly)             │
      │                                             │
      │  # Get last 100 lines                       │
      │  $ applypilot logs --tail 100               │
      │                                             │
      │  # Get all errors                           │
      │  $ applypilot logs --error                  │
      │                                             │
      │  # Get errors from last 24h                 │
      │  $ applypilot logs --error --since 24h      │
      │                                             │
      │  # Get all applications in stage            │
      │  $ applypilot logs --filter stage=applic    │
      │                                             │
      │  # Parse with jq (JSON query)               │
      │  $ cat ~/.applypilot/logs/autopilot-*.log   │
      │    | jq 'select(.error_type=="RATE_LIMIT")' │
      │                                             │
      └─────────────────────────────────────────────┘
```

---

## Error Recovery Decision Tree

```
Application Attempt Failed
        │
        ▼
┌────────────────────────────┐
│ Exception Caught           │
│ What type of error?        │
└────────────────┬───────────┘
                 │
    ┌────────────┼────────────┬─────────────┐
    │            │            │             │
    ▼            ▼            ▼             ▼
Network        HTTP        Claude        Custom
Exception      Status      API Error     Error
    │            │            │             │
    ├─ Timeout   ├─ 429        ├─ Overload   └─ FORM_ERROR
    │  (1s,4s,   │  (60s,120s, │ (30s,60s,
    │   16s)     │   300s)     │  120s)
    │            │            │
    ├─ Reset     ├─ 503        ├─ Invalid
    │  (1s,4s,   │  (10s,30s,  │  credentials
    │   16s)     │   90s)      │  → PERMANENT
    │            │            │
    └─ Other     ├─ 404        └─ Timeout
       (retry)   │  → PERMANENT  (retry)
                 │
                 ├─ 401/403
                 │  → PERMANENT
                 │
                 └─ Other
                    (retry)

      TRANSIENT               PERMANENT              FORM_ERROR
         │                       │                       │
         ▼                       ▼                       ▼
    Retry? < 3X         Don't retry              Log for learning
         │                       │                       │
         ├─ YES                  ├─ Mark as failed       ├─ Flag registry
         │  Schedule retry       │  Skip job             │  Add to learning
         │  next_retry_at        │  Move to next         │  Log full context
         │                       │                       │
         └─ NO                   └─ Update stats         └─ Mark as failed
            Max retries
            Mark as failed
```

---

## Performance Characteristics

### **Query Performance (with optimized schema + indexes)**

| Query | Without Index | With Index | Improvement |
|-------|---------------|-----------|------------|
| Get jobs ready to apply (apply_status='new', threshold_met=true) | 500-1000ms | 5-10ms | 100x faster |
| Filter by job_board_domain | 200ms | <1ms | 200x faster |
| Get recent applications (last 24h) | 300ms | 2-5ms | 100x faster |
| Total jobs by status | 150ms | <1ms | 150x faster |

### **Memory Usage**

| Component | Memory (Idle) | Memory (During Poll) |
|-----------|---------------|-------------------|
| Python interpreter + libraries | 80 MB | 80 MB |
| Database connection pool | 20 MB | 20 MB |
| Scheduler thread | 10 MB | 10 MB |
| FastAPI health server | 15 MB | 15 MB |
| Active poll (jobs in memory) | — | 100-200 MB |
| **Total** | **~125 MB** | **~225-325 MB** |

### **Token Usage (Batch Mode)**

| Mode | Jobs/Cycle | Tokens/Job | Total/Cycle | Cost/Cycle | Cost/Month |
|------|-----------|-----------|------------|-----------|-----------|
| Per-job (no batching) | 28 | 1,500 | 42,000 | $0.126 | $3.78 |
| Batch size 5 + filter | 5 | 1,500 | 7,500 | $0.0225 | $0.68 |
| **Savings** | — | — | **82% less** | **82% less** | **82% less** |

### **Latency**

| Operation | Latency (P50) | Latency (P99) |
|-----------|---------------|--------------|
| Health check (/health) | 10ms | 50ms |
| Status command | 100ms | 500ms |
| Single application (happy path) | 15-30s | 60s |
| Poll cycle (5 apps) | 2-3 min | 5-10 min |
| Retry application (rate limit) | 60-300s | 300s+ |

---

**Generated**: December 20, 2024  
**Status**: Architecture Complete ✅  
**Next Step**: Implementation begins Phase 4 (Day 1)
