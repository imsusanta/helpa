import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey,
  getDateKeyInTimeZone,
  isValidTimeZone,
  isWithinBusinessHours,
  zonedDateTimeToUtc,
} from './timezone';

describe('clinic timezone helpers', () => {
  it('uses the clinic calendar date instead of the server date', () => {
    const instant = new Date('2026-08-09T20:30:00.000Z');
    expect(getDateKeyInTimeZone(instant, 'Asia/Kolkata')).toBe('2026-08-10');
    expect(getDateKeyInTimeZone(instant, 'America/New_York')).toBe(
      '2026-08-09'
    );
  });

  it('converts clinic-local appointments to UTC including DST offsets', () => {
    expect(
      zonedDateTimeToUtc('2026-08-10', '10:00:00', 'Asia/Kolkata').toISOString()
    ).toBe('2026-08-10T04:30:00.000Z');
    expect(
      zonedDateTimeToUtc(
        '2026-07-10',
        '10:00:00',
        'America/New_York'
      ).toISOString()
    ).toBe('2026-07-10T14:00:00.000Z');
  });

  it('supports business-hour windows that cross midnight', () => {
    expect(isWithinBusinessHours(23 * 60, '22:00', '06:00')).toBe(true);
    expect(isWithinBusinessHours(5 * 60, '22:00', '06:00')).toBe(true);
    expect(isWithinBusinessHours(12 * 60, '22:00', '06:00')).toBe(false);
  });

  it('validates timezones and date-key arithmetic', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Not/A_Timezone')).toBe(false);
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});
