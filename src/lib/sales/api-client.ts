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
  warning?: string;
  requestId?: string;
  [key: string]: unknown;
}

type CustomerApiRow = Record<string, unknown> & {
  dealsCount?: number;
  invoicesCount?: number;
  quotationsCount?: number;
  totalRevenue?: number;
  openDealsValue?: number;
  total_deals?: number;
  total_invoices?: number;
  total_quotations?: number;
  total_paid?: number;
  total_deals_value?: number;
};

function normalizeCustomerRows<T>(path: string, data: T): T {
  if (!path.startsWith('/api/customers') || !Array.isArray(data)) return data;

  return data.map((value) => {
    const row = value as CustomerApiRow;
    return {
      ...row,
      dealsCount: Number(row.dealsCount ?? row.total_deals ?? 0),
      invoicesCount: Number(row.invoicesCount ?? row.total_invoices ?? 0),
      quotationsCount: Number(
        row.quotationsCount ?? row.total_quotations ?? 0
      ),
      totalRevenue: Number(row.totalRevenue ?? row.total_paid ?? 0),
      openDealsValue: Number(
        row.openDealsValue ?? row.total_deals_value ?? 0
      ),
    };
  }) as T;
}

function needsResponseEnvelope(path: string, method?: string): boolean {
  if ((method || 'GET').toUpperCase() !== 'POST') return false;

  return (
    /^\/api\/invoices\/[^/]+\/payments$/.test(path) ||
    /^\/api\/quotations\/[^/]+\/convert-to-invoice$/.test(path)
  );
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

  // Payment recording and quotation conversion callers need both the committed
  // data and the API message/warning. Preserve their successful envelope while
  // keeping the default unwrapped behavior for all other Sales endpoints.
  if (json && needsResponseEnvelope(path, options?.method)) {
    return json as unknown as T;
  }

  if (json && 'data' in json && json.data !== undefined) {
    return normalizeCustomerRows(path, json.data as T);
  }

  return (json as unknown as T) || ({} as T);
}
