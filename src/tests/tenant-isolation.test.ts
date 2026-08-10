import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';
import { patientsRepository } from '@/infrastructure/appwrite/repositories/patients.repository';

vi.mock('@/infrastructure/appwrite/server', () => {
  const mockDatabases = {
    getDocument: vi
      .fn()
      .mockImplementation(
        async (_dbId: string, collId: string, docId: string) => {
          if (docId === 'lead_belonging_to_tenant_b') {
            return {
              $id: 'lead_belonging_to_tenant_b',
              accountId: 'account_tenant_b_456',
              name: 'Tenant B Lead',
              stage: 'NEW',
            };
          }
          if (docId === 'patient_belonging_to_tenant_b') {
            return {
              $id: 'patient_belonging_to_tenant_b',
              accountId: 'account_tenant_b_456',
              name: 'Tenant B Patient',
            };
          }
          throw new Error('Document not found');
        }
      ),
    listDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    createDocument: vi.fn().mockResolvedValue({ status: 'PENDING' }),
    updateDocument: vi.fn().mockResolvedValue({}),
    deleteDocument: vi.fn().mockResolvedValue({}),
  };

  return {
    getAppwriteAdminClient: () => ({
      databases: mockDatabases,
    }),
  };
});

describe('Appwrite Multi-Tenant Isolation', () => {
  const tenantA = 'account_tenant_a_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects cross-tenant lead access: Tenant A cannot read existing Tenant B lead document', async () => {
    const lead = await leadsRepository.getLead(
      tenantA,
      'lead_belonging_to_tenant_b'
    );
    expect(lead).toBeNull();
  });

  it('rejects cross-tenant lead update: Tenant A cannot update existing Tenant B lead stage', async () => {
    await expect(
      leadsRepository.updateStage(
        tenantA,
        'lead_belonging_to_tenant_b',
        'QUALIFIED',
        'actor_a'
      )
    ).rejects.toThrow('Lead not found in tenant');
  });

  it('rejects cross-tenant patient access: Tenant A cannot read existing Tenant B patient document', async () => {
    const patient = await patientsRepository.getPatient(
      tenantA,
      'patient_belonging_to_tenant_b'
    );
    expect(patient).toBeNull();
  });

  it('rejects cross-tenant patient deletion: Tenant A cannot delete existing Tenant B patient document', async () => {
    await expect(
      patientsRepository.deletePatient(tenantA, 'patient_belonging_to_tenant_b')
    ).rejects.toThrow('Patient not found in tenant');
  });
});
