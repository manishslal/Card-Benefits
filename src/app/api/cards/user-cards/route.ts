/**
 * GET /api/cards/user-cards
 * 
 * Returns user's cards in the format expected by MyCardsSection.
 * Adapts UserCard data to the component's Card interface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', cards: [] },
        { status: 401 }
      );
    }

    // Fetch user cards with master card information
    const userCards = await prisma.userCard.findMany({
      where: {
        player: { userId },
        status: { not: 'DELETED' },
      },
      include: {
        masterCard: {
          select: {
            id: true,
            issuer: true,
            cardName: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to the Card format expected by MyCardsSection
    // Note: We're using the available fields from UserCard and MasterCard
    // Some spec fields (lastFourDigits, cardType, cardNetwork) are placeholders
    // since they don't exist in the current schema
    const cards = userCards.map((uc) => ({
      id: uc.id,
      userId,
      name: uc.customName || uc.masterCard.cardName || 'Card',
      lastFourDigits: '0000', // Placeholder - would need card number in schema
      cardNetwork: uc.masterCard.issuer as 'Visa' | 'Mastercard' | 'Amex' | 'Discover',
      cardType: 'Credit' as const, // Placeholder - would need in schema
      isActive: uc.isOpen, // Use isOpen as proxy for isActive
      createdAt: uc.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        cards,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Get User Cards Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load cards', cards: [] },
      { status: 500 }
    );
  }
}
