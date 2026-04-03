# Phase 1: MVP Bug Fixes - Quick Reference Guide

**Location:** `.github/specs/phase1-bug-fixes-spec.md`  
**Document Size:** 2,290 lines, ~65 KB  
**Status:** ✅ Complete and Ready for Implementation

---

## 📋 Spec Contents Overview

### 1. **Executive Summary & Goals**
- 5 critical MVP bugs identified and prioritized
- Clear success criteria for each bug
- Business objectives aligned with technical requirements

### 2. **Functional Requirements**
- Detailed requirements for each of the 5 bugs
- Constraints and validation rules
- User-facing expectations

### 3. **Implementation Phases (5 phases, Est. 13-22 hours total)**

| Phase | Bug | Focus | Estimated Hours | Status |
|-------|-----|-------|-----------------|--------|
| 1A | #1 | User profile data persistence | 2-4 | Pending |
| 1B | #2 | Chrome extension error fix | 1-2 | Pending |
| 1C | #3 | Global dark/light mode | 3-5 | Pending |
| 1D | #4 | Navigation routing fixes | 2-3 | Pending |
| 1E | #5 | Add card/benefit functionality | 5-8 | Pending |

### 4. **Data Schema Changes**
- Current schema analysis
- CSS variables for theming (light & dark modes)
- Database relationships for cards & benefits
- Sample data structures with field definitions

### 5. **User Flows & Workflows (5 detailed flows)**
1. Signup with profile data persistence
2. Settings page profile update
3. Add card to wallet
4. Add benefit to card
5. Dark mode toggle

**Each flow includes:**
- Step-by-step process flow
- Happy path & error paths
- State transitions
- User/system interactions

### 6. **API Routes & Contracts (5 endpoints)**

```
GET    /api/protected/user/profile
PATCH  /api/protected/user/profile
POST   /api/protected/cards
POST   /api/protected/benefits
GET    /api/protected/cards/{cardId}/available-benefits
```

**For each endpoint:**
- Request/response schema
- Status codes (201, 400, 401, 403, 404, 409, 500)
- Validation rules
- Example payloads

### 7. **Edge Cases & Error Handling**
- **Bug #1 (Profile):** 6 edge cases documented
- **Bug #2 (Chrome):** 5 edge cases documented
- **Bug #3 (Dark Mode):** 8 edge cases documented
- **Bug #4 (Navigation):** 7 edge cases documented
- **Bug #5 (Add Card/Benefit):** 15 edge cases documented

**Total: 41 edge cases with handling strategies**

### 8. **Component Architecture**
- System component diagram (ASCII)
- Component dependencies for each bug
- Integration points
- Layer architecture (pages → providers → components → business logic → data access → external services)

### 9. **Implementation Tasks (20 specific tasks)**

**Format for each task:**
- Task ID (e.g., 1A-1)
- Estimated hours & complexity
- Acceptance criteria (checklist)
- Implementation notes
- Files to create/modify

**Task Summary:**
```
Phase 1A: 5 tasks (Profile Data)
Phase 1B: 3 tasks (Chrome Error)
Phase 1C: 4 tasks (Dark Mode)
Phase 1D: 4 tasks (Navigation)
Phase 1E: 4 tasks (Add Card/Benefit)

Total: 20 tasks across 5 bug fixes
```

### 10. **Security & Compliance**
- Authentication & authorization strategy
- Data protection measures
- Input validation & sanitization
- Audit & logging requirements
- Sensitive data handling

### 11. **Performance & Scalability**
- Expected load: 10,000 users MVP phase
- Caching strategies (MasterCard catalog, user profile, theme)
- Database indexes for optimization
- Rate limiting requirements
- Horizontal/vertical scaling considerations

### 12. **Quality Control Checklist**
- Requirements coverage validation
- Data schema completeness
- API design review points
- Component architecture review
- Testing strategy review

---

## 🎯 Quick Start: Where to Begin

### For Tech Leads:
1. Review **Executive Summary** (page 1-2)
2. Review **Implementation Phases** (page 8-13)
3. Review **Component Architecture** (page 46-48)
4. Assign tasks from **Implementation Tasks** (page 50-75)

### For Backend Developers:
1. Start with **API Routes & Contracts** (page 33-44)
2. Review **Data Schema** (page 18-25)
3. Review **Edge Cases** for your assigned bug (page 36-42)
4. Review backend-specific **Implementation Tasks**

### For Frontend Developers:
1. Start with **User Flows & Workflows** (page 26-32)
2. Review **Component Architecture** (page 46-48)
3. Review **API Routes** for endpoints you'll consume (page 33-44)
4. Review frontend-specific **Implementation Tasks**

### For QA:
1. Review **Functional Requirements** (page 6-7)
2. Review **User Flows** for test scenarios (page 26-32)
3. Review **Edge Cases** for test case development (page 36-42)
4. Use **Acceptance Criteria** in tasks as validation rules (page 50-75)

---

## 📊 Key Numbers

- **Bugs Fixed:** 5 critical MVP issues
- **API Endpoints:** 5 new protected endpoints
- **Components:** 2 new modals (AddCardModal, AddBenefitModal)
- **Edge Cases:** 41 documented and handled
- **Implementation Tasks:** 20 specific tasks
- **Estimated Hours:** 13-22 hours total
- **Estimated Complexity:** Medium (no architectural changes)

---

## 🔍 Root Cause Summary

| Bug # | Title | Root Cause | Solution |
|-------|-------|-----------|----------|
| 1 | Profile not saved | Signup form uses "name" instead of "firstName"/"lastName" | Split name field; create profile endpoints |
| 2 | Chrome error | Improper promise handling in chrome.runtime API | Identify and fix message listeners |
| 3 | Dark mode partial | Theme provider doesn't apply CSS variables globally | Add CSS variables; update all components |
| 4 | Wrong redirects | Middleware doesn't redirect auth users from / to /dashboard | Add auth-aware redirect in middleware |
| 5 | Add card/benefit broken | Stub components not implemented; missing API endpoints | Implement modals + 3 API endpoints |

---

## ✅ Pre-Implementation Checklist

- [ ] Read full specification (2290 lines, ~65 KB)
- [ ] Team aligned on approach for each bug
- [ ] Database/API schema reviewed and approved
- [ ] Component architecture understood
- [ ] Task breakdown reviewed and prioritized
- [ ] Edge cases identified and test cases drafted
- [ ] Environment setup ready for development
- [ ] Database migrations planned (if needed)

---

## 📝 File Organization

```
.github/specs/
├── phase1-bug-fixes-spec.md  ← THIS FILE (Main specification)
├── phase1-qa-report.md        ← QA testing guide (companion)
└── ... (other historical specs)
```

**Using this spec:**
1. **During Planning:** Reference Implementation Phases & Tasks
2. **During Development:** Reference API Routes, Data Schema, Edge Cases
3. **During Testing:** Reference User Flows, Edge Cases, Acceptance Criteria
4. **During Review:** Reference Security, Performance, Quality Checklist

---

## 🚀 Next Actions

1. **Share with Team:** Distribute spec to all developers, QA, tech leads
2. **Review Meeting:** 30-min sync to discuss approach and answer questions
3. **Task Assignment:** Break down 20 tasks across team members
4. **Parallel Development:** Phases are independent; can develop in parallel:
   - Backend can start API endpoints (1A, 1B, 1D tasks)
   - Frontend can start components (1C, 1E tasks)
   - QA can start test case development using edge cases
5. **Progress Tracking:** Use task acceptance criteria as done-done definition

---

## 📞 Questions?

For clarifications on any aspect:
- **Architecture decisions:** See Component Architecture section
- **Why this approach:** See Root Cause Analysis in each bug section
- **How to handle edge case X:** See Edge Cases & Error Handling section
- **What tests are needed:** See User Flows and Acceptance Criteria
- **Security implications:** See Security & Compliance section

---

**Specification Created:** April 2024  
**Status:** ✅ Ready for Development  
**Confidence Level:** High (based on codebase analysis)
