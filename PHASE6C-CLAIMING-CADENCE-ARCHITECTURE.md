# Phase 6C: Benefit Claiming Cadence - Critical Architecture Update

## Executive Summary

Phase 6 was partially designed on **incomplete requirements**. We need to distinguish between:

1. **Reset Cadence** (When the benefit renews)
2. **Claiming Cadence** (How often you can use it, and losing unused amounts)

This is the **key differentiator** that makes this tracker genuinely unique.

---

## The Critical Insight

### What We Thought Phase 6 Did
User gets Amex Platinum Entertainment $300 credit:
- Dashboard shows: "$300 available for 2026"
- User can claim $100 in Jan, $50 in Feb, $150 in June
- Flexibility throughout the year
- Partial claims accumulate

### What Phase 6 Actually Needs To Do
User gets Amex Platinum Entertainment $300 credit:
- Dashboard shows: "**$25 available THIS MONTH** (expires midnight, 3/31/26)"
- User MUST claim by end of month or lose $25
- Next month: Fresh $25 available (total annual max: $300)
- January: $25 available (claim or lose)
- February: $25 available (claim or lose) 
- ...repeat for 12 months
- **This is a completely different UX requirement**

---

## Real-World Examples (What We Need To Track)

### American Express Platinum ($895 annual)

| Benefit | Annual | Claiming Cadence | Per-Period Amount | Expires | Notes |
|---------|--------|------------------|-------------------|---------|-------|
| Entertainment Credit | $300 | MONTHLY | $25 | End of month | Must use by 31st |
| Lululemon Credit | $300 | QUARTERLY | $75 | End of quarter | Q1: Mar 31, Q2: Jun 30, etc |
| Hotel Credit | $600 | MONTHLY | $50 | End of month | Must use by 31st |
| Dining (Resy) | $400 | MONTHLY | ? | End of month | Need research |
| Uber Credit | $200 | MONTHLY | $16.67 | End of month | Need research |
| CLEAR Credit | $209 | ANNUAL | $209 | Dec 31 | Use anytime in year |
| Lululemon Invite | $200 | One-time | $200 | Single expiration | Use once per year or specific date? |

### Chase Sapphire Reserve ($795 annual)

| Benefit | Annual | Claiming Cadence | Per-Period Amount | Expires | Notes |
|---------|--------|------------------|-------------------|---------|-------|
| Travel Credit | $300 | Flexible? | ? | Dec 31? | Need research |
| Hotel Credit | $250 | ? | ? | ? | Need research |
| Dining Credit | $300 | ? | ? | ? | Need research |
| Entertainment Credit | $300 | ? | ? | ? | Need research |

---

## Data Model Impact

### Current Schema (Incomplete)
```typescript
model MasterBenefit {
  id              String
  name            String
  stickerValue    Int       // Annual amount in cents
  resetCadence    String    // ANNUAL | CUSTOM | etc
}
```

### Required Schema (Complete)
```typescript
model MasterBenefit {
  id                String
  name              String
  stickerValue      Int       // Annual amount in cents ($300 = 30000)
  resetCadence      String    // ANNUAL (resets Jan 1 or anniversary)
  
  claimingCadence   String    // MONTHLY | QUARTERLY | SEMI_ANNUAL | ANNUAL | FLEXIBLE | ONE_TIME
  claimingAmount    Int       // Amount available per period in cents ($25 = 2500)
  expiresAt         String    // END_OF_MONTH | END_OF_QUARTER | END_OF_YEAR | etc
}
```

### Examples
```typescript
// Amex Entertainment $300/year, $25/month max
{
  name: "Entertainment Credit",
  stickerValue: 30000,
  resetCadence: "ANNUAL",
  claimingCadence: "MONTHLY",
  claimingAmount: 2500,      // $25/month
  expiresAt: "END_OF_MONTH"
}

// Amex Lululemon $300/year, $75/quarter max
{
  name: "Lululemon Credit",
  stickerValue: 30000,
  resetCadence: "ANNUAL",
  claimingCadence: "QUARTERLY",
  claimingAmount: 7500,      // $75/quarter
  expiresAt: "END_OF_QUARTER"
}

// Chase Global Entry $105 one-time
{
  name: "Global Entry or TSA PreCheck",
  stickerValue: 10500,
  resetCadence: "CUSTOM",
  claimingCadence: "ONE_TIME",
  claimingAmount: 10500,     // Full amount, use once
  expiresAt: "FOUR_YEARS"
}
```

---

## Dashboard UX Transformation

### Before (Incomplete)
```
Hotel Credit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$600 available for 2026
▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░ 30% claimed

[Claim This Benefit] [View History]
```

### After (Complete) - Must Show Time-Based Urgency
```
Hotel Credit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ $50 AVAILABLE THIS MONTH
   Expires: March 31, 2026 (5 days left!)
   
   ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ $0 claimed this month
   
   📅 2026 Annual Progress:
   Jan: $50 ✓ claimed
   Feb: $50 ✓ claimed
   Mar: $0 ⚠️ UNCLAIMED - WILL LOSE!
   
   [CLAIM NOW] [View History] [Why it expires?]

Monthly Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apr: Fresh $50 available
May: Fresh $50 available
... (remaining months)

⚠️  WARNING: Unused monthly credits expire at end of month.
    You cannot carry over to next month.
```

---

## Phase 6C Architecture Changes

### 1. Utilities Need Updating
**Before:**
```typescript
calculateAmountPerPeriod(annualAmount, cadence) {
  if (cadence === 'ANNUAL') return annualAmount;
  if (cadence === 'MONTHLY') return annualAmount / 12;
  // ...
}
```

**After:**
```typescript
// Use actual claiming cadence and amount, not calculated
calculateAmountPerPeriod(benefit, period) {
  if (benefit.claimingCadence === 'ONE_TIME') return benefit.claimingAmount;
  if (benefit.claimingCadence === 'MONTHLY') return benefit.claimingAmount;
  // ...use stored claimingAmount, not calculated
}
```

### 2. Validation Changes
**New Validation:**
```typescript
// User tries to claim $100 Entertainment in January
// Current period = January, claimingAmount = $2500 ($25)

if (claimAmount > benefit.claimingAmount) {
  throw Error("Cannot claim more than $25 this month");
}

// Check expiration
if (period !== currentPeriod && benefit.claimingCadence === 'MONTHLY') {
  throw Error("Cannot claim past periods (expired)");
}
```

### 3. Dashboard Components Update
New component: `<BenefitMonthlyCountdown />`
- Show current period deadline
- Warn about loss if unclaimed
- Show remaining periods in year
- Highlight months with unclaimed amounts

### 4. Modal UX Changes
```
Modal: Claim Entertainment Credit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: March 2026 (Current)
Available: $25 max
⏰ Expires: March 31, 2026 (5 days)

Amount to Claim: [  25  ] ← Cannot exceed $25
Notes: Dinner at Italian restaurant

[CLAIM] [CANCEL]

ℹ️  Unused amounts expire at end of month and cannot be
   carried to the next month. Claim what you can today!
```

---

## Implementation Priority

### Blocker Issues (Must Fix for Dashboard to Work Correctly)
1. ❌ Data model missing `claimingCadence` field
2. ❌ Seed data lacks claiming cadence information for all 87 benefits
3. ❌ Phase 6 utilities assume calculated amounts, not stored amounts
4. ❌ Validation doesn't prevent over-claiming per period
5. ❌ Dashboard doesn't show period expiration urgency

### Nice-to-Have (Can Come Later)
- Analytics: Most/least claimed benefits
- Recommendations: "You have 3 days left to use $25"
- Alerts: Email when $X credit about to expire
- Mobile optimization for deadline pressure

---

## Research Required (Phase 6C-1)

From the tracker spreadsheet, we need:

For **EACH benefit**, determine:
1. ✓ Annual Amount (e.g., $300)
2. ✗ Claiming Cadence (MONTHLY/QUARTERLY/etc) - **NEED**
3. ✗ Claiming Amount per period (e.g., $25/month) - **NEED**
4. ✗ Expiration rule (end of month/quarter/year?) - **NEED**
5. ✗ Reset date (calendar or card anniversary?) - **NEED**

Example research output:
```
Amex Platinum Hotel Credit:
  Annual: $600
  Claiming Cadence: MONTHLY
  Claiming Amount: $50/month
  Expires: End of calendar month
  Resets: Jan 1 (calendar year)
  → Interpretation: $50 available each month, expires midnight on 31st
```

---

## Why This Matters

### User Value
- **Urgency**: "You have 5 days to use $25 or lose it"
- **Clarity**: See exactly what's available this month vs future
- **Accountability**: Track which credits they're missing
- **ROI Proof**: "This $300 credit required precise monthly tracking to fully capture"

### Competitive Advantage
- **No other tracker shows this level of detail**
- **Most trackers treat benefits as annual lump sums**
- **This tracker tracks the ACTUAL way benefits work**
- **User can actually maximize credit utilization**

### Technical Complexity
- Requires understanding card issuer fine print
- Demands precise period-based calculations
- Needs urgent UX to prevent missed credits
- Must handle multiple cadence types simultaneously

---

## Conclusion

Phase 6B fixed the reset cadence issue (ANNUAL vs MONTHLY semantics).

**Phase 6C must fix the claiming cadence issue** (showing users exactly what's available THIS PERIOD and when it expires).

This is what separates a generic benefit tracker from a **truly valuable financial tool**.

The Google Sheet is the source of truth. Once we extract the claiming cadence for each benefit, we can build the complete system.

---

## Next Steps

1. ✓ Identify data model gap (claimingCadence field needed)
2. ⏳ Research claiming cadences from tracker spreadsheet
3. ⏳ Update Prisma schema with new fields
4. ⏳ Create database migration
5. ⏳ Update seed data with claiming cadences
6. ⏳ Revise Phase 6 utilities to use claiming amounts
7. ⏳ Update dashboard components for period-based urgency
8. ⏳ Update modal with claiming limits and expiration warnings
9. ⏳ Test end-to-end with correct constraints

---

**Status**: Phase 6C Research In Progress
**Blocker**: Need complete claiming cadence data from tracker spreadsheet
**Next Review**: After research agent completes analysis
