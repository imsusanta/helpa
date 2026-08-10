import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasMinRole, type AccountRole } from '@/lib/auth/roles';
import { generatePdfToken, verifyPdfToken } from '@/lib/pdf-signing';

describe('Security: Multi-Tenancy & Authorization Invariants', () => {
  const ACCOUNT_A_ID = '00000000-0000-0000-0000-00000000000a';
  const _ACCOUNT_B_ID = '00000000-0000-0000-0000-00000000000b';
  const APPT_A_ID = '11111111-1111-1111-1111-111111111111';
  const APPT_B_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Role-Based Access Control Hierarchy', () => {
    it('strictly enforces role ordering: owner > admin > agent > viewer', () => {
      expect(hasMinRole('owner', 'owner')).toBe(true);
      expect(hasMinRole('owner', 'admin')).toBe(true);
      expect(hasMinRole('owner', 'agent')).toBe(true);
      expect(hasMinRole('owner', 'viewer')).toBe(true);

      expect(hasMinRole('admin', 'owner')).toBe(false);
      expect(hasMinRole('admin', 'admin')).toBe(true);
      expect(hasMinRole('admin', 'agent')).toBe(true);
      expect(hasMinRole('admin', 'viewer')).toBe(true);

      expect(hasMinRole('agent', 'owner')).toBe(false);
      expect(hasMinRole('agent', 'admin')).toBe(false);
      expect(hasMinRole('agent', 'agent')).toBe(true);
      expect(hasMinRole('agent', 'viewer')).toBe(true);

      expect(hasMinRole('viewer', 'owner')).toBe(false);
      expect(hasMinRole('viewer', 'admin')).toBe(false);
      expect(hasMinRole('viewer', 'agent')).toBe(false);
      expect(hasMinRole('viewer', 'viewer')).toBe(true);
    });

    it('rejects viewer role from triggering patient mutations or invitations', () => {
      const isMutationAllowed = (role: AccountRole): boolean =>
        hasMinRole(role, 'agent');
      const isInviteAllowed = (role: AccountRole): boolean =>
        hasMinRole(role, 'admin');

      expect(isMutationAllowed('viewer')).toBe(false);
      expect(isMutationAllowed('agent')).toBe(true);
      expect(isInviteAllowed('agent')).toBe(false);
      expect(isInviteAllowed('admin')).toBe(true);
    });
  });

  describe('2. Cryptographic Token Cross-Tenant Isolation', () => {
    it('rejects signed OPD tokens generated for Account A when accessed against Account B appointment', () => {
      const validTokenA = generatePdfToken({
        appointmentId: APPT_A_ID,
        accountId: ACCOUNT_A_ID,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      const verificationB = verifyPdfToken(validTokenA, APPT_B_ID);
      expect(verificationB.valid).toBe(false);
      expect(verificationB.accountId).toBeUndefined();

      const verificationA = verifyPdfToken(validTokenA, APPT_A_ID);
      expect(verificationA.valid).toBe(true);
      expect(verificationA.accountId).toBe(ACCOUNT_A_ID);
    });

    it('rejects expired or tampered signed document tokens', () => {
      const expiredToken = generatePdfToken({
        appointmentId: APPT_A_ID,
        accountId: ACCOUNT_A_ID,
        expiresAt: Math.floor(Date.now() / 1000) - 10,
      });
      const expiredResult = verifyPdfToken(expiredToken, APPT_A_ID);
      expect(expiredResult.valid).toBe(false);

      const validToken = generatePdfToken({
        appointmentId: APPT_A_ID,
        accountId: ACCOUNT_A_ID,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      const tamperedToken =
        validToken.substring(0, validToken.length - 4) + 'abcd';
      const tamperedResult = verifyPdfToken(tamperedToken, APPT_A_ID);
      expect(tamperedResult.valid).toBe(false);
    });
  });
});
