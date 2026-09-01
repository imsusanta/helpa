import { describe, expect, it } from 'vitest';
import { classifyHeartbeat } from '@/lib/ops/heartbeat';

describe('operational heartbeat classification', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');

  it('is unknown without a last-seen timestamp', () => {
    expect(classifyHeartbeat(null, now)).toBe('unknown');
    expect(classifyHeartbeat('not-a-date', now)).toBe('unknown');
  });

  it('is ok when the worker checked in inside the stale window', () => {
    expect(classifyHeartbeat('2026-09-01T11:59:30.000Z', now, 90)).toBe('ok');
  });

  it('is stale when the worker has not checked in', () => {
    expect(classifyHeartbeat('2026-09-01T11:50:00.000Z', now, 90)).toBe(
      'stale'
    );
  });
});
