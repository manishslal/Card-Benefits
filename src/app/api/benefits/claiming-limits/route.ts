/**
 * GET /api/benefits/claiming-limits
 * 
 * Public endpoint (no auth required) to retrieve claiming limit details for a benefit.
 * 
 * Query Parameters:
 * - benefitId: string (required) - The benefit ID
 * - date: ISO date string (optional) - Reference date (defaults to today)
 * 
 * Response: ClaimingLimitsInfo with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { logSafeError } from '@/lib/error-logging';
import { getClaimingLimitsInfo } from '@/lib/claiming-validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const benefitId = searchParams.get('benefitId');
    const dateStr = searchParams.get('date');

    // ========== Validation ==========
    if (!benefitId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'benefitId query parameter is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    let referenceDate = new Date();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid date format. Use ISO 8601 (e.g., 2026-03-29)',
            statusCode: 400,
          },
          { status: 400 }
        );
      }
      referenceDate = parsed;
    }

    // ========== Fetch Benefit ==========
    const masterBenefit = await prisma.masterBenefit.findUnique({
      where: { id: benefitId },
      include: {
        masterCard: {
          select: {
            cardName: true,
          },
        },
      },
    });

    if (!masterBenefit) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Benefit not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // ========== Get Claiming Limits (No Usage Records for Public Endpoint) ==========
    // For public endpoint, we don't have user context, so we can't fetch usage records
    // Instead, we return limits with 0 already claimed
    const limitsInfo = getClaimingLimitsInfo(
      benefitId,
      masterBenefit.claimingAmount,
      masterBenefit.claimingCadence as any,
      [], // Empty usage records (public endpoint)
      referenceDate,
      masterBenefit.claimingWindowEnd,
      masterBenefit.name,
      masterBenefit.masterCard?.cardName
    );

    if (!limitsInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'BENEFIT_NOT_CONFIGURED',
          message: 'This benefit is not configured for claiming limits',
          statusCode: 403,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: limitsInfo,
      },
      { status: 200 }
    );
  } catch (error) {
    logSafeError('Error fetching claiming limits', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
      { status: 500 }
    );
  }
}
