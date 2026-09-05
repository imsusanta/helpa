/**
 * src/tests/onboarding-client.test.ts
 *
 * Test suite for Helpa Client Onboarding (Phase 2A).
 * Tests:
 * 1. Business profile saving & tailored AI prompt building
 * 2. Industry module activation & pipeline seeding
 * 3. Custom services & hours seeding in Knowledge Base
 * 4. AI test simulation endpoint
 * 5. Multi-tenant isolation & security
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as handleOnboard } from '@/app/api/account/onboard/route';
import { POST as handleAiTest } from '@/app/api/account/ai/test/route';
import {
  flattenStepsTree,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';

// Mock dependencies
const mockAdminClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => mockAdminClient,
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: vi.fn().mockResolvedValue({
    userId: 'user-owner-123',
    accountId: 'acc-tenant-999',
    role: 'owner',
    email: 'doctor@clinic.com',
  }),
  toErrorResponse: vi.fn(
    (err) =>
      new Response(JSON.stringify({ error: err.message }), { status: 500 })
  ),
}));

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => mockAdminClient,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ success: true }),
  rateLimitResponse: () => new Response('Rate limited', { status: 429 }),
  RATE_LIMITS: { adminAction: { limit: 100, windowMs: 60000 } },
}));

vi.mock('@/core/ai/engine', () => ({
  executeAiPipeline: vi.fn().mockResolvedValue({
    replyText:
      'Namaste! Doctor Consultation is available at ₹500 from 9:00 AM to 8:00 PM.',
    metadata: { latencyMs: 120 },
  }),
}));

describe('Helpa Client Onboarding Suite (Phase 2A)', () => {
  let dbStore: {
    accounts: Record<string, unknown>;
    knowledgeBase: Array<Record<string, unknown>>;
    tenantModules: Array<Record<string, unknown>>;
    pipelines: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbStore = {
      accounts: {
        id: 'acc-tenant-999',
        name: 'Original Clinic',
        industry: 'general',
      },
      knowledgeBase: [],
      tenantModules: [],
      pipelines: [{ id: 'pipe-1', account_id: 'acc-tenant-999' }],
    };

    mockAdminClient.rpc.mockImplementation(
      (fnName: string, params: Record<string, unknown>) => {
        if (fnName === 'complete_workspace_onboarding') {
          if (params.p_workspace_name) {
            dbStore.accounts.name = params.p_workspace_name;
          }
          dbStore.accounts.industry = params.p_industry;
          dbStore.accounts.welcome_message = params.p_welcome_message;
          dbStore.accounts.ai_system_prompt = params.p_ai_system_prompt;
          dbStore.accounts.onboarding_completed_at = new Date().toISOString();

          // Knowledge base rows
          if (Array.isArray(params.p_kb_items)) {
            // Remove prior seeded Company Hours if changing template
            dbStore.knowledgeBase = dbStore.knowledgeBase.filter(
              (row) => row.question_title !== 'Company Hours'
            );
            for (const item of params.p_kb_items as Array<
              Record<string, unknown>
            >) {
              if (
                !dbStore.knowledgeBase.some(
                  (k) => k.question_title === item.question_title
                )
              ) {
                dbStore.knowledgeBase.push({
                  id: `kb-${Math.random()}`,
                  account_id: params.p_account_id,
                  ...item,
                });
              }
            }
          }

          return Promise.resolve({
            data: {
              success: true,
              status: 'completed',
              mutated: true,
              industry: params.p_industry,
              completed_at: dbStore.accounts.onboarding_completed_at,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
    );

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return {
          update: vi.fn().mockImplementation((updates) => {
            Object.assign(dbStore.accounts, updates);
            return {
              eq: vi
                .fn()
                .mockResolvedValue({ data: dbStore.accounts, error: null }),
            };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: dbStore.accounts, error: null }),
            }),
          }),
        };
      }

      if (table === 'tenant_modules') {
        return {
          upsert: vi.fn().mockImplementation((rows) => {
            dbStore.tenantModules = rows;
            return Promise.resolve({ data: rows, error: null });
          }),
        };
      }

      if (table === 'pipelines') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue({ data: dbStore.pipelines, error: null }),
            }),
          }),
        };
      }

      if (table === 'pipeline_stages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'knowledge_base') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: dbStore.knowledgeBase,
              error: null,
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi
                .fn()
                .mockImplementation((_column: string, ids: string[]) => {
                  dbStore.knowledgeBase = dbStore.knowledgeBase.filter(
                    (row) => !ids.includes(String(row.id))
                  );
                  return Promise.resolve({ error: null });
                }),
              then: (
                onFulfilled?: (value: { error: null }) => unknown,
                onRejected?: (reason: unknown) => unknown
              ) =>
                Promise.resolve({ error: null }).then(onFulfilled, onRejected),
            }),
          }),
          insert: vi.fn().mockImplementation((rows) => {
            dbStore.knowledgeBase.push(...rows);
            return Promise.resolve({ data: rows, error: null });
          }),
        };
      }

      if (table === 'broadcasts') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'automations' || table === 'automation_steps') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { id: 'auto-1' }, error: null }),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: { id: 'auto-1' }, error: null }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
  });

  it('1. Successfully onboards a new Clinic with custom services and working hours', async () => {
    const payload = {
      industry: 'hospital_clinic',
      name: 'Dr. Sharma Healthcare Clinic',
      city: 'Kolkata',
      location: 'Kolkata, Salt Lake Sector 5',
      workingDays: 'Mon - Sat (09:00 AM - 08:00 PM)',
      openingTime: '09:00 AM',
      closingTime: '08:00 PM',
      welcomeMessage: 'Namaste! Welcome to Dr. Sharma Clinic.',
      services: [
        {
          name: 'General OPD Consultation',
          price: 500,
          description: '30 min checkup',
        },
        {
          name: 'Dental Cleaning',
          price: 800,
          description: 'Ultrasonic dental scale',
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);

    // Verify accounts update
    expect(dbStore.accounts.name).toBe('Dr. Sharma Healthcare Clinic');
    expect(dbStore.accounts.industry).toBe('hospital_clinic');
    expect(dbStore.accounts.welcome_message).toBe(
      'Namaste! Welcome to Dr. Sharma Clinic.'
    );
    expect(String(dbStore.accounts.ai_system_prompt)).toContain(
      'BUSINESS PROFILE & OPERATING HOURS'
    );
    expect(String(dbStore.accounts.ai_system_prompt)).toContain(
      'Kolkata, Salt Lake Sector 5'
    );

    // Verify Knowledge Base entries were seeded with custom services
    const serviceKb = dbStore.knowledgeBase.find((k) =>
      String(k.question_title).includes('General OPD Consultation')
    );
    expect(serviceKb).toBeDefined();
    expect(String(serviceKb?.answer_content)).toContain('₹500');

    // Verify Hours & Location FAQ was added
    const companyKb = dbStore.knowledgeBase.find(
      (k) => k.category === 'company'
    );
    expect(companyKb).toBeDefined();
    expect(String(companyKb?.answer_content)).toContain('09:00 AM');
  });

  it('2. Successfully onboards a Salon business with pricing and templates', async () => {
    const payload = {
      industry: 'salon',
      name: 'Glamour Luxury Salon',
      city: 'Mumbai',
      services: [
        { name: 'Haircut & Styling', price: 400 },
        { name: 'Facial Glow', price: 1200 },
      ],
    };

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    expect(dbStore.accounts.industry).toBe('salon');

    const salonKb = dbStore.knowledgeBase.find((k) =>
      String(k.question_title).includes('Facial Glow')
    );
    expect(salonKb).toBeDefined();
    expect(String(salonKb?.answer_content)).toContain('₹1,200');
  });

  it('3. Keeps tenant-authored knowledge base rows when changing template', async () => {
    dbStore.knowledgeBase = [
      {
        id: 'kb-user-1',
        account_id: 'acc-tenant-999',
        question_title: 'Our weekend fasting package includes CBC',
        answer_content: 'Book at reception.',
      },
      {
        id: 'kb-seed-1',
        account_id: 'acc-tenant-999',
        question_title: 'Company Hours',
        answer_content: 'Old general hours.',
      },
    ];

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: 'hospital_clinic',
        name: 'Dr. Sharma Healthcare Clinic',
      }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);

    const titles = dbStore.knowledgeBase.map((row) => row.question_title);
    expect(titles).toContain('Our weekend fasting package includes CBC');
    expect(titles).not.toContain('Company Hours');
    expect(
      titles.some((title) => String(title).includes('OPD Consultation Hours'))
    ).toBe(true);
  });

  it('4. Rejects onboarding if industry is missing', async () => {
    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete Biz' }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Industry selection is required.');
  });

  it('5. Successfully simulates AI customer questions via /api/account/ai/test', async () => {
    const req = new Request('http://localhost:3000/api/account/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What are your consultation fees?' }),
    });

    const res = await handleAiTest(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reply).toContain('Doctor Consultation is available at ₹500');
  });

  it('6. Returns already_completed (mutated: false) without replaying mutations', async () => {
    // Set mock RPC to simulate already_completed response
    mockAdminClient.rpc.mockResolvedValueOnce({
      data: {
        success: true,
        status: 'already_completed',
        mutated: false,
        industry: 'hospital_clinic',
        message:
          'Onboarding is already completed or exempted for this workspace.',
      },
      error: null,
    });

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: 'hospital_clinic',
        name: 'Should Not Mutate',
      }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('already_completed');
    expect(data.mutated).toBe(false);
  });

  it('7. Enforces cross-tenant isolation: binds to authenticated ctx.accountId, ignoring body spoofing', async () => {
    let capturedAccountId: string | null = null;
    mockAdminClient.rpc.mockImplementationOnce(
      (fnName: string, params: Record<string, unknown>) => {
        if (fnName === 'complete_workspace_onboarding') {
          capturedAccountId = params.p_account_id as string;
          return Promise.resolve({
            data: {
              success: true,
              status: 'completed',
              mutated: true,
              industry: params.p_industry,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
    );

    // Attacker tries to pass another account ID in the body
    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: 'salon',
        accountId: 'acc-victim-victim',
        account_id: 'acc-victim-victim',
      }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    // Verified: RPC strictly received auth context's accountId ('acc-tenant-999'), NOT the spoofed one
    expect(capturedAccountId).toBe('acc-tenant-999');
  });

  it('8. Successfully resets industry template to general while preserving onboarding completion/exemption markers', async () => {
    let updatePayload: Record<string, unknown> | null = null;
    let updateFilterId: string | null = null;

    mockAdminClient.from.mockImplementationOnce((table: string) => {
      expect(table).toBe('accounts');
      return {
        update: vi.fn().mockImplementation((payload) => {
          updatePayload = payload;
          return {
            eq: vi.fn().mockImplementation((col, id) => {
              updateFilterId = id;
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }),
      };
    });

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reset).toBe(true);
    expect(updateFilterId).toBe('acc-tenant-999');
    expect(updatePayload).toHaveProperty('industry', 'general');
    // Markers must NEVER be cleared to null
    expect(updatePayload).not.toHaveProperty('onboarding_completed_at');
    expect(updatePayload).not.toHaveProperty('onboarding_exempted_at');
    expect(updatePayload).not.toHaveProperty('onboarding_exemption_reason');
  });

  it('9. Handles database RPC failure cleanly with 500 error', async () => {
    mockAdminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Lock acquisition timeout or transaction error' },
    });

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'gym' }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Lock acquisition timeout or transaction error');
  });

  it('10. Separates permissions: initial setup requires owner; reconfigure and reset permit admin', async () => {
    const { requireRole } = await import('@/lib/auth/account');

    // Non-owner trying initial setup -> rejected
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('Forbidden: role owner required')
    );
    const initialReq = new Request(
      'http://localhost:3000/api/account/onboard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: 'salon' }),
      }
    );
    const initialRes = await handleOnboard(initialReq);
    expect(initialRes.status).toBe(500);
    const initialData = await initialRes.json();
    expect(initialData.error).toContain('role owner required');

    // Admin role executing reconfigure -> permitted
    vi.mocked(requireRole).mockResolvedValueOnce({
      userId: 'user-admin-1',
      accountId: 'acc-tenant-999',
      role: 'admin',
      industry: 'hospital_clinic',
      account: {
        id: 'acc-tenant-999',
        name: 'Test Account',
        industry: 'hospital_clinic',
      },
      admin: mockAdminClient as never,
    });
    mockAdminClient.rpc.mockResolvedValueOnce({
      data: {
        success: true,
        status: 'reconfigured',
        mutated: true,
        industry: 'salon',
        completed_at: '2026-09-01T10:00:00Z',
      },
      error: null,
    });
    const reconfigReq = new Request(
      'http://localhost:3000/api/account/onboard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: 'salon', reconfigure: true }),
      }
    );
    const reconfigRes = await handleOnboard(reconfigReq);
    expect(reconfigRes.status).toBe(200);
    const reconfigData = await reconfigRes.json();
    expect(reconfigData.status).toBe('reconfigured');
    expect(reconfigData.industry).toBe('salon');
  });

  it('11. Explicit reconfigure (reconfigure=true) forwards p_reconfigure=true and returns status=reconfigured', async () => {
    let capturedParams: Record<string, unknown> | null = null;
    mockAdminClient.rpc.mockImplementationOnce(
      (fnName: string, params: Record<string, unknown>) => {
        if (fnName === 'complete_workspace_onboarding') {
          capturedParams = params;
          return Promise.resolve({
            data: {
              success: true,
              status: 'reconfigured',
              mutated: true,
              industry: params.p_industry,
              completed_at: '2026-09-01T10:00:00Z',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
    );

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: 'travel',
        reconfigure: true,
      }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('reconfigured');
    expect(capturedParams).toHaveProperty('p_reconfigure', true);
  });

  it('12. Workflow steps tree preserves parent/child and yes/no branch semantics across flattener', async () => {
    const inputTree: BuilderStepInput[] = [
      {
        id: 'step-root-1',
        step_type: 'condition',
        step_config: { condition_type: 'time_window' },
        branches: {
          yes: [
            {
              id: 'step-yes-child',
              step_type: 'send_message',
              step_config: { text: 'During hours reply' },
            },
          ],
          no: [
            {
              id: 'step-no-child',
              step_type: 'send_message',
              step_config: { text: 'Off hours reply' },
            },
          ],
        },
      },
    ];

    const flatRows = flattenStepsTree(inputTree, 'auto-branch-1');
    expect(flatRows).toHaveLength(3);

    const rootRow = flatRows.find((r) => r.id === 'step-root-1');
    expect(rootRow).toBeDefined();
    expect(rootRow?.parent_step_id).toBeNull();
    expect(rootRow?.branch).toBeNull();

    const yesRow = flatRows.find((r) => r.id === 'step-yes-child');
    expect(yesRow).toBeDefined();
    expect(yesRow?.parent_step_id).toBe('step-root-1');
    expect(yesRow?.branch).toBe('yes');

    const noRow = flatRows.find((r) => r.id === 'step-no-child');
    expect(noRow).toBeDefined();
    expect(noRow?.parent_step_id).toBe('step-root-1');
    expect(noRow?.branch).toBe('no');
  });

  it('13. Preserves operational and billing status: does not overwrite status to active', async () => {
    dbStore.accounts.status = 'trial';

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'gym' }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    // Operational billing status must remain intact, never overwritten
    expect(dbStore.accounts.status).toBe('trial');
  });

  it('14. Reconfigure on an unresolved account is rejected with error', async () => {
    mockAdminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          'Cannot reconfigure an unresolved account. Workspace acc-tenant-999 must complete initial onboarding first.',
      },
    });

    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'salon', reconfigure: true }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Cannot reconfigure an unresolved account');
  });

  it('15. Duplicate setup submission returns actual stored state rather than request input', async () => {
    mockAdminClient.rpc.mockResolvedValueOnce({
      data: {
        success: true,
        status: 'already_completed',
        mutated: false,
        industry: 'hospital_clinic', // Actual stored industry in DB
        completed_at: '2026-09-01T10:00:00Z',
        exempted_at: null,
        exemption_reason: null,
      },
      error: null,
    });

    // Client requests 'gym', but workspace is already completed as 'hospital_clinic'
    const req = new Request('http://localhost:3000/api/account/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'gym' }),
    });

    const res = await handleOnboard(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('already_completed');
    expect(data.mutated).toBe(false);
    expect(data.industry).toBe('hospital_clinic'); // Stored state preserved!
  });
});
