import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, toErrorResponse, UnauthorizedError } from './account';

describe('toErrorResponse', () => {
  it('maps UnauthorizedError to 401 JSON with no-store headers', async () => {
    const response = toErrorResponse(new UnauthorizedError('sign in'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'sign in' });
  });

  it('maps ForbiddenError to 403 JSON', async () => {
    const response = toErrorResponse(new ForbiddenError('nope'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'nope' });
  });

  it('maps unknown errors to a generic 500 without leaking details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = toErrorResponse(new Error('db password xyz'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    });
    spy.mockRestore();
  });
});
