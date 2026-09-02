import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/db/repositories', () => ({
  leadsRepository: {},
  appointmentsRepository: {},
  auditLogsRepository: {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/leads/lead-followup.service', () => ({
  pauseFollowupsForConversation: vi.fn().mockResolvedValue(undefined),
}));

import { TrustedActionExecutor } from '@/core/actions/action-executor';

describe('TrustedActionExecutor.handoffToHuman', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails when no conversation row is updated', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const executor = new TrustedActionExecutor({
      accountId: 'tenant-a',
      actorId: 'user-1',
      actorType: 'user',
    });

    const result = await executor.handoffToHuman({
      conversationId: 'missing-conv',
      reason: 'staff takeover',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Conversation not found/i);
  });

  it('succeeds only after a tenant-scoped conversation update', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'conv-1' }],
        error: null,
      }),
    });

    const executor = new TrustedActionExecutor({
      accountId: 'tenant-a',
      actorId: 'user-1',
      actorType: 'user',
    });

    const result = await executor.handoffToHuman({
      conversationId: 'conv-1',
      reason: 'staff takeover',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      conversationId: 'conv-1',
      aiEnabled: false,
    });
  });
});
