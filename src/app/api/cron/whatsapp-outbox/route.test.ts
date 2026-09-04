import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { whatsappOutboxService } from '@/core/services/whatsapp-outbox.service';

vi.mock('@/core/services/whatsapp-outbox.service', () => ({
  whatsappOutboxService: {
    claimAndProcessBatch: vi.fn(),
  },
}));

const ORIGINAL_SECRET = process.env.CRON_SECRET;
const claimAndProcessBatchMock = vi.mocked(
  whatsappOutboxService.claimAndProcessBatch
);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe('GET & POST /api/cron/whatsapp-outbox', () => {
  it('fails closed when CRON_SECRET is absent', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(
      new Request('https://helpa.test/api/cron/whatsapp-outbox')
    );
    expect(response.status).toBe(503);
    expect(claimAndProcessBatchMock).not.toHaveBeenCalled();
  });

  it('rejects unauthorized requests with invalid secret', async () => {
    process.env.CRON_SECRET = 'correct-cron-secret';
    const response = await GET(
      new Request('https://helpa.test/api/cron/whatsapp-outbox', {
        headers: { 'x-cron-secret': 'wrong-secret' },
      })
    );
    expect(response.status).toBe(401);
    expect(claimAndProcessBatchMock).not.toHaveBeenCalled();
  });

  it('authorizes with bearer token and invokes batch claim processor', async () => {
    process.env.CRON_SECRET = 'correct-cron-secret';
    claimAndProcessBatchMock.mockResolvedValue({
      claimed: 2,
      succeeded: 2,
      retried: 0,
      failed: 0,
    });

    const response = await GET(
      new Request('https://helpa.test/api/cron/whatsapp-outbox?batch_size=15', {
        headers: { Authorization: 'Bearer correct-cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.metrics).toEqual({
      claimed: 2,
      succeeded: 2,
      retried: 0,
      failed: 0,
    });
    expect(claimAndProcessBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: 15,
        leaseDurationSeconds: 120,
      })
    );
  });

  it('supports POST requests identically with valid authorization', async () => {
    process.env.CRON_SECRET = 'correct-cron-secret';
    claimAndProcessBatchMock.mockResolvedValue({
      claimed: 0,
      succeeded: 0,
      retried: 0,
      failed: 0,
    });

    const response = await POST(
      new Request('https://helpa.test/api/cron/whatsapp-outbox', {
        method: 'POST',
        headers: { 'x-cron-secret': 'correct-cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(claimAndProcessBatchMock).toHaveBeenCalledTimes(1);
  });
});
