import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';
import { getTripProposalDetailsError } from '@/app/(dashboard)/trip-proposals/create-dialog';
import {
  CREATE_TRIP_PROPOSAL_STEPS,
  TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME,
  TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME,
} from '@/app/(dashboard)/trip-proposals/dialog-classes';

const DIALOG_CONTENT_DEFAULT =
  'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 duration-100 outline-none sm:max-w-sm';

const DIALOG_FOOTER_DEFAULT =
  'bg-muted/50 -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-end';

describe('Create Trip Proposal dialog layout', () => {
  it('overrides the default sm:max-w-sm with a compact xl wizard width', () => {
    const merged = cn(
      DIALOG_CONTENT_DEFAULT,
      TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME
    );

    expect(merged).not.toMatch(/(?:^|\s)sm:max-w-sm(?:\s|$)/);
    expect(merged).toContain('sm:max-w-xl');
    expect(merged).not.toContain('1380px');
    expect(merged).toContain('flex');
    expect(merged).not.toMatch(/(?:^|\s)grid(?:\s|$)/);
    expect(merged).toContain('p-0');
  });

  it('cancels DialogFooter negative margins that assume the default p-4 padding', () => {
    const merged = cn(
      DIALOG_FOOTER_DEFAULT,
      TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME
    );

    expect(merged).not.toMatch(/(?:^|\s)-mx-4(?:\s|$)/);
    expect(merged).not.toMatch(/(?:^|\s)-mb-4(?:\s|$)/);
    expect(merged).toContain('mx-0');
    expect(merged).toContain('mb-0');
  });

  it('uses four short wizard steps instead of one crowded screen', () => {
    expect(CREATE_TRIP_PROPOSAL_STEPS).toEqual([
      'Trip',
      'Itinerary',
      'Pricing',
      'Review',
    ]);
  });

  it('blocks leaving trip details until traveller, destination, and dates are set', () => {
    expect(
      getTripProposalDetailsError({
        contactId: '',
        destination: 'Goa',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      })
    ).toBe('Please select a traveller');
    expect(
      getTripProposalDetailsError({
        contactId: 'c1',
        destination: '',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      })
    ).toBe('Destination is required');
    expect(
      getTripProposalDetailsError({
        contactId: 'c1',
        destination: 'Goa',
        startDate: '2026-09-05',
        endDate: '2026-09-01',
      })
    ).toBe('End date cannot be before start date');
    expect(
      getTripProposalDetailsError({
        contactId: 'c1',
        destination: 'Goa',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      })
    ).toBeNull();
  });
});
