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
import { getAuthContext } from '@/lib/auth-context';
import { prisma } from '@/lib/prisma';

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

interface AddBenefitResponse {
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
    expirationDate: string | null;
    createdAt: string;
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
    // Get authenticated user ID from context
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

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

    // Check for duplicate benefit name per card
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

    if (existingBenefit) {
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

    // Create the benefit
    const benefit = await prisma.userBenefit.create({
      data: {
        userCardId,
        playerId: card.player.id,
        name,
        type,
        stickerValue,
        resetCadence,
        userDeclaredValue,
        expirationDate,
        status: 'ACTIVE',
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
          expirationDate: benefit.expirationDate?.toISOString() || null,
          createdAt: benefit.createdAt.toISOString(),
        },
      } as AddBenefitResponse,
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
