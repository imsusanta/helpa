/**
 * Better knowledge retrieval: exact match, synonym expansion,
 * token overlap, and conversation-context terms — before the AI
 * is allowed to say "information is not available".
 */

export interface KnowledgeSearchItem {
  category: string;
  question_title: string;
  answer_content: string;
}

const SYNONYM_GROUPS: string[][] = [
  ['price', 'pricing', 'rate', 'fee', 'fees', 'cost', 'charge', 'koto', 'dam', 'taka', 'কত', 'দাম', 'খরচ', 'ফি', 'টাকা'],
  ['package', 'packages', 'tour', 'trip', 'card', 'plan', 'প্যাকেজ'],
  ['doctor', 'dr', 'physician', 'consultant'],
  ['course', 'courses', 'batch', 'class', 'program', 'কোর্স', 'ব্যাচ'],
  ['appointment', 'slot', 'booking', 'visit'],
  ['timing', 'timings', 'hours', 'schedule', 'time'],
  ['platinum', 'platimum'],
];

function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[₹$,.]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function expandSearchTerms(
  query: string,
  conversationContext?: string
): string[] {
  const raw = tokensOf([query, conversationContext].filter(Boolean).join(' '));
  const expanded = new Set<string>(raw);
  for (const token of raw) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const synonym of group) expanded.add(synonym);
      }
    }
  }
  return Array.from(expanded);
}

export function scoreKnowledgeItem(
  item: KnowledgeSearchItem,
  terms: string[],
  query: string
): number {
  const title = normalize(item.question_title);
  const content = normalize(item.answer_content);
  const category = normalize(item.category);
  const haystack = `${title} ${content} ${category}`;
  const normalizedQuery = normalize(query);

  let score = 0;
  if (normalizedQuery && title === normalizedQuery) score += 100;
  if (normalizedQuery && title.includes(normalizedQuery)) score += 40;

  for (const term of terms) {
    if (title.includes(term)) score += 8;
    else if (category.includes(term)) score += 4;
    else if (content.includes(term)) score += 2;
  }

  const queryTokens = tokensOf(query);
  const overlap = queryTokens.filter((token) => haystack.includes(token)).length;
  if (queryTokens.length > 0) {
    score += Math.round((overlap / queryTokens.length) * 10);
  }

  return score;
}

export function searchKnowledgeItems(
  items: KnowledgeSearchItem[],
  query: string,
  options?: { conversationContext?: string; minScore?: number; limit?: number }
): KnowledgeSearchItem[] {
  if (!items.length) return [];
  const terms = expandSearchTerms(query, options?.conversationContext);
  const minScore = options?.minScore ?? 1;
  const scored = items
    .map((item) => ({
      item,
      score: scoreKnowledgeItem(item, terms, query),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const limit = options?.limit ?? scored.length;
  return scored.slice(0, limit).map((row) => row.item);
}
