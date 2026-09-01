import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260901060000_reliability_observation.sql'
  ),
  'utf8'
);

describe('reliability observation security contract', () => {
  it('keeps new events on the existing server-only table', () => {
    for (const eventName of [
      'outbound_message_sent',
      'message_delivery_failed',
      'webhook_failed',
      'ai_failed',
      'worker_failed',
      'integration_failed',
    ]) {
      expect(migration).toContain(`'${eventName}'`);
    }
  });

  it('protects worker heartbeats with forced RLS and no client grants', () => {
    expect(migration).toContain('force row level security');
    expect(migration).toContain(
      'revoke all on table public.operational_heartbeats from public, anon, authenticated'
    );
    expect(migration).toContain(
      'grant select, insert, update on table public.operational_heartbeats to service_role'
    );
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it('rejects secret and identifier keys in heartbeat details', () => {
    for (const forbidden of [
      'token',
      'secret',
      'password',
      'phone',
      'email',
      'message_body',
    ]) {
      expect(migration).toContain(`'${forbidden}'`);
    }
  });
});
