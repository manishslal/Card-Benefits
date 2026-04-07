/**
 * POST /api/benefits/usage - Create a new usage record
 * GET /api/benefits/usage - List usage records with optional filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { logSafeError } from '@/lib/error-logging';

export async function POST(request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { benefitId, usageAmount, notes, usageDate, category } = body;

    // Validation
    if (!benefitId || usageAmount === undefined || usageAmount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: benefitId, usageAmount' },
        { status: 400 }
      );
    }

    // QA-005: Validate amount is within reasonable bounds
    if (usageAmount < 0 || usageAmount > 999999.99) {
      return NextResponse.json(
        { error: 'Invalid amount: must be between 0 and 999999.99' },
        { status: 400 }
      );
    }

    // QA-006: Prevent recording usage for future dates
    if (usageDate) {
      const usageDateObj = new Date(usageDate);
      const now = new Date();
      // Allow usage date up to end of today (in case of timezone differences)
      now.setHours(23, 59, 59, 999);
      if (usageDateObj > now) {
        return NextResponse.json(
          { error: 'Cannot record usage for future dates' },
          { status: 400 }
        );
      }
    }

    if (notes && notes.length > 500) {
      return NextResponse.json(
        { error: 'Notes must not exceed 500 characters' },
        { status: 400 }
      );
    }

    // Verify benefit exists and belongs to user
    const benefit = await prisma.userBenefit.findFirst({
      where: {
        id: benefitId,
        player: { userId },
      },
    });

    if (!benefit) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 });
    }

    try {
      // Create usage record
      const usageRecord = await prisma.benefitUsageRecord.create({
        data: {
          benefitId,
          userId,
          usageAmount: Number(usageAmount),
          notes: notes || null,
          usageDate: usageDate ? new Date(usageDate) : new Date(),
          category: category || null,
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: usageRecord,
          message: 'Usage record created successfully',
        },
        { status: 201 }
      );
    } catch (error: any) {
      // QA-007: Handle duplicate usage record on same date
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Usage already recorded for this benefit on this date' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    // QA-008: Safe error logging without PII
    logSafeError('Error creating usage record', error, { userId: undefined, benefitId: undefined });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const benefitId = searchParams.get('benefitId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const sortBy = searchParams.get('sortBy') || 'usageDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * pageSize;

    // Build filter
    const where: Record<string, unknown> = {
      userId,
    };

    if (benefitId) {
      where.benefitId = benefitId;
    }

    // Get total count
    const total = await prisma.benefitUsageRecord.count({ where });

    // Fetch records with pagination and sorting
    const records = await prisma.benefitUsageRecord.findMany({
      where,
      orderBy: {
        [sortBy === 'usageDate' ? 'usageDate' : 'createdAt']: sortOrder === 'asc' ? 'asc' : 'desc',
      },
      skip,
      take: pageSize,
    });

    const hasMore = skip + pageSize < total;

    return NextResponse.json({
      success: true,
      data: records,
      total,
      page,
      pageSize,
      hasMore,
    });
  } catch (error) {
    // QA-008: Safe error logging without PII
    logSafeError('Error fetching usage records', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
