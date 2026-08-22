/**
 * Unified Sales Domain API Client
 * Provides typed, consistent error handling, correlation IDs, and json body serialization.
 */

export class SalesApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: unknown;

  constructor(
    message: string,
    status = 500,
    code = 'UNKNOWN_ERROR',
    requestId?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'SalesApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export interface SalesApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
  [key: string]: unknown;
}

export async function salesApi<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers || {});

  if (
    options?.body &&
    typeof options.body === 'string' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('x-request-id')) {
    headers.set(
      'x-request-id',
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}`
    );
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  let json: SalesApiResponse<T> | null = null;
  try {
    json = await res.json();
  } catch {
    // If not JSON, handle as text error or generic failure
  }

  const requestId =
    res.headers.get('x-request-id') || (json?.requestId as string | undefined);

  if (!res.ok) {
    const errorCode =
      (json?.error as string) ||
      (json?.message as string) ||
      `HTTP_${res.status}`;
    const errorMessage =
      (json?.message as string) || (json?.error as string) || res.statusText;
    throw new SalesApiError(
      errorMessage,
      res.status,
      errorCode,
      requestId,
      json
    );
  }

  if (json && json.success === false && json.error) {
    throw new SalesApiError(json.error, 400, json.error, requestId, json);
  }

  if (json && 'data' in json && json.data !== undefined) {
    return json.data as T;
  }

  return (json as unknown as T) || ({} as T);
}
