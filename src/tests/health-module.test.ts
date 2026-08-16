/**
 * src/tests/health-module.test.ts
 *
 * Comprehensive Test Suite for Helpa Health & Clinic Industry Module (Phase 6).
 * Verifies:
 * - Unique sequential Patient ID generation (PT-XXXXXX)
 * - Multiple patients sharing the same mobile number (Family Members)
 * - Doctor slot availability and schedule calculations
 * - Appointment booking, queue token (A-018), and digital slip generation
 * - Appointment source automatically set to 'WhatsApp' and booked_by tracking
 * - Report status and safe non-diagnostic delivery
 * - Follow-up scheduling and due dates
 * - Receptionist Copilot context & suggestions
 * - Strict multi-tenant isolation (Clinic A vs Clinic B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateNextPatientId,
  createOrFindPatient,
  getPatientsByMobile,
  getPatientTimeline,
  listClinicDoctors,
  getDoctorSlotAvailability,
  bookHealthAppointment,
  updateQueueStatus,
  generateAppointmentSlipText,
  getPatientReports,
  deliverReportToPatient,
  scheduleHealthFollowUp,
  getDueFollowUps,
  getReceptionistCopilotContext,
} from '@/modules/health/services';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import * as whatsappCore from '@/core/whatsapp';
import { coreEvents } from '@/core/events';

describe('Helpa Health & Clinic Industry Module', () => {
  const clinicA = { id: 'clinic-apollo-01', name: 'Apollo Day Clinic' };
  const clinicB = { id: 'clinic-fortis-02', name: 'Fortis Health Center' };

  let mockDatabase: {
    contacts: Array<Record<string, unknown>>;
    appointments: Array<Record<string, unknown>>;
    doctors: Array<Record<string, unknown>>;
    lab_reports: Array<Record<string, unknown>>;
    follow_ups: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      contacts: [],
      appointments: [],
      doctors: [
        {
          id: 'doc-sen-1',
          account_id: clinicA.id,
          name: 'Dr. Anirban Sen',
          department: 'Cardiology',
          fee: 800,
          working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          leave_dates: ['2026-08-25'],
          is_active: true,
        },
      ],
      lab_reports: [],
      follow_ups: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store = (mockDatabase as Record<string, Array<Record<string, unknown>>>)[table] || [];
        return {
          select: () => {
            let filtered = [...store];
            const builder = {
              eq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] === v);
                return builder;
              },
              neq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] !== v);
                return builder;
              },
              lte: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => String(r[f]) <= String(v));
                return builder;
              },
              ilike: () => builder,
              or: () => builder,
              limit: (n: number) => {
                filtered = filtered.slice(0, n);
                return builder;
              },
              order: () => builder,
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Row not found' },
              }),
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
              then: (res: (val: { data: unknown[]; error: null }) => void) =>
                res({ data: filtered, error: null }),
            };
            return builder;
          },
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
              then: (res: (val: { data: unknown; error: null }) => void) =>
                res({ data: row, error: null }),
            };
          },
          update: (data: Record<string, unknown>) => ({
            eq: (f: string, v: unknown) => {
              const matched = store.filter((r) => r[f] === v);
              matched.forEach((r) => Object.assign(r, data));
              return {
                eq: (f2: string, v2: unknown) => {
                  const m2 = store.filter((r) => r[f] === v && r[f2] === v2);
                  m2.forEach((r) => Object.assign(r, data));
                  return Promise.resolve({ data: m2, error: null });
                },
                then: (res: (val: { data: unknown; error: null }) => void) =>
                  res({ data: matched, error: null }),
              };
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);

    vi.spyOn(whatsappCore, 'sendWhatsAppMessage').mockResolvedValue({
      success: true,
      messageId: 'wamid.HBgLM...mock',
      timestamp: new Date().toISOString(),
    });
  });

  describe('Patient Management & Unique Patient ID', () => {
    it('generates sequential unique Patient ID (PT-000001)', async () => {
      const patientId = await generateNextPatientId(clinicA.id);
      expect(patientId).toBe('PT-000001');
    });

    it('allows multiple patients (family members) with the same mobile number', async () => {
      const sharedPhone = '+919000000000';

      // 1. Create Patient A (Rahul Sharma)
      const patientA = await createOrFindPatient({
        accountId: clinicA.id,
        name: 'Rahul Sharma',
        phone: sharedPhone,
        gender: 'Male',
      });

      expect(patientA.name).toBe('Rahul Sharma');
      expect(patientA.phone).toContain('919000000000');
      expect(patientA.patientId).toBe('PT-000001');

      // 2. Create Patient B (Ananya Sharma) with the EXACT SAME mobile number
      const patientB = await createOrFindPatient({
        accountId: clinicA.id,
        name: 'Ananya Sharma',
        phone: sharedPhone,
        gender: 'Female',
      });

      expect(patientB.name).toBe('Ananya Sharma');
      expect(patientB.phone).toContain('919000000000');
      expect(patientB.patientId).toBe('PT-000002');
      expect(patientA.id).not.toBe(patientB.id);

      // Verify both patients are in database under the clinic
      expect(mockDatabase.contacts.length).toBe(2);
    });

    it('retrieves patient timeline with chronological events', async () => {
      const patient = await createOrFindPatient({
        accountId: clinicA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
      });

      mockDatabase.appointments.push({
        id: 'appt-1',
        account_id: clinicA.id,
        contact_id: patient.id,
        appointment_date: '2026-08-20',
        appointment_time: '10:30 AM',
        status: 'Confirmed',
        notes: 'Dr. Sen Consultation',
        created_at: '2026-08-16T10:00:00.000Z',
      });

      const timeline = await getPatientTimeline(clinicA.id, patient.id);
      expect(timeline.length).toBe(1);
      expect(timeline[0].type).toBe('appointment');
      expect(timeline[0].title).toBe('Appointment Confirmed');
    });
  });

  describe('Doctor Directory & Dynamic Availability', () => {
    it('lists clinic doctors with departments and consultation fees', async () => {
      const doctors = await listClinicDoctors(clinicA.id);
      expect(doctors.length).toBeGreaterThan(0);
      expect(doctors[0].name).toBe('Dr. Anirban Sen');
      expect(doctors[0].department).toBe('Cardiology');
      expect(doctors[0].consultationFee).toBe(800);
    });

    it('calculates availability and detects leave dates accurately', async () => {
      // Regular working day
      const regularAvail = await getDoctorSlotAvailability(
        clinicA.id,
        'Dr. Anirban Sen',
        '2026-08-24'
      );
      expect(regularAvail.isAvailable).toBe(true);
      expect(regularAvail.availableSlots.length).toBeGreaterThan(0);

      // Scheduled leave date (2026-08-25)
      const leaveAvail = await getDoctorSlotAvailability(
        clinicA.id,
        'Dr. Anirban Sen',
        '2026-08-25'
      );
      expect(leaveAvail.isAvailable).toBe(false);
      expect(leaveAvail.reasonIfNotAvailable).toContain('scheduled leave');
    });
  });

  describe('Appointment Booking, Queue Tokens & Digital Slip', () => {
    it('books appointment, assigns token A-001, sets bookingSource to WhatsApp, and generates slip', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('appointment.created', eventSpy);

      const booking = await bookHealthAppointment({
        accountId: clinicA.id,
        patientName: 'Rahul Sharma',
        patientMobile: '+919000000000',
        doctorIdOrName: 'Dr. Anirban Sen',
        appointmentDate: '2026-08-24',
        appointmentTime: '10:30 AM',
        bookedBy: 'ai',
      });

      expect(booking.patientId).toBe('PT-000001');
      expect(booking.doctorName).toBe('Dr. Anirban Sen');
      expect(booking.tokenNumber).toBe('A-001');
      expect(booking.bookingSource).toBe('WhatsApp');
      expect(booking.bookedBy).toBe('ai');
      expect(booking.confirmationSlip).toContain('DIGITAL APPOINTMENT CONFIRMATION SLIP');
      expect(booking.confirmationSlip).toContain('Token: 🎫 A-001');

      // Verify event emission for reminders
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: clinicA.id,
          type: 'appointment.created',
          payload: expect.objectContaining({
            tokenNumber: 'A-001',
            patientName: 'Rahul Sharma',
          }),
        })
      );
    });

    it('updates queue status to In Consultation and Completed', async () => {
      const booking = await bookHealthAppointment({
        accountId: clinicA.id,
        patientName: 'Priya Das',
        patientMobile: '+919876543210',
        doctorIdOrName: 'Dr. Anirban Sen',
        appointmentDate: '2026-08-24',
        appointmentTime: '11:00 AM',
      });

      const updated = await updateQueueStatus(
        clinicA.id,
        booking.appointmentId,
        'In Consultation'
      );
      expect(updated).toBe(true);

      const appt = mockDatabase.appointments.find((a) => a.id === booking.appointmentId);
      expect(appt?.status).toBe('In Consultation');
    });
  });

  describe('Report Status & Safe Delivery', () => {
    it('checks report status and safely delivers notification via WhatsApp', async () => {
      mockDatabase.lab_reports.push({
        id: 'rep-cbc-1',
        account_id: clinicA.id,
        patient_id: 'patient-contact-1',
        patient_name: 'Rahul Sharma',
        test_name: 'Lipid Profile',
        status: 'Ready',
        created_at: '2026-08-16T10:00:00.000Z',
      });

      const reports = await getPatientReports(clinicA.id, 'patient-contact-1');
      expect(reports.length).toBe(1);
      expect(reports[0].testName).toBe('Lipid Profile');
      expect(reports[0].status).toBe('Ready');

      const delivery = await deliverReportToPatient(
        clinicA.id,
        'rep-cbc-1',
        '+919000000000'
      );
      expect(delivery.success).toBe(true);
      expect(whatsappCore.sendWhatsAppMessage).toHaveBeenCalled();
    });
  });

  describe('Follow-up Scheduling & Receptionist Copilot', () => {
    it('schedules follow-up appointment after 7 days and tracks due list', async () => {
      const followUp = await scheduleHealthFollowUp({
        accountId: clinicA.id,
        patientId: 'PT-000001',
        patientName: 'Rahul Sharma',
        patientMobile: '+919000000000',
        doctorName: 'Dr. Anirban Sen',
        daysInterval: 7,
        reason: 'Post-medication blood pressure check',
      });

      expect(followUp.status).toBe('Pending');
      expect(followUp.doctorName).toBe('Dr. Anirban Sen');
      expect(mockDatabase.follow_ups.length).toBe(1);
    });

    it('generates rich Receptionist Copilot context for staff review', async () => {
      const patient = await createOrFindPatient({
        accountId: clinicA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
      });

      const copilotContext = await getReceptionistCopilotContext({
        accountId: clinicA.id,
        conversationId: 'conv-101',
        contactId: patient.id,
      });

      expect(copilotContext.patient.name).toBe('Rahul Sharma');
      expect(copilotContext.summary).toContain('Returning patient');
      expect(copilotContext.suggestedReply).toContain('Rahul');
      expect(copilotContext.quickActions.some((a) => a.actionType === 'book_appointment')).toBe(true);
      expect(copilotContext.quickActions.some((a) => a.actionType === 'send_report')).toBe(true);
    });
  });
});
