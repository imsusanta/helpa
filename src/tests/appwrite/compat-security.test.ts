import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataClient } from '@/lib/appwrite-compat';

describe('Appwrite Compat Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns APPWRITE_SCHEMA_MISMATCH error when attribute or index is missing without dropping filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Attribute not found: missing_field' }),
      } as unknown as Response)
    );

    const client = createDataClient('test-session', true);
    const result = await client
      .from('contacts')
      .eq('account_id', 'tenant-a')
      .eq('missing_field', 'val');

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('APPWRITE_SCHEMA_MISMATCH');
    expect(result.error?.message).toContain('APPWRITE_SCHEMA_MISMATCH');
  });

  it('fails maybeSingle when multiple documents match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          documents: [
            { $id: 'doc-1', name: 'Doc 1' },
            { $id: 'doc-2', name: 'Doc 2' },
          ],
          total: 2,
        }),
      } as unknown as Response)
    );

    const client = createDataClient('test-session', true);
    const result = await client
      .from('contacts')
      .eq('account_id', 'tenant-a')
      .maybeSingle();

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('PGRST116');
  });
});
