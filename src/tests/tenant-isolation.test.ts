import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leadsRepository } from '@/lib/db/repositories';
import { patientsRepository } from '@/lib/db/repositories';
import { contactsRepository } from '@/lib/db/repositories';
import { conversationsRepository } from '@/lib/db/repositories';
import { appointmentsRepository } from '@/lib/db/repositories';
import { callsRepository } from '@/lib/db/repositories';
import { integrationsRepository } from '@/lib/db/repositories';
import { providerEventsRepository } from '@/lib/db/repositories';

type Row = Record<string, unknown>;

const CROSS_TENANT: Record<string, Row> = {
  lead_belonging_to_tenant_b: {
    id: 'lead_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
    name: 'Tenant B Lead',
    stage: 'NEW',
  },
  patient_belonging_to_tenant_b: {
    id: 'patient_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
    name: 'Tenant B Patient',
  },
  contact_belonging_to_tenant_b: {
    id: 'contact_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
    name: 'Tenant B Contact',
  },
  conv_belonging_to_tenant_b: {
    id: 'conv_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
  },
  appt_belonging_to_tenant_b: {
    id: 'appt_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
  },
  call_belonging_to_tenant_b: {
    id: 'call_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
  },
  integration_belonging_to_tenant_b: {
    id: 'integration_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
  },
  event_belonging_to_tenant_b: {
    id: 'event_belonging_to_tenant_b',
    account_id: 'account_tenant_b_456',
  },
};

vi.mock('@/lib/db/server', () => {
  const from = (_table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      limit: () => chain,
      maybeSingle: async () => {
        const id = filters.id as string | undefined;
        const accountId = filters.account_id as string | undefined;
        const row = id ? CROSS_TENANT[id] : null;
        if (!row) return { data: null, error: null };
        if (accountId && row.account_id !== accountId) {
          return { data: null, error: null };
        }
        return { data: row, error: null };
      },
      single: async () => ({ data: null, error: { message: 'not found' } }),
    };
    return chain;
  };
  return { getAdminClient: () => ({ from }) };
});

describe('Supabase multi-tenant isolation', () => {
  const tenantA = 'account_tenant_a_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects cross-tenant lead access', async () => {
    const lead = await leadsRepository.getLead(
      tenantA,
      'lead_belonging_to_tenant_b'
    );
    expect(lead).toBeNull();
  });

  it('rejects cross-tenant lead update', async () => {
    await expect(
      leadsRepository.updateStage(
        tenantA,
        'lead_belonging_to_tenant_b',
        'QUALIFIED',
        'actor_a'
      )
    ).rejects.toThrow('Lead not found in tenant');
  });

  it('rejects cross-tenant patient access', async () => {
    const patient = await patientsRepository.getPatient(
      tenantA,
      'patient_belonging_to_tenant_b'
    );
    expect(patient).toBeNull();
  });

  it('rejects cross-tenant patient deletion', async () => {
    await expect(
      patientsRepository.deletePatient(tenantA, 'patient_belonging_to_tenant_b')
    ).rejects.toThrow('Patient not found in tenant');
  });

  it('rejects cross-tenant contact access', async () => {
    const contact = await contactsRepository.getContact(
      tenantA,
      'contact_belonging_to_tenant_b'
    );
    expect(contact).toBeNull();
  });

  it('rejects cross-tenant conversation access', async () => {
    const conv = await conversationsRepository.getConversation(
      tenantA,
      'conv_belonging_to_tenant_b'
    );
    expect(conv).toBeNull();
  });

  it('rejects cross-tenant appointment access', async () => {
    const appt = await appointmentsRepository.getAppointment(
      tenantA,
      'appt_belonging_to_tenant_b'
    );
    expect(appt).toBeNull();
  });

  it('rejects cross-tenant call access', async () => {
    const call = await callsRepository.getCall(
      tenantA,
      'call_belonging_to_tenant_b'
    );
    expect(call).toBeNull();
  });

  it('rejects cross-tenant integration access', async () => {
    const integration = await integrationsRepository.getIntegration(
      tenantA,
      'integration_belonging_to_tenant_b'
    );
    expect(integration).toBeNull();
  });

  it('rejects cross-tenant provider event access', async () => {
    const event = await providerEventsRepository.getEvent(
      tenantA,
      'event_belonging_to_tenant_b'
    );
    expect(event).toBeNull();
  });
});
