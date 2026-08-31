import { describe, expect, it } from 'vitest';
import { knowledgeBaseHref, parseKnowledgeBaseTab } from './tabs';

describe('knowledge base tabs', () => {
  it('maps legacy chatbot and faq routes onto Knowledge Base tabs', () => {
    expect(parseKnowledgeBaseTab('chatbot')).toBe('receptionist');
    expect(parseKnowledgeBaseTab('receptionist')).toBe('receptionist');
    expect(parseKnowledgeBaseTab('faq-bot')).toBe('faq');
    expect(parseKnowledgeBaseTab(null)).toBe('knowledge');
    expect(knowledgeBaseHref('receptionist')).toBe(
      '/knowledge-base?tab=receptionist'
    );
    expect(knowledgeBaseHref()).toBe('/knowledge-base');
  });
});
