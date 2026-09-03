/**
 * Helpa Core Platform — Knowledge Base Engine
 *
 * Industry-agnostic knowledge retrieval, category filtering,
 * and AI context formatting.
 */

import { getAdminClient } from '@/lib/db/server';
import { searchKnowledgeItems } from './search';

export interface KnowledgeItem {
  id?: string;
  category: string;
  question_title: string;
  answer_content: string;
}

export interface KnowledgeRetrievalResult {
  items: KnowledgeItem[];
  retrievalFailed: boolean;
}

export async function retrieveKnowledge(
  accountId: string,
  queryText?: string,
  options?: { limit?: number; conversationContext?: string }
): Promise<KnowledgeRetrievalResult> {
  const db = getAdminClient();
  const limit = options?.limit ?? 20;

  try {
    const { data: items, error } = await db
      .from('knowledge_base')
      .select('id, category, question_title, answer_content')
      .eq('account_id', accountId)
      .limit(Math.max(limit, 40));

    if (error) {
      return { items: [], retrievalFailed: true };
    }

    const rows = (items || []) as KnowledgeItem[];
    if (!queryText || queryText.trim() === '') {
      return { items: rows.slice(0, limit), retrievalFailed: false };
    }

    const matched = searchKnowledgeItems(rows, queryText, {
      conversationContext: options?.conversationContext,
      limit,
    });
    return { items: matched, retrievalFailed: false };
  } catch {
    return { items: [], retrievalFailed: true };
  }
}

export async function getRelevantKnowledge(
  accountId: string,
  queryText?: string,
  limit: number = 20
): Promise<KnowledgeItem[]> {
  const result = await retrieveKnowledge(accountId, queryText, { limit });
  return result.items;
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
