/**
 * GET /api/lounges/[id]/detail
 *
 * Returns detailed information for a single lounge.
 * Auth required (x-user-id header set by middleware).
 *
 * Response: {
 *   success: true,
 *   lounge_id, amenities, detail_amenities, is_airside,
 *   gate_proximity, access_conditions, operating_hours,
 *   detail_last_fetched_at, needs_detail_fetch
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

interface LoungeDetailRow {
  id: string;
  name: string;
  amenities: unknown;
  detail_amenities: unknown;
  is_airside: boolean | null;
  gate_proximity: string | null;
  operating_hours: unknown;
  detail_last_fetched_at: string | null;
  source_url: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Lounge ID required' },
        { status: 400 },
      );
    }

    // ── Query lounge detail ──────────────────────────────
    const rows = await prisma.$queryRawUnsafe<LoungeDetailRow[]>(
      `SELECT id, name, amenities, detail_amenities, is_airside,
              gate_proximity, operating_hours, detail_last_fetched_at, source_url
       FROM lounges WHERE id = $1`,
      id,
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lounge not found' },
        { status: 404 },
      );
    }

    const lounge = rows[0];
    const needsDetailFetch =
      lounge.detail_last_fetched_at === null && lounge.source_url !== null;

    return NextResponse.json({
      success: true,
      lounge_id: lounge.id,
      name: lounge.name,
      amenities: lounge.amenities,
      detail_amenities: lounge.detail_amenities,
      is_airside: lounge.is_airside,
      gate_proximity: lounge.gate_proximity,
      operating_hours: lounge.operating_hours,
      detail_last_fetched_at: lounge.detail_last_fetched_at,
      source_url: lounge.source_url,
      needs_detail_fetch: needsDetailFetch,
    });
  } catch (error) {
    console.error('Lounge detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
