/**
 * POST /api/cards/add
 *
 * Adds a new credit card to the user's wallet (creates UserCard and associated UserBenefits)
 *
 * Authentication: Required (via session/JWT in cookies)
 *
 * Request body:
 * {
 *   masterCardId: string;         // ID of the card template to add (required)
 *   customName?: string;          // Optional custom card name (max 100 chars)
 *   actualAnnualFee?: number;     // Optional override of annual fee in cents
 *   renewalDate?: string;         // Optional ISO 8601 date (defaults to 1 year from now)
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "userCard": {
 *     "id": "usercard_123",
 *     "playerId": "player_456",
 *     "masterCardId": "mastercard_001",
 *     "customName": "My Chase Sapphire",
 *     "actualAnnualFee": 9500,
 *     "renewalDate": "2025-12-01T00:00:00Z",
 *     "isOpen": true,
 *     "status": "ACTIVE",
 *     "createdAt": "2024-11-20T15:45:00Z",
 *     "updatedAt": "2024-11-20T15:45:00Z"
 *   },
 *   "benefitsCreated": 8,
 *   "message": "Card added to your collection"
 * }
 *
 * Errors:
 * - 400: Validation error or invalid input
 * - 401: Not authenticated
 * - 403: Forbidden (player access denied)
 * - 404: MasterCard not found
 * - 409: Duplicate card (already in collection)
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { featureFlags } from '@/lib/feature-flags';
import { generateBenefitsForCard } from '@/lib/benefit-engine';

// ============================================================
// Type Definitions
// ============================================================

interface AddCardRequest {
  masterCardId?: string;
  renewalDate?: string;
  customName?: string;
  actualAnnualFee?: number;
}

interface AddCardResponse {
  success: true;
  userCard: {
    id: string;
    playerId: string;
    masterCardId: string;
    customName: string | null;
    actualAnnualFee: number | null;
    renewalDate: string;
    isOpen: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  benefitsCreated: number;
  benefitsGenerated?: Array<{
    name: string;
    masterBenefitId: string;
    periodStart: string;
    periodEnd: string | null;
  }>;
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  details?: string;
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/cards/add handler
 * 
 * Creates a new UserCard and associated UserBenefits for the authenticated user
 * 
 * @param request - NextRequest with authenticated user context from middleware
 * @returns NextResponse with created card or error
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // F-1: Get authenticated user ID from middleware-set header (standardized auth pattern)
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({})) as AddCardRequest;

    // Validate required fields and input format
    const validation = validateAddCardRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          fieldErrors: validation.errors,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const masterCardId = body.masterCardId as string;
    // Default renewal date to 1 year from now if not provided (UTC to avoid TZ drift)
    const now = new Date();
    const renewalDate = body.renewalDate
      ? new Date(body.renewalDate)
      : new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
    const { customName, actualAnnualFee } = body;

    // Get user's primary player profile
    const player = await prisma.player.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc', // Get first/primary player
      },
    });

    if (!player) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player profile not found',
          code: 'PLAYER_NOT_FOUND',
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // Verify the MasterCard exists
    const masterCard = await prisma.masterCard.findUnique({
      where: { id: masterCardId },
    });

    if (!masterCard || !masterCard.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
          fieldErrors: { masterCardId: 'This card is no longer available' },
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

    // Return 409 if card already exists and is not deleted
    if (existingCard && existingCard.status !== 'DELETED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Card already in collection',
          code: 'CARD_DUPLICATE',
          details: 'You already own this card. View it in your collection.',
        } as ErrorResponse,
        { status: 409 }
      );
    }

    const isReactivation = existingCard?.status === 'DELETED';

    // Create or reactivate the UserCard and UserBenefits in a transaction
    const { card: userCard, benefitCount, generatedBenefits } = await prisma.$transaction(async (tx) => {
      let card;

      if (isReactivation) {
        // ── REACTIVATION PATH (F-2: Soft-delete preservation) ────────────
        // Keep existing archived benefits (status='ARCHIVED') for history.
        // Only generate new current-period rows below (Step 3).
        // Previously this hard-deleted all old UserBenefits, losing history.

        // Step 1: Reactivate the UserCard
        card = await tx.userCard.update({
          where: { id: existingCard.id },
          data: {
            isOpen: true,
            status: 'ACTIVE',
            statusChangedAt: new Date(),
            statusChangedReason: 'Reactivated by user',
            customName: customName && customName.trim() ? customName.trim() : null,
            actualAnnualFee: actualAnnualFee !== undefined ? Math.round(actualAnnualFee) : null,
            renewalDate,
            version: { increment: 1 },
          },
        });
      } else {
        // ── NEW CARD PATH (existing logic, unchanged) ──────────────────────
        card = await tx.userCard.create({
          data: {
            playerId: player.id,
            masterCardId,
            customName: customName && customName.trim() ? customName.trim() : null,
            actualAnnualFee: actualAnnualFee !== undefined ? Math.round(actualAnnualFee) : null,
            renewalDate,
            isOpen: true,
            status: 'ACTIVE',
          },
        });
      }

      // Step 3: Generate benefits (same for both paths)
      if (featureFlags.BENEFIT_ENGINE_ENABLED) {
        // New path: auto-generate benefits with period tracking via the benefit engine
        const generated = await generateBenefitsForCard(
          tx,
          { id: card.id, masterCardId, renewalDate },
          player.id,
          new Date()
        );
        return {
          card,
          benefitCount: generated.count,
          generatedBenefits: generated.benefits,
        };
      } else {
        // Legacy path: flat copy of MasterBenefits without period tracking
        const masterBenefits = await tx.masterBenefit.findMany({
          where: {
            masterCardId,
            isActive: true,
            isDefault: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        const benefitsCreated = await tx.userBenefit.createMany({
          data: masterBenefits.map((masterBenefit) => ({
            userCardId: card.id,
            playerId: player.id,
            name: masterBenefit.name,
            type: masterBenefit.type,
            stickerValue: masterBenefit.stickerValue,
            resetCadence: masterBenefit.resetCadence,
            isUsed: false,
            timesUsed: 0,
            expirationDate: null,
            status: 'ACTIVE',
          })),
        });

        return {
          card,
          benefitCount: benefitsCreated.count,
          generatedBenefits: undefined,
        };
      }
    });

    const responseBody: AddCardResponse = {
      success: true,
      userCard: {
        id: userCard.id,
        playerId: userCard.playerId,
        masterCardId: userCard.masterCardId,
        customName: userCard.customName,
        actualAnnualFee: userCard.actualAnnualFee,
        renewalDate: userCard.renewalDate.toISOString(),
        isOpen: userCard.isOpen,
        status: userCard.status,
        createdAt: userCard.createdAt.toISOString(),
        updatedAt: userCard.updatedAt.toISOString(),
      },
      benefitsCreated: benefitCount,
      message: isReactivation
        ? `Card reactivated with ${benefitCount} benefits`
        : generatedBenefits
          ? `Card added with ${benefitCount} benefits for the current period`
          : 'Card added to your collection',
    };

    // Include period details when benefit engine is active
    if (generatedBenefits) {
      responseBody.benefitsGenerated = generatedBenefits.map((b) => ({
        name: b.name,
        masterBenefitId: b.masterBenefitId,
        periodStart: b.periodStart.toISOString(),
        periodEnd: b.periodEnd?.toISOString() ?? null,
      }));
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    console.error('[POST /api/cards/add Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// Validation Helper
// ============================================================

/**
 * Validates the add card request structure and values
 * 
 * Validation rules:
 * - masterCardId: Required, string
 * - customName: Optional, max 100 characters
 * - actualAnnualFee: Optional, non-negative integer (in cents)
 * - renewalDate: Optional, must be ISO 8601 date in future
 */
function validateAddCardRequest(body: AddCardRequest): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Validate masterCardId (required)
  if (!body.masterCardId || typeof body.masterCardId !== 'string') {
    errors.masterCardId = 'Card selection is required';
  }

  // Validate renewalDate (optional, but validate if provided)
  if (body.renewalDate !== undefined && body.renewalDate !== null) {
    if (typeof body.renewalDate !== 'string') {
      errors.renewalDate = 'Renewal date must be a date string';
    } else {
      const date = new Date(body.renewalDate);
      if (isNaN(date.getTime())) {
        errors.renewalDate = 'Invalid date format (use ISO 8601)';
      } else if (date < new Date()) {
        errors.renewalDate = 'Renewal date must be in the future';
      }
    }
  }

  // Validate customName (optional, but validate if provided)
  if (body.customName !== undefined && body.customName !== null) {
    if (typeof body.customName !== 'string') {
      errors.customName = 'Card name must be a string';
    } else if (body.customName.trim().length === 0) {
      // Empty string after trim is invalid
      errors.customName = 'Card name cannot be empty';
    } else if (body.customName.length > 100) {
      errors.customName = 'Card name must be 100 characters or less';
    }
  }

  // Validate actualAnnualFee (optional, but validate if provided)
  if (body.actualAnnualFee !== undefined && body.actualAnnualFee !== null) {
    if (typeof body.actualAnnualFee !== 'number' || !Number.isInteger(body.actualAnnualFee)) {
      errors.actualAnnualFee = 'Annual fee must be a whole number (cents)';
    } else if (body.actualAnnualFee < 0 || body.actualAnnualFee > 999900) {
      errors.actualAnnualFee = 'Annual fee must be between 0 and 999900 cents ($0 - $9,999)';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
