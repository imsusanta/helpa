import { getAdminClient } from '@/lib/db/server';
import { formatTravelPrice } from '@/lib/travel/booking-confirm';

export interface StaffTravelBookingInput {
  accountId: string;
  contactId: string;
  packageId?: string | null;
  packageName: string;
  destination: string;
  travelDate: string;
  guestsCount: number;
  totalPrice: number;
  currency?: string;
  notes?: string | null;
  appointmentStatus?: string;
}

export interface StaffTravelBookingResult {
  travelBookingId: string;
  appointmentId: string | null;
  packageName: string;
  notes: string;
}

/**
 * Persists a staff-created Travel Booking the same way WhatsApp confirm does:
 * travel_bookings row + appointments row so it appears on /booking-trip.
 */
export async function createStaffTravelBooking(
  input: StaffTravelBookingInput
): Promise<StaffTravelBookingResult> {
  const db = getAdminClient();
  const packageName = input.packageName.trim() || 'Custom trip';
  const destination = input.destination.trim();
  const guestsCount = Math.max(1, Number(input.guestsCount) || 1);
  const totalPrice = Number(input.totalPrice) || 0;
  const currency = input.currency || 'INR';
  const extraNotes = input.notes?.trim() || '';
  const notes = [
    `Travel Booking | Package: ${packageName}`,
    destination ? `Destination: ${destination}` : '',
    `Guests: ${guestsCount}`,
    `Total: ${formatTravelPrice(totalPrice, currency)}`,
    extraNotes,
  ]
    .filter(Boolean)
    .join(' | ');

  const tourPackageId = await resolveTravelBookingPackageId({
    accountId: input.accountId,
    packageId: input.packageId,
    packageName,
    destination,
    totalPrice,
  });
  if (!tourPackageId) {
    throw new Error('Could not save a tour package for this booking');
  }

  const booking = await insertTravelBookingRow({
    accountId: input.accountId,
    contactId: input.contactId,
    packageId: tourPackageId,
    travelDate: input.travelDate,
    guestsCount,
    totalPrice,
    status: 'Pending',
  });

  const { data: appointment, error: appointmentError } = await db
    .from('appointments')
    .insert({
      account_id: input.accountId,
      patient_id: input.contactId,
      appointment_date: input.travelDate,
      appointment_time: '10:00',
      department: destination || 'Travel',
      status: input.appointmentStatus || 'pending',
      notes,
    })
    .select('id')
    .single();

  if (appointmentError) {
    console.warn(
      '[travel-staff-booking] appointment mirror failed',
      appointmentError.message
    );
  }

  return {
    travelBookingId: String(booking.id),
    appointmentId: appointment?.id ? String(appointment.id) : null,
    packageName,
    notes,
  };
}

/**
 * Resolve the canonical tour-package id for a staff-created booking.
 *
 * Since migration 20260901100000, `tour_packages` is the single package
 * table and `travel_bookings.tour_package_id` references it directly; the
 * `travel_packages` mirror is gone.
 */
export async function resolveTravelBookingPackageId(opts: {
  accountId: string;
  packageId?: string | null;
  packageName: string;
  destination: string;
  totalPrice: number;
}): Promise<string | null> {
  const db = getAdminClient();

  if (opts.packageId) {
    const { data: tour } = await db
      .from('tour_packages')
      .select('id')
      .eq('id', opts.packageId)
      .eq('account_id', opts.accountId)
      .maybeSingle();
    if (tour?.id) return String(tour.id);
  }

  if (opts.packageName.trim()) {
    const { data: byName } = await db
      .from('tour_packages')
      .select('id')
      .eq('account_id', opts.accountId)
      .ilike('name', opts.packageName)
      .limit(1)
      .maybeSingle();
    if (byName?.id) return String(byName.id);
  }

  return null;
}

export async function insertTravelBookingRow(opts: {
  accountId: string;
  contactId: string;
  packageId: string;
  travelDate: string;
  guestsCount: number;
  totalPrice: number;
  status?: string;
}): Promise<{ id: string }> {
  const db = getAdminClient();
  const { data: booking, error } = await db
    .from('travel_bookings')
    .insert({
      account_id: opts.accountId,
      tour_package_id: opts.packageId,
      contact_id: opts.contactId,
      travel_date: opts.travelDate,
      guests_count: opts.guestsCount,
      total_price: opts.totalPrice,
      status: opts.status || 'Pending',
    })
    .select('id')
    .single();
  if (error || !booking) {
    throw new Error(error?.message || 'Could not create travel booking');
  }
  return { id: String(booking.id) };
}

export function parseTravelBookingNotes(notes?: string | null): {
  packageName: string | null;
  destination: string | null;
  guestsCount: number | null;
  totalPriceLabel: string | null;
} {
  const text = notes || '';
  const packageName = text.match(/Package:\s*([^|]+)/i)?.[1]?.trim() || null;
  const destination =
    text.match(/Destination:\s*([^|]+)/i)?.[1]?.trim() || null;
  const guestsRaw = text.match(/Guests:\s*(\d+)/i)?.[1];
  const totalPriceLabel = text.match(/Total:\s*([^|]+)/i)?.[1]?.trim() || null;
  return {
    packageName,
    destination,
    guestsCount: guestsRaw ? Number(guestsRaw) : null,
    totalPriceLabel,
  };
}
