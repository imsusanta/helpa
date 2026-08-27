import { describe, expect, it } from 'vitest';
import { TRIGGER_META } from '@/lib/automations/trigger-meta';
import { validateStepsForActivation } from '@/lib/automations/validate';

describe('lead automation capabilities', () => {
  it('exposes lead lifecycle triggers', () => {
    expect(TRIGGER_META.lead_created.label).toBe('Lead Created');
    expect(TRIGGER_META.lead_qualified.label).toBe('Lead Qualified');
    expect(TRIGGER_META.lead_score_changed.label).toBe('Lead Score Changed');
  });

  it('accepts stop_followup and update_lead steps', () => {
    expect(
      validateStepsForActivation([
        { step_type: 'stop_followup', step_config: {} },
      ])
    ).toEqual([]);
    expect(
      validateStepsForActivation([
        {
          step_type: 'update_lead',
          step_config: { field: 'stage', value: 'QUALIFIED' },
        },
      ])
    ).toEqual([]);
    expect(
      validateStepsForActivation([
        { step_type: 'update_lead', step_config: { field: 'stage' } },
      ]).length
    ).toBeGreaterThan(0);
  });
});
