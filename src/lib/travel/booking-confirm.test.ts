import { beforeEach, describe, expect, it, vi } from 'vitest';

async function sendTextStub(_args: Record<string, unknown>) {
  return { whatsapp_message_id: 't1' };
}
async function sendButtonsStub(_args: Record<string, unknown>) {
  return { whatsapp_message_id: 'b1' };
}
const sendText = vi.fn(sendTextStub);
const sendButtons = vi.fn(sendButtonsStub);

vi.mock('@/lib/automations/meta-send', () => ({
  engineSendText: (...args: unknown[]) =>
    (sendText as unknown as (...x: unknown[]) => unknown)(...args),
  engineSendButtons: (...args: unknown[]) =>
    (sendButtons as unknown as (...x: unknown[]) => unknown)(...args),
}));

const h = vi.hoisted(() => ({
  tables: {
    contacts: [] as Array<Record<string, unknown>>,
    tour_packages: [] as Array<Record<string, unknown>>,
    travel_bookings: [] as Array<Record<string, unknown>>,
    appointments: [] as Array<Record<string, unknown>>,
    contact_notes: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/lib/db/server', () => {
  function builder(table: keyof typeof h.tables) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Record<string, unknown> | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (field: string, value: unknown) => {
        filters.push((row) => row[field] === value);
        return api;
      },
      in: (field: string, values: unknown[]) => {
        filters.push(
          (row) => Array.isArray(values) && values.includes(row[field])
        );
        return api;
      },
      ilike: (field: string, value: string) => {
        const needle = value.toLowerCase();
        filters.push((row) =>
          String(row[field] ?? '')
            .toLowerCase()
            .includes(needle)
        );
        return api;
      },
      order: () => api,
      limit: () => api,
      insert: (row: Record<string, unknown>) => {
        op = 'insert';
        payload = row;
        return api;
      },
      update: (row: Record<string, unknown>) => {
        op = 'update';
        payload = row;
        return api;
      },
      maybeSingle: async () => {
        const rows =
          (h.tables as Record<string, Array<Record<string, unknown>>>)[table] ??
          [];
        const row = rows.find((item) =>
          filters.every((filter) => filter(item))
        );
        return { data: row ?? null, error: null };
      },
      single: async () => {
        const all = h.tables as Record<string, Array<Record<string, unknown>>>;
        if (!all[table]) all[table] = [];
        if (op === 'insert' && payload) {
          const created = {
            id: `${table}-${all[table].length + 1}`,
            ...payload,
          };
          all[table].push(created);
          return { data: created, error: null };
        }
        const row = all[table].find((item) =>
          filters.every((filter) => filter(item))
        );
        return {
          data: row ?? null,
          error: row ? null : { message: 'not found' },
        };
      },
      then: (
        onF: (value: { data: unknown; error: null }) => unknown,
        onR?: (reason: unknown) => unknown
      ) => {
        const all = h.tables as Record<string, Array<Record<string, unknown>>>;
        if (!all[table]) all[table] = [];
        if (op === 'update' && payload) {
          all[table].forEach((row) => {
            if (filters.every((filter) => filter(row)))
              Object.assign(row, payload);
          });
        }
        if (op === 'insert' && payload) {
          const created = {
            id: `${table}-${all[table].length + 1}`,
            ...payload,
          };
          all[table].push(created);
          return Promise.resolve({ data: [created], error: null }).then(
            onF,
            onR
          );
        }
        return Promise.resolve({
          data: all[table].filter((row) =>
            filters.every((filter) => filter(row))
          ),
          error: null,
        }).then(onF, onR);
      },
    };
    return api;
  }
  return {
    getAdminClient: () => ({
      from: (table: string) => builder(table as keyof typeof h.tables),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'claim_travel_pending_booking') {
          const contact = h.tables.contacts.find(
            (c) =>
              c.id === args.p_contact_id && c.account_id === args.p_account_id
          );
          const meta = (contact?.metadata ?? {}) as Record<string, unknown>;
          const pending = meta.travel_pending_booking;
          if (!pending) return { data: { status: 'none' }, error: null };
          delete meta.travel_pending_booking;
          return { data: { status: 'claimed', pending }, error: null };
        }
        if (fn === 'create_travel_booking') {
          const booking = {
            id: `tb-${h.tables.travel_bookings.length + 1}`,
            account_id: args.p_account_id,
            tour_package_id: args.p_tour_package_id,
            contact_id: args.p_contact_id,
            travel_date: args.p_travel_date,
            guests_count: args.p_guests_count,
            total_price: args.p_total_price,
            currency: args.p_currency,
            status: 'Confirmed',
          };
          h.tables.travel_bookings.push(booking);
          h.tables.appointments.push({
            id: `appt-${h.tables.appointments.length + 1}`,
            account_id: args.p_account_id,
            patient_id: args.p_contact_id,
            status: 'Confirmed',
            notes: `Travel booking for ${args.p_package_name}`,
          });
          return {
            data: { status: 'created', booking_id: booking.id },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    }),
  };
});

vi.mock('@/lib/travel/retrieval', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/travel/retrieval')>();
  return {
    ...actual,
    matchTourPackagesForMessage: vi.fn(async (_db, accountId, message) => {
      const pkg = h.tables.tour_packages.find(
        (p) =>
          p.account_id === accountId &&
          String(p.name).toLowerCase() === String(message).toLowerCase()
      );
      if (pkg) {
        const detail = {
          ...pkg,
          currency: 'INR',
          itineraries: [],
          inclusions: [],
          exclusions: [],
          hotels: [],
          pricing: [],
          departures: [],
        };
        return {
          matches: [{ package: detail, score: 1, matchedBy: 'name' }],
          nearMatches: [],
          similarMatches: [],
          retrievalFailed: false,
          requirements: {},
        };
      }
      return {
        matches: [],
        nearMatches: [],
        similarMatches: [],
        retrievalFailed: false,
        requirements: {},
      };
    }),
  };
});

import {
  TRAVEL_BOOKING_CONFIRM_BUTTON_ID,
  buildBookingConfirmMessage,
  classifyTravelBookingReply,
  confirmPendingTravelBooking,
  formatTravelPrice,
  isFreshPending,
  storePendingTravelBooking,
} from './booking-confirm';

const freshPendingSample = {
  package_id: 'p1',
  package_name: 'Kashmir Delight',
  destination: 'Kashmir',
  travel_date: '2026-09-10',
  guests_count: 2,
  total_price: 27999,
  currency: 'INR',
  conversation_id: 'conv1',
  offered_at: new Date().toISOString(),
};

describe('travel booking confirm helpers', () => {
  it('classifies the Confirm Booking button and numbered Evolution reply', () => {
    expect(
      classifyTravelBookingReply({
        replyId: TRAVEL_BOOKING_CONFIRM_BUTTON_ID,
        pending: freshPendingSample,
      })
    ).toBe('confirm');
    expect(
      classifyTravelBookingReply({
        replyId: 'travel_booking_later',
      })
    ).toBe('later');
    expect(
      classifyTravelBookingReply({
        text: '1',
        pending: freshPendingSample,
      })
    ).toBe('confirm');
    expect(
      classifyTravelBookingReply({
        text: '1',
        pending: null,
      })
    ).toBeNull();
    expect(
      classifyTravelBookingReply({
        text: 'booking confirm',
        pending: freshPendingSample,
      })
    ).toBe('confirm');
  });

  it('formats INR prices and expires stale pending offers', () => {
    expect(formatTravelPrice(27999, 'INR')).toBe('₹27,999');
    expect(
      isFreshPending({
        package_id: 'p1',
        package_name: 'Kashmir Delight',
        destination: 'Kashmir',
        travel_date: '2026-09-10',
        guests_count: 2,
        total_price: 27999,
        currency: 'INR',
        conversation_id: 'conv1',
        offered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      })
    ).toBe(true);
    expect(
      isFreshPending({
        package_id: 'p1',
        package_name: 'Kashmir Delight',
        destination: 'Kashmir',
        travel_date: '2026-09-10',
        guests_count: 2,
        total_price: 27999,
        currency: 'INR',
        conversation_id: 'conv1',
        offered_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
      })
    ).toBe(false);
  });

  it('builds a Confirm Booking template that names the package', () => {
    const message = buildBookingConfirmMessage({
      packageName: 'Kashmir Delight',
      destination: 'Kashmir',
      travelDate: '2026-09-10',
      guestsCount: 2,
      totalPrice: 27999,
    });
    expect(message.bodyText).toContain('Kashmir Delight');
    expect(message.bodyText).toContain('Confirm Booking');
    expect(message.buttons[0]).toEqual({
      id: TRAVEL_BOOKING_CONFIRM_BUTTON_ID,
      title: 'Confirm Booking',
    });
  });
});

describe('confirmPendingTravelBooking', () => {
  beforeEach(() => {
    sendText.mockClear();
    sendButtons.mockClear();
    h.tables.contacts = [
      {
        id: 'contact-1',
        account_id: 'acct-travel',
        metadata: {},
      },
    ];
    h.tables.tour_packages = [
      {
        id: 'tour-1',
        account_id: 'acct-travel',
        name: 'Kashmir Delight',
        destination: 'Kashmir',
        duration_days: 5,
        starting_price: 27999,
        description: '5D4N',
        status: 'active',
      },
    ];
    h.tables.travel_bookings = [];
    h.tables.appointments = [];
    h.tables.contact_notes = [];
  });

  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  it('creates a tenant-scoped booking after Confirm Booking', async () => {
    await storePendingTravelBooking('acct-travel', 'contact-1', {
      package_id: 'tour-1',
      package_name: 'Kashmir Delight',
      destination: 'Kashmir',
      travel_date: futureDate,
      guests_count: 2,
      total_price: 27999,
      currency: 'INR',
      conversation_id: 'conv-1',
      offered_at: new Date().toISOString(),
    });

    const result = await confirmPendingTravelBooking({
      accountId: 'acct-travel',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(result.status).toBe('confirmed');
    expect(h.tables.travel_bookings).toHaveLength(1);
    expect(h.tables.travel_bookings[0]).toEqual(
      expect.objectContaining({
        account_id: 'acct-travel',
        contact_id: 'contact-1',
        travel_date: futureDate,
        guests_count: 2,
        total_price: 27999,
        status: 'Confirmed',
      })
    );
    expect(h.tables.travel_bookings[0].tour_package_id).toBe('tour-1');
    expect(h.tables.appointments[0]).toEqual(
      expect.objectContaining({
        account_id: 'acct-travel',
        patient_id: 'contact-1',
        status: 'Confirmed',
      })
    );
    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Travel Booking is confirmed'),
      })
    );
  });

  it('refuses a pending booking pointing at another account package', async () => {
    // A stale/cross-account pending id (tour_packages of acct-other) must
    // NOT be silently copied or resolved — canonical lookup is tenant-scoped.
    h.tables.tour_packages.push({
      id: 'tour-other',
      account_id: 'acct-other',
      name: 'Secret Trip',
      destination: 'Goa',
      duration_days: 3,
      starting_price: 999,
    });
    await storePendingTravelBooking('acct-travel', 'contact-1', {
      package_id: 'tour-other',
      package_name: 'Secret Trip',
      destination: 'Goa',
      travel_date: futureDate,
      guests_count: 1,
      total_price: 999,
      currency: 'INR',
      conversation_id: 'conv-1',
      offered_at: new Date().toISOString(),
    });

    const result = await confirmPendingTravelBooking({
      accountId: 'acct-travel',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(result.status).toBe('missing_package');
    expect(h.tables.travel_bookings).toHaveLength(0);
    // The other account's package is untouched.
    expect(
      h.tables.tour_packages.find((row) => row.account_id === 'acct-other')
    ).toEqual(expect.objectContaining({ id: 'tour-other' }));
  });

  it('confirms by canonical name-match within the same account', async () => {
    await storePendingTravelBooking('acct-travel', 'contact-1', {
      package_id: null,
      package_name: 'Kashmir Delight',
      destination: 'Kashmir',
      travel_date: futureDate,
      guests_count: 1,
      total_price: 27999,
      currency: 'INR',
      conversation_id: 'conv-1',
      offered_at: new Date().toISOString(),
    });

    const result = await confirmPendingTravelBooking({
      accountId: 'acct-travel',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(result.status).toBe('confirmed');
    expect(h.tables.travel_bookings[0]?.tour_package_id).toBe('tour-1');
  });
});
