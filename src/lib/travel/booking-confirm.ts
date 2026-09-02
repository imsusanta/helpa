import { getAdminClient } from '@/lib/db/server';
import { engineSendButtons, engineSendText } from '@/lib/automations/meta-send';
import {
  getTourPackageDetail,
  matchTourPackagesForMessage,
} from '@/lib/travel/retrieval';
import {
  isDepartureBookable,
  isPackageCurrentlyActive,
  resolvePackagePrice,
} from '@/lib/travel/matching';
import type { TourPackage, TourPackageDetail } from '@/lib/travel/types';

export const TRAVEL_BOOKING_CONFIRM_BUTTON_ID = 'travel_booking_confirm';
export const TRAVEL_BOOKING_LATER_BUTTON_ID = 'travel_booking_later';
export const TRAVEL_PENDING_BOOKING_KEY = 'travel_pending_booking';
export const TRAVEL_LAST_PACKAGE_KEY = 'travel_last_package';

/** Button taps are unambiguous, so the offer stays redeemable for 48 hours. */
export const PENDING_TTL_MS = 48 * 60 * 60 * 1000;
/**
 * Free-text confirmation ("yes", "1") is context-blind, so it only honors an
 * offer sent within this window — long enough for a button-less client, short
 * enough that a "yes" to a later unrelated question cannot confirm a booking.
 */
export const TEXT_CONFIRM_TTL_MS = 30 * 60 * 1000;

export const MAX_TRAVEL_GUESTS = 50;

export interface TravelPendingBooking {
  package_id: string | null;
  package_name: string;
  destination: string;
  travel_date: string;
  guests_count: number;
  total_price: number;
  currency: string;
  conversation_id: string | null;
  offered_at: string;
}

export interface DiscussedTourPackage {
  package_id: string;
  package_name: string;
  destination: string;
  starting_price: number | null;
  currency: string;
}

export interface TravelBookingConfirmOffer {
  packageName: string;
  destination: string;
  travelDate: string;
  guestsCount: number;
  totalPrice: number;
  currency: string;
  totalPriceLabel: string;
  bodyText: string;
  buttons: { id: string; title: string }[];
}

export type TravelBookingConfirmResult =
  | { status: 'confirmed'; bookingId: string; packageName: string }
  | { status: 'missing_package' }
  | { status: 'no_pending' }
  | {
      status: 'unavailable';
      reason: 'package_inactive' | 'travel_date_past' | 'departure_unavailable' | 'invalid_guests';
      packageName: string;
    }
  | {
      status: 'price_changed';
      packageName: string;
      newPrice: number;
      currency: string;
    }
  | { status: 'failed'; error: string };

export type TravelBookingReplyAction = 'confirm' | 'later' | 'stale_confirm';

export function classifyTravelBookingReply(opts: {
  replyId?: string | null;
  text?: string | null;
  pending?: TravelPendingBooking | null;
  nowMs?: number;
}): TravelBookingReplyAction | null {
  const nowMs = opts.nowMs ?? Date.now();
  // The button id is tied to one specific offer message, but it stays tappable
  // forever in WhatsApp history — a stale tap must never re-create a booking.
  if (opts.replyId === TRAVEL_BOOKING_CONFIRM_BUTTON_ID) {
    return opts.pending && isFreshPending(opts.pending, nowMs)
      ? 'confirm'
      : 'stale_confirm';
  }
  if (opts.replyId === TRAVEL_BOOKING_LATER_BUTTON_ID) return 'later';
  if (
    !opts.pending ||
    !isFreshPending(opts.pending, nowMs, TEXT_CONFIRM_TTL_MS)
  ) {
    return null;
  }
  const cleaned = (opts.text || '').trim().toLowerCase();
  if (
    [
      '1',
      'confirm',
      'yes',
      'confirm booking',
      'booking confirm',
      'confirm this booking',
    ].includes(cleaned)
  ) {
    return 'confirm';
  }
  if (['2', 'not yet', 'later', 'no'].includes(cleaned)) {
    return 'later';
  }
  return null;
}

export function isFreshPending(
  pending: TravelPendingBooking | null,
  nowMs = Date.now(),
  ttlMs = PENDING_TTL_MS
): boolean {
  if (!pending?.offered_at) return false;
  const offered = Date.parse(pending.offered_at);
  if (!Number.isFinite(offered)) return false;
  return nowMs - offered <= ttlMs;
}

export function formatTravelPrice(
  amount: number | null | undefined,
  currency = 'INR'
): string {
  if (amount == null || !Number.isFinite(Number(amount)))
    return 'to be confirmed';
  const value = Number(amount);
  if (currency === 'INR') return `₹${value.toLocaleString('en-IN')}`;
  return `${currency} ${value.toLocaleString('en-US')}`;
}

export function defaultTravelDate(now = new Date()): string {
  const next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function buildBookingConfirmMessage(offer: {
  packageName: string;
  destination: string;
  travelDate: string;
  guestsCount: number;
  totalPrice: number;
  currency?: string;
}): TravelBookingConfirmOffer {
  const currency = offer.currency || 'INR';
  const totalPriceLabel = formatTravelPrice(offer.totalPrice, currency);
  const knownPackage =
    offer.packageName && offer.packageName !== 'the package we discussed';
  const bodyText = knownPackage
    ? [
        'Please confirm this Travel Booking:',
        '',
        `Package: ${offer.packageName}`,
        offer.destination ? `Destination: ${offer.destination}` : '',
        `Travel date: ${offer.travelDate}`,
        `Guests: ${offer.guestsCount}`,
        `Total: ${totalPriceLabel}`,
        '',
        'Tap Confirm Booking to complete. If you do not see the button, reply 1.',
      ]
        .filter((line) => line !== '')
        .join('\n')
    : [
        'Ready to confirm your Travel Booking?',
        '',
        'Tap Confirm Booking to lock the package we discussed. If you have not chosen a package yet, reply with the package name first.',
        'If you do not see the button, reply 1.',
      ].join('\n');

  return {
    ...offer,
    currency,
    totalPriceLabel,
    bodyText,
    buttons: [
      { id: TRAVEL_BOOKING_CONFIRM_BUTTON_ID, title: 'Confirm Booking' },
      { id: TRAVEL_BOOKING_LATER_BUTTON_ID, title: 'Not yet' },
    ],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function parsePending(value: unknown): TravelPendingBooking | null {
  const row = asRecord(value);
  if (!row.package_name && !row.package_id) return null;
  return {
    package_id: row.package_id ? String(row.package_id) : null,
    package_name: String(row.package_name || 'the package we discussed'),
    destination: String(row.destination || ''),
    travel_date: String(row.travel_date || defaultTravelDate()),
    guests_count: clampGuests(row.guests_count),
    total_price: Number(row.total_price) || 0,
    currency: String(row.currency || 'INR'),
    conversation_id: row.conversation_id ? String(row.conversation_id) : null,
    offered_at: String(row.offered_at || ''),
  };
}

function clampGuests(value: unknown): number {
  return Math.min(
    MAX_TRAVEL_GUESTS,
    Math.max(1, Math.trunc(Number(value)) || 1)
  );
}

function parseDiscussed(value: unknown): DiscussedTourPackage | null {
  const row = asRecord(value);
  if (!row.package_id && !row.package_name) return null;
  return {
    package_id: row.package_id ? String(row.package_id) : '',
    package_name: String(row.package_name || ''),
    destination: String(row.destination || ''),
    starting_price:
      row.starting_price == null ? null : Number(row.starting_price),
    currency: String(row.currency || 'INR'),
  };
}

async function loadContactMetadata(
  accountId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  const db = getAdminClient();
  const { data } = await db
    .from('contacts')
    .select('metadata')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .maybeSingle();
  return asRecord(data?.metadata);
}

async function mergeContactMetadata(
  accountId: string,
  contactId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const current = await loadContactMetadata(accountId, contactId);
  const db = getAdminClient();
  await db
    .from('contacts')
    .update({
      metadata: { ...current, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('account_id', accountId);
}

export async function rememberDiscussedTourPackage(opts: {
  accountId: string;
  contactId: string;
  pkg: Pick<
    TourPackage,
    'id' | 'name' | 'destination' | 'starting_price' | 'currency'
  >;
}): Promise<void> {
  if (!opts.contactId || !opts.pkg.id) return;
  await mergeContactMetadata(opts.accountId, opts.contactId, {
    [TRAVEL_LAST_PACKAGE_KEY]: {
      package_id: opts.pkg.id,
      package_name: opts.pkg.name,
      destination: opts.pkg.destination,
      starting_price: opts.pkg.starting_price,
      currency: opts.pkg.currency || 'INR',
    } satisfies DiscussedTourPackage,
  });
}

export async function readPendingTravelBooking(
  accountId: string,
  contactId: string
): Promise<TravelPendingBooking | null> {
  const metadata = await loadContactMetadata(accountId, contactId);
  return parsePending(metadata[TRAVEL_PENDING_BOOKING_KEY]);
}

export async function storePendingTravelBooking(
  accountId: string,
  contactId: string,
  pending: TravelPendingBooking
): Promise<void> {
  await mergeContactMetadata(accountId, contactId, {
    [TRAVEL_PENDING_BOOKING_KEY]: pending,
  });
}

export async function clearPendingTravelBooking(
  accountId: string,
  contactId: string
): Promise<void> {
  await mergeContactMetadata(accountId, contactId, {
    [TRAVEL_PENDING_BOOKING_KEY]: null,
  });
}

async function resolveDiscussedPackage(opts: {
  accountId: string;
  contactId: string;
  packageName?: string;
  messageText?: string;
}): Promise<{
  package_id: string | null;
  package_name: string;
  destination: string;
  total_price: number;
  currency: string;
}> {
  if (opts.packageName?.trim()) {
    const result = await matchTourPackagesForMessage(
      getAdminClient(),
      opts.accountId,
      opts.packageName
    );
    const top = result.matches[0] || result.nearMatches[0];
    if (top) {
      return {
        package_id: top.package.id,
        package_name: top.package.name,
        destination: top.package.destination,
        total_price: top.matchedPrice ?? top.package.starting_price ?? 0,
        currency: top.matchedCurrency || top.package.currency || 'INR',
      };
    }
  }

  const metadata = await loadContactMetadata(opts.accountId, opts.contactId);
  const last = parseDiscussed(metadata[TRAVEL_LAST_PACKAGE_KEY]);
  if (last?.package_name) {
    return {
      package_id: last.package_id || null,
      package_name: last.package_name,
      destination: last.destination,
      total_price: last.starting_price ?? 0,
      currency: last.currency || 'INR',
    };
  }

  if (opts.messageText?.trim()) {
    const result = await matchTourPackagesForMessage(
      getAdminClient(),
      opts.accountId,
      opts.messageText
    );
    const top = result.matches[0];
    if (top) {
      return {
        package_id: top.package.id,
        package_name: top.package.name,
        destination: top.package.destination,
        total_price: top.matchedPrice ?? top.package.starting_price ?? 0,
        currency: top.matchedCurrency || top.package.currency || 'INR',
      };
    }
  }

  return {
    package_id: null,
    package_name: 'the package we discussed',
    destination: '',
    total_price: 0,
    currency: 'INR',
  };
}

export async function prepareTravelBookingConfirmOffer(opts: {
  accountId: string;
  contactId: string;
  conversationId?: string | null;
  packageName?: string;
  travelDate?: string;
  guestsCount?: number;
  totalPrice?: number;
  messageText?: string;
}): Promise<TravelBookingConfirmOffer> {
  const resolved = await resolveDiscussedPackage(opts);
  const guestsCount = clampGuests(opts.guestsCount);
  const travelDate =
    opts.travelDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.travelDate)
      ? opts.travelDate
      : defaultTravelDate();
  const totalPrice =
    opts.totalPrice != null && Number.isFinite(Number(opts.totalPrice))
      ? Number(opts.totalPrice)
      : resolved.total_price;

  const offer = buildBookingConfirmMessage({
    packageName: resolved.package_name,
    destination: resolved.destination,
    travelDate,
    guestsCount,
    totalPrice,
    currency: resolved.currency,
  });

  await storePendingTravelBooking(opts.accountId, opts.contactId, {
    package_id: resolved.package_id,
    package_name: resolved.package_name,
    destination: resolved.destination,
    travel_date: travelDate,
    guests_count: guestsCount,
    total_price: totalPrice,
    currency: resolved.currency,
    conversation_id: opts.conversationId || null,
    offered_at: new Date().toISOString(),
  });

  if (resolved.package_id) {
    await rememberDiscussedTourPackage({
      accountId: opts.accountId,
      contactId: opts.contactId,
      pkg: {
        id: resolved.package_id,
        name: resolved.package_name,
        destination: resolved.destination,
        starting_price: totalPrice,
        currency: resolved.currency,
      },
    });
  }

  return offer;
}

/**
 * Load the canonical package detail for a pending draft, tenant-scoped.
 * Falls back to a message match on the stored package name when the stored id
 * no longer resolves (renamed/deleted packages must never cross accounts).
 */
async function resolveDraftPackageDetail(
  accountId: string,
  draft: TravelPendingBooking
): Promise<TourPackageDetail | null> {
  const db = getAdminClient();
  if (draft.package_id) {
    const detail = await getTourPackageDetail(
      db,
      accountId,
      draft.package_id
    );
    if (detail) return detail;
  }
  if (draft.package_name && draft.package_name !== 'the package we discussed') {
    const result = await matchTourPackagesForMessage(
      db,
      accountId,
      draft.package_name
    );
    return result.matches[0]?.package ?? result.nearMatches[0]?.package ?? null;
  }
  return null;
}

/**
 * True when the draft price still exists among the package's currently
 * offerable prices (starting price, pricing rows, or the matching departure).
 * Per-person vs per-package totals are ambiguous, so we only reject prices
 * that no longer exist at all — the honest signal that the admin repriced.
 */
function isKnownCurrentPrice(
  detail: TourPackageDetail,
  departure: TourPackageDetail['departures'][number] | null,
  amount: number
): boolean {
  if (!(amount > 0)) return true;
  const priceKey = (value: unknown) => Math.round(Number(value) * 100);
  const candidates = [
    detail.starting_price,
    ...detail.pricing.map((row) => row.price),
    ...(departure?.price != null ? [departure.price] : []),
  ].filter((price) => price != null);
  if (candidates.length === 0) return true;
  return candidates.some((price) => priceKey(price) === priceKey(amount));
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Confirm a pending travel booking.
 *
 * The pending offer is claimed atomically first (exactly one concurrent
 * confirmer wins), then the package is re-validated at confirmation time —
 * active status, future travel date, departure seats, and a price that still
 * exists on the package. The booking, its calendar placeholder, and the
 * timeline note are written by a single atomic RPC, so a mid-path failure can
 * never leave partial rows.
 */
export async function confirmPendingTravelBooking(opts: {
  accountId: string;
  contactId: string;
  conversationId: string;
  userId: string;
}): Promise<TravelBookingConfirmResult> {
  const db = getAdminClient();

  const claim = await db.rpc('claim_travel_pending_booking', {
    p_account_id: opts.accountId,
    p_contact_id: opts.contactId,
  });
  if (claim.error) {
    return { status: 'failed', error: claim.error.message };
  }
  const claimData = asRecord(claim.data);
  if (claimData.status !== 'claimed') {
    // Lost the race against a concurrent confirm — it already booked.
    return { status: 'no_pending' };
  }
  const draft = parsePending(claimData.pending);
  if (!draft) return { status: 'no_pending' };

  const detail = await resolveDraftPackageDetail(opts.accountId, draft);
  if (!detail) return { status: 'missing_package' };

  const today = todayIso();
  if (!isPackageCurrentlyActive(detail, today)) {
    return {
      status: 'unavailable',
      reason: 'package_inactive',
      packageName: detail.name,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.travel_date) || draft.travel_date < today) {
    return {
      status: 'unavailable',
      reason: 'travel_date_past',
      packageName: detail.name,
    };
  }
  if (draft.guests_count < 1 || draft.guests_count > MAX_TRAVEL_GUESTS) {
    return {
      status: 'unavailable',
      reason: 'invalid_guests',
      packageName: detail.name,
    };
  }
  const departure =
    detail.departures.find(
      (row) => row.departure_date === draft.travel_date
    ) ?? null;
  if (departure && !isDepartureBookable(departure)) {
    return {
      status: 'unavailable',
      reason: 'departure_unavailable',
      packageName: detail.name,
    };
  }
  if (
    departure?.available_seats != null &&
    departure.available_seats < draft.guests_count
  ) {
    return {
      status: 'unavailable',
      reason: 'departure_unavailable',
      packageName: detail.name,
    };
  }

  const currency = draft.currency || detail.currency || 'INR';
  if (!isKnownCurrentPrice(detail, departure, Number(draft.total_price))) {
    const requirements = {
      destination: null,
      budget: null,
      durationDays: null,
      durationNights: null,
      adults: null,
      children: null,
      packageType: null,
      category: null,
      travelMonth: null,
      travelDate: draft.travel_date,
      itineraryDay: null,
      inclusionQuery: null,
      query: draft.package_name,
      packageIntent: false,
    };
    const current = resolvePackagePrice(detail, requirements);
    const newPrice = current.price ?? Number(draft.total_price);
    const newCurrency = current.currency || currency;
    const offer = buildBookingConfirmMessage({
      packageName: detail.name,
      destination: detail.destination,
      travelDate: draft.travel_date,
      guestsCount: draft.guests_count,
      totalPrice: newPrice,
      currency: newCurrency,
    });
    await storePendingTravelBooking(opts.accountId, opts.contactId, {
      ...draft,
      package_id: detail.id,
      package_name: detail.name,
      destination: detail.destination,
      total_price: newPrice,
      currency: newCurrency,
      offered_at: new Date().toISOString(),
    });
    await engineSendButtons({
      accountId: opts.accountId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      bodyText: `The price for ${detail.name} has been updated. ${offer.bodyText}`,
      buttons: offer.buttons,
    });
    return {
      status: 'price_changed',
      packageName: detail.name,
      newPrice,
      currency: newCurrency,
    };
  }

  const created = await db.rpc('create_travel_booking', {
    p_account_id: opts.accountId,
    p_tour_package_id: detail.id,
    p_contact_id: opts.contactId,
    p_travel_date: draft.travel_date,
    p_guests_count: draft.guests_count,
    p_total_price: Number(draft.total_price),
    p_currency: currency,
    p_package_name: detail.name,
  });
  if (created.error) {
    return { status: 'failed', error: created.error.message };
  }
  const createdData = asRecord(created.data);
  if (createdData.status !== 'created') {
    const reason = String(createdData.reason || '');
    if (reason === 'package_not_found') return { status: 'missing_package' };
    return {
      status: 'unavailable',
      reason:
        reason === 'package_inactive' ||
        reason === 'travel_date_past' ||
        reason === 'departure_unavailable' ||
        reason === 'invalid_guests'
          ? reason
          : 'package_inactive',
      packageName: detail.name,
    };
  }

  try {
    await engineSendText({
      accountId: opts.accountId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      text: `Your Travel Booking is confirmed. Package: ${detail.name}. Travel date: ${draft.travel_date}. Guests: ${draft.guests_count}. Our team will share the next steps shortly.`,
    });
  } catch (error) {
    console.warn(
      '[travel-booking] confirmation text failed',
      error instanceof Error ? error.message : error
    );
  }

  return {
    status: 'confirmed',
    bookingId: String(createdData.booking_id),
    packageName: detail.name,
  };
}

export async function sendTravelBookingConfirmTemplate(opts: {
  accountId: string;
  userId: string;
  contactId: string;
  conversationId: string;
  packageName?: string;
  travelDate?: string;
  guestsCount?: number;
  totalPrice?: number;
  messageText?: string;
}): Promise<TravelBookingConfirmOffer> {
  const offer = await prepareTravelBookingConfirmOffer(opts);
  await engineSendButtons({
    accountId: opts.accountId,
    userId: opts.userId,
    conversationId: opts.conversationId,
    contactId: opts.contactId,
    bodyText: offer.bodyText,
    buttons: offer.buttons,
  });
  return offer;
}

const UNAVAILABLE_REASONS: Record<
  'package_inactive' | 'travel_date_past' | 'departure_unavailable' | 'invalid_guests',
  string
> = {
  package_inactive: 'This package is no longer available.',
  travel_date_past:
    'That travel date has already passed — please share a new travel date.',
  departure_unavailable:
    'That departure is full or closed. Please ask about another date.',
  invalid_guests: 'Please tell me how many guests will be travelling.',
};

export async function handleTravelBookingInbound(opts: {
  accountId: string;
  userId: string;
  contactId: string;
  conversationId: string;
  interactiveReplyId?: string | null;
  inboundText?: string | null;
}): Promise<boolean> {
  const pending = await readPendingTravelBooking(
    opts.accountId,
    opts.contactId
  );
  const action = classifyTravelBookingReply({
    replyId: opts.interactiveReplyId,
    text: opts.inboundText,
    pending,
  });
  if (!action) return false;

  const send = (text: string) =>
    engineSendText({
      accountId: opts.accountId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      text,
    });

  if (action === 'later') {
    await send(
      'No problem. Reply Booking confirm when you are ready and I will send the Confirm Booking button again.'
    );
    return true;
  }

  if (action === 'stale_confirm') {
    await send(
      'This Confirm Booking button has expired, so I did not book anything. Tell me the package name and I will send a fresh confirmation.'
    );
    return true;
  }

  const result = await confirmPendingTravelBooking(opts);
  if (result.status === 'no_pending') {
    // A concurrent confirm won the claim; its reply already went out.
    return true;
  }
  if (result.status === 'price_changed') {
    // The re-offer with the updated price was already sent.
    return true;
  }
  if (result.status === 'missing_package') {
    await send(
      'Which Tour Package should I confirm? Reply with the package name or destination and I will send the Confirm Booking button again.'
    );
    return true;
  }
  if (result.status === 'unavailable') {
    await send(
      `${UNAVAILABLE_REASONS[result.reason]} I could not complete the booking for ${result.packageName}.`
    );
    return true;
  }
  if (result.status === 'failed') {
    await send(
      'I could not complete the Travel Booking just now. Our team will confirm it shortly.'
    );
    return true;
  }
  return true;
}
