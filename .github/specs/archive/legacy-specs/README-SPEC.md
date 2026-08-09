# ApplyPilot Improvements - Technical Specification Overview

## 📋 Document Metadata

- **File**: `applypilot-improvements-spec.md`
- **Lines**: 2,464
- **Size**: ~85KB
- **Status**: Ready for Engineering
- **Created**: 2024-12-15

---

## 🎯 What This Spec Covers

### Problem Statement
ApplyPilot requires significant manual setup and cannot run as a background daemon. Users must:
1. Manually configure dependencies during every session
2. Manually run pipeline stages step-by-step
3. Cannot leave the process running hands-off
4. Get confusing errors when dependencies are missing

### Solution Overview
Two major improvements:
1. **Simplified Setup** - One-time setup with dependency detection, diagnostics, and configuration persistence
2. **Hands-Off Mode (Autopilot)** - Continuous daemon that polls job boards, scores jobs, and auto-applies

---

## 📖 How to Use This Spec

### For Project Managers
- See **Executive Summary & Goals** for business objectives
- See **Implementation Phases** for timeline (8 weeks, ~420 story points)
- See **Success Criteria** for how to validate completion

### For Engineering Leads
- See **Functional Requirements** for complete feature specifications
- See **Component Architecture** for system design
- See **Implementation Tasks** for breakdown into actionable items
- See **Security & Compliance** for non-functional requirements

### For Engineers Implementing Each Phase
1. **Phase 1**: Start with `applypilot init` refactoring - see Tasks 1.1-1.5
2. **Phase 2**: Enhance database schema - see Tasks 2.1-2.4
3. **Phase 3**: Build autopilot core - see Tasks 3.1-3.5
4. **Phase 4**: Implement error handling & logging - see Tasks 4.1-4.6
5. **Phase 5**: Add notifications & daemon mode - see Tasks 5.1-5.7

### For QA/Testing
- See **Edge Cases & Error Handling** for comprehensive test scenarios (12 edge cases)
- See **User Flows & Workflows** for E2E test scenarios
- See **Example Workflows** for realistic user stories to validate

---

## 🔑 Key Sections at a Glance

| Section | Purpose | Length |
|---------|---------|--------|
| Executive Summary | High-level goals and success criteria | 1 page |
| Current State Analysis | Identifies 17 pain points in current system | 2 pages |
| Functional Requirements | Complete specification of 2 features (R1.1-R2.7) | 4 pages |
| Implementation Phases | 5 phases over 8 weeks with deliverables | 3 pages |
| Data Schema | 4 new tables + enhanced schema with indexes | 6 pages |
| User Flows | 3 complete workflows with ASCII diagrams | 10 pages |
| API Routes & Contracts | CLI commands, options, output format | 6 pages |
| Edge Cases | 12 edge cases with detection & handling | 20 pages |
| Component Architecture | 11 new components with responsibilities | 12 pages |
| Implementation Tasks | 27 tasks across 5 phases with acceptance criteria | 15 pages |
| Security & Compliance | 8 security considerations | 4 pages |
| Performance & Scalability | Database optimization, caching, monitoring | 4 pages |
| Configuration | 20+ new environment variables | 2 pages |
| Appendix | 3 example user scenarios | 3 pages |

---

## 🚀 Implementation Roadmap

```
Week 1-2: Phase 1 (Init Refactoring) + Phase 2 (Database)
├─ Task 1.1: DependencyDetector
├─ Task 1.2: DiagnosticCheckpoint
├─ Task 1.3: InitState persistence
├─ Task 1.4: Refactor init command
├─ Task 1.5: "Ready to Use" UI
├─ Task 2.1: Add columns to jobs table
├─ Task 2.2: poll_history table
├─ Task 2.3: daemon_state table
└─ Task 2.4: Migration strategy

Week 2-3: Phase 3 (Autopilot Core)
├─ Task 3.1: AutopilotOrchestrator main loop
├─ Task 3.2: Poll cycle pipeline integration
├─ Task 3.3: PollScheduler
├─ Task 3.4: ApplyRateLimiter
└─ Task 3.5: Apply logic

Week 3-4: Phase 4 (Error Handling & Logging)
├─ Task 4.1: RetryOrchestrator
├─ Task 4.2: Error classification
├─ Task 4.3: StructuredLogger (JSON)
├─ Task 4.4: Log rotation
├─ Task 4.5: Logging points
└─ Task 4.6: Health monitoring

Week 4-5: Phase 5 (Notifications & Daemon)
├─ Task 5.1: Slack notifier
├─ Task 5.2: Email notifier
├─ Task 5.3: Notification config
├─ Task 5.4: DaemonManager
├─ Task 5.5: daemon subcommand
├─ Task 5.6: Health check endpoint
└─ Task 5.7: Documentation
```

---

## 💡 Key Design Decisions

### 1. Graceful Tier Degradation
Users without Tier 3 (auto-apply) can still use Tier 1-2 (discovery + scoring).
- **Benefit**: Lowers barrier to entry, everyone gets value
- **Implementation**: SKIP/DEFER options during init

### 2. Persistent Configuration
User profile, resume, and searches saved to `~/.applypilot/` with checksums.
- **Benefit**: One-time setup, users never re-enter data
- **Implementation**: `init-state.json` tracks configuration state

### 3. Structured JSON Logging
All logs in JSON format (one per line) for machine parsing.
- **Benefit**: Integrates with SIEM/monitoring systems
- **Implementation**: Custom logger in `structured_logger.py`

### 4. Error Classification Strategy
Transient errors (network, rate limit) → Retry in next cycle
Non-transient errors (blocked site, invalid URL) → Skip permanently
- **Benefit**: Robust error handling without manual intervention
- **Implementation**: `ErrorClassifier` in `error_handler.py`

### 5. Poll Scheduling with Staggering
Stagger job board polls to avoid thundering herd.
- **Benefit**: Reduces peak load on infrastructure
- **Implementation**: `PollScheduler.stagger_polls()` method

---

## 📊 Complexity & Effort

### By Phase
| Phase | Tasks | Story Points | Duration |
|-------|-------|--------------|----------|
| 1: Init Refactoring | 5 | ~60 | 2 weeks |
| 2: Database | 4 | ~30 | 1 week (parallel) |
| 3: Autopilot Core | 5 | ~100 | 2 weeks |
| 4: Error & Logging | 6 | ~120 | 2 weeks |
| 5: Notifications & Daemon | 7 | ~110 | 1-2 weeks |
| **Total** | **27** | **~420** | **~8 weeks** |

### By Complexity
| Complexity | Count | Examples |
|-----------|-------|----------|
| Small | 8 | LogRotation, InitState, ApiKeyCache |
| Medium | 12 | DependencyDetector, PollScheduler, Slack |
| Large | 7 | AutopilotOrchestrator, Logging points, Init refactor |

---

## 🔒 Security Highlights

✅ **API Key Management**: Early validation, never logged
✅ **Data Protection**: Resume validation prevents hallucination
✅ **Audit Trail**: Structured logging for compliance
✅ **Rate Limiting**: Prevents IP blocking
✅ **CAPTCHA Ethics**: Detects but never bypasses
✅ **Network Security**: HTTPS only, SSL validation
✅ **File Permissions**: 0700 for `~/.applypilot/`, 0600 for `.env`

---

## 📈 Performance Optimizations

✅ **Database**: 6 new indexes for query performance
✅ **Caching**: API key validation cached for 1 hour
✅ **Deduplication**: In-memory set of URLs during discovery
✅ **Batch Operations**: 100 jobs per transaction
✅ **Health Monitoring**: Memory limit 500MB, CPU limit 50%
✅ **Log Rotation**: Daily rotation, max 7 days, 500MB limit
✅ **Rate Limiting**: 2 apps/min, configurable

---

## 🧪 Testing Strategy

### Unit Tests
- All new components have unit tests
- Error classification, retry logic, scheduling

### Integration Tests
- Database schema migrations
- Pipeline integration with autopilot options
- Notification delivery (mock webhooks)

### E2E Tests
- Full poll cycle (discover → enrich → score → tailor → apply)
- Error recovery (transient + non-transient)
- Daemon start/stop/status lifecycle
- 2+ poll cycles to verify scheduling

### Edge Case Coverage
12 documented edge cases with specific handling:
1. API key expiration/rate limit
2. CAPTCHA encountered
3. Already applied (dedup)
4. Job closed
5. Network failure
6. Retry exhaustion
7. Resume generation fails
8. Poll cycle time exceeded
9. Site authentication blocked
10. Memory/CPU exhaustion
11. Duplicate URLs
12. Validation failure

---

## 📚 Components Overview

### 11 New Components

| Component | Purpose | File |
|-----------|---------|------|
| **DependencyDetector** | Detect Python, Node, Chrome, Claude CLI, API keys | `wizard/dependency_detector.py` |
| **DiagnosticCheckpoint** | Validate config and run pre-flight checks | `wizard/diagnostic_checkpoint.py` |
| **InitState** | Persist init metadata across reruns | `config/init_state.py` |
| **AutopilotOrchestrator** | Main event loop for continuous polling | `autopilot/orchestrator.py` |
| **PollScheduler** | Track poll times, stagger polls, dedup | `autopilot/poll_scheduler.py` |
| **ApplyRateLimiter** | Throttle applications to avoid blocking | `autopilot/rate_limiter.py` |
| **DaemonManager** | Fork, detach, PID management | `autopilot/daemon_manager.py` |
| **RetryOrchestrator** | Exponential backoff retry logic | `autopilot/retry_orchestrator.py` |
| **StructuredLogger** | JSON-formatted logging | `autopilot/structured_logger.py` |
| **SlackNotifier** | Send Slack messages | `autopilot/notifications/slack.py` |
| **HealthMonitor** | Track memory, CPU, uptime | `autopilot/health_monitor.py` |

---

## 🎬 Getting Started

### For Code Review
1. Read **Executive Summary** (understand goals)
2. Read **Current State Analysis** (understand problems)
3. Read **Functional Requirements** (understand features)
4. Read **Data Schema** (understand persistence)

### For Implementation
1. Start with **Implementation Tasks** (Task 1.1-1.5)
2. Reference **User Flows** for context
3. Check **Edge Cases** relevant to your task
4. Verify **Acceptance Criteria** before marking complete

### For Testing
1. Read **Edge Cases & Error Handling** (12 scenarios)
2. Read **User Flows** (3 E2E workflows)
3. Read **Example Workflows** (realistic usage)
4. Create tests covering all scenarios

---

## 📞 Document Navigation

- **Architecture Questions?** → See "Component Architecture"
- **What needs to be built?** → See "Functional Requirements"
- **When's it due?** → See "Implementation Phases"
- **How do we validate?** → See "Success Criteria" + "Edge Cases"
- **How should it work?** → See "User Flows & Workflows"
- **What could go wrong?** → See "Edge Cases & Error Handling"
- **How do we keep it secure?** → See "Security & Compliance"
- **Will it scale?** → See "Performance & Scalability"

---

## ✅ Quality Checklist

Before engineering starts:

- ✓ All requirements are clear and unambiguous
- ✓ Data schema supports all features
- ✓ API design is consistent and RESTful
- ✓ User flows cover happy path and error cases
- ✓ 12 edge cases documented with handling
- ✓ 27 implementation tasks with acceptance criteria
- ✓ 11 components with clear responsibilities
- ✓ 8-week timeline with phase dependencies
- ✓ Security considerations addressed
- ✓ Performance strategies defined

---

**Last Updated**: 2024-12-15
**Status**: Ready for Engineering
**Distribution**: Engineering Team, Project Managers, QA
