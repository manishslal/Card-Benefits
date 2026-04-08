import { describe, it, expect } from 'vitest';
import { formatPeriodRange } from '../format-period-range';

describe('formatPeriodRange', () => {
  // ── Same-year ranges ─────────────────────────────────────────────────
  it('formats same-year range without year', () => {
    expect(formatPeriodRange('2026-04-01', '2026-04-30')).toBe('Apr 1 – Apr 30');
  });

  it('formats January full month', () => {
    expect(formatPeriodRange('2026-01-01', '2026-01-31')).toBe('Jan 1 – Jan 31');
  });

  // ── Cross-year ranges ────────────────────────────────────────────────
  it('formats cross-year range with years', () => {
    expect(formatPeriodRange('2026-01-01', '2027-06-30')).toBe(
      'Jan 1, 2026 – Jun 30, 2027'
    );
  });

  // ── No-end (ONE_TIME) ────────────────────────────────────────────────
  it('formats one-time benefit (null end)', () => {
    expect(formatPeriodRange('2026-04-01', null)).toBe('From Apr 1');
  });

  it('formats one-time benefit (undefined end)', () => {
    expect(formatPeriodRange('2026-04-01', undefined)).toBe('From Apr 1');
  });

  // ── Date objects ─────────────────────────────────────────────────────
  it('accepts Date objects', () => {
    const start = new Date('2026-04-01T00:00:00.000Z');
    const end = new Date('2026-04-30T23:59:59.999Z');
    expect(formatPeriodRange(start, end)).toBe('Apr 1 – Apr 30');
  });

  // ── HIGH-1 timezone regression test ──────────────────────────────────
  // This is the critical test: UTC midnight dates must NOT shift to the
  // previous day when formatted, regardless of the system's local timezone.
  it('formats UTC midnight dates correctly (no off-by-one from timezone)', () => {
    // These are the exact ISO strings that come from the benefit engine.
    // In US Pacific (UTC-7/-8), "2026-04-01T00:00:00.000Z" would be
    // "Mar 31 5:00 PM" locally. Without timeZone: 'UTC', the formatter
    // would display "Mar 31" instead of "Apr 1".
    const result = formatPeriodRange(
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.999Z'
    );
    expect(result).toBe('Apr 1 – Apr 30');
  });

  it('formats UTC midnight cross-year dates correctly', () => {
    const result = formatPeriodRange(
      '2026-12-31T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z'
    );
    expect(result).toBe('Dec 31, 2026 – Jan 1, 2027');
  });

  it('formats December correctly (no year-boundary shift)', () => {
    const result = formatPeriodRange(
      '2026-12-01T00:00:00.000Z',
      '2026-12-31T23:59:59.999Z'
    );
    expect(result).toBe('Dec 1 – Dec 31');
  });
});
