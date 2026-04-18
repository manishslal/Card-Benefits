/**
 * GET /api/lounges/eligible?airport={iata_code}&include_paid={bool}
 *
 * Returns all lounges accessible to the authenticated user at a given airport.
 * Uses the user's credit card portfolio to determine eligibility via:
 *   User → Player → UserCard → MasterCard → card_lounge_access → access_methods
 *   (including recursive grants_network_id chain).
 *
 * Query Parameters:
 *   - airport: string (required) — 3-letter IATA airport code (e.g. "JFK")
 *   - include_paid: string (optional) — "true" or "false" (default: "true")
 *
 * Auth: x-user-id header required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

// ────────────────────────────────────────────────────────────
// Type Definitions
// ────────────────────────────────────────────────────────────

interface AccessOption {
  access_type: string;
  access_method: string;
  entry_cost: number;
  guest_limit: number | null;
  guest_fee: number | null;
  guest_conditions: string | null;
  has_conditions: boolean;
  conditions: Record<string, unknown>;
  notes: string | null;
  time_limit_hours: number | null;
}

interface LoungeResult {
  lounge_id: string;
  lounge_name: string;
  terminal: string;
  venue_type: string;
  operating_hours: Record<string, unknown> | null;
  amenities: Record<string, unknown> | null;
  detail_last_fetched_at: string | null;
  source_url: string | null;
  image_url: string | null;
  may_deny_entry: boolean;
  is_airside: boolean | null;
  gate_proximity: string | null;
  access_options: AccessOption[];
  best_access_type: string;
  best_access_method: string;
}

// Raw row types for Prisma.$queryRawUnsafe
type AccessMethodRow = {
  id: string;
  name: string;
  category: string;
  provider: string | null;
  grants_network_id: string | null;
  source_card_id: string | null;
  is_network_grant: boolean;
};

type LoungeRow = {
  lounge_id: string;
  lounge_name: string;
  terminal: string;
  venue_type: string;
  operating_hours: unknown;
  amenities: unknown;
  detail_last_fetched_at: string | null;
  source_url: string | null;
  image_url: string | null;
  may_deny_entry: boolean;
  is_airside: boolean | null;
  gate_proximity: string | null;
  access_method_id: string;
  access_method_name: string;
  access_method_category: string;
  entry_cost: number | null;
  guest_limit: number | null;
  guest_fee: number | null;
  guest_conditions: string | null;
  conditions: unknown;
  notes: string | null;
  time_limit_hours: number | null;
};

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

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

    // ── Validate query params ────────────────────────────
    const searchParams = request.nextUrl.searchParams;
    const airport = searchParams.get('airport')?.toUpperCase();
    const includePaid = searchParams.get('include_paid') !== 'false';

    if (!airport || !/^[A-Z]{3}$/.test(airport)) {
      return NextResponse.json(
        { success: false, error: 'Valid 3-letter IATA airport code required' },
        { status: 400 },
      );
    }

    // ── Step 0: Get airport info (timezone, name) ────────
    const airportInfo = await prisma.$queryRawUnsafe<{ timezone: string; name: string }[]>(
      `SELECT timezone, name FROM lounge_airports WHERE iata_code = $1`,
      airport,
    );

    // ── Step 1: Get user's active card IDs ───────────────
    const userCards = await prisma.userCard.findMany({
      where: {
        player: { userId },
        isOpen: true,
        // Exclude DELETED cards; includes ACTIVE and any future statuses
        NOT: { status: 'DELETED' },
      },
      select: { masterCardId: true },
    });
    const cardIds = [...new Set(userCards.map(uc => uc.masterCardId))];

    // ── Step 2: Get card names for display labels ────────
    const cardNameMap: Record<string, string> = {};
    if (cardIds.length > 0) {
      const cards = await prisma.masterCard.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, cardName: true },
      });
      for (const c of cards) {
        cardNameMap[c.id] = c.cardName;
      }
    }

    // ── Step 3: Get access methods via recursive CTE ─────
    let accessMethods: AccessMethodRow[] = [];
    if (cardIds.length > 0) {
      accessMethods = await prisma.$queryRawUnsafe<AccessMethodRow[]>(`
        WITH RECURSIVE access_chain AS (
          SELECT lam.id, lam.name, lam.category, lam.provider, lam.grants_network_id,
                 cla.card_id as source_card_id, false as is_network_grant
          FROM card_lounge_access cla
          JOIN lounge_access_methods lam ON cla.access_method_id = lam.id
          WHERE cla.card_id = ANY($1::text[])
          UNION
          SELECT lam2.id, lam2.name, lam2.category, lam2.provider, lam2.grants_network_id,
                 ac.source_card_id, true as is_network_grant
          FROM access_chain ac
          JOIN lounge_access_methods lam2 ON ac.grants_network_id = lam2.id
        )
        SELECT DISTINCT ON (id, source_card_id) * FROM access_chain
      `, cardIds);
    }

    const accessMethodIds = [...new Set(accessMethods.map(am => am.id))];

    // ── Step 4: Include day-pass methods if requested ────
    if (includePaid) {
      const dayPasses = await prisma.$queryRawUnsafe<{ access_method_id: string }[]>(`
        SELECT DISTINCT lar.access_method_id
        FROM lounge_access_rules lar
        JOIN lounges l ON lar.lounge_id = l.id
        JOIN lounge_terminals lt ON l.terminal_id = lt.id
        JOIN lounge_airports la ON lt.airport_id = la.id
        JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
        WHERE la.iata_code = $1 AND lam.category = 'Day Pass'
      `, airport);

      for (const dp of dayPasses) {
        if (!accessMethodIds.includes(dp.access_method_id)) {
          accessMethodIds.push(dp.access_method_id);
        }
      }
    }

    // Early return if no access methods found and we're not including paid
    if (accessMethodIds.length === 0) {
      return NextResponse.json({
        success: true,
        airport,
        total_lounges: 0,
        free_access: 0,
        day_pass_available: 0,
        lounges: [],
      });
    }

    // ── Step 5: Query lounges for resolved access methods ─
    const loungeRows = await prisma.$queryRawUnsafe<LoungeRow[]>(`
      SELECT
        l.id as lounge_id,
        l.name as lounge_name,
        lt.name as terminal,
        l.venue_type,
        l.operating_hours,
        l.amenities,
        l.detail_last_fetched_at,
        l.source_url,
        l.image_url,
        l.may_deny_entry,
        l.is_airside,
        l.gate_proximity,
        lar.access_method_id,
        lam.name as access_method_name,
        lam.category as access_method_category,
        lar.entry_cost,
        lar.guest_limit,
        lar.guest_fee,
        lar.guest_conditions,
        lar.conditions,
        lar.notes,
        lar.time_limit_hours
      FROM lounges l
      JOIN lounge_terminals lt ON l.terminal_id = lt.id
      JOIN lounge_airports la ON lt.airport_id = la.id
      JOIN lounge_access_rules lar ON lar.lounge_id = l.id
      JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
      WHERE la.iata_code = $1
        AND lar.access_method_id = ANY($2::text[])
      ORDER BY l.name, lar.entry_cost NULLS FIRST
    `, airport, accessMethodIds);

    // ── Step 6: Group by lounge, build results ───────────
    const loungesMap = new Map<string, LoungeResult>();

    // Build method lookup for labeling
    const methodLookup = new Map<string, AccessMethodRow>();
    for (const am of accessMethods) {
      if (!methodLookup.has(am.id)) {
        methodLookup.set(am.id, am);
      }
    }

    for (const row of loungeRows) {
      const entryCost = Number(row.entry_cost ?? 0);
      const isFree = entryCost === 0;

      if (!includePaid && !isFree) continue;

      // Build human-readable label
      const methodInfo = methodLookup.get(row.access_method_id);
      let label = row.access_method_name;
      if (methodInfo?.is_network_grant && methodInfo.source_card_id) {
        const cardName = cardNameMap[methodInfo.source_card_id] || 'Card';
        label = `${cardName} → ${row.access_method_name}`;
      }

      const conditions = (
        typeof row.conditions === 'string'
          ? JSON.parse(row.conditions)
          : row.conditions
      ) || {};

      const option: AccessOption = {
        access_type: isFree ? 'free' : 'day_pass',
        access_method: label,
        entry_cost: entryCost,
        guest_limit: row.guest_limit,
        guest_fee: row.guest_fee != null ? Number(row.guest_fee) : null,
        guest_conditions: row.guest_conditions,
        has_conditions: Object.keys(conditions).length > 0,
        conditions,
        notes: row.notes,
        time_limit_hours: row.time_limit_hours,
      };

      if (!loungesMap.has(row.lounge_id)) {
        loungesMap.set(row.lounge_id, {
          lounge_id: row.lounge_id,
          lounge_name: row.lounge_name,
          terminal: row.terminal,
          venue_type: row.venue_type,
          operating_hours: row.operating_hours as Record<string, unknown> | null,
          amenities: row.amenities as Record<string, unknown> | null,
          detail_last_fetched_at: row.detail_last_fetched_at,
          source_url: row.source_url,
          image_url: row.image_url,
          may_deny_entry: row.may_deny_entry ?? false,
          is_airside: row.is_airside,
          gate_proximity: row.gate_proximity,
          access_options: [],
          best_access_type: 'day_pass',
          best_access_method: '',
        });
      }

      loungesMap.get(row.lounge_id)!.access_options.push(option);
    }

    // ── Step 7: Sort and finalize ────────────────────────
    const lounges = Array.from(loungesMap.values());
    for (const lounge of lounges) {
      lounge.access_options.sort((a, b) => {
        const typeOrder =
          (a.access_type === 'free' ? 0 : 1) -
          (b.access_type === 'free' ? 0 : 1);
        if (typeOrder !== 0) return typeOrder;
        return a.entry_cost - b.entry_cost;
      });
      if (lounge.access_options.length > 0) {
        lounge.best_access_type = lounge.access_options[0].access_type;
        lounge.best_access_method = lounge.access_options[0].access_method;
      }
    }
    lounges.sort((a, b) => {
      const typeOrder =
        (a.best_access_type === 'free' ? 0 : 1) -
        (b.best_access_type === 'free' ? 0 : 1);
      if (typeOrder !== 0) return typeOrder;
      return a.lounge_name.localeCompare(b.lounge_name);
    });

    const freeCount = lounges.filter(l => l.best_access_type === 'free').length;
    const dayPassCount = lounges.filter(l =>
      l.access_options.some(o => o.access_type === 'day_pass'),
    ).length;

    return NextResponse.json({
      success: true,
      airport,
      airport_name: airportInfo[0]?.name ?? null,
      airport_timezone: airportInfo[0]?.timezone ?? null,
      total_lounges: lounges.length,
      free_access: freeCount,
      day_pass_available: dayPassCount,
      lounges,
    });
  } catch (error) {
    console.error('Lounge eligibility error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
