/**
 * GET /api/lounges/what-if?airport={iata_code}
 *
 * Returns a list of popular cards and how many additional lounges each
 * would unlock at the given airport for the current user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

interface CardUpgrade {
  card_id: string;
  card_name: string;
  issuer: string;
  additional_lounges: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const airport = request.nextUrl.searchParams.get('airport')?.toUpperCase();
    if (!airport || !/^[A-Z]{3}$/.test(airport)) {
      return NextResponse.json(
        { success: false, error: 'Valid 3-letter IATA airport code required' },
        { status: 400 },
      );
    }

    // Get user's current card IDs
    const userCards = await prisma.userCard.findMany({
      where: {
        player: { userId },
        isOpen: true,
        NOT: { status: 'DELETED' },
      },
      select: { masterCardId: true },
    });
    const currentCardIds = new Set(userCards.map(uc => uc.masterCardId));

    // Get user's currently accessible lounges at this airport
    const currentLounges = currentCardIds.size > 0
      ? await prisma.$queryRawUnsafe<{ lounge_id: string }[]>(`
          SELECT DISTINCT lar.lounge_id
          FROM lounge_access_rules lar
          JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
          JOIN lounges l ON lar.lounge_id = l.id
          JOIN lounge_terminals lt ON l.terminal_id = lt.id
          JOIN lounge_airports la ON lt.airport_id = la.id
          WHERE lam.id IN (
            SELECT ac.id FROM (
              WITH RECURSIVE access_chain AS (
                SELECT lam2.id, lam2.grants_network_id
                FROM card_lounge_access cla
                JOIN lounge_access_methods lam2 ON cla.access_method_id = lam2.id
                WHERE cla.card_id = ANY($1::text[])
                UNION
                SELECT lam3.id, lam3.grants_network_id
                FROM access_chain ac2
                JOIN lounge_access_methods lam3 ON ac2.grants_network_id = lam3.id
              )
              SELECT id FROM access_chain
            ) ac
          )
          AND la.iata_code = $2
          AND (lar.entry_cost IS NULL OR lar.entry_cost = 0)
        `, [...currentCardIds], airport)
      : [];

    const currentLoungeIds = new Set(currentLounges.map(r => r.lounge_id));

    // Get popular upgrade cards (cards with lounge access that user doesn't have)
    // Focus on premium cards with significant lounge access
    const upgradeCandidates = await prisma.$queryRawUnsafe<{
      card_id: string;
      card_name: string;
      issuer: string;
    }[]>(`
      SELECT DISTINCT mc.id as card_id, mc."cardName" as card_name, mc.issuer
      FROM "MasterCard" mc
      JOIN card_lounge_access cla ON cla.card_id = mc.id
      WHERE mc.id != ALL($1::text[])
        AND mc."annualFee" > 0
      ORDER BY mc."cardName"
      LIMIT 20
    `, [...currentCardIds]);

    // For each candidate card, compute how many additional lounges it unlocks
    const upgrades: CardUpgrade[] = [];

    for (const candidate of upgradeCandidates) {
      const cardLounges = await prisma.$queryRawUnsafe<{ lounge_id: string }[]>(`
        SELECT DISTINCT lar.lounge_id
        FROM lounge_access_rules lar
        JOIN lounge_access_methods lam ON lar.access_method_id = lam.id
        JOIN lounges l ON lar.lounge_id = l.id
        JOIN lounge_terminals lt ON l.terminal_id = lt.id
        JOIN lounge_airports la ON lt.airport_id = la.id
        WHERE lam.id IN (
          SELECT ac.id FROM (
            WITH RECURSIVE access_chain AS (
              SELECT lam2.id, lam2.grants_network_id
              FROM card_lounge_access cla
              JOIN lounge_access_methods lam2 ON cla.access_method_id = lam2.id
              WHERE cla.card_id = $1
              UNION
              SELECT lam3.id, lam3.grants_network_id
              FROM access_chain ac2
              JOIN lounge_access_methods lam3 ON ac2.grants_network_id = lam3.id
            )
            SELECT id FROM access_chain
          ) ac
        )
        AND la.iata_code = $2
        AND (lar.entry_cost IS NULL OR lar.entry_cost = 0)
      `, candidate.card_id, airport);

      const additionalCount = cardLounges.filter(
        r => !currentLoungeIds.has(r.lounge_id)
      ).length;

      if (additionalCount > 0) {
        upgrades.push({
          card_id: candidate.card_id,
          card_name: candidate.card_name,
          issuer: candidate.issuer,
          additional_lounges: additionalCount,
        });
      }
    }

    // Sort by most additional lounges, take top 3
    upgrades.sort((a, b) => b.additional_lounges - a.additional_lounges);
    const topUpgrades = upgrades.slice(0, 3);

    return NextResponse.json({
      success: true,
      airport,
      current_lounge_count: currentLoungeIds.size,
      upgrades: topUpgrades,
    });
  } catch (error) {
    console.error('What-if API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
