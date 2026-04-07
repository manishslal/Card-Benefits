# Phase 6: Period-Based Tracking - Quick Reference

## Overview

Transform benefit tracking from annual binary (used/unused) to period-based with multiple cadences:
- **MONTHLY**: 1st to last day of month
- **QUARTERLY**: Calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)  
- **SEMI_ANNUAL**: 6-month periods (Jan-Jun, Jul-Dec)
- **ANNUAL**: Card anniversary date (customizable)

Users can claim partial amounts, view history, and edit past periods (7 years back).

## Core Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/benefit-period-utils.ts` | Period calculations, formatting, utilities | 300+ |
| `src/app/api/benefits/usage/route.ts` | POST/GET usage endpoints | 150+ |
| `src/app/api/benefits/usage/[id]/route.ts` | PATCH/DELETE endpoints | 100+ |
| `src/app/api/benefits/[benefitId]/status/route.ts` | Status endpoint | 150+ |
| `src/components/benefits/MarkBenefitUsedModal.tsx` | Claim modal component | 190 |
| `src/components/benefits/BenefitUsageProgress.tsx` | Progress bar component | 90 |
| `src/components/benefits/HistoricalUsageTab.tsx` | History table component | 200 |

## API Quick Reference

### POST /api/benefits/usage - Create claim

```bash
curl -X POST /api/benefits/usage \
  -H "Content-Type: application/json" \
  -d '{
    "userBenefitId": "ub_123",
    "userCardId": "uc_456",
    "usageAmount": 15.00,
    "notes": "Optional notes",
    "usageDate": "2026-04-15"
  }'
```

**Response**: `201 { success, record }`

---

### GET /api/benefits/usage - List claims

```bash
curl "/api/benefits/usage?page=1&limit=20&userBenefitId=ub_123"
```

**Query Params**:
- `page` - Page number (1-indexed)
- `limit` - Items per page (1-100, default 20)
- `userBenefitId` - Filter by benefit
- `sortBy` - "usageDate" or "usageAmount"
- `sortOrder` - "asc" or "desc"

**Response**: `200 { success, data, pagination }`

---

### GET /api/benefits/[benefitId]/status - Get status

```bash
curl "/api/benefits/ub_123/status?userCardId=uc_456"
```

**Response (200)**:
```json
{
  "success": true,
  "benefit": {...},
  "currentPeriod": {
    "amountAvailable": 1667,
    "amountClaimed": 1500,
    "remaining": 167,
    "percentageClaimed": 90,
    "status": "PARTIALLY_CLAIMED"
  },
  "upcomingPeriod": {...},
  "daysUntilReset": 15
}
```

---

### PATCH /api/benefits/usage/[recordId] - Update claim

```bash
curl -X PATCH "/api/benefits/usage/bur_789" \
  -H "Content-Type: application/json" \
  -d '{
    "usageAmount": 20.00,
    "notes": "Updated notes"
  }'
```

**Response**: `200 { success, record }`

---

### DELETE /api/benefits/usage/[recordId] - Delete claim

```bash
curl -X DELETE "/api/benefits/usage/bur_789"
```

**Response**: `200 { success, message, recordId }`

## Utility Functions

### getPeriodBoundaries()

```typescript
import { getPeriodBoundaries } from '@/lib/benefit-period-utils';

const { start, end } = getPeriodBoundaries(
  'MONTHLY',           // cadence
  cardAddedDate,       // card anniversary (for ANNUAL)
  new Date('2026-04-15') // reference date
);
// Returns: { start: Apr 1, end: Apr 30 }
```

### calculateAmountPerPeriod()

```typescript
const amount = calculateAmountPerPeriod(200_00, 'MONTHLY');
// $200 annual → $1667 cents/month
```

### formatPeriodLabel()

```typescript
const label = formatPeriodLabel(boundaries, 'MONTHLY');
// "April 2026 (Monthly)"
```

### getAvailablePeriods()

```typescript
const periods = getAvailablePeriods('MONTHLY', cardDate, 24);
// Returns array of last 24 months
```

## Components

### MarkBenefitUsedModal

```typescript
import { MarkBenefitUsedModal } from '@/components/benefits/MarkBenefitUsedModal';

<MarkBenefitUsedModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSuccess={() => console.log('Claimed!')}
  benefit={benefit}
  userCard={userCard}
  forPeriod={specificDate} // Optional
/>
```

### BenefitUsageProgress

```typescript
import { BenefitUsageProgress } from '@/components/benefits/BenefitUsageProgress';

<BenefitUsageProgress
  benefit={benefit}
  userCard={userCard}
  status={{
    amountAvailable: 1500,
    amountClaimed: 1000,
    percentageClaimed: 67,
    periodStart: new Date(),
    periodEnd: new Date(),
  }}
  onClaimSuccess={() => refetch()}
/>
```

### HistoricalUsageTab

```typescript
import { HistoricalUsageTab } from '@/components/benefits/HistoricalUsageTab';

<HistoricalUsageTab
  userCard={userCard}
  benefit={benefit}
/>
```

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `UNAUTHORIZED` | 403 | Don't own resource |
| `NOT_FOUND` | 404 | Benefit/card not found |
| `DUPLICATE_CLAIM` | 409 | Already claimed this date |
| `INTERNAL_ERROR` | 500 | Server error |

## Common Patterns

### Fetch with error handling

```typescript
try {
  const response = await fetch('/api/benefits/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    alert(`${result.error}: ${result.message}`);
    return;
  }

  console.log('Success:', result.record);
} catch (error) {
  console.error('Network error:', error);
}
```

### Get current period

```typescript
const { start, end } = getPeriodBoundaries('MONTHLY', cardDate);
// Current month boundaries
```

### Format currency

```typescript
const dollars = cents / 100;
const formatted = `$${dollars.toFixed(2)}`; // "$15.00"
```

### Check if fully claimed

```typescript
const isFullyClaimed = record.amountClaimed === record.amountAvailable;
```

## Features Checklist

- ✅ Multiple reset cadences (monthly, quarterly, semi-annual, annual)
- ✅ Partial claims with accumulation
- ✅ Historical access (7 years back)
- ✅ Period boundaries calculated from card anniversary
- ✅ UTC-based calculations (timezone consistent)
- ✅ Duplicate prevention (one claim per date max)
- ✅ User ownership verification
- ✅ Comprehensive error handling
- ✅ Pagination support
- ✅ TypeScript strict mode
- ✅ Production-ready code

## Status

| Item | Status |
|------|--------|
| Build | ✅ Passing |
| TypeScript | ✅ Strict mode |
| Tests | ✅ Ready |
| Deployment | ✅ Ready |
| Documentation | ✅ Complete |

## Documentation

- **Full Implementation**: `PHASE6-IMPLEMENTATION-SUMMARY.md`
- **Technical Decisions**: `PHASE6-TECHNICAL-DECISIONS.md`
- **Specification**: `.github/specs/phase6-period-tracking-spec.md`

---

**Phase 6 Status**: ✅ Complete and Ready for Production
