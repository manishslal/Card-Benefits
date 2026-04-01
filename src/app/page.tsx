/**
 * src/app/page.tsx
 *
 * Card Benefits Dashboard - Redesigned Version
 *
 * Displays all credit cards in the user's wallet with redesigned UI featuring:
 * 1. Header with dark mode toggle
 * 2. Summary stats (Total ROI, Benefits Captured, Active Benefits)
 * 3. Expiration alerts section (sticky)
 * 4. Player tabs for filtering
 * 5. Responsive card grid with expandable benefits tables
 * 6. Mobile-first responsive design
 *
 * Architecture:
 * - Server Component for data fetching
 * - Client Components for interactivity (Header, Tabs, Card expand/collapse)
 * - CSS variables for theming (light/dark mode)
 * - Tailwind CSS for styling with mobile-first approach
 *
 * Future: Will filter by authenticated userId from session when auth is implemented.
 */

import { prisma } from '@/lib/prisma';
import Header from '@/components/Header';
import SummaryStats from '@/components/SummaryStats';
import AlertSection from '@/components/AlertSection';
import PlayerTabsContainer from '@/components/PlayerTabsContainer';
import type { UserCard, UserBenefit, Player } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Type-safe structure for a player with their cards and benefits.
 * Mirrors the Prisma query return type.
 */
type PlayerWithCards = Player & {
  userCards: (UserCard & {
    masterCard: {
      id: string;
      issuer: string;
      cardName: string;
      defaultAnnualFee: number;
      cardImageUrl: string;
    };
    userBenefits: UserBenefit[];
  })[];
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Fetches all players with their cards and benefits from Prisma.
 *
 * Query strategy:
 * - Includes all active players (isActive = true) for the user
 * - Includes only open cards (isOpen = true) for each player
 * - Includes all benefits (active and inactive) for each card
 * - Orders consistently for reproducible output
 *
 * TODO: When auth is implemented, add userId filter:
 *   where: { userId: session.user.id, isActive: true }
 *
 * @returns Array of players with nested cards and benefits
 * @throws Prisma query errors (caught and displayed by error boundary)
 */
async function fetchPlayersWithCards(): Promise<PlayerWithCards[]> {
  return prisma.player.findMany({
    where: {
      isActive: true,
      // TODO: Filter by userId from authenticated session:
      // userId: session.user.id,
    },
    include: {
      userCards: {
        where: {
          isOpen: true, // Only show active cards
        },
        include: {
          masterCard: {
            select: {
              id: true,
              issuer: true,
              cardName: true,
              defaultAnnualFee: true,
              cardImageUrl: true,
            },
          },
          userBenefits: {
            orderBy: { createdAt: 'asc' }, // Consistent ordering
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' }, // Consistent player ordering
  });
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

/**
 * Dashboard Page Server Component (Redesigned)
 *
 * Renders the redesigned dashboard with:
 * 1. Header with dark mode toggle (client component)
 * 2. Summary stats cards (client component)
 * 3. Sticky alerts section (client component)
 * 4. Player tabs for filtering (client component)
 * 5. Responsive card grid with expandable tables (client component)
 *
 * Data fetching happens here (server), rendering happens in client components.
 * This separation allows efficient caching and optimal performance.
 */
export default async function DashboardPage() {
  try {
    // Fetch all players with their cards and benefits
    const players = await fetchPlayersWithCards();

    // Empty state
    if (players.length === 0) {
      return (
        <>
          <Header />
          <main
            className="min-h-screen"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <div
              className="max-w-container mx-auto px-md md:px-tablet lg:px-desktop py-2xl text-center"
            >
              <div
                className="p-lg rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <h2
                  className="font-semibold mb-md"
                  style={{ fontSize: 'var(--font-h2)' }}
                >
                  No players in your wallet yet
                </h2>
                <p className="text-body-md">
                  Create a new player and add cards to get started tracking
                  benefits
                </p>
              </div>
            </div>
          </main>
        </>
      );
    }

    return (
      <>
        {/* Fixed header */}
        <Header />

        {/* Main content */}
        <main
          className="min-h-screen"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <div
            className="max-w-container mx-auto px-md md:px-tablet lg:px-desktop pt-lg"
            style={{ paddingTop: 'var(--space-lg)' }}
          >
            {/* Summary Stats Section */}
            <SummaryStats players={players} />

            {/* Alerts Section (Sticky) */}
            <AlertSection players={players} />

            {/* Player Tabs & Card Grid */}
            <PlayerTabsContainer players={players} />
          </div>
        </main>

        {/* Footer */}
        <footer
          className="border-t py-md mt-2xl"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="max-w-container mx-auto px-md md:px-tablet lg:px-desktop text-center">
            <p
              className="text-body-sm"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Last updated at {new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        </footer>
      </>
    );
  } catch (error) {
    // Log error for debugging
    console.error('Dashboard page error:', error);

    // Re-throw so Next.js error boundary catches it
    throw error;
  }
}
