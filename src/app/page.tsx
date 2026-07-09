"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import {
  MessageSquare,
  ArrowRight,
  PlayCircle,
  Zap,
  CalendarCheck,
  UserPlus,
  HelpCircle,
  UserCheck,
  Globe2,
  BarChart3,
  Radio,
  RefreshCw,
  BookOpen,
  Stethoscope,
  GraduationCap,
  School,
  Scissors,
  Hotel,
  UtensilsCrossed,
  Building2,
  Store,
  ChevronDown,
  CheckCircle2,
  Menu,
  X,
  Inbox,
  Send,
  Settings,
  Users2,
  LineChart,
  Loader2,
  Sun,
  Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState("conversations");

  const { mode, toggleMode } = useTheme();

  // Load user session
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    checkAuth();
  }, []);

  return (
    <div className="bg-background text-foreground antialiased selection:bg-indigo-600 selection:text-white min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* Custom Styles for Animations & Selection */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        .float-anim {
          animation: floatAnim 6s ease-in-out infinite;
        }
        @keyframes floatAnim {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* ═══════ NAV ═══════ */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="#" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Helpa</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex font-medium">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#industries" className="transition-colors hover:text-foreground">Industries</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleMode}
              className="p-2 rounded-full border border-border bg-card hover:bg-accent text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>

            <Link href={user ? "/dashboard" : "/signup"} className="hidden rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:inline-block">
              {user ? "Go to Dashboard" : "Book a Demo"}
            </Link>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-lg border border-border p-2 md:hidden text-foreground bg-card hover:bg-accent transition-colors cursor-pointer" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border md:hidden bg-background/95 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-1 px-6 py-4">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground font-medium transition-colors">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground font-medium transition-colors">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground font-medium transition-colors">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground font-medium transition-colors">FAQ</a>
              <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-2 rounded-full bg-indigo-600 px-5 py-2.5 text-center text-sm font-medium text-white">
                {user ? "Go to Dashboard" : "Book a Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(79,70,229,0.12),transparent)]"></div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors duration-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Automated WhatsApp Assistant for Indian Service Businesses
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-foreground">
            Your AI Receptionist<br />on WhatsApp
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Helpa instantly replies to customer enquiries, books appointments, shares pricing details, and stays active 24/7 — so your team can focus on serving walk-in clients.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={user ? "/dashboard" : "/signup"} className="flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 shadow-sm shadow-indigo-600/10">
              Book a Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#demo" className="flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent shadow-sm">
              <PlayCircle className="h-4 w-4" /> Watch Demo
            </a>
          </div>
        </div>

        {/* Dashboard mockup (Keep dark theme for premium developer contrast) */}
        <div className="relative mx-auto mt-20 max-w-5xl float-anim">
          <div className="absolute -inset-10 -z-10 rounded-3xl bg-indigo-600/5 blur-3xl"></div>
          <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-950 dark:border-zinc-800 shadow-2xl transition-colors duration-300">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
              <span className="h-3 w-3 rounded-full bg-red-500/70"></span>
              <span className="h-3 w-3 rounded-full bg-yellow-500/70"></span>
              <span className="h-3 w-3 rounded-full bg-green-500/70"></span>
              <span className="ml-4 text-xs text-zinc-500">app.helpa.ai</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr]">
              <div className="space-y-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-200">Priya — New Enquiry</span>
                    <span className="text-zinc-500">WhatsApp</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Do you have appointment slots available this evening?</p>
                  <p className="mt-1 text-[11px] text-emerald-400">AI replied · 2m ago</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-200">Rahul — Rescheduling</span>
                    <span className="text-zinc-500">WhatsApp</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Can I shift my booking to tomorrow morning?</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Awaiting staff takeover</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-200">Mr. Sharma</span>
                    <span className="text-zinc-500">WhatsApp</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">What are your consultation charges?</p>
                  <p className="mt-1 text-[11px] text-emerald-400">AI replied · 5m ago</p>
                </div>
              </div>
              <div className="space-y-3 text-left text-zinc-100">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <p className="mb-3 text-xs text-zinc-500">Last 24 hours</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-black/40 p-2">
                      <p className="text-[11px] text-zinc-500">Total Chats</p>
                      <p className="text-lg font-semibold">182</p>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2">
                      <p className="text-[11px] text-zinc-500">Bookings</p>
                      <p className="text-lg font-semibold text-emerald-400">29</p>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2">
                      <p className="text-[11px] text-zinc-500">Enquiries</p>
                      <p className="text-lg font-semibold text-indigo-400">47</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-400">
                  <p className="mb-2 font-medium text-zinc-200">Upcoming Today</p>
                  <div className="flex justify-between"><span>Doctor consultation</span><span>5:30 PM</span></div>
                  <div className="mt-1 flex justify-between"><span>Hair treatment — Glow Salon</span><span>6:15 PM</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ TRUSTED BY ═══════ */}
      <section className="border-y border-border bg-muted/30 py-12 transition-colors duration-300">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by service businesses across India
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-6">
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm text-muted-foreground shadow-sm transition-colors">Clinics & Labs</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm text-muted-foreground shadow-sm transition-colors">Coaching Classes</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm text-muted-foreground shadow-sm transition-colors">Salons & Spas</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm text-muted-foreground shadow-sm transition-colors">Boutique Hotels</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm text-muted-foreground shadow-sm transition-colors">Real Estate Agents</div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Everything your WhatsApp reception needs</h2>
          <p className="mt-4 text-muted-foreground">Built specifically for customer-facing businesses that live on WhatsApp.</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Zap className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Instant AI Replies</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every customer enquiry gets an accurate, on-brand reply in seconds — 24/7, without fail.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><CalendarCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Appointment Booking</h3>
            <p className="mt-2 text-sm text-muted-foreground">Clients can book, reschedule, or cancel slots directly inside WhatsApp, synced to your calendar.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><UserPlus className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Lead & Enquiry Capture</h3>
            <p className="mt-2 text-sm text-muted-foreground">Names, phone numbers, and requirements are structured and saved from every chat conversation.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><HelpCircle className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">FAQ Automation</h3>
            <p className="mt-2 text-sm text-muted-foreground">Train Helpa once on your fees, timings, and business location — it replies instantly without getting tired.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><UserCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Human Takeover</h3>
            <p className="mt-2 text-sm text-muted-foreground">Complex or VIP chats route to your support team instantly, with the complete history attached.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Globe2 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Multi-language Support</h3>
            <p className="mt-2 text-sm text-muted-foreground">Helpa automatically detects if the user is texting in English, Hindi, or Bengali, and replies back in the same language.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><BarChart3 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Analytics Dashboard</h3>
            <p className="mt-2 text-sm text-muted-foreground">Monitor response speed, chat resolution rate, bookings, and customer inquiries in one clean panel.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Radio className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Broadcast Messages</h3>
            <p className="mt-2 text-sm text-muted-foreground">Send festival offers, reminders, and service updates to filtered customer lists with a single click.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-950/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><RefreshCw className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Follow-up Automation</h3>
            <p className="mt-2 text-sm text-muted-foreground">Remind clients of upcoming appointments or follow-up with cold leads automatically.</p>
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="border-y border-border bg-muted/30 py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Get started in under a day</h2>
            <p className="mt-4 text-muted-foreground">No coding or developers required. Connect, train, and go live.</p>
          </div>
          <div className="relative mt-16 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-border md:block"></div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">1</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">Connect WhatsApp Number</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">2</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">Upload Business Details</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">3</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">AI Starts Answering Chats</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">4</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">Monitor from CRM Panel</h3>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Built for Every Service Business</h2>
          <p className="mt-4 text-muted-foreground">Whether you operate one clinic or fifty coaching branches — Helpa handles the volume.</p>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Stethoscope className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Clinics & Hospitals</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><GraduationCap className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Coaching Institutes</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><School className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Schools & Colleges</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Scissors className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Salons & Spas</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Hotel className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Hotels & Guest Houses</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><UtensilsCrossed className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Restaurants & Cafes</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Building2 className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Real Estate Consultants</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-indigo-500/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><Store className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-foreground">Local Service Shops</span>
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE ═══════ */}
      <section className="border-y border-border bg-muted/30 py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">One dashboard. Total visibility.</h2>
            <p className="mt-4 text-muted-foreground">Manage conversations, schedule bookings, and track analytics — all in one place.</p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            <button onClick={() => setActiveTab("conversations")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'conversations' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Inbox className="h-3.5 w-3.5" /> Conversations</button>
            <button onClick={() => setActiveTab("knowledge")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'knowledge' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><BookOpen className="h-3.5 w-3.5" /> AI Knowledge Base</button>
            <button onClick={() => setActiveTab("contacts")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'contacts' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Users2 className="h-3.5 w-3.5" /> Contacts</button>
            <button onClick={() => setActiveTab("bookings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'bookings' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><CalendarCheck className="h-3.5 w-3.5" /> Bookings</button>
            <button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><LineChart className="h-3.5 w-3.5" /> Analytics</button>
            <button onClick={() => setActiveTab("broadcast")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Send className="h-3.5 w-3.5" /> Broadcasts</button>
            <button onClick={() => setActiveTab("settings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Settings className="h-3.5 w-3.5" /> Settings</button>
          </div>

          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl text-left transition-colors duration-300">
            {activeTab === 'conversations' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Total Chats</p><p className="mt-1 text-2xl font-bold text-foreground">12,847</p><p className="mt-1 text-xs text-emerald-600 font-medium">+34% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Bookings</p><p className="mt-1 text-2xl font-bold text-foreground">3,291</p><p className="mt-1 text-xs text-emerald-600 font-medium">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">AI Resolution Rate</p><p className="mt-1 text-2xl font-bold text-foreground">96.4%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Excellent</p></div>
              </div>
            )}
            {activeTab === 'knowledge' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Documents Trained</p><p className="mt-1 text-2xl font-bold text-foreground">47</p><p className="mt-1 text-xs text-emerald-600 font-medium">+6 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">FAQs Learned</p><p className="mt-1 text-2xl font-bold text-foreground">312</p><p className="mt-1 text-xs text-muted-foreground font-medium">Auto-updated</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Answer Accuracy</p><p className="mt-1 text-2xl font-bold text-foreground">98.2%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Verified</p></div>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Total Contacts</p><p className="mt-1 text-2xl font-bold text-foreground">8,291</p><p className="mt-1 text-xs text-emerald-600 font-medium">+143 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">New Enquiries</p><p className="mt-1 text-2xl font-bold text-foreground">621</p><p className="mt-1 text-xs text-muted-foreground font-medium">Auto-captured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Repeat Customers</p><p className="mt-1 text-2xl font-bold text-foreground">2,004</p><p className="mt-1 text-xs text-emerald-600 font-medium">+9% this month</p></div>
              </div>
            )}
            {activeTab === 'bookings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">This Month</p><p className="mt-1 text-2xl font-bold text-foreground">3,291</p><p className="mt-1 text-xs text-emerald-600 font-medium">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Upcoming Today</p><p className="mt-1 text-2xl font-bold text-foreground">29</p><p className="mt-1 text-xs text-muted-foreground font-medium">Live</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">No-shows</p><p className="mt-1 text-2xl font-bold text-foreground">4</p><p className="mt-1 text-xs text-amber-600 font-medium">Auto follow-up sent</p></div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Resolution Rate</p><p className="mt-1 text-2xl font-bold text-foreground">96.4%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Excellent</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Avg Response Time</p><p className="mt-1 text-2xl font-bold text-foreground">1.2s</p><p className="mt-1 text-xs text-emerald-600 font-medium">Instant</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">CSAT Score</p><p className="mt-1 text-2xl font-bold text-foreground">4.8 / 5</p><p className="mt-1 text-xs text-emerald-600 font-medium">+0.2 this month</p></div>
              </div>
            )}
            {activeTab === 'broadcast' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Messages Sent</p><p className="mt-1 text-2xl font-bold text-foreground">24,100</p><p className="mt-1 text-xs text-muted-foreground font-medium">This month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Open Rate</p><p className="mt-1 text-2xl font-bold text-foreground">91%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Above average</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Conversions</p><p className="mt-1 text-2xl font-bold text-foreground">1,840</p><p className="mt-1 text-xs text-emerald-600 font-medium">+22% this month</p></div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Active Numbers</p><p className="mt-1 text-2xl font-bold text-foreground">3</p><p className="mt-1 text-xs text-emerald-400 font-medium">All connected</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Team Members</p><p className="mt-1 text-2xl font-bold text-foreground">12</p><p className="mt-1 text-muted-foreground font-medium">Roles configured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Integrations</p><p className="mt-1 text-2xl font-bold text-foreground">7</p><p className="mt-1 text-emerald-600 font-medium">All synced</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground font-sans">Businesses that switch don't go back</h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3 text-left">
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-300">
            <p className="text-sm text-foreground font-medium leading-relaxed">"We used to miss 30–40% of patient enquiries after hospital hours. With Helpa, every WhatsApp message gets a response in seconds — appointment bookings are up 40%."</p>
            <p className="mt-6 text-xs font-semibold text-muted-foreground">Clinical Director, Multi-speciality Clinic</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-300">
            <p className="text-sm text-foreground font-medium leading-relaxed">"Booking classes and batch scheduling over WhatsApp is now completely automated. Our front desk finally stopped being crowded with calls."</p>
            <p className="mt-6 text-xs font-semibold text-muted-foreground">Founder, Coaching Centre</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-300">
            <p className="text-sm text-foreground font-medium leading-relaxed">"Our staff only steps in for complex customer cases now. Helpa quietly runs our guest reception desk on WhatsApp, all day, every day."</p>
            <p className="mt-6 text-xs font-semibold text-muted-foreground">GM, Boutique Hotel</p>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING (Converted to INR) ═══════ */}
      <section id="pricing" className="border-y border-border bg-muted/30 py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Simple, transparent pricing</h2>
            <p className="mt-4 text-muted-foreground">Choose a plan that fits your business volume. No hidden charges.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3 text-left">
            <div className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm transition-colors duration-300">
              <h3 className="text-lg font-bold text-foreground">Starter</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">For individual clinics, classrooms, and small shops getting started.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-foreground">₹1,999</span><span className="text-sm text-muted-foreground font-medium">/month</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />1 WhatsApp business number</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />1,500 chats / month</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Booking automation & FAQs</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Basic dashboard analytics</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Email & WhatsApp support</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-semibold text-foreground hover:bg-accent transition shadow-sm">
                Get Started
              </Link>
            </div>
            
            <div className="flex flex-col rounded-2xl border-2 border-indigo-600 bg-card p-7 shadow-xl shadow-indigo-600/5 relative transition-colors duration-300">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider">Most popular</span>
              <h3 className="text-lg font-bold text-foreground mt-2">Growth</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">For busy clinics, growing institutes, and multi-staff teams.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-foreground">₹4,999</span><span className="text-sm text-muted-foreground font-medium">/month</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />3 WhatsApp numbers</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />6,000 chats / month</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Lead capture & CRM sync</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Broadcasts & auto follow-ups</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Priority chat support</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/10">
                Start Free Trial
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm transition-colors duration-300">
              <h3 className="text-lg font-bold text-foreground">Enterprise</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">For hospitals, multiple franchise locations, and high volumes.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-foreground">Custom</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Unlimited numbers & high volume</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Custom LLM / AI receptionist training</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Dedicated setup manager</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />Custom SLA agreements</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />White-label option available</li>
              </ul>
              <a href="mailto:sales@helpa.ai" className="mt-8 rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-semibold text-foreground hover:bg-accent transition shadow-sm">Contact Sales</a>
            </div>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left shadow-sm transition-colors duration-300">
            <div>
              <p className="font-semibold text-foreground">Need custom integrations or high-volume plans?</p>
              <p className="mt-1 text-sm text-muted-foreground">Get in touch with us to configure custom workflows and routing for your organization.</p>
            </div>
            <a href="mailto:sales@helpa.ai" className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition shadow-sm">Contact Sales <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Frequently asked questions</h2>
        </div>
        <div className="mt-12 divide-y divide-border text-left">
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 1 ? null : 1)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">How does Helpa connect to our WhatsApp number?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 1 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 1 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl animate-in fade-in duration-200">
                Helpa connects directly using the official Meta WhatsApp Business Cloud API. You can continue using your existing business number — no SIM card changes or data migrations required. Setup takes only a few minutes.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 2 ? null : 2)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">How accurate are the AI assistant's replies?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 2 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 2 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl animate-in fade-in duration-200">
                Helpa strictly answers based on the knowledge documents, FAQs, timings, and pricing list you upload. It never makes up or guesses details. If a customer asks something outside the scope, Helpa quietly flags it for human staff takeover.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 3 ? null : 3)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">Can our staff step in and text the customer?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 3 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 3 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl animate-in fade-in duration-200">
                Yes, absolutely. A human takeover is built into Helpa. Your receptionist can click "Takeover" on the CRM dashboard to pause the AI and reply manually on the same thread anytime.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 4 ? null : 4)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">How is the billing calculated?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 4 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 4 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl animate-in fade-in duration-200">
                Pricing is based on monthly conversation volume and the features you need. There are no hidden per-message fees, and usage is always visible from your dashboard.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 5 ? null : 5)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">How long does it take to go live?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 5 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 5 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl animate-in fade-in duration-200">
                Most Indian businesses set up Helpa and go live in less than 24 hours. Just sign up, connect your WhatsApp channel, paste your business FAQs, and Helpa starts responding to customer chats immediately.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section id="demo" className="px-6 py-24">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(79,70,229,0.05),transparent)] p-14 text-center bg-card shadow-sm transition-colors duration-300">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Never miss another walk-in or enquiry</h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">Let Helpa manage your WhatsApp inbox 24/7 so you and your team can focus on the business.</p>
          <Link href={user ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 shadow-sm shadow-indigo-600/10">
            Book Your Free Demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border bg-card px-6 py-10 transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600"><MessageSquare className="h-3.5 w-3.5 text-white" /></div>
            <span className="font-semibold text-foreground">Helpa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-medium">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#industries" className="hover:text-foreground transition-colors">Industries</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="mailto:hello@helpa.ai" className="hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Helpa</p>
        </div>
      </footer>

    </div>
  );
}
