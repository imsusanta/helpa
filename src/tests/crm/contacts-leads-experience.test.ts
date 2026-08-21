import { describe, it, expect } from 'vitest';
import type { Contact } from '@/types';
import type { LeadCardModel } from '@/components/kanban/lead-kanban-card';

describe('Contacts Experience - Filtering & Metrics Logic', () => {
  const mockContacts: Contact[] = [
    {
      id: 'c1',
      account_id: 'acc-1',
      user_id: 'user-1',
      name: 'Rahul Das',
      phone: '+919876543210',
      email: 'rahul@example.com',
      company: 'Tech Corp',
      assigned_user_id: 'user-1',
      metadata: {
        stage: 'QUALIFIED',
        ai_lead_score: 85,
        ai_summary: 'Interested in enterprise package',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c2',
      account_id: 'acc-1',
      user_id: 'user-2',
      name: 'Ananya Sharma',
      phone: '+919876543211',
      email: 'ananya@example.com',
      company: 'Design Studio',
      assigned_user_id: null,
      metadata: {
        stage: 'NEW',
        ai_lead_score: 55,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c3',
      account_id: 'acc-1',
      user_id: 'user-3',
      name: 'Vikram Singh',
      phone: '+919876543212',
      email: 'vikram@example.com',
      assigned_user_id: 'user-2',
      metadata: {
        status: 'customer',
        ai_lead_score: 30,
      },
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ];

  it('calculates contact summary metrics correctly', () => {
    const totalCount = mockContacts.length;
    const myContactsCount = mockContacts.filter(
      (c) => c.assigned_user_id === 'user-1'
    ).length;
    const unassignedCount = mockContacts.filter(
      (c) => !c.assigned_user_id
    ).length;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const newThisWeekCount = mockContacts.filter(
      (c) => c.created_at >= sevenDaysAgo
    ).length;

    expect(totalCount).toBe(3);
    expect(myContactsCount).toBe(1);
    expect(unassignedCount).toBe(1);
    expect(newThisWeekCount).toBe(2);
  });

  it('filters contacts by lead temperature', () => {
    const hotContacts = mockContacts.filter((c) => {
      const score = Number(c.metadata?.ai_lead_score || 0);
      return score >= 70;
    });
    const warmContacts = mockContacts.filter((c) => {
      const score = Number(c.metadata?.ai_lead_score || 0);
      return score >= 40 && score < 70;
    });
    const coldContacts = mockContacts.filter((c) => {
      const score = Number(c.metadata?.ai_lead_score || 0);
      return score < 40;
    });

    expect(hotContacts.length).toBe(1);
    expect(hotContacts[0].name).toBe('Rahul Das');
    expect(warmContacts.length).toBe(1);
    expect(warmContacts[0].name).toBe('Ananya Sharma');
    expect(coldContacts.length).toBe(1);
    expect(coldContacts[0].name).toBe('Vikram Singh');
  });

  it('filters contacts by assignment', () => {
    const assignedToMe = mockContacts.filter(
      (c) => c.assigned_user_id === 'user-1'
    );
    const unassigned = mockContacts.filter((c) => !c.assigned_user_id);

    expect(assignedToMe.length).toBe(1);
    expect(unassigned.length).toBe(1);
  });
});

describe('Leads Experience - Overview Metrics & Attention Issues', () => {
  const mockLeads: LeadCardModel[] = [
    {
      id: 'l1',
      patientName: 'Priya Patel',
      phone: '+919123456780',
      service: 'Cardiology Review',
      stage: 'NEW',
      channel: 'whatsapp',
      score: 'hot',
      assignedOwner: { name: 'Dr. Sarah' },
      lastActivityAt: 'Recent',
    },
    {
      id: 'l2',
      patientName: 'Amit Verma',
      phone: '+919123456781',
      service: 'Dental Cleaning',
      stage: 'FOLLOW_UP',
      channel: 'whatsapp',
      score: 65,
      attentionRequired: true,
      lastActivityAt: '2 hr ago',
    },
    {
      id: 'l3',
      patientName: 'Sneha Rao',
      phone: '+919123456782',
      service: 'General Checkup',
      stage: 'BOOKED',
      channel: 'website',
      score: 30,
      nextAppointmentAt: 'Tomorrow 10:00 AM',
      lastActivityAt: '1 day ago',
    },
  ];

  it('calculates lead summary metrics accurately', () => {
    const totalLeads = mockLeads.length;
    const hotLeads = mockLeads.filter(
      (l) => l.score === 'hot' || (typeof l.score === 'number' && l.score >= 70)
    ).length;
    const newLeads = mockLeads.filter((l) => l.stage === 'NEW').length;
    const needsFollowup = mockLeads.filter(
      (l) => l.stage === 'FOLLOW_UP' || l.attentionRequired
    ).length;

    expect(totalLeads).toBe(3);
    expect(hotLeads).toBe(1);
    expect(newLeads).toBe(1);
    expect(needsFollowup).toBe(1);
  });

  it('calculates Needs Your Attention alerts correctly', () => {
    const hotNoFollowup = mockLeads.filter(
      (l) =>
        (l.score === 'hot' || (typeof l.score === 'number' && l.score >= 70)) &&
        !l.nextAppointmentAt
    ).length;
    const uncontactedNew = mockLeads.filter(
      (l) =>
        l.stage === 'NEW' &&
        (!l.lastActivityAt || l.lastActivityAt === 'Recent')
    ).length;
    const attentionReq = mockLeads.filter((l) => l.attentionRequired).length;

    expect(hotNoFollowup).toBe(1);
    expect(uncontactedNew).toBe(1);
    expect(attentionReq).toBe(1);
  });
});
