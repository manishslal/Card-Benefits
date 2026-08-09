# TypeScript `any` Audit - Quick Reference

## 📊 At a Glance

| Metric | Value |
|--------|-------|
| **Total `any` instances** | 610 |
| **Affected files** | 48 |
| **Estimated effort** | 3-4 days |
| **Production blocker** | YES |
| **Test files** | 11 (380+ instances, mostly safe) |
| **Production code** | 37 (230+ instances, needs fixing) |

## 🎯 Top 10 Highest Priority Files

| File | Instances | Type | Priority | Effort |
|------|-----------|------|----------|--------|
| src/features/cards/actions/card-management.ts | 6 | `: any` + `as any` | CRITICAL | 2 hours |
| src/app/dashboard/page.tsx | 6 | `: any` + `as any` | CRITICAL | 2 hours |
| src/features/import-export/lib/validator.ts | 15 | `: any` | HIGH | 2 hours |
| src/lib/import/validator.ts | 15 | `: any` | HIGH | 2 hours |
| src/features/import-export/lib/xlsx-formatter.ts | 6 | `: any` | HIGH | 1.5 hours |
| src/__tests__/import-server-actions.test.ts | 123 | `as any` | HIGH | 1 hour |
| src/__tests__/import-e2e.test.ts | 102 | `as any` | HIGH | 1 hour |
| src/features/cards/hooks/useCards.ts | 4 | `: any` | HIGH | 1 hour |
| src/shared/hooks/useFormValidation.ts | 5 | `: any` | HIGH | 1 hour |
| src/lib/redis-rate-limiter.ts | 5 | `: any` | MEDIUM | 1 hour |

## 🔧 Quick Fix Patterns

### Pattern 1: Input Validation (Use `unknown`)
```typescript
// ❌ Before
function parse(value: any): string | null {
  return typeof value === 'string' ? value : null;
}

// ✅ After
function parse(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
```

### Pattern 2: Component Props (Use Proper Types)
```typescript
// ❌ Before
interface Props { onSave?: (data: any) => void; }

// ✅ After
import type { Card } from '@/shared/types';
interface Props { onSave?: (data: Card) => void; }
```

### Pattern 3: Test Mocks (Use vi.mocked)
```typescript
// ❌ Before
(prisma.user.findUnique as any).mockResolvedValue(mockUser);

// ✅ After
vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
```

### Pattern 4: Data Structures (Use Union Types)
```typescript
// ❌ Before
interface Cell { value: any; }

// ✅ After
type CellValue = string | number | boolean | Date | null;
interface Cell { value: CellValue; }
```

### Pattern 5: Generics (Preserve Type Info)
```typescript
// ❌ Before
function transform<T>(items: T[]): any { return items[0]; }

// ✅ After
function transform<T>(items: T[]): T | undefined { return items[0]; }
```

## 📋 Implementation Phases

### Phase 1: Critical Production Code (Days 1-2)
```
card-management.ts (6) → dashboard.ts (6) → validator.ts (15)
Time: 6-8 hours | Impact: HIGH
```

### Phase 2: High-Risk Utilities (Days 2-3)
```
xlsx-formatter.ts (6) → duplicate-detector.ts (4) → redis-rate-limiter.ts (5)
Time: 4-6 hours | Impact: MEDIUM
```

### Phase 3: Hooks & Components (Days 3-3.5)
```
useFormValidation.ts (5) → useCards.ts (4) → Modal components (8)
Time: 3-4 hours | Impact: MEDIUM
```

### Phase 4: API Routes & Utils (Days 3.5-4)
```
API routes (2) → custom-values (6) → error-handling (1)
Time: 2-3 hours | Impact: LOW
```

### Phase 5: Test Files (Parallel or final phase)
```
import-server-actions.test.ts (123) → import-e2e.test.ts (102) → import-duplicate-detector.test.ts (64)
Time: 3-4 hours | Impact: NONE (tests only)
```

## ✅ Verification Checklist

- [ ] **TypeScript Strict**: `npx tsc --strict --noEmit` → 0 errors
- [ ] **ESLint**: `npx eslint src --ext .ts,.tsx` → 0 violations
- [ ] **Build**: `npm run build` → success, no warnings
- [ ] **Tests**: `npm run test` → 100% passing
- [ ] **Types Exported**: All types in `@/shared/types` or module exports
- [ ] **Documentation**: Updated CONTRIBUTING.md with type guidelines
- [ ] **Code Review**: Approved by tech lead

## 🚀 Getting Started (First File)

Pick **src/features/cards/actions/card-management.ts** as your first fix:

### Step 1: Identify the types
```typescript
// Search for 'any' in the file
grep ": any\|as any" src/features/cards/actions/card-management.ts
```

### Step 2: Understand the data structures
```typescript
// Check Prisma schema for UserCard relations
cat prisma/schema.prisma | grep -A 20 "model UserCard"
```

### Step 3: Define proper types
```typescript
interface CardWithRelations {
  id: string;
  renewalDate: Date;
  customName?: string;
  actualAnnualFee?: number;
  userBenefits: UserBenefit[];
}

interface UserBenefit {
  id: string;
  stickerValue: number;
  expirationDate?: Date;
  isUsed: boolean;
}
```

### Step 4: Replace and test
```bash
# Replace in file
# Test related features
npm run test -- card-management

# Run dashboard tests
npm run test -- dashboard
```

## 🚨 Red Flags to Watch For

### ❌ Don't do this:
```typescript
// Just replacing any with unknown without type guards
const x: unknown = getValue();
console.log(x.property); // ERROR: unknown has no properties
```

### ✅ Do this instead:
```typescript
const x: unknown = getValue();
if (typeof x === 'object' && x !== null && 'property' in x) {
  console.log((x as Record<string, unknown>).property);
}
```

### ❌ Don't do this:
```typescript
// Lying to TypeScript with casting
const card = unknownData as Card; // Unverified!
```

### ✅ Do this instead:
```typescript
// Actually verify the data
if (isCard(unknownData)) {
  const card: Card = unknownData; // Safe!
}

function isCard(data: unknown): data is Card {
  return typeof data === 'object' && data !== null && 'id' in data && 'cardName' in data;
}
```

## 📞 Need Help?

- **Type Definitions**: See `/src/shared/types/` or `@/shared/types`
- **Prisma Types**: Check `prisma/schema.prisma` and generated types in `node_modules/@prisma/client`
- **Test Mocks**: See `src/__tests__/setup.ts` for test utilities
- **Examples**: See implemented type fixes in other production files

## 🎓 Learning Resources

- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Type Guards: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- ESLint TS Rules: https://typescript-eslint.io/rules/

## 💡 Pro Tips

1. **Use `unknown` by default** for external input, then narrow types with guards
2. **Export shared types** to `@/shared/types` so they're reusable
3. **Leverage Prisma types** - they're auto-generated and always up-to-date
4. **Use generics** to preserve type information in utility functions
5. **Document API responses** with TypeScript interfaces or Zod schemas
6. **Test type safety** - add unit tests for type-dependent logic

## Timeline Estimate

```
Phase 1 (Critical code):     6-8 hours  → Deploy internal
Phase 2 (Utilities):         4-6 hours  → Merge
Phase 3 (Components):        3-4 hours  → PR review
Phase 4 (Routes & utils):    2-3 hours  → Final PR
Phase 5 (Tests):             3-4 hours  → Optional, can defer

Total: 18-25 hours ≈ 3-4 days for one developer
       or 1-2 days with two developers
```

---

**For full details, see**: [P0-1-TYPESCRIPT-ANY-AUDIT.md](./P0-1-TYPESCRIPT-ANY-AUDIT.md)
