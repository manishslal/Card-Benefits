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
import { getAuthContext } from '@/lib/auth-context';
import { prisma } from '@/lib/prisma';

// ============================================================
// Type Definitions
// ============================================================

interface AddCardRequest {
  masterCardId?: string;
  renewalDate?: string;
  customName?: string;
  customAnnualFee?: number;
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
    // Get authenticated user ID from context
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

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
