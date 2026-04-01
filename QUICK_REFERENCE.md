# Card-Benefits Code Review - Quick Reference

## 📋 Issue Tracker

### 🔴 CRITICAL (Must Fix - 3 Issues)

| # | Issue | Location | Impact | Fix Time |
|---|-------|----------|--------|----------|
| 1 | Missing Auth/Authorization | `/src/actions/` | Data breach | 2-3h |
| 2 | Cron Endpoint Security | `/src/app/api/cron/reset-benefits/route.ts:18-26` | DoS vulnerability | 1-2h |
| 3 | Component Prop Mismatch | `PlayerTabsContainer.tsx` vs `CardTrackerPanel.tsx` | App crash | 0.5h |

### 🟠 HIGH (Should Fix - 6 Issues)

| # | Issue | Location | Impact | Fix Time |
|---|-------|----------|--------|----------|
| 4 | Duplicate ROI Logic | `Card.tsx`, `calculations.ts`, `SummaryStats.tsx` | Inconsistent data | 2h |
| 5 | Missing Error Handling | `/src/lib/calculations.ts` | Silent corruption | 1h |
| 6 | Timezone/DST Bugs | `/src/lib/benefitDates.ts:20-37` | Wrong expiry dates | 2h |
| 7 | Duplicate Code in SummaryStats | `/src/components/SummaryStats.tsx:83-137` | Maintenance burden | 1h |
| 8 | Missing Auth in toggleBenefit | `/src/actions/benefits.ts:40-64` | Data theft | 1h |
| 9 | Expiration Logic Bug | `/src/components/Card.tsx:76` | Off-by-one errors | 1h |

### 🟡 MEDIUM (7 Issues - See CODE_REVIEW.md)

---

## 🚀 Priority Action Items

### This Week (Critical Path)
```
1. [ ] Implement user authentication checks in server actions
2. [ ] Fix cron endpoint authorization (timing-safe comparison)
3. [ ] Fix component prop mismatch (rename 'card' to 'userCard')
4. [ ] Write authorization tests
```

### Next Week (High Priority)
```
5. [ ] Centralize ROI calculation (use calculations.ts everywhere)
6. [ ] Fix timezone handling (switch to UTC)
7. [ ] Add input validation
8. [ ] Remove duplicate logic in SummaryStats
```

### Before Deployment
```
✓ All tests passing
✓ Security tests passing
✓ No critical issues
✓ Code review approved
✓ Staging deployment successful
```

---

## 📁 File Changes Required

### Critical Changes
- [ ] `/src/actions/wallet.ts` - Add authorization
- [ ] `/src/actions/benefits.ts` - Add authorization (2 functions)
- [ ] `/src/app/api/cron/reset-benefits/route.ts` - Fix security
- [ ] `/src/components/PlayerTabsContainer.tsx` - Fix prop name
- [ ] `/src/components/CardTrackerPanel.tsx` - Fix prop name

### High Priority Changes
- [ ] `/src/components/Card.tsx` - Remove duplicate logic, import from calculations.ts
- [ ] `/src/components/SummaryStats.tsx` - Use calculation utilities
- [ ] `/src/lib/benefitDates.ts` - Switch to UTC
- [ ] `/src/lib/calculations.ts` - Add error handling

### Recommended Changes
- [ ] Create `.env.example`
- [ ] Add TypeScript strict mode to tsconfig.json
- [ ] Set up logging utility
- [ ] Add error boundaries

---

## 🧪 Test Files to Create

```
tests/
├── unit/lib/
│   ├── calculations.test.ts          (CRITICAL)
│   └── benefitDates.test.ts          (CRITICAL)
├── integration/
│   ├── wallet-flow.test.ts           (HIGH)
│   └── benefit-tracking.test.ts      (HIGH)
├── security/
│   ├── authorization.test.ts         (CRITICAL)
│   └── input-validation.test.ts      (HIGH)
└── components/
    ├── CardTrackerPanel.test.tsx
    └── BenefitTable.test.tsx
```

---

## 💰 Effort Estimate

```
Critical Fixes:   4-6 hours
High Priority:    6-8 hours  
Medium Priority:  4-6 hours
Testing:          8-12 hours
──────────────────────────
TOTAL:           22-32 hours (3-4 days)
```

---

## ✅ Sign-Off Checklist

Before this app goes to production:

- [ ] **Security**
  - [ ] User authentication implemented
  - [ ] Authorization on all mutations
  - [ ] Cron endpoint secured
  - [ ] Input validation complete
  - [ ] Security tests passing (100%)

- [ ] **Correctness**
  - [ ] Calculation logic centralized
  - [ ] ROI consistent across pages
  - [ ] Timezone bugs fixed
  - [ ] Error handling added
  - [ ] Edge cases tested

- [ ] **Quality**
  - [ ] No duplicate code
  - [ ] TypeScript strict mode enabled
  - [ ] All tests passing (80%+ coverage)
  - [ ] Code review approved
  - [ ] Staging tested successfully

- [ ] **Documentation**
  - [ ] .env.example created
  - [ ] README updated
  - [ ] Complex functions commented
  - [ ] Architecture documented

---

## 📞 Questions?

Refer to detailed analysis:
- **CODE_REVIEW.md** - Full issue descriptions with examples
- **TEST_SUITE.md** - Complete test specifications
- **REVIEW_SUMMARY.txt** - Executive summary

---

## 📊 Severity Definition

| Severity | Definition | Action |
|----------|-----------|--------|
| 🔴 CRITICAL | Blocks production, security risk, data loss | Fix immediately |
| 🟠 HIGH | Wrong behavior, performance issue | Fix this sprint |
| 🟡 MEDIUM | Edge cases, code quality | Fix next sprint |
| 🟢 LOW | Style, documentation | Polish as time allows |

---

**Generated:** April 1, 2026  
**Status:** NOT PRODUCTION READY  
**Next Review:** After critical fixes implemented
