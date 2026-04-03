# Custom Values Feature - Specification Index

## Document References

- **Main Specification:** [`custom-values-refined-spec.md`](./custom-values-refined-spec.md)
- **Original Specification:** `../../SPEC_PHASE4_CUSTOM_VALUES.md`

---

## Quick Navigation

### Executive Summary (Start Here)
- **Location:** Lines 1-85 in refined spec
- **Contains:** Overview, objectives, success criteria
- **Read Time:** 5 minutes

### Functional Requirements
- **Location:** Lines 87-280
- **Contains:** 10 core features (FR1-FR10) with detailed specifications
- **Key Features:**
  - FR1: Inline value editing
  - FR2: Value comparison display
  - FR3: Real-time ROI recalculation
  - FR4: Input validation
  - FR5: Value presets
  - FR6: Change audit trail
  - FR7: Bulk updates
  - FR8: Reset/clear custom value
  - FR9: Mobile-friendly editing
  - FR10: Accessibility

### Implementation Phases
- **Location:** Lines 282-330
- **Timeline:** 4 phases, 2-3 days each (total ~2 weeks)
- **Phase breakdown:**
  - Phase 1: Core Editing Infrastructure (10-12 hours)
  - Phase 2: ROI Integration & Real-Time Updates (12-14 hours)
  - Phase 3: Advanced Features & Workflows (12-14 hours)
  - Phase 4: Testing & Polish (12-14 hours)

### Data Schema & State Management
- **Location:** Lines 332-542
- **Contains:**
  - Database schema updates (3 new columns)
  - TypeScript interfaces for derived types
  - In-memory state management
  - Component-level state
  - Global state (React Context)

### API Specifications (Critical for Implementation)
- **Location:** Lines 544-962
- **Server Actions:**
  1. `updateUserDeclaredValue()` - Update single benefit value
  2. `clearUserDeclaredValue()` - Reset to sticker value
  3. `bulkUpdateUserDeclaredValues()` - Update multiple benefits
  4. `getBenefitValueHistory()` - Get change history
  5. `revertUserDeclaredValue()` - Restore previous value

- **Each endpoint includes:**
  - Function signature
  - Request parameters
  - Validation rules
  - Success response (200)
  - Error responses (400, 403, 404, 500)

- **ROI Calculation Functions:**
  - `calculateBenefitROI()`
  - `calculateCardROI()`
  - `calculatePlayerROI()`
  - `calculateHouseholdROI()`

- **Cache Management:**
  - Cache strategy with 5-minute TTL
  - Invalidation triggers
  - Cache implementation code

### User Flows & Workflows
- **Location:** Lines 964-1420
- **Contains:** 6 detailed user workflows with ASCII diagrams

1. **Single Benefit Edit (Happy Path)**
   - 8 steps from viewing to continued usage
   - Timing targets provided

2. **Preset Selection**
   - Quick-set button interactions
   - Master value reset workflow

3. **Bulk Update Multiple Benefits**
   - 4-step modal workflow
   - Preview before applying
   - Impact visualization

4. **Error Path - Invalid Input**
   - Unreasonable value warning
   - Validation error handling
   - Negative/non-numeric input

5. **Error Path - Network Timeout**
   - Timeout handling (5 seconds)
   - Retry mechanism
   - Error messaging

6. **History View & Revert**
   - Timeline popover display
   - Revert to previous value
   - Audit trail preservation

### Edge Cases & Error Handling
- **Location:** Lines 1422-1872
- **15 comprehensive edge cases with handling strategies:**

1. Sticker value changes after custom set
2. Zero value override
3. Extreme value inputs (very large/small)
4. Rapid successive edits (debouncing)
5. Network timeout during save
6. Benefit deleted while editing
7. Authorization error (session expired)
8. Concurrent edit by another session
9. Bulk edit with mixed validations
10. ROI calculation error
11. Editing claimed benefit
12. Value override with importing
13. Batch update partial failure
14. Custom value for expired benefit
15. Memory/performance with large wallet (200+ benefits)

**For each edge case:**
- Scenario description
- Expected behavior
- Implementation code example
- Testing checklist

### Component Architecture
- **Location:** Lines 1874-2060
- **UI Components (5 total):**
  1. EditableValueField
  2. BenefitValueComparison
  3. BenefitValuePresets
  4. ValueHistoryPopover
  5. BulkValueEditor

**For each component:**
- Props/interfaces
- State management
- Behavior description
- Integration points

- **Integration Points:**
  - With ROI calculation system
  - With dashboard components
  - With benefit list components

### Implementation Checklist
- **Location:** Lines 2062-2440
- **Organized by phase with sub-tasks**
- **Phase 1: Core Components & Database**
  - Database migration (5 tasks)
  - EditableValueField component (13 tasks)
  - BenefitValueComparison component (4 tasks)
  - Validation utilities (4 tasks)
  - Server actions (8 tasks)

- **Phase 2: ROI Integration**
  - ROI calculation functions (8 tasks)
  - Cache layer (6 tasks)
  - React Context (4 tasks)
  - Real-time updates (5 tasks)
  - Before/after ROI display (4 tasks)

- **Phase 3: Advanced Features**
  - Presets component (6 tasks)
  - History/revert (6 tasks)
  - Bulk update workflow (8 tasks)
  - CSV import integration (4 tasks)
  - Revert functionality (4 tasks)

- **Phase 4: Testing & Optimization**
  - Unit tests (90+ test cases)
  - Component tests (50+ test cases)
  - Integration tests (15 scenarios)
  - E2E tests (10+ scenarios)
  - Accessibility testing
  - Performance testing
  - Mobile device testing
  - Deployment & documentation

**Total: 50+ actionable tasks**

### Security & Compliance
- **Location:** Lines 2442-2516
- **Topics covered:**
  - Authorization (benefit ownership verification)
  - Input validation (server-side, no code injection)
  - Audit trail (immutable history)
  - Data privacy (no cross-user access)

### Performance & Scalability
- **Location:** Lines 2518-2620
- **Performance Targets:**
  - Single benefit save: < 100ms
  - ROI calculations: < 300ms max
  - Bulk updates: < 1 second for 100 benefits
  - Cache hits: < 5ms

- **Optimization Strategies:**
  - Calculation optimization (memoization, batching)
  - Database optimization (indexes, eager loading)
  - Caching strategy (TTL, invalidation)
  - Scalability considerations (100K+ benefits supported)

### References & Examples
- **Location:** Lines 2622-2750
- **Sample API responses:**
  - Update value (success)
  - Bulk update (success)
  - Get history (success)

- **Component usage examples:**
  - EditableValueField usage
  - BenefitValueComparison usage
  - BulkValueEditor usage

---

## Key Metrics at a Glance

| Metric | Value |
|--------|-------|
| Total Lines | 2,555 |
| Total Words | ~45,000 |
| Sections | 18 |
| API Endpoints | 5 |
| UI Components | 5 |
| Edge Cases Documented | 15 |
| Implementation Phases | 4 |
| Implementation Tasks | 50+ |
| Test Cases | 150+ |
| Performance SLAs | 8 |

---

## How to Use This Specification

### For Project Managers
1. Read "Executive Summary" for high-level overview
2. Review "Implementation Phases" for timeline
3. Track "Implementation Checklist" for progress

### For Full-Stack Engineers
1. Start with "Functional Requirements" for what to build
2. Follow "Implementation Checklist" for Phase 1
3. Refer to "API Specifications" for endpoint signatures
4. Use "Component Architecture" for UI design
5. Use "Edge Cases" for comprehensive testing
6. Follow "Testing Strategy" for quality assurance

### For QA Engineers
1. Read "User Flows & Workflows" for happy paths
2. Review "Edge Cases & Error Handling" for negative testing
3. Follow "Implementation Checklist" Phase 4 testing section
4. Use "Performance & Scalability" for load testing

### For Database Administrators
1. Review "Data Schema & State Management" section
2. Follow "Database Migration" in Implementation Checklist
3. Set up monitoring per "Deployment Considerations"

---

## Improvements from Original Specification

### What Was Refined

✅ **Clarity:** Reorganized sections for better readability
✅ **Completeness:** Added exact API request/response schemas
✅ **Detail:** Added TypeScript interfaces for all types
✅ **Actionability:** Split requirements into specific implementation tasks
✅ **Testing:** Expanded edge case testing with implementation code
✅ **Performance:** Added concrete performance targets and metrics
✅ **Accessibility:** Detailed WCAG 2.1 AA compliance requirements
✅ **Security:** Added authorization and data privacy specifics

### Key Additions

1. **Exact API Signatures** - Copy-paste ready function signatures
2. **TypeScript Interfaces** - For request/response types
3. **Validation Rules** - Specific regex patterns, ranges, constraints
4. **Mathematical Formulas** - ROI calculation algorithms
5. **Code Examples** - Sample implementations for complex logic
6. **Performance Targets** - SLAs for all operations
7. **Testing Strategies** - Test count targets by type
8. **Checklists** - 50+ actionable tasks with acceptance criteria

### What Was Preserved

✅ All original functional requirements (FR1-FR10)
✅ All original user workflows (with enhancements)
✅ All original edge cases (with implementation details)
✅ All original component descriptions
✅ Original phase timeline and breakdown

---

## Related Documents

- **Original Spec:** `../../SPEC_PHASE4_CUSTOM_VALUES.md`
- **Card Management Spec:** `../../SPEC_PHASE4_CARD_MANAGEMENT.md`
- **Import/Export Spec:** `../../SPEC_PHASE4_IMPORT_EXPORT.md`
- **Email Alerts Spec:** `../../SPEC_PHASE4_EMAIL_ALERTS.md`
- **Project README:** `../../SPEC_PHASE4_README.md`

---

## Document Control

- **Version:** 2.0 (Refined)
- **Date:** April 2024
- **Status:** Ready for Implementation ✅
- **Last Updated:** April 2024
- **Next Review:** After Phase 1 completion (recommended)

---

## Quick Start for Implementation

```bash
# Step 1: Create database migration
npx prisma migrate dev --name add_value_history_tracking

# Step 2: Create Phase 1 branch
git checkout -b feature/custom-values-phase-1

# Step 3: Create component scaffolds
mkdir -p src/components/benefits/EditableValueField
touch src/components/benefits/EditableValueField/index.tsx
touch src/components/benefits/EditableValueField/__tests__/index.test.tsx

# Step 4: Follow implementation checklist
# Reference: Section "Implementation Checklist" (lines 2062-2440)

# Step 5: Run tests after each component
npm run test -- --watch

# Step 6: Create PR with checklist items checked
# Reference: Acceptance criteria in each task
```

---

## Questions or Clarifications?

Refer to the corresponding section:
- **What to build?** → Functional Requirements (FR1-FR10)
- **How to build it?** → Component Architecture + API Specifications
- **What could go wrong?** → Edge Cases & Error Handling
- **How fast should it be?** → Performance & Scalability
- **How to test it?** → Implementation Checklist (Phase 4)
- **Is it secure?** → Security & Compliance
- **What's the timeline?** → Implementation Phases

---

**This refined specification is production-ready and provides a complete blueprint for successful implementation.**

