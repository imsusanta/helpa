/**
 * DialogContent ships with `sm:max-w-sm`. These classes must include a
 * matching `sm:max-w-*` override or the wizard crushes to 384px.
 */
export const TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME =
  'flex max-h-[min(88vh,640px)] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:w-full sm:max-w-xl';

export const TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME =
  'mx-0 mb-0 shrink-0 rounded-none border-t bg-white px-4 py-3';

export const CREATE_TRIP_PROPOSAL_STEPS = [
  'Trip',
  'Itinerary',
  'Pricing',
  'Review',
] as const;
