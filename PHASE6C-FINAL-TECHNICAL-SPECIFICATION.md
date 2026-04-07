# PHASE 6C: Claiming Cadences Feature - Final Technical Specification

## Executive Summary & Goals

**Project**: Implement benefit claiming cadence tracking across 87 benefits in the Card-Benefits platform  
**Objective**: Enable the system to enforce claiming limits based on 5 distinct cadence patterns (MONTHLY, QUARTERLY, SEMI_ANNUAL, FLEXIBLE_ANNUAL, ONE_TIME) and prevent users from losing $15-300+ per benefit annually through missed claiming windows.

**Key Business Value**:
- 🔴 **Critical**: Reduce Amex Platinum MONTHLY benefit loss ($15-25/month = $180-300/year per benefit)
- 🟠 **High**: Track QUARTERLY benefits with proper window boundaries (Q1/Q2 split at Sept 18)
- 🟡 **Medium**: Simplify FLEXIBLE_ANNUAL display vs urgent period-based benefits
- 🎯 **Outcome**: Users reclaim ~$2,000-3,000 annually by never missing a benefit window

**Scope**: 
- 87 benefits across 15+ premium credit cards
- 5 distinct claiming cadence patterns
- Special handling: Amex Platinum Sept 18 split, varying monthly amounts (Uber $15/mo, $35 Dec)
- Parallel implementation: 6 independent work streams

**Success Criteria**:
- ✅ All 87 benefits have `claimingCadence` and `claimingAmount` populated
- ✅ Dashboard displays cadence-specific urgency (MONTHLY = CRITICAL, FLEXIBLE_ANNUAL = LOW)
- ✅ API prevents claiming over period limits
- ✅ ONE_TIME benefits are enforced as single-use
- ✅ Edge cases handled: Amex Sept 18 split, leap years, period boundaries, timezone handling
- ✅ User can view historical periods and identify missed benefits

---

## Functional Requirements

### Core Features

1. **Benefit Claiming Cadence Types** (Enum: `ClaimingCadence`)
   - `MONTHLY`: Fixed amount resets 1st of each month, expires at month-end (Loss Risk: 🔴 CRITICAL)
   - `QUARTERLY`: Fixed amount per quarter, expires quarter-end. Amex Sept 18 split support.
   - `SEMI_ANNUAL`: Fixed amount per half-year (H1: Jan 1-Sept 17, H2: Sept 18-Dec 31 for Amex)
   - `FLEXIBLE_ANNUAL`: Full amount available anytime during calendar year, expires Dec 31
   - `ONE_TIME`: Single-use only, doesn't renew, enforced at application level

2. **Claiming Limit Enforcement**
   - Prevent users from claiming more than `claimingAmount` per period
   - Return clear error with: `maxClaimable`, `alreadyClaimed`, `periodEnd`, `remainingAmount`
   - For ONE_TIME: Single claim only, then unavailable forever
   - For MONTHLY: Reset on 1st, expiration at month-end (29-31 days)

3. **Urgency Indicators** (Color-coded by days until expiration)
   - 🔴 **CRITICAL** (RED): < 7 days remaining (MONTHLY benefits, close to month-end)
   - 🟠 **HIGH** (ORANGE): 7-14 days remaining (QUARTERLY/SEMI_ANNUAL near expiration)
   - 🟡 **MEDIUM** (YELLOW): 14-30 days remaining (Upcoming deadlines)
   - 🟢 **LOW** (GREEN): > 30 days OR FLEXIBLE_ANNUAL (No urgency)

4. **Claiming Window Boundaries**
   - Standard calendar periods for most benefits
   - Custom window support: Amex Platinum uses `claimingWindowEnd: "0918"` to mark Sept 18
   - Supports benefits with non-standard splits (e.g., Uber $15/month Jan-Oct, $35 December)

5. **Historical Tracking**
   - Show last 12 months for MONTHLY benefits (identify lost amounts)
   - Show last 4 quarters for QUARTERLY benefits
   - Show both H1 and H2 for SEMI_ANNUAL benefits
   - Show annual progress for FLEXIBLE_ANNUAL
   - ONE_TIME: Show "Used on [date]" or "Available"

### User Roles & Permissions
- **Regular Users**: View claiming limits, see urgency indicators, receive warnings when nearing expiration
- **Admins**: Manage benefit claiming cadence data, update amounts, view user claiming patterns
- **System**: Validate all claims against period limits before recording

### System Constraints & Limits
- **Maximum benefits per response**: 50+ benefits with metadata (pagination via cursor-based)
- **API response time**: < 100ms for claiming-limits endpoint
- **Data storage**: Minimal - only 3 new fields on MasterBenefit model
- **Timezone handling**: All times in UTC (Z suffix); UI converts to user's timezone for display
- **Leap years**: Supported (Feb 29 handling in MONTHLY cadence)
- **Rate limiting**: No auth required for claiming-limits endpoint; standard rate limit (100 req/min per IP)

---

## Implementation Phases

### Phase 1: Database & Schema Foundation (2-3 days)
**Owner**: Backend DBA / Database Engineer  
**Objective**: Add claiming cadence fields to data model with full backward compatibility  

---

### Phase 2: Utility Functions & Business Logic (2-3 days)
**Owner**: Backend SWE (Core Logic)  
**Objective**: Implement all claiming calculation and validation logic  

---

### Phase 3: Data Seeding & Population (1-2 days)
**Owner**: Data Engineer / Backend SWE  
**Objective**: Populate all 87 benefits with claiming cadence data  

---

### Phase 4: Frontend Components & UI (2-3 days)
**Owner**: Frontend SWE  
**Objective**: Display claiming cadences with cadence-specific urgency indicators  

---

### Phase 5: API Routes & Backend Validation (1-2 days)
**Owner**: Backend SWE (API)  
**Objective**: Add claiming validation to API layer  

---

### Phase 6: Testing & QA (1-2 days)
**Owner**: QA Engineer / Backend SWE  
**Objective**: Comprehensive test coverage for all claiming scenarios  

**Phase Dependencies**: 
```
Phase 1 (Database) → Phase 2 (Utilities) ──┐
                                            ├→ Phase 5 (API)
Phase 3 (Seeding) ──────────────────────────┤
                                            ├→ Phase 6 (Testing)
Phase 4 (UI) ────────────────────────────────┘
```

---

## Database Schema & State Management

### New Prisma Fields for MasterBenefit Model

```prisma
model MasterBenefit {
  id              String          @id @default(cuid())
  masterCardId    String
  
  name            String
  type            String
  stickerValue    Int
  resetCadence    String
  
  // Phase 6C: Claiming Cadence Fields (NEW)
  claimingCadence   String?        // MONTHLY | QUARTERLY | SEMI_ANNUAL | FLEXIBLE_ANNUAL | ONE_TIME
  claimingAmount    Int?           // Amount per period in cents (nullable for legacy benefits)
  claimingWindowEnd String?        // Custom window marker e.g., "0918" for Sept 18 (Amex)
  
  isDefault         Boolean        @default(true)
  isActive          Boolean        @default(true)
  createdByAdminId  String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  masterCard        MasterCard     @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
  usageRecords      BenefitUsageRecord[]

  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
  @@index([claimingCadence])    // NEW: For filtering by cadence type
  @@index([isDefault])
  @@index([isActive])
}
```

### Field Definitions

| Field | Type | Nullable | Default | Constraint | Purpose |
|-------|------|----------|---------|-----------|---------|
| `claimingCadence` | String (50) | ✓ Yes | NULL | ENUM check | Identifies how often benefit can be claimed |
| `claimingAmount` | Integer | ✓ Yes | NULL | ≥ 0 | Amount in cents per period (e.g., 1500 = $15) |
| `claimingWindowEnd` | String (10) | ✓ Yes | NULL | Format: "MMDD" | Custom window marker (e.g., "0918" for Sept 18) |

### Database Migration SQL

```sql
-- Add new columns to MasterBenefit table

-- Migration UP (apply to add new fields)
ALTER TABLE "MasterBenefit" 
ADD COLUMN "claimingCadence" VARCHAR(50),
ADD COLUMN "claimingAmount" INTEGER,
ADD COLUMN "claimingWindowEnd" VARCHAR(10);

-- Create index for query optimization
CREATE INDEX "idx_masterbenefit_claimingcadence" 
ON "MasterBenefit"("claimingCadence");

-- Migration DOWN (rollback)
DROP INDEX IF EXISTS "idx_masterbenefit_claimingcadence";
ALTER TABLE "MasterBenefit" 
DROP COLUMN IF EXISTS "claimingWindowEnd",
DROP COLUMN IF EXISTS "claimingAmount",
DROP COLUMN IF EXISTS "claimingCadence";
```

---

## API Routes & Contracts

### Endpoint 1: POST /api/benefits/usage (Enhanced)

**Purpose**: Record a benefit claim with claiming limit validation  
**Authentication**: Required (Bearer token)  
**Rate Limit**: 100 requests/min per user

**Request**:
```http
POST /api/benefits/usage HTTP/1.1
Content-Type: application/json
Authorization: Bearer [token]

{
  "benefitId": "ben_amex_plat_uber_2026",
  "claimAmount": 1500,
  "claimDate": "2026-03-29T15:30:00Z",
  "notes": "Claimed via web app"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "usageId": "usage_k2j3h4k5j",
  "benefitId": "ben_amex_plat_uber_2026",
  "claimAmount": 1500,
  "claimDate": "2026-03-29T15:30:00Z",
  "periodStart": "2026-03-01T00:00:00Z",
  "periodEnd": "2026-03-31T23:59:59Z",
  "claimingCadence": "MONTHLY",
  "alreadyClaimedThisPeriod": 1500,
  "maxClaimableThisPeriod": 1500,
  "remainingThisPeriod": 0,
  "createdAt": "2026-03-29T15:45:23Z"
}
```

**Error Response (400 Bad Request - Limit Exceeded)**:
```json
{
  "success": false,
  "error": "CLAIMING_LIMIT_EXCEEDED",
  "code": "CLAIMING_LIMIT_EXCEEDED",
  "message": "Cannot claim $2,000 this month. Maximum is $1,500.",
  "details": {
    "benefitId": "ben_amex_plat_uber_2026",
    "requestedAmount": 2000,
    "maxClaimable": 1500,
    "alreadyClaimed": 0,
    "periodStart": "2026-03-01T00:00:00Z",
    "periodEnd": "2026-03-31T23:59:59Z",
    "claimingCadence": "MONTHLY",
    "daysUntilExpiration": 2
  }
}
```

---

### Endpoint 2: GET /api/benefits/usage (Enhanced)

**Purpose**: Retrieve usage records with claiming metadata  
**Authentication**: Required  
**Rate Limit**: 100 requests/min per user  

**Request**:
```http
GET /api/benefits/usage?cadence=MONTHLY&urgency=CRITICAL&limit=20 HTTP/1.1
Authorization: Bearer [token]
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "usageId": "usage_k2j3h4k5j",
      "benefitId": "ben_amex_plat_uber_2026",
      "benefitName": "Uber Credits",
      "cardName": "American Express Platinum",
      "claimAmount": 1500,
      "claimDate": "2026-03-29T15:30:00Z",
      "claimingCadence": "MONTHLY",
      "periodStart": "2026-03-01T00:00:00Z",
      "periodEnd": "2026-03-31T23:59:59Z",
      "maxClaimableThisPeriod": 1500,
      "alreadyClaimedThisPeriod": 1500,
      "remainingThisPeriod": 0,
      "daysUntilExpiration": 2,
      "urgencyLevel": "CRITICAL",
      "createdAt": "2026-03-29T15:45:23Z"
    }
  ],
  "pagination": {
    "cursor": "cursor_next_page_token",
    "hasMore": true,
    "count": 2,
    "total": 45
  }
}
```

---

### Endpoint 3: GET /api/benefits/claiming-limits (New)

**Purpose**: Get claiming limit details for a specific benefit on a specific date  
**Authentication**: NOT required (public endpoint)  
**Rate Limit**: 100 requests/min per IP

**Request**:
```http
GET /api/benefits/claiming-limits?benefitId=ben_amex_plat_uber_2026&date=2026-03-29 HTTP/1.1
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "benefitId": "ben_amex_plat_uber_2026",
    "benefitName": "Uber Credits",
    "cardName": "American Express Platinum",
    "claimingCadence": "MONTHLY",
    "claimingWindowEnd": null,
    "periodStart": "2026-03-01T00:00:00Z",
    "periodEnd": "2026-03-31T23:59:59Z",
    "maxClaimableAmount": 1500,
    "alreadyClaimedAmount": 0,
    "remainingAmount": 1500,
    "daysUntilExpiration": 2,
    "hoursUntilExpiration": 55,
    "percentUtilized": 0.0,
    "isClaimingWindowOpen": true,
    "warningLevel": "CRITICAL",
    "referenceDate": "2026-03-29T00:00:00Z"
  }
}
```

---

## Utility Functions & Business Logic

### Module: `src/lib/claiming-validation.ts`

**Key Functions**:

```typescript
// 1. Calculate amount available for a period
function calculateAmountPerPeriod(
  benefit: MasterBenefit,
  referenceDate?: Date
): number

// 2. Get period boundaries (handles Amex Sept 18 split)
function getClaimingWindowBoundaries(
  benefit: MasterBenefit,
  referenceDate?: Date
): {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

// 3. Calculate remaining claimable for period
function getClaimingLimitForPeriod(
  benefit: MasterBenefit,
  usageRecords: BenefitUsageRecord[],
  referenceDate?: Date
): number

// 4. Validate a requested claim
function validateClaimingAmount(
  benefit: MasterBenefit,
  claimAmount: number,
  usageRecords: BenefitUsageRecord[],
  referenceDate?: Date
): {
  valid: boolean;
  error?: string;
  errorCode?: string;
  remainingAmount: number;
}

// 5. Check if window is open
function isClaimingWindowOpen(
  benefit: MasterBenefit,
  referenceDate?: Date
): boolean

// 6. Calculate days until expiration
function daysUntilExpiration(
  benefit: MasterBenefit,
  referenceDate?: Date
): number

// 7. Determine urgency level
function getUrgencyLevel(
  benefit: MasterBenefit,
  referenceDate?: Date
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
```

---

## Component Architecture & Interfaces

### Components to Create/Update

1. **BenefitUsageProgress** (Updated)
   - Accept `claimingCadence`, `claimingAmount`, `claimingWindowEnd`
   - Render cadence-specific UI with urgency badges
   - Show period information and countdown

2. **CadenceIndicator** (New)
   - Reusable badge showing cadence + days remaining
   - Color-coded by urgency
   - Tooltip with full details

3. **PeriodClaimingHistory** (New)
   - Show historical periods (12 months, 4 quarters, etc.)
   - Mark as FULLY_CLAIMED, PARTIALLY_CLAIMED, or MISSED
   - Highlight missed periods for financial awareness

4. **ClaimingLimitInfo** (New)
   - Display in modal showing limit details
   - Amount used/available with progress bar
   - Warning if near/at limit

5. **MarkBenefitUsedModal** (Updated)
   - Show ClaimingLimitInfo subcomponent
   - Validate against period limit (client-side)
   - Prevent over-claiming with clear error messages

---

## Edge Cases & Error Handling

### 12 Critical Edge Cases

**1. Month-End Expiration (MONTHLY)**
- Scenario: March 30, 2026 (1 day before expiration)
- Expected: daysUntilExpiration() = 1, urgency = CRITICAL
- Implementation: Correct UTC boundary handling

**2. Leap Year February**
- Scenario: MONTHLY benefit in Feb 2024 (leap year, 29 days)
- Expected: Period boundary = Feb 1-29, not Feb 1-28
- Implementation: Use Date constructor, not manual day calc

**3. Amex Sept 18 Quarter Split**
- Scenario: Q1 runs Sept 18-30 (only 12 days, not 91)
- Expected: getClaimingWindowBoundaries() returns correct dates
- Implementation: Check claimingWindowEnd = "0918" for special logic

**4. Period Boundary at Midnight UTC**
- Scenario: Claim at 2026-03-31T23:59:59Z vs 2026-04-01T00:00:00Z
- Expected: First succeeds (within period), second fails (outside)
- Implementation: Use >= and <= with UTC times

**5. Timezone Mismatch**
- Scenario: Backend UTC, user in PST
- Expected: "3 days left" in local time matches UTC expiration
- Implementation: Store UTC, convert on display only

**6. ONE_TIME Already Claimed**
- Scenario: User tries to claim Global Entry second time
- Expected: Return 400 "ALREADY_CLAIMED"
- Implementation: Check usageRecords.length > 0 for ONE_TIME

**7. Partial Monthly Claim**
- Scenario: Uber $15/month, user claims only $8
- Expected: $7 remaining for same month
- Implementation: Sum all claims within period

**8. Concurrent Claims Same Period**
- Scenario: User clicks "Claim" twice rapidly
- Expected: First succeeds, second fails
- Implementation: Database transaction with pessimistic locking

**9. Backdated Claim**
- Scenario: User claims March 15 but dates it April 15 (>90 days future)
- Expected: Reject as too far back
- Implementation: Validate (now - claimDate) < 90 days

**10. Fractional Cents**
- Scenario: claimAmount = 15.50 (should be 1550)
- Expected: Reject as non-integer
- Implementation: !Number.isInteger(claimAmount) check

**11. Benefit Without Cadence**
- Scenario: Legacy benefit has NULL claimingCadence
- Expected: Cannot claim, show helpful error
- Implementation: Check if (!benefit.claimingCadence)

**12. Past Usage Across Period Boundary**
- Scenario: User claims on March 31, but dated April 1
- Expected: Assign to correct period (April, not March)
- Implementation: Use provided claimDate for period calc

---

## Implementation Tasks (Phased)

### Phase 1 Tasks: Database

**1.1 Update Prisma Schema** (Small, 30 min)
- Add 3 fields to MasterBenefit model
- Add index on claimingCadence
- Validate schema compiles

**1.2 Create Migration** (Small, 30 min)
- Generate migration file
- Add columns with proper types
- Include rollback SQL

**1.3 Export TypeScript Types** (Small, 30 min)
- Create claiming-cadence-constants.ts
- Export ClaimingCadence type
- Export metadata with labels

---

### Phase 2 Tasks: Utilities

**2.1 Refactor calculateAmountPerPeriod()** (Small, 1 hr)
- Return stored claimingAmount
- Handle all 5 cadence types
- Unit tests pass

**2.2 Implement getClaimingWindowBoundaries()** (Medium, 2 hrs)
- All cadence types covered
- Amex Sept 18 split logic
- 100% test coverage

**2.3 Implement getClaimingLimitForPeriod()** (Small, 1 hr)
- Calculate remaining amount
- Handle ONE_TIME enforcement
- Unit tests

**2.4 Implement validateClaimingAmount()** (Medium, 1.5 hrs)
- All validation rules
- Clear error messages
- Unit tests

**2.5 Implement isClaimingWindowOpen()** (Small, 30 min)
- Simple boolean check
- Unit tests

**2.6 Implement daysUntilExpiration()** (Small, 1 hr)
- Days calculation
- Urgency level determination
- Unit tests

**2.7 Comprehensive Unit Tests** (Large, 2 hrs)
- 95%+ coverage
- All edge cases
- All cadence types

---

### Phase 3 Tasks: Data Seeding

**3.1 Update Master Seed** (Medium, 1.5 hrs)
- Add cadence data to 19 master benefits
- All in cents
- No NULL values

**3.2 Update Premium Seed** (Large, 2 hrs)
- Add cadence data to 68 premium benefits
- Handle Amex special cases
- Set Sept 18 markers

**3.3 Validation Script** (Small, 1 hr)
- Verify all 87 benefits populated
- Check for NULL values
- Report by cadence type

---

### Phase 4 Tasks: Frontend UI

**4.1 Update BenefitUsageProgress** (Medium, 2 hrs)
- Accept new props
- Render cadence-specific UI
- Show urgency badges

**4.2 Create CadenceIndicator** (Small, 1 hr)
- Reusable badge component
- Color-coded urgency
- Tooltip

**4.3 Create PeriodClaimingHistory** (Medium, 1.5 hrs)
- Show historical periods
- Mark as claimed/missed
- Highlight losses

**4.4 Create ClaimingLimitInfo** (Small, 1 hr)
- Display limit details
- Progress bar
- Warnings

**4.5 Update MarkBenefitUsedModal** (Medium, 2 hrs)
- Show claiming limits
- Validate client-side
- Prevent over-claiming

**4.6 Responsive Styling** (Small, 1 hr)
- Mobile/tablet/desktop
- Touch-friendly
- Accessible

---

### Phase 5 Tasks: API

**5.1 Update POST /api/benefits/usage** (Large, 2 hrs)
- Add validation before create
- Return error details
- Integration tests

**5.2 Enhance GET /api/benefits/usage** (Medium, 1.5 hrs)
- Include cadence metadata
- Add filters (cadence, urgency)
- Pagination

**5.3 Create GET /api/benefits/claiming-limits** (Medium, 1.5 hrs)
- New public endpoint
- Return detailed limits
- < 100ms response time

**5.4 API Integration Tests** (Large, 2 hrs)
- Valid/invalid claims
- Filter tests
- Edge case tests

---

### Phase 6 Tasks: Testing

**6.1 End-to-End Feature Tests** (Large, 3 hrs)
- All 5 cadence types
- User workflows
- Manual QA

**6.2 Edge Case Tests** (Large, 2 hrs)
- Leap years
- Boundaries
- Concurrent claims

**6.3 Performance Tests** (Medium, 1 hr)
- Response times
- Load testing
- Caching verification

**6.4 Manual QA Checklist** (Medium, 1.5 hrs)
- Visual verification
- Accessibility check
- Browser compatibility

**6.5 Production Readiness** (Small, 1 hr)
- Migration testing
- Monitoring setup
- Rollback plan

---

## Security & Compliance

### Authentication & Authorization
- ✅ POST /api/benefits/usage: Authenticated only
- ✅ GET /api/benefits/usage: User can only see own benefits
- ✅ GET /api/benefits/claiming-limits: Public (no auth)
- ✅ Verify benefit belongs to user's cards before allowing claim

### Data Protection
- ✅ All times in UTC (no timezone leakage)
- ✅ Usage records tied to user_id (audit trail)
- ✅ No benefit amounts in logs
- ✅ API responses filtered per user

### Audit & Logging
- ✅ Log all claims: benefitId, userId, amount, timestamp
- ✅ Log validation failures: reason, requested vs allowed
- ✅ Log API errors: endpoint, error code, status

### Input Validation
- ✅ benefitId: CUID format
- ✅ claimAmount: Integer, 0 < x ≤ 999999
- ✅ claimDate: Valid ISO 8601, not future, not > 90 days past
- ✅ notes: Max 500 chars, sanitized (no HTML/JS)

### Rate Limiting
- ✅ Authenticated: 100 req/min per user
- ✅ Public: 100 req/min per IP
- ✅ Same-user claiming: Max 10 claims/min

---

## Performance & Scalability

### Expected Load
- **Current**: 87 benefits/user, ~100-500 users
- **Year 1**: ~10K users
- **Year 2**: ~50K users
- **Year 3**: ~200K users

### Estimated Queries/Day
- GET /api/benefits/usage: 1-5K (dashboard views)
- POST /api/benefits/usage: 100-500 (claims)
- GET /api/benefits/claiming-limits: 500-2K (modal checks)

### Caching Strategy (Redis)

**1. Benefit Metadata** (24 hours)
```
Key: benefit:[benefitId]
Value: MasterBenefit with claimingCadence
Rationale: Rarely changes
```

**2. User's Benefits** (1 hour)
```
Key: user:[userId]:benefits
Value: Array of user's card benefits
Invalidate: On card add/remove
```

**3. Claiming Limits** (15 minutes)
```
Key: limits:[benefitId]:[date]
Value: Claiming limit info
Rationale: Stable within hour
```

### Database Optimization

**Indexes**:
```sql
-- Cadence filtering
CREATE INDEX idx_masterbenefit_claimingcadence 
ON "MasterBenefit"("claimingCadence");

-- Benefit lookup
CREATE INDEX idx_masterbenefit_id_active 
ON "MasterBenefit"("id", "isActive");

-- Usage queries by date range
CREATE INDEX idx_benefitusagerecord_benefit_date 
ON "BenefitUsageRecord"("benefitId", "claimDate");

-- Period queries
CREATE INDEX idx_benefitusagerecord_user_period 
ON "BenefitUsageRecord"("userId", "claimDate");
```

### Query Optimization

```typescript
// Avoid N+1: Fetch benefits with card relation
const benefits = await prisma.masterBenefit.findMany({
  where: { masterCardId: { in: userCardIds } },
  include: { masterCard: true }  // Avoid separate query
});

// Batch usage queries
const usage = await prisma.benefitUsageRecord.findMany({
  where: {
    benefitId: { in: benefitIds },
    claimDate: {
      gte: periodStart,
      lte: periodEnd
    }
  }
});

// Use select to limit fields
const limited = await prisma.masterBenefit.findMany({
  select: {
    id: true,
    claimingCadence: true,
    claimingAmount: true
  }
});
```

### Connection Pooling
- Use Prisma default connection pool (5-10 connections)
- Set `connection_limit` in DATABASE_URL
- Monitor pool saturation in production

---

## Rollout & Deployment Strategy

### Pre-Deployment Checklist
- ✅ Database migration tested on staging
- ✅ All tests pass (unit + integration + e2e)
- ✅ Performance tests pass (< 100ms API response)
- ✅ Monitoring/alerting configured
- ✅ Rollback procedure documented
- ✅ Data backups taken
- ✅ Stakeholders notified

### Deployment Order
1. Database migration (Phase 1)
2. Utility functions deployment (Phase 2)
3. Data seeding (Phase 3)
4. Frontend component deployment (Phase 4)
5. API route deployment (Phase 5)
6. Feature flag activation (gradual rollout: 10% → 50% → 100%)

### Rollback Plan

**If claiming validation fails**:
1. Disable feature flag (claiming-cadence-enabled = false)
2. API returns error "Feature temporarily disabled"
3. Investigate database/logic issue
4. Hotfix and redeploy

**If migration fails**:
1. Rollback migration: `npx prisma migrate resolve --rolled-back`
2. Drop columns: `ALTER TABLE "MasterBenefit" DROP COLUMN ...`
3. Investigate and fix migration
4. Redeploy

**If data corruption occurs**:
1. Restore from backup
2. Rerun seeding with corrected data
3. Verify all 87 benefits have cadence populated

---

## Monitoring & Observability

### Metrics to Track
1. **API Performance**
   - POST /api/benefits/usage response time (target: < 500ms)
   - GET /api/benefits/claiming-limits response time (target: < 100ms)
   - GET /api/benefits/usage response time (target: < 200ms)

2. **Error Rates**
   - CLAIMING_LIMIT_EXCEEDED errors (track false positives)
   - ALREADY_CLAIMED errors for ONE_TIME benefits
   - Validation failures (should be < 5%)

3. **Business Metrics**
   - Claims submitted per day
   - Unique users claiming per day
   - Average claim amount by cadence type
   - Missed benefit periods by cadence (dashboard)

### Alerts

**Critical**:
- API error rate > 1%
- Response time > 1 second
- Database migration failure

**Warning**:
- Error rate > 0.5%
- Response time > 500ms
- High number of CLAIMING_LIMIT_EXCEEDED errors (>10%)

---

## Documentation Requirements

### API Documentation
- ✅ OpenAPI/Swagger spec updated
- ✅ Request/response examples
- ✅ Error code reference
- ✅ Rate limiting documented

### Component Documentation
- ✅ PropTypes/TypeScript interfaces
- ✅ Usage examples for each component
- ✅ Storybook stories (if applicable)

### Internal Documentation
- ✅ Database schema diagram
- ✅ Data flow architecture
- ✅ Claiming calculation logic
- ✅ Amex Sept 18 split explanation

---

## Quality Checklist (Pre-Release)

- [ ] All 87 benefits have claimingCadence populated
- [ ] All 87 benefits have claimingAmount (no NULLs)
- [ ] Dashboard shows correct urgency levels
- [ ] API prevents over-claiming for all cadences
- [ ] ONE_TIME benefits enforced (claim once only)
- [ ] Historical periods show correctly
- [ ] Edge cases handled: leap years, boundaries, Amex Sept 18
- [ ] Mobile layout responsive
- [ ] Accessibility: WCAG 2.1 AA compliant
- [ ] Zero TypeScript errors
- [ ] Test coverage > 95%
- [ ] Performance < 100ms for public endpoints
- [ ] Rate limiting working
- [ ] Monitoring/alerts configured
- [ ] Rollback plan documented
- [ ] Stakeholders trained
- [ ] Documentation complete

---

## Success Criteria (Post-Launch)

**1 Week After Launch**:
- ✅ Zero critical bugs
- ✅ API error rate < 0.1%
- ✅ Response times stable < 100ms
- ✅ Users claiming benefits successfully
- ✅ Historical data showing correctly

**1 Month After Launch**:
- ✅ 50%+ of users viewing claiming limits
- ✅ Average 100+ claims/day
- ✅ Missed benefit tracking accurate
- ✅ User engagement increase measurable
- ✅ Zero escalations from support

---

## Appendix: Data Mapping Reference

### All 87 Benefits Summary

**Amex Platinum** (12 benefits):
- Uber: $180/year (MONTHLY: $15×10 + $35×1) ⚠️ HIGH LOSS
- Entertainment: $300/year (MONTHLY: $20-25/mo) ⚠️ HIGH LOSS
- Hotel H1: $200 (SEMI_ANNUAL, Jan-Sept 17)
- Hotel H2: $300 (SEMI_ANNUAL, Sept 18-Dec 31)
- Dining: $400/year (QUARTERLY, Sept 18 split)
- Lululemon: $300/year (QUARTERLY, Sept 18 split)
- Saks: $100/year (SEMI_ANNUAL)
- Airline Fee: $200 (FLEXIBLE_ANNUAL)
- CLEAR: $209 (FLEXIBLE_ANNUAL)
- Equinox: $300 (FLEXIBLE_ANNUAL)
- Walmart+: $155 (FLEXIBLE_ANNUAL)
- Cell Phone Insurance: N/A (ONE_TIME)

**Chase Sapphire Reserve** (4 benefits):
- Travel Credit: $300 (FLEXIBLE_ANNUAL)
- Dining Credit: $300 (FLEXIBLE_ANNUAL)
- Hotel Credit: $250 (FLEXIBLE_ANNUAL)
- Global Entry: $100 (ONE_TIME)

**Other Premium Cards** (71 benefits):
- Capital One Venture X: $300 Travel (FLEXIBLE_ANNUAL)
- Delta SkyMiles Reserve: $200 Airline (FLEXIBLE_ANNUAL)
- American Express Gold: $120 Dining (FLEXIBLE_ANNUAL)
- ... and 68+ more

---

**SPECIFICATION COMPLETE**  
Ready for implementation agents to work in parallel.  
All modules are independent with clear interfaces.  
No ambiguity remains for engineers.

