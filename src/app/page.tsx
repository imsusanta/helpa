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
    <div className="bg-[#fafafa] text-zinc-900 antialiased selection:bg-indigo-600 selection:text-white min-h-screen relative font-sans overflow-x-hidden">
      
      {/* Custom Styles for Animations & Selection */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        body {
          background-color: #fafafa;
          color: #18181b;
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
      <header className="sticky top-0 z-50 border-b border-zinc-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="#" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-zinc-900">Helpa</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex font-medium">
            <a href="#features" className="transition-colors hover:text-zinc-900">Features</a>
            <a href="#industries" className="transition-colors hover:text-zinc-900">Industries</a>
            <a href="#pricing" className="transition-colors hover:text-zinc-900">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-zinc-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href={user ? "/dashboard" : "/signup"} className="hidden rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:inline-block">
              {user ? "Go to Dashboard" : "Book a Demo"}
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-lg border border-zinc-200 p-2 md:hidden text-zinc-700 bg-white hover:bg-zinc-50" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-zinc-200 md:hidden bg-white/95 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-1 px-6 py-4">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-medium">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-medium">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-medium">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-medium">FAQ</a>
              <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-2 rounded-full bg-indigo-600 px-5 py-2.5 text-center text-sm font-medium text-white">
                {user ? "Go to Dashboard" : "Book a Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(79,70,229,0.1),transparent)]"></div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Automated WhatsApp Assistant for Indian Service Businesses
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-zinc-900">
            Your AI Receptionist<br />on WhatsApp
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
            Helpa instantly replies to customer enquiries, books appointments, shares pricing details, and stays active 24/7 — so your team can focus on serving walk-in clients.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={user ? "/dashboard" : "/signup"} className="flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 shadow-sm">
              Book a Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#demo" className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-7 py-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 shadow-sm">
              <PlayCircle className="h-4 w-4" /> Watch Demo
            </a>
          </div>
        </div>

        {/* Dashboard mockup (Keep dark theme for premium contrast) */}
        <div className="relative mx-auto mt-20 max-w-5xl float-anim">
          <div className="absolute -inset-10 -z-10 rounded-3xl bg-indigo-600/5 blur-3xl"></div>
          <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-950 shadow-2xl">
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
      <section className="border-y border-zinc-200/60 py-12 bg-zinc-50/50">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Trusted by service businesses across India
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-6">
          <div className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm text-zinc-600 shadow-sm">Clinics & Labs</div>
          <div className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm text-zinc-600 shadow-sm">Coaching Classes</div>
          <div className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm text-zinc-600 shadow-sm">Salons & Spas</div>
          <div className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm text-zinc-600 shadow-sm">Boutique Hotels</div>
          <div className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm text-zinc-600 shadow-sm">Real Estate Agents</div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">Everything your WhatsApp reception needs</h2>
          <p className="mt-4 text-zinc-600">Built specifically for customer-facing businesses that live on WhatsApp.</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Zap className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Instant AI Replies</h3>
            <p className="mt-2 text-sm text-zinc-600">Every customer enquiry gets an accurate, on-brand reply in seconds — 24/7, without fail.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CalendarCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Appointment Booking</h3>
            <p className="mt-2 text-sm text-zinc-600">Clients can book, reschedule, or cancel slots directly inside WhatsApp, synced to your calendar.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UserPlus className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Lead & Enquiry Capture</h3>
            <p className="mt-2 text-sm text-zinc-600">Names, phone numbers, and requirements are structured and saved from every chat conversation.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><HelpCircle className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">FAQ Automation</h3>
            <p className="mt-2 text-sm text-zinc-600">Train Helpa once on your fees, timings, and business location — it replies instantly without getting tired.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UserCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Human Takeover</h3>
            <p className="mt-2 text-sm text-zinc-600">Complex or VIP chats route to your support team instantly, with the complete history attached.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Globe2 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Multi-language Support</h3>
            <p className="mt-2 text-sm text-zinc-600">Helpa automatically detects if the user is texting in English, Hindi, or Bengali, and replies back in the same language.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BarChart3 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Analytics Dashboard</h3>
            <p className="mt-2 text-sm text-zinc-600">Monitor response speed, chat resolution rate, bookings, and customer inquiries in one clean panel.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Radio className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Broadcast Messages</h3>
            <p className="mt-2 text-sm text-zinc-600">Send festival offers, reminders, and service updates to filtered customer lists with a single click.</p>
          </div>
          <div className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><RefreshCw className="h-5 w-5" /></div>
            <h3 className="font-semibold text-zinc-800 text-base">Follow-up Automation</h3>
            <p className="mt-2 text-sm text-zinc-600">Remind clients of upcoming appointments or follow-up with cold leads automatically.</p>
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="border-y border-zinc-200 bg-zinc-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">Get started in under a day</h2>
            <p className="mt-4 text-zinc-600">No coding or developers required. Connect, train, and go live.</p>
          </div>
          <div className="relative mt-16 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-zinc-200 md:block"></div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">1</div>
              <h3 className="text-center text-base font-semibold text-zinc-800 md:text-left">Connect WhatsApp Number</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">2</div>
              <h3 className="text-center text-base font-semibold text-zinc-800 md:text-left">Upload Business Details</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">3</div>
              <h3 className="text-center text-base font-semibold text-zinc-800 md:text-left">AI Starts Answering Chats</h3>
            </div>
            <div className="relative">
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white md:mx-0 shadow-sm">4</div>
              <h3 className="text-center text-base font-semibold text-zinc-800 md:text-left">Monitor from CRM Panel</h3>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">Built for Indian Service Businesses</h2>
          <p className="mt-4 text-zinc-600">Whether you operate one clinic or fifty coaching branches — Helpa handles the volume.</p>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Stethoscope className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Clinics & Hospitals</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><GraduationCap className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Coaching Institutes</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><School className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Schools & Colleges</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Scissors className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Salons & Spas</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Hotel className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Hotels & Guest Houses</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UtensilsCrossed className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Restaurants & Cafes</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Real Estate Consultants</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm hover:border-indigo-500/50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Store className="h-5 w-5" /></div>
            <span className="text-sm font-medium text-zinc-800">Local Service Shops</span>
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE ═══════ */}
      <section className="border-y border-zinc-200 bg-zinc-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">One dashboard. Total visibility.</h2>
            <p className="mt-4 text-zinc-600">Manage conversations, schedule bookings, and track analytics — all in one place.</p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            <button onClick={() => setActiveTab("conversations")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'conversations' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><Inbox className="h-3.5 w-3.5" /> Conversations</button>
            <button onClick={() => setActiveTab("knowledge")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'knowledge' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><BookOpen className="h-3.5 w-3.5" /> AI Knowledge Base</button>
            <button onClick={() => setActiveTab("contacts")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'contacts' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><Users2 className="h-3.5 w-3.5" /> Contacts</button>
            <button onClick={() => setActiveTab("bookings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'bookings' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><CalendarCheck className="h-3.5 w-3.5" /> Bookings</button>
            <button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><LineChart className="h-3.5 w-3.5" /> Analytics</button>
            <button onClick={() => setActiveTab("broadcast")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><Send className="h-3.5 w-3.5" /> Broadcasts</button>
            <button onClick={() => setActiveTab("settings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}><Settings className="h-3.5 w-3.5" /> Settings</button>
          </div>

          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl text-left">
            {activeTab === 'conversations' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Total Chats</p><p className="mt-1 text-2xl font-bold text-zinc-800">12,847</p><p className="mt-1 text-xs text-emerald-600 font-medium">+34% this month</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Bookings</p><p className="mt-1 text-2xl font-bold text-zinc-800">3,291</p><p className="mt-1 text-xs text-emerald-600 font-medium">+18% this month</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">AI Resolution Rate</p><p className="mt-1 text-2xl font-bold text-zinc-800">96.4%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Excellent</p></div>
              </div>
            )}
            {activeTab === 'knowledge' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Documents Trained</p><p className="mt-1 text-2xl font-bold text-zinc-800">47</p><p className="mt-1 text-xs text-emerald-600 font-medium">+6 this week</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">FAQs Learned</p><p className="mt-1 text-2xl font-bold text-zinc-800">312</p><p className="mt-1 text-xs text-zinc-500 font-medium">Auto-updated</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Answer Accuracy</p><p className="mt-1 text-2xl font-bold text-zinc-800">98.2%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Verified</p></div>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Total Contacts</p><p className="mt-1 text-2xl font-bold text-zinc-800">8,291</p><p className="mt-1 text-xs text-emerald-600 font-medium">+143 this week</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">New Enquiries</p><p className="mt-1 text-2xl font-bold text-zinc-800">621</p><p className="mt-1 text-xs text-zinc-500 font-medium">Auto-captured</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Repeat Customers</p><p className="mt-1 text-2xl font-bold text-zinc-800">2,004</p><p className="mt-1 text-xs text-emerald-600 font-medium">+9% this month</p></div>
              </div>
            )}
            {activeTab === 'bookings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">This Month</p><p className="mt-1 text-2xl font-bold text-zinc-800">3,291</p><p className="mt-1 text-xs text-emerald-600 font-medium">+18% this month</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Upcoming Today</p><p className="mt-1 text-2xl font-bold text-zinc-800">29</p><p className="mt-1 text-xs text-zinc-500 font-medium">Live</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">No-shows</p><p className="mt-1 text-2xl font-bold text-zinc-800">4</p><p className="mt-1 text-xs text-amber-600 font-medium">Auto follow-up sent</p></div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Resolution Rate</p><p className="mt-1 text-2xl font-bold text-zinc-800">96.4%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Excellent</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Avg Response Time</p><p className="mt-1 text-2xl font-bold text-zinc-800">1.2s</p><p className="mt-1 text-xs text-emerald-600 font-medium">Instant</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">CSAT Score</p><p className="mt-1 text-2xl font-bold text-zinc-800">4.8 / 5</p><p className="mt-1 text-xs text-emerald-600 font-medium">+0.2 this month</p></div>
              </div>
            )}
            {activeTab === 'broadcast' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Messages Sent</p><p className="mt-1 text-2xl font-bold text-zinc-800">24,100</p><p className="mt-1 text-xs text-zinc-500 font-medium">This month</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Open Rate</p><p className="mt-1 text-2xl font-bold text-zinc-800">91%</p><p className="mt-1 text-xs text-emerald-600 font-medium">Above average</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Conversions</p><p className="mt-1 text-2xl font-bold text-zinc-800">1,840</p><p className="mt-1 text-xs text-emerald-600 font-medium">+22% this month</p></div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Active Numbers</p><p className="mt-1 text-2xl font-bold text-zinc-800">3</p><p className="mt-1 text-xs text-emerald-600 font-medium">All connected</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Team Members</p><p className="mt-1 text-2xl font-bold text-zinc-800">12</p><p className="mt-1 text-xs text-zinc-500 font-medium">Roles configured</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><p className="text-xs text-zinc-500 font-semibold">Integrations</p><p className="mt-1 text-2xl font-bold text-zinc-800">7</p><p className="mt-1 text-emerald-600 font-medium">All synced</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900 font-sans">Businesses that switch don't go back</h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3 text-left">
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-700 font-medium leading-relaxed">"We used to miss 30–40% of patient enquiries after hospital hours. With Helpa, every WhatsApp message gets a reply in seconds — appointment bookings are up 40%."</p>
            <p className="mt-6 text-xs font-semibold text-zinc-400">Clinical Director, Multi-speciality Clinic</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-700 font-medium leading-relaxed">"Booking classes and batch scheduling over WhatsApp is now completely automated. Our front desk finally stopped being crowded with calls."</p>
            <p className="mt-6 text-xs font-semibold text-zinc-400">Founder, Coaching Centre</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-700 font-medium leading-relaxed">"Our staff only steps in for complex customer cases now. Helpa quietly runs our guest reception desk on WhatsApp, all day, every day."</p>
            <p className="mt-6 text-xs font-semibold text-zinc-400">GM, Boutique Hotel</p>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING (Converted to INR) ═══════ */}
      <section id="pricing" className="border-y border-zinc-200 bg-zinc-50/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">Simple, transparent pricing</h2>
            <p className="mt-4 text-zinc-600">Choose a plan that fits your business volume. No hidden charges.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3 text-left">
            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-800">Starter</h3>
              <p className="mt-1 text-sm text-zinc-500 leading-relaxed">For individual clinics, classrooms, and small shops getting started.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-zinc-900">₹1,999</span><span className="text-sm text-zinc-400 font-medium">/month</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />1 WhatsApp business number</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />1,500 chats / month</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Booking automation & FAQs</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Basic dashboard analytics</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Email & WhatsApp support</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 shadow-sm">
                Get Started
              </Link>
            </div>
            
            <div className="flex flex-col rounded-2xl border-2 border-indigo-600 bg-white p-7 shadow-xl shadow-indigo-600/5 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider">Most popular</span>
              <h3 className="text-lg font-bold text-zinc-800 mt-2">Growth</h3>
              <p className="mt-1 text-sm text-zinc-500 leading-relaxed">For busy clinics, growing institutes, and multi-staff teams.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-zinc-900">₹4,999</span><span className="text-sm text-zinc-400 font-medium">/month</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />3 WhatsApp numbers</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />6,000 chats / month</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Lead capture & CRM sync</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Broadcasts & auto follow-ups</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Priority chat support</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/10">
                Start Free Trial
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-800">Enterprise</h3>
              <p className="mt-1 text-sm text-zinc-500 leading-relaxed">For hospitals, multiple franchise locations, and high volumes.</p>
              <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-zinc-900">Custom</span></div>
              <ul className="mt-6 space-y-3 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Unlimited numbers & high volume</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Custom LLM / AI receptionist training</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Dedicated setup manager</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />Custom SLA agreements</li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />White-label option available</li>
              </ul>
              <a href="mailto:sales@helpa.ai" className="mt-8 rounded-full border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 shadow-sm">Contact Sales</a>
            </div>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-center sm:flex-row sm:text-left shadow-sm">
            <div>
              <p className="font-semibold text-zinc-800">Need custom integrations or high-volume plans?</p>
              <p className="mt-1 text-sm text-zinc-500">Get in touch with us to configure custom workflows and routing for your organization.</p>
            </div>
            <a href="mailto:sales@helpa.ai" className="flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm">Contact Sales <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">Frequently asked questions</h2>
        </div>
        <div className="mt-12 divide-y divide-zinc-200 text-left">
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 1 ? null : 1)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-zinc-800">How does Helpa connect to our WhatsApp number?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${activeFaq === 1 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 1 && (
              <div className="mt-3 text-sm text-zinc-600 bg-zinc-50 p-4 rounded-xl animate-in fade-in duration-200">
                Helpa connects directly using the official Meta WhatsApp Business Cloud API. You can continue using your existing business number — no SIM card changes or data migrations required. Setup takes only a few minutes.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 2 ? null : 2)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-zinc-800">How accurate are the AI assistant's replies?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${activeFaq === 2 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 2 && (
              <div className="mt-3 text-sm text-zinc-600 bg-zinc-50 p-4 rounded-xl animate-in fade-in duration-200">
                Helpa strictly answers based on the knowledge documents, FAQs, timings, and pricing list you upload. It never makes up or guesses details. If a customer asks something outside the scope, Helpa quietly flags it for human staff takeover.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 3 ? null : 3)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-zinc-800">Can our staff step in and text the customer?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${activeFaq === 3 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 3 && (
              <div className="mt-3 text-sm text-zinc-600 bg-zinc-50 p-4 rounded-xl animate-in fade-in duration-200">
                Yes, absolutely. A human takeover is built into Helpa. Your receptionist can click "Takeover" on the CRM dashboard to pause the AI and reply manually on the same thread anytime.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 4 ? null : 4)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-zinc-800">How is the billing calculated?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${activeFaq === 4 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 4 && (
              <div className="mt-3 text-sm text-zinc-600 bg-zinc-50 p-4 rounded-xl animate-in fade-in duration-200">
                Pricing is billed as a flat monthly subscription based on the plan you select. There are no hidden fees per text message, and your usage stats are clearly tracked in the dashboard.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 5 ? null : 5)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-zinc-800">How long does it take to go live?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${activeFaq === 5 ? 'rotate-180' : ''}`} />
            </button>
            {activeFaq === 5 && (
              <div className="mt-3 text-sm text-zinc-600 bg-zinc-50 p-4 rounded-xl animate-in fade-in duration-200">
                Most Indian businesses set up Helpa and go live in less than 24 hours. Just sign up, connect your WhatsApp channel, paste your business FAQs, and Helpa starts responding to customer chats immediately.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section id="demo" className="px-6 py-24">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-zinc-200 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(79,70,229,0.05),transparent)] p-14 text-center bg-white shadow-sm">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-zinc-900">Never miss another walk-in or enquiry</h2>
          <p className="mx-auto mt-4 max-w-md text-zinc-600">Let Helpa manage your WhatsApp inbox 24/7 so you and your team can focus on the business.</p>
          <Link href={user ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 shadow-sm">
            Book Your Free Demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-zinc-200 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600"><MessageSquare className="h-3.5 w-3.5 text-white" /></div>
            <span className="font-semibold text-zinc-800">Helpa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500 font-medium">
            <a href="#features" className="hover:text-zinc-900">Features</a>
            <a href="#industries" className="hover:text-zinc-900">Industries</a>
            <a href="#pricing" className="hover:text-zinc-900">Pricing</a>
            <a href="mailto:hello@helpa.ai" className="hover:text-zinc-900">Contact</a>
            <a href="#" className="hover:text-zinc-900">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-900">Terms</a>
          </div>
          <p className="text-sm text-zinc-400">© {new Date().getFullYear()} Helpa</p>
        </div>
      </footer>

    </div>
  );
}
