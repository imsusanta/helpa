"use client";

import { useEffect, useState } from "react";
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
    quote: "Our front desk workload was cut by 60%. The AI handles appointment bookings and lab report delivery flawlessly on WhatsApp.",
    author: "Dr. Elena Rostova",
    role: "Clinical Director",
    clinic: "Metro Health Group",
    avatar: "ER",
  },
  {
    quote: "Patients love getting their diagnostic PDFs instantly on WhatsApp. No more phone queues or manual emails from staff.",
    author: "Susanta Lohar",
    role: "System Administrator",
    clinic: "Apollo Diagnostic Labs",
    avatar: "SL",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Pricing toggle (monthly vs yearly)
  const [isYearly, setIsYearly] = useState(false);

  // Theme support
  const { mode, setMode } = useTheme();

  // WhatsApp Interactive Simulator State
  const [simStep, setSimStep] = useState(0);
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    {
      sender: "bot",
      text: "Hello! Welcome to Apollo Health Clinic. I am your AI Assistant. How can I help you today?",
      time: "10:30 AM",
    },
  ]);
  const [simTyping, setSimTyping] = useState(false);

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
  const handleSimReply = (questionText: string, botResponseText: string, nextStep: number) => {
    if (simTyping) return;
    
    // Add user message
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSimMessages((prev) => [...prev, { sender: "user", text: questionText, time: now }]);
    setSimStep(nextStep);
    
    // Trigger typing state
    setSimTyping(true);
    setTimeout(() => {
      setSimMessages((prev) => [...prev, { sender: "bot", text: botResponseText, time: now }]);
      setSimTyping(false);
    }, 1200);
  };

  const resetSimulator = () => {
    setSimStep(0);
    setSimMessages([
      {
        sender: "bot",
        text: "Hello! Welcome to Apollo Health Clinic. I am your AI Assistant. How can I help you today?",
        time: "10:30 AM",
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-emerald-500/20">
      
      {/* Background Grid Pattern & Ambient Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header Section */}
      <div className="sticky top-0 z-50 w-full flex flex-col items-center px-4 pt-4 pointer-events-none">
        <header className="w-full max-w-5xl rounded-full border border-border/80 bg-background/65 backdrop-blur-xl shadow-lg shadow-black/[0.02] dark:shadow-black/[0.12] transition-all duration-300 pointer-events-auto">
          <div className="flex items-center justify-between py-2.5 px-5 sm:px-6">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/20 group-hover:rotate-12 group-hover:scale-110 active:scale-90 transition-all duration-300">
                <Stethoscope className="h-4.5 w-4.5" />
              </div>
              <span className="font-black text-sm text-foreground tracking-tight sm:text-base">
                WACRM<span className="text-emerald-500 font-medium text-[10px] ml-1">Hospital AI</span>
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 p-0.5 rounded-full bg-muted/40 border border-border/50">
              <a href="#features" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">Features</a>
              <a href="#demo" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">Live Demo</a>
              <a href="#pricing" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">Pricing</a>
              <a href="#faq" className="hover:bg-background/80 hover:shadow-sm px-4 py-1 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200">FAQ</a>
            </nav>

            {/* Dark Mode toggle & CTAs */}
            <div className="hidden md:flex items-center gap-3">
              
              {/* Theme Toggle Button */}
              <button
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground rounded-full border border-border bg-card/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {mode === "dark" ? <Sun className="size-3.5 text-amber-500" /> : <Moon className="size-3.5 text-emerald-600" />}
              </button>

              {user ? (
                <Link href="/dashboard">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer rounded-full hover:scale-[1.03] active:scale-[0.97] transition-all px-4">
                    Dashboard <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-xs font-bold text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-200 mr-1.5">
                    Sign In
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer rounded-full hover:scale-[1.03] active:scale-[0.97] transition-all px-4">
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
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">Features</a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">Live Demo</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-500 py-1.5 transition-colors">FAQ</a>
            </nav>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              {/* Mobile Mode Toggle */}
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

      {/* Main Container */}
      <main className="relative z-10">

        {/* Hero Section */}
        <section className="relative px-4 py-20 md:py-32 lg:px-8">
          <div className="container mx-auto max-w-7xl text-center space-y-8">
            
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider animate-bounce">
              <Sparkles className="h-3.5 w-3.5" />
              The WhatsApp Receptionist for Healthcare
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl max-w-4xl mx-auto leading-none text-foreground">
              Automate Patient Care on WhatsApp. <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">24/7.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
              A self-hosted WhatsApp CRM and AI Autopilot built for clinics and hospitals. Book appointments, triage queries, and dispatch lab PDF reports instantly without manual frontdesk labor.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer py-6 px-8 hover:scale-[1.04] active:scale-[0.96] transition-all shadow-md shadow-emerald-500/10">
                  {user ? "Go to Dashboard" : "Start 14-Day Free Trial"} <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted font-bold py-6 px-8 hover:scale-[1.04] active:scale-[0.96] transition-all">
                  Interactive Demo
                </Button>
              </a>
            </div>

            {/* Feature Badges Banner */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-8 text-xs font-semibold text-muted-foreground max-w-3xl mx-auto border-t border-border/60">
              <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors cursor-pointer"><CheckCircle2 className="size-4 text-emerald-500" /> WhatsApp Cloud API Integration</div>
              <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors cursor-pointer"><CheckCircle2 className="size-4 text-emerald-500" /> Patient CRM & Pipelines</div>
              <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors cursor-pointer"><CheckCircle2 className="size-4 text-emerald-500" /> Automated Lab Report Delivery</div>
              <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors cursor-pointer"><CheckCircle2 className="size-4 text-emerald-500" /> Self-Hosted Supabase / Next.js</div>
            </div>

            {/* Hero App Mockup Grid */}
            <div className="pt-10 max-w-5xl mx-auto relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent blur-[50px] rounded-3xl opacity-50 pointer-events-none" />
              <div className="relative border border-border bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl p-2.5 transition-all duration-500 group-hover:scale-[1.01] group-hover:shadow-[0_20px_50px_rgba(16,185,129,0.05)] group-hover:border-emerald-500/20">
                {/* Header Strip */}
                <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 bg-muted/40">
                  <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full bg-red-500/80 hover:scale-110 transition-transform cursor-pointer" />
                    <span className="size-3 rounded-full bg-yellow-500/80 hover:scale-110 transition-transform cursor-pointer" />
                    <span className="size-3 rounded-full bg-green-500/80 hover:scale-110 transition-transform cursor-pointer" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold">wacrm.hospital.dashboard</span>
                  <div className="size-3" />
                </div>
                {/* Visual Preview */}
                <div className="grid grid-cols-12 gap-2 p-2 bg-background/80">
                  
                  {/* Left Side: Mock Navigation */}
                  <div className="col-span-3 border-r border-border/60 p-3 space-y-4 hidden sm:block text-left">
                    <div className="h-6 w-24 bg-emerald-500/10 rounded-lg border border-emerald-500/20" />
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-muted rounded" />
                      <div className="h-4 w-[90%] bg-muted rounded" />
                      <div className="h-4 w-[75%] bg-muted rounded" />
                    </div>
                  </div>

                  {/* Right Side: Mock KPIs and Charts */}
                  <div className="col-span-12 sm:col-span-9 p-3 space-y-4 text-left">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="border border-border p-3 rounded-xl bg-card hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Today's Chats</span>
                        <p className="text-xl font-extrabold text-foreground mt-1">24</p>
                      </div>
                      <div className="border border-border p-3 rounded-xl bg-card border-emerald-500/20 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer">
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">AI Resolution</span>
                        <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">95%</p>
                      </div>
                      <div className="border border-border p-3 rounded-xl bg-card hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Booked Slots</span>
                        <p className="text-xl font-extrabold text-foreground mt-1">8</p>
                      </div>
                    </div>
                    {/* Simulated chart */}
                    <div className="border border-border p-4 rounded-xl bg-card/50 h-32 flex items-end justify-between gap-1.5 pt-6 hover:shadow-inner transition-shadow">
                      <div className="w-full bg-emerald-500/30 rounded-t h-[40%] hover:bg-emerald-500/40 transition-colors" />
                      <div className="w-full bg-emerald-500/40 rounded-t h-[60%] hover:bg-emerald-500/50 transition-colors" />
                      <div className="w-full bg-emerald-500 rounded-t h-[95%] relative flex justify-center hover:bg-emerald-600 transition-colors">
                        <span className="absolute -top-6 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-bounce">95%</span>
                      </div>
                      <div className="w-full bg-emerald-500/50 rounded-t h-[50%] hover:bg-emerald-500/60 transition-colors" />
                      <div className="w-full bg-emerald-500/60 rounded-t h-[80%] hover:bg-emerald-500/70 transition-colors" />
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Features Modules Grid Section */}
        <section id="features" className="py-20 bg-muted/20 border-y border-border">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                All-in-One WhatsApp Operations Hub
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Empower your medical staff and automate patient touchpoints. Tailor-made for the modern private practice.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 pt-12">
              
              {/* Feature 1 */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-3 hover:border-emerald-500/30 hover:shadow-[0_12px_40px_rgba(16,185,129,0.08)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit group-hover:rotate-6 transition-transform">
                  <Brain className="size-5" />
                </div>
                <h3 className="font-extrabold text-foreground text-md">AI Receptionist Autopilot</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically replies to patients, collects basic info (Name, Gender, DOB), and detects consultation intent using OpenRouter APIs.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-3 hover:border-emerald-500/30 hover:shadow-[0_12px_40px_rgba(16,185,129,0.08)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl w-fit group-hover:rotate-6 transition-transform">
                  <Calendar className="size-5" />
                </div>
                <h3 className="font-extrabold text-foreground text-md">Clinical Booking Calendar</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Maintains doctor schedules, handles shifts, calculates appointment limits, and dispatches automated reminder check-ins.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-3 hover:border-emerald-500/30 hover:shadow-[0_12px_40px_rgba(16,185,129,0.08)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl w-fit group-hover:rotate-6 transition-transform">
                  <FileText className="size-5" />
                </div>
                <h3 className="font-extrabold text-foreground text-md">Lab Reports Automated PDF</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Integrates a report uploader and dispatch system. Automatically sends a WhatsApp message with the laboratory PDF report as soon as it's generated.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-3 hover:border-emerald-500/30 hover:shadow-[0_12px_40px_rgba(16,185,129,0.08)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl w-fit group-hover:rotate-6 transition-transform">
                  <MessageSquare className="size-5" />
                </div>
                <h3 className="font-extrabold text-foreground text-md">Shared Staff Inbox</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enables multi-agent manual takeover. Includes an AI Copilot side-panel showing intent triggers, patient details, and smart replies.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* WhatsApp Simulator Live Demo Section */}
        <section id="demo" className="py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              
              {/* Simulator info text (left) */}
              <div className="md:col-span-5 space-y-6 text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  <Zap className="size-3.5 animate-pulse" /> Try it yourself
                </div>
                <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
                  Test the Receptionist Simulator
                </h2>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Click on the conversation options to simulate a patient messaging the hospital. See how the AI receptionist automatically triages the question and processes booking details.
                </p>

                {/* Question Trigger Buttons */}
                <div className="space-y-2 pt-2 z-20 relative">
                  
                  {simStep === 0 && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <button
                        onClick={() => handleSimReply(
                          "I want to book an appointment with a Cardiologist tomorrow.",
                          "Sure! I can help you with that. Dr. Gordon (Cardiology) is available tomorrow. May I know your full name and date of birth to reserve the slot?",
                          1
                        )}
                        className="w-full text-left p-3 text-xs bg-card border border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-foreground font-semibold rounded-xl hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                      >
                        📅 Book a Cardiology slot tomorrow
                      </button>
                      <button
                        onClick={() => handleSimReply(
                          "Can I get my lab report details?",
                          "Great news! Your Blood Test report is Ready. I am automatically sending you the PDF report now.",
                          2
                        )}
                        className="w-full text-left p-3 text-xs bg-card border border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-foreground font-semibold rounded-xl hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                      >
                        🩸 Check Lab Report Status
                      </button>
                    </div>
                  )}

                  {simStep === 1 && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <button
                        onClick={() => handleSimReply(
                          "My name is Susanta Lohar, DOB 25th May 1996.",
                          "Thank you, Susanta. I have qualifications logged: Appointment reserved with Dr. Gordon (Cardiology) for tomorrow morning. You will receive a WhatsApp confirmation soon!",
                          3
                        )}
                        className="w-full text-left p-3 text-xs bg-card border border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-foreground font-semibold rounded-xl hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                      >
                        📝 Provide Patient Info (Name/DOB)
                      </button>
                    </div>
                  )}

                  {simStep === 2 && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                        📄 Laboratory PDF Report auto-sent successfully!
                      </div>
                      <button
                        onClick={resetSimulator}
                        className="w-full text-left p-3 text-xs bg-muted border border-border text-foreground hover:bg-muted/85 hover:scale-[1.03] active:scale-[0.97] font-bold rounded-xl transition-all cursor-pointer"
                      >
                        🔄 Reset Simulator
                      </button>
                    </div>
                  )}

                  {simStep === 3 && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                        🗓 Booking logged into patient queue database!
                      </div>
                      <button
                        onClick={resetSimulator}
                        className="w-full text-left p-3 text-xs bg-muted border border-border text-foreground hover:bg-muted/85 hover:scale-[1.03] active:scale-[0.97] font-bold rounded-xl transition-all cursor-pointer"
                      >
                        🔄 Reset Simulator
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* Phone Simulator Layout (right) */}
              <div className="md:col-span-7 flex justify-center">
                <div className="w-[300px] h-[520px] rounded-[36px] border-8 border-foreground/90 bg-muted/10 relative shadow-2xl flex flex-col overflow-hidden hover:shadow-emerald-500/5 transition-shadow">
                  
                  {/* Phone Speaker Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-foreground/90 rounded-full z-20 flex justify-center items-center">
                    <span className="w-8 h-1 bg-muted/20 rounded-full" />
                  </div>
                  
                  {/* WhatsApp Top Info Bar */}
                  <div className="bg-emerald-700 dark:bg-emerald-800 pt-8 pb-3 px-4 flex items-center justify-between text-white border-b shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-emerald-500/20 border border-white/20 flex items-center justify-center font-bold text-xs">
                        H
                      </div>
                      <div className="text-left leading-none">
                        <p className="text-[11px] font-bold">Hospital AI Desk</p>
                        <span className="text-[8px] text-emerald-200">online</span>
                      </div>
                    </div>
                  </div>

                  {/* Chat messages viewport */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[url('/whatsapp-bg.png')] bg-emerald-50/5 dark:bg-emerald-950/5">
                    {simMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`max-w-[80%] rounded-xl p-2.5 text-[10px] leading-relaxed relative animate-in slide-in-from-bottom-2 duration-300 ${
                          msg.sender === "bot"
                            ? "bg-card border text-foreground mr-auto rounded-tl-none animate-in slide-in-from-left-2"
                            : "bg-emerald-600 text-white ml-auto rounded-tr-none animate-in slide-in-from-right-2"
                        }`}
                      >
                        <p>{msg.text}</p>
                        <span className={`block text-[8px] text-right mt-1 ${msg.sender === "bot" ? "text-muted-foreground" : "text-emerald-200"}`}>
                          {msg.time}
                        </span>
                      </div>
                    ))}
                    
                    {simTyping && (
                      <div className="bg-card border rounded-xl p-2 max-w-[60%] mr-auto rounded-tl-none text-[10px] text-muted-foreground flex items-center gap-1 animate-pulse">
                        <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" />
                        <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce delay-100" />
                        <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce delay-200" />
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Pricing Tiers Section */}
        <section id="pricing" className="py-20 bg-muted/20 border-t border-border">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                Pricing Tiers
              </h2>
              <p className="text-muted-foreground text-sm">
                Scale patient interactions as your clinic expands. Setup limits for staff or AI execution.
              </p>
            </div>

            {/* Sliding Monthly/Yearly Billing Toggle */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className={`text-xs font-bold transition-colors ${!isYearly ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className="w-12 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center p-0.5 transition-colors cursor-pointer relative"
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

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 pt-6 max-w-5xl mx-auto text-left">
              
              {/* Tier 1: Free Trial */}
              <div className="flex flex-col justify-between bg-card border border-border rounded-2xl p-6 hover:border-emerald-500/30 hover:shadow-[0_12px_40px_rgba(16,185,129,0.05)] hover:scale-[1.03] active:scale-[0.99] transition-all duration-300 cursor-pointer">
                <div>
                  <h3 className="text-md font-bold text-foreground">14-Day Free Trial</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-foreground">$0</span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      /{isYearly ? "14 days" : "14 days"}
                    </span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground font-medium">
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Up to 500 patient contacts</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 1 WhatsApp business number</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 100 AI queries / month</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Shared Inbox & pipelines</li>
                  </ul>
                </div>
                <Link href="/signup" className="mt-8">
                  <Button className="w-full bg-muted border border-border text-foreground hover:bg-muted/80 font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform">
                    Start Trial
                  </Button>
                </Link>
              </div>

              {/* Tier 2: Growth Premium */}
              <div className="flex flex-col justify-between bg-card border-2 border-emerald-500 rounded-2xl p-6 hover:shadow-[0_12px_40px_rgba(16,185,129,0.12)] hover:scale-[1.03] active:scale-[0.99] transition-all duration-300 relative cursor-pointer">
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-emerald-500 text-white font-bold text-[9px] uppercase tracking-wider py-1 px-2.5 rounded-full shadow-md shadow-emerald-500/10">
                  Most Popular
                </div>
                <div>
                  <h3 className="text-md font-bold text-foreground">Growth Premium</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-foreground">
                      ${isYearly ? "23" : "29"}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">/month</span>
                    {isYearly && <span className="text-[10px] text-muted-foreground font-semibold ml-2">billed yearly</span>}
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground font-medium">
                    <li className="flex items-center gap-2 text-foreground font-semibold"><Check className="size-3.5 text-emerald-500" /> Up to 5,000 patient contacts</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 3 WhatsApp business numbers</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 2,000 AI queries / month</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Automated Lab Report delivery</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Multi-agent manual takeover</li>
                  </ul>
                </div>
                <Link href="/signup" className="mt-8">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-md shadow-emerald-500/10">
                    Upgrade to Growth
                  </Button>
                </Link>
              </div>

              {/* Tier 3: Enterprise */}
              <div className="flex flex-col justify-between bg-card border border-border rounded-2xl p-6 hover:border-emerald-500/30 hover:shadow-[0_12px_40px_rgba(16,185,129,0.05)] hover:scale-[1.03] active:scale-[0.99] transition-all duration-300 cursor-pointer">
                <div>
                  <h3 className="text-md font-bold text-foreground">Enterprise Custom</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-foreground">Custom</span>
                    <span className="text-xs text-muted-foreground font-semibold">/quote</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground font-medium">
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Unlimited patients & staff</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Custom WhatsApp routes</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Unlimited AI request allowance</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Dedicated database hosting</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> 24/7 SLA Technical Support</li>
                  </ul>
                </div>
                <Link href="mailto:sales@wacrm.com" className="mt-8">
                  <Button className="w-full bg-muted border border-border text-foreground hover:bg-muted/85 hover:scale-[1.03] active:scale-[0.97] font-bold">
                    Contact Sales
                  </Button>
                </Link>
              </div>

            </div>

          </div>
        </section>

        {/* Premium Testimonials Section */}
        <section className="py-20 px-4 max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Trusted by Clinics & Labs
            </h2>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Here is what system administrators and clinical directors say about using WACRM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-emerald-500/20 hover:shadow-[0_12px_30px_rgba(16,185,129,0.04)] transition-all duration-300">
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

        {/* FAQ Accordion Section */}
        <section id="faq" className="py-20 max-w-4xl mx-auto px-4">
          <div className="text-center space-y-4 mb-10">
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Find technical answers regarding self-hosting, WhatsApp API keys, and clinical deployments.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: "What is WACRM Hospital AI?",
                a: "WACRM is a self-hostable CRM and WhatsApp receptionist built using Next.js, Tailwind CSS, and Supabase. It uses the official Meta WhatsApp Cloud API to interact with patients, and connects to OpenRouter models (like Gemini and Claude) to parse clinical inquiries, arrange doctor appointment dates, and auto-dispatch ready reports."
              },
              {
                q: "Do I need a Meta Developer Account?",
                a: "Yes. WACRM integrates with the official WhatsApp Business Cloud API. You will need a Meta Developer App setup, a Phone Number ID, and a Permanent Access Token. We provide step-by-step instructions inside your account settings panel to configure this."
              },
              {
                q: "How does the AI auto-delivery of lab reports work?",
                a: "When a clinical staff member generates or uploads a PDF lab report and changes its status to 'Ready', WACRM automatically matches the patient's record, flags their WhatsApp conversation, and drafts an outbound message. If the patient asks about their report, the AI Receptionist instantly fetches the PDF from Supabase storage and dispatches it directly as a document attachment on WhatsApp."
              },
              {
                q: "Can human staff override the AI receptionist?",
                a: "Absolutely. In the shared Inbox, staff can toggle 'AI Assistant' ON/OFF in one click. If a patient asks a query requiring manual triage, the AI tags the conversation as 'Handoff Required', alerts staff, and pauses automated replies to that patient until a human takes over."
              }
            ].map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="border border-border rounded-xl bg-card overflow-hidden">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-4 font-semibold text-xs text-left text-foreground cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:translate-x-1.5 transition-all duration-200"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3 animate-in fade-in duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Footer Section */}
      <footer className="border-t border-border/80 bg-muted/40 py-10 relative z-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-xs">
              W
            </div>
            <span className="font-bold text-foreground text-sm">WACRM Hospital AI © 2026</span>
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground font-semibold">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#demo" className="hover:text-foreground">Live Demo</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link href="/login" className="hover:text-foreground">Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
