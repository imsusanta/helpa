/**
 * UTC-safe billing period arithmetic.
 *
 * All subscription period math goes through these helpers so month-end
 * dates behave consistently: adding one month to Jan 31 yields the last
 * day of February (Feb 28/29), never a rollover into March. This mirrors
 * PostgreSQL's `+ interval '1 month'` semantics, which the atomic payment
 * RPC uses server-side — the two must agree.
 */

import type { BillingInterval } from './types';

function daysInUtcMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of `monthIndex`.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds one billing interval (calendar month or year) to a UTC instant,
 * clamping the day-of-month when the target month is shorter.
 */
export function addBillingInterval(
  from: Date,
  interval: BillingInterval
): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  const targetYear = interval === 'yearly' ? year + 1 : year;
  const targetMonth = interval === 'yearly' ? month : month + 1;

  const normalizedYear = targetYear + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const clampedDay = Math.min(
    day,
    daysInUtcMonth(normalizedYear, normalizedMonth)
  );

  return new Date(
    Date.UTC(
      normalizedYear,
      normalizedMonth,
      clampedDay,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds()
    )
  );
}

/**
 * Computes the next period end for a renewal.
 *
 * Renewing before expiry extends from the current period end (no paid time
 * is lost); renewing after expiry starts a fresh period from `now`.
 */
export function computeNextPeriodEnd(params: {
  now: Date;
  currentPeriodEnd?: Date | null;
  interval: BillingInterval;
}): Date {
  const base =
    params.currentPeriodEnd && params.currentPeriodEnd > params.now
      ? params.currentPeriodEnd
      : params.now;
  return addBillingInterval(base, params.interval);
}
