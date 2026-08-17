import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-expect-error WebSocket polyfill for Node 20/22 runtime
  globalThis.WebSocket = WebSocket;
}

// Intercept CI dummy Supabase requests (e.g. example.supabase.co) so unit tests fail-fast or return fallback data without hanging on network timeouts
const originalFetch = globalThis.fetch;
if (originalFetch) {
  const customFetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (
      url.includes('example.supabase.co') ||
      url.includes('ci-test-supabase')
    ) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'content-range': '0-0/0',
        },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  globalThis.fetch = customFetch;
}
