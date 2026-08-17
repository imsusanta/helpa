'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  Loader2,
  Cpu,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Layers,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const OPENROUTER_MODELS = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    badge: 'Recommended',
    desc: 'Lightning fast responses. Optimal choice for receptionist tasks.',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    badge: 'Max Quality',
    desc: 'Industry-leading reasoning and clinical instruction-following.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    badge: 'Balanced',
    desc: 'Open-source intelligence with high reasoning capabilities.',
  },
  {
    id: 'custom',
    name: '✏️ Enter Custom Model Identifier...',
    provider: 'Custom LLM',
    badge: 'Custom',
    desc: 'Enter any valid OpenRouter model string (e.g. deepseek/deepseek-r1).',
  },
];

const ORCAROUTER_MODELS = [
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter Auto Engine',
    provider: 'OrcaRouter',
    badge: 'Smart Auto',
    desc: 'Automated intelligent routing across best performing LLM models.',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI (via Orca)',
    badge: 'Fast',
    desc: 'High speed and concise responses.',
  },
  {
    id: 'custom',
    name: '✏️ Enter Custom Model Identifier...',
    provider: 'Custom LLM',
    badge: 'Custom',
    desc: 'Enter any custom model identifier supported by OrcaRouter.',
  },
];

export function AiPanel() {
  const { canEditSettings } = useAuth();

  // Provider routing state
  const [primaryProvider, setPrimaryProvider] = useState<'openrouter' | 'orcarouter'>('openrouter');
  const [fallbackProvider, setFallbackProvider] = useState<'none' | 'openrouter' | 'orcarouter'>('none');

  // OpenRouter state
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.5-flash');
  const [isOpenRouterCustom, setIsOpenRouterCustom] = useState(false);
  const [openRouterCustomId, setOpenRouterCustomId] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);

  // OrcaRouter state
  const [orcaRouterModel, setOrcaRouterModel] = useState('orcarouter/auto');
  const [isOrcaRouterCustom, setIsOrcaRouterCustom] = useState(false);
  const [orcaRouterCustomId, setOrcaRouterCustomId] = useState('');
  const [orcaRouterApiKey, setOrcaRouterApiKey] = useState('');
  const [hasOrcaRouterKey, setHasOrcaRouterKey] = useState(false);

  // System & Welcome prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [accountName, setAccountName] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOpenRouter, setTestingOpenRouter] = useState(false);
  const [testingOrcaRouter, setTestingOrcaRouter] = useState(false);

  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/account/ai');
        if (response.ok) {
          const data = await response.json();
          setPrimaryProvider(data.ai_provider || 'openrouter');
          setFallbackProvider(data.ai_fallback_provider || 'none');

          const dbOpenRouterModel = data.openrouter_model || 'google/gemini-2.5-flash';
          const dbOrcaRouterModel = data.orcarouter_model || 'orcarouter/auto';

          const openRouterMatched = OPENROUTER_MODELS.some((m) => m.id === dbOpenRouterModel && m.id !== 'custom');
          if (openRouterMatched) {
            setOpenRouterModel(dbOpenRouterModel);
            setIsOpenRouterCustom(false);
          } else {
            setIsOpenRouterCustom(true);
            setOpenRouterCustomId(dbOpenRouterModel);
            setOpenRouterModel('custom');
          }

          const orcaRouterMatched = ORCAROUTER_MODELS.some((m) => m.id === dbOrcaRouterModel && m.id !== 'custom');
          if (orcaRouterMatched) {
            setOrcaRouterModel(dbOrcaRouterModel);
            setIsOrcaRouterCustom(false);
          } else {
            setIsOrcaRouterCustom(true);
            setOrcaRouterCustomId(dbOrcaRouterModel);
            setOrcaRouterModel('custom');
          }

          setHasOpenRouterKey(!!data.has_openrouter_key);
          setHasOrcaRouterKey(!!data.has_orcarouter_key);
          setSystemPrompt(data.ai_system_prompt || '');
          setWelcomeMessage(data.welcome_message || '');
          setAccountName(data.account_name || '');
        }
      } catch (err) {
        console.error('Failed to load AI config:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  const activeOpenRouterModel = isOpenRouterCustom ? openRouterCustomId : openRouterModel;
  const activeOrcaRouterModel = isOrcaRouterCustom ? orcaRouterCustomId : orcaRouterModel;

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
          ai_provider: primaryProvider,
          ai_fallback_provider: fallbackProvider,
          openrouter_model: activeOpenRouterModel,
          orcarouter_model: activeOrcaRouterModel,
          ai_system_prompt: systemPrompt,
          welcome_message: welcomeMessage,
          ...(openRouterApiKey.trim() ? { openrouter_api_key: openRouterApiKey } : {}),
          ...(orcaRouterApiKey.trim() ? { orcarouter_api_key: orcaRouterApiKey } : {}),
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
      setHasOpenRouterKey(!!data.has_openrouter_key);
      setHasOrcaRouterKey(!!data.has_orcarouter_key);
      setOpenRouterApiKey('');
      setOrcaRouterApiKey('');
      toast.success('AI Provider & Autopilot configuration saved');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save AI configuration');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestProvider(provider: 'openrouter' | 'orcarouter') {
    if (provider === 'openrouter') setTestingOpenRouter(true);
    if (provider === 'orcarouter') setTestingOrcaRouter(true);
    setTestResult(null);

    const modelToTest = provider === 'openrouter' ? activeOpenRouterModel : activeOrcaRouterModel;

    try {
      const response = await fetch('/api/account/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          api_key: provider === 'openrouter' ? openRouterApiKey : orcaRouterApiKey,
          model: modelToTest,
        }),
      });

      const data = await response.json();
      const pLabel = provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter';

      if (response.ok && data.success) {
        setTestResult({
          provider: pLabel,
          success: true,
          message: `Successfully connected to ${pLabel} (${modelToTest})! Latency: ${data.latencyMs || 0}ms. Message: "${data.message}"`,
        });
        toast.success(`${pLabel} connection check succeeded`);
      } else {
        setTestResult({
          provider: pLabel,
          success: false,
          message: data.error || `${pLabel} connection test failed.`,
        });
        toast.error(`${pLabel} connection check failed`);
      }
    } catch (err) {
      const pLabel = provider === 'openrouter' ? 'OpenRouter' : 'OrcaRouter';
      setTestResult({
        provider: pLabel,
        success: false,
        message: err instanceof Error ? err.message : 'Failed to communicate with test endpoint',
      });
      toast.error(`Failed to test ${pLabel}`);
    } finally {
      setTestingOpenRouter(false);
      setTestingOrcaRouter(false);
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
      {/* Header */}
      <div className="via-background to-background flex items-start gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 backdrop-blur-xl">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <Brain className="h-8 w-8 animate-pulse text-emerald-600 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-extrabold">
            Helpa Multi-Provider AI Engine
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-800 uppercase dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              Provider-Agnostic
            </span>
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Configure first-class AI Providers (OpenRouter and OrcaRouter) with primary/fallback routing, custom model IDs, health monitoring, and AI Autopilot instructions.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Provider Selection & Routing */}
        <div className="bg-card border-border space-y-5 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              1
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <Layers className="size-4 text-emerald-600 dark:text-emerald-400" />
              Primary & Fallback Provider Routing
            </h3>
          </div>
          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
            Select your Primary AI Provider and optional Fallback Provider. If your Primary Provider experiences a temporary network or 5xx issue, Helpa will seamlessly route requests to your Fallback Provider.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Primary Provider */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Primary Provider
              </Label>
              <select
                value={primaryProvider}
                onChange={(e) => setPrimaryProvider(e.target.value as 'openrouter' | 'orcarouter')}
                disabled={!canEditSettings}
                className="border-border bg-muted/40 text-foreground h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="openrouter">OpenRouter (Default)</option>
                <option value="orcarouter">OrcaRouter</option>
              </select>
            </div>

            {/* Fallback Provider */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Fallback Provider
              </Label>
              <select
                value={fallbackProvider}
                onChange={(e) => setFallbackProvider(e.target.value as 'none' | 'openrouter' | 'orcarouter')}
                disabled={!canEditSettings}
                className="border-border bg-muted/40 text-foreground h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="none">None (No Fallback)</option>
                <option value="openrouter" disabled={primaryProvider === 'openrouter'}>
                  OpenRouter
                </option>
                <option value="orcarouter" disabled={primaryProvider === 'orcarouter'}>
                  OrcaRouter
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: OpenRouter Provider Settings */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                2
              </span>
              <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                <Zap className="size-4 text-emerald-600 dark:text-emerald-400" />
                OpenRouter Provider Configuration
              </h3>
            </div>
            {hasOpenRouterKey ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                ● Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-300">
                ● Not Configured
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                OpenRouter API Key
              </Label>
              <Input
                type="password"
                placeholder={hasOpenRouterKey ? '••••••••••••••••••••••••••••••••' : 'sk-or-v1-...'}
                value={openRouterApiKey}
                onChange={(e) => setOpenRouterApiKey(e.target.value)}
                disabled={!canEditSettings}
                className="bg-muted/40 border-border text-foreground focus-visible:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                OpenRouter Default Model
              </Label>
              <select
                value={isOpenRouterCustom ? 'custom' : openRouterModel}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsOpenRouterCustom(true);
                  } else {
                    setIsOpenRouterCustom(false);
                    setOpenRouterModel(e.target.value);
                  }
                }}
                disabled={!canEditSettings}
                className="border-border bg-muted/40 text-foreground h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:border-emerald-500"
              >
                {OPENROUTER_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.provider !== 'Custom LLM' ? `(${m.provider})` : ''}
                  </option>
                ))}
              </select>

              {isOpenRouterCustom && (
                <div className="pt-2 animate-in fade-in space-y-1">
                  <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Custom OpenRouter Model ID
                  </Label>
                  <Input
                    type="text"
                    placeholder="e.g. deepseek/deepseek-r1 or qwen/qwen-2.5-72b-instruct"
                    value={openRouterCustomId}
                    onChange={(e) => setOpenRouterCustomId(e.target.value.trim())}
                    disabled={!canEditSettings}
                    className="bg-muted/40 border-border text-foreground h-9 font-mono text-xs focus-visible:ring-emerald-500"
                  />
                  <p className="text-muted-foreground text-[10px] italic">
                    Active: <code className="font-mono text-emerald-600 dark:text-emerald-400">{activeOpenRouterModel || 'None specified'}</code>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTestProvider('openrouter')}
              disabled={testingOpenRouter}
              className="border-border text-foreground hover:bg-muted font-bold text-xs"
            >
              {testingOpenRouter ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Test OpenRouter Connection
            </Button>
          </div>
        </div>

        {/* Section 3: OrcaRouter Provider Settings */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                3
              </span>
              <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                <Cpu className="size-4 text-emerald-600 dark:text-emerald-400" />
                OrcaRouter Provider Configuration
              </h3>
            </div>
            {hasOrcaRouterKey ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                ● Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-300">
                ● Not Configured
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Official OrcaRouter API endpoint:{' '}
            <code className="font-mono text-emerald-600 dark:text-emerald-400">
              https://api.orcarouter.ai/v1
            </code>
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                OrcaRouter API Key
              </Label>
              <Input
                type="password"
                placeholder={hasOrcaRouterKey ? '••••••••••••••••••••••••••••••••' : 'orca_live_...'}
                value={orcaRouterApiKey}
                onChange={(e) => setOrcaRouterApiKey(e.target.value)}
                disabled={!canEditSettings}
                className="bg-muted/40 border-border text-foreground focus-visible:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                OrcaRouter Default Model
              </Label>
              <select
                value={isOrcaRouterCustom ? 'custom' : orcaRouterModel}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsOrcaRouterCustom(true);
                  } else {
                    setIsOrcaRouterCustom(false);
                    setOrcaRouterModel(e.target.value);
                  }
                }}
                disabled={!canEditSettings}
                className="border-border bg-muted/40 text-foreground h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:border-emerald-500"
              >
                {ORCAROUTER_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              {isOrcaRouterCustom && (
                <div className="pt-2 animate-in fade-in space-y-1">
                  <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Custom OrcaRouter Model ID
                  </Label>
                  <Input
                    type="text"
                    placeholder="e.g. anthropic/claude-3-5-sonnet or custom-llm-id"
                    value={orcaRouterCustomId}
                    onChange={(e) => setOrcaRouterCustomId(e.target.value.trim())}
                    disabled={!canEditSettings}
                    className="bg-muted/40 border-border text-foreground h-9 font-mono text-xs focus-visible:ring-emerald-500"
                  />
                  <p className="text-muted-foreground text-[10px] italic">
                    Active: <code className="font-mono text-emerald-600 dark:text-emerald-400">{activeOrcaRouterModel || 'None specified'}</code>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTestProvider('orcarouter')}
              disabled={testingOrcaRouter}
              className="border-border text-foreground hover:bg-muted font-bold text-xs"
            >
              {testingOrcaRouter ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Test OrcaRouter Connection
            </Button>
          </div>
        </div>

        {/* Section 4: System Prompt Guidelines */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex max-w-xl items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                4
              </span>
              <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                <Brain className="size-4 text-emerald-600 dark:text-emerald-400" />
                AI System Instructions & Guidelines
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            <Textarea
              id="systemPrompt"
              placeholder="You are an AI receptionist for City Hospital. Greet patients, schedule consultations, answer FAQs. NEVER diagnose diseases..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={!canEditSettings}
              rows={8}
              className="bg-muted/40 border-border text-foreground max-w-xl resize-y font-mono text-xs leading-relaxed focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        {/* Section 5: Welcome Message */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              5
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
              Customizable Welcome Greeting
            </h3>
          </div>
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

        {/* Test Result Display */}
        {testResult && (
          <div
            className={`animate-in fade-in max-w-xl rounded-xl p-4 text-xs duration-200 ${
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
                  [{testResult.provider}] {testResult.success ? 'Connection Check Successful' : 'Connection Check Failed'}
                </p>
                <p className="leading-relaxed whitespace-pre-wrap opacity-90">{testResult.message}</p>
              </div>
            </div>
          </div>
        )}

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
                  Saving Configuration...
                </>
              ) : (
                'Save Provider & Autopilot Config'
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
