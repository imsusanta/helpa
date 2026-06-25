"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, Loader2, Sparkles, Key, Cpu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";

const POPULAR_MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (Google)" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro (Google)" },
  { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B Instruct (Meta)" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (Meta)" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Anthropic)" },
];

export function AiPanel() {
  const { canEditSettings } = useAuth();
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelId, setCustomModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/account/ai");
        if (response.ok) {
          const data = await response.json();
          const dbModel = data.openrouter_model || "google/gemini-2.5-flash";
          setHasApiKey(data.has_api_key);
          setSystemPrompt(data.ai_system_prompt || "");
          
          const matched = POPULAR_MODELS.some(m => m.id === dbModel);
          if (matched) {
            setModel(dbModel);
            setIsCustomModel(false);
          } else {
            setIsCustomModel(true);
            setCustomModelId(dbModel);
            setModel("custom");
          }
        }
      } catch (err) {
        console.error("Failed to load AI config:", err);
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
      const response = await fetch("/api/account/ai", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openrouter_model: activeModel,
          ai_system_prompt: systemPrompt,
          ...(apiKey.trim() ? { openrouter_api_key: apiKey } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setHasApiKey(data.has_api_key);
      setApiKey(""); // clear password field after saving
      toast.success("AI Assistant configuration saved");
    } catch (err) {
      toast.error("Failed to save AI configuration");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/account/ai/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
        toast.success("AI connection check succeeded");
      } else {
        setTestResult({
          success: false,
          message: data.error || "Unknown connection error occurred.",
        });
        toast.error("AI connection check failed");
      }
    } catch (err) {
      console.error("Failed to test AI connection:", err);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to communicate with test endpoint",
      });
      toast.error("Failed to check AI connection");
    } finally {
      setTestingConnection(false);
    }
  }

  if (loading) {
    return (
      <section className="max-w-2xl animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="AI Assistant"
          description="Configure your LLM model using OpenRouter for automatic AI responses."
        />
        <Card className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </Card>
      </section>
    );
  }

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="AI Assistant"
        description="Connect your workspace to LLMs via OpenRouter. You can turn this on for specific customer conversations in the inbox to enable automatic AI support."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Brain className="size-4 text-purple-400" />
            OpenRouter Configuration
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            To use the AI Assistant, get an API key from{" "}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              openrouter.ai
            </a>
            . Any model listed on OpenRouter can be used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key */}
          <div className="grid gap-2">
            <Label htmlFor="apiKey" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Key className="size-3.5 text-muted-foreground" />
              OpenRouter API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={hasApiKey ? "••••••••••••••••••••••••••••••••" : "sk-or-v1-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!canEditSettings}
              className="max-w-md bg-muted text-foreground border-border placeholder:text-muted-foreground"
            />
            {hasApiKey && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                ✓ OpenRouter API Key is configured and encrypted.
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="model" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Cpu className="size-3.5 text-muted-foreground" />
                Select LLM Model
              </Label>
              <select
                id="model"
                value={isCustomModel ? "custom" : model}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "custom") {
                    setIsCustomModel(true);
                  } else {
                    setIsCustomModel(false);
                    setModel(val);
                  }
                }}
                disabled={!canEditSettings}
                className="h-9 w-full max-w-md rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {POPULAR_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="custom">Use custom model ID...</option>
              </select>
            </div>

            {/* Custom Model Input */}
            {isCustomModel && (
              <div className="grid gap-2 pl-4 border-l-2 border-purple-500/50">
                <Label htmlFor="customModelId" className="text-xs text-muted-foreground">
                  Custom Model ID (as specified on OpenRouter)
                </Label>
                <Input
                  id="customModelId"
                  placeholder="e.g. deepseek/deepseek-chat"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  disabled={!canEditSettings}
                  className="max-w-md bg-muted text-foreground border-border"
                />
              </div>
            )}
          </div>

          {/* System Instructions / Prompt */}
          <div className="grid gap-2">
            <Label htmlFor="systemPrompt" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Brain className="size-3.5 text-muted-foreground" />
              AI System Prompt & Knowledge Base
            </Label>
            <Textarea
              id="systemPrompt"
              placeholder="Enter instructions, FAQ answers, context, rules, and business details for the AI..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={!canEditSettings}
              rows={8}
              className="max-w-md bg-muted text-foreground border-border placeholder:text-muted-foreground resize-y min-h-[120px] text-xs font-normal"
            />
            <p className="text-[11px] text-muted-foreground max-w-md">
              Define the guidelines, context, rules, and business knowledge for the AI. The LLM will use this as its system prompt.
            </p>
          </div>

          {/* Helper Text */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-3 text-xs text-purple-200/90 flex items-start gap-2.5 max-w-md">
            <Sparkles className="size-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-purple-300">How to use:</span> Once configured here, navigate to any conversation in the inbox. You will see an <span className="font-semibold text-purple-300">AI ON/OFF</span> toggle in the header. Toggle it to **ON** to delegate replies to this model automatically.
            </div>
          </div>

          {/* Action Buttons */}
          {canEditSettings ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving || testingConnection}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={saving || testingConnection}
                  className="border-border text-foreground hover:bg-muted"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Testing Connection...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
              </div>

              {testResult && (
                <div
                  className={`max-w-md rounded-lg p-3 text-xs animate-in fade-in slide-in-from-top-1 duration-200 ${
                    testResult.success
                      ? "border border-green-500/20 bg-green-950/20 text-green-200"
                      : "border border-red-500/20 bg-red-950/20 text-red-200"
                  }`}
                >
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    {testResult.success ? "✓ Connection Successful" : "✗ Connection Failed"}
                  </p>
                  <p className="opacity-95 whitespace-pre-wrap leading-relaxed">{testResult.message}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only workspace administrators can manage AI settings.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
