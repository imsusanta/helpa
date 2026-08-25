import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueAppointmentReminder } from '@/lib/reminders/appointment-reminders';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (_collection: string) => ({
      insert: (payload: unknown) => {
        mockInsert(payload);
        return {
          select: () => ({
            single: async () => mockSelect(),
          }),
        };
      },
      select: (_cols: string) => ({
        eq: (col1: string, val1: unknown) => ({
          eq: (col2: string, val2: unknown) => {
            mockEq(col1, val1, col2, val2);
            return {
              maybeSingle: async () => mockMaybeSingle(),
            };
          },
        }),
      }),
    }),
  }),
}));

describe('enqueueAppointmentReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully enqueues a new reminder and returns created status with outboxId', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'outbox_doc_123' },
      error: null,
    });

    const res = await enqueueAppointmentReminder({
      accountId: 'acc_1',
      appointmentId: 'appt_1',
      reminderType: '24h',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe('created');
      expect(res.outboxId).toBe('outbox_doc_123');
      expect(res.idempotencyKey).toBe('rem_appt_1_24h');
    }
  });

  it('handles existing reminder idempotently when payload matches', async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { code: 409, message: 'Document already exists' },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'existing_outbox_456',
        requestHash: 'reminder:appt_1:24h',
      },
      error: null,
    });

    const res = await enqueueAppointmentReminder({
      accountId: 'acc_1',
      appointmentId: 'appt_1',
      reminderType: '24h',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe('already_exists');
      expect(res.outboxId).toBe('existing_outbox_456');
    }
  });

  it('rejects with conflict error if existing reminder has different requestHash', async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { code: 409, message: 'Document already exists' },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'existing_outbox_456',
        requestHash: 'reminder:other_appt:24h',
      },
      error: null,
    });

    const res = await enqueueAppointmentReminder({
      accountId: 'acc_1',
      appointmentId: 'appt_1',
      reminderType: '24h',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('REMINDER_IDEMPOTENCY_CONFLICT');
      expect(res.retryable).toBe(false);
    }
  });

  it('returns typed failure when database schema or collection is missing', async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { code: 404, message: 'Collection not found' },
    });

    const res = await enqueueAppointmentReminder({
      accountId: 'acc_1',
      appointmentId: 'appt_1',
      reminderType: '24h',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('REMINDER_SCHEMA_MISMATCH');
      expect(res.retryable).toBe(false);
    }
  });
});
