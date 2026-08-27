/**
 * DialogContent ships with `sm:max-w-sm`. These classes must include a
 * matching `sm:max-w-*` override or the travel workspace crushes to 384px.
 */
export const TRIP_PROPOSAL_CREATE_DIALOG_CLASSNAME =
  'flex h-[min(94vh,920px)] max-h-[min(94vh,920px)] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:w-[calc(100vw-40px)] sm:max-w-[min(1380px,calc(100vw-40px))]';

export const TRIP_PROPOSAL_CREATE_FOOTER_CLASSNAME =
  'mx-0 mb-0 shrink-0 rounded-none border-t bg-white px-5 py-4 sm:px-6';
