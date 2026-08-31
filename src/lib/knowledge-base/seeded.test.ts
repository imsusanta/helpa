import { describe, expect, it } from 'vitest';
import {
  COMPANY_HOURS_TITLE,
  collectSeededKnowledgeTitles,
  isSeededKnowledgeTitle,
} from './seeded';

describe('seeded knowledge titles', () => {
  it('includes industry template titles and the onboard hours FAQ', () => {
    const titles = collectSeededKnowledgeTitles();
    expect(titles.has(COMPANY_HOURS_TITLE)).toBe(true);
    expect(titles.has('OPD Consultation Hours & Departments')).toBe(true);
    expect(titles.has('Company Hours')).toBe(true);
  });

  it('treats onboard custom-service FAQs as seeded', () => {
    expect(isSeededKnowledgeTitle('How much does Dental Cleaning cost?')).toBe(
      true
    );
    expect(isSeededKnowledgeTitle('Do you provide Haircut & Styling?')).toBe(
      true
    );
  });

  it('leaves tenant-authored titles alone', () => {
    expect(
      isSeededKnowledgeTitle('Our weekend fasting package includes CBC')
    ).toBe(false);
    expect(isSeededKnowledgeTitle('')).toBe(false);
  });
});
