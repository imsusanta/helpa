'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sparkles,
  Wand2,
  Languages,
  Loader2,
  Copy,
  Check,
  Lock,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ModuleHeader } from './module-header';

type Mode = 'rewrite' | 'translate';

const TONES = [
  'professional and friendly',
  'warm and empathetic',
  'concise and direct',
  'formal',
  'casual',
  'apologetic',
  'persuasive',
];

const LANGUAGES = [
  'English',
  'Hindi',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Spanish',
  'French',
  'Arabic',
];

export function AiAssistantConsole() {
  const { canSendMessages } = useAuth();

  const [mode, setMode] = useState<Mode>('rewrite');
  const [text, setText] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [language, setLanguage] = useState('English');
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!text.trim()) {
      toast.error('Enter some text first');
      return;
    }
    setRunning(true);
    setResult('');
    try {
      const body =
        mode === 'rewrite'
          ? { action: 'rewrite', text: text.trim(), tone }
          : {
              action: 'translate',
              text: text.trim(),
              targetLanguage: language,
            };

      const res = await fetch('/api/ai/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'AI request failed');
      }
      setResult(String(data?.result || ''));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setRunning(false);
    }
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={Sparkles}
        title="AI Assistant"
        description="Polish and translate messages before you send them. To summarize, draft a follow-up, or qualify a lead from a live chat, open that conversation in the inbox."
      />

      {!canSendMessages ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Read-only access
            </CardTitle>
            <CardDescription>
              The AI Assistant tools generate and send content, so they require
              the agent role or higher. Your current role has read-only access.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-5 p-6">
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as Mode);
                setResult('');
              }}
            >
              <TabsList>
                <TabsTrigger value="rewrite">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Rewrite
                </TabsTrigger>
                <TabsTrigger value="translate">
                  <Languages className="mr-2 h-4 w-4" />
                  Translate
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rewrite" className="mt-4">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="translate" className="mt-4">
                <div className="space-y-2">
                  <Label>Translate to</Label>
                  <Select
                    value={language}
                    onValueChange={(v) => v && setLanguage(v)}
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="assistant-input">Your text</Label>
              <Textarea
                id="assistant-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={
                  mode === 'rewrite'
                    ? 'Paste the message you want to improve…'
                    : 'Paste the message you want to translate…'
                }
              />
            </div>

            <div>
              <Button onClick={run} disabled={running}>
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {mode === 'rewrite' ? 'Rewrite' : 'Translate'}
              </Button>
            </div>

            {result ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Result</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyResult}
                  >
                    {copied ? (
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="bg-muted/40 text-foreground rounded-lg border p-4 text-sm whitespace-pre-wrap">
                  {result}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
