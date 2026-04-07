/**
 * POST /api/benefits/usage/record
 * Record a new benefit usage event
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import type { BenefitUsageRecord } from '@/features/benefits/types/benefits';
import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';

// Validation schema
const UsageRecordSchema = z.object({
  benefitId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  usageDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  category: z.string().optional(),
});

interface ErrorResponse {
  success: false;
  error: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const validation = UsageRecordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${validation.error.message}` } as ErrorResponse,
        { status: 400 }
      );
    }

    const { benefitId, amount, usageDate, notes, category } = validation.data;

    // Get benefit with related data
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        userCard: true,
        player: {
          select: { userId: true, id: true },
        },
      },
    });

    if (!benefit) {
      return NextResponse.json(
        { success: false, error: 'Benefit not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    // Verify authorization
    if (benefit.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to record usage for this benefit' } as ErrorResponse,
        { status: 403 }
      );
    }

    // Determine period (YYYY-MM format for monthly)
    const date = usageDate ? new Date(usageDate) : new Date();
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Create usage record
    const usage = await prisma.benefitUsage.create({
      data: {
        benefitId,
        playerId: benefit.player.id,
        userCardId: benefit.userCardId,
        amount: new Decimal(amount.toString()),
        usageDate: date,
        period,
        notes: notes || null,
        category: category || null,
      },
    });

    // Convert Decimal to string for JSON serialization
    const response: BenefitUsageRecord = {
      id: usage.id,
      benefitId: usage.benefitId,
      playerId: usage.playerId,
      userCardId: usage.userCardId,
      amount: usage.amount.toString(),
      usageDate: usage.usageDate.toISOString(),
      period: usage.period,
      notes: usage.notes || undefined,
      category: usage.category || undefined,
      createdAt: usage.createdAt.toISOString(),
      updatedAt: usage.updatedAt.toISOString(),
    };

    return NextResponse.json(
      { success: true, usage: response },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Record Usage Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record usage' } as ErrorResponse,
      { status: 500 }
    );
  }
}
