import { describe, expect, it } from 'vitest';
import { expandSearchTerms, searchKnowledgeItems } from './search';

const items = [
  {
    category: 'pricing',
    question_title: 'Platinum package fee',
    answer_content: 'Platinum package is ₹1,500.',
  },
  {
    category: 'hours',
    question_title: 'Clinic timings',
    answer_content: 'Open 9am to 8pm.',
  },
  {
    category: 'policy',
    question_title: 'Refund policy',
    answer_content: 'Refunds within 24 hours.',
  },
];

describe('knowledge search', () => {
  it('finds Platinum via card/koto synonyms instead of saying no data', () => {
    const matches = searchKnowledgeItems(items, 'Platinum card কত?');
    expect(matches[0]?.question_title).toBe('Platinum package fee');
    expect(matches[0]?.answer_content).toContain('1,500');
  });

  it('uses conversation context when the latest message is short', () => {
    const matches = searchKnowledgeItems(items, 'koto?', {
      conversationContext: 'I was asking about the Platinum package',
    });
    expect(matches.some((row) => row.question_title.includes('Platinum'))).toBe(
      true
    );
  });

  it('does not treat an unrelated hours article as a price match', () => {
    const matches = searchKnowledgeItems(items, 'Platinum fee');
    expect(matches.map((row) => row.question_title)).not.toContain(
      'Clinic timings'
    );
  });

  it('expands price synonyms', () => {
    const terms = expandSearchTerms('package koto');
    expect(terms).toEqual(expect.arrayContaining(['price', 'fee', 'প্যাকেজ']));
  });
});
