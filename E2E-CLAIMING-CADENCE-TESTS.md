# Phase 6C: Claiming Cadence E2E Tests

## Overview

Comprehensive end-to-end test suite for Phase 6C claiming cadence feature, covering all user flows with realistic benefit claiming scenarios. These tests validate the complete claiming workflow from UI interaction through API validation to database persistence.

## Test Architecture

### Test Files
- **`tests/e2e/phase6c-claiming-cadence.spec.ts`** - Main test suite
- **`tests/e2e/fixtures/phase6c-test-data.ts`** - Test data and fixtures

### Test Framework
- **Playwright** with TypeScript for robust cross-browser testing
- **Visual regression** testing with screenshots
- **Accessibility** compliance validation (WCAG 2.1 AA)
- **Mobile/Desktop** responsive testing
- **Date mocking** for consistent period boundary testing

## Test Scenarios Covered

### 🟢 Scenario 1: Happy Path - Monthly Benefit (Desktop)
**Test**: `Monthly Uber benefit - Happy path claiming flow`

**Setup**:
- Desktop viewport (1440x900)
- Date: March 15, 2026 (mid-month)
- Benefit: Uber Credit ($15/month)

**Flow**:
1. Login and navigate to dashboard
2. Verify benefit shows "⏰ $15 available THIS MONTH (expires Mar 31)"
3. Verify urgency indicator is green (LOW urgency)
4. Click claim button to open modal
5. Verify modal pre-fills $15 amount
6. Verify period information displayed
7. Confirm claim
8. Verify success message and modal closes
9. Verify progress bar shows 100%
10. Verify benefit status updates to "Used"

**Assertions**:
- ✅ Correct monthly period detection
- ✅ Appropriate urgency level (LOW = green)
- ✅ Modal UX and pre-filled values
- ✅ Progress bar animation
- ✅ Success feedback

---

### 🔴 Scenario 2: Error - Over Limit (Mobile)
**Test**: `Entertainment benefit over-limit error handling on mobile`

**Setup**:
- Mobile viewport (375x667)
- Date: March 20, 2026
- Benefit: Entertainment Credit ($15/month limit)

**Flow**:
1. Navigate to dashboard on mobile
2. Find Entertainment benefit
3. Open claim modal
4. Enter $20 (exceeding $15 limit)
5. Submit invalid amount
6. Verify error: "Only $15 available"
7. Verify suggestion button: "Claim $15 instead?"
8. Click suggestion to auto-correct
9. Verify amount updates to $15
10. Complete successful claim

**Assertions**:
- ✅ Mobile UI responsiveness
- ✅ Over-limit validation
- ✅ User-friendly error messages
- ✅ Auto-correction suggestions
- ✅ Recovery flow completion

---

### 🔒 Scenario 3: One-Time Benefit
**Test**: `Global Entry one-time benefit claiming and re-attempt blocking`

**Setup**:
- Desktop viewport
- Date: March 25, 2026
- Benefit: Global Entry ($109, ONE_TIME)

**Flow**:
1. Navigate to dashboard
2. Find Global Entry benefit
3. Verify "✓ One-time credit" indicator
4. Open claim modal
5. Verify $109 pre-filled amount
6. Complete claim successfully
7. Verify benefit shows "Already claimed"
8. Attempt to claim again
9. Verify button disabled or error shown

**Assertions**:
- ✅ One-time benefit identification
- ✅ Full amount claiming
- ✅ Post-claim state changes
- ✅ Re-attempt prevention
- ✅ UI state consistency

## Test Data & Fixtures

### Test User Setup
```typescript
testUserData = {
  email: 'phase6c.test@cardbenefits.com',
  password: 'TestCadence2026!',
  playerId: 'test-phase6c-claiming-user'
}
```

### Benefit Test Data
- **Amex Platinum**: Uber ($15/mo), Dining ($75/qtr), Entertainment ($15/mo), Global Entry ($109/one-time)
- **Chase Sapphire**: Travel Credit ($300/annual), Monthly Benefit ($25/mo)

### Date Scenarios
- **Mid-month**: March 15 (LOW urgency)
- **Late month**: March 28 (HIGH urgency) 
- **Amex boundary**: September 18 (H2 start)
- **Expired**: April 1 (March benefits expired)
- **Edge cases**: Feb 29 leap year, 11:59 PM

## Test Execution

### Running Tests
```bash
# Run all Phase 6C tests
npm run test:e2e -- --grep "Phase 6C"

# Run specific scenario
npm run test:e2e -- --grep "Scenario 1"

# Run with headed browser (visual debugging)
npm run test:e2e -- --headed --grep "Phase 6C"

# Generate test report
npm run test:e2e -- --reporter=html
```

## Success Criteria

All tests must pass with:
- ✅ **Functional correctness** - All claiming workflows work
- ✅ **Visual consistency** - Screenshots match baselines
- ✅ **Accessibility compliance** - WCAG 2.1 AA standards
- ✅ **Performance targets** - Meet benchmark requirements
- ✅ **Error handling** - Graceful failure and recovery
- ✅ **Mobile responsiveness** - Works on all screen sizes

---

**Total Test Coverage**: 6+ main user flows with comprehensive edge case and accessibility testing.

**Estimated Execution Time**: ~5-8 minutes for full suite