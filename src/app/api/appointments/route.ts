import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { runAutomationsForTrigger } from '@/lib/automations/engine';
import { scheduleAppointmentReminders } from '@/lib/automations/appointment-triggers';
import { getBookingIndustry } from '@/lib/booking-form/config';
import { formatTravelPrice } from '@/lib/travel/booking-confirm';
import {
  insertTravelBookingRow,
  parseTravelBookingNotes,
  resolveTravelBookingPackageId,
} from '@/lib/travel/staff-booking';
import { safeRecordOutcomeEvent } from '@/lib/metrics/safe-record';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const date = request.nextUrl.searchParams.get('date');
    const doctorId = request.nextUrl.searchParams.get('doctorId');
    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('appointments')
      .select(
        'id, booking_id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, created_at, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization, department)'
      )
      .eq('account_id', context.accountId)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (date) query = query.eq('appointment_date', date);
    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    const rows = (data || []).map((row) => {
      const travel = parseTravelBookingNotes(
        (row as { notes?: string | null }).notes
      );
      return {
        ...row,
        travel_package_name: travel.packageName,
        travel_destination:
          travel.destination ||
          ((row as { department?: string | null }).department !== 'Travel'
            ? (row as { department?: string | null }).department
            : null),
        travel_guests_count: travel.guestsCount,
        travel_total_price_label: travel.totalPriceLabel,
      };
    });

    return NextResponse.json({ data: rows }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      patient_id,
      doctor_id,
      appointment_date,
      appointment_time,
      department,
      status,
      notes,
      package_id,
      package_name,
      destination,
      travel_date,
      guests_count,
      total_price,
    } = body;

    const { data: accountRow } = await supabase
      .from('accounts')
      .select('industry')
      .eq('id', context.accountId)
      .maybeSingle();
    const industry = getBookingIndustry(accountRow?.industry);
    const isTravel = industry === 'travel';
    const bookingDate = String(appointment_date || travel_date || '').trim();
    const bookingTime = String(
      appointment_time || (isTravel ? '10:00' : '')
    ).trim();

    if (!patient_id || !bookingDate || !bookingTime) {
      return NextResponse.json(
        {
          error: isTravel
            ? 'Traveller, travel date, and a booking time are required'
            : 'Patient, Date, and Time are required',
        },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const travelNotes =
      isTravel && !notes
        ? [
            `Travel Booking | Package: ${String(package_name || 'Custom trip').trim()}`,
            destination ? `Destination: ${String(destination).trim()}` : '',
            `Guests: ${Math.max(1, Number(guests_count) || 1)}`,
            `Total: ${formatTravelPrice(Number(total_price) || 0, 'INR')}`,
          ]
            .filter(Boolean)
            .join(' | ')
        : notes;

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        account_id: context.accountId,
        patient_id,
        doctor_id: doctor_id || null,
        appointment_date: bookingDate,
        appointment_time: bookingTime,
        department:
          department ||
          (isTravel ? String(destination || 'Travel').trim() : null),
        status: status || 'pending',
        notes: travelNotes || null,
      })
      .select(
        'id, patient_id, booking_id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, created_at, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization, department)'
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    if (isTravel && data?.patient_id) {
      try {
        const packageName = String(package_name || 'Custom trip').trim();
        const dest = String(destination || '').trim();
        const guestsCount = Math.max(1, Number(guests_count) || 1);
        const totalPrice = Number(total_price) || 0;
        const tourPackageId = await resolveTravelBookingPackageId({
          accountId: context.accountId,
          packageId: package_id ? String(package_id) : null,
          packageName,
          destination: dest,
          totalPrice,
        });
        if (tourPackageId) {
          await insertTravelBookingRow({
            accountId: context.accountId,
            contactId: data.patient_id,
            packageId: tourPackageId,
            travelDate: bookingDate,
            guestsCount,
            totalPrice,
            status: 'Pending',
          });
        }
      } catch (travelError) {
        console.warn(
          '[POST /api/appointments] travel_bookings insert failed',
          travelError instanceof Error ? travelError.message : travelError
        );
      }
    }

    const recordedStatus = String(data?.status || 'pending').toLowerCase();
    if (data?.id && recordedStatus === 'confirmed') {
      safeRecordOutcomeEvent({
        accountId: context.accountId,
        eventName: 'booking_confirmed',
        sourceId: `booking:${context.accountId}:${data.id}`,
        subjectHash: data.patient_id ? String(data.patient_id) : null,
        attributes: {
          channel: 'staff',
          is_whatsapp: false,
        },
      });
    }

    if (data?.patient_id) {
      // Confirmation automations run immediately after the appointment exists.
      // These are fire-and-forget so a notification failure never rolls back
      // an otherwise successful appointment booking.
      void runAutomationsForTrigger({
        accountId: context.accountId,
        triggerType: 'appointment_created',
        contactId: data.patient_id,
        context: {
          conversation_id: undefined,
          vars: {
            appointment_id: data.id,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            booking_id: data.booking_id,
          },
        },
      });

      // Appointment reminders are scheduled against the actual appointment
      // time, not against the booking/message time.
      void scheduleAppointmentReminders({
        accountId: context.accountId,
        userId: context.userId,
        contactId: data.patient_id,
        appointmentId: data.id,
        appointmentDate: data.appointment_date,
        appointmentTime: data.appointment_time,
      });
    }

    return NextResponse.json(
      { data },
      { status: 201, headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
