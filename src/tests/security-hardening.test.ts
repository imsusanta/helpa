/**
 * src/tests/security-hardening.test.ts
 *
 * Comprehensive Security Test Suite for Helpa Platform (Phase 13).
 * Verifies:
 * - Critical Test 1: Cross-Tenant Isolation (Tenant A cannot access Tenant B's data under any condition)
 * - Critical Test 2: IDOR Defense (Direct object reference manipulation throws ForbiddenError)
 * - Critical Test 3: Client workspace_id tampering protection
 * - Critical Test 4: Super Admin server-side API boundary enforcement (Normal users blocked)
 * - Critical Test 5: AES-256-GCM credential encryption and authentication tag validation
 * - Critical Test 6: Sensitive credential redaction and phone number masking in logs
 * - Critical Test 7: Sliding-window rate limiting & abuse prevention
 * - Critical Test 8: Security incident logging & alert emissions
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
import {
  checkSuperAdmin,
  isPlatformOwnerEmail,
  PLATFORM_OWNER_EMAIL,
} from '@/lib/auth/admin';
import { ForbiddenError } from '@/lib/auth/account';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
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

  describe('Critical Invariant 1 & 2: Cross-Tenant Isolation & IDOR Defense', () => {
    it('allows resource access when authorized workspace matches resource owner', async () => {
      const isAllowed = await assertTenantOwnership({
        authorizedWorkspaceId: tenantA.id,
        resourceWorkspaceId: tenantA.id,
        resourceType: 'contact',
        resourceId: 'cnt-100',
      });
      expect(isAllowed).toBe(true);
    });

    it('blocks cross-tenant resource access with ForbiddenError (Tenant A accessing Tenant B record)', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('security.incident', eventSpy);

      await expect(
        assertTenantOwnership({
          authorizedWorkspaceId: tenantA.id,
          resourceWorkspaceId: tenantB.id, // Target resource belongs to Tenant B!
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

    it('rejects client workspace_id parameter manipulation', () => {
      // Authenticated as Tenant A, but client sends Tenant B in payload
      expect(() => validateWorkspaceContext(tenantA.id, tenantB.id)).toThrow(
        ForbiddenError
      );

      // Same workspace passes
      expect(validateWorkspaceContext(tenantA.id, tenantA.id)).toBe(tenantA.id);
      expect(validateWorkspaceContext(tenantA.id, undefined)).toBe(tenantA.id);
    });
  });

  describe('Super Admin Server-Side Authorization', () => {
    it('grants Super Admin only to platform owner email and rejects foreign users', async () => {
      expect(isPlatformOwnerEmail(PLATFORM_OWNER_EMAIL)).toBe(true);
      expect(isPlatformOwnerEmail('attacker@evil.com')).toBe(false);

      expect(await checkSuperAdmin(PLATFORM_OWNER_EMAIL)).toBe(true);
      expect(await checkSuperAdmin('user@workspace-alpha.com')).toBe(false);
    });
  });

  describe('Cryptographic Token Security (AES-256-GCM)', () => {
    it('encrypts WhatsApp tokens with authenticated AES-256-GCM containing 16-byte auth tag', () => {
      const secretToken = 'EAABwzLIX1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encrypt(secretToken);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      // GCM format: <iv-hex>:<ciphertext-hex>:<authTag-hex>
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(24); // 12 bytes = 24 hex chars
      expect(parts[2].length).toBe(32); // 16 bytes = 32 hex chars auth tag

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(secretToken);
    });
  });

  describe('Sensitive Data Sanitization & Log Masking', () => {
    it('masks phone numbers in logs (preserves last 4 digits)', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+91******3210');
      expect(maskPhoneNumber('9876543210')).toBe('98****3210');
    });

    it('redacts passwords, API keys, and secrets from log metadata', () => {
      const metadata = {
        action: 'user_login',
        user_email: 'test@helpa.ai',
        password: 'SUPER_SECRET_PASSWORD',
        apiKey: 'sk-openrouter-secret-key-1234',
        nested: {
          access_token: 'meta_access_token_abc',
          role: 'admin',
        },
      };

      const sanitized = sanitizeLogMetadata(metadata) as Record<
        string,
        unknown
      >;
      expect(sanitized.action).toBe('user_login');
      expect(sanitized.user_email).toBe('test@helpa.ai');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');

      const nested = sanitized.nested as Record<string, unknown>;
      expect(nested.access_token).toBe('[REDACTED]');
      expect(nested.role).toBe('admin');
    });
  });

  describe('Rate Limiting & Abuse Prevention', () => {
    it('enforces sliding-window rate limit profiles', () => {
      const testKey = `test_auth_${Date.now()}`;

      // Profile: auth allows 5 requests/min
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(testKey, 'auth');
        expect(res.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const blockedRes = checkRateLimit(testKey, 'auth');
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.resetTimeMs).toBeGreaterThan(0);
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
