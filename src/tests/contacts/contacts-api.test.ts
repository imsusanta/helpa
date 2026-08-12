import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireRole, listContactsPage } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listContactsPage: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole,
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock('@/infrastructure/appwrite/repositories/contacts.repository', () => ({
  contactsRepository: { listContactsPage },
}));

import { GET } from '@/app/api/contacts/route';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';

function request(url = 'http://localhost/api/contacts'): NextRequest {
  return new NextRequest(url, { headers: { 'x-request-id': 'req-contacts' } });
}

describe('GET /api/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ accountId: 'tenant-a', role: 'viewer' });
  });

  it('lists only the account derived from server authorization', async () => {
    listContactsPage.mockResolvedValue({
      contacts: [
        {
          $id: 'contact-a',
          accountId: 'tenant-a',
          name: 'Patient A',
          phone: '+15555550100',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
    });

    const response = await GET(
      request(
        'http://localhost/api/contacts?accountId=tenant-b&limit=10&offset=0'
      )
    );
    expect(response.status).toBe(200);
    expect(listContactsPage).toHaveBeenCalledWith('tenant-a', {
      limit: 10,
      offset: 0,
      search: undefined,
    });
    expect((await response.json()).data[0].account_id).toBe('tenant-a');
  });

  it('returns a genuine empty page without creating records', async () => {
    listContactsPage.mockResolvedValue({ contacts: [], total: 0 });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [], total: 0 });
    expect(listContactsPage).toHaveBeenCalledOnce();
  });

  it('returns AUTH_REQUIRED for missing or expired sessions', async () => {
    requireRole.mockRejectedValue(new UnauthorizedError());
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'AUTH_REQUIRED' });
  });

  it('returns ACCOUNT_MEMBERSHIP_REQUIRED for a non-member', async () => {
    requireRole.mockRejectedValue(new ForbiddenError());
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: 'ACCOUNT_MEMBERSHIP_REQUIRED',
    });
  });

  it('fails closed on missing contacts collection or required query index', async () => {
    listContactsPage.mockRejectedValue(new Error('Index not found'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: 'CONTACTS_SCHEMA_MISMATCH',
    });
  });

  it('keeps search and pagination tenant-scoped', async () => {
    listContactsPage.mockResolvedValue({ contacts: [], total: 0 });
    await GET(
      request('http://localhost/api/contacts?search=Ana&limit=25&offset=50')
    );
    expect(listContactsPage).toHaveBeenCalledWith('tenant-a', {
      limit: 25,
      offset: 50,
      search: 'Ana',
    });
  });
});
