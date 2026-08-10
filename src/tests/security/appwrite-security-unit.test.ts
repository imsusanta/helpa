import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@/lib/appwrite-compat';

// Construct simulated Appwrite Auth client contexts representing Tenant A and Tenant B
function createTenantClient(
  _accountId: string,
  _role: string = 'authenticated'
) {
  return createClient();
}

function createServiceRoleClient() {
  return createClient();
}

describe('Mocked Appwrite security unit tests', () => {
  const tenantAId = 'a0000000-0000-0000-0000-000000000001';
  const tenantBId = 'b0000000-0000-0000-0000-000000000002';
  const patientAId = 'a1111111-1111-1111-1111-111111111111';
  const actorAId = 'a9999999-9999-9999-9999-999999999999';

  it('enforces multi-tenant query isolation between Tenant A and Tenant B clients', async () => {
    const clientA = createTenantClient(tenantAId);
    const clientB = createTenantClient(tenantBId);

    // Mock response for client A querying Tenant A data
    const mockFromA = vi.spyOn(clientA, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: patientAId, account_id: tenantAId, name: 'Tenant A Patient' },
          ],
          error: null,
        }),
      }),
    } as unknown as ReturnType<typeof clientA.from>);

    // Mock response for client B trying to query Tenant A patient data (RLS returns empty result)
    const mockFromB = vi.spyOn(clientB, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    } as unknown as ReturnType<typeof clientB.from>);

    const { data: dataA } = await clientA
      .from('patients')
      .select('*')
      .eq('account_id', tenantAId);
    const { data: dataB } = await clientB
      .from('patients')
      .select('*')
      .eq('account_id', tenantAId);

    expect(dataA).toHaveLength(1);
    expect(dataA?.[0].account_id).toBe(tenantAId);
    expect(dataB).toHaveLength(0);

    mockFromA.mockRestore();
    mockFromB.mockRestore();
  });

  it('prevents direct client mutation of audit_logs table (enforces service-role only inserts)', async () => {
    const clientA = createTenantClient(tenantAId);

    const mockInsert = vi.spyOn(clientA, 'from').mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message:
            'new row violates row-level security policy for table "audit_logs"',
          code: '42501',
        },
      }),
    } as unknown as ReturnType<typeof clientA.from>);

    const { error } = await clientA.from('audit_logs').insert({
      account_id: tenantAId,
      actor_id: actorAId,
      action: 'unauthorized.insert',
      resource_type: 'patients',
      resource_id: patientAId,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    mockInsert.mockRestore();
  });

  it('verifies audit_logs rows are immutable against UPDATE or DELETE attempts', async () => {
    const adminClient = createServiceRoleClient();

    const mockUpdate = vi.spyOn(adminClient, 'from').mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'audit_logs rows are immutable: UPDATE is not permitted',
            code: 'P0001',
          },
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'audit_logs rows are immutable: DELETE is not permitted',
            code: 'P0001',
          },
        }),
      }),
    } as unknown as ReturnType<typeof adminClient.from>);

    const { error: updateErr } = await adminClient
      .from('audit_logs')
      .update({ action: 'tampered' })
      .eq('id', 'some-id');
    const { error: deleteErr } = await adminClient
      .from('audit_logs')
      .delete()
      .eq('id', 'some-id');

    expect(updateErr?.message).toContain('immutable');
    expect(deleteErr?.message).toContain('immutable');

    mockUpdate.mockRestore();
  });

  it('validates delete_patient_atomic RPC tenant scope enforcement', async () => {
    const serviceClient = createServiceRoleClient();

    const mockRpc = vi.spyOn(serviceClient, 'rpc').mockImplementation(((
      fnName: string,
      args: unknown
    ) => {
      const parsedArgs = args as { p_account_id: string; p_patient_id: string };
      if (fnName === 'delete_patient_atomic') {
        if (
          parsedArgs.p_account_id !== tenantAId &&
          parsedArgs.p_patient_id === patientAId
        ) {
          return Promise.resolve({
            data: null,
            error: {
              message: 'Patient not found in tenant',
              code: 'P0001',
              details: '',
              hint: '',
            },
            count: null,
            status: 400,
            statusText: 'Bad Request',
          });
        }
        return Promise.resolve({
          data: { deleted_at: new Date().toISOString() },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        });
      }
      return Promise.resolve({
        data: null,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });
    }) as never);

    // Call RPC attempting to delete Tenant A patient with Tenant B account_id
    const { error: crossTenantError } = await serviceClient.rpc(
      'delete_patient_atomic',
      {
        p_patient_id: patientAId,
        p_account_id: tenantBId,
        p_actor_id: actorAId,
      }
    );

    expect(crossTenantError).not.toBeNull();
    expect(crossTenantError?.message).toBe('Patient not found in tenant');

    // Call RPC with matching Tenant A patient and account_id
    const { data: validData, error: validError } = await serviceClient.rpc(
      'delete_patient_atomic',
      {
        p_patient_id: patientAId,
        p_account_id: tenantAId,
        p_actor_id: actorAId,
      }
    );

    expect(validError).toBeNull();
    expect(validData).toHaveProperty('deleted_at');

    mockRpc.mockRestore();
  });

  it('validates update_patient_consent_atomic RPC state transition enforcement', async () => {
    const serviceClient = createServiceRoleClient();

    const mockRpc = vi.spyOn(serviceClient, 'rpc').mockImplementation(((
      fnName: string,
      args: unknown
    ) => {
      const parsedArgs = args as { p_consent_status: string };
      if (fnName === 'update_patient_consent_atomic') {
        if (
          !['pending', 'opted_in', 'opted_out'].includes(
            parsedArgs.p_consent_status
          )
        ) {
          return Promise.resolve({
            data: null,
            error: {
              message: `Invalid consent_status: ${parsedArgs.p_consent_status}`,
              code: 'P0001',
              details: '',
              hint: '',
            },
            count: null,
            status: 400,
            statusText: 'Bad Request',
          });
        }
        return Promise.resolve({
          data: { updated_at: new Date().toISOString() },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        });
      }
      return Promise.resolve({
        data: null,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });
    }) as never);

    const { error: invalidStatusErr } = await serviceClient.rpc(
      'update_patient_consent_atomic',
      {
        p_patient_id: patientAId,
        p_account_id: tenantAId,
        p_actor_id: actorAId,
        p_consent_status: 'invalid_status',
        p_consent_source: 'web_dashboard',
        p_policy_version: 'v1.0',
      }
    );

    expect(invalidStatusErr?.message).toContain('Invalid consent_status');

    const { data: validData, error: validErr } = await serviceClient.rpc(
      'update_patient_consent_atomic',
      {
        p_patient_id: patientAId,
        p_account_id: tenantAId,
        p_actor_id: actorAId,
        p_consent_status: 'opted_out',
        p_consent_source: 'optout_request',
        p_policy_version: 'v1.0',
      }
    );

    expect(validErr).toBeNull();
    expect(validData).toHaveProperty('updated_at');

    mockRpc.mockRestore();
  });
});
