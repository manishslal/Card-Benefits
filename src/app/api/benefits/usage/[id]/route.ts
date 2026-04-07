/**
 * PATCH /api/benefits/usage/[recordId] - Update an existing benefit usage record
 * DELETE /api/benefits/usage/[recordId] - Delete a benefit usage record
 * 
 * Works with existing BenefitUsageRecord model structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { logSafeError } from '@/lib/error-logging';

type Params = Promise<{ id: string }>;

/**
 * PATCH /api/benefits/usage/[recordId]
 * 
 * Update an existing benefit usage record.
 * 
 * Request body:
 * {
 *   "usageAmount": number,  // Optional: amount in dollars
 *   "notes": string,        // Optional: notes text
 *   "category": string      // Optional: category
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Find existing record
    const existing = await prisma.benefitUsageRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Record not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existing.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Cannot modify records from other users',
          statusCode: 403,
        },
        { status: 403 }
      );
    }

    // Validate updatable fields
    const updateData: Record<string, any> = {};

    if (body.usageAmount !== undefined) {
      if (typeof body.usageAmount !== 'number' || body.usageAmount <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'usageAmount must be a positive number (in dollars)',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      if (body.usageAmount > 999999.99) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'usageAmount exceeds maximum allowed',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      updateData.usageAmount = body.usageAmount;
    }

    if (body.notes !== undefined) {
      if (body.notes && typeof body.notes === 'string' && body.notes.length > 500) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Notes must not exceed 500 characters',
            statusCode: 400,
          },
          { status: 400 }
        );
      }
      updateData.notes = body.notes || null;
    }

    if (body.category !== undefined) {
      updateData.category = body.category || null;
    }

    // No updates provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'No valid fields to update',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    updateData.updatedAt = new Date();

    const updated = await prisma.benefitUsageRecord.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        record: {
          id: updated.id,
          userBenefitId: updated.benefitId,
          usageAmount: Number(updated.usageAmount),
          usageDate: updated.usageDate,
          notes: updated.notes,
          category: updated.category,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
        message: 'Record updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logSafeError('Error updating usage record', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/benefits/usage/[recordId]
 * 
 * Delete a benefit usage record permanently.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find existing record
    const existing = await prisma.benefitUsageRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Record not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existing.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Cannot delete records from other users',
          statusCode: 403,
        },
        { status: 403 }
      );
    }

    // Delete the record
    await prisma.benefitUsageRecord.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Benefit usage record deleted successfully',
        recordId: id,
      },
      { status: 200 }
    );
  } catch (error) {
    logSafeError('Error deleting usage record', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
      { status: 500 }
    );
  }
}
