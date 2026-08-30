import { describe, expect, it } from 'vitest';
import {
  isUpcomingBookingStatus,
  matchesBookingTab,
  normalizeBookingStatus,
} from './status';

describe('booking status helpers', () => {
  it('treats WhatsApp Confirmed bookings as upcoming', () => {
    expect(normalizeBookingStatus('Confirmed')).toBe('confirmed');
    expect(isUpcomingBookingStatus('Confirmed')).toBe(true);
    expect(
      matchesBookingTab('Confirmed', '2026-09-10', 'upcoming', '2026-08-30')
    ).toBe(true);
    expect(
      matchesBookingTab('pending', '2026-09-10', 'upcoming', '2026-08-30')
    ).toBe(true);
  });

  it('does not hide confirmed travel bookings in the upcoming tab', () => {
    expect(
      matchesBookingTab('confirmed', '2026-08-01', 'upcoming', '2026-08-30')
    ).toBe(false);
    expect(
      matchesBookingTab('Cancelled', '2026-09-10', 'cancelled', '2026-08-30')
    ).toBe(true);
  });
});
