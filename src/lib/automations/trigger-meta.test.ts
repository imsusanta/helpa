import { describe, expect, it } from 'vitest';

import { TRIGGER_META, triggerMeta } from './trigger-meta';
import type { AutomationTriggerType } from '@/types';

const APPOINTMENT_TRIGGERS: AutomationTriggerType[] = [
  'appointment_created',
  'appointment_reminder',
  'appointment_cancelled',
];

describe('trigger metadata', () => {
  it('gives every known trigger a human label and a pill class', () => {
    for (const [key, meta] of Object.entries(TRIGGER_META)) {
      expect(meta.label.trim(), key).not.toBe('');
      // A raw slug leaking into the UI is the bug this map exists to stop.
      expect(meta.label, key).not.toContain('_');
      expect(meta.pillClass.trim(), key).not.toBe('');
    }
  });

  it('labels the appointment lifecycle triggers', () => {
    for (const trigger of APPOINTMENT_TRIGGERS) {
      expect(TRIGGER_META[trigger], trigger).toBeDefined();
      expect(triggerMeta(trigger).label, trigger).not.toContain('_');
    }
  });

  it('humanises trigger strings it has never seen', () => {
    // trigger_type is an unconstrained text column, and the industry
    // workflow packs seed their own strings.
    expect(triggerMeta('some_future_trigger').label).toBe(
      'Some Future Trigger'
    );
  });

  it('does not blow up on a missing trigger type', () => {
    expect(triggerMeta(null).label).toBe('Unknown Trigger');
    expect(triggerMeta(undefined).label).toBe('Unknown Trigger');
    expect(triggerMeta('').label).toBe('Unknown Trigger');
  });
});
