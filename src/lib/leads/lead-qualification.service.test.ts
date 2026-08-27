import { describe, expect, it } from 'vitest';
import {
  buildQualificationSnapshot,
  computeLeadScore,
  qualificationFieldsForIndustry,
} from './lead-qualification.service';
import { heuristicDetection } from './lead-detection.service';

describe('qualificationFieldsForIndustry', () => {
  it('returns travel fields without hardcoding them as the core engine default', () => {
    const travel = qualificationFieldsForIndustry('travel');
    expect(travel.map((f) => f.key)).toEqual(
      expect.arrayContaining(['service', 'timeline', 'travellers', 'budget'])
    );
    const clinic = qualificationFieldsForIndustry('clinic');
    expect(clinic.map((f) => f.key)).toEqual(
      expect.arrayContaining(['service', 'timeline'])
    );
    expect(clinic.some((f) => f.key === 'travellers')).toBe(false);
  });

  it('falls back to general fields for unknown industries', () => {
    const general = qualificationFieldsForIndustry('unknown-industry');
    expect(general.length).toBeGreaterThan(0);
    expect(general[0].key).toBe('service');
  });
});

describe('buildQualificationSnapshot', () => {
  it('keeps unknown values null and asks only for missing fields', () => {
    const snapshot = buildQualificationSnapshot('travel', {
      service: 'Goa package',
      budget: null,
    });
    expect(snapshot.known.service).toBe('Goa package');
    expect(snapshot.known.budget).toBeNull();
    expect(snapshot.known.travellers).toBeNull();
    expect(snapshot.missing.map((f) => f.key)).toContain('travellers');
    expect(snapshot.nextQuestion).toMatch(/travellers|travel dates|budget/i);
  });
});

describe('computeLeadScore', () => {
  it('stays at 0 when this is not an enquiry', () => {
    expect(
      computeLeadScore({
        detection: heuristicDetection('Hi'),
        known: {},
      }).numeric
    ).toBe(0);
  });

  it('scores a high-intent complete enquiry as hot', () => {
    const detection = heuristicDetection(
      'I want a dental appointment tomorrow'
    );
    const scored = computeLeadScore({
      detection,
      known: {
        service: 'Dental',
        timeline: 'tomorrow',
      },
      industry: 'clinic',
      customerEngaged: true,
    });
    expect(scored.numeric).toBeGreaterThanOrEqual(70);
    expect(scored.label).toBe('hot');
  });

  it('does not invent a budget just to raise the score', () => {
    const detection = heuristicDetection('Goa package price?');
    const scored = computeLeadScore({
      detection,
      known: { service: 'Goa package' },
      industry: 'travel',
    });
    expect(scored.numeric).toBeLessThan(100);
  });
});
