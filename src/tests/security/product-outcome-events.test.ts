import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260822131500_product_outcome_events.sql'
  ),
  'utf8'
);

describe('product outcome event security contract', () => {
  it('versions events and marks synthetic and test traffic', () => {
    expect(migration).toContain('event_version smallint not null default 1');
    expect(migration).toContain('is_synthetic boolean not null default false');
    expect(migration).toContain(
      'is_test_tenant boolean not null default false'
    );
    expect(migration).toContain(
      'unique (account_id, event_name, event_version, source_id)'
    );
  });

  it('supports every documented north-star metric', () => {
    for (const eventName of [
      'inbound_message_received',
      'first_response_sent',
      'booking_confirmed',
      'automation_eligible',
      'automation_completed',
      'staff_takeover',
      'automation_error',
      'appointment_completed',
      'patient_return_completed',
    ]) {
      expect(migration).toContain(`'${eventName}'`);
    }
  });

  it('keeps raw events server-only and blocks obvious identifiers', () => {
    expect(migration).toContain('force row level security');
    expect(migration).toContain(
      'revoke all on table public.product_outcome_events from public, anon, authenticated'
    );
    expect(migration).toContain(
      'grant select, insert on table public.product_outcome_events to service_role'
    );

    for (const forbiddenKey of [
      'patient_name',
      'patient_id',
      'phone_number',
      'email',
      'message_body',
    ]) {
      expect(migration).toContain(`'${forbiddenKey}'`);
    }
  });

  it('does not embed outcome values or marketing claims', () => {
    expect(migration).not.toMatch(/\b\d+(?:\.\d+)?%\b/);
    expect(migration).not.toMatch(/hipaa|certified|guaranteed/i);
  });
});
