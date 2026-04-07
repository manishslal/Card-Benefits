/**
 * PATCH /api/benefits/usage/[id] - Update a usage record
 * DELETE /api/benefits/usage/[id] - Delete a usage record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Find existing record
    const existing = await prisma.benefitUsageRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Verify ownership
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate updatable fields
    const updateData: Record<string, unknown> = {};

    if (body.usageAmount !== undefined) {
      if (typeof body.usageAmount !== 'number' || body.usageAmount < 0) {
        return NextResponse.json(
          { error: 'Usage amount must be a positive number' },
          { status: 400 }
        );
      }
      updateData.usageAmount = body.usageAmount;
    }

    if (body.notes !== undefined) {
      if (body.notes && body.notes.length > 500) {
        return NextResponse.json(
          { error: 'Notes must not exceed 500 characters' },
          { status: 400 }
        );
      }
      updateData.notes = body.notes;
    }

    if (body.usageDate !== undefined) {
      updateData.usageDate = new Date(body.usageDate);
    }

    if (body.category !== undefined) {
      updateData.category = body.category;
    }

    updateData.updatedAt = new Date();

    const updated = await prisma.benefitUsageRecord.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Usage record updated successfully',
    });
  } catch (error) {
    console.error('Error updating usage record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find existing record
    const existing = await prisma.benefitUsageRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Verify ownership
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the record
    await prisma.benefitUsageRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Usage record deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting usage record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
