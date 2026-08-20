'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Brain,
  Loader2,
  MessageSquare,
  Sparkles,
  BookOpen,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SettingsPanelHead } from './settings-panel-head';

export function AiPanel() {
  const { canEditSettings } = useAuth();

  // Tenant workspace state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [accountName, setAccountName] = useState('');
  const [usageRequests, setUsageRequests] = useState(2340);
  const [maxRequests, setMaxRequests] = useState(5000);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/account/ai');
        if (response.ok) {
          const data = await response.json();
          setSystemPrompt(data.ai_system_prompt || '');
          setWelcomeMessage(data.welcome_message || '');
          setAccountName(data.account_name || '');
          if (data.usage_requests !== undefined)
            setUsageRequests(data.usage_requests);
          if (data.max_requests !== undefined)
            setMaxRequests(data.max_requests);
        }
      } catch (err) {
        console.error('Failed to load AI config:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  async function handleSave() {
    if (!canEditSettings) return;
    setSaving(true);

    try {
      const response = await fetch('/api/account/ai', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai_system_prompt: systemPrompt,
          welcome_message: welcomeMessage,
        }),
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errMsg = 'Failed to save AI configuration';
        try {
          const json = JSON.parse(rawText);
          if (json.error) errMsg = json.error;
        } catch {
          if (rawText) errMsg = rawText;
        }
        toast.error(errMsg);
        return;
      }

      toast.success('AI Receptionist guidelines & welcome greeting saved');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save AI configuration');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const usagePercent = Math.min(
    100,
    Math.round((usageRequests / (maxRequests || 1)) * 100)
  );

  return (
    <section className="animate-in fade-in space-y-6 duration-300">
      <SettingsPanelHead
        title="AI Receptionist & Guidelines"
        description="Helpa AI automates patient replies, schedules consultations, and triages inbound chats using your practice instructions."
      />

      {/* Helpa AI Managed Status Card */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.03] shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm">
                <Brain className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-base font-bold">
                    Helpa AI Engine
                  </h3>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-600">
                    <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Available
                  </Badge>
                </div>
                <p className="text-muted-foreground max-w-lg text-xs leading-relaxed">
                  AI is managed centrally by Helpa. You don&apos;t need to
                  provide an AI API key or configure language models.
                </p>
              </div>
            </div>

            {/* Monthly Usage Meter */}
            <div className="bg-card border-border/80 min-w-[200px] space-y-2 rounded-xl border p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                  <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
                  Monthly Quota
                </span>
                <span className="text-foreground font-mono font-bold">
                  {(usageRequests ?? 0).toLocaleString()} /{' '}
                  {(maxRequests ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-muted-foreground text-right text-[10px]">
                {usagePercent}% utilized this billing cycle
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Section 1: AI Instructions & Behavior */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              1
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
              AI Receptionist Instructions & Behavior
            </h3>
          </div>
          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
            Instruct your AI Receptionist on how to greet customers, operating
            hours, available services, and when to transfer chats to human
            staff.
          </p>
          <div className="space-y-3">
            <Textarea
              id="systemPrompt"
              placeholder="You are an AI receptionist for our business. Greet customers politely, answer questions, schedule appointments, and transfer complex inquiries to staff..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={!canEditSettings}
              rows={8}
              className="bg-muted/40 border-border text-foreground max-w-xl resize-y font-mono text-xs leading-relaxed focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        {/* Section 2: Automated First Message / Welcome Greeting */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              2
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
              Automated First Message / Welcome Greeting
            </h3>
          </div>
          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
            Initial greeting sent automatically when a new customer contacts
            your WhatsApp Business number.
          </p>
          <Textarea
            id="welcomeMessage"
            placeholder={`👋 Hello! Welcome to ${accountName || 'our business'}. How can we assist you today?`}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            disabled={!canEditSettings}
            rows={3}
            className="bg-muted/40 border-border text-foreground max-w-xl resize-y text-xs leading-relaxed focus-visible:ring-emerald-500"
          />
        </div>

        {/* Section 3: Business Info & FAQs Quick Link */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-foreground text-sm font-bold">
                  Business Info & FAQs
                </CardTitle>
              </div>
              <Link href="/knowledge-base">
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  Manage Business Info & FAQs →
                </Button>
              </Link>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              Manage service rate cards, doctor consultation fees, FAQs, and
              business policies.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Action Controls */}
        {canEditSettings ? (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer bg-emerald-700 font-bold text-white shadow-md transition-all hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving Guidelines...
                </>
              ) : (
                'Save AI Receptionist Guidelines'
              )}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            You do not have write access to edit AI settings.
          </p>
        )}
      </div>
    </section>
  );
}
