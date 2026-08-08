'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare,
  MessageCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function WelcomePanel() {
  const { canEditSettings } = useAuth();
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/account/ai');
        if (response.ok) {
          const data = await response.json();
          setWelcomeMessage(data.welcome_message || '');
          setAccountName(data.account_name || '');
        }
      } catch (err) {
        console.error('Failed to load welcome message config:', err);
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
          welcome_message: welcomeMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success('Customizable welcome message saved successfully!');
    } catch (err) {
      toast.error('Failed to save welcome message');
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
    <section className="animate-in fade-in space-y-8 duration-300">
      {/* Header */}
      <div className="via-background to-background flex items-start gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 backdrop-blur-xl">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <MessageSquare className="h-8 w-8 text-emerald-600 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-extrabold">
            Customizable Welcome Message
            <span className="bg-muted text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
              Optional
            </span>
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Optionally customize the default opening greeting message sent to
            customers. If left blank, the AI will answer queries directly using
            your <strong>AI System Instructions & Guidelines</strong>.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-card border-border space-y-6 rounded-2xl border p-6 shadow-md">
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <div className="flex max-w-xl items-center justify-between">
              <Label
                htmlFor="welcomeMessage"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Welcome Message Text
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
              rows={5}
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

          {/* Live Preview Card */}
          <div className="max-w-xl space-y-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/5 p-4 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Live Preview (Customer View)
              </span>
              <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                WhatsApp Auto-Reply
              </span>
            </div>
            <div className="bg-card border-border text-foreground rounded-lg border p-3.5 text-xs leading-relaxed shadow-sm dark:bg-zinc-900">
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

        {/* Action Button */}
        {canEditSettings ? (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/10 transition-all duration-200 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving Welcome Message...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Save Welcome Message
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            You do not have write permissions to edit welcome message settings.
          </p>
        )}
      </div>
    </section>
  );
}
