export const KNOWLEDGE_BASE_TABS = [
  'knowledge',
  'receptionist',
  'faq',
] as const;

export type KnowledgeBaseTab = (typeof KNOWLEDGE_BASE_TABS)[number];

export function parseKnowledgeBaseTab(value?: string | null): KnowledgeBaseTab {
  if (value === 'receptionist' || value === 'chatbot') return 'receptionist';
  if (value === 'faq' || value === 'faq-bot') return 'faq';
  return 'knowledge';
}

export function knowledgeBaseHref(tab: KnowledgeBaseTab = 'knowledge'): string {
  if (tab === 'knowledge') return '/knowledge-base';
  return `/knowledge-base?tab=${tab}`;
}
