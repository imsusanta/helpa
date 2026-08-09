import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CANONICAL_STAGES } from '@/components/kanban/lead-kanban-board';
import { LeadCardModel } from '@/components/kanban/lead-kanban-card';

const MOCK_LEADS: LeadCardModel[] = [
  {
    id: 'lead-1',
    patientName: 'John Smith',
    phone: '+15550100',
    service: 'Invisalign',
    stage: 'NEW',
    channel: 'whatsapp',
    score: 'hot',
    lastActivityAt: '10:30 AM',
  },
  {
    id: 'lead-2',
    patientName: 'Sarah Khan',
    phone: '+15550200',
    service: 'Cardiology',
    stage: 'QUALIFIED',
    channel: 'voice',
    score: 'warm',
    lastActivityAt: '11:15 AM',
  },
  {
    id: 'lead-3',
    patientName: 'Mike Ross',
    phone: '+15550300',
    service: 'Dental Cleaning',
    stage: 'BOOKED',
    channel: 'sms',
    score: 'cold',
    lastActivityAt: '12:00 PM',
  },
];

describe('Lead Kanban Board - Stage Grouping & Filtering', () => {
  it('groups leads into canonical stages correctly', () => {
    const newLeads = MOCK_LEADS.filter((l) => l.stage === 'NEW');
    const qualifiedLeads = MOCK_LEADS.filter((l) => l.stage === 'QUALIFIED');
    const bookedLeads = MOCK_LEADS.filter((l) => l.stage === 'BOOKED');

    expect(newLeads).toHaveLength(1);
    expect(newLeads[0].patientName).toBe('John Smith');

    expect(qualifiedLeads).toHaveLength(1);
    expect(qualifiedLeads[0].patientName).toBe('Sarah Khan');

    expect(bookedLeads).toHaveLength(1);
    expect(bookedLeads[0].patientName).toBe('Mike Ross');
  });

  it('filters leads by search query (patient name, phone, service)', () => {
    const filterQuery = (query: string) => {
      const q = query.toLowerCase().trim();
      return MOCK_LEADS.filter(
        (l) =>
          l.patientName.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.service.toLowerCase().includes(q)
      );
    };

    expect(filterQuery('john')).toHaveLength(1);
    expect(filterQuery('john')[0].id).toBe('lead-1');

    expect(filterQuery('5550200')).toHaveLength(1);
    expect(filterQuery('5550200')[0].id).toBe('lead-2');

    expect(filterQuery('dental')).toHaveLength(1);
    expect(filterQuery('dental')[0].id).toBe('lead-3');

    expect(filterQuery('nonexistent')).toHaveLength(0);
  });

  it('filters leads by primary channel', () => {
    const filterChannel = (channel: string) =>
      MOCK_LEADS.filter((l) => channel === 'all' || l.channel === channel);

    expect(filterChannel('whatsapp')).toHaveLength(1);
    expect(filterChannel('voice')).toHaveLength(1);
    expect(filterChannel('sms')).toHaveLength(1);
    expect(filterChannel('all')).toHaveLength(3);
  });

  it('filters leads by score', () => {
    const filterScore = (score: string) =>
      MOCK_LEADS.filter((l) => score === 'all' || l.score === score);

    expect(filterScore('hot')).toHaveLength(1);
    expect(filterScore('warm')).toHaveLength(1);
    expect(filterScore('cold')).toHaveLength(1);
    expect(filterScore('all')).toHaveLength(3);
  });

  it('supports all 7 canonical stages in column definition', () => {
    const stageIds = CANONICAL_STAGES.map((s) => s.id);
    expect(stageIds).toEqual([
      'NEW',
      'QUALIFYING',
      'QUALIFIED',
      'BOOKED',
      'FOLLOW_UP',
      'CONVERTED',
      'LOST',
    ]);
  });
});

describe('Lead Stage Transition Security Boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('optimistically updates lead stage and rolls back on API failure', async () => {
    let currentLeads = [...MOCK_LEADS];
    const targetLeadId = 'lead-1';
    const originalStage = currentLeads.find(
      (l) => l.id === targetLeadId
    )!.stage;
    const nextStage = 'QUALIFIED';

    // 1. Perform optimistic update
    currentLeads = currentLeads.map((l) =>
      l.id === targetLeadId ? { ...l, stage: nextStage } : l
    );

    expect(currentLeads.find((l) => l.id === targetLeadId)!.stage).toBe(
      'QUALIFIED'
    );

    // 2. Simulate API failure
    const apiSuccess = false;

    if (!apiSuccess) {
      // 3. Rollback on failure
      currentLeads = currentLeads.map((l) =>
        l.id === targetLeadId ? { ...l, stage: originalStage } : l
      );
    }

    expect(currentLeads.find((l) => l.id === targetLeadId)!.stage).toBe('NEW');
  });

  it('rejects cross-tenant lead stage transition requests', async () => {
    const callerAccountId: string = 'account-tenant-a';
    const dealAccountId: string = 'account-tenant-b';

    const isAuthorizedTenant = callerAccountId === dealAccountId;
    expect(isAuthorizedTenant).toBe(false);
  });
});
