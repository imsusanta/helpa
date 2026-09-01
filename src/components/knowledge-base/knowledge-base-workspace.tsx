'use client';

import { Suspense, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Bot, HelpCircle } from 'lucide-react';

import { ChatbotConsole } from '@/components/automation-ai/chatbot-console';
import { FaqBotConsole } from '@/components/automation-ai/faq-bot-console';
import { KnowledgeAiPanel } from '@/components/automation-ai/knowledge-ai-panel';
import { KbPanel } from '@/components/settings/kb-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/hooks/use-workspace';
import { getIndustryAiPreset } from '@/lib/ai/industry-ai-presets';
import {
  knowledgeBaseHref,
  parseKnowledgeBaseTab,
  type KnowledgeBaseTab,
} from '@/lib/knowledge-base/tabs';

function KnowledgeBaseWorkspaceInner() {
  const { currentIndustry } = useWorkspace();
  const preset = getIndustryAiPreset(currentIndustry);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = parseKnowledgeBaseTab(searchParams.get('tab'));

  const setTab = useCallback(
    (next: string) => {
      const resolved = parseKnowledgeBaseTab(next);
      const href = knowledgeBaseHref(resolved);
      if (href === pathname || href === `${pathname}?tab=${resolved}`) {
        router.replace(href, { scroll: false });
        return;
      }
      router.replace(href, { scroll: false });
    },
    [pathname, router]
  );

  return (
    <div className="animate-in fade-in-50 space-y-6 duration-200">
      <div>
        <h1 className="text-foreground text-2xl font-extrabold">
          Knowledge Base
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Documents, {preset.assistantRole.toLowerCase()} instructions, and FAQ
          answers in one place. WhatsApp replies use everything here.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList variant="line" className="h-auto w-full justify-start">
          <TabsTrigger value="knowledge" className="px-3 py-2 text-sm">
            <BookOpen data-icon="inline-start" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="receptionist" className="px-3 py-2 text-sm">
            <Bot data-icon="inline-start" />
            {preset.assistantRole}
          </TabsTrigger>
          <TabsTrigger value="faq" className="px-3 py-2 text-sm">
            <HelpCircle data-icon="inline-start" />
            FAQ Bot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-6">
          <KnowledgeAiPanel
            onOpenTab={(next: KnowledgeBaseTab) => setTab(next)}
          />
          <KbPanel />
        </TabsContent>
        <TabsContent value="receptionist">
          <ChatbotConsole embedded />
        </TabsContent>
        <TabsContent value="faq">
          <FaqBotConsole embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function KnowledgeBaseWorkspace() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground p-6 text-sm">
          Loading Knowledge Base…
        </div>
      }
    >
      <KnowledgeBaseWorkspaceInner />
    </Suspense>
  );
}
