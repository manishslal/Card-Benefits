/**
 * Unit tests for PATCH /api/benefits/[id]/toggle-used
 *
 * Covers the period-status guard added for api-4 / api-6:
 *   - Returns 400 when periodStatus=EXPIRED and engine ON
 *   - Returns 400 when periodStatus=UPCOMING and engine ON
 *   - Returns 200 when periodStatus=ACTIVE and engine ON
 *   - Returns 200 when periodStatus=null (legacy) and engine ON
 *   - Returns 200 when periodStatus=EXPIRED and engine OFF (guard skipped)
 *   - Correctly increments timesUsed on ACTIVE toggle
 *   - Does NOT increment timesUsed on rejected toggle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const { mockFindUnique, mockUpdate, engineEnabled } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  engineEnabled: { value: false },
}));

vi.mock('@/shared/lib', () => ({
  prisma: {
    userBenefit: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  featureFlags: {
    get BENEFIT_ENGINE_ENABLED() {
      return engineEnabled.value;
    },
  },
}));

import { PATCH } from '../route';

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(benefitId: string, body: { isUsed: boolean }, userId?: string) {
  const url = `http://localhost/api/benefits/${benefitId}/toggle-used`;
  const req = new Request(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify(body),
  });

  // Attach nextUrl for the route handler (NextRequest compat)
  const nextReq = req as any;
  nextReq.nextUrl = new URL(url);
  return nextReq;
}

function makeBenefit(overrides: Partial<{
  id: string;
  isUsed: boolean;
  timesUsed: number;
  periodStatus: string | null;
  claimedAt: Date | null;
  userId: string;
}> = {}) {
  return {
    id: overrides.id ?? 'benefit-1',
    isUsed: overrides.isUsed ?? false,
    timesUsed: overrides.timesUsed ?? 0,
    periodStatus: overrides.periodStatus === undefined ? 'ACTIVE' : overrides.periodStatus,
    claimedAt: overrides.claimedAt ?? null,
    userCard: {
      player: {
        userId: overrides.userId ?? 'user-1',
      },
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  engineEnabled.value = false;
});

describe('PATCH /api/benefits/[id]/toggle-used', () => {
  // ──────────────────────────────────────────────────────────────────
  // Authentication & authorization (existing behavior — sanity checks)
  // ──────────────────────────────────────────────────────────────────

  it('returns 401 when x-user-id header is missing', async () => {
    const req = makeRequest('benefit-1', { isUsed: true });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 404 when benefit does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = makeRequest('nonexistent', { isUsed: true }, 'user-1');
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own the benefit', async () => {
    mockFindUnique.mockResolvedValue(makeBenefit({ userId: 'other-user' }));

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  // ──────────────────────────────────────────────────────────────────
  // Period-status guard — engine ON
  // ──────────────────────────────────────────────────────────────────

  it('returns 400 with PERIOD_EXPIRED when periodStatus=EXPIRED and engine ON', async () => {
    engineEnabled.value = true;
    mockFindUnique.mockResolvedValue(makeBenefit({ periodStatus: 'EXPIRED' }));

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('PERIOD_EXPIRED');
    expect(json.error).toContain('expired');
  });

  it('returns 400 with PERIOD_UPCOMING when periodStatus=UPCOMING and engine ON', async () => {
    engineEnabled.value = true;
    mockFindUnique.mockResolvedValue(makeBenefit({ periodStatus: 'UPCOMING' }));

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('PERIOD_UPCOMING');
    expect(json.error).toContain('not started');
  });

  it('returns 400 with INVALID_PERIOD_STATUS for unknown non-ACTIVE status and engine ON', async () => {
    engineEnabled.value = true;
    mockFindUnique.mockResolvedValue(makeBenefit({ periodStatus: 'CANCELLED' }));

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('INVALID_PERIOD_STATUS');
    expect(json.error).toContain('CANCELLED');
  });

  it('returns 200 when periodStatus=ACTIVE and engine ON', async () => {
    engineEnabled.value = true;
    const benefit = makeBenefit({ periodStatus: 'ACTIVE' });
    mockFindUnique.mockResolvedValue(benefit);
    mockUpdate.mockResolvedValue({
      ...benefit,
      isUsed: true,
      timesUsed: 1,
      updatedAt: new Date(),
    });

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.benefit.isUsed).toBe(true);
  });

  it('returns 200 when periodStatus=null (legacy row) and engine ON', async () => {
    engineEnabled.value = true;
    const benefit = makeBenefit({ periodStatus: null });
    mockFindUnique.mockResolvedValue(benefit);
    mockUpdate.mockResolvedValue({
      ...benefit,
      isUsed: true,
      timesUsed: 1,
      updatedAt: new Date(),
    });

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────
  // Period-status guard — engine OFF (guard should be skipped)
  // ──────────────────────────────────────────────────────────────────

  it('returns 200 when periodStatus=EXPIRED and engine OFF (guard skipped)', async () => {
    engineEnabled.value = false;
    const benefit = makeBenefit({ periodStatus: 'EXPIRED' });
    mockFindUnique.mockResolvedValue(benefit);
    mockUpdate.mockResolvedValue({
      ...benefit,
      isUsed: true,
      timesUsed: 1,
      updatedAt: new Date(),
    });

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────
  // Toggle correctness — timesUsed increment
  // ──────────────────────────────────────────────────────────────────

  it('increments timesUsed when toggling unused→used on ACTIVE period', async () => {
    engineEnabled.value = true;
    const benefit = makeBenefit({ periodStatus: 'ACTIVE', isUsed: false, timesUsed: 2 });
    mockFindUnique.mockResolvedValue(benefit);
    mockUpdate.mockResolvedValue({
      ...benefit,
      isUsed: true,
      timesUsed: 3,
      updatedAt: new Date(),
    });

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(200);

    // Verify the update was called with the correct data
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.data.isUsed).toBe(true);
    expect(updateArg.data.timesUsed).toBe(3); // was 2, incremented to 3
  });

  it('does NOT call update on rejected EXPIRED toggle', async () => {
    engineEnabled.value = true;
    mockFindUnique.mockResolvedValue(makeBenefit({ periodStatus: 'EXPIRED', timesUsed: 2 }));

    const req = makeRequest('benefit-1', { isUsed: true }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    // update should NOT have been called at all
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────
  // Bidirectional toggle (api-6: covers used→unused too)
  // ──────────────────────────────────────────────────────────────────

  it('blocks un-toggling (used→unused) on EXPIRED period with engine ON', async () => {
    engineEnabled.value = true;
    mockFindUnique.mockResolvedValue(makeBenefit({ periodStatus: 'EXPIRED', isUsed: true }));

    const req = makeRequest('benefit-1', { isUsed: false }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('PERIOD_EXPIRED');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('allows un-toggling (used→unused) on ACTIVE period with engine ON', async () => {
    engineEnabled.value = true;
    const benefit = makeBenefit({ periodStatus: 'ACTIVE', isUsed: true, timesUsed: 3 });
    mockFindUnique.mockResolvedValue(benefit);
    mockUpdate.mockResolvedValue({
      ...benefit,
      isUsed: false,
      timesUsed: 3, // timesUsed stays the same on un-toggle
      updatedAt: new Date(),
    });

    const req = makeRequest('benefit-1', { isUsed: false }, 'user-1');
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.benefit.isUsed).toBe(false);
  });
});
