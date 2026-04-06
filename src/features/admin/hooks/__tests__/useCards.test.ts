import { describe, it, expect, vi } from 'vitest';

describe('useCards Hook', () => {
  it('should be importable', () => {
    expect(() => {
      require('../useCards');
    }).not.toThrow();
  });

  it('should have required exports', async () => {
    const { useCards } = await import('../useCards');
    expect(typeof useCards).toBe('function');
  });
});
