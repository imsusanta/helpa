import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from './route';
import {
  GET as GET_ID,
  PATCH as PATCH_ID,
  DELETE as DELETE_ID,
} from './[id]/route';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/account';

// Mock auth
const mockAuth = vi.hoisted(() => ({
  accountId: 'test-account-id',
  userId: 'test-user-id',
  role: 'agent',
  shouldFailAuth: false,
  shouldFailForbidden: false,
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: vi.fn(async (_minRole: string) => {
    if (mockAuth.shouldFailAuth) throw new UnauthorizedError();
    if (mockAuth.shouldFailForbidden)
      throw new ForbiddenError('Permission denied');
    return {
      accountId: mockAuth.accountId,
      userId: mockAuth.userId,
      role: mockAuth.role,
    };
  }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, remaining: 10, reset: 60 })),
  rateLimitResponse: vi.fn(
    () => new Response('Too Many Requests', { status: 429 })
  ),
  RATE_LIMITS: { adminAction: { limit: 100, windowMs: 60000 } },
}));

// Mock package-service
const mockService = vi.hoisted(() => ({
  packages: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/modules/travel/package-service', () => ({
  listPackages: vi.fn(
    async (
      accountId: string,
      options?: { status?: string; destination?: string; search?: string }
    ) => {
      let list = mockService.packages.filter((p) => p.account_id === accountId);
      if (options?.status && options.status !== 'all') {
        list = list.filter((p) => p.status === options.status);
      }
      return { data: list, total: list.length };
    }
  ),
  getPackageWithDetails: vi.fn(async (accountId: string, id: string) => {
    const pkg = mockService.packages.find(
      (p) => p.id === id && p.account_id === accountId
    );
    if (!pkg) return null;
    return {
      ...pkg,
      itinerary: [{ day_number: 1, title: 'Arrival' }],
      departures: [{ start_date: '2026-10-01', departure_price: 15000 }],
    };
  }),
  createPackage: vi.fn(
    async (
      accountId: string,
      userId: string,
      input: Record<string, unknown>
    ) => {
      const newPkg = {
        id: `pkg-${Date.now()}`,
        account_id: accountId,
        created_by: userId,
        status: input.status || 'draft',
        currency: input.currency || 'INR',
        inclusions: input.inclusions || [],
        exclusions: input.exclusions || [],
        ...input,
      };
      mockService.packages.push(newPkg);
      return newPkg;
    }
  ),
  updatePackage: vi.fn(
    async (
      accountId: string,
      id: string,
      userId: string,
      input: Record<string, unknown>
    ) => {
      const idx = mockService.packages.findIndex(
        (p) => p.id === id && p.account_id === accountId
      );
      if (idx === -1) throw new Error('Package not found');
      mockService.packages[idx] = {
        ...mockService.packages[idx],
        ...input,
        updated_by: userId,
      };
      return mockService.packages[idx];
    }
  ),
  publishPackage: vi.fn(async (accountId: string, id: string) => {
    const pkg = mockService.packages.find(
      (p) => p.id === id && p.account_id === accountId
    );
    if (pkg) pkg.status = 'published';
  }),
  archivePackage: vi.fn(async (accountId: string, id: string) => {
    const pkg = mockService.packages.find(
      (p) => p.id === id && p.account_id === accountId
    );
    if (pkg) pkg.status = 'archived';
  }),
  safeDeletePackage: vi.fn(async (accountId: string, id: string) => {
    const idx = mockService.packages.findIndex(
      (p) => p.id === id && p.account_id === accountId
    );
    if (idx !== -1) {
      mockService.packages.splice(idx, 1);
      return { deleted: true, archived: false };
    }
    return { deleted: false, archived: false };
  }),
}));

describe('Tour Packages REST API Routes', () => {
  beforeEach(() => {
    mockAuth.shouldFailAuth = false;
    mockAuth.shouldFailForbidden = false;
    mockService.packages = [];
  });

  describe('GET /api/travel/packages', () => {
    it('returns 401 if unauthenticated', async () => {
      mockAuth.shouldFailAuth = true;
      const req = new NextRequest('http://localhost/api/travel/packages');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('AUTH_REQUIRED');
    });

    it('returns list of packages for the account with requestId', async () => {
      mockService.packages.push({
        id: 'pkg-1',
        account_id: 'test-account-id',
        name: 'Darjeeling Sunrise',
        destination: 'Darjeeling',
        duration_days: 4,
        status: 'published',
      });

      const req = new NextRequest(
        'http://localhost/api/travel/packages?status=published'
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].name).toBe('Darjeeling Sunrise');
      expect(json.requestId).toBeDefined();
    });
  });

  describe('POST /api/travel/packages', () => {
    it('validates required fields and returns 400 on invalid input', async () => {
      const req = new NextRequest('http://localhost/api/travel/packages', {
        method: 'POST',
        body: JSON.stringify({
          // missing name and destination
          duration_days: 0,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });

    it('creates package successfully and returns 201 with created record', async () => {
      const req = new NextRequest('http://localhost/api/travel/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Goa Coastal Escape',
          destination: 'North & South Goa',
          duration_days: 4,
          duration_nights: 3,
          base_price: 16000,
          currency: 'INR',
          price_basis: 'per_person',
          status: 'published',
          inclusions: ['Resort stay', 'Breakfast', 'Airport transfers'],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Goa Coastal Escape');
      expect(json.data.base_price).toBe(16000);
      expect(json.data.account_id).toBe('test-account-id');
    });
  });

  describe('GET /api/travel/packages/[id]', () => {
    it('returns 404 when package does not exist', async () => {
      const req = new NextRequest(
        'http://localhost/api/travel/packages/non-existent'
      );
      const res = await GET_ID(req, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('NOT_FOUND');
    });

    it('returns package with itinerary and departures when found', async () => {
      mockService.packages.push({
        id: 'pkg-detail-1',
        account_id: 'test-account-id',
        name: 'Kashmir Magic',
        destination: 'Srinagar',
        duration_days: 5,
        status: 'published',
      });

      const req = new NextRequest(
        'http://localhost/api/travel/packages/pkg-detail-1'
      );
      const res = await GET_ID(req, {
        params: Promise.resolve({ id: 'pkg-detail-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Kashmir Magic');
      expect(json.data.itinerary.length).toBe(1);
      expect(json.data.departures.length).toBe(1);
    });
  });

  describe('PATCH /api/travel/packages/[id]', () => {
    it('handles lifecycle action "publish"', async () => {
      mockService.packages.push({
        id: 'pkg-patch-1',
        account_id: 'test-account-id',
        name: 'Kerala Serenity',
        status: 'draft',
      });

      const req = new NextRequest(
        'http://localhost/api/travel/packages/pkg-patch-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ action: 'publish' }),
        }
      );

      const res = await PATCH_ID(req, {
        params: Promise.resolve({ id: 'pkg-patch-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('published');
    });

    it('updates package details successfully', async () => {
      mockService.packages.push({
        id: 'pkg-patch-2',
        account_id: 'test-account-id',
        name: 'Old Name',
        destination: 'Goa',
        duration_days: 3,
        base_price: 10000,
      });

      const req = new NextRequest(
        'http://localhost/api/travel/packages/pkg-patch-2',
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: 'Updated Luxury Name',
            base_price: 14500,
          }),
        }
      );

      const res = await PATCH_ID(req, {
        params: Promise.resolve({ id: 'pkg-patch-2' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Updated Luxury Name');
      expect(json.data.base_price).toBe(14500);
    });
  });

  describe('DELETE /api/travel/packages/[id]', () => {
    it('deletes package safely', async () => {
      mockService.packages.push({
        id: 'pkg-delete-1',
        account_id: 'test-account-id',
        name: 'To Be Deleted',
      });

      const req = new NextRequest(
        'http://localhost/api/travel/packages/pkg-delete-1',
        {
          method: 'DELETE',
        }
      );

      const res = await DELETE_ID(req, {
        params: Promise.resolve({ id: 'pkg-delete-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(true);
      expect(mockService.packages.length).toBe(0);
    });
  });

  describe('Role-based Access Control (RBAC)', () => {
    it('rejects viewer role attempting POST /api/travel/packages with 403 Forbidden', async () => {
      mockAuth.shouldFailForbidden = true;
      const req = new NextRequest('http://localhost/api/travel/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Unauthorized Package',
          destination: 'Goa',
          duration_days: 3,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('PERMISSION_REQUIRED');
    });

    it('rejects viewer role attempting PATCH /api/travel/packages/[id] with 403 Forbidden', async () => {
      mockAuth.shouldFailForbidden = true;
      const req = new NextRequest(
        'http://localhost/api/travel/packages/pkg-test',
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Hacked' }),
        }
      );

      const res = await PATCH_ID(req, {
        params: Promise.resolve({ id: 'pkg-test' }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('PERMISSION_REQUIRED');
    });

    it('rejects viewer role attempting DELETE /api/travel/packages/[id] with 403 Forbidden', async () => {
      mockAuth.shouldFailForbidden = true;
      const req = new NextRequest(
        'http://localhost/api/travel/packages/pkg-test',
        {
          method: 'DELETE',
        }
      );

      const res = await DELETE_ID(req, {
        params: Promise.resolve({ id: 'pkg-test' }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('PERMISSION_REQUIRED');
    });
  });
});
