import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_PEOPLE,
  DEFAULT_MIN_PEOPLE,
  SIMPLE_DESCRIPTION_MAX,
  emptySimpleTourPackageForm,
  occupancyForPriceType,
  simpleFormToWriteInput,
  validateSimpleTourPackageForm,
} from './simple-form';

describe('simple tour package form', () => {
  it('requires the basic catalog fields', () => {
    const form = emptySimpleTourPackageForm();
    expect(validateSimpleTourPackageForm(form)).toBe(
      'Package name is required'
    );
    form.name = 'Goa Getaway';
    expect(validateSimpleTourPackageForm(form)).toBe('Destination is required');
    form.destination = 'Goa';
    expect(validateSimpleTourPackageForm(form)).toBe('Price is required');
    form.starting_price = 0;
    expect(validateSimpleTourPackageForm(form)).toBe(
      'Price must be greater than 0'
    );
    form.starting_price = 29999;
    expect(validateSimpleTourPackageForm(form)).toBe(
      'Short description is required'
    );
    form.description = 'Beach holiday with breakfast.';
    expect(validateSimpleTourPackageForm(form)).toBeNull();
  });

  it('rejects descriptions longer than 200 characters', () => {
    const form = emptySimpleTourPackageForm();
    form.name = 'Goa Getaway';
    form.destination = 'Goa';
    form.starting_price = 29999;
    form.description = 'x'.repeat(SIMPLE_DESCRIPTION_MAX + 1);
    expect(validateSimpleTourPackageForm(form)).toBe(
      `Short description must be ${SIMPLE_DESCRIPTION_MAX} characters or fewer`
    );
    form.description = 'x'.repeat(SIMPLE_DESCRIPTION_MAX);
    expect(validateSimpleTourPackageForm(form)).toBeNull();
  });

  it('rejects inverted travel dates and party size', () => {
    const form = emptySimpleTourPackageForm();
    form.name = 'Goa Getaway';
    form.destination = 'Goa';
    form.starting_price = 29999;
    form.description = 'Beach holiday';
    form.valid_from = '2026-12-01';
    form.valid_until = '2026-01-01';
    expect(validateSimpleTourPackageForm(form)).toBe(
      'Available until must be on or after available from'
    );
    form.valid_until = '2026-12-15';
    form.min_people = 0;
    expect(validateSimpleTourPackageForm(form)).toBe(
      'Minimum people must be at least 1'
    );
    form.min_people = 8;
    form.max_people = 4;
    expect(validateSimpleTourPackageForm(form)).toBe(
      'Maximum people must be at least the minimum'
    );
    form.max_people = 12;
    expect(validateSimpleTourPackageForm(form)).toBeNull();
  });

  it('maps price type into a single pricing row', () => {
    const form = emptySimpleTourPackageForm();
    form.name = 'Goa Getaway';
    form.destination = 'Goa';
    form.description = 'Beach holiday';
    form.starting_price = 29999;
    form.price_type = 'Per Couple';
    form.itineraries = [
      { day_number: 1, title: 'Arrive', description: 'Check-in' },
      { day_number: 2, title: '', description: '' },
    ];
    const payload = simpleFormToWriteInput(form);
    expect(payload.price_type).toBe('Per Couple');
    expect(payload.price_for).toBe('Per Couple');
    expect(payload.pricing?.[0]).toMatchObject({
      pricing_name: 'Per Couple',
      price: 29999,
      ...occupancyForPriceType('Per Couple'),
    });
    expect(payload.itineraries).toEqual([
      { day_number: 1, title: 'Arrive', description: 'Check-in' },
    ]);
    expect(payload.min_people).toBe(DEFAULT_MIN_PEOPLE);
    expect(payload.max_people).toBe(DEFAULT_MAX_PEOPLE);
    expect(payload.valid_from).toBeNull();
    expect(payload.valid_until).toBeNull();
    expect(payload.inclusions).toBeUndefined();
    expect(payload.hotels).toBeUndefined();
  });
});
