# ApplyPilot v2 - Phases 4-5 Design Documentation

**Document Status**: ✅ COMPLETE - Ready for Implementation  
**Date**: December 20, 2024  
**Total Lines**: ~2,968 lines of specification  

---

## 📋 Document Index

### **1. Main Technical Specification** (1,897 lines)
**File**: `applypilot-phases-4-5-v2-spec.md`

Complete architectural design for Phases 4-5 covering:

- **Executive Summary & Goals** - Strategic objectives and success criteria
- **Current State Analysis** - What Phase 3 built and what's missing
- **Database Schema Optimization** - Lean, queryable schema (9 tables, v2)
  - `jobs` table: 17 columns (vs 30+ before)
  - `applications` table: Immutable audit log
  - `error_backoff` table: Rate limit tracking
  - `notification_log` table: Audit trail
  - Migration script: Zero data loss
  
- **Phase 4: Error Handling, Retries & Logging** (18 days)
  - R4.1: Error classification (transient/permanent/form errors)
  - R4.2: Retry logic with exponential backoff (1s, 4s, 16s)
  - R4.3: Structured JSON logging
  - R4.4: Token efficiency & batch mode (40-50% cost reduction)
  
- **Phase 5: Notifications & Monitoring** (19 days)
  - R5.1: Slack + Email notifications (throttled)
  - R5.2: Health checks & status monitoring
  - R5.3: Docker containerization with graceful shutdown
  
- **Implementation Tasks**: 20 specific, measurable tasks
  - Each task has: Duration, Complexity, Acceptance Criteria, Dependencies
  - Phase 4: 7 tasks (P4.1-P4.7)
  - Phase 5: 10 tasks (P5.1-P5.10)
  
- **Example Output Files**:
  - Sample log entries (JSON, machine-parseable)
  - Slack message templates
  - Docker entrypoint script
  - Health check response examples
  
- **Security & Compliance**: Credential encryption, audit trails, log retention
- **Performance & Scalability**: Query optimization, caching, batch processing
- **Rollback Plan**: How to safely revert if issues occur

---

### **2. Quick Reference Guide** (418 lines)
**File**: `PHASES-4-5-QUICK-SUMMARY.md`

Executive summary for busy architects/PMs:

- **What's Being Built**: One-page overview
- **Database Schema Changes**: Before/after comparison
- **Error Classification**: Visual table of error types + handling
- **Token Efficiency**: Cost breakdown (82% savings)
- **Logging Examples**: Real log entries you'll see
- **Notifications**: Slack/Email message templates
- **Health Checks**: API response format
- **Docker Deployment**: Quick-start docker-compose.yml
- **Status Command Output**: What `applypilot status` will show
- **Timeline & Metrics**: 5 weeks total, 95%+ test coverage
- **Deliverables Checklist**: What gets built in each phase

**Use This For**:
- Quick briefings to stakeholders
- Giving to new team members
- Presentations to leadership
- Status updates in standups

---

### **3. Architecture & Design Diagrams** (653 lines)
**File**: `PHASES-4-5-ARCHITECTURE.md`

Visual system architecture and data flows:

- **System Architecture Overview**: Full stack diagram
  - Poll Orchestrator (6-stage)
  - Error Handler & Classifier
  - Notification Publisher
  - Database Layer (9 tables)
  - Logging System
  
- **Phase 4: Error Handling Pipeline**
  - Exception classification logic
  - Transient vs Permanent vs Form Error paths
  - Retry scheduling
  
- **Phase 5: Notification Architecture**
  - Throttling logic (max 1/5 min)
  - Slack/Email routing
  - Audit trail tracking
  
- **Health Check System**
  - HTTP /health endpoint
  - Kubernetes liveness probe integration
  - Status responses (healthy/unhealthy/starting)
  
- **Docker Deployment Diagram**
  - Volume mounts (data, logs, credentials)
  - Background threads (scheduler, health server)
  - Signal handling (graceful shutdown)
  - Health checks (external monitoring)
  
- **6-Stage Poll Cycle with Error Recovery**
  - Complete flow: Discover → Enrich → Score → Tailor → Cover → Apply
  - Error classification at each stage
  - Batch mode application logic
  
- **Logging Architecture**
  - Python logging config
  - Log file rotation (7-day retention)
  - CLI query examples
  
- **Error Recovery Decision Tree**
  - Network errors → Retry transient
  - HTTP errors → Classify by code
  - Claude errors → Retry vs fail
  - Form errors → Log for learning
  
- **Performance Characteristics**
  - Query performance (5-10ms with indexes vs 500ms without)
  - Memory usage (125 MB idle, 225-325 MB during poll)
  - Token usage (82% savings with batching)
  - Latency (10ms health check, 2-3 min poll cycle)

**Use This For**:
- System design reviews
- Onboarding engineers
- Architecture documentation
- Understanding data flows
- Performance planning

---

## 🎯 Key Design Highlights

### **1. Database Optimization**
- **From 30+ bloated columns → 17 lean columns** in jobs table
- **Immutable application log** (applications table) for audit trail
- **Rate limit tracking** (error_backoff table) per domain
- **Performance**: 10ms queries (vs 500ms+ before)
- **Sparse enrichment**: job_details table for optional data

### **2. Error Handling**
- **3 error classes**: Transient (retry 1s/4s/16s), Permanent (skip), Form (learn)
- **Smart classification**: Network timeout vs HTTP 429 vs CAPTCHA vs form error
- **Rate limit recovery**: 60s backoff, track per domain
- **CAPTCHA handling**: 5-min backoff after first detection
- **Auto-backoff**: Don't hammer sites that are rate-limiting us

### **3. Token Efficiency**
- **Batch mode**: Apply to 5 jobs/cycle (not 28) = 82% cost reduction
- **Pre-scoring**: Filter with keyword matching before Claude call
- **Per-job tailoring**: Fresh resume for each job (user's requirement)
- **Token tracking**: Log input/output tokens per application
- **Cost analytics**: Track spending per cycle, per month

### **4. Notifications**
- **Slack integration**: Webhook-based, throttled (max 1/5 min)
- **Email daily**: HTML digest at configured time (e.g., 9 AM)
- **Message types**: Job matches, successes, errors, daily summary
- **Delivery tracking**: notification_log table for audit trail
- **Retry logic**: Failed notifications retried up to 3x

### **5. Monitoring & Observability**
- **Health endpoint**: `/health` on port 8000 (HTTP, JSON, <100ms)
- **Status command**: Rich terminal output with stats and history
- **Structured JSON logs**: Machine-parseable, daily rotation, 7-day retention
- **Audit trail**: Every application attempt logged (success/failure reason)
- **Memory tracking**: Monitor usage during polls

### **6. Docker & Deployment**
- **Containerized**: Single image, works everywhere (K8s, Docker Compose, standalone)
- **Graceful shutdown**: SIGTERM handled, 5s grace period
- **Health checks**: Liveness probes for orchestrators
- **Volume mounts**: data, logs, credentials (read-only)
- **Zero daemon overhead**: Entrypoint script + cron/scheduler replacement

---

## 📅 Implementation Timeline

### **Phase 4: Error Handling, Retries & Logging (18 days)**

| Task | Days | Who | Deliverable |
|------|------|-----|-------------|
| P4.1: Schema Migration | 2 | Backend | Database schema v2 + migration |
| P4.2: Error Classification | 3 | Backend | ErrorClassifier (20+ types) |
| P4.3: Retry Logic | 4 | Backend | RetryManager + exponential backoff |
| P4.4: Structured Logging | 2 | Backend | JSON logs, rotation, retention |
| P4.5: Batch Mode | 3 | Backend | Apply N jobs/cycle + pre-scoring |
| P4.6: CLI Log Commands | 1 | CLI | logs --filter --error --since |
| P4.7: Integration Tests | 3 | QA | 95%+ pass rate |

### **Phase 5: Notifications, Monitoring & Docker (19 days)**

| Task | Days | Who | Deliverable |
|------|------|-----|-------------|
| P5.1: Slack Integration | 2 | Backend | SlackNotifier + webhook |
| P5.2: Email Integration | 2 | Backend | EmailNotifier + SMTP |
| P5.3: Status Command | 2 | CLI | applypilot status output |
| P5.4: Health Endpoint | 2 | Backend | /health HTTP endpoint |
| P5.5: Docker Image | 3 | DevOps | Dockerfile + entrypoint |
| P5.6: Docker Compose | 1 | DevOps | docker-compose.yml |
| P5.7: Notification Audit | 1 | Backend | notification_log table |
| P5.8: Kubernetes YAML | 1 | DevOps | K8s deployment |
| P5.9: Documentation | 2 | Tech Writer | CLI help + guides |
| P5.10: E2E Tests | 3 | QA | Full cycle + Docker tests |

**Total**: ~5 weeks to production-ready system

---

## ✅ Success Criteria

### **Phase 4 Success**
- ✅ 95%+ error classification accuracy
- ✅ Transient errors retry with correct backoff (no 429 violations)
- ✅ All logs in valid JSON (parseable by `jq`)
- ✅ Token usage reduced 40-50%
- ✅ Batch mode respects configured limit (e.g., 5 jobs)
- ✅ All CLI log commands work
- ✅ 95%+ integration test pass rate

### **Phase 5 Success**
- ✅ Slack messages sent successfully
- ✅ Email summaries at configured times
- ✅ Health endpoint <100ms response
- ✅ Docker container starts/stops gracefully
- ✅ docker-compose up works without errors
- ✅ K8s deployment works with liveness probes
- ✅ 99.9% uptime (3 nines)
- ✅ 95%+ E2E test pass rate

---

## 📊 Key Metrics

| Metric | Target | Method |
|--------|--------|--------|
| **Availability** | 99.9% uptime | Health checks + monitoring |
| **Error Classification** | 95%+ accuracy | Unit tests with 20+ cases |
| **Token Savings** | 40-50% reduction | Before/after cost analysis |
| **Query Performance** | <10ms | Indexes on frequent patterns |
| **Health Check** | <100ms response | HTTP benchmark tests |
| **Test Coverage** | 95%+ pass rate | Full integration + E2E test suite |
| **Memory Usage** | <325 MB during poll | Profiling + monitoring |
| **Log Retention** | 7 days | Rotation + compression |

---

## 🔄 Rollback Strategy

If issues occur during implementation:

1. **Database**: Keep `jobs_v1_backup` table for 30 days post-migration
2. **Code**: Tag version before each phase (phases-3-stable, phases-4-stable)
3. **Features**: Can disable new features independently:
   - `applypilot schedule --disable` (stop polling)
   - `applypilot notifications disable` (no alerts)
   - `applypilot batch-size 28` (disable batching)

---

## 📚 Reading Guide

### **For Architects/Leads**
1. Start: Quick Summary (5 min read)
2. Then: Architecture Diagrams (10 min read)
3. Then: Main Spec - Implementation Phases section (15 min)
4. Reference: Full spec for details as needed

### **For Backend Engineers**
1. Start: Architecture Diagrams (system overview)
2. Then: Main Spec - Your Phase tasks
3. Code: Implementation details in task descriptions
4. Reference: Example code and logs

### **For DevOps Engineers**
1. Start: Architecture Diagrams - Docker/Health sections
2. Then: Main Spec - Phase 5 (Docker, K8s, health checks)
3. Deploy: docker-compose.yml provided
4. Monitor: Health endpoint + status command

### **For QA/Testers**
1. Start: Quick Summary - Success Criteria
2. Then: Main Spec - Edge Cases & Error Handling
3. Test: Implementation tasks have acceptance criteria
4. Validate: 95%+ test pass rate required

---

## 🚀 Next Steps

1. **Review**: Team reviews all 3 spec documents (this week)
2. **Clarify**: Architecture review (with lead architect)
3. **Prioritize**: Confirm task ordering (Phase 4 → Phase 5)
4. **Assign**: Engineers assigned to Phase 4 tasks
5. **Sprint**: Week 1 tasks (P4.1, P4.2, P4.3, P4.4)
6. **Execute**: Implementation begins following this spec
7. **Test**: 95%+ test coverage enforced
8. **Deploy**: Docker image available week 5

---

## 📞 Questions & Clarifications

### **Database Schema**
- Q: Why remove salary from jobs table?
- A: Rarely used, bloats rows, available in job_details if needed

### **Error Handling**
- Q: What if a job fails 3 times (max retries)?
- A: Marked as failed, not retried again (unless user manually retries)

### **Token Efficiency**
- Q: How does pre-scoring work?
- A: Keyword matching locally (no Claude): title contains "python" AND "backend" AND NOT "crypto"

### **Notifications**
- Q: Can I disable notifications?
- A: Yes: `applypilot notifications disable`

### **Docker**
- Q: How are credentials passed to container?
- A: Mounted as read-only volume: `-v ~/.applypilot/credentials:/app/credentials:ro`

---

## 📄 File Locations

All specifications saved in: `/Users/manishslal/Desktop/Coding-Projects/.github/specs/`

- **Main Spec**: `applypilot-phases-4-5-v2-spec.md` (62 KB, 1,897 lines)
- **Quick Summary**: `PHASES-4-5-QUICK-SUMMARY.md` (13 KB, 418 lines)
- **Architecture**: `PHASES-4-5-ARCHITECTURE.md` (40 KB, 653 lines)
- **Index**: `PHASES-4-5-INDEX.md` (this file)

---

## 🎓 Additional Context

### **Relates To**
- Phase 1-2: Core setup, discovery, scoring (completed)
- Phase 3: Scheduling, website registry, credentials (completed ✅)
- Phase 4-5: Error handling, monitoring, Docker (THIS SPEC)
- Phase 6+: Auto-learning, dashboard, multi-account (future)

### **Technology Stack**
- **Language**: Python 3.11+
- **Database**: SQLite (local) with migrations
- **Logging**: Python logging + pythonjsonlogger
- **API**: FastAPI (health checks)
- **Container**: Docker + docker-compose
- **Orchestration**: Kubernetes (optional)
- **Notifications**: Slack Webhook, SMTP (email)

### **Key Decisions Made**
1. ✅ SQLite over PostgreSQL (no server needed)
2. ✅ Immutable application log for audit trail
3. ✅ Batch mode for token efficiency
4. ✅ JSON logging for machine-parsing
5. ✅ Docker for deployment simplicity
6. ✅ HTTP health checks for orchestrators
7. ✅ Exponential backoff for retries
8. ✅ Per-domain rate limit tracking

---

**Version**: 1.0  
**Status**: ✅ COMPLETE & READY FOR IMPLEMENTATION  
**Next Review**: After Phase 4 completion  
**Prepared By**: Lead Product Architect  
**Date**: December 20, 2024
