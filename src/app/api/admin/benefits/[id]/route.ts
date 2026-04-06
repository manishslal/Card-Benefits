/**
 * PATCH /api/admin/benefits/[id] - Update Benefit (generic)
 * DELETE /api/admin/benefits/[id] - Delete Benefit (generic)
 *
 * These are generic benefit endpoints that work independent of the card context.
 * They allow updating and deleting benefits by benefit ID directly.
 *
 * PATCH Request Body (all optional):
 * {
 *   "name": string (optional, max 200),
 *   "type": enum (optional),
 *   "stickerValue": number (optional, >= 0),
 *   "resetCadence": enum (optional),
 *   "isDefault": boolean (optional),
 *   "description": string (optional, max 1000)
 * }
 *
 * DELETE Query Parameters:
 * - force?: boolean (default: false)
 * - deactivateInstead?: boolean (default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, extractRequestContext, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import {
  UpdateBenefitSchema,
  DeleteBenefitQuerySchema,
  parseRequestBody,
  parseQueryParams,
} from '@/features/admin/validation/schemas';
import { logResourceUpdate, logResourceDeletion } from '@/features/admin/lib/audit';

// ============================================================
// Types
// ============================================================

interface BenefitItem {
  id: string;
  masterCardId: string;
  name: string;
  type: string;
  stickerValue: number;
  resetCadence: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  masterCard?: {
    id: string;
    cardName: string;
    issuer?: string;
  };
}

interface UpdateBenefitResponse {
  success: true;
  data: BenefitItem;
  message: string;
}

interface DeleteBenefitResponse {
  success: true;
  data: {
    id: string;
    name: string;
    masterCardId: string;
  };
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
  userBenefitCount?: number;
}

// ============================================================
// PATCH Handler
// ============================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Verify benefit exists
    const benefit = await prisma.masterBenefit.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        masterCardId: true,
        name: true,
        type: true,
        stickerValue: true,
        resetCadence: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!benefit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Benefit not found',
          code: 'BENEFIT_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 4. Parse and validate request body
    const parseResult = parseRequestBody(UpdateBenefitSchema, await request.json());

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
            field,
            message: String(message),
          })),
        } as any,
        { status: 400 }
      );
    }

    const input = parseResult.data!;

    // 5. Check for duplicate benefit name if changing name
    if (input.name && input.name.toLowerCase() !== benefit.name.toLowerCase()) {
      const existing = await prisma.masterBenefit.findFirst({
        where: {
          masterCardId: benefit.masterCardId,
          name: {
            equals: input.name,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: 'A benefit with this name already exists for this card',
            code: 'DUPLICATE_BENEFIT',
          } as ErrorResponse,
          { status: 409 }
        );
      }
    }

    // 6. Prepare old values for audit log
    const oldValues = {
      name: benefit.name,
      type: benefit.type,
      stickerValue: benefit.stickerValue,
      resetCadence: benefit.resetCadence,
      isDefault: benefit.isDefault,
      isActive: benefit.isActive,
    };

    // 7. Update benefit
    const updated = await prisma.masterBenefit.update({
      where: { id: params.id },
      data: input,
      select: {
        id: true,
        masterCardId: true,
        name: true,
        type: true,
        stickerValue: true,
        resetCadence: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // NEW: Include masterCard relationship
        masterCard: {
          select: {
            id: true,
            cardName: true,
            issuer: true,
          },
        },
      },
    });

    // 8. Prepare new values and log update
    const newValues = {
      name: updated.name,
      type: updated.type,
      stickerValue: updated.stickerValue,
      resetCadence: updated.resetCadence,
      isDefault: updated.isDefault,
      isActive: updated.isActive,
    };

    await logResourceUpdate(
      adminContext,
      'BENEFIT',
      updated.id,
      updated.name,
      oldValues,
      newValues,
      ipAddress,
      userAgent
    );

    const data: BenefitItem = {
      id: updated.id,
      masterCardId: updated.masterCardId,
      name: updated.name,
      type: updated.type,
      stickerValue: updated.stickerValue,
      resetCadence: updated.resetCadence,
      isDefault: updated.isDefault,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      // NEW: Include masterCard data
      masterCard: updated.masterCard
        ? {
            id: updated.masterCard.id,
            cardName: updated.masterCard.cardName,
            issuer: updated.masterCard.issuer,
          }
        : undefined,
    };

    return NextResponse.json(
      {
        success: true,
        data,
        message: 'Benefit updated successfully',
      } as UpdateBenefitResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/benefits/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update benefit',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE Handler
// ============================================================

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Parse query parameters
    const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = parseQueryParams(DeleteBenefitQuerySchema, queryObj);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'INVALID_PARAMETERS',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const query = parseResult.data!;

    // 4. Verify benefit exists
    const benefit = await prisma.masterBenefit.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        masterCardId: true,
        name: true,
      },
    });

    if (!benefit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Benefit not found',
          code: 'BENEFIT_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 5. Check if benefit is used by user cards
    const userBenefitCount = 0; // No direct relation available

    // If benefit is in use and not forced, either deactivate or return error
    if (userBenefitCount > 0 && !query.force) {
      if (query.deactivateInstead) {
        // Deactivate instead of delete
        await prisma.masterBenefit.update({
          where: { id: params.id },
          data: { isActive: false },
        });

        await logResourceUpdate(
          adminContext,
          'BENEFIT',
          benefit.id,
          benefit.name,
          { isActive: true },
          { isActive: false },
          ipAddress,
          userAgent
        );

        return NextResponse.json(
          {
            success: true,
            data: {
              id: benefit.id,
              name: benefit.name,
              masterCardId: benefit.masterCardId,
            },
            message: `Benefit deactivated (was in use by ${userBenefitCount} user card(s))`,
          } as DeleteBenefitResponse,
          { status: 200 }
        );
      } else {
        // Return 409 conflict
        return NextResponse.json(
          {
            success: false,
            error: `Benefit cannot be deleted: it is used by ${userBenefitCount} user card(s)`,
            code: 'BENEFIT_IN_USE',
            userBenefitCount,
          } as ErrorResponse,
          { status: 409 }
        );
      }
    }

    // 6. Delete benefit
    await prisma.masterBenefit.delete({
      where: { id: params.id },
    });

    // 7. Log deletion
    await logResourceDeletion(
      adminContext,
      'BENEFIT',
      benefit.id,
      benefit.name,
      {
        name: benefit.name,
        userBenefitCount,
      },
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: benefit.id,
          name: benefit.name,
          masterCardId: benefit.masterCardId,
        },
        message: 'Benefit deleted successfully',
      } as DeleteBenefitResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/benefits/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete benefit',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
