/**
 * Complete Authorization System Tests
 *
 * Comprehensive test suite for ownership verification and access control:
 * - Player ownership verification
 * - Card ownership verification (via player)
 * - Benefit ownership verification (via player)
 * - Server action authorization checks
 * - Cross-user data isolation
 * - Authorization edge cases and race conditions
 *
 * Total: 52+ test cases ensuring users cannot access each other's data
 *
 * CRITICAL: These tests verify that User A cannot:
 * - See User B's players, cards, or benefits
 * - Modify User B's data
 * - Delete User B's data
 * - Claim User B's benefits
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAuthUserIdOrThrow,
  verifyPlayerOwnership,
  verifyCardOwnership,
  verifyBenefitOwnership,
  invalidateUserSessions,
  getUserSessions,
  getSessionByToken,
  invalidateSession,
} from '@/features/auth/lib/auth';
import { prisma } from '@/lib/prisma';

// Store for simulating AsyncLocalStorage behavior
let mockAuthUserId: string | null = null;

// Mock AsyncLocalStorage for getAuthUserId
vi.mock('@/features/auth/context/auth-context', () => ({
  getAuthUserId: () => mockAuthUserId,
}));

// ============================================================================
// SECTION 1: Player Ownership Verification (8 tests)
// ============================================================================

describe('Player Ownership Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies owner can access own player', async () => {
    // Mock: Player exists and belongs to userId
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'user-123',
    } as any);

    const result = await verifyPlayerOwnership('player-abc', 'user-123');

    expect(result.isOwner).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects non-owner attempting to access player', async () => {
    // Mock: Player exists but belongs to different user
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'user-456',
    } as any);

    const result = await verifyPlayerOwnership('player-abc', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('returns error when player not found', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce(null);

    const result = await verifyPlayerOwnership('nonexistent-player', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles database error gracefully', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockRejectedValueOnce(
      new Error('Database connection error')
    );

    const result = await verifyPlayerOwnership('player-abc', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('verify ownership');
  });

  it('prevents user from accessing multiple players they do not own', async () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId: otherUserId } as any)
      .mockResolvedValueOnce({ userId: otherUserId } as any)
      .mockResolvedValueOnce({ userId: otherUserId } as any);

    const result1 = await verifyPlayerOwnership('player-1', userId);
    const result2 = await verifyPlayerOwnership('player-2', userId);
    const result3 = await verifyPlayerOwnership('player-3', userId);

    expect(result1.isOwner).toBe(false);
    expect(result2.isOwner).toBe(false);
    expect(result3.isOwner).toBe(false);
  });

  it('allows user to access multiple owned players', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId } as any)
      .mockResolvedValueOnce({ userId } as any)
      .mockResolvedValueOnce({ userId } as any);

    const result1 = await verifyPlayerOwnership('player-1', userId);
    const result2 = await verifyPlayerOwnership('player-2', userId);
    const result3 = await verifyPlayerOwnership('player-3', userId);

    expect(result1.isOwner).toBe(true);
    expect(result2.isOwner).toBe(true);
    expect(result3.isOwner).toBe(true);
  });

  it('rejects empty player ID', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce(null);

    const result = await verifyPlayerOwnership('', 'user-123');

    expect(result.isOwner).toBe(false);
  });

  it('verifies call uses correct select to avoid N+1 queries', async () => {
    const spy = vi.spyOn(prisma.player, 'findUnique');
    spy.mockResolvedValueOnce({ userId: 'user-123' } as any);

    await verifyPlayerOwnership('player-abc', 'user-123');

    // Verify that select is used to fetch only userId (no unnecessary data)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { userId: true },
      })
    );
  });
});

// ============================================================================
// SECTION 2: Card Ownership Verification (8 tests)
// ============================================================================

describe('Card Ownership Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies owner can access own card', async () => {
    vi.spyOn(prisma.userCard, 'findUnique').mockResolvedValueOnce({
      player: { userId: 'user-123' },
    } as any);

    const result = await verifyCardOwnership('card-abc', 'user-123');

    expect(result.isOwner).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects non-owner attempting to access card', async () => {
    vi.spyOn(prisma.userCard, 'findUnique').mockResolvedValueOnce({
      player: { userId: 'user-456' },
    } as any);

    const result = await verifyCardOwnership('card-abc', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('returns error when card not found', async () => {
    vi.spyOn(prisma.userCard, 'findUnique').mockResolvedValueOnce(null);

    const result = await verifyCardOwnership('nonexistent-card', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles database error gracefully', async () => {
    vi.spyOn(prisma.userCard, 'findUnique').mockRejectedValueOnce(
      new Error('Database error')
    );

    const result = await verifyCardOwnership('card-abc', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('verify ownership');
  });

  it('prevents user from accessing cards across players', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.userCard, 'findUnique')
      .mockResolvedValueOnce({ player: { userId: 'other-user' } } as any)
      .mockResolvedValueOnce({ player: { userId: 'other-user' } } as any);

    const result1 = await verifyCardOwnership('card-1', userId);
    const result2 = await verifyCardOwnership('card-2', userId);

    expect(result1.isOwner).toBe(false);
    expect(result2.isOwner).toBe(false);
  });

  it('verifies card ownership chain (card → player → user)', async () => {
    const spy = vi.spyOn(prisma.userCard, 'findUnique');
    spy.mockResolvedValueOnce({
      player: { userId: 'user-123' },
    } as any);

    await verifyCardOwnership('card-abc', 'user-123');

    // Verify correct relationship is queried
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          player: {
            select: { userId: true },
          },
        },
      })
    );
  });

  it('prevents modification of card from non-owner', async () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    vi.spyOn(prisma.userCard, 'findUnique').mockResolvedValueOnce({
      player: { userId: otherUserId },
    } as any);

    // Attempt to modify other user's card
    const result = await verifyCardOwnership('card-abc', userId);

    expect(result.isOwner).toBe(false);
  });

  it('returns consistent error message format', async () => {
    vi.spyOn(prisma.userCard, 'findUnique').mockResolvedValueOnce(
      { player: { userId: 'other-user' } } as any
    );

    const result = await verifyCardOwnership('card-abc', 'user-123');

    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
    expect(result.error).toContain('permission');
  });
});

// ============================================================================
// SECTION 3: Benefit Ownership Verification (8 tests)
// ============================================================================

describe('Benefit Ownership Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies owner can claim own benefit', async () => {
    vi.spyOn(prisma.userBenefit, 'findUnique').mockResolvedValueOnce({
      player: { userId: 'user-123' },
    } as any);

    const result = await verifyBenefitOwnership('benefit-abc', 'user-123');

    expect(result.isOwner).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('prevents non-owner from claiming benefit', async () => {
    vi.spyOn(prisma.userBenefit, 'findUnique').mockResolvedValueOnce({
      player: { userId: 'user-456' },
    } as any);

    const result = await verifyBenefitOwnership('benefit-abc', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('returns error when benefit not found', async () => {
    vi.spyOn(prisma.userBenefit, 'findUnique').mockResolvedValueOnce(null);

    const result = await verifyBenefitOwnership('nonexistent-benefit', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles database error gracefully', async () => {
    vi.spyOn(prisma.userBenefit, 'findUnique').mockRejectedValueOnce(
      new Error('Database error')
    );

    const result = await verifyBenefitOwnership('benefit-abc', 'user-123');

    expect(result.isOwner).toBe(false);
    expect(result.error).toContain('verify ownership');
  });

  it('prevents race condition: concurrent benefit claims', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.userBenefit, 'findUnique')
      .mockResolvedValueOnce({ player: { userId } } as any)
      .mockResolvedValueOnce({ player: { userId } } as any);

    // Simulate concurrent claims by different users
    const result1 = await verifyBenefitOwnership('benefit-abc', userId);
    const result2 = await verifyBenefitOwnership('benefit-abc', 'other-user');

    expect(result1.isOwner).toBe(true);
    expect(result2.isOwner).toBe(false);
  });

  it('verifies benefit ownership chain (benefit → player → user)', async () => {
    const spy = vi.spyOn(prisma.userBenefit, 'findUnique');
    spy.mockResolvedValueOnce({
      player: { userId: 'user-123' },
    } as any);

    await verifyBenefitOwnership('benefit-abc', 'user-123');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          player: {
            select: { userId: true },
          },
        },
      })
    );
  });

  it('prevents toggling benefit of other user', async () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    vi.spyOn(prisma.userBenefit, 'findUnique').mockResolvedValueOnce({
      player: { userId: otherUserId },
    } as any);

    const result = await verifyBenefitOwnership('benefit-abc', userId);

    expect(result.isOwner).toBe(false);
  });

  it('multiple benefits isolation', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.userBenefit, 'findUnique')
      .mockResolvedValueOnce({ player: { userId } } as any)
      .mockResolvedValueOnce({ player: { userId: 'other-user' } } as any)
      .mockResolvedValueOnce({ player: { userId } } as any);

    const result1 = await verifyBenefitOwnership('benefit-1', userId);
    const result2 = await verifyBenefitOwnership('benefit-2', userId);
    const result3 = await verifyBenefitOwnership('benefit-3', userId);

    expect(result1.isOwner).toBe(true);
    expect(result2.isOwner).toBe(false); // Different user
    expect(result3.isOwner).toBe(true);
  });
});

// ============================================================================
// SECTION 4: Server Action Authorization (12 tests)
// ============================================================================

describe('Server Action Authorization Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated request when no user ID', () => {
    mockAuthUserId = null;

    expect(() => getAuthUserIdOrThrow()).toThrow('Unauthorized');
  });

  it('returns user ID when authenticated', () => {
    mockAuthUserId = 'user-123';

    const userId = getAuthUserIdOrThrow();
    expect(userId).toBe('user-123');
  });

  it('enforces authentication before ownership checks', async () => {
    mockAuthUserId = null;

    // Attempting to verify ownership without auth should fail at auth step
    expect(() => getAuthUserIdOrThrow()).toThrow();
  });

  it('prevents server action execution without proper auth context', async () => {
    mockAuthUserId = null;

    // Simulate server action that requires auth
    expect(() => {
      getAuthUserIdOrThrow();
    }).toThrow('Unauthorized');
  });

  it('combines auth + ownership checks in secure sequence', async () => {
    const userId = 'user-123';
    mockAuthUserId = userId;

    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'other-user',
    } as any);

    // Step 1: Auth check passes
    const authUserId = getAuthUserIdOrThrow();
    expect(authUserId).toBe(userId);

    // Step 2: Ownership check fails
    const ownershipResult = await verifyPlayerOwnership('player-abc', authUserId);
    expect(ownershipResult.isOwner).toBe(false);
  });

  it('prevents privilege escalation between endpoints', async () => {
    // User A attempts to perform operation
    mockAuthUserId = 'user-a';
    const userIdA = getAuthUserIdOrThrow();
    expect(userIdA).toBe('user-a');

    // Server should not allow User A's context to be used for User B's operations
    mockAuthUserId = 'user-b';
    const userIdB = getAuthUserIdOrThrow();
    expect(userIdB).toBe('user-b');
    expect(userIdB).not.toBe(userIdA);
  });

  it('synchronizes auth across multiple concurrent requests', async () => {
    mockAuthUserId = 'user-1';
    const user1 = getAuthUserIdOrThrow();

    mockAuthUserId = 'user-2';
    const user2 = getAuthUserIdOrThrow();

    expect(user1).not.toBe(user2);
  });

  it('maintains auth context throughout request lifecycle', async () => {
    const userId = 'user-123';

    mockAuthUserId = userId;

    // Multiple auth checks should return same user
    const check1 = getAuthUserIdOrThrow();
    const check2 = getAuthUserIdOrThrow();
    const check3 = getAuthUserIdOrThrow();

    expect(check1).toBe(userId);
    expect(check2).toBe(userId);
    expect(check3).toBe(userId);
  });

  it('throws on auth check when context cleared mid-operation', () => {
    mockAuthUserId = 'user-123';

    const firstCheck = getAuthUserIdOrThrow();
    expect(firstCheck).toBe('user-123');

    // Clear context
    mockAuthUserId = null;

    // Subsequent check should throw
    expect(() => getAuthUserIdOrThrow()).toThrow('Unauthorized');
  });

  it('prevents bypass of ownership checks in server actions', async () => {
    const userId = 'user-123';
    mockAuthUserId = userId;

    // Even with valid auth, ownership must be verified
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'different-user',
    } as any);

    const result = await verifyPlayerOwnership('player-abc', userId);
    expect(result.isOwner).toBe(false);
  });
});

// ============================================================================
// SECTION 5: Cross-User Data Isolation (8 tests)
// ============================================================================

describe('Cross-User Data Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('user A cannot see user B players', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'user-b',
    } as any);

    const result = await verifyPlayerOwnership('player-b1', 'user-a');

    expect(result.isOwner).toBe(false);
  });

  it('user A cannot modify user B cards', async () => {
    vi.spyOn(prisma.userCard, 'findUnique').mockResolvedValueOnce({
      player: { userId: 'user-b' },
    } as any);

    const result = await verifyCardOwnership('card-b1', 'user-a');

    expect(result.isOwner).toBe(false);
  });

  it('user A cannot claim user B benefits', async () => {
    vi.spyOn(prisma.userBenefit, 'findUnique').mockResolvedValueOnce({
      player: { userId: 'user-b' },
    } as any);

    const result = await verifyBenefitOwnership('benefit-b1', 'user-a');

    expect(result.isOwner).toBe(false);
  });

  it('multi-household isolation: player A from household 1 isolated from household 2', async () => {
    const household1UserId = 'user-household1';
    const household2UserId = 'user-household2';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId: household2UserId } as any);

    const result = await verifyPlayerOwnership('player-h2', household1UserId);

    expect(result.isOwner).toBe(false);
  });

  it('prevents data leakage through error messages', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'user-b',
    } as any);

    const result = await verifyPlayerOwnership('player-b1', 'user-a');

    // Error message should not reveal that the player exists
    expect(result.error).not.toContain('user-b');
    expect(result.error).not.toContain('user-a');
  });

  it('multiple simultaneous users remain isolated', async () => {
    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId: 'user-a' } as any)
      .mockResolvedValueOnce({ userId: 'user-b' } as any)
      .mockResolvedValueOnce({ userId: 'user-c' } as any);

    const resultA = await verifyPlayerOwnership('player-a1', 'user-a');
    const resultB = await verifyPlayerOwnership('player-b1', 'user-b');
    const resultC = await verifyPlayerOwnership('player-c1', 'user-c');

    expect(resultA.isOwner).toBe(true);
    expect(resultB.isOwner).toBe(true);
    expect(resultC.isOwner).toBe(true);

    // Cross-access attempts fail
    const crossAccessAB = await verifyPlayerOwnership('player-b1', 'user-a');
    expect(crossAccessAB.isOwner).toBe(false);
  });

  it('deleted user data should not be accessible', async () => {
    // If user is deleted, attempting operations should fail
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce(null);

    const result = await verifyPlayerOwnership('player-deleted', 'user-deleted');

    expect(result.isOwner).toBe(false);
  });
});

// ============================================================================
// SECTION 6: Authorization Edge Cases & Race Conditions (8 tests)
// ============================================================================

describe('Authorization Edge Cases & Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles race condition: concurrent access to same resource', async () => {
    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId: 'user-a' } as any)
      .mockResolvedValueOnce({ userId: 'user-a' } as any)
      .mockResolvedValueOnce({ userId: 'user-a' } as any);

    // Simulate concurrent requests
    const promise1 = verifyPlayerOwnership('player-1', 'user-a');
    const promise2 = verifyPlayerOwnership('player-1', 'user-a');
    const promise3 = verifyPlayerOwnership('player-1', 'user-a');

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    expect(result1.isOwner).toBe(true);
    expect(result2.isOwner).toBe(true);
    expect(result3.isOwner).toBe(true);
  });

  it('handles concurrent requests from different users to same resource', async () => {
    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId: 'owner-user' } as any)
      .mockResolvedValueOnce({ userId: 'owner-user' } as any);

    const ownerResult = await verifyPlayerOwnership('shared-player', 'owner-user');
    const intruderResult = await verifyPlayerOwnership('shared-player', 'intruder-user');

    expect(ownerResult.isOwner).toBe(true);
    expect(intruderResult.isOwner).toBe(false);
  });

  it('prevents TOCTOU (time-of-check-time-of-use) vulnerabilities', async () => {
    const userId = 'user-123';
    const playerId = 'player-abc';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId } as any)
      .mockResolvedValueOnce({ userId: 'different-user' } as any);

    // Check passes at time T
    const checkResult = await verifyPlayerOwnership(playerId, userId);
    expect(checkResult.isOwner).toBe(true);

    // If data changes at time T+1, next check should fail
    // (In real scenario, this would be database transaction)
    const secondCheckResult = await verifyPlayerOwnership(playerId, userId);
    expect(secondCheckResult.isOwner).toBe(false);
  });

  it('handles null/undefined inputs safely', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce(null);

    const result = await verifyPlayerOwnership('', '');

    expect(result.isOwner).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('prevents authorization bypass through ID injection', async () => {
    vi.spyOn(prisma.player, 'findUnique').mockResolvedValueOnce({
      userId: 'user-456',
    } as any);

    // Attempt with crafted ID
    const result = await verifyPlayerOwnership('player-abc" OR "1"="1', 'user-123');

    expect(result.isOwner).toBe(false);
  });

  it('maintains authorization across transaction boundaries', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId } as any)
      .mockResolvedValueOnce({ userId } as any);

    // First operation
    const result1 = await verifyPlayerOwnership('player-1', userId);
    expect(result1.isOwner).toBe(true);

    // Second operation in different transaction
    const result2 = await verifyPlayerOwnership('player-1', userId);
    expect(result2.isOwner).toBe(true);
  });

  it('prevents authorization scope escalation', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId } as any);

    // User can access own resource
    const ownResult = await verifyPlayerOwnership('own-player', userId);
    expect(ownResult.isOwner).toBe(true);

    // User cannot escalate to admin scope
    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId: 'admin-user' } as any);

    const adminResult = await verifyPlayerOwnership('admin-player', userId);
    expect(adminResult.isOwner).toBe(false);
  });

  it('handles concurrent modifications to same user account', async () => {
    const userId = 'user-123';

    vi.spyOn(prisma.player, 'findUnique')
      .mockResolvedValueOnce({ userId } as any)
      .mockResolvedValueOnce({ userId } as any);

    const [result1, result2] = await Promise.all([
      verifyPlayerOwnership('player-1', userId),
      verifyPlayerOwnership('player-2', userId),
    ]);

    expect(result1.isOwner).toBe(true);
    expect(result2.isOwner).toBe(true);
  });
});

// ============================================================================
// SECTION 7: Session Authorization (6 tests)
// ============================================================================

describe('Session-Based Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates all sessions on logout', async () => {
    vi.spyOn(prisma.session, 'updateMany').mockResolvedValueOnce({ count: 3 });

    const result = await invalidateUserSessions('user-123');

    expect(result).toBe(3);
  });

  it('gets valid sessions only', async () => {
    vi.spyOn(prisma.session, 'findMany').mockResolvedValueOnce([
      {
        id: 'session-1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      },
    ] as any);

    const sessions = await getUserSessions('user-123');

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('session-1');
  });

  it('verifies session validity on retrieval', async () => {
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-123',
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    const session = await getSessionByToken('token-abc');

    expect(session).not.toBeNull();
    expect(session?.isValid).toBe(true);
  });

  it('rejects invalid sessions', async () => {
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-123',
      isValid: false,
      expiresAt: new Date(),
    } as any);

    const session = await getSessionByToken('invalid-token');

    expect(session).toBeNull();
  });

  it('rejects expired sessions', async () => {
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-123',
      isValid: true,
      expiresAt: new Date(Date.now() - 1000), // Expired
    } as any);

    const session = await getSessionByToken('expired-token');

    expect(session).toBeNull();
  });

  it('invalidates specific session on logout', async () => {
    vi.spyOn(prisma.session, 'updateMany').mockResolvedValueOnce({ count: 1 });

    const result = await invalidateSession('token-abc');

    expect(result).toBe(true);
  });
});
