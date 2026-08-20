import { describe, expect, it } from 'vitest';
import { appointmentLocalToUtc } from './appointment-triggers';

describe('appointment reminder scheduling', () => {
  it('subtracts the reminder window using the business timezone', () => {
    const runAt = appointmentLocalToUtc(
      '2026-08-25',
      '15:00',
      'Asia/Kolkata',
      120
    );
    expect(runAt.toISOString()).toBe('2026-08-25T07:30:00.000Z');
  });

  it('handles date rollover', () => {
    const runAt = appointmentLocalToUtc(
      '2026-08-25',
      '00:30',
      'Asia/Kolkata',
      60
    );
    expect(runAt.toISOString()).toBe('2026-08-24T18:00:00.000Z');
  });

  it('handles DST-aware IANA timezones', () => {
    const winter = appointmentLocalToUtc(
      '2026-01-15',
      '12:00',
      'America/New_York',
      0
    );
    const summer = appointmentLocalToUtc(
      '2026-07-15',
      '12:00',
      'America/New_York',
      0
    );
    expect(winter.toISOString()).toBe('2026-01-15T17:00:00.000Z');
    expect(summer.toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('rejects invalid appointment times', () => {
    expect(() =>
      appointmentLocalToUtc('2026-08-25', '25:61', 'Asia/Kolkata', 30)
    ).toThrow('Invalid appointment date/time');
  });
});
