import { describe, expect, it } from 'vitest';
import {
  INFORMATION_POLICY_MARKER,
  applyInformationGuard,
  buildInformationPolicyPrompt,
  classifyQuestion,
  decideInformationResponse,
  detectReplyLanguage,
  formatInformationDecisionForPrompt,
  replyContainsUnverifiedPrice,
  resolveAuthoritativeFacts,
  resolveIndustryPolicyFamily,
  toAnswerMetadata,
  withInformationPolicy,
  type RetrievedFact,
} from './information-policy';

describe('classifyQuestion', () => {
  it('treats owned package price as business, not general', () => {
    expect(
      classifyQuestion('আপনাদের Darjeeling package-এর price কত?', 'travel')
    ).toBe('business');
    expect(classifyQuestion('Platinum card কত?', 'coaching')).toBe('business');
  });

  it('treats destination season tips as general travel knowledge', () => {
    expect(classifyQuestion('Darjeeling যেতে কোন সময় ভালো?', 'travel')).toBe(
      'general'
    );
    expect(classifyQuestion('Best time to visit Darjeeling?', 'travel')).toBe(
      'general'
    );
  });

  it('classifies booking and payment as action', () => {
    expect(classifyQuestion('Please book this package', 'travel')).toBe(
      'action'
    );
    expect(classifyQuestion('My payment failed', 'travel')).toBe('action');
  });

  it('classifies a customer record lookup separately', () => {
    expect(classifyQuestion('What is my booking status?', 'travel')).toBe(
      'customer'
    );
  });

  it('classifies hospital and coaching business facts', () => {
    expect(classifyQuestion('Dr. Roy er fee koto?', 'health')).toBe('business');
    expect(classifyQuestion('NEET batch timing koto?', 'coaching')).toBe(
      'business'
    );
  });
});

describe('source-of-truth conflict resolution', () => {
  it('prefers real-time DB over knowledge base over configuration', () => {
    const facts = resolveAuthoritativeFacts({
      knowledgeBaseFacts: [
        {
          key: 'darjeeling.price',
          value: '10000',
          source: 'knowledge_base',
          entity: 'Darjeeling',
          field: 'price',
        },
      ],
      databaseFacts: [
        {
          key: 'darjeeling.price',
          value: '12000',
          source: 'database',
          entity: 'Darjeeling',
          field: 'price',
        },
      ],
      configurationFacts: [
        {
          key: 'darjeeling.price',
          value: '9000',
          source: 'configuration',
          entity: 'Darjeeling',
          field: 'price',
        },
      ],
    });
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toBe('12000');
    expect(facts[0].source).toBe('database');
  });

  it('does not let conversation override a database price', () => {
    const facts = resolveAuthoritativeFacts({
      databaseFacts: [
        {
          key: 'platinum.price',
          value: '1500',
          source: 'database',
          entity: 'Platinum',
          field: 'price',
        },
      ],
      conversationFacts: [
        {
          key: 'platinum.price',
          value: '999',
          source: 'conversation',
          entity: 'Platinum card',
          field: 'price',
        },
      ],
    });
    expect(facts[0].value).toBe('1500');
  });
});

describe('decideInformationResponse', () => {
  it('P0: never hallucinates a missing package price', () => {
    const decision = decideInformationResponse({
      message: 'আপনাদের Darjeeling package কত?',
      industry: 'travel',
      evidence: { missingRequestedField: true },
    });
    expect(decision.outcome).toBe('safe_fallback');
    expect(decision.handoffRequired).toBe(true);
    expect(decision.allowGeneralKnowledge).toBe(false);
    expect(decision.fallbackMessage).toMatch(/verifiedভাবে available নেই/);
    expect(decision.fallbackMessage).not.toMatch(/\d{3,}/);
  });

  it('P0: answers an exact verified fact directly without a disclaimer', () => {
    const decision = decideInformationResponse({
      message: 'Platinum card কত?',
      industry: 'coaching',
      evidence: {
        databaseFacts: [
          {
            key: 'platinum.price',
            value: '₹1,500',
            source: 'database',
            entity: 'Platinum',
            field: 'price',
          },
        ],
      },
    });
    expect(decision.outcome).toBe('direct_answer');
    expect(decision.answerSource).toBe('database');
    expect(decision.answerConfidence).toBe('high');
    expect(decision.handoffRequired).toBe(false);
    expect(decision.fallbackMessage).toBeUndefined();
  });

  it('P0: treats retrieval failure as system error, not no-data', () => {
    const decision = decideInformationResponse({
      message: 'Kashmir package ache?',
      industry: 'travel',
      evidence: { retrievalFailed: true, retrievalErrorSource: 'database' },
    });
    expect(decision.outcome).toBe('system_error');
    expect(decision.handoffRequired).toBe(true);
    expect(decision.fallbackMessage).toMatch(/cannot verify|verify করতে পারছি না/i);
    expect(decision.fallbackMessage).not.toMatch(/available নেই/);
  });

  it('P0: uses the travel no-match fallback when nothing similar exists', () => {
    const decision = decideInformationResponse({
      message: 'Andaman luxury yacht package ache?',
      industry: 'travel',
      evidence: {},
    });
    expect(decision.outcome).toBe('safe_fallback');
    expect(decision.fallbackMessage).toMatch(/matching package/);
    expect(decision.fallbackMessage).toMatch(/custom option/);
    expect(decision.handoffRequired).toBe(true);
  });

  it('P1: asks clarification when the package ask is ambiguous', () => {
    const decision = decideInformationResponse({
      message: 'Darjeeling package',
      industry: 'travel',
      evidence: {
        databaseFacts: [
          {
            key: 'darjeeling.package',
            value: 'Darjeeling Delight, ₹18,000',
            source: 'database',
            entity: 'Darjeeling',
            field: 'details',
          },
        ],
      },
    });
    expect(decision.outcome).toBe('clarification');
    expect(decision.clarificationPrompt).toMatch(/price/);
    expect(decision.clarificationPrompt).toMatch(/details/);
  });

  it('P1: suggests only verified similar packages', () => {
    const decision = decideInformationResponse({
      message: '₹15,000-এর মধ্যে Darjeeling package আছে?',
      industry: 'travel',
      evidence: {
        similarSuggestions: [
          { label: 'Sikkim Escape', destination: 'Sikkim', price: '₹14,500' },
          { label: 'Dooars Weekend', destination: 'Dooars', price: '₹13,000' },
        ],
      },
    });
    expect(decision.outcome).toBe('similar_suggestion');
    expect(decision.answerSource).toBe('database');
    expect(decision.fallbackMessage).toMatch(/Sikkim/);
    expect(decision.fallbackMessage).toMatch(/Dooars/);
    expect(decision.fallbackMessage).not.toMatch(/Darjeeling Delight/);
  });

  it('allows general knowledge for a non-business travel question', () => {
    const decision = decideInformationResponse({
      message: 'Darjeeling যেতে কোন সময় ভালো?',
      industry: 'travel',
      evidence: {},
    });
    expect(decision.outcome).toBe('general_knowledge');
    expect(decision.allowGeneralKnowledge).toBe(true);
    expect(decision.handoffRequired).toBe(false);
  });

  it('sets handoff for complaint, payment issue, and explicit human request', () => {
    expect(
      decideInformationResponse({
        message: 'I want to complain about the trip',
        industry: 'travel',
      }).handoffRequired
    ).toBe(true);
    expect(
      decideInformationResponse({
        message: 'My payment failed yesterday',
        industry: 'travel',
      }).handoffRequired
    ).toBe(true);
    expect(
      decideInformationResponse({
        message: 'Please speak to a human',
        industry: 'generic',
      }).handoffRequired
    ).toBe(true);
  });

  it('uses hospital and coaching industry fallbacks', () => {
    const hospital = decideInformationResponse({
      message: 'Dr. Roy consultation fee koto?',
      industry: 'health',
      evidence: {},
    });
    expect(hospital.industryFamily).toBe('hospital');
    expect(hospital.fallbackMessage).toMatch(/doctor|fee|timing/i);

    const coaching = decideInformationResponse({
      message: 'JEE course fee koto?',
      industry: 'coaching',
      evidence: {},
    });
    expect(coaching.industryFamily).toBe('coaching');
    expect(coaching.fallbackMessage).toMatch(/course|fee|batch/i);
  });
});

describe('applyInformationGuard', () => {
  it('replaces a hallucinated business price with the safe fallback', () => {
    const decision = decideInformationResponse({
      message: 'আপনাদের hotel rate কত?',
      industry: 'travel',
      evidence: {},
    });
    const guarded = applyInformationGuard(
      'আমাদের hotel ₹2,000 থেকে পাওয়া যায়।',
      decision
    );
    expect(guarded).toBe(decision.fallbackMessage);
    expect(guarded).not.toContain('2,000');
  });

  it('does not describe a system error as missing information', () => {
    const decision = decideInformationResponse({
      message: 'Platinum card কত?',
      industry: 'coaching',
      evidence: { retrievalFailed: true },
    });
    const guarded = applyInformationGuard(
      'এই information available নেই।',
      decision
    );
    expect(guarded).toBe(decision.fallbackMessage);
    expect(guarded).not.toMatch(/available নেই/);
  });

  it('leaves a direct verified answer unchanged', () => {
    const facts: RetrievedFact[] = [
      {
        key: 'platinum.price',
        value: '₹1,500',
        source: 'database',
        entity: 'Platinum',
        field: 'price',
      },
    ];
    const decision = decideInformationResponse({
      message: 'Platinum card কত?',
      industry: 'coaching',
      evidence: { databaseFacts: facts },
    });
    expect(
      applyInformationGuard('Platinum card ₹1,500।', decision)
    ).toBe('Platinum card ₹1,500।');
  });

  it('detects unverified amounts in a reply', () => {
    expect(
      replyContainsUnverifiedPrice('Our hotel starts from ₹2000', [])
    ).toBe(true);
    expect(
      replyContainsUnverifiedPrice('Platinum is ₹1,500', [
        {
          key: 'platinum.price',
          value: '₹1,500',
          source: 'database',
          field: 'price',
        },
      ])
    ).toBe(false);
  });
});

describe('prompt + metadata', () => {
  it('injects the policy once', () => {
    const first = withInformationPolicy('You are Helpa.', 'travel');
    const second = withInformationPolicy(first, 'travel');
    expect(first).toContain(INFORMATION_POLICY_MARKER);
    expect(first).toContain('Real-time database');
    expect(second).toBe(first);
  });

  it('hides internal metadata from the customer-facing policy text', () => {
    const prompt = buildInformationPolicyPrompt('travel');
    expect(prompt).toContain('Never show answer_source');
    expect(prompt).toContain('tour packages');
  });

  it('serializes a decision for the model without leaking it as customer copy', () => {
    const decision = decideInformationResponse({
      message: 'Platinum card কত?',
      industry: 'coaching',
      evidence: {
        databaseFacts: [
          {
            key: 'platinum.price',
            value: '₹1,500',
            source: 'database',
            entity: 'Platinum',
            field: 'price',
          },
        ],
      },
    });
    const block = formatInformationDecisionForPrompt(decision);
    expect(block).toContain('outcome: direct_answer');
    expect(block).toContain('₹1,500');
    expect(block).toContain('No disclaimer');
    const meta = toAnswerMetadata(decision);
    expect(meta).toEqual({
      answer_source: 'database',
      answer_confidence: 'high',
      handoff_required: false,
      question_type: 'business',
      outcome: 'direct_answer',
    });
  });

  it('detects Bengali replies and hospital/coaching families', () => {
    expect(detectReplyLanguage('Platinum card কত?')).toBe('bn');
    expect(detectReplyLanguage('How much is Platinum?')).toBe('en');
    expect(resolveIndustryPolicyFamily('health')).toBe('hospital');
    expect(resolveIndustryPolicyFamily('travel')).toBe('travel');
  });
});
