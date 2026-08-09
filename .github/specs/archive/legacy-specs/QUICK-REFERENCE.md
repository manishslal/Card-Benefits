# Quick Reference Checklist

## For Different Stakeholders

### 📊 Project Manager
- [ ] Read: Executive Summary (Goals & Success Criteria)
- [ ] Read: Implementation Phases (Timeline & Effort)
- [ ] Note: ~8 weeks, ~420 story points, 5 phases
- [ ] Key risk: Complex error handling for autopilot daemon
- [ ] Key dependency: Phase 2 (DB) runs parallel with Phase 1

### 🏗️ Tech Lead
- [ ] Read: Functional Requirements (R1.1-R2.7)
- [ ] Read: Component Architecture (11 new components)
- [ ] Read: Data Schema (4 new tables, 6 indexes)
- [ ] Review: Implementation Tasks (27 tasks)
- [ ] Assign: Phase 1 team for init refactoring
- [ ] Assign: Phase 2 team for database changes (parallel)

### 👨‍💻 Backend Engineer (Autopilot Core - Phase 3-4)
- [ ] Read: Functional Requirements R2.1-R2.7
- [ ] Read: User Flows (Autopilot workflow diagram)
- [ ] Read: Component Architecture (AutopilotOrchestrator, etc.)
- [ ] Focus Tasks:
  - Task 3.1: AutopilotOrchestrator main loop
  - Task 3.2: Poll cycle integration
  - Task 4.1: RetryOrchestrator
  - Task 4.3: StructuredLogger
- [ ] Review: Edge Cases (12 scenarios)

### 🗄️ Database Engineer (Phase 2)
- [ ] Read: Data Schema section
- [ ] Understand: 4 new tables (poll_history, daemon_state, api_key_cache)
- [ ] Understand: 6 new indexes on jobs table
- [ ] Tasks:
  - Task 2.1: Add poll/apply columns
  - Task 2.2: Create poll_history table
  - Task 2.3: Create daemon_state table
  - Task 2.4: Migration strategy
- [ ] Validate: WAL mode, batch operations, index usage

### 🔐 Security Engineer
- [ ] Read: Security & Compliance (8 considerations)
- [ ] Review: API Key Management handling
- [ ] Review: Resume validation (prevent hallucination)
- [ ] Review: Audit logging (JSON structured logs)
- [ ] Review: CAPTCHA handling (never bypass)
- [ ] Check: File permissions (0700 for .applypilot, 0600 for .env)
- [ ] Check: Network security (HTTPS only, SSL validation)

### 🧪 QA / Test Engineer
- [ ] Read: Edge Cases & Error Handling (12 scenarios)
- [ ] Read: User Flows & Workflows (3 E2E paths)
- [ ] Review: Implementation Tasks (acceptance criteria)
- [ ] Plan Test Scenarios:
  - [ ] Setup scenarios (first-time, reconfigure)
  - [ ] Autopilot daemon lifecycle
  - [ ] Poll cycles and job discovery
  - [ ] Error recovery paths
  - [ ] Notification delivery
  - [ ] Memory/resource limits
- [ ] Create Test Cases for:
  - [ ] Each of 12 edge cases
  - [ ] All 3 user workflows
  - [ ] Daemon start/stop/status
  - [ ] Log rotation and retention

### 🐳 DevOps / Infrastructure
- [ ] Read: Appendix (Docker setup guide, systemd template)
- [ ] Read: Performance & Scalability (memory limits, health checks)
- [ ] Setup:
  - [ ] Docker Compose file for autopilot
  - [ ] Systemd service unit file
  - [ ] Health check endpoint (/health on port 8000)
  - [ ] Resource limits (500MB memory, 50% CPU)
  - [ ] Log rotation (daily, 7-day retention)
- [ ] Monitor:
  - [ ] Memory usage (alert at 500MB, cleanup at 1GB)
  - [ ] CPU usage (alert at 50%)
  - [ ] Process uptime and restarts

### 📚 Documentation Writer
- [ ] Create: User setup guide (Simplified Init section)
- [ ] Create: Autopilot usage guide (User Flows & Workflows)
- [ ] Create: Troubleshooting guide (Edge Cases & Error Handling)
- [ ] Create: Configuration reference (20+ env variables)
- [ ] Create: Docker deployment guide
- [ ] Create: Systemd daemon setup guide
- [ ] Create: Notification setup (Slack/email)

---

## Critical Path Tasks (Do These First)

### Week 1: Planning & Foundation
- [ ] Phase 1 team kickoff (init refactoring)
- [ ] Phase 2 team kickoff (database) - run in parallel
- [ ] Review spec sections relevant to your role
- [ ] Set up development environment
- [ ] Create GitHub issues from implementation tasks

### Weeks 2-3: Implementation Phases 1-2 + Start Phase 3
- [ ] Phase 1: DependencyDetector, DiagnosticCheckpoint, InitState, init refactor
- [ ] Phase 2: Database schema, new tables, indexes, migrations
- [ ] Phase 3: Start AutopilotOrchestrator, PollScheduler, ApplyRateLimiter

### Weeks 3-4: Phase 3 Completion + Phase 4 Start
- [ ] Phase 3: Complete all autopilot core components
- [ ] Phase 4: Retry logic, error classification, logging

### Weeks 4-5: Phases 4-5
- [ ] Phase 4: Complete logging, health monitoring
- [ ] Phase 5: Slack/email notifications, daemon mode, Docker

---

## Spec Navigation Map

| Need to know... | Go to... |
|-----------------|----------|
| What are we building? | Executive Summary |
| Why do we need this? | Current State Analysis |
| What exactly needs to be built? | Functional Requirements |
| How do we break it down? | Implementation Phases |
| What data model do we need? | Data Schema |
| How will users interact with it? | User Flows & Workflows |
| What are the API contracts? | API Routes & Contracts |
| What could go wrong? | Edge Cases & Error Handling |
| What's the architecture? | Component Architecture |
| What specific work needs to be done? | Implementation Tasks |
| What are the risks? | Security & Compliance, Performance & Scalability |
| How long will this take? | Implementation Phases, Implementation Tasks (effort estimates) |
| Can you give me an example? | Appendix: Example Workflows |

---

## Key Metrics

- **Scope**: 2 major features, 12 requirements, 11 components, 27 tasks
- **Timeline**: ~8 weeks across 5 phases
- **Effort**: ~420 story points total
- **Database**: 4 new tables, 6 new indexes
- **Code**: 11 new components to build
- **Testing**: 12 edge cases, 3 E2E workflows
- **Configuration**: 20+ new environment variables
- **Risk**: Daemon reliability, error handling complexity

---

## Acceptance Criteria Highlights

### Simplified Setup (Phase 1)
- [ ] Users see dependency report during init
- [ ] Users can SKIP/DEFER Tier 3 features
- [ ] Diagnostic checkpoint validates config
- [ ] Configuration persists across reruns
- [ ] API keys tested early with helpful error messages
- [ ] Setup completes in <5 minutes (first-time users)

### Autopilot (Phases 3-5)
- [ ] Polls job boards every N hours (configurable)
- [ ] Auto-applies to jobs scoring ≥ threshold
- [ ] Runs as background daemon with PID tracking
- [ ] Logs all activity in JSON format (structured)
- [ ] Sends optional Slack/email notifications
- [ ] Can run for weeks without manual intervention
- [ ] Gracefully handles network failures, rate limits, CAPTCHA
- [ ] Health checks prevent memory exhaustion

---

## Files to Create/Modify

### New Files
- `src/applypilot/wizard/dependency_detector.py`
- `src/applypilot/wizard/diagnostic_checkpoint.py`
- `src/applypilot/config/init_state.py`
- `src/applypilot/autopilot/orchestrator.py`
- `src/applypilot/autopilot/poll_scheduler.py`
- `src/applypilot/autopilot/rate_limiter.py`
- `src/applypilot/autopilot/daemon_manager.py`
- `src/applypilot/autopilot/retry_orchestrator.py`
- `src/applypilot/autopilot/structured_logger.py`
- `src/applypilot/autopilot/health_monitor.py`
- `src/applypilot/autopilot/notifications/slack.py`
- `src/applypilot/autopilot/notifications/email.py`

### Modified Files
- `src/applypilot/cli.py` (add new commands & options)
- `src/applypilot/database.py` (schema enhancements)
- `src/applypilot/config.py` (new env variables)
- `src/applypilot/wizard/init.py` (refactored workflow)
- `src/applypilot/apply/launcher.py` (graceful error handling)

### Documentation
- `docs/docker.md` (Docker setup guide)
- `systemd/applypilot-daemon.service` (systemd template)
- User guides for setup, autopilot, troubleshooting

---

## Success Criteria for Phase Completion

### Phase 1 Complete When:
- [ ] Init command detects dependencies automatically
- [ ] Users can complete init in < 5 minutes
- [ ] Config persists and survives reruns
- [ ] API keys validated with helpful errors
- [ ] Deferred features show clear setup instructions

### Phase 2 Complete When:
- [ ] All 4 new tables created
- [ ] All 6 indexes added to jobs table
- [ ] Migrations tested on existing databases
- [ ] Schema queries return results efficiently

### Phase 3 Complete When:
- [ ] Autopilot command exists and runs continuously
- [ ] Jobs polled, scored, and applied in loop
- [ ] Poll scheduling works (staggered per site)
- [ ] Rate limiting prevents application spam
- [ ] Daemon PID file tracking works

### Phase 4 Complete When:
- [ ] All errors classified (transient vs non-transient)
- [ ] Transient errors retried with backoff
- [ ] Non-transient errors skipped permanently
- [ ] JSON logs written to timestamped file
- [ ] Log rotation and compression working
- [ ] Health monitoring tracks memory/CPU

### Phase 5 Complete When:
- [ ] Slack notifications sent on job matches
- [ ] Email notifications sent (SMTP working)
- [ ] Daemon subcommands work (status, stop, logs)
- [ ] Docker setup guide complete
- [ ] Systemd service file template provided
- [ ] Health check endpoint responds on port 8000

---

## Risk Mitigation

### High Risk: Daemon Reliability
- **Risk**: Process crashes, hangs, or accumulates memory
- **Mitigation**: Health checks every poll cycle, memory alerts, cleanup triggers
- **Testing**: Long-running E2E tests (48+ hours), monitor resource usage

### High Risk: Error Handling Complexity
- **Risk**: Unhandled edge cases, infinite retry loops, data corruption
- **Mitigation**: 12 edge cases documented with specific handling, retry limits, validation
- **Testing**: Unit tests for each error type, integration tests for combined scenarios

### Medium Risk: Database Migrations
- **Risk**: Schema changes break existing installations
- **Mitigation**: Migration script tested on real databases, rollback plan
- **Testing**: Test upgrade from v1 to v2 schema

### Medium Risk: Rate Limiting & IP Blocking
- **Risk**: Job boards block ApplyPilot IPs or API, affecting all users
- **Mitigation**: Respect rate-limit headers, implement backoff, domain rotation
- **Testing**: Test rate limit scenarios (429 responses)

### Medium Risk: Notification Delivery
- **Risk**: Slack/email delivery fails, user misses important notifications
- **Mitigation**: Retry notification delivery, log failures, provide fallback
- **Testing**: Test with mock webhooks and SMTP servers

---

## Dependencies & Blockers

### No Blockers (Can Start Immediately)
- Phase 1 (init refactoring) - no dependencies
- Phase 2 (database) - no dependencies

### Phase 3 Depends On
- Phase 1 (init) - for configuration loading
- Phase 2 (database) - for schema and indexes

### Phase 4 Depends On
- Phase 3 (autopilot core) - to wrap with error handling

### Phase 5 Depends On
- Phase 4 (logging) - for structured logs in daemon
- Phase 3 (autopilot) - for core orchestration

---

## Questions to Ask

- [ ] Who is the first user to pilot this? (identify UX feedback)
- [ ] What's the SLA for error recovery? (how fast should retries happen?)
- [ ] Do we need multi-tenant daemon support? (one daemon per user or shared?)
- [ ] What's the budget for external CAPTCHA solving? (should we implement it?)
- [ ] Should we support Windows or just Unix/Mac/Linux?
- [ ] Do we need Prometheus metrics for monitoring? (or just logs?)

---

**Last Updated**: 2024-12-15
**Audience**: All stakeholders
**Next Action**: Print this, choose your role, start reading the sections marked for you!
