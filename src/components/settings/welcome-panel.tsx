"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, MessageCircle, Loader2, Sparkles, RotateCcw, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WelcomePanel() {
  const { canEditSettings } = useAuth();
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/account/ai");
        if (response.ok) {
          const data = await response.json();
          setWelcomeMessage(data.welcome_message || "");
        }
      } catch (err) {
        console.error("Failed to load welcome message config:", err);
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
      const response = await fetch("/api/account/ai", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          welcome_message: welcomeMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success("Customizable welcome message saved successfully!");
    } catch (err) {
      toast.error("Failed to save welcome message");
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

  return (
    <section className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-emerald-500/10 via-background to-background border border-emerald-500/20 rounded-2xl backdrop-blur-xl">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <MessageSquare className="h-8 w-8 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            Customizable Welcome Message
            <span className="text-[10px] font-bold tracking-widest uppercase bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              Optional
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Optionally customize the default opening greeting message sent to customers. If left blank, the AI will answer queries directly using your <strong>AI System Instructions & Guidelines</strong>.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-md">
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between max-w-xl">
              <Label htmlFor="welcomeMessage" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Welcome Message Text
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {welcomeMessage.length} characters
              </span>
            </div>
            <Textarea
              id="welcomeMessage"
              placeholder="👋 Hello! Welcome to our reception desk. How can we assist you today? You can ask about doctor schedules, book an appointment, or check lab report status."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              disabled={!canEditSettings}
              rows={5}
              className="max-w-xl bg-muted/40 border-border focus-visible:ring-emerald-500 text-foreground font-normal leading-relaxed text-xs resize-y"
            />
          </div>

          {/* Quick Presets */}
          {canEditSettings && (
            <div className="space-y-2 max-w-xl">
              <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
                Quick Presets & Templates:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7 cursor-pointer border-border hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  onClick={() => setWelcomeMessage("👋 Hello! Welcome to our Hospital & Clinic reception. 🏥 How can we assist you today? You can ask for Doctor schedules, book an appointment, or check report status.")}
                >
                  🏥 Hospital & Clinic
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7 cursor-pointer border-border hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  onClick={() => setWelcomeMessage("👋 Welcome to our Coaching Institute! 🏫 How can we help you with your studies, course information, or exam preparation today?")}
                >
                  🏫 Coaching & Education
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7 cursor-pointer border-border hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  onClick={() => setWelcomeMessage("👋 Hi there! Welcome to our business. 🚀 How can our team assist you today?")}
                >
                  🏢 General Business
                </Button>
                {welcomeMessage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                    onClick={() => setWelcomeMessage("")}
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Live Preview Card */}
          <div className="max-w-xl rounded-xl border border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Live Preview (Customer View)
              </span>
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                WhatsApp Auto-Reply
              </span>
            </div>
            <div className="bg-card dark:bg-zinc-900 border border-border p-3.5 rounded-lg text-xs leading-relaxed shadow-sm text-foreground">
              {welcomeMessage.trim() ? (
                <p className="whitespace-pre-wrap">{welcomeMessage}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  "👋 Hello! Welcome to our reception desk. How can we assist you today?"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {canEditSettings ? (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all duration-200 shadow-md shadow-emerald-600/10"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Saving Welcome Message...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-1.5" />
                  Save Welcome Message
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            You do not have write permissions to edit welcome message settings.
          </p>
        )}
      </div>
    </section>
  );
}
