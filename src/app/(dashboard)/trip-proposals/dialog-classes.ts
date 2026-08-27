/** Shared layout classes for the Trip Proposal create wizard. */
export const TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME =
  'flex max-h-[min(90vh,720px)] w-[calc(100vw-20px)] max-w-[calc(100vw-20px)] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:w-full sm:max-w-2xl';

export const TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME =
  'mx-0 mb-0 shrink-0 rounded-none border-t bg-white px-4 py-3';

export const CREATE_TRIP_PROPOSAL_STEPS = [
  'Trip',
  'Itinerary',
  'Pricing',
  'Review',
] as const;
