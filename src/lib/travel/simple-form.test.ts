import { describe, expect, it } from 'vitest';
import {
  emptySimpleTourPackageForm,
  occupancyForPriceType,
  simpleFormToWriteInput,
  validateSimpleTourPackageForm,
} from './simple-form';

describe('simple tour package form', () => {
  it('requires the basic catalog fields', () => {
    const form = emptySimpleTourPackageForm();
    expect(validateSimpleTourPackageForm(form)).toBe('Package name is required');
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
    expect(payload.pricing?.[0]).toMatchObject({
      pricing_name: 'Per Couple',
      price: 29999,
      ...occupancyForPriceType('Per Couple'),
    });
    expect(payload.itineraries).toEqual([
      { day_number: 1, title: 'Arrive', description: 'Check-in' },
    ]);
    expect(payload.inclusions).toBeUndefined();
    expect(payload.hotels).toBeUndefined();
  });
});
