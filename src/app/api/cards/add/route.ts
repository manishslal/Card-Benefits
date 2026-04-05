/**
 * POST /api/cards/add
 *
 * Adds a new credit card to the user's wallet.
 *
 * Request body:
 * {
 *   masterCardId: string;         // ID of the card template to add
 *   renewalDate: string;          // ISO date string (e.g., "2025-12-31")
 *   customName?: string;          // Optional custom card name
 *   customAnnualFee?: number;     // Optional override of annual fee (in cents)
 * }
 *
 * Response (201 Created):
 * {
 *   success: true;
 *   card: {
 *     id: string;
 *     playerId: string;
 *     masterCardId: string;
 *     customName: string | null;
 *     actualAnnualFee: number | null;
 *     renewalDate: string;
 *     status: string;
 *   }
 * }
 *
 * Errors:
 * - 400: Invalid input (missing required fields, invalid date, etc.)
 * - 401: Not authenticated
 * - 404: MasterCard not found
 * - 409: Card already exists for this player
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

// ============================================================
// Type Definitions
// ============================================================

interface AddCardRequest {
  masterCardId?: string;
  renewalDate?: string;
  customName?: string;
  customAnnualFee?: number;
}

interface UserBenefitDisplay {
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
  status: string;
  createdAt: string;
}

interface AddCardResponse {
  success: true;
  card: {
    id: string;
    playerId: string;
    masterCardId: string;
    customName: string | null;
    actualAnnualFee: number | null;
    renewalDate: string;
    status: string;
    userBenefits: UserBenefitDisplay[];
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/cards/add handler
 * 
 * Creates a new UserCard for the authenticated user's primary player
 * 
 * @param request - NextRequest with authenticated user context
 * @returns NextResponse with created card or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user ID from middleware-set request header
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({})) as AddCardRequest;

    // Validate required fields
    const validation = validateAddCardRequest(body);
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

    const masterCardId = body.masterCardId as string;
    const renewalDate = new Date(body.renewalDate as string);
    const { customName, customAnnualFee } = body;

    // Get user's primary player
    const player = await prisma.player.findFirst({
      where: {
        userId,
        playerName: 'Primary',
      },
    });

    if (!player) {
      return NextResponse.json(
        {
          success: false,
          error: 'Primary player not found',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // Verify the MasterCard exists
    const masterCard = await prisma.masterCard.findUnique({
      where: { id: masterCardId },
    });

    if (!masterCard) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card template not found',
          fieldErrors: { masterCardId: 'This card does not exist in our database' },
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // Check for duplicate card (unique constraint on playerId + masterCardId)
    const existingCard = await prisma.userCard.findUnique({
      where: {
        playerId_masterCardId: {
          playerId: player.id,
          masterCardId,
        },
      },
    });

    if (existingCard && existingCard.status !== 'DELETED') {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have this card in your wallet',
          fieldErrors: { masterCardId: 'This card is already added to your account' },
        } as ErrorResponse,
        { status: 409 }
      );
    }

    // Create the UserCard
    const userCard = await prisma.userCard.create({
      data: {
        playerId: player.id,
        masterCardId,
        customName: customName?.trim() || null,
        actualAnnualFee: customAnnualFee !== undefined ? Math.round(customAnnualFee) : null,
        renewalDate,
        status: 'ACTIVE',
      },
    });

    // Fetch MasterBenefits for this card and clone them to UserBenefits
    const masterBenefits = await prisma.masterBenefit.findMany({
      where: {
        masterCardId,
        isActive: true,
      },
    });

    // Clone each MasterBenefit to a UserBenefit with reset counters
    const userBenefits = await Promise.all(
      masterBenefits.map((masterBenefit) =>
        prisma.userBenefit.create({
          data: {
            userCardId: userCard.id,
            playerId: player.id,
            name: masterBenefit.name,
            type: masterBenefit.type,
            stickerValue: masterBenefit.stickerValue,
            resetCadence: masterBenefit.resetCadence,
            userDeclaredValue: null, // User can customize later
            isUsed: false,
            timesUsed: 0,
            expirationDate: null, // Can be set when benefit is used
            status: 'ACTIVE',
          },
        })
      )
    );

    // Transform response with benefits
    const userBenefitDisplays: UserBenefitDisplay[] = userBenefits.map((benefit) => ({
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
      status: benefit.status,
      createdAt: benefit.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        card: {
          id: userCard.id,
          playerId: userCard.playerId,
          masterCardId: userCard.masterCardId,
          customName: userCard.customName,
          actualAnnualFee: userCard.actualAnnualFee,
          renewalDate: userCard.renewalDate.toISOString(),
          status: userCard.status,
          userBenefits: userBenefitDisplays,
        },
      } as AddCardResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('[Add Card Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add card',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// Validation Helper
// ============================================================

/**
 * Validates the add card request structure
 */
function validateAddCardRequest(body: AddCardRequest): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Validate masterCardId
  if (!body.masterCardId || typeof body.masterCardId !== 'string') {
    errors.masterCardId = 'Card selection is required';
  }

  // Validate renewalDate
  if (!body.renewalDate || typeof body.renewalDate !== 'string') {
    errors.renewalDate = 'Renewal date is required';
  } else {
    const date = new Date(body.renewalDate);
    if (isNaN(date.getTime())) {
      errors.renewalDate = 'Invalid date format';
    } else if (date < new Date()) {
      errors.renewalDate = 'Renewal date must be in the future';
    }
  }

  // Validate customName (optional, but validate if provided)
  if (body.customName !== undefined && body.customName !== null) {
    if (typeof body.customName !== 'string' || body.customName.trim().length === 0) {
      errors.customName = 'Card name must be a non-empty string';
    } else if (body.customName.trim().length > 100) {
      errors.customName = 'Card name is too long (max 100 characters)';
    }
  }

  // Validate customAnnualFee (optional, but validate if provided)
  if (body.customAnnualFee !== undefined && body.customAnnualFee !== null) {
    if (typeof body.customAnnualFee !== 'number' || body.customAnnualFee < 0) {
      errors.customAnnualFee = 'Annual fee must be a non-negative number';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
