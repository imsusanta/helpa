import { describe, expect, it } from 'vitest';
import { isPublicRoute } from '@/proxy';

describe('proxy public routes', () => {
  it('allows anonymous access to public booking-form APIs', () => {
    expect(isPublicRoute('/api/public/forms/abc-token')).toBe(true);
    expect(isPublicRoute('/api/public/forms/abc-token/submit')).toBe(true);
    expect(isPublicRoute('/api/public/trip-proposals/abc-token')).toBe(true);
  });

  it('allows anonymous access to customer-facing share pages', () => {
    expect(isPublicRoute('/f/abc-token')).toBe(true);
    expect(
      isPublicRoute('/proposal/11111111-1111-1111-1111-111111111111')
    ).toBe(true);
  });

  it('does not accidentally open authenticated clinic APIs', () => {
    expect(isPublicRoute('/trip-proposals')).toBe(false);
    expect(isPublicRoute('/quotations')).toBe(false);
    expect(isPublicRoute('/api/leads/lead-1/handoff')).toBe(false);
    expect(isPublicRoute('/api/appointments/appt-1/confirm')).toBe(false);
    expect(isPublicRoute('/api/whatsapp/send')).toBe(false);
  });
});
