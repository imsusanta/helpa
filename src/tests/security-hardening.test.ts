/**
 * Security regression suite for tenant isolation, authorization, encryption,
 * logging, rate limiting, and incident recording.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assertTenantOwnership,
  validateWorkspaceContext,
  maskPhoneNumber,
  sanitizeLogMetadata,
  checkRateLimit,
  recordSecurityEvent,
} from '@/core/security';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { ForbiddenError } from '@/lib/auth/account';
import * as appwriteCompat from '@/lib/db/server';
import { coreEvents } from '@/core/events';

describe('Helpa Multi-Tenant Security & Security Hardening', () => {
  const tenantA = {
    id: 'workspace-alpha-01',
    name: 'Alpha Clinic',
    industry: 'Health',
  };
  const tenantB = {
    id: 'workspace-beta-02',
    name: 'Beta Salon',
    industry: 'Salon',
  };

  let mockDatabase: {
    audit_logs: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      audit_logs: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store =
          (mockDatabase as Record<string, Array<Record<string, unknown>>>)[
            table
          ] || [];
        return {
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return Promise.resolve({ data: row, error: null });
          },
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
  });

  describe('Cross-Tenant Isolation & IDOR Defense', () => {
    it('allows resource access when authorized workspace matches resource owner', async () => {
      const isAllowed = await assertTenantOwnership({
        authorizedWorkspaceId: tenantA.id,
        resourceWorkspaceId: tenantA.id,
        resourceType: 'contact',
        resourceId: 'cnt-100',
      });
      expect(isAllowed).toBe(true);
    });

    it('blocks Tenant A from reading Tenant B records', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('security.incident', eventSpy);

      await expect(
        assertTenantOwnership({
          authorizedWorkspaceId: tenantA.id,
          resourceWorkspaceId: tenantB.id,
          resourceType: 'patient_record',
          resourceId: 'pat-999',
        })
      ).rejects.toThrow(ForbiddenError);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'security.incident',
          payload: expect.objectContaining({
            type: 'tenant.cross_access_attempt',
            severity: 'high',
            attemptedWorkspaceId: tenantA.id,
            targetResourceId: 'pat-999',
          }),
        })
      );
    });

    it('rejects client workspace_id manipulation', () => {
      expect(() => validateWorkspaceContext(tenantA.id, tenantB.id)).toThrow(
        ForbiddenError
      );
      expect(validateWorkspaceContext(tenantA.id, tenantA.id)).toBe(tenantA.id);
      expect(validateWorkspaceContext(tenantA.id, undefined)).toBe(tenantA.id);
    });
  });

  describe('Super Admin Server-Side Authorization', () => {
    it('does not grant access from a supplied email address', async () => {
      await expect(checkSuperAdmin('attacker@evil.com')).resolves.toBe(false);
    });
  });

  describe('Cryptographic Token Security (AES-256-GCM)', () => {
    it('encrypts tokens with an authenticated 16-byte GCM tag', () => {
      const secretToken = 'EAABwzLIX1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encrypt(secretToken);
      const parts = encrypted.split(':');

      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(24);
      expect(parts[2].length).toBe(32);
      expect(decrypt(encrypted)).toBe(secretToken);
    });
  });

  describe('Sensitive Data Sanitization & Log Masking', () => {
    it('masks phone numbers while preserving the last four digits', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+91******3210');
      expect(maskPhoneNumber('9876543210')).toBe('98****3210');
    });

    it('redacts passwords, API keys, and secrets from log metadata', () => {
      const sanitized = sanitizeLogMetadata({
        action: 'user_login',
        user_email: 'test@helpa.ai',
        password: 'SUPER_SECRET_PASSWORD',
        apiKey: 'secret-key',
        nested: {
          access_token: 'meta_access_token',
          role: 'admin',
        },
      }) as Record<string, unknown>;

      expect(sanitized.action).toBe('user_login');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect((sanitized.nested as Record<string, unknown>).access_token).toBe(
        '[REDACTED]'
      );
    });
  });

  describe('Rate Limiting & Abuse Prevention', () => {
    it('enforces the auth sliding-window limit', () => {
      const testKey = `test_auth_${Date.now()}`;
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(checkRateLimit(testKey, 'auth').allowed).toBe(true);
      }
      const blocked = checkRateLimit(testKey, 'auth');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  describe('Security Incident Logging', () => {
    it('records security events with severity and timestamp', async () => {
      const event = await recordSecurityEvent({
        type: 'webhook.invalid_signature',
        severity: 'critical',
        attemptedWorkspaceId: tenantA.id,
        metadata: { provider: 'Meta WhatsApp' },
      });

      expect(event.id).toContain('sec-');
      expect(event.type).toBe('webhook.invalid_signature');
      expect(event.severity).toBe('critical');
      expect(mockDatabase.audit_logs.length).toBe(1);
    });
  });
});
