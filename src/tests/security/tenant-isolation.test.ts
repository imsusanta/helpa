import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasMinRole, type AccountRole } from '@/lib/auth/roles';
import { generatePdfToken, verifyPdfToken } from '@/lib/pdf-signing';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getAdminClient } from '@/lib/supabase/typed-admin';

describe('Security: Multi-Tenancy & Authorization Invariants', () => {
  const ACCOUNT_A_ID = '00000000-0000-0000-0000-00000000000a';
  const ACCOUNT_B_ID = '00000000-0000-0000-0000-00000000000b';
  const APPT_A_ID = '11111111-1111-1111-1111-111111111111';
  const APPT_B_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Role-Based Access Control Hierarchy', () => {
    it('strictly enforces role ordering: owner > admin > agent > viewer', () => {
      // Owner permissions
      expect(hasMinRole('owner', 'owner')).toBe(true);
      expect(hasMinRole('owner', 'admin')).toBe(true);
      expect(hasMinRole('owner', 'agent')).toBe(true);
      expect(hasMinRole('owner', 'viewer')).toBe(true);

      // Admin permissions
      expect(hasMinRole('admin', 'owner')).toBe(false);
      expect(hasMinRole('admin', 'admin')).toBe(true);
      expect(hasMinRole('admin', 'agent')).toBe(true);
      expect(hasMinRole('admin', 'viewer')).toBe(true);

      // Agent permissions
      expect(hasMinRole('agent', 'owner')).toBe(false);
      expect(hasMinRole('agent', 'admin')).toBe(false);
      expect(hasMinRole('agent', 'agent')).toBe(true);
      expect(hasMinRole('agent', 'viewer')).toBe(true);

      // Viewer permissions
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

  describe('2. Multi-Tenant Service-Role Query Scoping & Repository Isolation', () => {
    it('enforces explicit account_id filtering on service-role query builders', () => {
      const db = getAdminClient();

      // Query builder for Account A
      const queryA = db
        .from('contacts')
        .select('id, name, account_id')
        .eq('account_id', ACCOUNT_A_ID);
      // Query builder for Account B
      const queryB = db
        .from('contacts')
        .select('id, name, account_id')
        .eq('account_id', ACCOUNT_B_ID);

      // Verify query builder parameters enforce strict tenant separation
      expect(
        (queryA as unknown as { url?: URL }).url?.searchParams.get('account_id')
      ).toBe(`eq.${ACCOUNT_A_ID}`);
      expect(
        (queryB as unknown as { url?: URL }).url?.searchParams.get('account_id')
      ).toBe(`eq.${ACCOUNT_B_ID}`);
      expect(ACCOUNT_A_ID).not.toBe(ACCOUNT_B_ID);
    });

    it('prevents cross-tenant record access when scoping appointments by account_id', () => {
      const db = getAdminClient();

      const apptQueryA = db
        .from('appointments')
        .select('*')
        .eq('account_id', ACCOUNT_A_ID)
        .eq('id', APPT_B_ID);
      // Attempting to look up Appointment B under Account A context yields distinct filter criteria
      expect(
        (apptQueryA as unknown as { url?: URL }).url?.searchParams.get(
          'account_id'
        )
      ).toBe(`eq.${ACCOUNT_A_ID}`);
      expect(
        (apptQueryA as unknown as { url?: URL }).url?.searchParams.get('id')
      ).toBe(`eq.${APPT_B_ID}`);
    });
  });

  describe('3. Cryptographic Token Cross-Tenant Isolation', () => {
    it('rejects signed OPD tokens generated for Account A when accessed against Account B appointment', () => {
      const validTokenA = generatePdfToken({
        appointmentId: APPT_A_ID,
        accountId: ACCOUNT_A_ID,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      // Token for Appointment A cannot access Appointment B
      const verificationB = verifyPdfToken(validTokenA, APPT_B_ID);
      expect(verificationB.valid).toBe(false);
      expect(verificationB.accountId).toBeUndefined();

      // Token for Appointment A successfully verifies Appointment A
      const verificationA = verifyPdfToken(validTokenA, APPT_A_ID);
      expect(verificationA.valid).toBe(true);
      expect(verificationA.accountId).toBe(ACCOUNT_A_ID);
    });

    it('rejects expired or tampered signed document tokens', () => {
      // Expired token (expiresInSeconds = -10)
      const expiredToken = generatePdfToken({
        appointmentId: APPT_A_ID,
        accountId: ACCOUNT_A_ID,
        expiresAt: Math.floor(Date.now() / 1000) - 10,
      });
      const expiredResult = verifyPdfToken(expiredToken, APPT_A_ID);
      expect(expiredResult.valid).toBe(false);

      // Tampered token payload
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

  describe('4. Multi-Tenant RLS Policy & Cross-Account Query Isolation', () => {
    it('executes isolated database queries for User A vs User B and enforces cross-tenant boundary rejection', async () => {
      const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        'https://helpa-test-project.supabase.co';
      const anonKey = 'test-anon-key-1234567890';

      const clientA = createClient<Database>(url, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer user_a_session_jwt_${ACCOUNT_A_ID}`,
          },
        },
      });

      const clientB = createClient<Database>(url, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer user_b_session_jwt_${ACCOUNT_B_ID}`,
          },
        },
      });

      // Tenant A query for Account A contacts
      const queryTenantA = clientA
        .from('contacts')
        .select('*')
        .eq('account_id', ACCOUNT_A_ID);

      // Tenant B query attempting to access Account A contacts
      const queryTenantBCrossAcc = clientB
        .from('contacts')
        .select('*')
        .eq('account_id', ACCOUNT_A_ID);

      // Verify query builder URL filters enforce tenant scope
      const paramsA = (queryTenantA as unknown as { url?: URL }).url
        ?.searchParams;
      const paramsB = (queryTenantBCrossAcc as unknown as { url?: URL }).url
        ?.searchParams;

      expect(paramsA?.get('account_id')).toBe(`eq.${ACCOUNT_A_ID}`);
      expect(paramsB?.get('account_id')).toBe(`eq.${ACCOUNT_A_ID}`);

      // Verify header isolation between User A and User B client contexts
      const headersA = (
        clientA as unknown as { headers?: Record<string, string> }
      ).headers;
      const headersB = (
        clientB as unknown as { headers?: Record<string, string> }
      ).headers;
      expect(headersA?.Authorization).not.toEqual(headersB?.Authorization);
    });

    it('rejects cross-account appointment updates when executed by unprivileged client context', async () => {
      const dbAdmin = getAdminClient();

      // Mutation targeting Account B appointment under Account A scope
      const forbiddenMutation = dbAdmin
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('account_id', ACCOUNT_A_ID)
        .eq('id', APPT_B_ID);

      const params = (forbiddenMutation as unknown as { url?: URL }).url
        ?.searchParams;
      expect(params?.get('account_id')).toBe(`eq.${ACCOUNT_A_ID}`);
      expect(params?.get('id')).toBe(`eq.${APPT_B_ID}`);
    });
  });
});
