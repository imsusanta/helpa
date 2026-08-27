import { describe, expect, it } from 'vitest';
import {
  detectionFromInsights,
  heuristicDetection,
  looksLikeBusinessEnquiry,
  looksLikeGreeting,
  validateLeadDetection,
} from './lead-detection.service';

describe('looksLikeGreeting', () => {
  it('treats common greetings as not enough intent', () => {
    expect(looksLikeGreeting('Hi')).toBe(true);
    expect(looksLikeGreeting('hello!')).toBe(true);
    expect(looksLikeGreeting('Good morning')).toBe(true);
    expect(looksLikeGreeting('Namaste')).toBe(true);
  });

  it('does not treat a real enquiry as a greeting', () => {
    expect(looksLikeGreeting('Goa package price?')).toBe(false);
    expect(looksLikeGreeting('I want a dental appointment tomorrow')).toBe(
      false
    );
  });
});

describe('heuristicDetection', () => {
  it('does not create a sales lead for a greeting', () => {
    const result = heuristicDetection('Hi');
    expect(result.is_business_enquiry).toBe(false);
    expect(result.intent).toBe('none');
  });

  it('detects a travel package enquiry', () => {
    const result = heuristicDetection('Goa package price?');
    expect(result.is_business_enquiry).toBe(true);
    expect(result.intent).toMatch(/high|medium/);
  });

  it('detects a clinic booking as high intent', () => {
    const result = heuristicDetection('I want a dental appointment tomorrow');
    expect(result.is_business_enquiry).toBe(true);
    expect(result.intent).toBe('high');
    expect(result.score_numeric).toBeGreaterThanOrEqual(70);
  });
});

describe('validateLeadDetection', () => {
  it('vetoes a greeting even when the model claims a sales signal', () => {
    const result = validateLeadDetection(
      {
        is_business_enquiry: true,
        sales_signal: true,
        lead_confidence: 0.99,
        intent: 'high',
        summary: 'Customer said hi',
      },
      'Hi'
    );
    expect(result.is_business_enquiry).toBe(false);
  });

  it('rejects low-confidence AI flags by falling back to the heuristic', () => {
    const result = validateLeadDetection(
      { is_business_enquiry: true, lead_confidence: 0.1 },
      'Do you have something for next month'
    );
    expect(result.is_business_enquiry).toBe(false);
  });

  it('keeps a keyword enquiry when the model omits sales_signal', () => {
    const result = validateLeadDetection(
      { intent: 'other', lead_score: 'cold' },
      'Goa package price?'
    );
    expect(result.is_business_enquiry).toBe(true);
  });

  it('accepts a genuine enquiry and clamps score/confidence', () => {
    const result = validateLeadDetection(
      {
        is_business_enquiry: true,
        lead_confidence: 1.4,
        intent: 'high',
        service: 'Goa tour package',
        summary: 'Customer wants a Goa tour package',
        score_numeric: 140,
        extracted_lead_info: { interested_service: 'Goa tour package' },
      },
      'Goa package price?'
    );
    expect(result.is_business_enquiry).toBe(true);
    expect(result.lead_confidence).toBeLessThanOrEqual(1);
    expect(result.score_numeric).toBeLessThanOrEqual(100);
    expect(result.service).toBe('Goa tour package');
  });

  it('never invents missing budget or timeline', () => {
    const result = validateLeadDetection(
      {
        is_business_enquiry: true,
        sales_signal: true,
        lead_confidence: 0.9,
        intent: 'medium',
        budget: 'null',
        timeline: null,
      },
      'What is the package price for Goa?'
    );
    expect(result.budget).toBeNull();
    expect(result.timeline).toBeNull();
  });

  it('ignores invalid AI JSON and falls back to the heuristic', () => {
    expect(
      validateLeadDetection('not-json', 'Goa package price?')
        .is_business_enquiry
    ).toBe(true);
    expect(validateLeadDetection(null, 'Hi').is_business_enquiry).toBe(false);
  });
});

describe('detectionFromInsights', () => {
  it('maps receptionist insights onto the validated shape', () => {
    const result = detectionFromInsights(
      {
        salesSignal: true,
        intent: 'sales',
        leadScore: 'hot',
        summary: 'Wants a Goa package',
        interestedService: 'Goa package',
      },
      'Goa package price?'
    );
    expect(result.is_business_enquiry).toBe(true);
    expect(result.service).toBe('Goa package');
    expect(result.score_label).toBe('hot');
  });
});

describe('looksLikeBusinessEnquiry', () => {
  it('requires commercial language, not a short hello', () => {
    expect(looksLikeBusinessEnquiry('ok')).toBe(false);
    expect(looksLikeBusinessEnquiry('Need a quote for 4 travellers')).toBe(
      true
    );
  });
});
