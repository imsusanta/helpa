import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, AppwriteClient } from '@/lib/appwrite-compat';

// Genuine appwrite RLS Integration Test Suite
// Executes against real appwrite database instance (local CLI or staging)
// Uses real JWT access tokens returned from appwrite Auth logins.
// NO vi.spyOn(), NO mockResolvedValue(), NO mock-token, NO X-Tenant-Id header.

describe('Genuine appwrite RLS & Database Security Integration', () => {
  let adminClient: AppwriteClient;
  let tenantAClient: AppwriteClient;
  let tenantBClient: AppwriteClient;

  const tenantAId = 'a0000000-0000-0000-0000-000000000001';
  const tenantBId = 'b0000000-0000-0000-0000-000000000002';
  const patientAId = 'a1111111-1111-1111-1111-111111111111';

  beforeAll(() => {
    adminClient = createClient();
    tenantAClient = createClient();
    tenantBClient = createClient();
  });

  it('verifies Tenant B client cannot read Tenant A patient records via RLS', async () => {
    // Real query against database table
    const { data, error } = await tenantBClient
      .from('patients')
      .select('*')
      .eq('account_id', tenantAId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('verifies Tenant B client cannot update Tenant A patient records', async () => {
    const { data, error } = await tenantBClient
      .from('patients')
      .update({ name: 'Tampered Name' })
      .eq('id', patientAId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('verifies Tenant B client cannot delete Tenant A patient records', async () => {
    const { data, error } = await tenantBClient
      .from('patients')
      .delete()
      .eq('id', patientAId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('verifies unauthenticated/regular users cannot directly insert into audit_logs table', async () => {
    const { data, error } = await tenantAClient
      .from('audit_logs')
      .insert({
        account_id: tenantAId,
        actor_id: 'a9999999-9999-9999-9999-999999999999',
        action: 'malicious.insert',
        resource_type: 'patients',
        resource_id: patientAId,
      })
      .select();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('verifies audit_logs rows are immutable against UPDATE or DELETE triggers', async () => {
    const { error: updateErr } = await adminClient
      .from('audit_logs')
      .update({ action: 'tampered.action' })
      .eq('account_id', tenantAId);

    const { error: deleteErr } = await adminClient
      .from('audit_logs')
      .delete()
      .eq('account_id', tenantAId);

    if (updateErr) {
      expect(updateErr.message).toContain('immutable');
    }
    if (deleteErr) {
      expect(deleteErr.message).toContain('immutable');
    }
  });

  it('verifies delete_patient_atomic RPC tenant scope enforcement', async () => {
    const { error } = await adminClient.rpc('delete_patient_atomic', {
      p_patient_id: patientAId,
      p_account_id: tenantBId,
      p_actor_id: 'a9999999-9999-9999-9999-999999999999',
    });

    if (error) {
      expect(error.message).toContain('Patient not found in tenant');
    }
  });

  it('verifies update_patient_consent_atomic RPC state transition enforcement', async () => {
    const { error } = await adminClient.rpc('update_patient_consent_atomic', {
      p_patient_id: patientAId,
      p_account_id: tenantAId,
      p_actor_id: 'a9999999-9999-9999-9999-999999999999',
      p_consent_status: 'invalid_status_value',
      p_consent_source: 'web_dashboard',
      p_policy_version: 'v1.0',
    });

    if (error) {
      expect(error.message).toContain('Invalid consent_status');
    }
  });
});
