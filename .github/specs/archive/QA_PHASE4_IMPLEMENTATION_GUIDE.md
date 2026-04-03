# Phase 4 Implementation Guide - Approved for Development

**Approval Date:** April 2, 2026
**QA Status:** ✅ APPROVED
**Ready for Assignment:** YES

---

## IMPLEMENTATION PHASE OVERVIEW

Phase 4 adds four major features to the Card Benefits Tracker:
1. **CSV/XLSX Import/Export** - Bulk data management
2. **Custom Benefit Values** - User-defined valuations
3. **Card Management UI** - Full CRUD interface
4. **Email Alerts** - Proactive notifications

**Total Effort:** 177-214 hours | **Duration:** 2-3 weeks | **Team:** 2-3 developers

---

## PRE-IMPLEMENTATION TASKS (Days 1-2)

### Task 1: Environment & Dependencies
**Owner:** Infrastructure Lead | **Time:** 2-3 hours

**What to do:**
- [ ] Install Redis (or set up in-memory caching)
  ```bash
  npm install redis
  npm install ioredis  # or use in-memory alternative
  ```
- [ ] Install email service SDK
  ```bash
  npm install @sendgrid/mail
  # OR
  npm install @aws-sdk/client-ses
  ```
- [ ] Install timezone utilities
  ```bash
  npm install date-fns-tz iana-tz-database
  ```
- [ ] Install testing utilities for DST
  ```bash
  npm install --save-dev vitest
  ```
- [ ] Configure environment variables
  ```bash
  SENDGRID_API_KEY=your_key_here
  REDIS_URL=redis://localhost:6379
  TIMEZONE_DB_PATH=/path/to/iana/database
  ```

**Verify:**
- [ ] `npm test` runs without errors
- [ ] Redis connects successfully
- [ ] Email service SDK imports without errors
- [ ] Timezone library loads IANA database

---

### Task 2: Database Migrations
**Owner:** Database Lead | **Time:** 3-4 hours

**What to do:**
- [ ] Create migration files for Phase 4 tables
  ```bash
  npx prisma migrate create init_phase4
  ```
- [ ] Add new schema to `prisma/schema.prisma`:
  ```
  NEW FIELDS IN EXISTING TABLES:
  - UserCard.status (ACTIVE | PENDING | PAUSED | ARCHIVED | DELETED)
  - UserCard.archivedBy, archivedReason, archivedAt
  - UserBenefit.userDeclaredValue
  - UserBenefit.valueHistory (JSON)
  - UserBenefit.valueUpdatedAt
  - User.timezone (default: "UTC")

  NEW TABLES:
  - ImportJob (tracks import operations)
  - ImportRecord (per-record audit trail)
  - UserEmailPreference (user email settings)
  - SentAlert (audit trail of sent emails)
  - AlertQueue (pending alerts)
  ```
- [ ] Generate Prisma client
  ```bash
  npx prisma generate
  ```
- [ ] Create seed data for testing
  ```bash
  npx prisma db seed
  ```

**Verify:**
- [ ] Schema validates without errors
- [ ] Migrations can be applied to test database
- [ ] Prisma client generated successfully
- [ ] Seed data created

**Reference:** See SPEC_PHASE4_CARD_MANAGEMENT.md Section "Data Schema" for complete schema

---

### Task 3: Team Training
**Owner:** Tech Lead | **Time:** 3-4 hours

**What to do:**
- [ ] Schedule spec review session
  - Duration: 2-3 hours
  - Attendees: All developers, QA leads
  - Agenda: Overview of Phase 4 features and QA amendments

- [ ] Share documentation
  - Distribute: `SPEC_PHASE4_SECURITY_AMENDMENTS.md` (read first)
  - Distribute: Feature-specific specs
  - Distribute: `SPEC_PHASE4_QA_AMENDMENTS_SUMMARY.md`

- [ ] Create architecture diagram
  - Show: How Phase 4 features connect to Phase 1-3
  - Show: External dependencies (Redis, email service)
  - Show: Database relationships

- [ ] Establish coding standards
  - Use: Existing patterns from Phase 1-3
  - No deviations without approval
  - Code review process: Same as Phase 1-3

**Verify:**
- [ ] All developers understand Phase 4 requirements
- [ ] All developers have QA amendment summary
- [ ] Team agrees on architecture approach
- [ ] Code review process understood

---

## FEATURE IMPLEMENTATION ROADMAP

### Week 1: Foundations & Core Features

#### Days 1-2: Database & Authorization

**Task A1.1: Finalize Database Setup**
- Owner: Database Lead
- Time: 3-4 hours
- Deliverable: Schema applied to dev/test databases
- Checklist:
  - [ ] All migrations applied
  - [ ] Seed data populated
  - [ ] Indices created for performance
  - [ ] Backup of schema documented

**Task A1.2: Authorization Utilities**
- Owner: Backend Lead (may be Phase 1 carryover)
- Time: 2-3 hours
- Reference: SPEC_PHASE4_SECURITY_AMENDMENTS.md Section 5
- Deliverable: Authorization functions in `src/lib/auth-server.ts`
- Required Functions:
  ```typescript
  authorizeCardImport(user, targetPlayer, source)
  authorizeBenefitEdit(user, benefit, operation)
  authorizeEmailPreferencesModification(user, targetPlayer)
  authorizeCardArchival(user, card, isDelete)
  ```
- Checklist:
  - [ ] All functions implemented
  - [ ] Unit tests for each function
  - [ ] Role-based matrix tests (5 roles × 10+ operations)
  - [ ] Multi-player household tests

---

#### Days 3-4: Timezone & ROI Infrastructure

**Task A1.3: Timezone Utilities**
- Owner: Backend Lead
- Time: 4-5 hours
- Reference: SPEC_PHASE4_SECURITY_AMENDMENTS.md Section 3
- Deliverable: Timezone functions in `src/lib/timezone-utils.ts`
- Required Functions:
  ```typescript
  convertToUserTimezone(utcTime, userTimezone)
  formatAlertTimeForUser(utcTime, userTimezone)
  calculateRenewalCountdown(renewalDate, userTimezone)
  handleDSTTransition(scheduledTime, timezone)
  ```
- Checklist:
  - [ ] All timezone functions implemented
  - [ ] DST tests for 5+ timezones
  - [ ] Spring forward transition handled
  - [ ] Fall back transition handled
  - [ ] Timezone change alert recalculation tested

**Task A1.4: ROI Caching Layer**
- Owner: Backend Lead
- Time: 3-4 hours
- Reference: SPEC_PHASE4_CUSTOM_VALUES.md Section "ROI Recalculation"
- Deliverable: Caching service in `src/lib/roi-cache.ts`
- Required Functions:
  ```typescript
  getCachedBenefitROI(benefitId)
  getCachedCardROI(cardId)
  getCachedPlayerROI(playerId)
  invalidateBenefitCache(benefitId)
  invalidateCardCache(cardId)
  // ... other invalidation triggers
  ```
- Checklist:
  - [ ] Redis/in-memory cache configured
  - [ ] 5-minute TTL implemented
  - [ ] Invalidation triggers cover all operations
  - [ ] Performance tests pass (<100ms benefit, <300ms household)

---

#### Days 5: Testing Infrastructure

**Task A1.5: Test Utilities & Fixtures**
- Owner: QA Lead
- Time: 3-4 hours
- Deliverable: Test utilities in `src/__tests__/utils/`
- Required Utilities:
  ```typescript
  createTestUser(role, timezone)
  createTestCard(data)
  createTestBenefit(data)
  mockTimezone(tz, callback)
  mockDSTTransition(date, tz)
  mockEmailService()
  ```
- Checklist:
  - [ ] All fixtures created
  - [ ] Mock services working
  - [ ] Timezone mocking verified
  - [ ] Sample test data documented

---

### Week 2: Core Features

#### Days 1-3: CSV/XLSX Import/Export

**Task B2.1: File Parsing & Validation**
- Owner: Backend Developer
- Time: 8-10 hours
- Reference: SPEC_PHASE4_IMPORT_EXPORT.md Section "Functional Requirements"
- Deliverable: Import service in `src/actions/import.ts`
- Requirements:
  - CSV and XLSX file support
  - File size validation (50MB max)
  - Magic bytes validation (not extension)
  - Streaming parser for large files
  - Column mapping (auto-detection + user override)
- Checklist:
  - [ ] CSV parsing implemented
  - [ ] XLSX parsing implemented
  - [ ] File size validation working
  - [ ] Magic bytes validation implemented
  - [ ] Column auto-detection algorithm working
  - [ ] 10+ unit tests for parsing
  - [ ] 5+ integration tests for validation
  - [ ] Load test: 10K records < 30s

**Task B2.2: Duplicate Detection & Resolution**
- Owner: Backend Developer
- Time: 6-8 hours
- Reference: SPEC_PHASE4_SECURITY_AMENDMENTS.md Section 6
- Deliverable: Duplicate service in `src/lib/duplicate-detection.ts`
- Requirements:
  - Exact matching for cards (same mastercardId + player)
  - Exact matching for benefits (normalized name + card)
  - Confidence scoring for fuzzy matching
  - Resolution strategies: Skip, Update, Merge
- Checklist:
  - [ ] Card duplicate detection implemented
  - [ ] Benefit duplicate detection implemented
  - [ ] Normalization algorithm tested
  - [ ] All resolution strategies implemented
  - [ ] 15+ unit tests for duplicates
  - [ ] 10+ tests for merge logic

**Task B2.3: Import Rollback & Conflict Handling**
- Owner: Backend Developer
- Time: 5-6 hours
- Reference: SPEC_PHASE4_IMPORT_EXPORT.md Section "Rollback Mechanism"
- Deliverable: Transaction management in import service
- Requirements:
  - Transaction-based rollback
  - Orphaned record cleanup
  - Conflict detection (version numbers)
  - Last-Write-Wins resolution
- Checklist:
  - [ ] Transaction handling implemented
  - [ ] Rollback on errors working
  - [ ] Orphaned record cleanup tested
  - [ ] Conflict detection tested
  - [ ] 8+ tests for rollback scenarios
  - [ ] Concurrent update tests

**Task B2.4: Import/Export UI Wizard**
- Owner: Frontend Developer
- Time: 8-10 hours
- Reference: SPEC_PHASE4_IMPORT_EXPORT.md Section "User Flows"
- Deliverable: Components in `src/app/components/import-export/`
- Components:
  - ImportWizard (5-step flow)
  - FileUploadStep
  - ColumnMappingStep
  - PreviewStep
  - DuplicateResolverStep
  - ConfirmationStep
  - ExportDialog
- Checklist:
  - [ ] All wizard steps implemented
  - [ ] File upload working
  - [ ] Column mapping UI working
  - [ ] Preview with table display
  - [ ] Duplicate conflict UI
  - [ ] Export dialog implemented
  - [ ] 10+ integration tests

---

#### Days 4-5: Card Management Display & Basic CRUD

**Task B2.5: Card Display Views**
- Owner: Frontend Developer
- Time: 6-8 hours
- Reference: SPEC_PHASE4_CARD_MANAGEMENT.md Section "Card Discovery & Display"
- Deliverable: Components in `src/app/components/cards/`
- Components:
  - CardGrid (grid view with tiles)
  - CardList (list view with sortable columns)
  - CardCompact (minimal view)
  - CardTile (individual card design)
- Checklist:
  - [ ] Grid view implemented
  - [ ] List view implemented
  - [ ] Responsive design (mobile, tablet, desktop)
  - [ ] Sorting implemented
  - [ ] 10+ unit tests for components
  - [ ] E2E test for card display

**Task B2.6: Card CRUD Operations**
- Owner: Backend Developer
- Time: 6-8 hours
- Reference: SPEC_PHASE4_CARD_MANAGEMENT.md Section "Card Operations"
- Deliverable: Actions in `src/actions/cards.ts`
- Operations:
  - addCard (with validation)
  - editCard (field-specific updates)
  - archiveCard (soft delete)
  - unarchiveCard
  - deleteCard (permanent, with confirmation)
  - bulkArchive
  - bulkDelete
- Checklist:
  - [ ] All CRUD operations implemented
  - [ ] Authorization checks on each
  - [ ] State machine transitions validated
  - [ ] 12+ unit tests
  - [ ] 8+ authorization tests

---

### Week 3: Advanced Features

#### Days 1-3: Email Alerts System

**Task C3.1: Email Infrastructure & Service**
- Owner: Backend Developer
- Time: 6-8 hours
- Reference: SPEC_PHASE4_EMAIL_ALERTS.md Section "Email Delivery & Service"
- Deliverable: Email service in `src/lib/email-service.ts`
- Requirements:
  - SendGrid/SES integration
  - Email template rendering
  - Bounce handling
  - Delivery tracking
  - Test email capability
  - Staging vs. production config
- Checklist:
  - [ ] SendGrid/SES SDK integrated
  - [ ] Email sending working
  - [ ] Bounce webhook handling
  - [ ] Test email feature
  - [ ] Staging environment separate
  - [ ] 6+ integration tests

**Task C3.2: Alert Detection & Scheduling**
- Owner: Backend Developer
- Time: 8-10 hours
- Reference: SPEC_PHASE4_EMAIL_ALERTS.md Section "Alert Detection & Scheduling"
- Deliverable: Alert services in `src/services/alerts/`
- Detectors:
  - BenefitExpirationAlertDetector
  - CardRenewalAlertDetector
  - AnnualFeeAlertDetector
  - OptimizationOpportunityDetector
  - DigestEmailDetector
- Checklist:
  - [ ] All alert types detecting correctly
  - [ ] Timezone-aware scheduling
  - [ ] Deduplication working
  - [ ] Batching logic correct
  - [ ] 15+ tests for alert logic
  - [ ] Load test: 1000 users < 5min

**Task C3.3: Email Preferences UI**
- Owner: Frontend Developer
- Time: 5-6 hours
- Reference: SPEC_PHASE4_EMAIL_ALERTS.md Section "User Preferences"
- Deliverable: Components in `src/app/components/email-preferences/`
- Components:
  - EmailPreferencesForm
  - AlertTypeToggle
  - TimingSelector
  - FrequencySelector
  - TestEmailButton
  - UnsubscribeConfirmation
- Checklist:
  - [ ] All preferences settable
  - [ ] Form validation working
  - [ ] Test email sending
  - [ ] Unsubscribe page functional
  - [ ] 8+ tests for UI

---

#### Days 4-5: Custom Benefit Values

**Task C3.4: Value Editing UI**
- Owner: Frontend Developer
- Time: 5-6 hours
- Reference: SPEC_PHASE4_CUSTOM_VALUES.md Section "Functional Requirements"
- Deliverable: Components in `src/app/components/benefits/`
- Components:
  - EditableValueField
  - BenefitValueComparison
  - BenefitValuePresets
  - ValueHistoryPopover
- Checklist:
  - [ ] Inline editing working
  - [ ] Auto-save on blur
  - [ ] Preset buttons functional
  - [ ] Value history displayed
  - [ ] 8+ tests for editing

**Task C3.5: ROI Recalculation Integration**
- Owner: Backend Developer
- Time: 4-5 hours
- Reference: SPEC_PHASE4_CUSTOM_VALUES.md Section "ROI Recalculation on Change"
- Deliverable: ROI update logic in `src/actions/benefits.ts`
- Requirements:
  - Update custom value
  - Trigger ROI recalculation at all 4 levels
  - Invalidate caches
  - Return updated calculations
- Checklist:
  - [ ] Value update working
  - [ ] ROI recalculation correct
  - [ ] Cache invalidation triggered
  - [ ] Performance < 300ms for household
  - [ ] 6+ tests for recalculation
  - [ ] 4+ tests for caching

---

### Week 4: Testing & Deployment

#### Days 1-2: Comprehensive Testing

**Task D4.1: Unit Test Coverage**
- Owner: QA Engineer
- Time: 8-10 hours
- Target: 80%+ coverage on all files
- Test Categories:
  - Authorization (50+ tests)
  - Timezone/DST (30+ tests)
  - ROI calculation (25+ tests)
  - Duplicate detection (20+ tests)
  - Import/export parsing (40+ tests)
  - Email logic (30+ tests)
- Checklist:
  - [ ] 80%+ code coverage achieved
  - [ ] All edge cases tested
  - [ ] Error paths tested
  - [ ] Coverage report generated

**Task D4.2: Integration Testing**
- Owner: QA Engineer
- Time: 6-8 hours
- Workflows:
  - Full import → duplicate → rollback
  - Email preference → alert delivery
  - Card CRUD with state machine
  - Custom value → ROI update
- Checklist:
  - [ ] All workflows tested
  - [ ] Database interactions verified
  - [ ] Auth enforcement tested
  - [ ] Error recovery tested

**Task D4.3: E2E Testing**
- Owner: QA Engineer
- Time: 5-6 hours
- Critical Paths:
  - User imports CSV file
  - User customizes benefit value
  - User manages card (add/edit/archive)
  - User receives email alert
- Checklist:
  - [ ] All critical paths passing
  - [ ] Mobile responsive
  - [ ] Error handling verified

---

#### Days 3-4: Performance & Security Audit

**Task D4.4: Performance Testing**
- Owner: QA Engineer
- Time: 4-5 hours
- Load Tests:
  - Import 10K records < 30s
  - Export 1K records < 10s
  - ROI calculation < 300ms
  - Email generation 1000 users < 5min
- Checklist:
  - [ ] All targets met
  - [ ] No N+1 queries
  - [ ] Memory usage acceptable
  - [ ] CPU usage acceptable

**Task D4.5: Security Audit**
- Owner: Security Engineer
- Time: 4-6 hours
- Audits:
  - Authorization (all roles × operations)
  - Input validation (injection tests)
  - Token security (unsubscribe tokens)
  - Data protection (encryption, HTTPS)
  - Audit logging (all sensitive operations)
- Checklist:
  - [ ] No authorization bypasses
  - [ ] No injection vulnerabilities
  - [ ] Tokens secure and single-use
  - [ ] GDPR compliant
  - [ ] Security audit passed

---

#### Day 5: Final Testing & Deployment Prep

**Task D4.6: Bug Fixes & Polish**
- Owner: All developers
- Time: 4-6 hours
- Activities:
  - Fix reported bugs
  - Polish UI
  - Optimize performance
  - Update documentation
- Checklist:
  - [ ] All critical bugs fixed
  - [ ] No medium-severity bugs
  - [ ] UI polished
  - [ ] Docs updated

**Task D4.7: Deployment Preparation**
- Owner: DevOps Lead
- Time: 2-3 hours
- Checklist:
  - [ ] Database migrations ready
  - [ ] Environment variables configured
  - [ ] Email service credentials set
  - [ ] Redis configured
  - [ ] Deployment scripts tested
  - [ ] Rollback procedure documented
  - [ ] Monitoring set up

---

## CRITICAL SUCCESS FACTORS

### 1. Authorization on All Operations ✅

**Critical Rule:** Every mutation must verify the user owns the affected data.

**Checklist for each feature:**
- [ ] getAllCards: Only user's cards
- [ ] importCards: User can only import to own wallet
- [ ] archiveCard: User owns card or is Owner
- [ ] setCustomValue: User owns benefit
- [ ] updateEmailPreferences: Own preferences only
- [ ] deleteCard: Owner confirmation required

**Code Review Gate:** No PR merged without authorization checks.

### 2. Timezone Handling in Email Alerts ✅

**Critical Rule:** All alert times stored in UTC, displayed in user's timezone.

**Implementation checklist:**
- [ ] User.timezone = IANA format (e.g., "America/New_York")
- [ ] UserEmailPreference.timezone = IANA format
- [ ] Alert scheduled_at = UTC timestamp
- [ ] Display converts UTC → user timezone
- [ ] DST transitions tested (spring forward + fall back)
- [ ] Timezone change recalculates pending alerts

**Code Review Gate:** Timezone bugs are P0.

### 3. Duplicate Detection Exact Matching ✅

**Critical Rule:** Use exact matching (not fuzzy) for production duplicates.

**Implementation checklist:**
- [ ] Card duplicates: Same mastercardId + same player
- [ ] Benefit duplicates: Normalized name + same card
- [ ] Normalization: lowercase + trim + collapse whitespace
- [ ] Resolution UI shows: Skip, Update, Merge options
- [ ] User explicitly chooses action

**Code Review Gate:** Duplicate logic must match specification exactly.

### 4. State Machine Validation ✅

**Critical Rule:** Only allow valid card status transitions.

**Implementation checklist:**
- [ ] Card status enum: ACTIVE, PENDING, PAUSED, ARCHIVED, DELETED
- [ ] Valid transitions documented
- [ ] Invalid transitions rejected
- [ ] State persistence in database
- [ ] Archive disables alerts

**Code Review Gate:** State violations return error (not silent failure).

### 5. Transaction-Based Rollback ✅

**Critical Rule:** All imports either succeed completely or rollback completely.

**Implementation checklist:**
- [ ] BEGIN TRANSACTION at start
- [ ] Validate all records
- [ ] INSERT/UPDATE records
- [ ] Verify integrity
- [ ] COMMIT or ROLLBACK

**Code Review Gate:** No partial imports allowed.

---

## TESTING REQUIREMENTS BY FEATURE

### CSV/XLSX Import/Export

**Unit Tests (70+ tests):**
- File parsing (CSV, XLSX, malformed)
- Validation (schema, business rules)
- Duplicate detection (exact match, confidence)
- Rollback (all error conditions)
- CSV injection prevention

**Integration Tests (40+ tests):**
- Full import workflow
- Duplicate resolution
- Concurrent updates
- Authorization checks
- Email notifications

**E2E Tests (10+ tests):**
- User uploads file
- Resolves duplicates
- Confirms import
- Verifies data in UI

---

### Custom Benefit Values

**Unit Tests (45+ tests):**
- Value input validation
- ROI calculation
- Cache invalidation
- Value history tracking

**Integration Tests (30+ tests):**
- Update custom value
- Recalculate ROI at all levels
- Verify cache behavior

**E2E Tests (8+ tests):**
- User edits value inline
- ROI updates in real-time
- Value history visible

---

### Card Management

**Unit Tests (60+ tests):**
- CRUD operations
- State machine transitions
- Authorization checks
- Search/filter logic

**Integration Tests (30+ tests):**
- Full card workflow
- Bulk operations
- State persistence

**E2E Tests (12+ tests):**
- User adds card
- Edits details
- Archives card
- Searches/filters

---

### Email Alerts

**Unit Tests (50+ tests):**
- Alert detection logic
- Timezone conversion
- Template rendering
- Deduplication logic

**Integration Tests (35+ tests):**
- Alert generation
- Email sending
- Bounce handling
- Preference persistence

**E2E Tests (8+ tests):**
- User sets preferences
- Receives email alert
- Unsubscribes
- Receives test email

---

## CODE REVIEW CHECKLIST

Every Phase 4 PR must verify:

- [ ] Authorization checks on all operations
- [ ] Server-side validation (never trust client)
- [ ] Timezone handling (IANA, UTC storage)
- [ ] State machine validation
- [ ] Error handling (no silent failures)
- [ ] Test coverage (80%+ target)
- [ ] Performance (meets targets)
- [ ] Security audit passed
- [ ] TypeScript strict mode
- [ ] No hardcoded values/secrets
- [ ] Consistent with Phase 1-3 patterns
- [ ] Comments for complex logic
- [ ] Accessibility considered (WCAG 2.1 AA)

**No PR merged without passing all checks.**

---

## RISK MITIGATION STRATEGIES

### Risk: DST Testing Complexity
- **Likelihood:** Medium
- **Impact:** High (timezone bugs are critical)
- **Mitigation:** Use test utilities for timezone mocking, include 5+ timezone test cases
- **Owner:** QA Engineer

### Risk: Email Service Integration
- **Likelihood:** Low
- **Impact:** High (users don't get alerts)
- **Mitigation:** Staging environment, test email feature, webhook testing
- **Owner:** Backend Lead

### Risk: Performance Degradation
- **Likelihood:** Medium
- **Impact:** Medium (slow imports/alerts)
- **Mitigation:** Load testing, query optimization, caching strategy
- **Owner:** Backend Lead

### Risk: Authorization Bypass
- **Likelihood:** Low
- **Impact:** Critical (data security)
- **Mitigation:** Comprehensive authorization tests, code review gate
- **Owner:** Security Engineer

### Risk: Scope Creep
- **Likelihood:** Medium
- **Impact:** High (timeline slips)
- **Mitigation:** Clear spec boundaries, phased delivery, sprint discipline
- **Owner:** Tech Lead

---

## SUCCESS CRITERIA

Phase 4 is complete when:

1. ✅ All 4 features implemented per specification
2. ✅ 80%+ code coverage achieved
3. ✅ All 12 critical QA issues resolved in code
4. ✅ Security audit passed
5. ✅ Performance targets met (load testing passed)
6. ✅ E2E tests passing (critical workflows)
7. ✅ No critical/high bugs remaining
8. ✅ Code review approved by architecture team
9. ✅ User documentation complete
10. ✅ Ready for production deployment

---

## GETTING HELP

**Questions about:**
- **Specification details:** See `SPEC_PHASE4_*.md` files
- **Critical issues:** See `SPEC_PHASE4_QA_AMENDMENTS_SUMMARY.md`
- **Architecture:** See `SPEC_PHASE4_SECURITY_AMENDMENTS.md`
- **Testing:** See test sections in each spec
- **Security:** Reach out to Security Engineer

**Communication channels:**
- Daily standup (30 min)
- Architecture review (weekly)
- Code review (peer + architecture)
- QA review (before merge)

---

## QUICK REFERENCE - SPECIFICATION LOCATIONS

All files in: `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/`

| File | Size | Purpose |
|------|------|---------|
| SPEC_PHASE4_SECURITY_AMENDMENTS.md | 29 KB | Foundation (read first) |
| SPEC_PHASE4_IMPORT_EXPORT.md | 78 KB | Import/export spec |
| SPEC_PHASE4_EMAIL_ALERTS.md | 62 KB | Email alerts spec |
| SPEC_PHASE4_CARD_MANAGEMENT.md | 63 KB | Card management spec |
| SPEC_PHASE4_CUSTOM_VALUES.md | 48 KB | Custom values spec |
| SPEC_PHASE4_QA_AMENDMENTS_SUMMARY.md | 17 KB | Issue details |
| PHASE4_SPECIFICATIONS_SUMMARY.md | 12 KB | Overview |
| SPEC_PHASE4_README.md | 9 KB | Navigation guide |
| QA_PHASE4_FINAL_APPROVAL.md | This document | Full approval |

---

**Document Location:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/QA_PHASE4_IMPLEMENTATION_GUIDE.md`
**Prepared by:** QA Code Review Team
**Approved by:** Architecture & Security Review
**Date:** April 2, 2026
**Status:** READY FOR DEVELOPMENT

