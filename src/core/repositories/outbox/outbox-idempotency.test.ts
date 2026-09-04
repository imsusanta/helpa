/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { generateOutboxIdempotencyKey } from './outbox.interface';
import { SupabaseWhatsAppOutboxRepository } from './supabase-outbox.repository';
import { TenantContextError } from '../tenant-context';

describe('WhatsApp Outbox Idempotency & Repository Isolation', () => {
  it('returns client-provided idempotency key verbatim when supplied', () => {
    const key = generateOutboxIdempotencyKey({
      accountId: 'acc_123',
      conversationId: 'conv_456',
      clientKey: 'custom-client-uuid-789',
    });
    expect(key).toBe('custom-client-uuid-789');
  });

  it('generates a stable deterministic key for identical inputs when clientKey is omitted', () => {
    const key1 = generateOutboxIdempotencyKey({
      accountId: 'acc_123',
      conversationId: 'conv_456',
      messageType: 'text',
      contentText: 'Hello world',
    });

    const key2 = generateOutboxIdempotencyKey({
      accountId: 'acc_123',
      conversationId: 'conv_456',
      messageType: 'text',
      contentText: 'Hello world',
    });

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^outbox_conv_456_[0-9a-f]{16}$/);
  });

  it('generates distinct keys for different tenants or different contents', () => {
    const keyA = generateOutboxIdempotencyKey({
      accountId: 'tenant_a',
      conversationId: 'conv_1',
      contentText: 'Message',
    });
    const keyB = generateOutboxIdempotencyKey({
      accountId: 'tenant_b',
      conversationId: 'conv_1',
      contentText: 'Message',
    });
    const keyC = generateOutboxIdempotencyKey({
      accountId: 'tenant_a',
      conversationId: 'conv_1',
      contentText: 'Different message',
    });

    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  it('fails closed when instantiated with null or invalid tenant context', () => {
    expect(() => {
      new SupabaseWhatsAppOutboxRepository(null as any);
    }).toThrow(TenantContextError);

    expect(() => {
      new SupabaseWhatsAppOutboxRepository({ accountId: '' });
    }).toThrow(TenantContextError);

    expect(() => {
      new SupabaseWhatsAppOutboxRepository({ accountId: '   ' });
    }).toThrow(TenantContextError);
  });
});
