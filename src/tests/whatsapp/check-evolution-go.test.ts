import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EVOLUTION_GO_WRONG_HOST_MESSAGE,
  runEvolutionGoPreflight,
} from '../../../scripts/check-evolution-go.mjs';

const SECRET_KEY = 'super-secret-global-key';

const validEnv = {
  EVOLUTION_GO_BASE_URL: 'https://evolution.test',
  EVOLUTION_GO_GLOBAL_API_KEY: SECRET_KEY,
  EVOLUTION_GO_WEBHOOK_BASE_URL: 'https://helpa.test',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Evolution Go production preflight', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('proves /server/ok is JSON before sending the global API key', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/server/ok')) {
        return jsonResponse({ status: 'ok' });
      }
      return new Response('not found', { status: 404 });
    });

    await expect(
      runEvolutionGoPreflight({ env: validEnv, fetchImpl })
    ).resolves.toEqual({ webhookBaseUrl: 'https://helpa.test' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const healthInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const probeInit = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(healthInit.redirect).toBe('manual');
    expect(new Headers(healthInit.headers).get('apikey')).toBeNull();
    expect(new Headers(probeInit.headers).get('apikey')).toBe(SECRET_KEY);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain(
      '/instance/info/__helpa_preflight__'
    );
  });

  it('rejects a 200 Helpa HTML page and never forwards the API key', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('<!DOCTYPE html><html><body>helpa login</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    );

    await expect(
      runEvolutionGoPreflight({ env: validEnv, fetchImpl })
    ).rejects.toThrow(EVOLUTION_GO_WRONG_HOST_MESSAGE);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://evolution.test/server/ok'
    );
    const headers = new Headers(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).headers
    );
    expect(headers.get('apikey')).toBeNull();
  });

  it('rejects login redirects without sending the API key', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('/login', {
          status: 307,
          headers: { Location: '/login', 'Content-Type': 'text/plain' },
        })
    );

    await expect(
      runEvolutionGoPreflight({ env: validEnv, fetchImpl })
    ).rejects.toThrow(EVOLUTION_GO_WRONG_HOST_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not treat a 404 on a non-Evolution host as a passing API key', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/server/ok')) {
        return new Response('Not Found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    await expect(
      runEvolutionGoPreflight({ env: validEnv, fetchImpl })
    ).rejects.toThrow(/health check failed with HTTP 404/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejected API key after the host is proven', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/server/ok')) {
        return jsonResponse({ status: 'ok' });
      }
      return jsonResponse({ error: 'unauthorized' }, 401);
    });

    await expect(
      runEvolutionGoPreflight({ env: validEnv, fetchImpl })
    ).rejects.toThrow(/API key was rejected/i);
  });
});
