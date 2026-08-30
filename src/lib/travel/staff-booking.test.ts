import { describe, expect, it } from 'vitest';
import { parseTravelBookingNotes } from './staff-booking';

describe('travel booking notes', () => {
  it('parses WhatsApp and staff travel booking notes for the trip list', () => {
    expect(
      parseTravelBookingNotes(
        'Travel Booking | Package: Kashmir Delight | Destination: Kashmir | Guests: 2 | Total: ₹27,999'
      )
    ).toEqual({
      packageName: 'Kashmir Delight',
      destination: 'Kashmir',
      guestsCount: 2,
      totalPriceLabel: '₹27,999',
    });
  });
});
