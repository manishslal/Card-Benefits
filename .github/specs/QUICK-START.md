# Card Catalog Specification - Quick Start Guide

## 📋 For Engineers Starting Implementation

**Read this first** (~2 minutes), then jump to the full spec for your role.

---

## 🎯 What Are We Building?

**5 Critical Bug Fixes + Card Catalog System**

Users should be able to:
1. Click "Add Card" → see a catalog of real credit cards → select one → benefits auto-populate ✨
2. All modals must have proper accessibility labels (DialogTitle)
3. Card action buttons move from header to footer
4. Dashboard shows real user cards (not hardcoded ID '1')

---

## 🏗️ Architecture (30 seconds)

```
Frontend:
  AddCardModal (rewritten) → Browse Catalog OR Create Custom
                          ↓
Backend API:
  GET /api/cards/catalog (returns 10+ card templates)
  POST /api/cards/add (creates card from template or custom)
  GET /api/cards/my-cards (returns user's real cards)
                          ↓
Database:
  MasterCard + MasterBenefit (read-only templates)
  UserCard + UserBenefit (user's clones)
  
  NO SCHEMA CHANGES NEEDED - models already exist!
```

---

## 📍 Implementation Plan

| Phase | Work | Days | Parallel? |
|-------|------|------|-----------|
| **1** | Database seeding | 2 | Yes (with P3) |
| **2** | API endpoints | 2 | After P1 |
| **3** | Bug fixes (modals, buttons, checkboxes) | 1 | Yes (with P1) |
| **4** | Catalog UI (rewrite AddCardModal) | 2 | After P2, P3 |
| **5** | QA & deployment | 1 | After P4 |
| **Total** | | **8 days** | |

---

## 📂 File Locations

**Spec Document** (main reference):
```
.github/specs/CRITICAL-UI-CARD-CATALOG-SPEC.md
```

**Components to Update**:
```
src/components/AddCardModal.tsx          (REWRITE - tabs for browse/custom)
src/components/EditCardModal.tsx         (ADD: DialogTitle)
src/components/AddBenefitModal.tsx       (ADD: DialogTitle)
src/components/EditBenefitModal.tsx      (ADD: DialogTitle)
src/components/Card.tsx                  (MOVE: buttons to footer)
src/components/SettingsPanel.tsx         (FIX: checkbox size w-4 h-4)
src/app/(dashboard)/page.tsx             (UPDATE: fetch /api/cards/my-cards)
```

**API Routes to Create/Update**:
```
src/app/api/cards/catalog/route.ts       (NEW - GET catalog)
src/app/api/cards/add/route.ts           (UPDATE - accept masterCardId)
src/app/api/cards/my-cards/route.ts      (UPDATE - eager-load relations)
```

**Database Seeding**:
```
prisma/seed.ts                           (ADD seed-card-templates script)
```

---

## 🎬 User Flows at a Glance

### Happy Path: Select from Catalog
```
User clicks "Add Card"
  → AddCardModal opens
  → "Browse Cards" tab shows grid of 10+ cards
  → User clicks "Select Card" on Amex Gold
  → Modal shows confirmation (card name, fee, renewal date)
  → User confirms
  → API POST /api/cards/add with masterCardId
  → UserCard created with Amex Gold benefits cloned
  → Card appears on dashboard with all benefits
```

### Fallback: Create Custom Card
```
User clicks "Create Custom Card" tab
  → Fill form: name, issuer, fee, renewal date
  → Click "Create"
  → API POST /api/cards/add (no masterCardId)
  → Empty UserCard created (user adds benefits later)
```

---

## 🔑 Key Decisions

| Decision | Why |
|----------|-----|
| **No schema changes needed** | MasterCard/MasterBenefit models already exist |
| **Soft deletes (status="DELETED")** | Preserve audit trail, enable undelete |
| **Unique constraint [playerId, masterCardId]** | Prevent duplicate card ownership |
| **Benefits cloned on creation** | Each user has independent copies |
| **Catalog cached 1 hour** | Rarely changes, improves performance |
| **User cards cached 5 min per user** | Balance freshness vs. performance |

---

## ✅ Definition of Done (DoD)

### For Phase 1 (Database)
- [ ] Seed script creates 10+ realistic cards
- [ ] Each card has 5-8 realistic benefits
- [ ] `npx prisma db seed` runs without errors
- [ ] No duplicate data on repeat runs (idempotent)

### For Phase 2 (API)
- [ ] `GET /api/cards/catalog` returns templates with benefits
- [ ] `POST /api/cards/add` accepts masterCardId and clones benefits
- [ ] `GET /api/cards/my-cards` returns user's cards with masterCard + benefits
- [ ] All endpoints authenticated, scoped by playerId
- [ ] Integration tests pass (100%)

### For Phase 3 (Bug Fixes)
- [ ] DialogTitle added to all 4 modals
- [ ] Add Card modal state wired (button click → modal appears)
- [ ] Edit/Delete buttons in card footer, right-aligned
- [ ] Checkboxes w-4 h-4 in Settings
- [ ] Manual test pass (no console errors)

### For Phase 4 (Catalog UI)
- [ ] AddCardModal has two tabs: "Browse Cards", "Create Custom"
- [ ] Catalog grid shows card issuer, name, fee, benefit preview
- [ ] "Select Card" button wired to POST /api/cards/add
- [ ] Dashboard fetches `/api/cards/my-cards` (not hardcoded `/1`)
- [ ] E2E tests pass (>90% success rate)

### For Phase 5 (QA)
- [ ] WCAG 2.1 accessibility audit passes (0 critical violations)
- [ ] Performance: catalog <1s, my-cards <500ms
- [ ] Manual QA test plan signed off
- [ ] Code review approved
- [ ] Deployed to staging and production

---

## 🚀 Getting Started

### Step 1: Read the Full Specification
```bash
open .github/specs/CRITICAL-UI-CARD-CATALOG-SPEC.md
```

### Step 2: Choose Your Role & Jump to Relevant Section

**API Engineers:**
→ Section: "API Routes & Contracts" (p. X)
→ Section: "Implementation Tasks" → Phase 2 (p. X)

**Frontend Engineers:**
→ Section: "User Flows & Workflows" (p. X)
→ Section: "Component Architecture" (p. X)
→ Section: "Implementation Tasks" → Phases 3-4 (p. X)

**Database/DevOps:**
→ Section: "Data Schema" (p. X)
→ Section: "Implementation Tasks" → Phase 1 (p. X)
→ Section: "Performance & Scalability" (p. X)

**QA/Testing:**
→ Section: "Testing Strategy" (p. X)
→ Section: "Edge Cases & Error Handling" (p. X)
→ Section: "Implementation Tasks" → Phase 5 (p. X)

### Step 3: Complete Your Phase Tasks

Use the **Implementation Tasks** checklist (Phases 1-5) with acceptance criteria.

### Step 4: Refer to Edge Cases

During development, if you think "what if...?", check the **Edge Cases** section (14 scenarios covered).

---

## 📊 Success Metrics

**Functional:**
- All 5 bugs fixed ✓
- Users can select cards from catalog ✓
- Benefits auto-populate ✓
- Dashboard shows real user cards ✓

**Performance:**
- Catalog load <1s ✓
- My-cards load <500ms ✓

**Accessibility:**
- WCAG 2.1 Level AA pass ✓
- 0 critical violations (axe audit) ✓

**Code Quality:**
- 80%+ code coverage ✓
- TypeScript strict mode ✓
- ESLint pass ✓

---

## 💬 Questions?

Everything is documented in the full specification. Use these search phrases:
- "How do I..." → Section: Implementation Tasks
- "What if..." → Section: Edge Cases
- "What's the API?" → Section: API Routes & Contracts
- "How do users..." → Section: User Flows & Workflows

---

## 📅 Timeline

```
Day 1-2:   Phase 1 (Database) + Phase 3 (Bug fixes) [parallel]
Day 3-4:   Phase 2 (API endpoints)
Day 5-6:   Phase 4 (Catalog UI)
Day 7:     Phase 5 (QA, testing, deployment)
Day 8:     Deploy to production
```

---

**Good luck! The spec has all the details you need.** 🚀
