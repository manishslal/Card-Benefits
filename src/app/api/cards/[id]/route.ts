/**
 * GET /api/cards/[id] - Fetch card details with benefits
 * PATCH /api/cards/[id] - Edit card details
 * DELETE /api/cards/[id] - Delete card
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

interface PatchCardRequest {
  customName?: string;
  actualAnnualFee?: number;
  renewalDate?: string;
}

interface GetCardResponse {
  success: true;
  card: {
    id: string;
    masterCardId: string;
    customName: string | null;
    actualAnnualFee: number | null;  // In cents
    renewalDate: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    benefits: {
      id: string;
      name: string;
      type: string;
      stickerValue: number;  // In cents
      userDeclaredValue: number | null;  // In cents
      resetCadence: string;
      expirationDate: string | null;
      isUsed: boolean;
      status: string;
    }[];
  };
}

interface GetCardErrorResponse {
  success: false;
  error: string;
}

interface PatchCardResponse {
  success: true;
  card: {
    id: string;
    customName: string | null;
    actualAnnualFee: number | null;
    renewalDate: string;
    status: string;
    updatedAt: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

function validatePatchCardRequest(body: PatchCardRequest): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (body.customName !== undefined && body.customName !== null) {
    if (typeof body.customName !== 'string') {
      errors.customName = 'Card name must be a string';
    } else if (body.customName.trim().length > 100) {
      errors.customName = 'Card name must be 100 characters or less';
    }
  }

  if (body.actualAnnualFee !== undefined && body.actualAnnualFee !== null) {
    if (typeof body.actualAnnualFee !== 'number' || body.actualAnnualFee < 0) {
      errors.actualAnnualFee = 'Annual fee must be a non-negative number';
    }
  }

  if (body.renewalDate !== undefined && body.renewalDate !== null) {
    if (typeof body.renewalDate !== 'string') {
      errors.renewalDate = 'Renewal date must be a string';
    } else {
      const date = new Date(body.renewalDate);
      if (isNaN(date.getTime())) {
        errors.renewalDate = 'Invalid date format';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * GET /api/cards/[id] - Fetch card details with benefits
 * 
 * Returns:
 * - Card details: id, customName, actualAnnualFee (in cents), renewalDate, status
 * - Associated benefits: array of UserBenefit objects
 * 
 * Note: All monetary values are in CENTS (e.g., 55000 = $550)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as GetCardErrorResponse,
        { status: 401 }
      );
    }

    // Extract card ID from URL path: /api/cards/[id]
    const cardId = request.nextUrl.pathname.split('/')[3];

    if (!cardId) {
      return NextResponse.json(
        { success: false, error: 'Card ID required' } as GetCardErrorResponse,
        { status: 400 }
      );
    }

    // Fetch card with benefits from database
    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        player: {
          select: { userId: true },
        },
        userBenefits: {
          where: { status: 'ACTIVE' },  // Only active benefits
          select: {
            id: true,
            name: true,
            type: true,
            stickerValue: true,  // Returned in cents
            userDeclaredValue: true,  // Returned in cents
            resetCadence: true,
            expirationDate: true,
            isUsed: true,
            timesUsed: true,
            status: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' } as GetCardErrorResponse,
        { status: 404 }
      );
    }

    // Verify user owns this card
    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this card' } as GetCardErrorResponse,
        { status: 403 }
      );
    }

    // Return card with benefits
    return NextResponse.json(
      {
        success: true,
        card: {
          id: card.id,
          masterCardId: card.masterCardId,
          customName: card.customName,
          actualAnnualFee: card.actualAnnualFee,  // In cents
          renewalDate: card.renewalDate.toISOString(),
          status: card.status,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
          benefits: card.userBenefits.map((benefit) => ({
            id: benefit.id,
            name: benefit.name,
            type: benefit.type,
            stickerValue: benefit.stickerValue,  // In cents
            userDeclaredValue: benefit.userDeclaredValue,  // In cents
            resetCadence: benefit.resetCadence,
            expirationDate: benefit.expirationDate?.toISOString() || null,
            isUsed: benefit.isUsed,
            status: benefit.status,
          })),
        },
      } as GetCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Get Card Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch card details' } as GetCardErrorResponse,
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const cardId = request.nextUrl.pathname.split('/')[3];
    const body = (await request.json().catch(() => ({}))) as PatchCardRequest;

    const validation = validatePatchCardRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          fieldErrors: validation.errors,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        player: {
          select: { userId: true },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to edit this card' } as ErrorResponse,
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (body.customName !== undefined) {
      updateData.customName = body.customName?.trim() || null;
    }
    if (body.actualAnnualFee !== undefined) {
      updateData.actualAnnualFee = body.actualAnnualFee !== null ? Math.round(body.actualAnnualFee) : null;
    }
    if (body.renewalDate !== undefined) {
      updateData.renewalDate = new Date(body.renewalDate);
    }

    const updatedCard = await prisma.userCard.update({
      where: { id: cardId },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        card: {
          id: updatedCard.id,
          customName: updatedCard.customName,
          actualAnnualFee: updatedCard.actualAnnualFee,
          renewalDate: updatedCard.renewalDate.toISOString(),
          status: updatedCard.status,
          updatedAt: updatedCard.updatedAt.toISOString(),
        },
      } as PatchCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Patch Card Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update card' } as ErrorResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const cardId = request.nextUrl.pathname.split('/')[3];

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        player: {
          select: { userId: true },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this card' } as ErrorResponse,
        { status: 403 }
      );
    }

    await prisma.userCard.update({
      where: { id: cardId },
      data: {
        status: 'DELETED',
        userBenefits: {
          updateMany: {
            where: { userCardId: cardId },
            data: { status: 'ARCHIVED' },
          },
        },
      },
    });

    // ✅ FIXED: Return 204 with NO BODY (HTTP spec compliant)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Delete Card Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete card' } as ErrorResponse,
      { status: 500 }
    );
  }
}
