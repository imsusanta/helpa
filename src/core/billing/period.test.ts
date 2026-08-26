import { describe, expect, it } from 'vitest';
import { addBillingInterval, computeNextPeriodEnd } from './period';

describe('addBillingInterval', () => {
  it('adds a calendar month preserving the day when possible', () => {
    const out = addBillingInterval(
      new Date('2026-03-15T10:30:00.000Z'),
      'monthly'
    );
    expect(out.toISOString()).toBe('2026-04-15T10:30:00.000Z');
  });

  it('clamps Jan 31 to the end of February', () => {
    const out = addBillingInterval(
      new Date('2026-01-31T00:00:00.000Z'),
      'monthly'
    );
    expect(out.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    const out = addBillingInterval(
      new Date('2028-01-31T12:00:00.000Z'),
      'monthly'
    );
    expect(out.toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });

  it('handles December rollover into the next year', () => {
    const out = addBillingInterval(
      new Date('2026-12-31T23:59:59.000Z'),
      'monthly'
    );
    expect(out.toISOString()).toBe('2027-01-31T23:59:59.000Z');
  });

  it('adds one year, clamping Feb 29 to Feb 28 in a non-leap year', () => {
    const out = addBillingInterval(
      new Date('2028-02-29T08:00:00.000Z'),
      'yearly'
    );
    expect(out.toISOString()).toBe('2029-02-28T08:00:00.000Z');
  });
});

describe('computeNextPeriodEnd', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('extends from the current period end when renewing early', () => {
    const out = computeNextPeriodEnd({
      now,
      currentPeriodEnd: new Date('2026-09-20T12:00:00.000Z'),
      interval: 'monthly',
    });
    // Early renewal keeps the remaining 5 days: period extends exactly once.
    expect(out.toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('starts a fresh period from now when the subscription lapsed', () => {
    const out = computeNextPeriodEnd({
      now,
      currentPeriodEnd: new Date('2026-09-01T12:00:00.000Z'),
      interval: 'monthly',
    });
    expect(out.toISOString()).toBe('2026-10-15T12:00:00.000Z');
  });

  it('starts from now when there is no previous period', () => {
    const out = computeNextPeriodEnd({
      now,
      currentPeriodEnd: null,
      interval: 'yearly',
    });
    expect(out.toISOString()).toBe('2027-09-15T12:00:00.000Z');
  });
});
