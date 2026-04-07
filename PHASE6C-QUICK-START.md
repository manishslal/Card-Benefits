# Phase 6C Frontend - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Import Components
```typescript
// In your component file
import { CadenceIndicator } from '@/components/CadenceIndicator';
import { ClaimingLimitInfo } from '@/components/ClaimingLimitInfo';
import { BenefitUsageProgress } from '@/components/BenefitUsageProgress';
import { PeriodClaimingHistory } from '@/components/PeriodClaimingHistory';
import { MarkBenefitUsedModal } from '@/components/MarkBenefitUsedModal';
```

### 2. Fetch Claiming Limits
```typescript
const [limits, setLimits] = useState(null);

useEffect(() => {
  fetch(`/api/benefits/claiming-limits?benefitId=${benefitId}`)
    .then(res => res.json())
    .then(data => setLimits(data.data));
}, [benefitId]);
```

### 3. Display Components
```typescript
// Show urgency badge
<CadenceIndicator
  daysUntilExpiration={limits.daysUntilExpiration}
  warningLevel={limits.warningLevel}
  periodEnd={new Date(limits.periodEnd)}
/>

// Show limit info
<ClaimingLimitInfo limits={limits} compact={true} />

// Show progress
<BenefitUsageProgress
  used={limits.alreadyClaimedAmount}
  limit={limits.maxClaimableAmount}
/>

// Show history
<PeriodClaimingHistory history={periodHistory} />

// Mark as used modal
<MarkBenefitUsedModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  benefitId={benefitId}
  benefitName="Benefit Name"
/>
```

## 📚 Component Cheat Sheet

### CadenceIndicator
Shows "Expires in X days" with color-coded urgency
```typescript
<CadenceIndicator
  daysUntilExpiration={5}
  warningLevel="HIGH"
  periodEnd={new Date()}
  claimingCadence="MONTHLY"
/>
```

### ClaimingLimitInfo
Shows available/used/total amounts
```typescript
<ClaimingLimitInfo
  limits={claimingLimits}
  compact={true}  // for cards
  compact={false} // for modals
/>
```

### BenefitUsageProgress
Visual progress bar
```typescript
<BenefitUsageProgress
  used={1000}      // cents
  limit={1500}     // cents
  urgencyLevel="MEDIUM"
  showPercentage={true}
/>
```

### PeriodClaimingHistory
Historical periods
```typescript
<PeriodClaimingHistory
  history={[
    {
      period: 'April 2026',
      claimed: 1500,
      max: 1500,
      status: 'FULLY_CLAIMED',
      date: new Date(),
    }
  ]}
/>
```

### MarkBenefitUsedModal
Claim form
```typescript
const [isOpen, setIsOpen] = useState(false);

<MarkBenefitUsedModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  benefitId="abc123"
  benefitName="Uber Cash"
  onBenefitMarked={() => refetch()}
/>
```

## 🔌 API Integration

### Fetch Limits
```typescript
const response = await fetch(
  `/api/benefits/claiming-limits?benefitId=${benefitId}`
);
const data = await response.json();
// data.data contains ClaimingLimitsInfo
```

### Mark Benefit Used
```typescript
const response = await fetch('/api/benefits/usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    benefitId: 'abc123',
    usageAmount: 1500,  // cents
    usageDate: new Date().toISOString(),
    notes: 'Optional notes'
  })
});
const data = await response.json();
```

## 🎨 Styling

### Responsive Layout
```typescript
// Mobile: stack vertically
// Tablet/Desktop: grid layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* components */}
</div>
```

### Dark Mode
```typescript
// Automatic with Tailwind dark: variant
// Just add `dark` class to root element
<html className="dark">
  {/* App content */}
</html>
```

## ✅ Testing

### Run Unit Tests
```bash
npm test -- phase6c-components.test.tsx
```

### Run E2E Tests
```bash
npx playwright test tests/e2e/phase6c-frontend.spec.ts
```

## 🐛 Debugging Tips

### Check claiming limits API
```javascript
// In browser console
fetch('/api/benefits/claiming-limits?benefitId=abc123')
  .then(r => r.json())
  .then(console.log)
```

### View component state
```typescript
const [limits, setLimits] = useState(null);
useEffect(() => {
  console.log('Current limits:', limits);
}, [limits]);
```

### Check dark mode
```javascript
// Should have 'dark' class
document.documentElement.classList.contains('dark')
```

## 🚨 Common Issues

### Modal not showing
✅ Check `isOpen={true}`
✅ Check z-index isn't blocked
✅ Check DialogPrimitive import

### Limits not loading
✅ Check API response status
✅ Check benefitId is correct
✅ Check benefit has claimingCadence

### Styling issues
✅ Check Tailwind CSS loaded
✅ Check dark mode class applied
✅ Check responsive breakpoints

## 📖 Full Documentation

- **Implementation Guide**: `PHASE6C-FRONTEND-IMPLEMENTATION.md`
- **Component Summary**: `PHASE6C-FRONTEND-SUMMARY.md`
- **API Reference**: See implementation guide
- **Test Examples**: `src/components/__tests__/phase6c-components.test.tsx`

## 🎯 Next Steps

1. **Copy components** to your project
2. **Import** in your pages/components
3. **Fetch claiming limits** from API
4. **Render components** with data
5. **Run tests** to verify
6. **Deploy** with confidence!

## 💡 Pro Tips

1. Use compact mode for cards, full mode for modals
2. Fetch limits only when benefit ID changes
3. Handle loading/error states from API
4. Test keyboard navigation (Tab key)
5. Verify dark mode with DevTools

## 🆘 Support

1. Check test files for usage examples
2. Review TypeScript types in component files
3. Check troubleshooting in implementation guide
4. Review API endpoint behavior
5. Check browser console for errors

---

**Ready to implement Phase 6C?** Start with the quick start above and check the full implementation guide for detailed information!
