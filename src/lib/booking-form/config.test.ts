import { describe, expect, it } from 'vitest';
import {
  CLINIC_ONLY_BOOKING_FIELDS,
  getBookingFieldsForIndustry,
  getDefaultBookingFormConfig,
  isClinicBookingIndustry,
  isTravelBookingIndustry,
  mergeBookingFormConfig,
} from './config';

describe('industry booking form config', () => {
  it('gives travel workspaces traveller fields instead of clinic fields', () => {
    const keys = getBookingFieldsForIndustry('travel').map(
      (field) => field.key
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'name',
        'phone',
        'package_id',
        'destination',
        'travel_date',
        'guests_count',
        'total_price',
      ])
    );
    for (const key of CLINIC_ONLY_BOOKING_FIELDS) {
      expect(keys).not.toContain(key);
    }
    expect(
      getBookingFieldsForIndustry('travel').find(
        (field) => field.key === 'name'
      )?.label
    ).toBe('Traveller Name');
  });

  it('keeps clinic workspaces on patient / department fields', () => {
    const keys = getBookingFieldsForIndustry('hospital_clinic').map(
      (field) => field.key
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'name',
        'phone',
        'blood_group',
        'doctor_id',
        'department',
      ])
    );
    expect(keys).not.toContain('package_id');
    expect(isClinicBookingIndustry('clinic')).toBe(true);
    expect(isTravelBookingIndustry('travel')).toBe(true);
  });

  it('uses restaurant reservation fields and coaching session fields', () => {
    expect(getBookingFieldsForIndustry('restaurant').map((f) => f.key)).toEqual(
      expect.arrayContaining([
        'name',
        'phone',
        'guests_count',
        'appointment_date',
        'appointment_time',
      ])
    );
    expect(getBookingFieldsForIndustry('coaching').map((f) => f.label)).toEqual(
      expect.arrayContaining(['Student Name', 'Course / Programme'])
    );
  });

  it('ignores saved clinic config keys on a travel workspace', () => {
    const merged = mergeBookingFormConfig('travel', {
      ...getDefaultBookingFormConfig('hospital_clinic'),
      blood_group: { show: true, required: true },
      department: { show: true, required: true },
      destination: { show: true, required: true },
    });
    expect(merged.blood_group).toBeUndefined();
    expect(merged.department).toBeUndefined();
    expect(merged.destination).toEqual({ show: true, required: true });
    expect(merged.name).toEqual({ show: true, required: true });
    expect(merged.phone).toEqual({ show: true, required: true });
  });
});
