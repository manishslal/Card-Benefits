/**
 * PATCH /api/benefits/[id] - Edit benefit
 * DELETE /api/benefits/[id] - Delete benefit (soft-delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface PatchBenefitRequest {
  name?: string;
  userDeclaredValue?: number | null;
  expirationDate?: string | null;
  resetCadence?: string;
}

interface PatchBenefitResponse {
  success: true;
  benefit: {
    id: string;
    name: string;
    userDeclaredValue: number | null;
    expirationDate: string | null;
    resetCadence: string;
    timesUsed: number;  // 🔑 Wave 2: Include timesUsed
    updatedAt: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

function validatePatchBenefitRequest(body: PatchBenefitRequest): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') {
      errors.name = 'Benefit name must be a string';
    } else if (body.name.trim().length === 0) {
      errors.name = 'Benefit name cannot be empty';
    } else if (body.name.trim().length > 100) {
      errors.name = 'Benefit name must be 100 characters or less';
    }
  }

  if (body.userDeclaredValue !== undefined && body.userDeclaredValue !== null) {
    if (typeof body.userDeclaredValue !== 'number' || body.userDeclaredValue < 0) {
      errors.userDeclaredValue = 'User declared value must be a non-negative number';
    }
  }

  if (body.expirationDate !== undefined && body.expirationDate !== null) {
    if (typeof body.expirationDate !== 'string') {
      errors.expirationDate = 'Expiration date must be a string';
    } else {
      const date = new Date(body.expirationDate);
      if (isNaN(date.getTime())) {
        errors.expirationDate = 'Invalid date format';
      } else if (date < new Date()) {
        errors.expirationDate = 'Expiration date must be in the future';
      }
    }
  }

  if (body.resetCadence !== undefined && body.resetCadence !== null) {
    if (typeof body.resetCadence !== 'string') {
      errors.resetCadence = 'Reset cadence must be a string';
    } else if (!['Monthly', 'CalendarYear', 'CardmemberYear', 'OneTime'].includes(body.resetCadence)) {
      errors.resetCadence = 'Invalid reset cadence';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
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

    const benefitId = request.nextUrl.pathname.split('/')[3];
    const body = (await request.json().catch(() => ({}))) as PatchBenefitRequest;

    const validation = validatePatchBenefitRequest(body);
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

    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        userCard: {
          include: {
            player: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!benefit) {
      return NextResponse.json(
        { success: false, error: 'Benefit not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (benefit.userCard.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to edit this benefit' } as ErrorResponse,
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (body.name !== undefined) {
      updateData.name = (body.name as string).trim();
    }
    if (body.userDeclaredValue !== undefined) {
      updateData.userDeclaredValue = body.userDeclaredValue !== null ? Math.round(body.userDeclaredValue) : null;
    }
    if (body.expirationDate !== undefined) {
      updateData.expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
    }
    if (body.resetCadence !== undefined) {
      updateData.resetCadence = body.resetCadence;
    }

    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        benefit: {
          id: updatedBenefit.id,
          name: updatedBenefit.name,
          userDeclaredValue: updatedBenefit.userDeclaredValue,
          expirationDate: updatedBenefit.expirationDate?.toISOString() || null,
          resetCadence: updatedBenefit.resetCadence,
          timesUsed: updatedBenefit.timesUsed,  // 🔑 Wave 2: Include timesUsed
          updatedAt: updatedBenefit.updatedAt.toISOString(),
        },
      } as PatchBenefitResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Patch Benefit Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update benefit' } as ErrorResponse,
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

    const benefitId = request.nextUrl.pathname.split('/')[3];

    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        userCard: {
          include: {
            player: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!benefit) {
      return NextResponse.json(
        { success: false, error: 'Benefit not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (benefit.userCard.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this benefit' } as ErrorResponse,
        { status: 403 }
      );
    }

    await prisma.userBenefit.update({
      where: { id: benefitId },
      data: { status: 'ARCHIVED' },
    });

    // ✅ FIXED: Return 204 with NO BODY (HTTP spec compliant)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Delete Benefit Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete benefit' } as ErrorResponse,
      { status: 500 }
    );
  }
}
