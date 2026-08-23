'use client';

import { KbPanel } from '@/components/settings/kb-panel';
import { KnowledgeAiPanel } from '@/components/automation-ai/knowledge-ai-panel';

export default function KnowledgeBasePage() {
  return (
    <div className="animate-in fade-in-50 space-y-6 duration-200">
      <KnowledgeAiPanel />
      <KbPanel />
    </div>
  );
}
