import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin, getAdminClient } from '@/lib/appwrite-compat';
import { GET } from './route';

vi.mock('@/lib/appwrite-compat', () => ({
  supabaseAdmin: vi.fn(),
}));
vi.mock('@/queues/producers/appointment-reminders', () => ({
  enqueueAppointmentReminder: vi.fn(),
}));

const ORIGINAL_SECRET = process.env.CRON_SECRET;
const supabaseAdminMock = vi.mocked(supabaseAdmin);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe('GET /api/cron/reminders', () => {
  it('fails closed when CRON_SECRET is absent', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(
      new Request('https://helpa.test/api/cron/reminders')
    );
    expect(response.status).toBe(503);
    expect(supabaseAdminMock).not.toHaveBeenCalled();
  });

  it('does not accept a secret passed in the query string', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    const response = await GET(
      new Request(
        'https://helpa.test/api/cron/reminders?secret=expected-secret'
      )
    );
    expect(response.status).toBe(401);
    expect(supabaseAdminMock).not.toHaveBeenCalled();
  });

  it('accepts the header and returns a sanitized queue summary', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    supabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    } as never);

    const response = await GET(
      new Request('https://helpa.test/api/cron/reminders', {
        headers: { 'x-cron-secret': 'expected-secret' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      queued_24h: 0,
      queued_2h: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it('does not leak database errors', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    supabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'sensitive database details' },
        }),
      })),
    } as never);

    const response = await GET(
      new Request('https://helpa.test/api/cron/reminders', {
        headers: { 'x-cron-secret': 'expected-secret' },
      })
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Reminder scheduling failed',
    });
  });
});
