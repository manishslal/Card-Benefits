# Admin Phase 2 - Critical Issues Remediation Guide

## Overview

This document provides specific code fixes for all 4 critical issues that must be resolved before Phase 3 proceeds.

**Total Remediation Time:** 8-10 hours  
**Priority:** IMMEDIATE

---

## Critical Issue #1: Missing 4 API Endpoints

### Impact
- **Severity:** CRITICAL  
- **Scope:** 27% of API missing (4/15 endpoints)
- **Features Broken:** Card viewing, editing, deletion; benefit deletion
- **Time to Fix:** 6-8 hours

### Missing Endpoints

#### 1. GET /api/admin/cards/[id] - View Card Details

**File to Create:** `/src/app/api/admin/cards/[id]/route.ts`

**Specification:** Section 6.2.2 (admin-feature-spec.md, line 919)

**Requirements:**
- Fetch single card by ID
- Return all card properties
- Include benefit count
- Return 404 if card not found

**Template Code:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import type { PaginationMeta } from '@/features/admin/validation/schemas';

interface CardDetailResponse {
  success: true;
  data: {
    id: string;
    issuer: string;
    cardName: string;
    defaultAnnualFee: number;
    cardImageUrl: string;
    description?: string;
    displayOrder: number;
    isActive: boolean;
    isArchived: boolean;
    benefitCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Fetch card by ID
    const card = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        issuer: true,
        cardName: true,
        defaultAnnualFee: true,
        cardImageUrl: true,
        description: true,
        displayOrder: true,
        isActive: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            masterBenefits: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 3. Return card with benefit count
    return NextResponse.json(
      {
        success: true,
        data: {
          id: card.id,
          issuer: card.issuer,
          cardName: card.cardName,
          defaultAnnualFee: card.defaultAnnualFee,
          cardImageUrl: card.cardImageUrl,
          description: card.description,
          displayOrder: card.displayOrder,
          isActive: card.isActive,
          isArchived: card.isArchived,
          benefitCount: card._count.masterBenefits,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        },
      } as CardDetailResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/cards/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
```

#### 2. PATCH /api/admin/cards/[id] - Update Card

**File to Create:** Same file as above (`/src/app/api/admin/cards/[id]/route.ts`)

**Add PATCH Handler:**

```typescript
import { UpdateCardSchema, parseRequestBody } from '@/features/admin/validation/schemas';
import { logResourceUpdate } from '@/features/admin/lib/audit';
import { extractRequestContext } from '@/features/admin/middleware/auth';

interface UpdateCardResponse {
  success: true;
  data: any; // Same as CardDetailResponse data
  message: string;
  changes: Record<string, { old: any; new: any }>;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Fetch current card
    const currentCard = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        issuer: true,
        cardName: true,
        defaultAnnualFee: true,
        cardImageUrl: true,
        description: true,
        displayOrder: true,
        isActive: true,
      },
    });

    if (!currentCard) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 4. Parse and validate request body
    const parseResult = parseRequestBody(UpdateCardSchema, await request.json());

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parseResult.errors?.details || [],
        },
        { status: 400 }
      );
    }

    const input = parseResult.data!;

    // 5. Check for duplicate if card name is changing
    if (input.cardName && input.cardName !== currentCard.cardName) {
      const existingCard = await prisma.masterCard.findFirst({
        where: {
          AND: [
            { issuer: input.issuer || currentCard.issuer },
            { cardName: input.cardName },
            { id: { not: params.id } }, // Exclude this card
          ],
        },
        select: { id: true },
      });

      if (existingCard) {
        return NextResponse.json(
          {
            success: false,
            error: 'A card with this issuer and name already exists',
            code: 'DUPLICATE_CARD',
          },
          { status: 409 }
        );
      }
    }

    // 6. Update card in database
    const updatedCard = await prisma.masterCard.update({
      where: { id: params.id },
      data: {
        ...(input.cardName && { cardName: input.cardName }),
        ...(input.defaultAnnualFee !== undefined && { defaultAnnualFee: input.defaultAnnualFee }),
        ...(input.cardImageUrl && { cardImageUrl: input.cardImageUrl }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: {
        id: true,
        issuer: true,
        cardName: true,
        defaultAnnualFee: true,
        cardImageUrl: true,
        description: true,
        displayOrder: true,
        isActive: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            masterBenefits: true,
          },
        },
      },
    });

    // 7. Calculate changes
    const changes: Record<string, { old: any; new: any }> = {};
    if (input.cardName && input.cardName !== currentCard.cardName) {
      changes.cardName = { old: currentCard.cardName, new: input.cardName };
    }
    if (input.defaultAnnualFee !== undefined && input.defaultAnnualFee !== currentCard.defaultAnnualFee) {
      changes.defaultAnnualFee = { old: currentCard.defaultAnnualFee, new: input.defaultAnnualFee };
    }
    // ... continue for other fields

    // 8. Log update
    await logResourceUpdate(
      adminContext,
      'CARD',
      updatedCard.id,
      `${updatedCard.issuer} ${updatedCard.cardName}`,
      {
        issuer: currentCard.issuer,
        cardName: currentCard.cardName,
        defaultAnnualFee: currentCard.defaultAnnualFee,
        cardImageUrl: currentCard.cardImageUrl,
      },
      {
        issuer: updatedCard.issuer,
        cardName: updatedCard.cardName,
        defaultAnnualFee: updatedCard.defaultAnnualFee,
        cardImageUrl: updatedCard.cardImageUrl,
      },
      ipAddress,
      userAgent
    );

    // 9. Return updated card
    return NextResponse.json(
      {
        success: true,
        data: {
          id: updatedCard.id,
          issuer: updatedCard.issuer,
          cardName: updatedCard.cardName,
          defaultAnnualFee: updatedCard.defaultAnnualFee,
          cardImageUrl: updatedCard.cardImageUrl,
          description: updatedCard.description,
          displayOrder: updatedCard.displayOrder,
          isActive: updatedCard.isActive,
          isArchived: updatedCard.isArchived,
          benefitCount: updatedCard._count.masterBenefits,
          createdAt: updatedCard.createdAt.toISOString(),
          updatedAt: updatedCard.updatedAt.toISOString(),
        },
        message: 'Card updated successfully',
        changes,
      } as UpdateCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/cards/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
```

#### 3. DELETE /api/admin/cards/[id] - Delete Card

**File:** Add to `/src/app/api/admin/cards/[id]/route.ts`

```typescript
import { DeleteCardQuerySchema, parseQueryParams } from '@/features/admin/validation/schemas';
import { logResourceDeletion } from '@/features/admin/lib/audit';

interface DeleteCardResponse {
  success: true;
  data: {
    id: string;
    cardName: string;
    action: 'deleted' | 'archived';
  };
  message: string;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Parse query parameters
    const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = parseQueryParams(DeleteCardQuerySchema, queryObj);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'INVALID_QUERY',
          details: Object.entries(parseResult.errors || {}).map(([field, msg]) => ({
            field,
            message: String(msg),
          })),
        },
        { status: 400 }
      );
    }

    const query = parseResult.data!;

    // 4. Fetch card and check for user cards
    const card = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        issuer: true,
        cardName: true,
        _count: {
          select: {
            userCards: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    const hasUserCards = card._count.userCards > 0;

    // 5. Handle deletion based on force and archiveInstead flags
    let action: 'deleted' | 'archived' = 'deleted';

    if (hasUserCards && !query.force) {
      // User cards exist and force is not set
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete card with ${card._count.userCards} active user card(s). Use archiveInstead=true or force=true.`,
          code: 'CARD_IN_USE',
          userCardCount: card._count.userCards,
        },
        { status: 409 }
      );
    }

    if (query.archiveInstead) {
      // Archive instead of delete
      await prisma.masterCard.update({
        where: { id: params.id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedByAdminId: adminContext.userId,
        },
      });
      action = 'archived';
    } else {
      // Hard delete (only if force=true or no user cards)
      await prisma.masterCard.delete({
        where: { id: params.id },
      });
      action = 'deleted';
    }

    // 6. Log deletion
    await logResourceDeletion(
      adminContext,
      'CARD',
      card.id,
      `${card.issuer} ${card.cardName}`,
      {
        issuer: card.issuer,
        cardName: card.cardName,
      },
      ipAddress,
      userAgent
    );

    // 7. Return success
    return NextResponse.json(
      {
        success: true,
        data: {
          id: card.id,
          cardName: card.cardName,
          action,
        },
        message: `Card ${action} successfully`,
      } as DeleteCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/cards/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
```

#### 4. DELETE /api/admin/cards/[id]/benefits/[benefitId] - Already Partially Implemented

**File:** `/src/app/api/admin/cards/[id]/benefits/[benefitId]/route.ts` (EXISTS)

**Issue:** DELETE handler exists but needs query parameter support and fix for benefit count

**Fix:** Update the DELETE handler to properly query user benefit count:

```typescript
// FIND THIS (around line 180 in the DELETE handler):
const userBenefitCount = 0;  // ❌ WRONG - hardcoded

// REPLACE WITH:
const userBenefitCount = await prisma.userBenefit.count({
  where: { masterBenefitId: params.benefitId }
});
```

---

## Critical Issue #2: Audit Log Failures Silent

### Location
`/src/features/admin/lib/audit.ts`, lines 40-65

### Current Code (WRONG)
```typescript
export async function createAuditLog(
  options: AuditLogOptions
): Promise<string> {
  try {
    const auditLog = await prisma.adminAuditLog.create({
      data: { /* ... */ }
    });
    return auditLog.id;
  } catch (error) {
    console.error('[Audit Log Error]', error);
    // ❌ PROBLEM: Returns empty string on error
    // Caller never knows audit log failed!
    return '';
  }
}
```

### Fixed Code
```typescript
export async function createAuditLog(
  options: AuditLogOptions
): Promise<string> {
  try {
    const auditLog = await prisma.adminAuditLog.create({
      data: {
        adminUserId: options.adminUserId,
        actionType: options.actionType,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        resourceName: options.resourceName,
        oldValues: options.oldValues ? JSON.stringify(options.oldValues) : null,
        newValues: options.newValues ? JSON.stringify(options.newValues) : null,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });
    return auditLog.id;
  } catch (error) {
    console.error('[Audit Log Error]', error);
    // ✅ FIX: Throw error so caller can handle it properly
    throw error;
  }
}
```

### Updated Calling Code

In all routes that call `logResourceCreation()`, `logResourceUpdate()`, or `logResourceDeletion()`:

```typescript
// BEFORE:
await logResourceCreation(adminContext, /* ... */);
// Returns undefined on error, no way to detect failure

// AFTER:
try {
  await logResourceCreation(adminContext, /* ... */);
} catch (error) {
  console.error('[Critical] Audit log creation failed:', error);
  // Option 1: Return error to user
  return NextResponse.json({
    success: false,
    error: 'Failed to create audit log - operation not recorded',
    code: 'AUDIT_LOG_FAILED',
  }, { status: 500 });
  
  // Option 2: Or emit metric/alert but allow operation
  // (depends on business requirements)
}
```

---

## Critical Issue #3: Benefit User Count Hardcoded to 0

### Location
`/src/app/api/admin/cards/[id]/benefits/[benefitId]/route.ts`

### Current Code (WRONG)
```typescript
// In DELETE handler around line 180
const userBenefitCount = 0;  // ❌ HARDCODED - WRONG!

if (userBenefitCount > 0) {
  return NextResponse.json({
    success: false,
    error: 'Cannot delete benefit that is used by user cards',
    code: 'BENEFIT_IN_USE',
    userBenefitCount,
    suggestion: 'Deactivate instead of deleting',
  }, { status: 409 });
}
```

### Fixed Code
```typescript
// Query actual user benefit count
const userBenefitCount = await prisma.userBenefit.count({
  where: { masterBenefitId: params.benefitId }
});

if (userBenefitCount > 0 && !query.force) {
  return NextResponse.json({
    success: false,
    error: `Cannot delete benefit that is used by ${userBenefitCount} user card(s)`,
    code: 'BENEFIT_IN_USE',
    userBenefitCount,
    suggestion: 'Use deactivateInstead=true or force=true',
  }, { status: 409 });
}
```

---

## Critical Issue #4: Race Condition on Duplicate Check

### Location
`/src/app/api/admin/cards/route.ts`, lines 286-307

### Current Code (VULNERABLE)
```typescript
// Check for duplicate card (issuer + cardName combination)
const existingCard = await prisma.masterCard.findFirst({
  where: {
    AND: [
      { issuer: input.issuer },
      { cardName: input.cardName },
    ],
  },
  select: { id: true },
});

if (existingCard) {
  return NextResponse.json({
    success: false,
    error: 'A card with this issuer and name already exists',
    code: 'DUPLICATE_CARD',
    existingCardId: existingCard.id,
  }, { status: 409 });
}

// ❌ RACE CONDITION: Card could be created by another request
//    between the check above and the create below!

const card = await prisma.masterCard.create({
  data: { /* ... */ }
});
```

### Fixed Code
```typescript
// Remove the check-then-act pattern
// Instead, use the database unique constraint and catch the error

try {
  const card = await prisma.masterCard.create({
    data: {
      issuer: input.issuer,
      cardName: input.cardName,
      defaultAnnualFee: input.defaultAnnualFee,
      cardImageUrl: input.cardImageUrl,
      displayOrder: 0,
      isActive: true,
      isArchived: false,
    },
    select: {
      id: true,
      issuer: true,
      cardName: true,
      defaultAnnualFee: true,
      cardImageUrl: true,
      displayOrder: true,
      isActive: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Success - continue with audit logging
  // ... (rest of code)

} catch (error) {
  // Handle unique constraint violation
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    // P2002 = Unique constraint violation
    const field = error.meta?.target?.[0] || 'card';
    return NextResponse.json(
      {
        success: false,
        error: 'A card with this issuer and name already exists',
        code: 'DUPLICATE_CARD',
      },
      { status: 409 }
    );
  }
  // Re-throw other errors
  throw error;
}
```

### Add Import
```typescript
import { Prisma } from '@prisma/client';
```

---

## Validation Checklist

After implementing all 4 fixes, verify:

- [ ] GET /api/admin/cards/[id] returns 200 with card details
- [ ] GET /api/admin/cards/[id] returns 404 for missing card
- [ ] PATCH /api/admin/cards/[id] updates card and logs changes
- [ ] PATCH /api/admin/cards/[id] prevents duplicate names
- [ ] DELETE /api/admin/cards/[id] shows warning if card in use
- [ ] DELETE /api/admin/cards/[id] archives instead with archiveInstead=true
- [ ] DELETE /api/admin/cards/[id]/benefits/[benefitId] shows usage count
- [ ] Audit logs are created for all operations
- [ ] Audit log failures throw errors (don't silent fail)
- [ ] Concurrent duplicate card attempts prevented by database
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm run test`

---

## Timeline

| Task | Duration | Status |
|------|----------|--------|
| Implement 4 endpoints | 6-8 hours | 🔴 TODO |
| Fix audit log error handling | 1 hour | 🔴 TODO |
| Fix benefit user count | 1 hour | 🔴 TODO |
| Fix duplicate race condition | 30 min | 🔴 TODO |
| Testing & validation | 1 hour | 🔴 TODO |
| **Total** | **8-10 hours** | 🔴 TODO |

---

## Sign-Off

Once all 4 critical issues are fixed:
1. Run full test suite
2. Verify build passes
3. Request QA re-review
4. Get approval to proceed to Phase 3

**Current Status:** ⚠️ BLOCKED ON CRITICAL FIXES  
**Next Review:** After all fixes implemented
