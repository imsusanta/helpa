'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  Loader2,
  Sparkles,
  Key,
  Cpu,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const POPULAR_MODELS = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    badge: 'Recommended',
    badgeColor:
      'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/20',
    desc: 'Lightning fast responses. Optimal choice for hospital receptionist tasks.',
    stats: 'Speed: Ultra-Fast • Cost: Lowest',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    badge: 'Max Quality',
    badgeColor:
      'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/20',
    desc: 'Industry-leading reasoning and clinical instruction-following.',
    stats: 'Speed: Fast • Cost: Premium',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    badge: 'Balanced',
    badgeColor:
      'bg-sky-100 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/20',
    desc: 'Open-source intelligence with high reasoning capabilities.',
    stats: 'Speed: Fast • Cost: Low',
  },
];

export function AiPanel() {
  const { canEditSettings } = useAuth();
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelId, setCustomModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/account/ai');
        if (response.ok) {
          const data = await response.json();
          const dbModel = data.openrouter_model || 'google/gemini-2.5-flash';
          setHasApiKey(data.has_api_key);
          setSystemPrompt(data.ai_system_prompt || '');
          setWelcomeMessage(data.welcome_message || '');
          setAccountName(data.account_name || '');

          const matched = POPULAR_MODELS.some((m) => m.id === dbModel);
          if (matched) {
            setModel(dbModel);
            setIsCustomModel(false);
          } else {
            setIsCustomModel(true);
            setCustomModelId(dbModel);
            setModel('custom');
          }
        }
      } catch (err) {
        console.error('Failed to load AI config:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  const activeModel = isCustomModel ? customModelId : model;

  async function handleSave() {
    if (!canEditSettings) return;
    setSaving(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/account/ai', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openrouter_model: activeModel,
          ai_system_prompt: systemPrompt,
          welcome_message: welcomeMessage,
          ...(apiKey.trim() ? { openrouter_api_key: apiKey } : {}),
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

      const data = await response.json();
      setHasApiKey(data.has_api_key);
      setApiKey(''); // clear password field after saving
      toast.success('AI Assistant configuration saved');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save AI configuration');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/account/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openrouter_api_key: apiKey,
          openrouter_model: activeModel,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: `Successfully connected to OpenRouter! Model response: "${data.message}"`,
        });
        toast.success('AI connection check succeeded');
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Unknown connection error occurred.',
        });
        toast.error('AI connection check failed');
      }
    } catch (err) {
      console.error('Failed to test AI connection:', err);
      setTestResult({
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to communicate with test endpoint',
      });
      toast.error('Failed to check AI connection');
    } finally {
      setTestingConnection(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in space-y-8 duration-300">
      {/* Premium Header */}
      <div className="via-background to-background flex items-start gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 backdrop-blur-xl">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <Brain className="h-8 w-8 animate-pulse text-emerald-600 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-extrabold">
            AI Receptionist Autopilot
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-800 uppercase dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              Active
            </span>
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Configure the neural engine that answers patient queries 24/7,
            schedules consultations, and dispatches diagnostic report PDFs.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1: OpenRouter Credentials */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              1
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <Key className="size-4 text-emerald-600 dark:text-emerald-400" />
              OpenRouter Access Credentials
            </h3>
          </div>
          <p className="text-muted-foreground max-w-lg text-xs leading-relaxed">
            Create an API key from{' '}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-semibold hover:underline"
            >
              openrouter.ai
            </a>{' '}
            to allow the system to call LLMs.
          </p>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor="apiKey"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={
                  hasApiKey
                    ? '••••••••••••••••••••••••••••••••'
                    : 'sk-or-v1-...'
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!canEditSettings}
                className="bg-muted/40 border-border text-foreground max-w-md focus-visible:ring-emerald-500"
              />
            </div>
            {hasApiKey && (
              <div className="bg-emerald-55 flex max-w-md items-center gap-1.5 rounded-lg border border-emerald-200 p-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/10 dark:bg-emerald-950/20 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                OpenRouter Key is configured & securely encrypted.
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Choose Model Engine */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              2
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <Cpu className="size-4 text-emerald-600 dark:text-emerald-400" />
              Model Select (Brain Power)
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label
                htmlFor="model"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Select LLM Model
              </Label>
              <select
                id="model"
                value={isCustomModel ? 'custom' : model}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsCustomModel(true);
                  } else {
                    setIsCustomModel(false);
                    setModel(val);
                  }
                }}
                disabled={!canEditSettings}
                className="border-border bg-muted/40 text-foreground h-9 w-full max-w-md rounded-lg border px-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {POPULAR_MODELS.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    className="bg-background text-foreground"
                  >
                    {m.name} ({m.provider})
                  </option>
                ))}
                <option
                  value="custom"
                  className="bg-background text-foreground"
                >
                  Use custom model ID...
                </option>
              </select>
            </div>

            {/* Custom Model Input */}
            {isCustomModel && (
              <div className="animate-in slide-in-from-left-2 grid gap-1.5 border-l-2 border-emerald-500/40 pl-4 duration-200">
                <Label
                  htmlFor="customModelId"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  OpenRouter Model Identifier
                </Label>
                <Input
                  id="customModelId"
                  placeholder="e.g. deepseek/deepseek-chat or cohere/north-mini-code:free"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  disabled={!canEditSettings}
                  className="bg-muted/40 border-border text-foreground max-w-md focus-visible:ring-emerald-500"
                />
                <p className="text-muted-foreground text-[10px]">
                  Enter any valid model identifier from OpenRouter. For example:{' '}
                  <code className="font-mono text-emerald-600 dark:text-emerald-400">
                    meta-llama/llama-3-8b-instruct:free
                  </code>{' '}
                  or{' '}
                  <code className="font-mono text-emerald-600 dark:text-emerald-400">
                    cohere/north-mini-code:free
                  </code>
                  .
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: AI System prompt guidelines */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex max-w-xl items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                3
              </span>
              <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                <Brain className="size-4 text-emerald-600 dark:text-emerald-400" />
                AI System Instructions & Guidelines
              </h3>
            </div>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
              Primary Rules
            </span>
          </div>
          <p className="text-muted-foreground max-w-lg text-xs leading-relaxed">
            Define the core behavior, business rules, safety protocols, and
            operational guidelines for your AI Assistant.
          </p>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor="systemPrompt"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                System Prompt Rules & Guidelines
              </Label>
              <Textarea
                id="systemPrompt"
                placeholder="You are an AI receptionist for City Hospital. Greet patients, schedule consultations, answer FAQs. NEVER diagnose diseases or recommend prescription medicines..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={!canEditSettings}
                rows={10}
                className="bg-muted/40 border-border text-foreground max-w-xl resize-y font-mono text-xs leading-relaxed focus-visible:ring-emerald-500"
              />
            </div>
            <div className="max-w-xl space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[11px] text-emerald-950 dark:border-emerald-500/10 dark:bg-emerald-950/10 dark:text-emerald-200">
              <p className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                AI Receptionist Guidelines Recommendation:
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-[10px]">
                <li>
                  Instruct the AI to check Doctor availabilities before
                  suggesting bookings.
                </li>
                <li>
                  Make it identify patients by their Phone Number or Patient ID
                  when checking Lab Reports.
                </li>
                <li>
                  Ensure strict medical guidelines: AI must politely decline
                  giving diagnostics or recommending drugs.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 4: Customizable Welcome Message */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex max-w-xl items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                4
              </span>
              <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
                Customizable Welcome Message
              </h3>
            </div>
            <span className="bg-muted text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
              Optional
            </span>
          </div>
          <p className="text-muted-foreground max-w-lg text-xs leading-relaxed">
            Optional: Customize the opening welcome message. If left blank, the
            AI will answer customer queries directly using your AI System
            Instructions & Guidelines above.
          </p>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <div className="flex max-w-xl items-center justify-between">
                <Label
                  htmlFor="welcomeMessage"
                  className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
                >
                  Welcome Message Greeting
                </Label>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {welcomeMessage.length} characters
                </span>
              </div>
              <Textarea
                id="welcomeMessage"
                placeholder={`👋 Hello! Welcome to ${accountName || 'our Hospital & Clinic'}. 🏥 How can we assist you today? You can ask about doctor schedules, book an appointment, or check lab report status.`}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                disabled={!canEditSettings}
                rows={4}
                className="bg-muted/40 border-border text-foreground max-w-xl resize-y text-xs leading-relaxed font-normal focus-visible:ring-emerald-500"
              />
            </div>

            {/* Quick Presets */}
            {canEditSettings && (
              <div className="max-w-xl space-y-2">
                <p className="text-muted-foreground flex items-center gap-1 text-[11px] font-bold">
                  <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
                  Quick Presets & Templates:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border h-7 cursor-pointer text-[11px] hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() =>
                      setWelcomeMessage(
                        `👋 Hello! Welcome to *${accountName || 'our Hospital'}*! 🏥 How can we assist you today? You can ask for Doctor schedules, book an appointment, or check report status.`
                      )
                    }
                  >
                    🏥 Hospital & Clinic
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border h-7 cursor-pointer text-[11px] hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() =>
                      setWelcomeMessage(
                        `👋 Welcome to *${accountName || 'our Academy'}*! 🏫 How can we help you with your studies, course information, or exam preparation today?`
                      )
                    }
                  >
                    🏫 Coaching & Education
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border h-7 cursor-pointer text-[11px] hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() =>
                      setWelcomeMessage(
                        `👋 Hi there! Welcome to *${accountName || 'our business'}*! 🚀 How can our team assist you today?`
                      )
                    }
                  >
                    🏢 General Business
                  </Button>
                  {welcomeMessage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer text-[11px] text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                      onClick={() => setWelcomeMessage('')}
                    >
                      <RotateCcw className="mr-1 size-3" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Live WhatsApp Message Preview */}
            <div className="max-w-xl space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-950/5 p-3.5 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Live Preview (Customer View)
                </span>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                  WhatsApp Auto-Reply
                </span>
              </div>
              <div className="bg-card border-border text-foreground rounded-lg border p-3 text-xs leading-relaxed shadow-sm dark:bg-zinc-900">
                {welcomeMessage.trim() ? (
                  <p className="whitespace-pre-wrap">{welcomeMessage}</p>
                ) : (
                  <p className="text-muted-foreground italic">
                    {`"👋 Hello! Welcome to ${accountName || 'our Hospital'}. 🏥 How can we assist you today?"`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {canEditSettings ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || testingConnection}
                className="cursor-pointer bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/10 transition-all duration-200 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Autopilot Config'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={saving || testingConnection}
                className="border-border text-foreground hover:bg-muted cursor-pointer font-bold"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                    Testing API Link...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>

            {testResult && (
              <div
                className={`animate-in fade-in slide-in-from-top-1 max-w-xl rounded-xl p-4 text-xs duration-200 ${
                  testResult.success
                    ? 'border border-green-500/20 bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-200'
                    : 'border border-red-500/20 bg-red-50 text-red-900 dark:bg-red-950/20 dark:text-red-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {testResult.success ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className="mb-1 font-bold">
                      {testResult.success
                        ? 'Connection Check Successful'
                        : 'Connection Check Failed'}
                    </p>
                    <p className="leading-relaxed whitespace-pre-wrap opacity-90">
                      {testResult.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
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
