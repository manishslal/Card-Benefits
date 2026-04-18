/**
 * GET /api/lounges/airports
 *
 * Returns all airports that have lounge data in the system.
 * Auth required (x-user-id header set by middleware).
 *
 * Response: { success: true, airports: [{ iata_code, name, city, timezone }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

interface AirportRow {
  iata_code: string;
  name: string;
  city: string;
  timezone: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    // ── Query airports ───────────────────────────────────
    const airports = await prisma.$queryRawUnsafe<AirportRow[]>(
      `SELECT iata_code, name, city, timezone FROM lounge_airports ORDER BY city`,
    );

    return NextResponse.json({
      success: true,
      airports,
    });
  } catch (error) {
    console.error('Airport list error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
