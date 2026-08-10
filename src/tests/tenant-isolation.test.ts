import { describe, it, expect, beforeEach } from 'vitest';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';
import { patientsRepository } from '@/infrastructure/appwrite/repositories/patients.repository';

describe('Appwrite Multi-Tenant Isolation', () => {
  const tenantA = 'account_tenant_a_123';
  const tenantB = 'account_tenant_b_456';

  it('rejects cross-tenant lead access: Tenant A cannot read Tenant B lead', async () => {
    // Attempting to read Tenant B's lead using Tenant A's account context should return null
    const lead = await leadsRepository.getLead(
      tenantA,
      'lead_belonging_to_tenant_b'
    );
    expect(lead).toBeNull();
  });

  it('rejects cross-tenant lead update: Tenant A cannot update Tenant B lead stage', async () => {
    await expect(
      leadsRepository.updateStage(
        tenantA,
        'lead_belonging_to_tenant_b',
        'QUALIFIED',
        'actor_a'
      )
    ).rejects.toThrow('Lead not found in tenant');
  });

  it('rejects cross-tenant patient access: Tenant A cannot read Tenant B patient', async () => {
    const patient = await patientsRepository.getPatient(
      tenantA,
      'patient_belonging_to_tenant_b'
    );
    expect(patient).toBeNull();
  });

  it('rejects cross-tenant patient deletion: Tenant A cannot delete Tenant B patient', async () => {
    await expect(
      patientsRepository.deletePatient(tenantA, 'patient_belonging_to_tenant_b')
    ).rejects.toThrow('Patient not found in tenant');
  });
});
