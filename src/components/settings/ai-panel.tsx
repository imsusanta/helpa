"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, Loader2, Sparkles, Key, Cpu, AlertCircle, CheckCircle2, ChevronRight, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const POPULAR_MODELS = [
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    badge: "Recommended",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    desc: "Lightning fast responses. Optimal choice for hospital receptionist tasks.",
    stats: "Speed: Ultra-Fast • Cost: Lowest"
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    badge: "Max Quality",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    desc: "Industry-leading reasoning and clinical instruction-following.",
    stats: "Speed: Fast • Cost: Premium"
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    badge: "Balanced",
    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    desc: "Open-source intelligence with high reasoning capabilities.",
    stats: "Speed: Fast • Cost: Low"
  }
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <section className="space-y-8 animate-in fade-in duration-300">
      
      {/* Premium Header */}
      <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-purple-950/20 via-background to-background border border-purple-500/10 rounded-2xl backdrop-blur-xl">
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <Brain className="h-8 w-8 text-purple-400 animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            AI Receptionist Autopilot
            <span className="text-[10px] font-bold tracking-widest uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
              Active
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Configure the neural engine that answers patient queries 24/7, schedules consultations, and dispatches diagnostic report PDFs.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Step 1: OpenRouter Credentials */}
        <div className="bg-card/30 border border-border/80 rounded-2xl p-6 space-y-4 hover:border-purple-500/20 transition-all duration-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-400 border border-purple-500/20">
              1
            </span>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Key className="size-4 text-purple-400" />
              OpenRouter Access Credentials
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
            Create an API key from{" "}
            <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold">
              openrouter.ai
            </a>{" "}
            to allow the system to call LLMs.
          </p>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="apiKey" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={hasApiKey ? "••••••••••••••••••••••••••••••••" : "sk-or-v1-..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!canEditSettings}
                className="max-w-md bg-muted/50 border-border focus-visible:ring-purple-500 text-foreground"
              />
            </div>
            {hasApiKey && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 max-w-md">
                <CheckCircle2 className="size-3.5" />
                OpenRouter Key is configured & securely encrypted in DB.
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Choose Model Engine */}
        <div className="bg-card/30 border border-border/80 rounded-2xl p-6 space-y-4 hover:border-purple-500/20 transition-all duration-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-400 border border-purple-500/20">
              2
            </span>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Cpu className="size-4 text-purple-400" />
              Model Select (Brain Power)
            </h3>
          </div>
          
          {/* Card list selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {POPULAR_MODELS.map((m) => {
              const isSelected = !isCustomModel && model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (canEditSettings) {
                      setIsCustomModel(false);
                      setModel(m.id);
                    }
                  }}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-36 ${
                    isSelected
                      ? "bg-purple-500/5 border-purple-500/40 ring-1 ring-purple-500/40"
                      : "bg-muted/30 border-border hover:border-border/100 hover:bg-muted/50"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {m.provider}
                      </span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2">
                      {m.desc}
                    </p>
                  </div>
                  <div className="text-[9px] font-bold text-purple-400 flex items-center gap-1">
                    <Zap className="h-3 w-3 shrink-0" />
                    {m.stats}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toggle Custom Model */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (canEditSettings) {
                  setIsCustomModel(!isCustomModel);
                  if (!isCustomModel) setModel("custom");
                  else setModel(POPULAR_MODELS[0].id);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-bold"
            >
              Custom Model ID
              <ChevronRight className={`h-3 w-3 transform transition-transform duration-200 ${isCustomModel ? "rotate-90" : ""}`} />
            </button>

            {isCustomModel && (
              <div className="mt-3 pl-4 border-l-2 border-purple-500/30 space-y-2 animate-in slide-in-from-left-2 duration-200">
                <Label htmlFor="customModelId" className="text-xs text-muted-foreground font-bold">
                  OpenRouter Model Identifier
                </Label>
                <Input
                  id="customModelId"
                  placeholder="e.g. deepseek/deepseek-chat or anthropic/claude-3-haiku"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  disabled={!canEditSettings}
                  className="max-w-md bg-muted/50 border-border focus-visible:ring-purple-500 text-foreground"
                />
              </div>
            )}
          </div>
        </div>

        {/* Step 3: AI System prompt guidelines */}
        <div className="bg-card/30 border border-border/80 rounded-2xl p-6 space-y-4 hover:border-purple-500/20 transition-all duration-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-400 border border-purple-500/20">
              3
            </span>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Brain className="size-4 text-purple-400" />
              AI System Instructions & Guidelines
            </h3>
          </div>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="systemPrompt" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                System Prompt Rules
              </Label>
              <Textarea
                id="systemPrompt"
                placeholder="You are an AI receptionist for City Hospital. Greet patients, schedule consultations, answer FAQs. NEVER diagnose diseases or recommend prescription medicines..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={!canEditSettings}
                rows={9}
                className="max-w-xl bg-muted/50 border-border focus-visible:ring-purple-500 text-foreground font-normal leading-relaxed text-xs resize-y"
              />
            </div>
            <div className="rounded-xl border border-purple-500/10 bg-purple-950/5 p-4 text-[11px] text-purple-200/90 space-y-2 max-w-xl">
              <p className="font-semibold text-purple-300 flex items-center gap-1">
                <Sparkles className="size-3.5 text-purple-400" />
                AI Receptionist Guidelines Recommendation:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[10px] text-muted-foreground">
                <li>Instruct the AI to check Doctor availabilities before suggesting bookings.</li>
                <li>Make it identify patients by their Phone Number or Patient ID when checking Lab Reports.</li>
                <li>Ensure strict medical guidelines: AI must politely decline giving diagnostics or recommending drugs.</li>
              </ul>
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
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition-all duration-200 shadow-md shadow-purple-600/10"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Saving Changes...
                  </>
                ) : (
                  "Save Autopilot Config"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={saving || testingConnection}
                className="border-border text-foreground hover:bg-muted font-bold cursor-pointer"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Testing API Link...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>

            {testResult && (
              <div
                className={`max-w-xl rounded-xl p-4 text-xs animate-in fade-in slide-in-from-top-1 duration-200 ${
                  testResult.success
                    ? "border border-green-500/20 bg-green-950/20 text-green-200"
                    : "border border-red-500/20 bg-red-950/20 text-red-200"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {testResult.success ? (
                    <CheckCircle2 className="size-4 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold mb-1">
                      {testResult.success ? "Connection Check Successful" : "Connection Check Failed"}
                    </p>
                    <p className="opacity-90 leading-relaxed whitespace-pre-wrap">{testResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            You do not have write access to edit AI settings.
          </p>
        )}

      </div>
    </section>
  );
}
