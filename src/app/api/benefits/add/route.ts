/**
 * POST /api/benefits/add
 *
 * Create new benefit for a card
 *
 * Request body:
 * {
 *   userCardId: string;          // Required: which card
 *   name: string;                // Required: benefit name
 *   type: string;                // Required: 'StatementCredit' | 'UsagePerk'
 *   stickerValue: number;        // Required: value in cents
 *   resetCadence: string;        // Required: Monthly | CalendarYear | etc
 *   userDeclaredValue?: number;  // Optional: custom value
 *   expirationDate?: string      // Optional: ISO 8601 date
 * }
 *
 * Response (201 Created):
 * {
 *   success: true;
 *   benefit: {
 *     id: string;
 *     userCardId: string;
 *     name: string;
 *     type: string;
 *     stickerValue: number;
 *     resetCadence: string;
 *     userDeclaredValue: number | null;
 *     isUsed: boolean;
 *     expirationDate: string | null;
 *     createdAt: string;
 *   }
 * }
 *
 * Error Responses:
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Card not owned by user
 * - 404: Card doesn't exist
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';
import { hydratePeriodFields } from '@/lib/benefit-engine/hydrate-period';

// ============================================================
// Type Definitions
// ============================================================

interface AddBenefitRequest {
  userCardId?: string;
  name?: string;
  type?: string;
  stickerValue?: number;
  resetCadence?: string;
  userDeclaredValue?: number;
  expirationDate?: string;
}

export interface AddBenefitResponse {
  success: true;
  benefit: {
    id: string;
    userCardId: string;
    name: string;
    type: string;
    stickerValue: number;
    resetCadence: string;
    userDeclaredValue: number | null;
    isUsed: boolean;
    timesUsed: number;
    expirationDate: string | null;
    createdAt: string;
    periodStart: string | null;
    periodEnd: string | null;
    periodStatus: string | null;
    masterBenefitId: string | null;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

// ============================================================
// POST Handler - Create Benefit
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user ID from middleware-set request header
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as AddBenefitRequest;

    // Validate input
    const validation = validateAddBenefitRequest(body);
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

    const userCardId = body.userCardId as string;
    const name = (body.name as string).trim();
    const type = body.type as string;
    const stickerValue = Math.round(body.stickerValue as number);
    const resetCadence = body.resetCadence as string;
    const userDeclaredValue = body.userDeclaredValue ? Math.round(body.userDeclaredValue) : null;
    const expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;

    // Get card and verify ownership
    const card = await prisma.userCard.findUnique({
      where: { id: userCardId },
      include: {
        player: {
          select: { userId: true, id: true },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    // Check ownership
    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to add benefits to this card' } as ErrorResponse,
        { status: 403 }
      );
    }

    // Guard: prevent adding benefits to a deleted card
    if (card.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Cannot add benefits to a deleted card' } as ErrorResponse,
        { status: 400 }
      );
    }

    // Check for duplicate benefit name per card
    // When engine is enabled, include periodStart in uniqueness check
    // to allow legitimate multi-period creation
    const existingBenefit = await prisma.userBenefit.findFirst({
      where: {
        userCardId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
        status: 'ACTIVE',
      },
    });

    // Hydrate period fields when engine is enabled
    const periodFields = await hydratePeriodFields(
      prisma,
      userCardId,
      name,
      resetCadence
    );

    // For engine-enabled, refine duplicate check to include periodStart
    if (existingBenefit) {
      if (featureFlags.BENEFIT_ENGINE_ENABLED && periodFields.periodStart) {
        // Check if a row with this exact periodStart already exists
        const exactDuplicate = await prisma.userBenefit.findFirst({
          where: {
            userCardId,
            name: { equals: name, mode: 'insensitive' },
            periodStart: periodFields.periodStart,
            status: 'ACTIVE',
          },
        });
        if (exactDuplicate) {
          return NextResponse.json(
            {
              success: false,
              error: 'Validation failed',
              fieldErrors: {
                name: `Benefit "${name}" already exists for this card and period`,
              },
            } as ErrorResponse,
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            fieldErrors: {
              name: `Benefit "${name}" already exists for this card`,
            },
          } as ErrorResponse,
          { status: 400 }
        );
      }
    }

    // Create the benefit with period fields
    const benefit = await prisma.userBenefit.create({
      data: {
        userCardId,
        playerId: card.player.id,
        name,
        type,
        stickerValue: periodFields.effectiveStickerValue ?? stickerValue,
        resetCadence: periodFields.resolvedResetCadence,
        userDeclaredValue,
        expirationDate: periodFields.periodEnd ?? expirationDate,
        status: 'ACTIVE',
        // Period fields (null when engine is off)
        periodStart: periodFields.periodStart,
        periodEnd: periodFields.periodEnd,
        periodStatus: periodFields.periodStatus ?? 'ACTIVE',
        masterBenefitId: periodFields.masterBenefitId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        benefit: {
          id: benefit.id,
          userCardId: benefit.userCardId,
          name: benefit.name,
          type: benefit.type,
          stickerValue: benefit.stickerValue,
          resetCadence: benefit.resetCadence,
          userDeclaredValue: benefit.userDeclaredValue,
          isUsed: benefit.isUsed,
          timesUsed: benefit.timesUsed,
          expirationDate: benefit.expirationDate?.toISOString() || null,
          createdAt: benefit.createdAt.toISOString(),
          periodStart: benefit.periodStart?.toISOString() || null,
          periodEnd: benefit.periodEnd?.toISOString() || null,
          periodStatus: benefit.periodStatus || null,
          masterBenefitId: benefit.masterBenefitId || null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Add Benefit Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add benefit' } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// Validation Helper
// ============================================================

function validateAddBenefitRequest(body: AddBenefitRequest): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Validate userCardId
  if (!body.userCardId || typeof body.userCardId !== 'string') {
    errors.userCardId = 'Card selection is required';
  }

  // Validate name
  if (!body.name || typeof body.name !== 'string') {
    errors.name = 'Benefit name is required';
  } else if (body.name.trim().length === 0) {
    errors.name = 'Benefit name cannot be empty';
  } else if (body.name.trim().length > 100) {
    errors.name = 'Benefit name must be 100 characters or less';
  }

  // Validate type
  if (!body.type || typeof body.type !== 'string') {
    errors.type = 'Benefit type is required';
  } else if (!['StatementCredit', 'UsagePerk'].includes(body.type)) {
    errors.type = 'Invalid benefit type';
  }

  // Validate stickerValue
  if (body.stickerValue === undefined || body.stickerValue === null) {
    errors.stickerValue = 'Sticker value is required';
  } else if (typeof body.stickerValue !== 'number' || body.stickerValue <= 0) {
    errors.stickerValue = 'Sticker value must be greater than 0';
  }

  // Validate resetCadence
  if (!body.resetCadence || typeof body.resetCadence !== 'string') {
    errors.resetCadence = 'Reset cadence is required';
  } else if (!['Monthly', 'CalendarYear', 'CardmemberYear', 'OneTime'].includes(body.resetCadence)) {
    errors.resetCadence = 'Invalid reset cadence';
  }

  // Validate userDeclaredValue (optional, but if provided must be valid)
  if (body.userDeclaredValue !== undefined && body.userDeclaredValue !== null) {
    if (typeof body.userDeclaredValue !== 'number' || body.userDeclaredValue < 0) {
      errors.userDeclaredValue = 'User declared value must be a non-negative number';
    } else if (body.stickerValue && body.userDeclaredValue > body.stickerValue) {
      errors.userDeclaredValue = 'User declared value cannot exceed sticker value';
    }
  }

  // Validate expirationDate (optional, but if provided must be future)
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

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
