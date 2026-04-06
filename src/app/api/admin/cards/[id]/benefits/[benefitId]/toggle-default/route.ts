/**
 * PATCH /api/admin/cards/[id]/benefits/[benefitId]/toggle-default
 *
 * Toggle the isDefault status of a benefit.
 * When isDefault=true, new user cards automatically include this benefit.
 *
 * Request Body:
 * {
 *   "isDefault": boolean (required)
 * }
 *
 * Response 200: Benefit default status toggled
 * Errors: 400 (validation), 404 (not found), 500 (server)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, extractRequestContext, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { ToggleBenefitDefaultSchema, parseRequestBody } from '@/features/admin/validation/schemas';
import { logResourceUpdate } from '@/features/admin/lib/audit';

// ============================================================
// Types
// ============================================================

interface ToggleDefaultResponse {
  success: true;
  data: {
    id: string;
    name: string;
    isDefault: boolean;
  };
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
}

// ============================================================
// PATCH Handler
// ============================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; benefitId: string }> }
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

    // 3. Verify card exists
    const card = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: { id: true, cardName: true },
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

    // 4. Verify benefit exists and belongs to this card
    const benefit = await prisma.masterBenefit.findUnique({
      where: { id: params.benefitId },
      select: {
        id: true,
        masterCardId: true,
        name: true,
        isDefault: true,
      },
    });

    if (!benefit || benefit.masterCardId !== params.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Benefit not found',
          code: 'BENEFIT_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 5. Parse and validate request body
    const parseResult = parseRequestBody(ToggleBenefitDefaultSchema, await request.json());

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

    const { isDefault } = parseResult.data!;

    // 6. Update isDefault status
    const updated = await prisma.masterBenefit.update({
      where: { id: params.benefitId },
      data: { isDefault },
      select: {
        id: true,
        name: true,
        isDefault: true,
      },
    });

    // 7. Log the update
    await logResourceUpdate(
      adminContext,
      'BENEFIT',
      benefit.id,
      benefit.name,
      { isDefault: benefit.isDefault },
      { isDefault: updated.isDefault },
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      {
        success: true,
        data: updated,
        message: `Benefit marked as ${isDefault ? 'default' : 'non-default'} for new cards`,
      } as ToggleDefaultResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/cards/[id]/benefits/[benefitId]/toggle-default Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to toggle benefit default status',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
