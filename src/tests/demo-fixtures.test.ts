import { describe, expect, it } from 'vitest';
import {
  assertSafeDemoEnvironment,
  buildDemoRows,
  DEMO_IDS,
  DEMO_SEED_MARKER,
} from '../../scripts/demo-fixtures';
import { inspectDemoPatientJourney } from '@/lib/demo/patient-journey';

const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DEMO_MODE: 'true',
  DEMO_ENVIRONMENT: 'local',
  DEMO_ACCOUNT_ID: '00000000-0000-4000-8000-000000000001',
  DEMO_USER_ID: '00000000-0000-4000-8000-000000000002',
  DEMO_CONFIRM_ACCOUNT_ID: '00000000-0000-4000-8000-000000000001',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'local-test-key',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  DEMO_REFERENCE_DATE: '2026-08-24',
};

describe('product demo harness', () => {
  it('requires explicit demo mode and account confirmation', () => {
    expect(() =>
      assertSafeDemoEnvironment({ ...baseEnvironment, DEMO_MODE: 'false' })
    ).toThrow(/DEMO_MODE=true/);
    expect(() =>
      assertSafeDemoEnvironment({
        ...baseEnvironment,
        DEMO_CONFIRM_ACCOUNT_ID: '00000000-0000-4000-8000-000000000099',
      })
    ).toThrow(/must exactly match/);
  });

  it('rejects the production application', () => {
    expect(() =>
      assertSafeDemoEnvironment({
        ...baseEnvironment,
        NEXT_PUBLIC_SITE_URL: 'https://www.helpa.studio',
      })
    ).toThrow(/production application/);
  });

  it('builds stable, synthetic clinic fixtures', () => {
    const configuration = assertSafeDemoEnvironment(baseEnvironment);
    const rows = buildDemoRows(configuration);

    expect(rows.contacts).toHaveLength(3);
    expect(rows.doctors).toHaveLength(2);
    expect(rows.conversations).toHaveLength(3);
    expect(rows.messages).toHaveLength(9);
    expect(rows.appointments).toHaveLength(1);
    expect(rows.contacts[0].id).toBe(DEMO_IDS.contacts[0]);
    expect(rows.contacts[0].metadata).toMatchObject({
      demo_seed: DEMO_SEED_MARKER,
      is_synthetic: true,
    });
    expect(rows.appointments[0].appointment_date).toBe('2026-08-25');
    expect(rows.appointments[0].notes).toContain(DEMO_SEED_MARKER);
  });

  it('covers the seeded patient-journey steps with fictional data only', () => {
    const configuration = assertSafeDemoEnvironment(baseEnvironment);
    const checks = inspectDemoPatientJourney(
      buildDemoRows(configuration),
      configuration.environment
    );

    expect(checks.every((check) => check.fictionalOnly)).toBe(true);
    expect(
      checks
        .filter((check) =>
          [
            'whatsapp_inbound',
            'ai_intent_and_availability',
            'slot_selected',
            'appointment_confirmed',
            'staff_inbox_view',
            'staff_takeover',
            'conversation_history',
          ].includes(check.step)
        )
        .every((check) => check.coverage === 'seeded')
    ).toBe(true);
    expect(checks.find((check) => check.step === 'reminder')?.coverage).toBe(
      'ui_only'
    );
  });
});
