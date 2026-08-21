import { describe, it, expect } from 'vitest';
import {
  getOrCreateCorrelationId,
  withTraceHeaders,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
} from '@/lib/observability/trace-context';

describe('Correlation ID & Observability Trace Helpers', () => {
  it('extracts correlation ID from x-correlation-id Request header', () => {
    const req = new Request('https://helpa.app/api/whatsapp/webhook', {
      headers: {
        'x-correlation-id': 'cid-custom-12345',
      },
    });

    const cid = getOrCreateCorrelationId(req);
    expect(cid).toBe('cid-custom-12345');
  });

  it('extracts correlation ID from x-request-id fallback header', () => {
    const req = new Request('https://helpa.app/api/whatsapp/webhook', {
      headers: {
        [REQUEST_ID_HEADER]: 'req-id-67890',
      },
    });

    const cid = getOrCreateCorrelationId(req);
    expect(cid).toBe('req-id-67890');
  });

  it('extracts correlation ID from plain object dictionary', () => {
    const headers = {
      'x-correlation-id': 'cid-dict-abc',
    };

    const cid = getOrCreateCorrelationId(headers);
    expect(cid).toBe('cid-dict-abc');
  });

  it('generates a fresh valid UUIDv4 when no header is present', () => {
    const cid = getOrCreateCorrelationId(null);
    expect(cid).toBeDefined();
    expect(typeof cid).toBe('string');
    // Verify standard UUID format 8-4-4-4-12
    expect(cid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('injects trace headers into outbound fetch options with withTraceHeaders', () => {
    const baseHeaders = {
      Authorization: 'Bearer test_token',
      'Content-Type': 'application/json',
    };

    const traced = withTraceHeaders(baseHeaders, 'cid-propagated-999');

    expect(traced[CORRELATION_ID_HEADER]).toBe('cid-propagated-999');
    expect(traced[TRACE_ID_HEADER]).toBe('cid-propagated-999');
    expect(traced['authorization']).toBe('Bearer test_token');
    expect(traced['content-type']).toBe('application/json');
  });

  it('automatically generates UUID in withTraceHeaders when no cid is provided', () => {
    const traced = withTraceHeaders({ 'Content-Type': 'application/json' });
    expect(traced[CORRELATION_ID_HEADER]).toBeDefined();
    expect(traced[CORRELATION_ID_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(traced[TRACE_ID_HEADER]).toBe(traced[CORRELATION_ID_HEADER]);
  });
});
