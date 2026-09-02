import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireRole, createBucket, getPublicUrl, createSignedUrl } = vi.hoisted(
  () => ({
    requireRole: vi.fn(),
    createBucket: vi.fn(),
    getPublicUrl: vi.fn(),
    createSignedUrl: vi.fn(),
  })
);

vi.mock('@/lib/auth/account', () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
  toErrorResponse: (err: { status?: number; message?: string }) =>
    new Response(JSON.stringify({ error: err.message || 'error' }), {
      status: err.status || 500,
    }),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({
    storage: {
      listBuckets: vi.fn().mockResolvedValue({ data: [] }),
      createBucket,
      from: () => ({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'account-tenant-a/file.pdf' },
          error: null,
        }),
        getPublicUrl,
        createSignedUrl,
      }),
    },
  }),
}));

import { POST } from '@/app/api/upload/route';

function uploadRequest(bucket: string) {
  const form = new FormData();
  form.append(
    'file',
    new File(['pdf-bytes'], 'report.pdf', { type: 'application/pdf' })
  );
  form.append('bucket', bucket);
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: form,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'tenant-a',
      userId: 'user-1',
      role: 'viewer',
    });
    getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://public.example/chat.png' },
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/report.pdf' },
    });
  });

  it('creates medical-records as a private bucket and returns a signed URL', async () => {
    const res = await POST(uploadRequest('medical-records'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(createBucket).toHaveBeenCalledWith(
      'medical-records',
      expect.objectContaining({ public: false })
    );
    expect(createSignedUrl).toHaveBeenCalled();
    expect(json.data.publicUrl).toBe('https://signed.example/report.pdf');
  });

  it('keeps chat-media public so WhatsApp can fetch media', async () => {
    const res = await POST(uploadRequest('chat-media'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(createBucket).toHaveBeenCalledWith(
      'chat-media',
      expect.objectContaining({ public: true })
    );
    expect(json.data.publicUrl).toBe('https://public.example/chat.png');
  });
});
