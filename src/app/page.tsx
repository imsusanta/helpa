"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import {
  Brain,
  MessageSquare,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Menu,
  X,
  Stethoscope,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  FileText,
  UserCheck,
  Check,
  Sun,
  Moon,
  Clock,
  Activity,
  ArrowRightLeft,
  Database,
  Building,
  User,
  Share2,
  FileCheck,
  Heart,
  Users,
  Smartphone,
  PhoneCall,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  clinic: string;
  avatar: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Our front desk phone queries dropped by 70%. The AI handles appointment slotting and pathology report PDFs on WhatsApp effortlessly.",
    author: "Dr. Elena Rostova",
    role: "Clinical Director",
    clinic: "Metro Health Clinic",
    avatar: "ER",
  },
  {
    quote: "Patients are amazed when they receive their lab test PDFs instantly on WhatsApp. No more long queues at the reception desk just to collect paper reports.",
    author: "Susanta Lohar",
    role: "System Admin",
    clinic: "Apollo Diagnostics & Labs",
    avatar: "SL",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Pricing toggle (monthly vs yearly)
  const [isYearly, setIsYearly] = useState(false);

  // ROI Calculator State
  const [monthlyPatients, setMonthlyPatients] = useState(600);

  // Theme support
  const { mode, setMode } = useTheme();

  // Active feature tab for showcase
  const [activeTab, setActiveTab] = useState<"ai" | "reports" | "queue" | "takeover">("ai");

  // WhatsApp Interactive Simulator State
  const [simStep, setSimStep] = useState(0);
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    {
      sender: "bot",
      text: "Namaste! Welcome to CareFlow Clinic. I am your AI Assistant. How can I help you today?",
      time: "10:30 AM",
    },
  ]);
  const [simTyping, setSimTyping] = useState(false);
  const [dbLogs, setDbLogs] = useState<string[]>([
    "System Initialized: AI Receptionist listening on WhatsApp Cloud API port 443..."
  ]);

  // Load user session and force light mode first if no theme stored yet
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    checkAuth();

    // Default to light mode if no custom theme is stored in localStorage
    if (typeof window !== "undefined") {
      const storedMode = localStorage.getItem("wacrm:mode");
      if (!storedMode) {
        setMode("light");
      }
    }
  }, [setMode]);

  // Simulator Interactive Click Handler
  const handleSimReply = (questionText: string, botResponseText: string, logAction: string, nextStep: number) => {
    if (simTyping) return;
    
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSimMessages((prev) => [...prev, { sender: "user", text: questionText, time: now }]);
    setDbLogs((prev) => [...prev, `[Inbound Event] Received patient message: "${questionText}"`]);
    setSimStep(nextStep);
    
    setSimTyping(true);
    setTimeout(() => {
      setSimMessages((prev) => [...prev, { sender: "bot", text: botResponseText, time: now }]);
      setDbLogs((prev) => [
        ...prev,
        `[NLP Engine] Parsing query intent using LLM...`,
        logAction,
        `[Outbound Event] WhatsApp auto-reply dispatched via Cloud API.`
      ]);
      setSimTyping(false);
    }, 1200);
  };

  const resetSimulator = () => {
    setSimStep(0);
    setSimMessages([
      {
        sender: "bot",
        text: "Namaste! Welcome to CareFlow Clinic. I am your AI Assistant. How can I help you today?",
        time: "10:30 AM",
      },
    ]);
    setDbLogs([
      "System Initialized: AI Receptionist listening on WhatsApp Cloud API port 443..."
    ]);
  };

  // ROI computations (localized values)
  const calculatedSavings = useMemo(() => {
    const hoursSaved = Math.round(monthlyPatients * 0.2); // 12 minutes (0.2h) saved per patient query/call
    const responseTimeDrop = "98%"; 
    const monthlyReturn = Math.round(monthlyPatients * 250); // average ₹250 recovery per patient saved from unanswered calls/dropouts
    return { hoursSaved, responseTimeDrop, monthlyReturn };
  }, [monthlyPatients]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-emerald-500/20">
      
      {/* Mesh Glow Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:24px_36px]" />
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Floating Header */}
      <div className="sticky top-0 z-50 w-full flex flex-col items-center px-4 pt-4 pointer-events-none">
        <header className="w-full max-w-5xl rounded-full border border-border/80 bg-background/60 backdrop-blur-xl shadow-lg shadow-black/[0.02] dark:shadow-black/[0.1] transition-all duration-300 pointer-events-auto">
          <div className="flex items-center justify-between py-2 px-5 sm:px-6">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-500/20 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
                <Stethoscope className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-sm text-foreground tracking-tight sm:text-base">
                CareFlow<span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] ml-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">HOSPITAL AI</span>
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 p-0.5 rounded-full bg-muted/40 border border-border/40">
              <a href="#hook" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">The Hook</a>
              <a href="#features" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">Capabilities</a>
              <a href="#demo" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">Live Simulator</a>
              <a href="#calculator" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">ROI Calc</a>
              <a href="#pricing" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">Pricing</a>
            </nav>

            {/* Header Right Actions */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground rounded-full border border-border bg-card/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {mode === "dark" ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4 text-emerald-600" />}
              </button>

              {user ? (
                <Link href="/dashboard">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer rounded-full hover:scale-105 active:scale-95 transition-all px-4">
                    Dashboard <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200 mr-1.5">
                    Sign In
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer rounded-full hover:scale-105 active:scale-95 transition-all px-4">
                      Try Free
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Icon */}
            <button
              type="button"
              className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-full transition-transform active:scale-90"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="w-full max-w-5xl mt-2 border border-border/60 bg-card/90 backdrop-blur-lg p-5 space-y-4 rounded-3xl animate-in slide-in-from-top-4 duration-200 shadow-xl pointer-events-auto">
            <nav className="flex flex-col gap-2 font-semibold text-muted-foreground">
              <a href="#hook" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">The Hook</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">Capabilities</a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">Live Simulator</a>
              <a href="#calculator" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">ROI Calc</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">Pricing</a>
            </nav>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  setMode(mode === "dark" ? "light" : "dark");
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-between border border-border p-2.5 rounded-2xl text-xs font-semibold"
              >
                <span>Active Theme Mode</span>
                {mode === "dark" ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4 text-emerald-600" />}
              </button>
              {user ? (
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-emerald-600 text-white font-bold rounded-2xl">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-center font-bold py-2 text-muted-foreground">
                    Sign In
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-emerald-600 text-white font-bold rounded-2xl">
                      Start Free Trial
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="relative z-10">

        {/* Hero Section */}
        <section id="hook" className="relative px-4 pt-16 pb-28 md:pt-24 md:pb-36 lg:px-8 overflow-hidden">
          
          {/* Custom style for floating visuals */}
          <style>{`
            @keyframes float-1 {
              0%, 100% { transform: translateY(0px) rotate(1deg); }
              50% { transform: translateY(-12px) rotate(-1deg); }
            }
            @keyframes float-2 {
              0%, 100% { transform: translateY(0px) rotate(-1.5deg); }
              50% { transform: translateY(-16px) rotate(1deg); }
            }
            @keyframes float-3 {
              0%, 100% { transform: translateY(0px) rotate(0.5deg); }
              50% { transform: translateY(-8px) rotate(-0.5deg); }
            }
            .animate-float-1 {
              animation: float-1 7s ease-in-out infinite;
            }
            .animate-float-2 {
              animation: float-2 9s ease-in-out infinite;
            }
            .animate-float-3 {
              animation: float-3 8s ease-in-out infinite;
            }
          `}</style>

          <div className="container mx-auto max-w-7xl">
            
            {/* Split hero layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center text-left">
              
              {/* Left Column: Headline, Subheadline & CTAs */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* Glowing Hook Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                  98% of Indian patients prefer WhatsApp over phone calls
                </div>

                {/* Massive Hook Headline */}
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl leading-tight text-foreground">
                  Why make patients wait in line when they can check-in on <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(16,185,129,0.15)]">WhatsApp?</span>
                </h1>

                {/* Supporting Subheadline */}
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl">
                  CareFlow is the digital reception desk for Indian hospitals & clinics. Triage symptoms, dispatch pathology report PDFs, and coordinate token queues 24/7 on WhatsApp without stressing your receptionist.
                </p>

                {/* Hero CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link href={user ? "/dashboard" : "/signup"}>
                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer py-6 px-9 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 rounded-full">
                      {user ? "Go to Dashboard" : "Start Free Trial"} <ArrowRight className="size-4 ml-1.5" />
                    </Button>
                  </Link>
                  <a href="#demo">
                    <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted font-bold py-6 px-9 hover:scale-105 active:scale-95 transition-all rounded-full bg-card/45 backdrop-blur-sm">
                      Try Simulator
                    </Button>
                  </a>
                </div>

                {/* Live Telemetry KPI Badges */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 max-w-xl">
                  <div>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">1.4s</p>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mt-0.5">Response Latency</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground">₹2.4M</p>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mt-0.5">Leakage Saved</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground">99.4%</p>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mt-0.5">Patient Satisfaction</span>
                  </div>
                </div>

              </div>

              {/* Right Column: 3D Visual Floating Stack */}
              <div className="lg:col-span-5 relative h-[380px] w-full hidden md:block select-none">
                
                {/* Background Ambient Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent blur-[60px] rounded-full opacity-60 -z-10" />

                {/* Floating Card 1: WhatsApp Message Bubble */}
                <div className="absolute top-2 left-6 w-[270px] bg-card border border-border/80 p-4 rounded-2xl shadow-xl backdrop-blur-md animate-float-1 z-30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">CF</div>
                    <span className="text-[10px] font-extrabold text-foreground">CareFlow Autopilot</span>
                    <span className="text-[8px] text-muted-foreground ml-auto">10:30 AM</span>
                  </div>
                  <p className="text-[10px] text-foreground leading-relaxed">
                    Namaste! Your Blood Report is Ready. Here is your PDF copy.
                  </p>
                  <div className="mt-2.5 p-2 bg-muted/60 border border-border/50 rounded-xl flex items-center gap-2">
                    <FileText className="size-5 text-rose-500 shrink-0" />
                    <span className="text-[9px] font-bold text-foreground truncate">Blood_Report.pdf</span>
                  </div>
                </div>

                {/* Floating Card 2: AI Database Audit Log */}
                <div className="absolute top-28 right-0 w-[260px] bg-zinc-950 border border-zinc-800 p-4 rounded-2xl shadow-2xl animate-float-2 z-20">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="size-3.5 text-emerald-500" />
                    <span className="text-[9px] font-bold text-zinc-400 font-mono">OPD Live Audit</span>
                  </div>
                  <div className="space-y-1 font-mono text-[8px] text-zinc-500 text-left">
                    <p className="text-emerald-400">✔ Match phone: +91 98765...</p>
                    <p className="text-teal-400">✔ Intent: check_lab_report</p>
                    <p>✔ Outbound PDF dispatched: 1.2s</p>
                  </div>
                </div>

                {/* Floating Card 3: Appointment Queue Token Card */}
                <div className="absolute bottom-6 left-12 w-[240px] bg-card/90 border border-emerald-500/10 p-4 rounded-2xl shadow-lg backdrop-blur-md animate-float-3 z-10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">TOKEN ISSUED</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-lg font-black text-foreground">#14</p>
                    <span className="text-[9px] text-muted-foreground">Dr. Gupta (OPD Room 4)</span>
                  </div>
                  <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "80%" }} />
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Mac-style app mockup */}
            <div className="pt-20 max-w-5xl mx-auto relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent blur-[50px] rounded-3xl opacity-50 pointer-events-none" />
              <div className="relative border border-border bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl p-2.5 transition-all duration-500 group-hover:scale-[1.005] group-hover:shadow-[0_20px_50px_rgba(16,185,129,0.06)] group-hover:border-emerald-500/20">
                {/* Window Control Panel */}
                <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5 bg-muted/40">
                  <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full bg-rose-500/80 cursor-pointer" />
                    <span className="size-3 rounded-full bg-amber-500/80 cursor-pointer" />
                    <span className="size-3 rounded-full bg-emerald-500/80 cursor-pointer" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold tracking-wider">careflow.receptionist.desk</span>
                  <div className="size-3" />
                </div>
                
                {/* Mock UI Frame */}
                <div className="grid grid-cols-12 gap-2 p-2 bg-background/80">
                  
                  {/* Sidebar mockup */}
                  <div className="col-span-3 border-r border-border/60 p-4 space-y-4 hidden md:block text-left">
                    <div className="h-8 w-28 bg-emerald-500/10 rounded-lg border border-emerald-500/20 mb-6 flex items-center px-2.5 gap-2">
                      <div className="size-3 bg-emerald-500 rounded-full animate-ping" />
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">ACTIVE DESK</span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4.5 w-full bg-emerald-500/15 rounded-md border border-emerald-500/20" />
                      <div className="h-4.5 w-[90%] bg-muted rounded-md" />
                      <div className="h-4.5 w-[85%] bg-muted rounded-md" />
                      <div className="h-4.5 w-[70%] bg-muted rounded-md" />
                    </div>
                  </div>

                  {/* Right Dashboard Body mockup */}
                  <div className="col-span-12 md:col-span-9 p-3 space-y-4 text-left">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="border border-border p-3.5 rounded-2xl bg-card hover:scale-105 transition-all shadow-sm">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Patients in Queue</span>
                        <p className="text-2xl font-black text-foreground mt-1">18</p>
                      </div>
                      <div className="border border-emerald-500/20 p-3.5 rounded-2xl bg-card hover:scale-105 transition-all shadow-sm">
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">AI Automated Triage</span>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">94%</p>
                      </div>
                      <div className="border border-border p-3.5 rounded-2xl bg-card hover:scale-105 transition-all shadow-sm">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Staff Workload Shifted</span>
                        <p className="text-2xl font-black text-foreground mt-1">82 hr</p>
                      </div>
                    </div>
                    {/* Simulated live chart */}
                    <div className="border border-border/80 p-4 rounded-2xl bg-card/40 h-36 flex items-end justify-between gap-2.5 pt-8 hover:shadow-inner transition-shadow">
                      <div className="w-full bg-emerald-500/20 rounded-t-lg h-[40%] hover:bg-emerald-500/30 transition-colors" />
                      <div className="w-full bg-emerald-500/30 rounded-t-lg h-[55%] hover:bg-emerald-500/40 transition-colors" />
                      <div className="w-full bg-emerald-50 rounded-t-lg h-[92%] relative flex justify-center hover:bg-emerald-600 transition-colors">
                        <span className="absolute -top-7 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">94% Autopilot</span>
                      </div>
                      <div className="w-full bg-emerald-500/40 rounded-t-lg h-[45%] hover:bg-emerald-500/50 transition-colors" />
                      <div className="w-full bg-emerald-500/50 rounded-t-lg h-[75%] hover:bg-emerald-500/60 transition-colors" />
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Clinical Capabilities Interactive Switcher Section */}
        <section id="features" className="py-24 bg-muted/20 border-y border-border">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
                Built for the Realities of Indian OPDs
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
                Most patients do not want to download another app or open emails. CareFlow brings all operations into WhatsApp, the only interface they already use daily.
              </p>
            </div>

            {/* Interactive Tab Switcher Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Tab Selectors */}
              <div className="lg:col-span-5 space-y-3 text-left">
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`w-full text-left p-5 rounded-2xl transition-all cursor-pointer border flex items-start gap-4 ${
                    activeTab === "ai"
                      ? "bg-card border-emerald-500/30 shadow-md shadow-emerald-500/5"
                      : "bg-transparent border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border ${activeTab === "ai" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
                    <Brain className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">AI Receptionist Autopilot</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Automatically queries and collects Patient Name, Gender, and DOB on WhatsApp, matching them to slots.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("reports")}
                  className={`w-full text-left p-5 rounded-2xl transition-all cursor-pointer border flex items-start gap-4 ${
                    activeTab === "reports"
                      ? "bg-card border-emerald-500/30 shadow-md shadow-emerald-500/5"
                      : "bg-transparent border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border ${activeTab === "reports" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">Pathology PDF Dispatch</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Upload lab PDFs from the clinic panel. The AI identifies patient matching files and delivers them directly in chat.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("queue")}
                  className={`w-full text-left p-5 rounded-2xl transition-all cursor-pointer border flex items-start gap-4 ${
                    activeTab === "queue"
                      ? "bg-card border-emerald-500/30 shadow-md shadow-emerald-500/5"
                      : "bg-transparent border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border ${activeTab === "queue" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">Live Token Queue</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Allows staff to assign queue token numbers. Patients ask "what is my position?" on WhatsApp and get instant alerts.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("takeover")}
                  className={`w-full text-left p-5 rounded-2xl transition-all cursor-pointer border flex items-start gap-4 ${
                    activeTab === "takeover"
                      ? "bg-card border-emerald-500/30 shadow-md shadow-emerald-500/5"
                      : "bg-transparent border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border ${activeTab === "takeover" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted border-border text-muted-foreground"}`}>
                    <MessageSquare className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">Manual Handoff Takeover</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Toggle off the AI engine with a single button. Front desk staff can jump in and converse with patients manually at any time.
                    </p>
                  </div>
                </button>
              </div>

              {/* Right Column: Visual Graphic Panels */}
              <div className="lg:col-span-7 bg-card border border-border rounded-3xl p-6 h-full flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300">
                {activeTab === "ai" && (
                  <div className="space-y-4 text-left animate-in fade-in duration-300">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 w-fit">Interactive NLP Triage</span>
                    <h3 className="text-xl font-extrabold text-foreground">Smart Appointment Autopilot</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      No web forms or signup flows required. The AI assistant extracts parameters natively from plain patient text (e.g. "I want Dr. Kumar tomorrow at 5pm"), compares against doctor shift schedules, and books the token automatically.
                    </p>
                    <div className="border border-border/80 bg-muted/40 p-4 rounded-2xl font-mono text-[10px] text-muted-foreground space-y-2">
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold">// Parsed JSON Intent</p>
                      <p>{"{"}</p>
                      <p className="pl-4">"intent": "BOOK_APPOINTMENT",</p>
                      <p className="pl-4">"doctor": "Dr. Kumar",</p>
                      <p className="pl-4">"department": "Cardiology",</p>
                      <p className="pl-4">"parsed_patient": {"{"} "name": "Susanta Lohar", "gender": "Male", "dob": "1996-05-25" {"}"}</p>
                      <p>{"}"}</p>
                    </div>
                  </div>
                )}

                {activeTab === "reports" && (
                  <div className="space-y-4 text-left animate-in fade-in duration-300">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 w-fit">Instant File Dispatch</span>
                    <h3 className="text-xl font-extrabold text-foreground">Diagnostic PDF Delivery</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Remove the friction of patient pickups and physical papers. Once a lab report changes to "Ready", CareFlow automatically coordinates the outbound pipeline to send the PDF file. Patients can also text "send blood report" to trigger auto-downloads.
                    </p>
                    <div className="flex gap-3 mt-2">
                      <div className="border border-border bg-background p-3.5 rounded-2xl flex items-center gap-3.5 w-full hover:scale-105 transition-all">
                        <FileText className="size-8 text-rose-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-foreground truncate">Blood_Report_Lohar.pdf</p>
                          <span className="text-[10px] text-muted-foreground">1.4 MB • Pathology Lab</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "queue" && (
                  <div className="space-y-4 text-left animate-in fade-in duration-300">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 w-fit">OPD Queue Management</span>
                    <h3 className="text-xl font-extrabold text-foreground">Live Waiting List Telemetry</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Ditch crowded OPD waiting areas. CareFlow automatically sends real-time queue position updates. Patients know exactly how many consultations are ahead of them without bugging your receptionist.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="border border-border bg-background p-3.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-muted-foreground block uppercase">Your Token</span>
                        <p className="text-2xl font-black text-foreground mt-1">#14</p>
                      </div>
                      <div className="border border-emerald-500/25 bg-emerald-500/5 p-3.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Patients Ahead</span>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">3</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "takeover" && (
                  <div className="space-y-4 text-left animate-in fade-in duration-300">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 w-fit">Human-in-the-Loop Safeguard</span>
                    <h3 className="text-xl font-extrabold text-foreground">Immediate Staff Takeover</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      AI is a helper, not a replacement. Whenever a patient requires manual clarification or details not supported by prompt context, WACRM tags the chat as "Handoff Needed", flashes a red notice to the staff console, and pauses the AI auto-replies.
                    </p>
                    <div className="flex items-center justify-between border border-border bg-background/50 p-3.5 rounded-2xl mt-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-3 bg-red-500 rounded-full animate-ping" />
                        <span className="text-xs font-extrabold text-foreground">AI Auto-Reply status</span>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-900/20">PAUSED BY STAFF</span>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        </section>

        {/* WhatsApp Live Simulator Section */}
        <section id="demo" className="py-24 px-4 relative">
          <div className="container mx-auto max-w-5xl space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
                Experience the Autopilot
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                Click any interactive prompt trigger in the simulator panel below to see how CareFlow processes inbound queries and updates clinical databases instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4">
              
              {/* Left Column: Simulator prompts & Database Log */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-6 text-left h-full">
                
                {/* Trigger Buttons */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Click a Patient Action:</span>
                  {simStep === 0 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <button
                        onClick={() => handleSimReply(
                          "I want to book an appointment with Dr. Gupta tomorrow.",
                          "Sure! Dr. Gupta (General Medicine) is available tomorrow morning. May I know your full name and date of birth to lock the booking slot?",
                          "[DB Event] Appointment request logged under hospital_bookings (Intent: schedule, Doctor: Dr. Gupta).",
                          1
                        )}
                        className="w-full text-left p-4 text-xs bg-card border border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-foreground font-bold rounded-2xl transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                      >
                        📅 Book an Appointment with Dr. Gupta
                      </button>
                      <button
                        onClick={() => handleSimReply(
                          "Send me my latest blood report PDF.",
                          "Great news! Your Blood Count Report is ready. Sending your report PDF document now.",
                          "[DB Event] Queried hospital_lab_reports. Matched target, fetched file_url: storage/reports/cbc_report.pdf.",
                          2
                        )}
                        className="w-full text-left p-4 text-xs bg-card border border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-foreground font-bold rounded-2xl transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                      >
                        🩸 Fetch blood report PDF
                      </button>
                    </div>
                  )}

                  {simStep === 1 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <button
                        onClick={() => handleSimReply(
                          "My name is Susanta Lohar, DOB 25th May 1996.",
                          "Thanks, Susanta. I have matched your details: Appointment confirmed with Dr. Gupta (General Medicine) for tomorrow at 10:00 AM. Token #4. See you there!",
                          "[DB Event] Updated patient file. set name = 'Susanta Lohar', dob = '1996-05-25', status = 'confirmed', token = 4.",
                          3
                        )}
                        className="w-full text-left p-4 text-xs bg-card border border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-bold rounded-2xl transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                      >
                        👤 Reply with name & DOB (Susanta, 25/05/1996)
                      </button>
                    </div>
                  )}

                  {(simStep === 2 || simStep === 3) && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2">
                        <Check className="size-4 shrink-0" /> Simulator demo flow complete!
                      </div>
                      <button
                        onClick={resetSimulator}
                        className="w-full text-center p-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition-all cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        🔄 Restart Simulator
                      </button>
                    </div>
                  )}
                </div>

                {/* Audit Database Logs */}
                <div className="space-y-2 pt-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="size-3.5 text-emerald-500 animate-pulse" /> Live DB Audit Log
                  </span>
                  <div className="bg-zinc-950 text-[10px] text-zinc-400 font-mono p-4 rounded-2xl border border-zinc-800 h-36 overflow-y-auto space-y-1.5 text-left leading-relaxed shadow-lg">
                    {dbLogs.map((log, idx) => (
                      <p key={idx} className={log.startsWith("[DB Event]") ? "text-emerald-400 font-bold" : log.startsWith("[NLP") ? "text-teal-400" : "text-zinc-500"}>
                        {log}
                      </p>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Phone Mockup Viewport */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="w-[305px] h-[525px] rounded-[42px] border-[10px] border-foreground/90 bg-muted/10 relative shadow-2xl flex flex-col overflow-hidden hover:shadow-emerald-500/5 transition-shadow">
                  
                  {/* Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4.5 bg-foreground/90 rounded-full z-20 flex justify-center items-center">
                    <span className="w-9 h-1 bg-muted/30 rounded-full" />
                  </div>
                  
                  {/* WhatsApp Header info bar */}
                  <div className="bg-emerald-800 pt-8 pb-3 px-4 flex items-center justify-between text-white border-b border-emerald-900/20 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-emerald-700 border border-white/20 flex items-center justify-center font-bold text-xs">
                        CF
                      </div>
                      <div className="text-left leading-none">
                        <p className="text-[11px] font-extrabold tracking-wide">CareFlow Reception</p>
                        <span className="text-[8px] text-emerald-200">online</span>
                      </div>
                    </div>
                  </div>

                  {/* Chat message list area */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[url('/whatsapp-bg.png')] bg-emerald-50/5 dark:bg-emerald-950/5">
                    {simMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`max-w-[80%] rounded-2xl p-3 text-[10px] leading-relaxed relative ${
                          msg.sender === "bot"
                            ? "bg-card border text-foreground mr-auto rounded-tl-none animate-in slide-in-from-left-2 duration-300"
                            : "bg-emerald-600 text-white ml-auto rounded-tr-none animate-in slide-in-from-right-2 duration-300"
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>
                        <span className={`block text-[8.5px] text-right mt-1.5 ${msg.sender === "bot" ? "text-muted-foreground" : "text-emerald-100"}`}>
                          {msg.time}
                        </span>
                      </div>
                    ))}
                    
                    {simTyping && (
                      <div className="bg-card border rounded-2xl p-2.5 max-w-[60%] mr-auto rounded-tl-none text-[10px] text-muted-foreground flex items-center gap-1.5 animate-pulse">
                        <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" />
                        <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>

                  {/* Message Input Bottom Bar */}
                  <div className="p-2 border-t bg-muted/40 flex items-center gap-1.5 shrink-0">
                    <div className="flex-1 bg-card rounded-full h-8 px-3 border border-border flex items-center text-[10px] text-muted-foreground text-left">
                      Message...
                    </div>
                    <div className="size-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold shrink-0">
                      →
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Live ROI & Leakage Calculator Section */}
        <section id="calculator" className="py-24 border-t border-border">
          <div className="container mx-auto max-w-4xl px-4 text-center space-y-16">
            
            <div className="max-w-2xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
                Revenue & Workload Impact
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Unanswered front-desk calls and slow diagnostic delivery result in high dropouts. Drag the slider to see how CareFlow shifts your metrics.
              </p>
            </div>

            {/* Slider Widget */}
            <div className="border border-border bg-card/40 backdrop-blur-md rounded-3xl p-6 sm:p-10 space-y-8 max-w-3xl mx-auto hover:border-emerald-500/20 transition-all duration-300">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between font-bold text-sm">
                  <span className="text-foreground">Monthly Patient Load:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-lg bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    {monthlyPatients} patients / month
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="50"
                  value={monthlyPatients}
                  onChange={(e) => setMonthlyPatients(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-muted appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500"
                />
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>100 Patients</span>
                  <span>5,000 Patients</span>
                </div>
              </div>

              {/* Calculator Output Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-left">
                <div className="border border-border/80 p-5 rounded-2xl bg-background/50 hover:scale-105 transition-all shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block tracking-wider">Staff Hours Reclaimed</span>
                  <p className="text-2xl font-black text-foreground mt-1">+{calculatedSavings.hoursSaved} hrs / mo</p>
                  <span className="text-[9px] text-muted-foreground block mt-1">12 mins triage saved per patient</span>
                </div>
                <div className="border border-border/80 p-5 rounded-2xl bg-background/50 hover:scale-105 transition-all shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block tracking-wider">Response Speed Drop</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">98% Faster</p>
                  <span className="text-[9px] text-muted-foreground block mt-1">Average response drop to 1.4s</span>
                </div>
                <div className="border border-emerald-500/20 p-5 rounded-2xl bg-background/50 hover:scale-105 transition-all shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block tracking-wider">Leakage Saved (Est)</span>
                  <p className="text-2xl font-black text-foreground mt-1">₹{calculatedSavings.monthlyReturn.toLocaleString()} / mo</p>
                  <span className="text-[9px] text-muted-foreground block mt-1">Missed consultations recovered</span>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* Pricing Tiers Section */}
        <section id="pricing" className="py-24 bg-muted/20 border-t border-border">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
                Transparent Pricing for Every Clinic Size
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
                Start with our 14-day free trial. No credit card required. Upgrade or downgrade anytime.
              </p>
            </div>

            {/* Billing interval slider/toggle */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className={`text-xs font-bold transition-colors ${!isYearly ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className="w-12 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center p-0.5 transition-colors cursor-pointer relative animate-pulse"
                type="button"
                aria-label="Toggle Billing Interval"
              >
                <div className={`h-4.5 w-4.5 rounded-full bg-emerald-600 dark:bg-emerald-500 transition-transform ${isYearly ? "translate-x-6" : "translate-x-0"}`} />
              </button>
              <span className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${isYearly ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                Yearly
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                  SAVE 20%
                </span>
              </span>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 pt-6 max-w-5xl mx-auto text-left">
              
              {/* Tier 1: Free Trial */}
              <div className="flex flex-col justify-between bg-card border border-border rounded-3xl p-7 hover:border-emerald-500/30 hover:shadow-lg transition-all duration-300 cursor-pointer">
                <div>
                  <span className="text-[9px] font-black uppercase bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground tracking-wider">Evaluation</span>
                  <h3 className="text-lg font-extrabold text-foreground mt-3">14-Day Trial</h3>
                  <div className="mt-3.5 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">₹0</span>
                    <span className="text-xs text-muted-foreground font-semibold">/14 days</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-xs text-muted-foreground font-medium font-semibold">
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Up to 300 patients / contacts</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 1 WhatsApp business number</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 100 AI automated replies</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Token Queue & dashboard</li>
                  </ul>
                </div>
                <Link href="/signup" className="mt-8">
                  <Button className="w-full bg-muted border border-border text-foreground hover:bg-muted/80 font-bold rounded-full py-5">
                    Start Free Trial
                  </Button>
                </Link>
              </div>

              {/* Tier 2: growth premium */}
              <div className="flex flex-col justify-between bg-card border-2 border-emerald-500 rounded-3xl p-7 hover:shadow-[0_12px_40px_rgba(16,185,129,0.1)] hover:scale-[1.01] transition-all duration-300 relative cursor-pointer">
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-emerald-600 text-white font-bold text-[9px] uppercase tracking-wider py-1 px-3 rounded-full shadow-md shadow-emerald-500/10">
                  Most Popular
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-400 tracking-wider">OPD Autopilot</span>
                  <h3 className="text-lg font-extrabold text-foreground mt-3">Growth Premium</h3>
                  <div className="mt-3.5 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">
                      ₹{isYearly ? "1,999" : "2,499"}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">/month</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-xs text-muted-foreground font-medium">
                    <li className="flex items-center gap-2 text-foreground font-bold"><Check className="size-3.5 text-emerald-500" /> Up to 5,000 patients / contacts</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 2 WhatsApp business numbers</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 2,000 AI automated replies</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Pathology report PDF dispatch</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Manual override desk takeover</li>
                  </ul>
                </div>
                <Link href="/signup" className="mt-8">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full py-5 shadow-lg shadow-emerald-600/10">
                    Get Growth Now
                  </Button>
                </Link>
              </div>

              {/* Tier 3: enterprise */}
              <div className="flex flex-col justify-between bg-card border border-border rounded-3xl p-7 hover:border-emerald-500/30 hover:shadow-lg transition-all duration-300 cursor-pointer">
                <div>
                  <span className="text-[9px] font-black uppercase bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground tracking-wider">Multi-Clinic Chain</span>
                  <h3 className="text-lg font-extrabold text-foreground mt-3">Custom Enterprise</h3>
                  <div className="mt-3.5 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-foreground">Contact</span>
                    <span className="text-xs text-muted-foreground font-semibold">/quote</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-xs text-muted-foreground font-medium">
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Unlimited patients & consultants</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Custom multi-branch slots</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Dedicated database & hosting</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Custom LLM / OpenRouter setups</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Dedicated WhatsApp manager support</li>
                  </ul>
                </div>
                <Link href="mailto:support@wacrm.com" className="mt-8">
                  <Button className="w-full bg-muted border border-border text-foreground hover:bg-muted/80 font-bold rounded-full py-5">
                    Contact Sales
                  </Button>
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 px-4 max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
              Trusted by Clinics & Diagnostics
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              Find out how clinics and labs are shifting workloads off physical phone lines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-3xl p-6.5 space-y-4 hover:border-emerald-500/20 hover:shadow-md transition-all duration-300 text-left">
                <p className="text-xs text-foreground italic leading-relaxed">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="size-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {t.avatar}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-bold text-foreground">{t.author}</p>
                    <p className="text-[10px] text-muted-foreground">{t.role} • {t.clinic}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ section */}
        <section id="faq" className="py-24 max-w-4xl mx-auto px-4">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              Answers regarding WhatsApp Business integration, security, and manual intervention controls.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "What is CareFlow (WACRM) Hospital AI?",
                a: "CareFlow is an open-source, self-hostable digital receptionist dashboard for Indian clinics and hospitals. It connects your Next.js application to the official Meta WhatsApp Business Cloud API. Using OpenRouter LLM engines, the AI automatedly responds to patient scheduling slots, extracts name/gender/dob tags, and sends lab diagnostic PDFs without manual typing from your receptionists."
              },
              {
                q: "Do patients need to download anything to book or check report status?",
                a: "No. The entire patient-facing experience is inside WhatsApp. Patients simply message your designated business phone number to schedule slot tokens, query queue positions, or receive diagnostic results. This yields a massive satisfaction upgrade because WhatsApp is already on every Indian smartphone."
              },
              {
                q: "How does the AI lab report auto-delivery work?",
                a: "When your diagnostic team uploads a pathology/radiology PDF report in the Reports dashboard and changes the status to 'Ready', CareFlow automatically detects the patient's phone number, writes a secure log, and sends a WhatsApp template. If the patient inquires about their report on WhatsApp, the AI immediately extracts the PDF file from storage and attaches it on the chat thread."
              },
              {
                q: "How can staff intercept AI automated conversations?",
                a: "In the shared receptionist inbox, staff can view all active conversation logs. Next to each chat thread is an 'AI Agent Toggle'. Switching it off stops all automated replies immediately, allowing staff to text the patient manually. The AI also detects complex or edge-case messages and triggers an automatic pause, alerting the receptionist."
              }
            ].map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="border border-border rounded-2xl bg-card overflow-hidden transition-all duration-300">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-4.5 font-bold text-xs text-left text-foreground cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:translate-x-1 transition-all duration-200"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4.5 pb-4.5 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3 animate-in fade-in duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/40 py-12 relative z-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
              C
            </div>
            <span className="font-extrabold text-foreground text-sm tracking-tight">CareFlow Hospital Autopilot © 2026</span>
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground font-semibold">
            <a href="#hook" className="hover:text-foreground">The Hook</a>
            <a href="#features" className="hover:text-foreground">Capabilities</a>
            <a href="#demo" className="hover:text-foreground">Live Demo</a>
            <Link href="/login" className="hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
