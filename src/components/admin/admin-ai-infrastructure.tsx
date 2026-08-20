'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { validateAiModelId } from '@/core/ai/validation';
import { AdminNav } from './admin-nav';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & DEFAULT CATALOGS
// ═══════════════════════════════════════════════════════════════════════════════

interface ModelItem {
  id: string;
  name: string;
  provider: 'openrouter' | 'orcarouter';
  enabled: boolean;
}

const DEFAULT_OPENROUTER_MODELS: ModelItem[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'openrouter',
    enabled: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'openrouter',
    enabled: true,
  },
];

const DEFAULT_ORCAROUTER_MODELS: ModelItem[] = [
  {
    id: 'orcarouter/auto',
    name: 'Orca Auto Engine',
    provider: 'orcarouter',
    enabled: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'orcarouter',
    enabled: true,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'orcarouter',
    enabled: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'orcarouter',
    enabled: true,
  },
];

export function AdminAiInfrastructure() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingCurrent, setIsTestingCurrent] = useState(false);
  const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(
    null
  );
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);

  // Form states
  const [selectedProvider, setSelectedProvider] = useState<
    'openrouter' | 'orcarouter'
  >('openrouter');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');

  // Stored state from server
  const [savedSettings, setSavedSettings] = useState<Record<string, unknown>>(
    {}
  );
  const [customModels, setCustomModels] = useState<ModelItem[]>([]);
  const [isLiveHealthy, setIsLiveHealthy] = useState<boolean | null>(null);

  // Custom Model Dialog
  const [isCustomModelOpen, setIsCustomModelOpen] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customModelError, setCustomModelError] = useState('');

  // Fetch settings & health
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setSavedSettings(data);

      const activeProvider = (
        data.system_ai_provider === 'orcarouter' ? 'orcarouter' : 'openrouter'
      ) as 'openrouter' | 'orcarouter';
      setSelectedProvider(activeProvider);

      if (activeProvider === 'orcarouter') {
        setSelectedModel(
          String(data.system_orcarouter_model || 'orcarouter/auto')
        );
      } else {
        setSelectedModel(
          String(data.system_openrouter_model || 'google/gemini-2.5-flash')
        );
      }

      // Load custom models if present
      if (data.available_models) {
        try {
          const parsed =
            typeof data.available_models === 'string'
              ? JSON.parse(data.available_models)
              : data.available_models;
          if (Array.isArray(parsed)) {
            setCustomModels(
              parsed.filter((m: ModelItem) => m && m.id && m.name)
            );
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch {
      toast.error('Could not load AI configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkLiveHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/health');
      if (!res.ok) return;
      const data = await res.json();
      const currentProv = (
        savedSettings.system_ai_provider === 'orcarouter'
          ? 'orcarouter'
          : 'openrouter'
      ) as 'openrouter' | 'orcarouter';
      const provHealth = data?.[currentProv];
      if (provHealth?.status === 'healthy') {
        setIsLiveHealthy(true);
      } else if (
        provHealth?.status === 'unhealthy' ||
        provHealth?.status === 'unreachable'
      ) {
        setIsLiveHealthy(false);
      }
    } catch {
      // ignore
    }
  }, [savedSettings.system_ai_provider]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!loading) {
      checkLiveHealth();
    }
  }, [loading, checkLiveHealth]);

  // Combine default and custom models for selected provider
  const availableProviderModels = useMemo(() => {
    const defaultList =
      selectedProvider === 'orcarouter'
        ? DEFAULT_ORCAROUTER_MODELS
        : DEFAULT_OPENROUTER_MODELS;
    const customs = customModels.filter((m) => m.provider === selectedProvider);

    const merged = [...defaultList];
    customs.forEach((cm) => {
      if (!merged.some((m) => m.id === cm.id)) {
        merged.push(cm);
      }
    });

    return merged;
  }, [selectedProvider, customModels]);

  // Handle provider switch
  const handleProviderChange = (newProvider: 'openrouter' | 'orcarouter') => {
    setSelectedProvider(newProvider);
    setTestStatus(null);
    setApiKeyInput('');

    if (newProvider === 'orcarouter') {
      const currentModel = String(
        savedSettings.system_orcarouter_model || 'orcarouter/auto'
      );
      setSelectedModel(currentModel);
    } else {
      const currentModel = String(
        savedSettings.system_openrouter_model || 'google/gemini-2.5-flash'
      );
      setSelectedModel(currentModel);
    }
  };

  // Has saved key flag
  const hasStoredKey = Boolean(
    selectedProvider === 'orcarouter'
      ? savedSettings.has_system_orcarouter_api_key
      : savedSettings.has_system_openrouter_api_key
  );

  // Active (Current AI) summary info
  const activeProvider = (
    savedSettings.system_ai_provider === 'orcarouter'
      ? 'orcarouter'
      : 'openrouter'
  ) as 'openrouter' | 'orcarouter';
  const activeModelId = String(
    activeProvider === 'orcarouter'
      ? savedSettings.system_orcarouter_model || 'orcarouter/auto'
      : savedSettings.system_openrouter_model || 'google/gemini-2.5-flash'
  );

  const activeModelObj = useMemo(() => {
    const all = [
      ...DEFAULT_OPENROUTER_MODELS,
      ...DEFAULT_ORCAROUTER_MODELS,
      ...customModels,
    ];
    return all.find((m) => m.id === activeModelId);
  }, [activeModelId, customModels]);

  const activeModelName = activeModelObj ? activeModelObj.name : activeModelId;
  const hasCurrentConfig = Boolean(
    activeProvider === 'orcarouter'
      ? savedSettings.has_system_orcarouter_api_key
      : savedSettings.has_system_openrouter_api_key
  );

  // Test current connection (from top card)
  const testCurrentConnection = async () => {
    setIsTestingCurrent(true);
    try {
      const res = await fetch('/api/admin/ai/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          model: activeModelId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsLiveHealthy(true);
        toast.success(
          'Connection successful! Your AI service is ready to use.'
        );
      } else {
        setIsLiveHealthy(false);
        const errorMsg =
          data.error ||
          data.message ||
          'Please check your API key and try again.';
        toast.error(`Connection failed: ${errorMsg}`);
      }
    } catch (err) {
      setIsLiveHealthy(false);
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Please check your API key and try again.';
      toast.error(`Connection failed: ${errorMsg}`);
    } finally {
      setIsTestingCurrent(false);
    }
  };

  // Test form connection (from main form)
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    setTestErrorMessage(null);

    try {
      const res = await fetch('/api/admin/ai/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput.trim() || undefined,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestErrorMessage(null);
      } else {
        setTestStatus('error');
        setTestErrorMessage(
          data.error ||
            data.message ||
            'Please check your API key and try again.'
        );
      }
    } catch (err) {
      setTestStatus('error');
      setTestErrorMessage(
        err instanceof Error
          ? err.message
          : 'Please check your API key and try again.'
      );
    } finally {
      setIsTesting(false);
    }
  };

  // Add Custom Model
  const handleAddCustomModel = () => {
    const name = customModelName.trim();
    const id = customModelId.trim();

    if (!name) {
      setCustomModelError('Please enter a model name');
      return;
    }

    const validation = validateAiModelId(id, selectedProvider);
    if (!validation.valid) {
      setCustomModelError(validation.error || 'Invalid model ID format');
      return;
    }

    const newModel: ModelItem = {
      id: validation.normalizedId,
      name,
      provider: selectedProvider,
      enabled: true,
    };

    setCustomModels((prev) => {
      const filtered = prev.filter((m) => m.id !== newModel.id);
      return [...filtered, newModel];
    });

    setSelectedModel(newModel.id);
    setCustomModelName('');
    setCustomModelId('');
    setCustomModelError('');
    setIsCustomModelOpen(false);
    toast.success(`Custom model "${name}" added`);
  };

  // Save Settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        system_ai_provider: selectedProvider,
      };

      if (selectedProvider === 'openrouter') {
        payload.system_openrouter_model = selectedModel;
        if (apiKeyInput.trim()) {
          payload.system_openrouter_api_key = apiKeyInput.trim();
        }
      } else {
        payload.system_orcarouter_model = selectedModel;
        if (apiKeyInput.trim()) {
          payload.system_orcarouter_api_key = apiKeyInput.trim();
        }
      }

      if (customModels.length > 0) {
        payload.available_models = customModels;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save AI configuration');
      }

      toast.success('AI settings saved successfully');
      setApiKeyInput('');
      setTestStatus(null);
      await loadSettings();
    } catch {
      toast.error('Could not save AI settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminNav>
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      </AdminNav>
    );
  }

  return (
    <AdminNav>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Current AI Status Card */}
        <div className="border-border/60 bg-card/80 relative overflow-hidden rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
                  Active Platform Engine
                </span>
                {isLiveHealthy === true ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Connected & Live
                  </span>
                ) : hasCurrentConfig ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Configured
                  </span>
                ) : (
                  <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold">
                    <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full" />
                    Not Configured
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 pt-1">
                <div>
                  <div className="text-muted-foreground text-[11px]">
                    Provider
                  </div>
                  <div className="text-foreground text-sm font-semibold">
                    {activeProvider === 'orcarouter'
                      ? 'OrcaRouter'
                      : 'OpenRouter'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px]">Model</div>
                  <div
                    className="text-foreground max-w-[200px] truncate text-sm font-semibold"
                    title={activeModelId}
                  >
                    {activeModelName}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={testCurrentConnection}
                disabled={isTestingCurrent}
                className="h-8 rounded-lg text-xs font-medium"
              >
                {isTestingCurrent ? (
                  <Loader2 className="text-primary mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="text-primary mr-1.5 h-3.5 w-3.5" />
                )}
                Test Connection
              </Button>
            </div>
          </div>
        </div>

        {/* Main Setup Form */}
        <div className="border-border/60 bg-card/80 rounded-[1.35rem] border p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          <div className="space-y-6">
            {/* STEP 1 — AI PROVIDER */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-semibold">
                AI Provider
              </Label>
              <Select
                value={selectedProvider}
                onValueChange={(val) => {
                  if (val === 'openrouter' || val === 'orcarouter') {
                    handleProviderChange(val);
                  }
                }}
              >
                <SelectTrigger className="border-border/80 h-10 w-full rounded-xl text-xs">
                  <SelectValue placeholder="Select AI Provider" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  <SelectItem value="openrouter" className="text-xs">
                    OpenRouter
                  </SelectItem>
                  <SelectItem value="orcarouter" className="text-xs">
                    OrcaRouter
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* STEP 2 — API KEY */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-semibold">
                API Key
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={
                    hasStoredKey ? '••••••••••••••••••••••••' : 'Enter API Key'
                  }
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setTestStatus(null);
                  }}
                  className="border-border/80 h-10 rounded-xl pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1 transition-colors"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-muted-foreground flex items-center gap-1.5 pt-0.5 text-xs">
                <Shield className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                Your API key is encrypted and stored securely with AES-256-GCM.
              </p>
            </div>

            {/* STEP 3 — AI MODEL */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-semibold">
                AI Model
              </Label>
              <Select
                value={selectedModel}
                onValueChange={(val) => {
                  if (typeof val === 'string' && val) {
                    setSelectedModel(val);
                    setTestStatus(null);
                  }
                }}
              >
                <SelectTrigger className="border-border/80 h-10 w-full rounded-xl text-xs">
                  <SelectValue placeholder="Select AI Model" />
                </SelectTrigger>
                <SelectContent className="border-border/80 rounded-xl">
                  {availableProviderModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-foreground font-medium">
                          {m.name}
                        </span>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {m.id}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 4. ADD CUSTOM MODEL TRIGGER */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomModelError('');
                    setIsCustomModelOpen(true);
                  }}
                  className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Custom Model
                </button>
              </div>
            </div>

            {/* STEP 5 — TEST CONNECTION */}
            <div className="space-y-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="h-9 w-full rounded-xl text-xs font-medium sm:w-auto"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="text-primary mr-2 h-3.5 w-3.5 animate-spin" />
                    Testing connection...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>

              {testStatus === 'success' && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Connection successful
                    </div>
                    <div className="mt-0.5 text-emerald-700/90 dark:text-emerald-400">
                      Your AI service is operational and ready to process
                      requests.
                    </div>
                  </div>
                </div>
              )}

              {testStatus === 'error' && (
                <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-xl border p-3.5 text-xs">
                  <span className="text-destructive mt-0.5 shrink-0 text-base leading-none font-bold">
                    ✕
                  </span>
                  <div>
                    <div className="font-semibold">Connection failed</div>
                    <div className="mt-0.5 opacity-90">
                      {testErrorMessage ||
                        'Please check your API key and try again.'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 6 — SAVE SETTINGS */}
            <div className="border-border flex justify-end border-t pt-4">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 rounded-xl px-6 text-xs font-semibold"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save AI Configuration'
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Add Custom Model Dialog */}
        <Dialog open={isCustomModelOpen} onOpenChange={setIsCustomModelOpen}>
          <DialogContent className="border-border/60 bg-card rounded-2xl border p-6 shadow-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground text-base font-semibold">
                Add Custom Model
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Add a custom AI model identifier for{' '}
                {selectedProvider === 'openrouter'
                  ? 'OpenRouter'
                  : 'OrcaRouter'}
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="custom-model-name"
                  className="text-foreground text-xs font-medium"
                >
                  Model Display Name
                </Label>
                <Input
                  id="custom-model-name"
                  placeholder="e.g. Gemini 2.5 Flash Thinking"
                  value={customModelName}
                  onChange={(e) => {
                    setCustomModelName(e.target.value);
                    setCustomModelError('');
                  }}
                  className="border-border/80 h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="custom-model-id"
                  className="text-foreground text-xs font-medium"
                >
                  Model ID / Path
                </Label>
                <Input
                  id="custom-model-id"
                  placeholder={
                    selectedProvider === 'openrouter'
                      ? 'e.g. google/gemini-2.5-flash-preview'
                      : 'e.g. openai/gpt-4o'
                  }
                  value={customModelId}
                  onChange={(e) => {
                    setCustomModelId(e.target.value);
                    setCustomModelError('');
                  }}
                  className="border-border/80 h-9 rounded-xl font-mono text-xs"
                />
                {customModelError && (
                  <p className="text-destructive text-xs font-medium">
                    {customModelError}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCustomModelOpen(false)}
                className="h-8 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomModel}
                className="h-8 rounded-lg text-xs"
              >
                Add Model
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminNav>
  );
}
