# Phase 6B: Benefit Cadence Migration Plan

## Overview
Phase 6 implemented period-based benefit tracking, but uses a newer cadence enum than what's currently in the database. This phase maps old cadences to new ones and updates all data.

## Current State Analysis

### Database Has (5 values)
```
CalendarYear      → Maps to: ANNUAL (resets Jan 1)
CardmemberYear    → Maps to: ANNUAL (resets on card anniversary)
FirstYear         → Maps to: ANNUAL (only in first year, then ANNUAL)
TripBased         → Maps to: CUSTOM (non-resetting, used per-trip)
None              → Maps to: CUSTOM (never resets)
```

### System Expects (5 values)
```
MONTHLY           → 1st to last of each month
QUARTERLY         → Q1, Q2, Q3, Q4
SEMI_ANNUAL       → Jan-Jun, Jul-Dec
ANNUAL            → Calendar year or card anniversary
CUSTOM            → Special/future handling
```

## Migration Strategy

### Phase 6B-1: Research (In Progress)
- [ ] Identify which benefits are truly monthly
- [ ] Identify which are quarterly
- [ ] Identify which are semi-annual
- [ ] Identify which are annual (calendar vs anniversary)
- [ ] Document findings with sources

### Phase 6B-2: Create Mapping Table
```typescript
// Mapping: (currentCadence, benefit.name) → newCadence

// Example mappings to implement:
const cadenceMap = {
  // Annual benefits (most common)
  'Amex Platinum: $300 Travel Credit': 'ANNUAL',  // Calendar year
  'Amex Platinum: $600 Hotel Credit': 'ANNUAL',   // Calendar year
  
  // MONTHLY benefits (these are the unique ones!)
  'Amex Platinum: $15 UberEats': 'MONTHLY',       // $15/month not $200/year
  'Amex Platinum: Saks': 'MONTHLY',               // Often $50/month, not $600/year
  
  // One-time / Trip-based (keep as CUSTOM for now)
  'Trip Cancellation Insurance': 'CUSTOM',
  'Lost Luggage Reimbursement': 'CUSTOM',
  
  // Non-resetting
  '3x Points': 'CUSTOM',
};
```

### Phase 6B-3: Update Seed Data
1. Modify `scripts/seed-premium-cards.js`
2. Update `resetCadence` for each benefit based on mapping
3. Add comments explaining why each cadence is assigned

### Phase 6B-4: Create Migration Script
```sql
-- Migration: Update resetCadence values
UPDATE "MasterBenefit"
SET "resetCadence" = 'ANNUAL'
WHERE "resetCadence" IN ('CalendarYear', 'CardmemberYear');

UPDATE "MasterBenefit"
SET "resetCadence" = 'CUSTOM'
WHERE "resetCadence" IN ('TripBased', 'None', 'FirstYear');

UPDATE "MasterBenefit"
SET "resetCadence" = 'MONTHLY'
WHERE "name" LIKE '%UberEats%' OR "name" LIKE '%Saks%';
```

### Phase 6B-5: Testing
- [ ] Verify all benefits have valid resetCadence (MONTHLY|QUARTERLY|SEMI_ANNUAL|ANNUAL|CUSTOM)
- [ ] Test MarkBenefitUsedModal with monthly benefit
- [ ] Test period selector generates correct months
- [ ] Test amount calculation divides correctly
- [ ] Test dashboard displays all benefits properly

## Key Benefits Research Questions

### American Express Platinum ($695/year)
- [ ] UberEats: $200 annual or $15/month?
- [ ] Saks Fifth Avenue: $100 annual or $50/month?
- [ ] Airline Fee: $200 annual, resets when (calendar or anniversary)?
- [ ] Hotel Credit: $200 annual, resets when?
- [ ] Clear: $189 annual or monthly?
- [ ] Lululemon: $100 annual or monthly?

### American Express Gold ($250/year)
- [ ] Dining Credit: Annual or split?
- [ ] Airline Fee: Annual reset?

### American Express Centurion (Black Card)
- [ ] Benefits: Mostly annual or mixed?

### Chase Premium Cards
- [ ] Travel Credit: Annual or split?
- [ ] Lounge Access: Annual or membership-based?

### Other Cards
- [ ] Similar pattern: Most benefits are annual?

## Implementation Workflow

```
Phase 6B-1: Research Agent
  ↓
  → Document findings
  → Create cadence mapping

Phase 6B-2: Create Migration Script
  ↓
  → Update seed data
  → Create database migration

Phase 6B-3: Apply Migration
  ↓
  → Reseed database
  → Verify all cadences valid

Phase 6B-4: End-to-End Testing
  ↓
  → Test dashboard display
  → Test period selector
  → Test amount calculations

Phase 6B-5: Commit & Verify
  ↓
  → Git commit with cadence updates
  → Verify Phase 6 features work
```

## Expected Outcomes

After Phase 6B:
- ✅ All benefits have correct cadences
- ✅ Dashboard displays monthly benefits separately from annual
- ✅ Users can claim $15 UberEats per month
- ✅ Period selector works for all benefit types
- ✅ Historical tracking works for all cadences

## Files to Create/Modify

1. **scripts/cadence-migration.sql** (NEW)
   - Database migration to update resetCadence

2. **scripts/seed-premium-cards.js** (UPDATE)
   - Add correct resetCadence for each benefit
   - Add comments explaining rationale

3. **PHASE6B-RESEARCH-FINDINGS.md** (NEW)
   - Document research results
   - List sources for each cadence assignment

4. **PHASE6B-IMPLEMENTATION-REPORT.md** (NEW)
   - Track what was updated
   - Verify all tests pass

## Risk Assessment

**Low Risk** - This is primarily a data migration
- No new code
- No API changes
- No schema changes (resetCadence already exists)
- Pure data update

**Mitigation**
- Keep backup of original seed data
- Verify each update with SELECT query
- Test with small subset first
- Full database backup before migration
