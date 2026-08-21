/**
 * src/lib/observability/trace-context.ts
 *
 * Distributed Correlation & Trace ID Helpers.
 * Extracts, generates, and propagates trace contexts across inbound webhooks,
 * outbox message queues, AI providers, and background workers.
 */

import crypto from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Extracts correlation ID from Request or Headers, or generates a fresh cryptographically secure UUIDv4.
 */
export function getOrCreateCorrelationId(
  input?:
    Request | Headers | Record<string, string | string[] | undefined> | null
): string {
  if (!input) {
    return crypto.randomUUID();
  }

  let correlationId: string | null = null;

  if (typeof (input as Request).headers?.get === 'function') {
    const headers = (input as Request).headers;
    correlationId =
      headers.get(CORRELATION_ID_HEADER) ||
      headers.get(REQUEST_ID_HEADER) ||
      headers.get(TRACE_ID_HEADER);
  } else if (typeof (input as Headers).get === 'function') {
    const headers = input as Headers;
    correlationId =
      headers.get(CORRELATION_ID_HEADER) ||
      headers.get(REQUEST_ID_HEADER) ||
      headers.get(TRACE_ID_HEADER);
  } else if (typeof input === 'object') {
    const obj = input as Record<string, string | string[] | undefined>;
    const val =
      obj[CORRELATION_ID_HEADER] ||
      obj[CORRELATION_ID_HEADER.toUpperCase()] ||
      obj[REQUEST_ID_HEADER] ||
      obj[REQUEST_ID_HEADER.toUpperCase()] ||
      obj[TRACE_ID_HEADER] ||
      obj[TRACE_ID_HEADER.toUpperCase()];

    if (Array.isArray(val)) {
      correlationId = val[0] || null;
    } else if (typeof val === 'string') {
      correlationId = val;
    }
  }

  const clean = correlationId?.trim();
  if (clean && clean.length > 0 && clean.length <= 128) {
    return clean;
  }

  return crypto.randomUUID();
}

/**
 * Injects trace and correlation headers into an outbound fetch HeadersInit object.
 */
export function withTraceHeaders(
  headers: HeadersInit = {},
  correlationId?: string
): Record<string, string> {
  const cid = correlationId || crypto.randomUUID();
  const normalized: Record<string, string> = {};

  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      normalized[k.toLowerCase()] = v;
    }
  } else if (typeof (headers as Headers).forEach === 'function') {
    (headers as Headers).forEach((v, k) => {
      normalized[k.toLowerCase()] = v;
    });
  } else if (typeof headers === 'object' && headers !== null) {
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string') {
        normalized[k.toLowerCase()] = v;
      }
    }
  }

  normalized[CORRELATION_ID_HEADER] = cid;
  normalized[TRACE_ID_HEADER] = cid;
  return normalized;
}
