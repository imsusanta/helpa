import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';
import { patientsRepository } from '@/infrastructure/appwrite/repositories/patients.repository';
import { contactsRepository } from '@/infrastructure/appwrite/repositories/contacts.repository';
import { conversationsRepository } from '@/infrastructure/appwrite/repositories/conversations.repository';
import { appointmentsRepository } from '@/infrastructure/appwrite/repositories/appointments.repository';
import { callsRepository } from '@/infrastructure/appwrite/repositories/calls.repository';
import { integrationsRepository } from '@/infrastructure/appwrite/repositories/integrations.repository';
import { providerEventsRepository } from '@/infrastructure/appwrite/repositories/provider_events.repository';

vi.mock('@/infrastructure/appwrite/server', () => {
  const mockDocs: Record<string, unknown> = {
    lead_belonging_to_tenant_b: {
      $id: 'lead_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
      name: 'Tenant B Lead',
      stage: 'NEW',
    },
    patient_belonging_to_tenant_b: {
      $id: 'patient_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
      name: 'Tenant B Patient',
    },
    contact_belonging_to_tenant_b: {
      $id: 'contact_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
      name: 'Tenant B Contact',
    },
    conv_belonging_to_tenant_b: {
      $id: 'conv_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
      contactId: 'contact_belonging_to_tenant_b',
    },
    appt_belonging_to_tenant_b: {
      $id: 'appt_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
    },
    call_belonging_to_tenant_b: {
      $id: 'call_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
    },
    integration_belonging_to_tenant_b: {
      $id: 'integration_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
    },
    event_belonging_to_tenant_b: {
      $id: 'event_belonging_to_tenant_b',
      accountId: 'account_tenant_b_456',
    },
  };

  const mockDatabases = {
    getDocument: vi
      .fn()
      .mockImplementation(
        async (_dbId: string, _collId: string, docId: string) => {
          if (mockDocs[docId]) return mockDocs[docId];
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

  it('rejects cross-tenant contact access: Tenant A cannot read existing Tenant B contact document', async () => {
    const contact = await contactsRepository.getContact(
      tenantA,
      'contact_belonging_to_tenant_b'
    );
    expect(contact).toBeNull();
  });

  it('rejects cross-tenant conversation access: Tenant A cannot read existing Tenant B conversation document', async () => {
    const conv = await conversationsRepository.getConversation(
      tenantA,
      'conv_belonging_to_tenant_b'
    );
    expect(conv).toBeNull();
  });

  it('rejects cross-tenant appointment access: Tenant A cannot read existing Tenant B appointment document', async () => {
    const appt = await appointmentsRepository.getAppointment(
      tenantA,
      'appt_belonging_to_tenant_b'
    );
    expect(appt).toBeNull();
  });

  it('rejects cross-tenant call access: Tenant A cannot read existing Tenant B call document', async () => {
    const call = await callsRepository.getCall(
      tenantA,
      'call_belonging_to_tenant_b'
    );
    expect(call).toBeNull();
  });

  it('rejects cross-tenant integration access: Tenant A cannot read existing Tenant B integration document', async () => {
    const integration = await integrationsRepository.getIntegration(
      tenantA,
      'integration_belonging_to_tenant_b'
    );
    expect(integration).toBeNull();
  });

  it('rejects cross-tenant provider event access: Tenant A cannot read existing Tenant B provider event document', async () => {
    const event = await providerEventsRepository.getEvent(
      tenantA,
      'event_belonging_to_tenant_b'
    );
    expect(event).toBeNull();
  });
});
