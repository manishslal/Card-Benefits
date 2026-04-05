import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';

export async function GET() {
  try {
    const masterCards = await prisma.masterCard.findMany({
      include: {
        masterBenefits: {
          where: { isActive: true },
        },
      },
      orderBy: {
        issuer: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: masterCards,
      count: masterCards.length,
    });
  } catch (error) {
    console.error('Error fetching master cards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cards' },
      { status: 500 }
    );
  }
}
