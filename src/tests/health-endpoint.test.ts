import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCreateClient = vi.fn();
const mockGetAdminClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: (...args: unknown[]) => mockGetAdminClient(...args),
}));

vi.mock('@/lib/runtime-config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/runtime-config')>(
    '@/lib/runtime-config'
  );
  return {
    ...actual,
    getRuntimeConfig: vi.fn().mockReturnValue({
      databaseProvider: 'supabase',
      authProvider: 'supabase',
      migrationMode: 'cutover',
    }),
    requireSupabasePublicConfig: vi.fn().mockReturnValue({
      url: 'https://real-test-ref.supabase.co',
      publishableKey: 'ci-test-supabase-anon-key',
    }),
  };
});

import { GET as getHealth } from '@/app/api/health/route';

describe('Health Endpoint Hardening & Security Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.PLAYWRIGHT_TEST;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('1. /api/health/live: lightweight liveness probe, returns 200, does not query database', async () => {
    const req = new NextRequest('http://localhost:3000/api/health/live');
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.commit).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockGetAdminClient).not.toHaveBeenCalled();
  });

  it('2. Healthy database: returns status ok, healthy checks, and verified migration version', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            abortSignal: vi
              .fn()
              .mockResolvedValue({ data: [{ id: 'prof-1' }], error: null }),
          }),
        }),
      }),
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockResolvedValue({
                  data: [{ version: '20260820000000' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    mockCreateClient.mockReturnValue(mockClient);

    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('healthy');
    expect(body.checks.supabase).toBe('healthy');
    expect(body.checks.migrationVersion).toBe('20260820000000');
    expect(body.databaseMigrationStatus).toBe('verified');
    expect(body.supabase.connected).toBe(true);
  });

  it('3. Unreachable database: returns degraded status, unreachable checks, and unavailable migration', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            abortSignal: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'timeout' } }),
          }),
        }),
      }),
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'unreachable' },
                }),
              }),
            }),
          }),
        }),
      }),
    };

    mockCreateClient.mockReturnValue(mockClient);
    mockGetAdminClient.mockReturnValue(mockClient);

    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('unreachable');
    expect(body.checks.supabase).toBe('unreachable');
    expect(body.databaseMigrationStatus).toBe('unavailable');
    expect(body.supabase.connected).toBe(false);
  });

  it('4. Migration lookup failure: never falls back to hardcoded string and reports unavailable', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            abortSignal: vi
              .fn()
              .mockResolvedValue({ data: [{ id: 'prof-1' }], error: null }),
          }),
        }),
      }),
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                abortSignal: vi
                  .fn()
                  .mockRejectedValue(
                    new Error('schema supabase_migrations not found')
                  ),
              }),
            }),
          }),
        }),
      }),
    };

    mockCreateClient.mockReturnValue(mockClient);

    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await getHealth(req);
    const body = await res.json();

    expect(body.checks.database).toBe('healthy');
    expect(body.checks.migrationVersion).toBeNull();
    expect(body.databaseMigrationStatus).toBe('unavailable');
    expect(body.databaseMigrationStatus).not.toBe('verified');
  });

  it('5. Readiness failure (/api/health/ready): returns non-2xx (HTTP 503) when database is unreachable', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'connection refused' },
            }),
          }),
        }),
      }),
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'unreachable' },
                }),
              }),
            }),
          }),
        }),
      }),
    };

    mockCreateClient.mockReturnValue(mockClient);
    mockGetAdminClient.mockReturnValue(mockClient);

    const req = new NextRequest('http://localhost:3000/api/health/ready');
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.ready).toBe(false);
    expect(body.checks.database).toBe('unreachable');
  });

  it('6. Readiness success (/api/health/ready): returns HTTP 200 when database is healthy', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            abortSignal: vi
              .fn()
              .mockResolvedValue({ data: [{ id: 'prof-1' }], error: null }),
          }),
        }),
      }),
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockResolvedValue({
                  data: [{ version: '20260814000000' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    mockCreateClient.mockReturnValue(mockClient);

    const req = new NextRequest('http://localhost:3000/api/health/ready');
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.ready).toBe(true);
    expect(body.checks.database).toBe('healthy');
  });

  it('7. Mock CI environment: returns verified status when CI is active', async () => {
    process.env.CI = 'true';

    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await getHealth(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('healthy');
    expect(body.databaseMigrationStatus).toBe('verified');
    expect(body.checks.migrationVersion).toBe('20260814000000');
  });

  it('8. Zero credential or sensitive connection data exposure', async () => {
    process.env.CI = 'true';
    process.env.META_APP_SECRET = 'ci-dummy-meta-secret';
    process.env.TWILIO_AUTH_TOKEN = 'ci-dummy-twilio-token';
    process.env.CALENDLY_CLIENT_SECRET = 'ci-dummy-calendly-secret';

    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await getHealth(req);
    const jsonStr = JSON.stringify(await res.json());

    expect(jsonStr).not.toContain('ci-dummy-meta-secret');
    expect(jsonStr).not.toContain('ci-dummy-twilio-token');
    expect(jsonStr).not.toContain('ci-dummy-calendly-secret');
    expect(jsonStr).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
