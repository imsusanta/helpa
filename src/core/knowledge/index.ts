/**
 * Helpa Core Platform — Knowledge Base Engine
 *
 * Industry-agnostic knowledge retrieval, category filtering,
 * and AI context formatting.
 */

import { getAdminClient } from '@/lib/db/server';

export interface KnowledgeItem {
  id?: string;
  category: string;
  question_title: string;
  answer_content: string;
}

export async function getRelevantKnowledge(
  accountId: string,
  queryText?: string,
  limit: number = 20
): Promise<KnowledgeItem[]> {
  const db = getAdminClient();

  const { data: items, error } = await db
    .from('knowledge_base')
    .select('id, category, question_title, answer_content')
    .eq('account_id', accountId)
    .limit(limit);

  if (error || !items) {
    return [];
  }

  if (!queryText || queryText.trim() === '') {
    return items as KnowledgeItem[];
  }

  const queryTerms = queryText.toLowerCase().split(/\s+/).filter(Boolean);

  // Keyword relevance scoring
  const scored = items.map((item) => {
    const title = (item.question_title || '').toLowerCase();
    const content = (item.answer_content || '').toLowerCase();
    const category = (item.category || '').toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      if (title.includes(term)) score += 3;
      if (category.includes(term)) score += 2;
      if (content.includes(term)) score += 1;
    }

    return { item: item as KnowledgeItem, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}

export function formatKnowledgeForAi(items: KnowledgeItem[]): string {
  if (!items || items.length === 0) {
    return 'No specific knowledge base articles found.';
  }

  return items
    .map(
      (item, idx) =>
        `[Article ${idx + 1}] (${item.category.toUpperCase()}): ${item.question_title}\n${item.answer_content}`
    )
    .join('\n\n');
}
