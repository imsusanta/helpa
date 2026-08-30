import { getAdminClient } from '@/lib/db/server';
import { engineSendButtons, engineSendText } from '@/lib/automations/meta-send';
import { matchTourPackagesForMessage } from '@/lib/travel/retrieval';
import type { TourPackage } from '@/lib/travel/types';

export const TRAVEL_BOOKING_CONFIRM_BUTTON_ID = 'travel_booking_confirm';
export const TRAVEL_BOOKING_LATER_BUTTON_ID = 'travel_booking_later';
export const TRAVEL_PENDING_BOOKING_KEY = 'travel_pending_booking';
export const TRAVEL_LAST_PACKAGE_KEY = 'travel_last_package';

const PENDING_TTL_MS = 48 * 60 * 60 * 1000;

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
  totalPriceLabel: string;
  bodyText: string;
  buttons: { id: string; title: string }[];
}

export function classifyTravelBookingReply(opts: {
  replyId?: string | null;
  text?: string | null;
  hasFreshPending?: boolean;
}): 'confirm' | 'later' | null {
  if (opts.replyId === TRAVEL_BOOKING_CONFIRM_BUTTON_ID) return 'confirm';
  if (opts.replyId === TRAVEL_BOOKING_LATER_BUTTON_ID) return 'later';
  if (!opts.hasFreshPending) return null;
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
  if (['2', 'not yet', 'later', 'no'].includes(cleaned)) return 'later';
  return null;
}

export function isFreshPending(
  pending: TravelPendingBooking | null,
  nowMs = Date.now()
): boolean {
  if (!pending?.offered_at) return false;
  const offered = Date.parse(pending.offered_at);
  if (!Number.isFinite(offered)) return false;
  return nowMs - offered <= PENDING_TTL_MS;
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

export function buildBookingConfirmMessage(
  offer: Omit<TravelBookingConfirmOffer, 'bodyText' | 'buttons'>
): TravelBookingConfirmOffer {
  const totalPriceLabel = formatTravelPrice(offer.totalPrice, 'INR');
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
    guests_count: Math.max(1, Number(row.guests_count) || 1),
    total_price: Number(row.total_price) || 0,
    currency: String(row.currency || 'INR'),
    conversation_id: row.conversation_id ? String(row.conversation_id) : null,
    offered_at: String(row.offered_at || ''),
  };
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
  const guestsCount = Math.max(1, Number(opts.guestsCount) || 1);
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
    totalPriceLabel: formatTravelPrice(totalPrice, resolved.currency),
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

async function ensureLegacyTravelPackage(opts: {
  accountId: string;
  packageId: string | null;
  packageName: string;
  destination: string;
  totalPrice: number;
}): Promise<string | null> {
  const db = getAdminClient();
  if (opts.packageId) {
    const { data: tour } = await db
      .from('tour_packages')
      .select(
        'id, name, destination, duration_days, starting_price, description'
      )
      .eq('id', opts.packageId)
      .eq('account_id', opts.accountId)
      .maybeSingle();
    if (tour) {
      const { data: existing } = await db
        .from('travel_packages')
        .select('id')
        .eq('account_id', opts.accountId)
        .eq('name', String(tour.name))
        .maybeSingle();
      if (existing?.id) return String(existing.id);
      const { data: created } = await db
        .from('travel_packages')
        .insert({
          account_id: opts.accountId,
          name: String(tour.name),
          destination: String(tour.destination || opts.destination || 'TBD'),
          duration_days: Number(tour.duration_days) || 1,
          price: Number(tour.starting_price) || opts.totalPrice || 0,
          description: tour.description ? String(tour.description) : null,
        })
        .select('id')
        .single();
      return created?.id ? String(created.id) : null;
    }
  }

  const { data: byName } = await db
    .from('travel_packages')
    .select('id')
    .eq('account_id', opts.accountId)
    .eq('name', opts.packageName)
    .maybeSingle();
  if (byName?.id) return String(byName.id);

  if (!opts.packageName || opts.packageName === 'the package we discussed') {
    return null;
  }

  const { data: created } = await db
    .from('travel_packages')
    .insert({
      account_id: opts.accountId,
      name: opts.packageName,
      destination: opts.destination || 'TBD',
      duration_days: 1,
      price: opts.totalPrice || 0,
    })
    .select('id')
    .single();
  return created?.id ? String(created.id) : null;
}

export async function confirmPendingTravelBooking(opts: {
  accountId: string;
  contactId: string;
  conversationId: string;
  userId: string;
}): Promise<
  | { status: 'confirmed'; bookingId: string; packageName: string }
  | { status: 'missing_package' }
  | { status: 'failed'; error: string }
> {
  const pending = await readPendingTravelBooking(
    opts.accountId,
    opts.contactId
  );
  const metadata = await loadContactMetadata(opts.accountId, opts.contactId);
  const last = parseDiscussed(metadata[TRAVEL_LAST_PACKAGE_KEY]);
  const draft: TravelPendingBooking = pending ?? {
    package_id: last?.package_id || null,
    package_name: last?.package_name || 'the package we discussed',
    destination: last?.destination || '',
    travel_date: defaultTravelDate(),
    guests_count: 1,
    total_price: last?.starting_price ?? 0,
    currency: last?.currency || 'INR',
    conversation_id: opts.conversationId,
    offered_at: new Date().toISOString(),
  };

  const legacyPackageId = await ensureLegacyTravelPackage({
    accountId: opts.accountId,
    packageId: draft.package_id,
    packageName: draft.package_name,
    destination: draft.destination,
    totalPrice: draft.total_price,
  });

  if (!legacyPackageId) {
    return { status: 'missing_package' };
  }

  const db = getAdminClient();
  const { data: booking, error } = await db
    .from('travel_bookings')
    .insert({
      account_id: opts.accountId,
      package_id: legacyPackageId,
      contact_id: opts.contactId,
      travel_date: draft.travel_date,
      guests_count: draft.guests_count,
      total_price: draft.total_price,
      status: 'Confirmed',
    })
    .select('id')
    .single();

  if (error || !booking) {
    return {
      status: 'failed',
      error: error?.message || 'Could not create travel booking',
    };
  }

  await db.from('appointments').insert({
    account_id: opts.accountId,
    patient_id: opts.contactId,
    appointment_date: draft.travel_date,
    appointment_time: '10:00',
    department: 'Travel',
    status: 'Confirmed',
    notes: `Travel Booking | Package: ${draft.package_name} | Guests: ${draft.guests_count} | Total: ${formatTravelPrice(draft.total_price, draft.currency)}`,
  });

  await db.from('contact_notes').insert({
    account_id: opts.accountId,
    contact_id: opts.contactId,
    note_text: `[Timeline] Travel Booking confirmed via WhatsApp for ${draft.package_name} on ${draft.travel_date} (${draft.guests_count} guests).`,
  });

  await clearPendingTravelBooking(opts.accountId, opts.contactId);

  await engineSendText({
    accountId: opts.accountId,
    userId: opts.userId,
    conversationId: opts.conversationId,
    contactId: opts.contactId,
    text: `Your Travel Booking is confirmed. Package: ${draft.package_name}. Travel date: ${draft.travel_date}. Guests: ${draft.guests_count}. Our team will share the next steps shortly.`,
  });

  return {
    status: 'confirmed',
    bookingId: String(booking.id),
    packageName: draft.package_name,
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
    hasFreshPending: isFreshPending(pending),
  });
  if (!action) return false;

  if (action === 'later') {
    await engineSendText({
      accountId: opts.accountId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      text: 'No problem. Reply Booking confirm when you are ready and I will send the Confirm Booking button again.',
    });
    return true;
  }

  const result = await confirmPendingTravelBooking(opts);
  if (result.status === 'missing_package') {
    await engineSendText({
      accountId: opts.accountId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      text: 'Which Tour Package should I confirm? Reply with the package name or destination and I will send the Confirm Booking button again.',
    });
    return true;
  }
  if (result.status === 'failed') {
    await engineSendText({
      accountId: opts.accountId,
      userId: opts.userId,
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      text: 'I could not complete the Travel Booking just now. Our team will confirm it shortly.',
    });
    return true;
  }
  return true;
}
