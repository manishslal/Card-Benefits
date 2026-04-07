# Phase 6C: Claiming Cadence Research Findings

**Date**: April 7, 2026  
**Status**: ✅ COMPLETE  
**Source**: "Track Credit Card Benefits" Tracker Spreadsheet  
**Total Benefits Analyzed**: 87 across 15 premium cards

---

## Executive Summary

Analysis of the tracker spreadsheet reveals **5 distinct claiming cadence patterns** across all credit card benefits. The most critical finding: **Amex Platinum benefits use strict monthly/quarterly windows where unused amounts expire immediately**, creating real user financial loss.

---

## Claiming Cadence Taxonomy

### 1. **MONTHLY Cadence** (Hard Monthly Expiration)

**Pattern**: Fixed amount per month, expires at month-end

**Amex Platinum Examples**:
- **Uber Credits**: $15/month (Jan-Oct) + $35 Dec = $180/year
- **Entertainment/Streaming**: $20-25/month = $300/year
- **Saks**: $10/month (varies)

**Key Behaviors**:
- Amount available resets on 1st of every month
- Any unused amount is LOST on month-end
- No carryover to next month
- User loses ~$15-25 per missed month

**Dashboard Priority**: 🔴 **CRITICAL** - Most likely to be lost
- Show: "⏰ $15 available THIS MONTH (29 days left!)"
- Countdown: "Only 3 days left to use your Uber credit"
- Warning: "You've skipped Feb Uber credit - you lost $15"

---

### 2. **QUARTERLY Cadence** (Hard Quarterly Expiration)

**Pattern**: Fixed amount per quarter, expires at quarter-end

**Amex Platinum Examples**:
- **Lululemon**: $75 per quarter (unusual split: Q1/Q2/Q3 = Sept 18-Dec 31 split into 2 windows)
- **Dining Credit**: $100 per quarter (Sept 18-Sept 30, then Oct 1-Dec 31)

**Key Behaviors**:
- Amount resets on 1st of each quarter OR on Amex custom date (Sept 18)
- Any unused amount is LOST at quarter-end
- No carryover to next quarter
- Amex uses non-standard quarter split (Sept 18 transition)

**Dashboard Priority**: 🟠 **HIGH** - Quarterly reset confusion
- Show: "⏰ $75 available THIS QUARTER (18 days left!)"
- Show actual window: "Sept 18 - Sept 30 (only 2 weeks)"
- Warn: "Quarterly window ends soon - you have $75 to claim"

---

### 3. **SEMI-ANNUAL Cadence** (Period-Based Expiration)

**Pattern**: Fixed amount per half-year, expires at period-end

**Amex Platinum Examples**:
- **Hotel Credit H1**: $200 Jan 1-Sept 17
- **Hotel Credit H2**: $300 Sept 18-Dec 31 (note: higher amount in H2)
- **Saks H1**: $50 Jan 1-June 30
- **Saks H2**: $50 July 1-Dec 31

**Key Behaviors**:
- Resets twice per year (not aligned to calendar half)
- Amex Platinum uses Sept 18 as mid-year boundary (card anniversary related)
- Any unused amount is LOST at period-end
- H2 Hotel credit is higher ($300 vs $200)

**Dashboard Priority**: 🟡 **MEDIUM** - Semi-annual is less intuitive
- Show: "⏰ $200 available H1 (74 days left!)"
- Clarify: "Period: Jan 1 - Sept 17"
- Warn: "Hotel credit H1 expires Sept 17 - you have $200 to claim"

---

### 4. **FLEXIBLE ANNUAL Cadence** (Anytime During Year)

**Pattern**: Full amount available throughout year, expires Dec 31

**Examples** (Most forgiving cards):
- **Amex Platinum**: Airline Fee ($200), CLEAR ($209), Equinox ($300), Walmart+ ($155)
- **Chase Sapphire Reserve**: Travel ($300), Dining ($300), Hotel ($250)
- **Capital One Venture X**: Travel ($300)
- **Delta SkyMiles Reserve**: Airline Fee ($200)

**Key Behaviors**:
- User can claim full amount anytime during calendar year
- No monthly/quarterly limits
- Amount rolls over Jan 1 (full reset)
- Most forgiving for busy cardholders
- User can batch claims strategically

**Dashboard Priority**: 🟢 **LOW** - Minimal urgency
- Show: "✓ $300 available anytime (9 months left)"
- No countdown needed
- Simple progress bar showing % used

---

### 5. **ONE-TIME Credits** (Non-Recurring)

**Pattern**: Single-use benefit, doesn't renew

**Examples**:
- Global Entry/TSA PreCheck ($100-109 per 4-5 years)
- Enrollment bonuses
- Initial setup credits

**Key Behaviors**:
- Can only be used once
- Doesn't renew annually
- Expires after use or at program end

**Dashboard Priority**: 🟡 **MEDIUM** - Set and forget
- Show: "One-time credit: $109 (expires 2030)"
- Checkbox: "✓ Used" or "○ Available"

---

## By-Card Claiming Cadence Breakdown

### **Amex Platinum 2025** (HIGH COMPLEXITY)

| Benefit | Amount | Cadence | Window | Notes |
|---------|--------|---------|--------|-------|
| Airline Fee | $200 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Can claim anytime |
| Hotel Credit H1 | $200 | SEMI_ANNUAL | Jan 1-Sept 17 | Then $300 H2 |
| Hotel Credit H2 | $300 | SEMI_ANNUAL | Sept 18-Dec 31 | Increased amount |
| Entertainment | $300 | MONTHLY | Jan-Dec ($20-25/mo) | ⚠️ HIGH LOSS RISK |
| Dining Credit | $400 | QUARTERLY | Split at Sept 18 | $100 per period |
| Lululemon | $300 | QUARTERLY | Split at Sept 18 | $75 per period |
| Saks Fifth Avenue | $100 | SEMI_ANNUAL | H1/H2 split | $50 each |
| Uber Credits | $180 | MONTHLY | Jan-Oct ($15/mo), $35 Dec | ⚠️ HIGH LOSS RISK |
| CLEAR Membership | $209 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Annual membership |
| Equinox | $300 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Gym membership |
| Walmart+ | $155 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Can claim once/use annually |
| Cell Phone Insurance | N/A | ONE-TIME | Activation | Single claim |
| Platinum Lounges | N/A | FLEXIBLE_ANNUAL | All year | Access benefit |

**Amex Complexity**: Mix of MONTHLY (hardest), QUARTERLY, SEMI_ANNUAL, and FLEXIBLE. Users need dashboard guidance for each.

---

### **Chase Sapphire Reserve 2025** (LOW COMPLEXITY)

| Benefit | Amount | Cadence | Window | Notes |
|---------|--------|---------|--------|-------|
| Travel Credit | $300 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Anytime |
| Dining Credit | $300 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Anytime |
| Hotel Credit | $250 | FLEXIBLE_ANNUAL | Jan 1-Dec 31 | Anytime |
| Global Entry/TSA | $100 | ONE-TIME | Per 4-5 years | Reimburses once |

**Chase Simplicity**: All annual credits are FLEXIBLE. Much more forgiving.

---

### **Other Premium Cards** (SIMPLE)

- **Capital One Venture X**: $300 Travel (FLEXIBLE_ANNUAL)
- **Delta SkyMiles Reserve**: $200 Airline (FLEXIBLE_ANNUAL)
- **American Express Gold**: $120 Dining (FLEXIBLE_ANNUAL)

---

## Financial Impact: Loss Analysis

### **Worst Case: Amex Platinum Monthly Misses**

```
Monthly Benefits (Expiration Risk):
- Uber: $15/month × 12 = $180 (lose all if monthly misses)
- Entertainment: $20/month × 12 = $240 (lose all if monthly misses)

Annual Loss if user misses just 3 months:
- Uber: $45 lost
- Entertainment: $60 lost
- Total: $105/year lost (real money)

This tracker helps users NEVER miss these amounts.
```

### **Medium Case: Amex Quarterly Misses**

```
Quarterly Benefits:
- Lululemon: $75/quarter × 4 = $300 (lose if quarterly misses)
- Dining: $100/quarter × 4 = $400 (lose if quarterly misses)

If user misses Q1:
- Lululemon: $75 lost
- Dining: $100 lost
- Total: $175 lost just in Q1
```

---

## Data Model Requirements

Based on research findings, Phase 6C requires:

### **New Prisma Fields**

```prisma
model MasterBenefit {
  // ... existing fields ...
  
  // ADDED for Phase 6C
  claimingCadence: String // MONTHLY | QUARTERLY | SEMI_ANNUAL | ANNUAL | ONE_TIME | FLEXIBLE_ANNUAL
  claimingAmount: Int     // Amount per period in cents (0 for FLEXIBLE_ANNUAL)
  claimingWindowEnd: String?  // For custom windows (e.g., "0918" for Sept 18)
}
```

### **Migration Strategy**

```sql
-- Add new columns
ALTER TABLE "MasterBenefit" ADD COLUMN "claimingCadence" VARCHAR(50);
ALTER TABLE "MasterBenefit" ADD COLUMN "claimingAmount" INTEGER DEFAULT 0;
ALTER TABLE "MasterBenefit" ADD COLUMN "claimingWindowEnd" VARCHAR(10);

-- Map values from research
UPDATE "MasterBenefit" 
SET claimingCadence = 'MONTHLY', claimingAmount = 1500 
WHERE benefit_id IN (SELECT id FROM ubercredits);  -- $15/month

UPDATE "MasterBenefit" 
SET claimingCadence = 'QUARTERLY', claimingAmount = 7500 
WHERE benefit_id IN (SELECT id FROM lululemon);  -- $75/quarter
```

---

## Dashboard UX Requirements

### **For Monthly Benefits (Most Urgent)**

```
┌─────────────────────────────────────────┐
│ Uber Credits - Amex Platinum            │
├─────────────────────────────────────────┤
│ ⏰ $15 available THIS MONTH             │
│ ├─ Expires: Mar 31, 2026 (3 days left!) │
│ └─ Monthly Limit: $15 max               │
│                                         │
│ Usage History:                          │
│ ├─ Jan: ✓ $15 (Full)                   │
│ ├─ Feb: ✓ $15 (Full)                   │
│ ├─ Mar: ⚠️  $0 (NOT CLAIMED - LOST)    │
│ └─ Apr: ○ $15 (Available)               │
│                                         │
│ [Claim Now]  [History]                  │
└─────────────────────────────────────────┘
```

### **For Quarterly Benefits**

```
┌─────────────────────────────────────────┐
│ Lululemon - Amex Platinum               │
├─────────────────────────────────────────┤
│ ⏰ $75 available THIS QUARTER           │
│ ├─ Window: Sept 18 - Sept 30, 2026      │
│ ├─ Expires in: 2 weeks (14 days)        │
│ └─ Quarterly Limit: $75 max             │
│                                         │
│ Q1 (Sept 18-Dec 31): ✓ $75              │
│ Q2 (Jan 1-Mar 31): ○ Not yet available  │
│                                         │
│ [Claim Now]  [History]                  │
└─────────────────────────────────────────┘
```

### **For Flexible Benefits (Least Urgent)**

```
┌─────────────────────────────────────────┐
│ Airline Fee Credit - Amex Platinum      │
├─────────────────────────────────────────┤
│ ✓ $200 available anytime                │
│ ├─ Expires: Dec 31, 2026 (9 months)     │
│ └─ Flexible: No monthly/quarterly limit │
│                                         │
│ Progress: ▓▓░░░░░░░░ 40% ($80 used)     │
│                                         │
│ [Claim Now]  [History]                  │
└─────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. **Aggressive Notifications for MONTHLY Benefits**
- Email/SMS reminder on 25th of each month
- Dashboard badge: "⏰ 5 days left!"
- In-app notification if user hasn't used monthly credit by 26th

### 2. **Calendar Integration for QUARTERLY/SEMI-ANNUAL**
- Show actual window dates (not just "Q1", "Q2")
- Highlight when quarter transitions (e.g., Sept 18 for Amex)
- Alert when window is within 7 days of expiration

### 3. **Loss Tracking**
- Track and display missed benefits
- Show "You lost $60 in Entertainment credits this year"
- Motivate users to prevent future loss

### 4. **Simplify Flexible Annual**
- Show as simple progress bars
- No countdown urgency needed
- Group at bottom of dashboard

---

## Implementation Sequence

1. **Update Prisma Schema** → Add claimingCadence + claimingAmount
2. **Create Migration** → Add columns, populate from research data
3. **Update Seed Data** → All 87 benefits get claiming cadence values
4. **Fix Utilities** → calculateAmountPerPeriod() uses stored claimingAmount
5. **Update Dashboard** → Show cadence-specific UI per benefit
6. **Update Modal** → Enforce claiming limits, show expiration
7. **Add Notifications** → Monthly reminders, quarterly alerts
8. **Historical View** → Show which benefits user missed

---

## Success Criteria

- [ ] All 87 benefits have claimingCadence populated
- [ ] All 87 benefits have claimingAmount populated
- [ ] Dashboard shows "⏰ $X available THIS MONTH" for monthly benefits
- [ ] Dashboard shows countdown for quarterly/semi-annual benefits
- [ ] Modal prevents claiming over claimingAmount
- [ ] Historical view shows missed benefits
- [ ] User can see period-specific usage (Jan: $X, Feb: $Y, etc.)
- [ ] Amex Platinum monthly benefits are tracked with aggressive reminders

---

## Open Questions (Resolved by Research)

✅ **Do most benefits have monthly limits?**  
Answer: Only Amex Platinum Entertainment and Uber have strict monthly limits.

✅ **Do quarterly benefits actually expire?**  
Answer: Yes - Lululemon, Dining, and Saks quarters have hard expiration.

✅ **When do credits reset?**  
Answer: Mostly Jan 1, but Amex Platinum uses Sept 18 for H1/H2 split.

✅ **Are there benefits with split cadences?**  
Answer: Yes - Amex Platinum Hotel ($200 H1, $300 H2) and Uber ($15/mo Jan-Oct, $35 Dec).

---

## Phase 6C → Phase 7 Preview

Once claiming cadences are implemented, future phases could include:

- **Smart Claiming Recommendations**: "Use Lululemon credit by Sept 30"
- **Predictive Loss Warnings**: "You're on track to lose $180 in Uber credits this year"
- **Optimization Suggestions**: "Consider these merchants for Entertainment credit"
- **Historical Analytics**: "You've claimed 95% of available benefits (vs 45% industry avg)"

---

## Files to Update

1. **prisma/schema.prisma** - Add claimingCadence, claimingAmount fields
2. **scripts/seed-premium-cards.js** - Add claiming values for all 68 benefits
3. **prisma/seed.ts** - Add claiming values for all 19 master catalog benefits
4. **src/lib/benefit-period-utils.ts** - Use stored claimingAmount
5. **src/components/benefits/BenefitUsageProgress.tsx** - Show cadence-specific urgency
6. **src/components/benefits/MarkBenefitUsedModal.tsx** - Enforce claiming limits
7. **src/app/api/benefits/usage/route.ts** - Validate against claimingAmount

---

## Reference: Actual Spreadsheet Data

The "Track Credit Card Benefits" spreadsheet includes:
- **Amex Platinum 2025**: Rows with monthly windows (Jan-Dec Uber, Entertainment)
- **Amex Platinum 2024**: Previous year benefits for historical comparison
- **Chase Sapphire Reserve**: All annual flexible credits
- **Capital One Venture X**: Annual flexible travel credit
- **Multiple other premium cards**: Each with distinct claiming patterns

Example spreadsheet rows:
- "Uber January" | Jan 1 - Jan 31 | $15 | MONTHLY
- "Entertainment January" | Jan 1 - Jan 31 | $20 | MONTHLY
- "Dining Credit #1" | Sept 18 - Sept 30 | $100 | QUARTERLY
- "Hotel Credit H1" | Jan 1 - Sept 17 | $200 | SEMI_ANNUAL
- "Airline Credit" | Jan 1 - Dec 31 | $200 | FLEXIBLE_ANNUAL

---

**Status**: Ready for Phase 6C Implementation  
**Next Step**: Begin schema updates and database migration
