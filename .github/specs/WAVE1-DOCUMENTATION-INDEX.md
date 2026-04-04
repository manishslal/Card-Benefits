# Wave 1 Remediation - Complete Documentation Index

**Project:** Card Benefits Tracker MVP  
**Phase:** Wave 1 - Critical Auth/API Fixes  
**Status:** 🔴 READY FOR DEVELOPMENT  
**Audit Reference:** 45 Issues (9 Critical) | Wave 1 Addresses 5 Critical Blockers

---

## 📋 Document Suite Overview

This Wave 1 remediation is documented across 3 specialized guides designed for different audiences:

| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| **WAVE1-AUTH-API-SPEC.md** | Complete technical architecture, rationale, edge cases, test plans | Engineers (deep dive), Tech Leads, Architects | 1,373 lines |
| **WAVE1-QUICK-REFERENCE.md** | Copy-paste code snippets and minimal checklists | Developers (implementation) | ~300 lines |
| **WAVE1-IMPLEMENTATION-CHECKLIST.md** | Step-by-step execution guide with verification at each step | Developers, QA, Project Manager | ~400 lines |

**How to use:**
1. **Tech Leads/Architects:** Start with WAVE1-AUTH-API-SPEC.md
2. **Developers implementing:** Use WAVE1-QUICK-REFERENCE.md + WAVE1-IMPLEMENTATION-CHECKLIST.md
3. **QA/Testing:** Use WAVE1-IMPLEMENTATION-CHECKLIST.md (Testing sections)
4. **Project Manager:** Use this index + checklist for tracking

---

## 🎯 The 5 Critical Fixes

All 5 tasks must be deployed together as a cohesive unit.

### Task 1A: Middleware Route Classification (⏱️ 10 min)
**File:** `src/middleware.ts` (lines 54-95)  
**Problem:** `/api/benefits/*`, `/api/cards/*` routes classified as unclassified → 401  
**Solution:** Add `PROTECTED_API_PREFIXES` constant and update `isProtectedRoute()`  
**Impact:** POST/PATCH/DELETE API calls now receive authenticated context  

📖 **Details:**
- [WAVE1-AUTH-API-SPEC.md - Task 1A](./WAVE1-AUTH-API-SPEC.md#task-1a-middleware-route-classification-fix)
- [WAVE1-QUICK-REFERENCE.md - Task 1A](./WAVE1-QUICK-REFERENCE.md#task-1a-middleware-route-classification)
- [WAVE1-IMPLEMENTATION-CHECKLIST.md - Task 1A](./WAVE1-IMPLEMENTATION-CHECKLIST.md#task-1a-middleware-route-classification-fix)

---

### Task 1B: Fix /api/auth/user Route (⏱️ 5 min)
**File:** `src/app/api/auth/user/route.ts` → `src/app/api/user/profile/route.ts`  
**Problem:** Path starts with `/api/auth` (public) but route needs JWT (protected)  
**Solution:** Move to `/api/user/profile` for cleaner route classification  
**Impact:** User profile fetch now classifies as protected (works correctly)  

📖 **Details:**
- [WAVE1-AUTH-API-SPEC.md - Task 1B](./WAVE1-AUTH-API-SPEC.md#task-1b-fix-apiauthuser-route-classification-conflict)
- [WAVE1-QUICK-REFERENCE.md - Task 1B](./WAVE1-QUICK-REFERENCE.md#task-1b-apiauthuser--apiserprofile)
- [WAVE1-IMPLEMENTATION-CHECKLIST.md - Task 1B](./WAVE1-IMPLEMENTATION-CHECKLIST.md#task-1b-fix-apiauthuser-route-classification)

---

### Task 1C: Add credentials: 'include' to Fetch (⏱️ 15 min)
**Files:** 4 modal components  
**Problem:** Fetch calls don't send session cookie → no JWT in middleware → 401  
**Solution:** Add `credentials: 'include'` to all authenticated fetch calls  
**Impact:** Modal operations can now send cookies with requests  

📖 **Details:**
- [WAVE1-AUTH-API-SPEC.md - Task 1C](./WAVE1-AUTH-API-SPEC.md#task-1c-add-credentials-include-to-modal-fetch-calls)
- [WAVE1-QUICK-REFERENCE.md - Task 1C](./WAVE1-QUICK-REFERENCE.md#task-1c-add-credentials-include-to-fetch-calls)
- [WAVE1-IMPLEMENTATION-CHECKLIST.md - Task 1C](./WAVE1-IMPLEMENTATION-CHECKLIST.md#task-1c-add-credentials-include-to-fetch-calls)

---

### Task 1D: Add GET /api/cards/[id] Endpoint (⏱️ 20 min)
**File:** `src/app/api/cards/[id]/route.ts` (add GET handler)  
**Problem:** Card detail page has no API → falls back to mock data with wrong units  
**Solution:** Add GET handler that fetches card + benefits from database  
**Impact:** Card detail page now shows real live data with correct values  

📖 **Details:**
- [WAVE1-AUTH-API-SPEC.md - Task 1D](./WAVE1-AUTH-API-SPEC.md#task-1d-add-get-apicards-id-endpoint)
- [WAVE1-QUICK-REFERENCE.md - Task 1D](./WAVE1-QUICK-REFERENCE.md#task-1d-add-get-apicards-id)
- [WAVE1-IMPLEMENTATION-CHECKLIST.md - Task 1D](./WAVE1-IMPLEMENTATION-CHECKLIST.md#task-1d-add-get-apicards-id-endpoint)

---

### Task 1E: Fix DELETE HTTP 204 Protocol Violation (⏱️ 10 min)
**Files:** `/api/cards/[id]/route.ts`, `/api/benefits/[id]/route.ts` (DELETE handlers)  
**Problem:** DELETE returns 204 status code WITH JSON body (violates HTTP spec)  
**Solution:** Return 204 with NO body (or 200 with body)  
**Impact:** Compliance with HTTP RFC 7231, compatibility with strict HTTP clients  

📖 **Details:**
- [WAVE1-AUTH-API-SPEC.md - Task 1E](./WAVE1-AUTH-API-SPEC.md#task-1e-fix-delete-http-204--json-body-protocol-violation)
- [WAVE1-QUICK-REFERENCE.md - Task 1E](./WAVE1-QUICK-REFERENCE.md#task-1e-fix-delete-http-204-protocol-violation)
- [WAVE1-IMPLEMENTATION-CHECKLIST.md - Task 1E](./WAVE1-IMPLEMENTATION-CHECKLIST.md#task-1e-fix-delete-http-204-protocol-violation)

---

## 🚀 Quick Start for Developers

### Copy-Paste Ready Snippets
For each task, use the code snippets in [WAVE1-QUICK-REFERENCE.md](./WAVE1-QUICK-REFERENCE.md):

```markdown
✅ Task 1A - Middleware changes (copy-paste the function)
✅ Task 1B - File move command (one command)
✅ Task 1C - Fetch template (apply to 4 files)
✅ Task 1D - GET handler (copy-paste entire function)
✅ Task 1E - DELETE fix (replace 2 lines in 2 files)
```

### Step-by-Step Implementation
Follow [WAVE1-IMPLEMENTATION-CHECKLIST.md](./WAVE1-IMPLEMENTATION-CHECKLIST.md):
- Pre-implementation checklist for each task
- Implementation steps with checkboxes
- Testing verification at each stage
- Code review sign-off section

### For Understanding
Read relevant sections in [WAVE1-AUTH-API-SPEC.md](./WAVE1-AUTH-API-SPEC.md):
- Problem statement (what's broken)
- Solution (why this approach)
- Implementation details (exactly what to code)
- Test cases (how to verify)
- Edge cases (what could go wrong)

---

## 📊 Impact Summary

### Before Wave 1
```
✗ POST /api/benefits/add → 401 Unauthorized
✗ PATCH /api/cards/[id] → 401 Unauthorized
✗ DELETE /api/cards/[id] → 401 Unauthorized + HTTP violation
✗ GET /api/cards/[id] → 404 Missing (uses stale mock data)
✗ GET /api/user/profile → 401 (public classification error)
```

### After Wave 1
```
✓ POST /api/benefits/add → 200 OK
✓ PATCH /api/cards/[id] → 200 OK
✓ DELETE /api/cards/[id] → 204 No Content (clean)
✓ GET /api/cards/[id] → 200 OK (live data, values in cents)
✓ GET /api/user/profile → 200 OK (protected correctly)
```

### Critical Metrics
| Metric | Before | After |
|--------|--------|-------|
| CRUD operations working | 0/4 | 4/4 |
| Card detail page mock data | ❌ Stale | ✅ Live |
| HTTP spec compliance | ❌ 204 with body | ✅ 204 no body |
| Middleware route coverage | ❌ Unclassified routes | ✅ All classified |

---

## 🔄 Deployment Flow

```
┌─────────────────────────────────────┐
│  Developer: Start Implementation     │
│  (Read WAVE1-QUICK-REFERENCE.md)    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Code Changes (5 tasks, ~1 hour)    │
│  Using WAVE1-IMPLEMENTATION-...     │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Local Testing & Build              │
│  npm run build && npm run test      │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Code Review (Reference SPEC for    │
│  edge cases, test strategy)         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Staging Deployment & QA Testing    │
│  (Test full integration flows)      │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Production Deployment              │
│  (Rollback plan ready, monitoring)  │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Post-Deployment Verification       │
│  (Monitor logs, manual smoke tests) │
└─────────────────────────────────────┘
```

---

## 📚 Reference Materials

### Related Audit Reports (Context)
These audit reports identified the issues Wave 1 addresses:
- `.github/specs/AUDIT-MODALS-DIALOGS.md` (fetch credentials issue, modal overflow)
- `.github/specs/AUDIT-API-DATA-INTEGRATION.md` (route classification, missing endpoints)
- `.github/specs/AUDIT-THEME-STYLING.md` (out of scope for Wave 1)

### Architecture Reference
- `src/middleware.ts` — Route classification logic
- `src/lib/auth-context.ts` — AsyncLocalStorage auth context
- `src/lib/auth-utils.ts` — JWT verification
- `prisma/schema.prisma` — Database schema (values in cents)

### Deployment Reference
- `.github/workflows/` — CI/CD pipelines
- `railway.json` — Railway deployment config
- `next.config.js` — Next.js configuration

---

## ✅ Verification Checklist (Post-Deployment)

After Wave 1 is deployed, verify:

### Immediate (First Hour)
- [ ] Application loads without errors
- [ ] Login/logout flows unchanged
- [ ] No 500 errors in production logs
- [ ] API response times normal

### Functional
- [ ] POST /api/benefits/add works → 200
- [ ] PATCH /api/cards/[id] works → 200
- [ ] DELETE /api/cards/[id] works → 204
- [ ] GET /api/cards/[id] returns real data
- [ ] Card detail page shows correct values (in cents)
- [ ] All 4 modals can submit successfully

### Comprehensive
- [ ] Full end-to-end flow (login → add card → add benefit → view detail → edit → delete)
- [ ] Mobile viewport works (no overflow)
- [ ] Error handling (401, 404, 403 errors show appropriate UI)
- [ ] Concurrent operations (multiple modals simultaneously)

### Regression
- [ ] Existing user data intact
- [ ] Public pages still accessible
- [ ] No breaking changes to API contracts

---

## 🆘 Support & Troubleshooting

### Common Issues During Implementation

**Issue: "Cannot find module" errors after file move**
```bash
# Clear Next.js cache
rm -rf .next/
npm run build
```

**Issue: Build fails with TypeScript errors**
- Check interface definitions match response structures
- Verify Prisma query syntax
- Ensure null/undefined handling correct

**Issue: Tests fail after changes**
- Clear test cache: `npm test -- --clearCache`
- Update test mocks if API contracts changed
- Check route matching in tests

### Getting Help

1. **For implementation questions:** Check WAVE1-QUICK-REFERENCE.md first
2. **For edge case handling:** See WAVE1-AUTH-API-SPEC.md Edge Cases section
3. **For test writing:** See Task test cases in WAVE1-AUTH-API-SPEC.md
4. **For deployment issues:** See Deployment & Rollback sections in WAVE1-AUTH-API-SPEC.md

---

## 📞 Contact & Escalation

| Role | Contact | For |
|------|---------|-----|
| Tech Lead | __________ | Architecture questions, design decisions |
| DevOps | __________ | Deployment, database, infrastructure |
| Product | __________ | Scope changes, priority adjustments |
| QA Lead | __________ | Test strategy, acceptance criteria |

---

## 📄 Document Metadata

**Suite Version:** 1.0  
**Created:** 2024  
**Status:** Ready for Development  
**Audience:** Engineering Team (Backend, Frontend, DevOps, QA)  
**Maintainer:** Architecture Team  
**Last Updated:** 2024  

**Files in Suite:**
1. `WAVE1-AUTH-API-SPEC.md` — Comprehensive technical specification
2. `WAVE1-QUICK-REFERENCE.md` — Quick reference with code snippets
3. `WAVE1-IMPLEMENTATION-CHECKLIST.md` — Step-by-step implementation guide
4. `WAVE1-DOCUMENTATION-INDEX.md` — This file

---

## 🔗 Quick Navigation

### For Developers Starting Now
👉 Go to: [WAVE1-QUICK-REFERENCE.md](./WAVE1-QUICK-REFERENCE.md)

### For Code Review
👉 Go to: [WAVE1-AUTH-API-SPEC.md](./WAVE1-AUTH-API-SPEC.md) (sections for each task)

### For Testing & Verification
👉 Go to: [WAVE1-IMPLEMENTATION-CHECKLIST.md](./WAVE1-IMPLEMENTATION-CHECKLIST.md) (Testing & Verification sections)

### For Deployment
👉 Go to: [WAVE1-AUTH-API-SPEC.md](./WAVE1-AUTH-API-SPEC.md#deployment--rollout) or [WAVE1-IMPLEMENTATION-CHECKLIST.md](./WAVE1-IMPLEMENTATION-CHECKLIST.md#deployment)

---

**🚀 Ready to implement? Start with [WAVE1-QUICK-REFERENCE.md](./WAVE1-QUICK-REFERENCE.md)**
