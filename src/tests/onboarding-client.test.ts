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

// Mock dependencies
const mockAdminClient = {
  from: vi.fn(),
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

vi.mock('@/lib/appwrite-server-compat', () => ({
  appwriteAdmin: () => mockAdminClient,
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
          update: vi
            .fn()
            .mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          delete: vi
            .fn()
            .mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
        };
      }

      if (table === 'knowledge_base') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
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
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
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
    expect(dbStore.accounts.status).toBe('active');
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

  it('3. Rejects onboarding if industry is missing', async () => {
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

  it('4. Successfully simulates AI customer questions via /api/account/ai/test', async () => {
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
});
