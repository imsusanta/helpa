"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState("conversations");

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
    <div className="bg-black text-white antialiased selection:bg-indigo-600 selection:text-white min-h-screen relative font-sans overflow-x-hidden">
      
      {/* Custom Styles for Animations & Selection */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        body {
          background-color: #000;
          color: #fff;
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
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="#" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">CareFlow</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#industries" className="transition-colors hover:text-white">Industries</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href={user ? "/dashboard" : "/signup"} className="hidden rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:inline-block">
              {user ? "Go to Dashboard" : "Book a Demo"}
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-lg border border-white/10 p-2 md:hidden text-white" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-white/5 md:hidden bg-black/95 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-1 px-6 py-4">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">FAQ</a>
              <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-2 rounded-full bg-indigo-600 px-5 py-2.5 text-center text-sm font-medium text-white">
                {user ? "Go to Dashboard" : "Book a Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(79,70,229,0.25),transparent)]"></div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            AI receptionist for WhatsApp-first businesses
          </div>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl text-white">
            Your AI Receptionist<br />for WhatsApp
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            CareFlow instantly answers customer questions, books appointments, captures leads, and works 24/7 — so your team can focus on running the business.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={user ? "/dashboard" : "/signup"} className="flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
              Book a Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#demo" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10">
              <PlayCircle className="h-4 w-4" /> Watch Demo
            </a>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative mx-auto mt-20 max-w-5xl float-anim">
          <div className="absolute -inset-10 -z-10 rounded-3xl bg-indigo-600/20 blur-3xl"></div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/70"></span>
              <span className="h-3 w-3 rounded-full bg-yellow-500/70"></span>
              <span className="h-3 w-3 rounded-full bg-green-500/70"></span>
              <span className="ml-4 text-xs text-zinc-500">app.careflow.ai</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr]">
              <div className="space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-100">Priya — New Lead</span>
                    <span className="text-zinc-500">WhatsApp</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Do you have slots this evening?</p>
                  <p className="mt-1 text-[11px] text-emerald-400">AI replied · 2m ago</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-100">Rahul — Follow up</span>
                    <span className="text-zinc-500">WhatsApp</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Can I reschedule to tomorrow?</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Awaiting reply</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-100">Mr. Sharma</span>
                    <span className="text-zinc-500">WhatsApp</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">What are your consultation charges?</p>
                  <p className="mt-1 text-[11px] text-emerald-400">AI replied · 5m ago</p>
                </div>
              </div>
              <div className="space-y-3 text-left">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-xs text-zinc-500">Last 24 hours</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-black/40 p-2">
                      <p className="text-[11px] text-zinc-500">Chats</p>
                      <p className="text-lg font-semibold">182</p>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2">
                      <p className="text-[11px] text-zinc-500">Bookings</p>
                      <p className="text-lg font-semibold text-emerald-400">29</p>
                    </div>
                    <div className="rounded-xl bg-black/40 p-2">
                      <p className="text-[11px] text-zinc-500">Leads</p>
                      <p className="text-lg font-semibold text-indigo-400">47</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-400">
                  <p className="mb-2 font-medium text-zinc-200">Upcoming Bookings</p>
                  <div className="flex justify-between"><span>Dental checkup</span><span>5:30 PM</span></div>
                  <div className="mt-1 flex justify-between"><span>Hair spa — Glow Salon</span><span>6:15 PM</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ TRUSTED BY ═══════ */}
      <section className="border-y border-white/5 py-12">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Trusted by service businesses everywhere
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-6">
          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-400">Clinics</div>
          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-400">Coaching Centres</div>
          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-400">Salons</div>
          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-400">Hotels</div>
          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-400">Real Estate</div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Everything your WhatsApp reception needs</h2>
          <p className="mt-4 text-zinc-400">Purpose-built for service businesses that live on WhatsApp.</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Zap className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Instant AI Replies</h3>
            <p className="mt-2 text-sm text-zinc-400">Every WhatsApp message gets a smart, on-brand reply in seconds — 24/7, no exceptions.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><CalendarCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Appointment Booking</h3>
            <p className="mt-2 text-sm text-zinc-400">Customers book, reschedule, or cancel directly inside the chat, synced to your calendar.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><UserPlus className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Lead Capture</h3>
            <p className="mt-2 text-sm text-zinc-400">Name, number, and intent are captured automatically from every conversation.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><HelpCircle className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">FAQ Automation</h3>
            <p className="mt-2 text-sm text-zinc-400">Train CareFlow once on your pricing, hours, and policies — it never gets tired of repeating them.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><UserCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Human Handoff</h3>
            <p className="mt-2 text-sm text-zinc-400">Complex or sensitive chats route to your team instantly, with full context attached.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Globe2 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Multi-language Support</h3>
            <p className="mt-2 text-sm text-zinc-400">CareFlow detects the customer's language and replies in kind, automatically.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><BarChart3 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Analytics Dashboard</h3>
            <p className="mt-2 text-sm text-zinc-400">Response times, resolution rate, bookings, and leads — all in one clean view.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Radio className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Broadcast Messages</h3>
            <p className="mt-2 text-sm text-zinc-400">Send reminders, offers, and updates to segmented lists in a single click.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><RefreshCw className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Follow-up Automation</h3>
            <p className="mt-2 text-sm text-zinc-400">No-shows and cold leads get automatic, well-timed nudges — no manual chasing.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-500/50">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><BookOpen className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-100">Knowledge Base Training</h3>
            <p className="mt-2 text-sm text-zinc-400">Upload docs, PDFs, and past chats. CareFlow keeps learning your business over time.</p>
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="border-y border-white/5 bg-zinc-950/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Live in under a day</h2>
            <p className="mt-4 text-zinc-400">No engineers required. Connect, upload, and go.</p>
          </div>
          <div className="relative mt-16 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-white/10 md:block"></div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0">1</div>
              <h3 className="text-center text-base font-medium text-zinc-100 md:text-left">Connect your WhatsApp</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0">2</div>
              <h3 className="text-center text-base font-medium text-zinc-100 md:text-left">Upload your business information</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0">3</div>
              <h3 className="text-center text-base font-medium text-zinc-100 md:text-left">AI starts replying automatically</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0">4</div>
              <h3 className="text-center text-base font-medium text-zinc-100 md:text-left">Monitor everything from one dashboard</h3>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Built for Every Service Business</h2>
          <p className="mt-4 text-zinc-400">One location or fifty — CareFlow scales with your WhatsApp volume.</p>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Stethoscope className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Clinics</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><GraduationCap className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Coaching Centres</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><School className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Schools</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Scissors className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Salons</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Hotel className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Hotels</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><UtensilsCrossed className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Restaurants</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Building2 className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Real Estate</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-indigo-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400"><Store className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-200">Local Businesses</span>
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE ═══════ */}
      <section className="border-y border-white/5 bg-zinc-950/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">One dashboard. Total visibility.</h2>
            <p className="mt-4 text-zinc-400">Conversations, bookings, and analytics — all in one place.</p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            <button onClick={() => setActiveTab("conversations")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'conversations' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><Inbox className="h-3.5 w-3.5" /> Conversations</button>
            <button onClick={() => setActiveTab("knowledge")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'knowledge' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><BookOpen className="h-3.5 w-3.5" /> AI Knowledge Base</button>
            <button onClick={() => setActiveTab("contacts")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'contacts' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><Users2 className="h-3.5 w-3.5" /> Contacts</button>
            <button onClick={() => setActiveTab("bookings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'bookings' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><CalendarCheck className="h-3.5 w-3.5" /> Bookings</button>
            <button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'analytics' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><LineChart className="h-3.5 w-3.5" /> Analytics</button>
            <button onClick={() => setActiveTab("broadcast")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'broadcast' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><Send className="h-3.5 w-3.5" /> Broadcast Campaigns</button>
            <button onClick={() => setActiveTab("settings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><Settings className="h-3.5 w-3.5" /> Settings</button>
          </div>

          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl text-left">
            {activeTab === 'conversations' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Conversations</p><p className="mt-1 text-2xl font-semibold">12,847</p><p className="mt-1 text-xs text-emerald-400">+34% this month</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Bookings</p><p className="mt-1 text-2xl font-semibold">3,291</p><p className="mt-1 text-xs text-emerald-400">+18% this month</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">AI Resolution Rate</p><p className="mt-1 text-2xl font-semibold">96.4%</p><p className="mt-1 text-xs text-emerald-400">Excellent</p></div>
              </div>
            )}
            {activeTab === 'knowledge' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Documents Trained</p><p className="mt-1 text-2xl font-semibold">47</p><p className="mt-1 text-xs text-emerald-400">+6 this week</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">FAQs Learned</p><p className="mt-1 text-2xl font-semibold">312</p><p className="mt-1 text-xs text-zinc-400">Auto-updated</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Answer Accuracy</p><p className="mt-1 text-2xl font-semibold">98.2%</p><p className="mt-1 text-xs text-emerald-400">Verified</p></div>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Total Contacts</p><p className="mt-1 text-2xl font-semibold">8,291</p><p className="mt-1 text-xs text-emerald-400">+143 this week</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">New Leads</p><p className="mt-1 text-2xl font-semibold">621</p><p className="mt-1 text-xs text-zinc-400">Auto-captured</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Repeat Customers</p><p className="mt-1 text-2xl font-semibold">2,004</p><p className="mt-1 text-xs text-emerald-400">+9% this month</p></div>
              </div>
            )}
            {activeTab === 'bookings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">This Month</p><p className="mt-1 text-2xl font-semibold">3,291</p><p className="mt-1 text-xs text-emerald-400">+18% this month</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Upcoming Today</p><p className="mt-1 text-2xl font-semibold">29</p><p className="mt-1 text-xs text-zinc-400">Live</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">No-shows</p><p className="mt-1 text-2xl font-semibold">4</p><p className="mt-1 text-xs text-yellow-400">Auto follow-up sent</p></div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Resolution Rate</p><p className="mt-1 text-2xl font-semibold">96.4%</p><p className="mt-1 text-xs text-emerald-400">Excellent</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Avg Response Time</p><p className="mt-1 text-2xl font-semibold">1.2s</p><p className="mt-1 text-xs text-emerald-400">Instant</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">CSAT Score</p><p className="mt-1 text-2xl font-semibold">4.8 / 5</p><p className="mt-1 text-xs text-emerald-400">+0.2 this month</p></div>
              </div>
            )}
            {activeTab === 'broadcast' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Messages Sent</p><p className="mt-1 text-2xl font-semibold">24,100</p><p className="mt-1 text-xs text-zinc-400">This month</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Open Rate</p><p className="mt-1 text-2xl font-semibold">91%</p><p className="mt-1 text-xs text-emerald-400">Above average</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Conversions</p><p className="mt-1 text-2xl font-semibold">1,840</p><p className="mt-1 text-xs text-emerald-400">+22% this month</p></div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Active Numbers</p><p className="mt-1 text-2xl font-semibold">3</p><p className="mt-1 text-xs text-emerald-400">All connected</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Team Members</p><p className="mt-1 text-2xl font-semibold">12</p><p className="mt-1 text-xs text-zinc-400">Roles configured</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs text-zinc-500">Integrations</p><p className="mt-1 text-2xl font-semibold">7</p><p className="mt-1 text-emerald-400">All synced</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Teams that switch don't go back</h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3 text-left">
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-200">"We used to miss 30–40% of WhatsApp enquiries after hours. With CareFlow, every message gets a response in seconds — bookings are up 40%."</p>
            <p className="mt-6 text-xs text-zinc-500">Owner, Multi-speciality Clinic</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-200">"Booking and rescheduling classes over WhatsApp is now fully automated. Our front desk finally stopped being a call center."</p>
            <p className="mt-6 text-xs text-zinc-500">Founder, Coaching Centre</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-200">"Our team only steps in for complex cases now. CareFlow quietly runs the front desk on WhatsApp, all day, every day."</p>
            <p className="mt-6 text-xs text-zinc-500">GM, Boutique Hotel</p>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="border-y border-white/5 bg-zinc-950/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Simple plans that grow with you</h2>
            <p className="mt-4 text-zinc-400">Transparent pricing. No surprise fees.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3 text-left">
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-7">
              <h3 className="text-lg font-semibold">Starter</h3>
              <p className="mt-1 text-sm text-zinc-400">For solo operators and small teams getting started with AI.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-semibold">$49</span><span className="text-sm text-zinc-500">/month</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />1 WhatsApp number</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />1,500 conversations / mo</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Appointment booking & FAQs</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Basic analytics</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Email support</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-zinc-200 transition hover:bg-white/10">
                Get Started
              </Link>
            </div>
            <div className="flex flex-col rounded-2xl border border-indigo-600 bg-indigo-600/[0.06] p-7 shadow-[0_0_60px_rgba(79,70,229,0.25)]">
              <span className="mb-3 w-fit rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-400">Most popular</span>
              <h3 className="text-lg font-semibold">Growth</h3>
              <p className="mt-1 text-sm text-zinc-400">For growing service businesses that live on WhatsApp.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-semibold">$129</span><span className="text-sm text-zinc-500">/month</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />3 WhatsApp numbers</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />6,000 conversations / mo</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Lead capture & CRM sync</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Broadcasts & follow-ups</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Priority support</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full bg-indigo-600 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-indigo-700">
                Start Free Trial
              </Link>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-7">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <p className="mt-1 text-sm text-zinc-400">For multi-location and high-volume WhatsApp operations.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-semibold">Custom</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Unlimited numbers & volume</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Custom AI training</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Dedicated success manager</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />Custom SLAs & security review</li>
                <li className="flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />White-label option</li>
              </ul>
              <a href="mailto:sales@careflow.ai" className="mt-8 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-zinc-200 transition hover:bg-white/10">Contact Sales</a>
            </div>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center sm:flex-row sm:text-left">
            <div>
              <p className="font-medium">Need volume pricing or a custom setup?</p>
              <p className="mt-1 text-sm text-zinc-400">Talk to our team about multi-location or high-volume WhatsApp flows.</p>
            </div>
            <a href="mailto:sales@careflow.ai" className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 text-white">Contact Sales <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Frequently asked questions</h2>
        </div>
        <div className="mt-12 divide-y divide-white/10 text-left">
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 1 ? null : 1)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-medium text-zinc-100">How does CareFlow integrate with WhatsApp?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform duration-300 ${activeFaq === 1 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 1 && (
              <div className="mt-3 text-sm text-zinc-400 animate-in fade-in duration-200">
                CareFlow connects through the official WhatsApp Business API. You keep your existing number — no migrations, no new SIMs. Setup takes minutes and we handle the technical configuration.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 2 ? null : 2)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-medium text-zinc-100">How accurate are the AI replies?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform duration-300 ${activeFaq === 2 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 2 && (
              <div className="mt-3 text-sm text-zinc-400 animate-in fade-in duration-200">
                CareFlow only answers from the business information you provide — pricing, services, hours, policies. It never improvises. Anything outside its knowledge is escalated to a human instead of guessed.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 3 ? null : 3)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-medium text-zinc-100">Can my team take over a conversation?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform duration-300 ${activeFaq === 3 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 3 && (
              <div className="mt-3 text-sm text-zinc-400 animate-in fade-in duration-200">
                Yes, anytime. Human handoff is built in. Your team can jump into any chat with one click and see the full conversation history and context immediately.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 4 ? null : 4)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-medium text-zinc-100">How is pricing calculated?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform duration-300 ${activeFaq === 4 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 4 && (
              <div className="mt-3 text-sm text-zinc-400 animate-in fade-in duration-200">
                Pricing is based on monthly conversation volume and the features you need. There are no hidden per-message fees, and usage is always visible from your dashboard.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 5 ? null : 5)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-medium text-zinc-100">How long does setup take?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform duration-300 ${activeFaq === 5 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 5 && (
              <div className="mt-3 text-sm text-zinc-400 animate-in fade-in duration-200">
                Most businesses go live within a day. Connect your WhatsApp, upload your FAQs and pricing, and CareFlow starts handling real conversations immediately.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section id="demo" className="px-6 py-24">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(79,70,229,0.3),transparent)] p-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">Never Miss Another Customer</h2>
          <p className="mx-auto mt-4 max-w-md text-zinc-400">Let CareFlow answer customers 24/7 while you focus on growing your business.</p>
          <Link href={user ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
            Book Your Free Demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/5 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600"><MessageSquare className="h-3.5 w-3.5 text-white" /></div>
            <span className="font-semibold text-white">CareFlow</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#industries" className="hover:text-white">Industries</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="mailto:hello@careflow.ai" className="hover:text-white">Contact</a>
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms</a>
          </div>
          <p className="text-sm text-zinc-600">© {new Date().getFullYear()} CareFlow</p>
        </div>
      </footer>

    </div>
  );
}
