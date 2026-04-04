/**
 * PATCH /api/cards/[id] - Edit card details
 * DELETE /api/cards/[id] - Delete card
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { prisma } from '@/lib/prisma';

interface PatchCardRequest {
  customName?: string;
  actualAnnualFee?: number;
  renewalDate?: string;
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

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

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
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

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

    return NextResponse.json({ success: true }, { status: 204 });
  } catch (error) {
    console.error('[Delete Card Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete card' } as ErrorResponse,
      { status: 500 }
    );
  }
}
