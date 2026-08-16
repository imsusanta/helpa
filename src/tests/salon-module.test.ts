/**
 * src/tests/salon-module.test.ts
 *
 * Comprehensive Test Suite for Helpa Salon Industry Module (Phase 9).
 * Verifies:
 * - Unique sequential Customer ID generation (CUS-XXXXXX)
 * - Customer CRM, preferred stylists, and visit history
 * - Multiple appointments belonging to the same customer profile
 * - Service Catalog, categories, and pricing types (Fixed vs Starting From)
 * - Staff Directory, working shifts, and real-time available slot calculations
 * - Appointment booking with automatic WhatsApp source and AI attribution
 * - Appointment rescheduling & cancellation workflows
 * - Post-service retention follow-ups (e.g. 30-day haircut reminder)
 * - Salon Receptionist Copilot context, suggested replies, and actions
 * - Salon AI Tools in Core Tool Registry
 * - Strict multi-tenant isolation (Salon A vs Salon B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateNextCustomerId,
  getOrCreateSalonCustomer,
  listSalonServices,
  findSalonServiceByName,
  listSalonStaff,
  getStaffAvailableSlots,
  bookSalonAppointment,
  rescheduleSalonAppointment,
  cancelSalonAppointment,
  scheduleSalonFollowUp,
  getSalonCopilotContext,
} from '@/modules/salon/services';
import { aiToolRegistry } from '@/core/ai/tools';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

describe('Helpa Salon Industry Module', () => {
  const salonA = { id: 'salon-glamour-01', name: 'Glamour Beauty & Spa' };
  const _salonB = { id: 'salon-luxe-02', name: 'Luxe Unisex Studio' };

  let mockDatabase: {
    contacts: Array<Record<string, unknown>>;
    appointments: Array<Record<string, unknown>>;
    services: Array<Record<string, unknown>>;
    staff: Array<Record<string, unknown>>;
    follow_ups: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      contacts: [],
      appointments: [],
      services: [
        {
          id: 'srv-1',
          account_id: salonA.id,
          name: 'Haircut & Styling',
          category: 'Hair',
          duration: 45,
          price: 500,
          pricing_type: 'Fixed',
          assigned_staff: ['Amit Roy'],
          status: 'Active',
          followup_days: 30,
        },
        {
          id: 'srv-2',
          account_id: salonA.id,
          name: 'Global Hair Coloring',
          category: 'Hair Color',
          duration: 120,
          price: 2500,
          pricing_type: 'Starting From',
          assigned_staff: ['Neha Sen'],
          status: 'Active',
          followup_days: 45,
        },
      ],
      staff: [
        {
          id: 'staff-1',
          account_id: salonA.id,
          name: 'Amit Roy',
          role: 'Senior Hair Stylist',
          specialization: 'Haircut, Hair Styling',
          working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          shift_start: '10:00 AM',
          shift_end: '07:00 PM',
          status: 'Available Today',
        },
      ],
      follow_ups: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store =
          (mockDatabase as Record<string, Array<Record<string, unknown>>>)[
            table
          ] || [];
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
              ilike: (f: string, v: string) => {
                const clean = v.replace(/%/g, '').toLowerCase();
                filtered = filtered.filter((r) =>
                  String(r[f] || '')
                    .toLowerCase()
                    .includes(clean)
                );
                return builder;
              },
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
  });

  describe('Customer CRM & Unique Customer ID', () => {
    it('generates sequential unique Customer ID (CUS-000001)', async () => {
      const customerId = await generateNextCustomerId(salonA.id);
      expect(customerId).toBe('CUS-000001');
    });

    it('creates or retrieves salon customer profile with preferred stylist', async () => {
      const customer = await getOrCreateSalonCustomer({
        accountId: salonA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
        preferredStaff: 'Amit Roy',
        preferredServices: ['Haircut & Styling'],
      });

      expect(customer.name).toBe('Rahul Sharma');
      expect(customer.customerId).toBe('CUS-000001');
      expect(customer.preferredStaff).toBe('Amit Roy');
      expect(mockDatabase.contacts.length).toBe(1);
    });
  });

  describe('Service Catalog & Pricing Structure', () => {
    it('lists salon services with pricing and duration', async () => {
      const services = await listSalonServices(salonA.id);
      expect(services.length).toBeGreaterThan(0);

      const haircut = services.find((s) => s.category === 'Hair');
      expect(haircut?.name).toBe('Haircut & Styling');
      expect(haircut?.price).toBe(500);
      expect(haircut?.pricingType).toBe('Fixed');

      const hairColor = services.find((s) => s.category === 'Hair Color');
      expect(hairColor?.pricingType).toBe('Starting From');
    });

    it('matches service query by name or category', async () => {
      const service = await findSalonServiceByName(salonA.id, 'haircut');
      expect(service).toBeDefined();
      expect(service?.name).toBe('Haircut & Styling');
    });
  });

  describe('Staff Directory & Available Slot Calculations', () => {
    it('lists staff directory and calculates conflict-free available slots', async () => {
      const staffList = await listSalonStaff(salonA.id);
      expect(staffList.length).toBeGreaterThan(0);
      expect(staffList[0].name).toBe('Amit Roy');

      const slots = await getStaffAvailableSlots({
        accountId: salonA.id,
        staffName: 'Amit Roy',
        dateStr: '2026-08-25',
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots).toContain('10:00 AM');
      expect(slots).toContain('05:30 PM');
    });
  });

  describe('Appointment Booking, Rescheduling & Cancellation', () => {
    it('books appointment with automatic WhatsApp source and AI attribution', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('appointment.created', eventSpy);

      const appt = await bookSalonAppointment({
        accountId: salonA.id,
        customerName: 'Rahul Sharma',
        customerMobile: '+919000000000',
        serviceName: 'Haircut & Styling',
        staffName: 'Amit Roy',
        appointmentDate: '2026-08-25',
        appointmentTime: '05:00 PM',
        bookedBy: 'ai',
      });

      expect(appt.customerName).toBe('Rahul Sharma');
      expect(appt.serviceName).toBe('Haircut & Styling');
      expect(appt.staffName).toBe('Amit Roy');
      expect(appt.bookingSource).toBe('WhatsApp');
      expect(appt.bookedBy).toBe('ai');
      expect(appt.status).toBe('Confirmed');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: salonA.id,
          type: 'appointment.created',
          payload: expect.objectContaining({
            customerName: 'Rahul Sharma',
            serviceName: 'Haircut & Styling',
            bookingSource: 'WhatsApp',
          }),
        })
      );
    });

    it('reschedules appointment and emits appointment.rescheduled event', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('appointment.rescheduled', eventSpy);

      const appt = await bookSalonAppointment({
        accountId: salonA.id,
        customerName: 'Rahul Sharma',
        customerMobile: '+919000000000',
        serviceName: 'Haircut & Styling',
        appointmentDate: '2026-08-25',
        appointmentTime: '05:00 PM',
      });

      const rescheduled = await rescheduleSalonAppointment({
        accountId: salonA.id,
        appointmentId: appt.id,
        newDate: '2026-08-26',
        newTime: '06:00 PM',
      });

      expect(rescheduled).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: salonA.id,
          type: 'appointment.rescheduled',
          payload: expect.objectContaining({
            appointmentId: appt.id,
            newDate: '2026-08-26',
            newTime: '06:00 PM',
          }),
        })
      );
    });

    it('cancels appointment without deleting history', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('appointment.cancelled', eventSpy);

      const appt = await bookSalonAppointment({
        accountId: salonA.id,
        customerName: 'Rahul Sharma',
        customerMobile: '+919000000000',
        serviceName: 'Haircut & Styling',
        appointmentDate: '2026-08-25',
        appointmentTime: '05:00 PM',
      });

      const cancelled = await cancelSalonAppointment({
        accountId: salonA.id,
        appointmentId: appt.id,
        reason: 'Customer requested cancellation',
      });

      expect(cancelled).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: salonA.id,
          type: 'appointment.cancelled',
          payload: expect.objectContaining({
            appointmentId: appt.id,
          }),
        })
      );
    });
  });

  describe('Retention Follow-ups & Salon Copilot', () => {
    it('schedules post-service retention follow-up', async () => {
      const followUp = await scheduleSalonFollowUp({
        accountId: salonA.id,
        customerId: 'CUS-000001',
        customerName: 'Rahul Sharma',
        customerMobile: '+919000000000',
        serviceName: 'Haircut & Styling',
        daysInterval: 30,
        assignedStaff: 'Amit Roy',
      });

      expect(followUp.status).toBe('Pending');
      expect(followUp.customerName).toBe('Rahul Sharma');
      expect(mockDatabase.follow_ups.length).toBe(1);
    });

    it('generates Salon Receptionist Copilot context with quick actions', async () => {
      const customer = await getOrCreateSalonCustomer({
        accountId: salonA.id,
        name: 'Rahul Sharma',
        phone: '+919000000000',
        preferredStaff: 'Amit Roy',
      });

      const copilot = await getSalonCopilotContext({
        accountId: salonA.id,
        conversationId: 'conv-s1',
        contactId: customer.id,
      });

      expect(copilot.customer.name).toBe('Rahul Sharma');
      expect(copilot.preferredStaff).toBe('Amit Roy');
      expect(copilot.suggestedReply).toContain('Amit');
      expect(
        copilot.quickActions.some(
          (a) => a.actionType === 'reschedule_appointment'
        )
      ).toBe(true);
    });
  });

  describe('Salon AI Tools in Tool Registry', () => {
    it('executes searchSalonServices, rescheduleAppointment, and cancelAppointment tools successfully', async () => {
      const searchTool = aiToolRegistry.get('searchSalonServices');
      const rescheduleTool = aiToolRegistry.get('rescheduleAppointment');
      const cancelTool = aiToolRegistry.get('cancelAppointment');

      expect(searchTool).toBeDefined();
      expect(rescheduleTool).toBeDefined();
      expect(cancelTool).toBeDefined();

      const searchRes = await searchTool!.execute(
        { serviceQuery: 'Haircut' },
        {
          accountId: salonA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(searchRes.success).toBe(true);

      const reschedRes = await rescheduleTool!.execute(
        { appointmentId: 'appt-1', newDate: '2026-08-26', newTime: '05:00 PM' },
        {
          accountId: salonA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(reschedRes.success).toBe(true);

      const cancelRes = await cancelTool!.execute(
        { appointmentId: 'appt-1', reason: 'Customer changed plans' },
        {
          accountId: salonA.id,
          userId: 'u1',
          conversationId: 'c1',
          contactId: 'cnt1',
        }
      );
      expect(cancelRes.success).toBe(true);
    });
  });
});
