import { describe, expect, it } from 'vitest';
import {
  buildIndustryAiContext,
  formatAppointments,
  formatBranches,
  formatCoachingStudents,
  formatDoctors,
  formatLabReports,
  formatLastCampaign,
  formatRegisteredPatients,
} from './ai-context';
import type { AdminClient } from '@/lib/db/server';

describe('formatDoctors', () => {
  it('renders fee, days, and hours with a normalized Dr. prefix', () => {
    const out = formatDoctors([
      {
        name: 'Dr. Asha Rao',
        department: 'Cardiology',
        specialization: 'Interventional',
        consultation_fee: 800,
        available_days: ['Mon', 'Wed'],
        working_hours: { start: '10:00', end: '14:00' },
      },
    ]);
    expect(out).toContain('Dr. Asha Rao (Cardiology - Interventional)');
    expect(out).not.toContain('Dr. Dr.');
    expect(out).toContain('Fee: ₹800');
    expect(out).toContain('Mon, Wed');
    expect(out).toContain('10:00 to 14:00');
  });

  it('returns empty string for no doctors', () => {
    expect(formatDoctors([])).toBe('');
  });
});

describe('formatRegisteredPatients', () => {
  it('handles PostgREST to-one joins as object or array', () => {
    const asObject = formatRegisteredPatients([
      {
        contact: { name: 'Ravi', phone: '+919876543210' },
        patient_seq_id: 'PAT-1',
        gender: 'Male',
      },
    ]);
    const asArray = formatRegisteredPatients([
      {
        contact: [{ name: 'Ravi', phone: '+919876543210' }],
        patient_seq_id: 'PAT-1',
        gender: 'Male',
      },
    ]);
    for (const out of [asObject, asArray]) {
      expect(out).toContain('Name: Ravi');
      expect(out).toContain('Patient ID: PAT-1');
      expect(out).toContain('+919876543210');
    }
  });
});

describe('formatCoachingStudents', () => {
  it('uses the industry entity label and student metadata', () => {
    const out = formatCoachingStudents(
      [{ name: 'Priya', metadata: { student_id: 'STU-7' } }],
      'Student'
    );
    expect(out).toContain('Registered Students under this WhatsApp');
    expect(out).toContain('Student ID: STU-7');
  });
});

describe('formatAppointments / formatBranches / formatLabReports / formatLastCampaign', () => {
  it('renders appointment rows with doctor and token', () => {
    const out = formatAppointments([
      {
        patient: { name: 'Ravi' },
        doctor: { name: 'Dr. Rao' },
        appointment_date: '2026-08-26',
        appointment_time: '10:30',
        status: 'confirmed',
        token_number: 12,
        queue_position: 3,
      },
    ]);
    expect(out).toContain('Patient: Ravi');
    expect(out).toContain('Doctor: Dr. Rao');
    expect(out).toContain('Token: #12');
  });

  it('renders branch and lab-report lines', () => {
    expect(
      formatBranches([{ name: 'Main', address: 'MG Road', phone: '033-1' }])
    ).toContain('Main: MG Road (Phone: 033-1)');

    const reports = formatLabReports([
      {
        id: 'r1',
        test_name: 'CBC',
        status: 'ready',
        report_pdf_url: 'https://example.com/r1.pdf',
      },
    ]);
    expect(reports).toContain('Report Name: CBC');
    expect(reports).toContain('PDF Available: Yes');
  });

  it('renders the last campaign block', () => {
    const out = formatLastCampaign({
      id: 'camp-1',
      name: 'Flu shots',
      category: 'Seasonal',
    });
    expect(out).toContain('Campaign ID: camp-1');
    expect(out).toContain('Category: Seasonal');
  });
});

describe('buildIndustryAiContext', () => {
  function stubDb(rowsByTable: Record<string, unknown>): AdminClient {
    const from = (table: string) => {
      const result = { data: rowsByTable[table] ?? [], error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (
          resolve: (v: { data: unknown; error: null }) => unknown,
          reject?: (e: unknown) => unknown
        ) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    };
    return { from } as unknown as AdminClient;
  }

  const baseArgs = {
    accountId: 'acc-1',
    contactId: 'cnt-1',
    contactIds: ['cnt-1'],
    allPatientAndContactIds: ['cnt-1'],
    isSoloTeacherEnabled: false,
    entityLabel: 'Contact',
  };

  it('builds hospital context from the roster tables', async () => {
    const db = stubDb({
      hospital_doctors: [
        { name: 'Rao', department: 'Cardiology', consultation_fee: 500 },
      ],
      hospital_branches: [{ name: 'Main', address: 'MG Road' }],
    });
    const ctx = await buildIndustryAiContext(db, {
      ...baseArgs,
      isHospitalEnabled: true,
      isCoachingEnabled: false,
    });
    expect(ctx.hospitalContext).toContain('Dr. Rao (Cardiology');
    expect(ctx.hospitalContext).toContain('Main: MG Road');
    expect(ctx.coachingContext).toBe('');
  });

  it('builds coaching context and skips hospital queries when coaching', async () => {
    const db = stubDb({
      contacts: [{ name: 'Priya', metadata: { student_id: 'STU-1' } }],
    });
    const ctx = await buildIndustryAiContext(db, {
      ...baseArgs,
      isHospitalEnabled: false,
      isCoachingEnabled: true,
      entityLabel: 'Student',
    });
    expect(ctx.coachingContext).toContain('Student ID: STU-1');
    expect(ctx.hospitalContext).toBe('');
    expect(ctx.labReports).toBeNull();
  });
});
