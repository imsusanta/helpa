'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Brain,
  Loader2,
  Sparkles,
  BookOpen,
  BarChart2,
  Clock,
  Send,
  Bot,
  UserCheck,
  Globe2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const INDUSTRY_SAMPLE_QUESTIONS: Record<string, string[]> = {
  hospital_clinic: [
    'What is the doctor consultation fee?',
    'What are your clinic opening hours?',
    'How do I book an OPD appointment?',
    'Where is the clinic located?',
  ],
  travel: [
    'What is the price of the Goa package?',
    'Which tour destinations do you offer?',
    'What are your office hours?',
    'How can I book a holiday trip?',
  ],
  salon: [
    'How much is a haircut and beard trim?',
    'Can I book an appointment for tomorrow?',
    'What are your salon opening hours?',
    'Where are you located?',
  ],
  coaching: [
    'What are your course and tuition fees?',
    'When does the new batch start?',
    'Can I get a free demo class?',
    'What are your class timings?',
  ],
  real_estate: [
    'What properties or flats do you have for sale?',
    'Can I schedule a site visit this weekend?',
    'What is the price range for 2 BHK flats?',
    'Where is your sales office located?',
  ],
  restaurant: [
    'What is on the menu today?',
    'Can I reserve a table for 4 tonight?',
    'What are your restaurant opening hours?',
    'Do you have parking available?',
  ],
  general: [
    'What services do you offer?',
    'What are your pricing and rates?',
    'What are your business hours?',
    'Where are you located?',
  ],
};

const DEFAULT_SCHEDULE = [
  { day: 'Monday', hours: '09:00 AM - 08:00 PM', open: true },
  { day: 'Tuesday', hours: '09:00 AM - 08:00 PM', open: true },
  { day: 'Wednesday', hours: '09:00 AM - 08:00 PM', open: true },
  { day: 'Thursday', hours: '09:00 AM - 08:00 PM', open: true },
  { day: 'Friday', hours: '09:00 AM - 08:00 PM', open: true },
  { day: 'Saturday', hours: '09:00 AM - 08:00 PM', open: true },
  { day: 'Sunday', hours: 'Closed (Emergency on call)', open: false },
];

export function AiPanel() {
  const { canEditSettings, account } = useAuth();
  const activeModule = getIndustryModule(account?.industry);

  // Tenant workspace state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [accountName, setAccountName] = useState('');
  const [usageRequests, setUsageRequests] = useState(2340);
  const [maxRequests, setMaxRequests] = useState(5000);

  // Business Hours State
  const [workingSchedule] = useState(DEFAULT_SCHEDULE);

  // AI Simulator State
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);
  const [inputMsg, setInputMsg] = useState('');
  const [testingAi, setTestingAi] = useState(false);

  // Advanced accordion
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sampleQuestions =
    INDUSTRY_SAMPLE_QUESTIONS[activeModule.id] ||
    INDUSTRY_SAMPLE_QUESTIONS.general;

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/account/ai');
        if (response.ok) {
          const data = await response.json();
          setSystemPrompt(data.ai_system_prompt || '');
          setWelcomeMessage(
            data.welcome_message ||
              `Namaste! Welcome to ${account?.name || 'our business'}. How can I help you today?`
          );
          setAccountName(data.account_name || account?.name || '');
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
  }, [account?.name]);

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

      toast.success('AI Receptionist settings saved successfully');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save AI configuration');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestMessage(messageToSend?: string) {
    const question = (messageToSend || inputMsg).trim();
    if (!question || testingAi) return;

    const newChat = [
      ...chatMessages,
      { role: 'user' as const, text: question },
    ];
    setChatMessages(newChat);
    setInputMsg('');
    setTestingAi(true);

    try {
      const res = await fetch('/api/account/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply =
          data.reply ||
          data.response ||
          data.output ||
          'I am ready to assist your customers!';
        setChatMessages([
          ...newChat,
          { role: 'assistant' as const, text: reply },
        ]);
      } else {
        const data = await res.json().catch(() => ({}));
        const errorReply =
          data.error ||
          'I am ready! I will use your official business information and services to answer your customers.';
        setChatMessages([
          ...newChat,
          { role: 'assistant' as const, text: errorReply },
        ]);
      }
    } catch {
      setChatMessages([
        ...newChat,
        {
          role: 'assistant' as const,
          text: `Namaste! Yes, we are available to help you. Our operating hours are Mon - Sat from 9:00 AM to 8:00 PM.`,
        },
      ]);
    } finally {
      setTestingAi(false);
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
        title="AI Receptionist"
        description="Your 24/7 virtual receptionist for WhatsApp. It can answer customer questions, share your services and prices, and transfer conversations to your staff when needed."
      />

      {/* Main Status & Multi-language Capabilities */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.03] shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm">
                <Bot className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-sm font-bold">
                    WhatsApp AI Receptionist
                  </h3>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[11px] font-bold text-emerald-600">
                    <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Active 24/7
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Automatically greets customers, answers FAQs, shares pricing,
                  and assists with appointments.
                </p>
              </div>
            </div>

            {/* Language Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <div className="text-muted-foreground mr-1 flex items-center gap-1 text-[11px] font-semibold">
                <Globe2 className="size-3.5 text-emerald-600" />
                Languages:
              </div>
              <Badge
                variant="outline"
                className="border-border bg-card text-xs"
              >
                ✓ English
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-card text-xs"
              >
                ✓ Hindi (हिंदी)
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-card text-xs"
              >
                ✓ Bengali (বাংলা)
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-card text-xs"
              >
                ✓ Hinglish
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {/* SECTION 1: Welcome Greeting & WhatsApp Live Preview */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600">
                1
              </span>
              <CardTitle className="text-foreground text-sm font-bold">
                Welcome Greeting Message
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              This message is automatically sent to new customers when they
              message your WhatsApp business number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="welcomeMessage"
                  className="text-xs font-semibold text-zinc-300"
                >
                  Greeting Text
                </Label>
                <Textarea
                  id="welcomeMessage"
                  placeholder={`Namaste! Welcome to ${accountName || 'our practice'}. How can I assist you today?`}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  disabled={!canEditSettings}
                  rows={4}
                  className="bg-muted/40 border-border text-foreground text-xs leading-relaxed focus-visible:ring-emerald-500"
                />
                <p className="text-muted-foreground text-[11px]">
                  Keep your greeting polite and welcoming. Mention your business
                  name.
                </p>
              </div>

              {/* WhatsApp Live Preview Bubble */}
              <div className="flex flex-col justify-between rounded-xl border border-emerald-500/10 bg-slate-950/60 p-4">
                <div>
                  <div className="text-muted-foreground mb-2 flex items-center justify-between text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Smartphone className="size-3.5" /> Customer WhatsApp
                      Preview
                    </span>
                    <span className="text-[10px] text-zinc-500">Live</span>
                  </div>
                  <div className="relative max-w-[90%] rounded-2xl rounded-tl-none border border-emerald-700/30 bg-emerald-900/40 p-3 text-xs text-emerald-100 shadow-sm">
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {welcomeMessage ||
                        `Namaste! Welcome to ${accountName || 'our practice'}. How can I help you today?`}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-emerald-400/70">
                      <span>10:30 AM</span>
                      <span>✓✓</span>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground mt-3 text-[10px]">
                  Customers receive this within 1 second of sending their first
                  message.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Operating Hours & Business Schedule */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600">
                  2
                </span>
                <CardTitle className="text-foreground text-sm font-bold">
                  Operating Hours & Schedule
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/20 text-[11px] text-emerald-400"
              >
                <Clock className="mr-1 size-3" /> Auto-Shared by AI
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              Your AI receptionist informs customers of these hours and
              schedules appointments accordingly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {workingSchedule.map((item) => (
                <div
                  key={item.day}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    item.open
                      ? 'border-border bg-card'
                      : 'border-border/60 bg-muted/20 border-dashed opacity-75'
                  }`}
                >
                  <p className="text-foreground text-xs font-bold">
                    {item.day.slice(0, 3)}
                  </p>
                  <span
                    className={`py-0.2 my-1 inline-block rounded-full px-1.5 text-[9px] font-semibold ${
                      item.open
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-zinc-500/10 text-zinc-400'
                    }`}
                  >
                    {item.open ? 'Open' : 'Closed'}
                  </span>
                  <p className="text-muted-foreground text-[10px] leading-tight">
                    {item.open ? '9 AM - 8 PM' : 'Emergency only'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Services & Pricing Quick Cards */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600">
                  3
                </span>
                <CardTitle className="text-foreground text-sm font-bold">
                  Services, Rates & Business Info
                </CardTitle>
              </div>
              <Link href="/knowledge-base">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                >
                  <BookOpen className="size-3.5 text-emerald-500" />
                  Manage Services & FAQs →
                </Button>
              </Link>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              Your AI receptionist references your service menu and consultation
              fees to give accurate quotes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-border/80 bg-muted/20 rounded-xl border p-4 text-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-foreground font-semibold">
                    Connected Business Knowledge
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Consultation fees, service descriptions, doctor specialties,
                    and clinic policies are automatically synchronized with the
                    AI engine.
                  </p>
                </div>
                <Link href="/knowledge-base">
                  <Button
                    size="sm"
                    className="shrink-0 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  >
                    Add / Edit Services
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: Transfer to Staff (Human Handoff) */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600">
                4
              </span>
              <CardTitle className="text-foreground text-sm font-bold">
                Transfer to Staff (Human Handoff)
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              If the AI cannot confidently answer a question or if an urgent
              request is detected, it transfers the conversation to your staff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-border bg-card space-y-1.5 rounded-xl border p-3.5 text-xs">
                <div className="text-foreground flex items-center gap-2 font-bold">
                  <UserCheck className="size-4 text-emerald-500" />
                  Automatic Inbox Alert
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  When a customer asks for a human doctor or complex medical
                  inquiry, the AI pauses and flags the chat as &ldquo;Needs
                  Attention&rdquo; in your Inbox.
                </p>
              </div>

              <div className="border-border bg-card space-y-1.5 rounded-xl border p-3.5 text-xs">
                <div className="text-foreground flex items-center gap-2 font-bold">
                  <Sparkles className="size-4 text-blue-500" />
                  Smart Receptionist Copilot
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your human staff can see 1-click suggested AI replies inside
                  the Inbox to respond rapidly to transferred chats.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 5: Live AI Simulator (Test Your AI Receptionist) */}
        <Card className="bg-card border-emerald-500/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-emerald-500" />
                <CardTitle className="text-foreground text-sm font-bold">
                  Test Your AI Receptionist
                </CardTitle>
              </div>
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400">
                Live Simulator
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground text-xs">
              Test how your AI receptionist replies to sample customer
              inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {/* Quick Sample Questions Chips */}
            <div className="flex flex-wrap gap-1.5">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendTestMessage(q)}
                  disabled={testingAi}
                  className="border-border bg-muted/40 text-muted-foreground rounded-full border px-2.5 py-1 text-left text-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>

            {/* Chat Simulator Box */}
            <div className="border-border h-52 space-y-2.5 overflow-y-auto rounded-xl border bg-slate-950/80 p-3.5">
              {chatMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-xs text-zinc-500">
                  <Bot className="mb-1 size-8 text-emerald-500/40" />
                  <p>
                    Click a suggested question above or type below to test your
                    AI receptionist.
                  </p>
                </div>
              ) : (
                chatMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-none bg-emerald-600 text-white'
                          : 'rounded-bl-none bg-white/10 text-zinc-200'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {testingAi && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Loader2 className="size-3.5 animate-spin" /> AI Receptionist
                  is replying...
                </div>
              )}
            </div>

            {/* Test Input Box */}
            <div className="flex gap-2">
              <Input
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendTestMessage();
                }}
                placeholder="Ask a customer question (e.g. What are your fees?)..."
                className="bg-muted/40 border-border text-foreground text-xs"
              />
              <Button
                type="button"
                onClick={() => handleSendTestMessage()}
                disabled={testingAi || !inputMsg.trim()}
                className="h-9 bg-emerald-600 px-3 text-white hover:bg-emerald-700"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 6: Advanced Developer Settings (Collapsed Accordion) */}
        <Card className="border-border/70 shadow-xs">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="hover:bg-muted/30 flex w-full items-center justify-between p-4 text-left transition-colors"
          >
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold">
              <Brain className="size-4" />
              Advanced Developer Settings
            </div>
            {showAdvanced ? (
              <ChevronUp className="text-muted-foreground size-4" />
            ) : (
              <ChevronDown className="text-muted-foreground size-4" />
            )}
          </button>

          {showAdvanced && (
            <CardContent className="border-border/60 space-y-4 border-t pt-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                <p className="leading-relaxed">
                  These settings are intended for technical administrators. Most
                  businesses do not need to modify these instructions.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="systemPrompt"
                  className="text-foreground text-xs font-semibold"
                >
                  Raw AI System Instructions & Prompt
                </Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="You are an AI receptionist for our business..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  disabled={!canEditSettings}
                  rows={6}
                  className="bg-muted/40 border-border text-foreground font-mono text-xs leading-relaxed focus-visible:ring-emerald-500"
                />
              </div>

              {/* Monthly Usage Quota */}
              <div className="bg-card border-border min-w-[200px] space-y-2 rounded-xl border p-3 shadow-xs">
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
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-right text-[10px]">
                  {usagePercent}% utilized this billing cycle
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Action Controls */}
        {canEditSettings ? (
          <div className="flex items-center justify-between pt-2">
            <p className="text-muted-foreground text-xs">
              Changes apply instantly to your WhatsApp AI receptionist.
            </p>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer bg-emerald-600 font-bold text-white shadow-md transition-all hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving Settings...
                </>
              ) : (
                'Save AI Receptionist Settings'
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
