"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Sun,
  Moon,
  Scale,
  Wrench,
  Dumbbell,
  Smile,
  Shield,
  Check,
  PhoneCall,
  Sparkles,
  Clock,
  TrendingUp,
  IndianRupee,
  XCircle,
  AlertTriangle,
  Heart,
  Star,
  Bot,
  Calculator,
  Sliders,
  ShieldCheck,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   $100B TECH STARTUP LANDING PAGE — HELPA
   WhatsApp Official Brand Colors:
   - Deep WhatsApp Teal: #075E54
   - Vibrant WhatsApp Green: #25D366
   - Pure White / Slate Dark Mode
   ════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [scrolled, setScrolled] = useState(false);
  const [heroVideoUrl, setHeroVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");
  const [actionVideoUrl, setActionVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");

  // Interactive Dashboard Tab Tour State
  const [activeDashTab, setActiveDashTab] = useState<string>("conversations");

  // Interactive Live Chat Simulator State
  const [selectedScenario, setSelectedScenario] = useState<string>("clinic");

  const { mode, toggleMode } = useTheme();

  useEffect(() => {
    async function checkAuthAndSettings() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      try {
        const { data: settingsData, error } = await supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["landing_hero_video_url", "landing_action_video_url"]);
        if (settingsData && !error) {
          settingsData.forEach((row: any) => {
            if (row.key === "landing_hero_video_url" && typeof row.value === "string") setHeroVideoUrl(row.value);
            else if (row.key === "landing_action_video_url" && typeof row.value === "string") setActionVideoUrl(row.value);
          });
        }
      } catch (err) { console.error("Error loading video settings:", err); }
    }
    checkAuthAndSettings();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const ctaHref = user ? "/dashboard" : "/signup";

  // Preset WhatsApp simulator scenarios
  const scenarios: Record<string, { title: string; subtitle: string; icon: any; messages: Array<{ from: string; text: string; time: string; tokenBadge?: any }> }> = {
    clinic: {
      title: "SmileCare Dental Clinic",
      subtitle: "Helpa AI Receptionist · Online",
      icon: Stethoscope,
      messages: [
        { from: "customer", text: "Hi, I want to book a dental checkup slot for tomorrow afternoon.", time: "4:15 PM" },
        { from: "helpa", text: "Hello! 👋 Welcome to SmileCare Dental Clinic.\n\nDr. Sharma has these open slots tomorrow:\n\n1️⃣ 2:30 PM\n2️⃣ 4:00 PM\n3️⃣ 5:15 PM\n\nWhich slot suits you best?", time: "4:15 PM" },
        { from: "customer", text: "4:00 PM please!", time: "4:16 PM" },
        { 
          from: "helpa", 
          text: "✅ APPOINTMENT CONFIRMED!\n\n📋 Booking ID: APT-2026-10042\n🎟️ Token Number: #14\n📍 Queue Position: #2\n👨‍⚕️ Doctor: Dr. Sharma (Dentist)\n📅 Date: Tomorrow at 4:00 PM\n\nYour digital OPD ticket PDF has been generated and sent below! 📄", 
          time: "4:16 PM",
          tokenBadge: { token: "#14", queue: "#2", id: "APT-2026-10042" }
        },
      ]
    },
    coaching: {
      title: "Excel Academy Coaching",
      subtitle: "Helpa AI Admissions Desk · Online",
      icon: GraduationCap,
      messages: [
        { from: "customer", text: "What is the fee structure for Class 11 NEET batch?", time: "6:20 PM" },
        { from: "helpa", text: "Namaste! 🙏 Our NEET 2-Year Classroom Batch includes:\n\n📚 Fee: ₹65,000 / year (Installments available)\n⏰ Timings: 4 PM - 7 PM (Mon to Fri)\n📍 Location: MG Road Campus\n\nWould you like to schedule a free demo class or download the syllabus prospectus?", time: "6:20 PM" },
        { from: "customer", text: "Yes, book a demo class for Saturday morning.", time: "6:21 PM" },
        { from: "helpa", text: "🎉 Great! Your free NEET Demo Class is scheduled:\n\n📅 Saturday, 10:00 AM\n📍 Room 204, Main Campus\n\nWe look forward to meeting you! See you on Saturday. 😊", time: "6:21 PM" },
      ]
    },
    salon: {
      title: "Glow & Style Spa Salon",
      subtitle: "Helpa AI Appointment Desk · Online",
      icon: Scissors,
      messages: [
        { from: "customer", text: "Do you have any open slots for Hair Spa & HydraFacial today evening?", time: "5:05 PM" },
        { from: "helpa", text: "Hi there! ✨ Yes, we have two slots open this evening:\n\n💇‍♀️ 6:30 PM with Stylist Priya\n💇‍♀️ 7:45 PM with Stylist Rahul\n\nWhich slot would you like to reserve?", time: "5:05 PM" },
        { from: "customer", text: "6:30 PM with Priya please", time: "5:06 PM" },
        { from: "helpa", text: "💅 Reserved! Your appointment is set:\n\n📅 Today at 6:30 PM\n✨ Hair Spa + HydraFacial\n👤 Stylist: Priya\n\nPlease arrive 10 mins early. See you soon!", time: "5:06 PM" },
      ]
    },
    multilingual: {
      title: "Apex Care Hospital",
      subtitle: "Helpa Multilingual AI · Online",
      icon: Globe2,
      messages: [
        { from: "customer", text: "ডাঃ সেন এর কালকের ওপিডি সময় কত?", time: "8:10 PM" },
        { from: "helpa", text: "নমস্কার! 🙏 ডাঃ সেন কাল সকাল ১০:০০ টা থেকে দুপুর ২:০০ টা পর্যন্ত ওপিডিতে থাকবেন।\n\nআপনি কি একটি নতুন টিকিটের বুকিং করতে চান?", time: "8:10 PM" },
        { from: "customer", text: "হ্যাঁ, সকাল ১১ টা বুক করে দিন।", time: "8:11 PM" },
        { from: "helpa", text: "✅ অ্যাপয়েন্টমেন্ট নিশ্চিত করা হয়েছে!\n\n📋 টোকেন নম্বর: #08\n👨‍⚕️ ডাক্তার: ডাঃ সেন\n📅 কাল সকাল ১১:০০ টা\n\nধন্যবাদ! হাসপাতাল কাউন্টারে ১৫ মিনিট আগে পৌঁছাবেন।", time: "8:11 PM" },
      ]
    }
  };

  const currentScenario = scenarios[selectedScenario];

  return (
    <div className="bg-background text-foreground antialiased selection:bg-[#25D366] selection:text-white min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* ═══════ AMBIENT BACKGROUND GLOWS ═══════ */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(7,94,84,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(7,94,84,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-[0%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-[#25D366]/15 via-[#075E54]/10 to-transparent blur-[140px] animate-pulse-slow pointer-events-none" />
        <div className="absolute top-[40%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tl from-[#075E54]/15 via-[#25D366]/10 to-transparent blur-[140px] animate-pulse-slow pointer-events-none" style={{ animationDelay: "3s" }} />
      </div>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        @keyframes float-badge { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes pulse-slow { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.35;transform:scale(1.03)} }
        .animate-float-badge { animation: float-badge 6s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .bento-card-glow { transition: all 0.3s cubic-bezier(0.16,1,0.3,1) !important; }
        .bento-card-glow:hover { transform: translateY(-6px) !important; border-color: rgba(37,211,102,0.45) !important; box-shadow: 0 20px 40px -15px rgba(37,211,102,0.15) !important; }
      `}</style>

      {/* ═══════ FLOATING CAPSULE GLASS NAVBAR ═══════ */}
      <header className="fixed top-5 left-0 right-0 z-50 px-4 transition-all duration-300">
        <div className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 py-3.5 transition-all duration-300 ${
          scrolled 
            ? "bg-[#075E54]/95 dark:bg-[#075E54]/95 backdrop-blur-2xl border border-[#25D366]/40 shadow-[0_12px_40px_rgba(7,94,84,0.4)] text-white" 
            : "bg-[#075E54]/90 dark:bg-[#075E54]/90 backdrop-blur-xl border border-[#25D366]/30 shadow-xl shadow-[#075E54]/20 text-white"
        }`}>
          {/* Logo */}
          <Link href="#" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#25D366] to-[#075E54] text-white shadow-lg shadow-[#25D366]/40 group-hover:scale-110 transition-transform duration-300">
              <MessageSquare className="h-5 w-5 text-white fill-white/20" />
            </div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5 font-sans">
              Helpa<span className="h-2.5 w-2.5 rounded-full bg-[#25D366] inline-block animate-pulse shadow-[0_0_10px_#25D366]"></span>
            </span>
          </Link>

          {/* Desktop Links - Pure White for maximum legibility */}
          <nav className="hidden items-center gap-1.5 text-sm text-white/90 md:flex font-semibold">
            <a href="#demo" className="px-3.5 py-1.5 rounded-full transition-all text-white/90 hover:text-white hover:bg-white/15">Live Demo</a>
            <a href="#features" className="px-3.5 py-1.5 rounded-full transition-all text-white/90 hover:text-white hover:bg-white/15">Features</a>
            <a href="#industries" className="px-3.5 py-1.5 rounded-full transition-all text-white/90 hover:text-white hover:bg-white/15">Industries</a>
            <a href="#pricing" className="px-3.5 py-1.5 rounded-full transition-all text-white/90 hover:text-white hover:bg-white/15">Pricing</a>
            <a href="#faq" className="px-3.5 py-1.5 rounded-full transition-all text-white/90 hover:text-white hover:bg-white/15">FAQ</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMode}
              className="p-2.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors duration-200 cursor-pointer"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-[#25D366]" /> : <Moon className="h-4 w-4 text-white" />}
            </button>

            <Link href={ctaHref} className="hidden rounded-full bg-[#25D366] hover:bg-white hover:text-[#075E54] px-6 py-2.5 text-sm font-extrabold text-white transition-all duration-200 shadow-lg shadow-[#25D366]/30 hover:scale-[1.04] active:scale-[0.96] sm:inline-block">
              {user ? "Dashboard" : "Book Free Demo"}
            </Link>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-full border border-white/20 p-2.5 md:hidden text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5 text-[#25D366]" /> : <Menu className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="mx-auto max-w-6xl mt-3 rounded-3xl border border-[#25D366]/40 md:hidden bg-[#075E54]/95 dark:bg-[#075E54]/95 backdrop-blur-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200 text-white">
            <div className="flex flex-col gap-2 px-2 py-1">
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-white/90 hover:bg-white/15 hover:text-white font-semibold transition-colors">Live Demo</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-white/90 hover:bg-white/15 hover:text-white font-semibold transition-colors">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-white/90 hover:bg-white/15 hover:text-white font-semibold transition-colors">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-white/90 hover:bg-white/15 hover:text-white font-semibold transition-colors">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-white/90 hover:bg-white/15 hover:text-white font-semibold transition-colors">FAQ</a>
              <Link href={ctaHref} onClick={() => setMobileMenuOpen(false)} className="mt-3 rounded-full bg-[#25D366] hover:bg-white hover:text-[#075E54] px-5 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-[#25D366]/30 transition-all">
                {user ? "Dashboard" : "Book Free Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO SECTION ($100B TECH STARTUP ARCHITECTURE) ═══════ */}
      <section className="relative overflow-hidden px-6 pb-20 pt-36 sm:pt-44">
        <div className="mx-auto max-w-5xl text-center relative z-10">
          
          {/* Trust Badge */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="hero-reveal mx-auto mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-5 py-2 text-xs font-extrabold text-[#075E54] dark:text-[#25D366] shadow-sm backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse shadow-[0_0_8px_#25D366]"></span>
            ✓ Official WhatsApp Cloud API Partner • Trusted by 150+ Indian Businesses
          </motion.div>
          
          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl text-foreground font-sans leading-[1.08]"
          >
            Never Miss Another<br />
            <span className="bg-gradient-to-r from-[#075E54] via-[#25D366] to-[#075E54] bg-clip-text text-transparent">
              WhatsApp Customer.
            </span>
          </motion.h1>
          
          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed font-medium"
          >
            Helpa replies in 2 seconds, schedules appointments, captures leads, and handles customer FAQs 24/7 on WhatsApp — so your front desk never loses a client.
          </motion.p>
          
          {/* Hero CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href={ctaHref} className="flex items-center gap-2.5 rounded-full bg-[#25D366] hover:bg-[#075E54] px-8 py-4 text-sm font-extrabold text-white transition-all duration-200 shadow-xl shadow-[#25D366]/30 hover:shadow-[#075E54]/40 hover:scale-[1.04] active:scale-[0.96]">
              Book Free 15-Min Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#product-video" className="flex items-center gap-2 rounded-full border border-[#075E54]/25 bg-card/80 backdrop-blur-md px-7 py-4 text-sm font-extrabold text-foreground transition-all hover:bg-accent shadow-sm hover:scale-[1.03] active:scale-[0.97] duration-200">
              <PlayCircle className="h-4 w-4 text-[#25D366]" /> Watch 60-Sec Product Video
            </a>
          </motion.div>

          {/* Risk-Free Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-4 w-4 text-[#25D366]" /> Setup in 24 Hours</span>
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-4 w-4 text-[#25D366]" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-4 w-4 text-[#25D366]" /> Official WhatsApp Cloud API</span>
          </motion.div>
        </div>
      </section>

        {/* ═══════ INTERACTIVE LIVE WHATSAPP STUDIO SIMULATOR ═══════ */}
        <section id="demo" className="mx-auto max-w-6xl mt-16 scroll-mt-28 px-2 sm:px-4">
          {/* Section Header */}
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#075E54] dark:text-[#25D366] bg-[#25D366]/10 px-4 py-2 rounded-full border border-[#25D366]/30 shadow-sm">
              ⚡ Interactive Live WhatsApp Studio
            </span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans mt-4">
              Test Helpa AI in Real-Time
            </h2>
            <p className="text-sm text-muted-foreground font-medium mt-2.5 max-w-xl mx-auto">
              Select an industry below or click sample customer prompts to see how Helpa answers questions, handles bookings, and issues digital PDF tickets instantly.
            </p>
          </div>

          {/* Industry Category Selector Bar */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              { id: "clinic", label: "🩺 Dental & Clinic", icon: Stethoscope },
              { id: "coaching", label: "🎓 Coaching Academy", icon: GraduationCap },
              { id: "salon", label: "💇‍♀️ Salon & Spa", icon: Scissors },
              { id: "multilingual", label: "🌐 Bengali / Hindi Chat", icon: Globe2 },
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => setSelectedScenario(sc.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  selectedScenario === sc.id
                    ? "bg-[#25D366] text-white shadow-xl shadow-[#25D366]/30 scale-[1.03]"
                    : "bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <sc.icon className="h-4 w-4" /> {sc.label}
              </button>
            ))}
          </div>

          {/* Studio Split Grid */}
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            
            {/* Left Console: Interactive Launcher & Telemetry (6 Cols) */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Quick Try Prompt Pills */}
              <div className="rounded-3xl border border-[#075E54]/25 bg-card p-6 shadow-xl bento-card-glow">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                  <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#25D366]" /> Sample Customer Questions
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#25D366] bg-[#25D366]/10 px-2.5 py-1 rounded-full">
                    Click to Test
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium mb-4">
                  Click any real customer query below to simulate WhatsApp chat interaction:
                </p>

                <div className="grid gap-2.5">
                  {selectedScenario === "clinic" && (
                    <>
                      <button onClick={() => setSelectedScenario("clinic")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;Hi, I want to book a dental checkup slot for tomorrow 4 PM&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button onClick={() => setSelectedScenario("clinic")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;What are Dr. Sharma&apos;s consultation fees and timings?&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                    </>
                  )}

                  {selectedScenario === "coaching" && (
                    <>
                      <button onClick={() => setSelectedScenario("coaching")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;What is the fee structure for Class 11 NEET batch?&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button onClick={() => setSelectedScenario("coaching")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;Book a free demo class for Saturday morning&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                    </>
                  )}

                  {selectedScenario === "salon" && (
                    <>
                      <button onClick={() => setSelectedScenario("salon")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;Open slots for Hair Spa & HydraFacial today evening?&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button onClick={() => setSelectedScenario("salon")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;Book 6:30 PM with Stylist Priya please&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                    </>
                  )}

                  {selectedScenario === "multilingual" && (
                    <>
                      <button onClick={() => setSelectedScenario("multilingual")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;ডাঃ সেন এর কালকের ওপিডি সময় কত?&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button onClick={() => setSelectedScenario("multilingual")} className="text-left rounded-2xl border border-border bg-muted/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 p-3 text-xs font-semibold text-foreground transition flex items-center justify-between group">
                        <span>💬 &ldquo;হ্যাঁ, সকাল ১১ টা বুক করে দিন।&rdquo;</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-1 transition-transform" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* AI Real-time Telemetry Stats Card */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm bento-card-glow">
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366]">
                    <Zap className="h-4 w-4 text-[#25D366]" /> Response Speed
                  </div>
                  <p className="text-2xl font-black text-foreground">3-5 Seconds</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">Ultra-Fast AI Quick Reply</p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm bento-card-glow">
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366]">
                    <CalendarCheck className="h-4 w-4 text-[#25D366]" /> Auto PDF Ticket
                  </div>
                  <p className="text-2xl font-black text-foreground">Token #14</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">QR Code Slip Generated</p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm bento-card-glow">
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366]">
                    <UserPlus className="h-4 w-4 text-[#25D366]" /> Lead Capture
                  </div>
                  <p className="text-2xl font-black text-foreground">100% Auto</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">Saved to CRM Database</p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm bento-card-glow">
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366]">
                    <Globe2 className="h-4 w-4 text-[#25D366]" /> Multilingual
                  </div>
                  <p className="text-2xl font-black text-foreground">3 Languages</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">English, Hindi, Bengali</p>
                </div>
              </div>
            </div>

            {/* Right Console: Sleek Phone Mockup (6 Cols) */}
            <div className="lg:col-span-6">
              <motion.div
                key={selectedScenario}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="relative mx-auto max-w-sm rounded-[2.5rem] border-4 border-slate-800 dark:border-slate-800 bg-slate-950 shadow-2xl shadow-[#075E54]/25 overflow-hidden"
              >
                {/* Phone Device Notch & Status Bar */}
                <div className="bg-[#075E54] pt-2 px-6 flex items-center justify-between text-white/80 text-[10px] font-mono">
                  <span>9:41 AM</span>
                  <div className="h-3 w-20 bg-slate-900 rounded-b-xl mx-auto"></div>
                  <span>5G ⚡ 100%</span>
                </div>

                {/* WhatsApp Chat Header Bar */}
                <div className="bg-[#075E54] px-4 py-3 flex items-center justify-between text-white border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shadow-md">
                      {currentScenario.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold leading-tight">{currentScenario.title}</p>
                      <p className="text-[10px] text-emerald-200/90 flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
                        {currentScenario.subtitle}
                      </p>
                    </div>
                  </div>
                  <Bot className="h-4.5 w-4.5 text-emerald-200" />
                </div>

                {/* WhatsApp Chat Messages Stream */}
                <div className="bg-[#0b141a] p-4 space-y-3 min-h-[380px] max-h-[420px] overflow-y-auto" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
                  {currentScenario.messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.12 }}
                      className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                        msg.from === "customer"
                          ? "bg-[#005c4b] text-emerald-50 rounded-tr-none"
                          : "bg-[#1f2c34] text-gray-100 rounded-tl-none"
                      }`}>
                        {msg.from === "helpa" && (
                          <p className="text-[10px] font-black text-[#25D366] mb-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Helpa AI
                          </p>
                        )}
                        <p className="whitespace-pre-line font-medium">{msg.text}</p>
                        
                        {/* High-Fidelity OPD Token Ticket Preview Card */}
                        {msg.tokenBadge && (
                          <div className="mt-2.5 rounded-xl border border-[#25D366]/40 bg-[#075E54]/50 p-2.5 text-[10px] text-white space-y-1">
                            <div className="flex items-center justify-between border-b border-emerald-400/20 pb-1">
                              <span className="font-extrabold text-[#25D366] flex items-center gap-1">
                                🎫 DIGITAL OPD TICKET SLIP
                              </span>
                              <span className="bg-[#25D366] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">VERIFIED</span>
                            </div>
                            <p className="font-mono text-emerald-200">Ref: {msg.tokenBadge.id}</p>
                            <p className="font-bold text-white">Token: {msg.tokenBadge.token} • Queue Pos: {msg.tokenBadge.queue}</p>
                            <div className="mt-1 pt-1 border-t border-emerald-400/10 flex items-center justify-between">
                              <span className="text-[9px] text-emerald-200/80">📄 opd-ticket-slip.pdf</span>
                              <span className="text-[9px] font-bold text-[#25D366] underline">Download PDF</span>
                            </div>
                          </div>
                        )}

                        <p className={`text-[9px] mt-1 text-right font-mono ${msg.from === "customer" ? "text-emerald-300/70" : "text-gray-400"}`}>
                          {msg.time} {msg.from === "customer" && "✓✓"}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* WhatsApp Chat Input Bar */}
                <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2 border-t border-white/5">
                  <div className="flex-1 rounded-full bg-[#2a3942] px-3.5 py-2 text-xs text-gray-400 font-medium">Type a message...</div>
                  <div className="h-8 w-8 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-md shadow-[#25D366]/30">
                    <Send className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </section>

      {/* ═══════ WHY HELPA BENTO GRID ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-28 relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Why Businesses Choose Helpa</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed font-medium">Streamline your patient, student, or client inquiries without hiring additional receptionist staff.</p>
        </motion.div>
        
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Never Miss Leads</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Every enquiry gets answered in under 2 seconds — 24/7/365.</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">24/7 AI Receptionist</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Customers receive instant replies even outside business hours and holidays.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Auto Appointments</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Book slots, assign token numbers, and send PDF ticket slips automatically.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Capture All Contacts</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Every lead name, mobile, and requirement is structured and stored inside CRM.</p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ ROI COMPARISON CARDS ═══════ */}
      <section className="border-y border-border bg-muted/30 py-28 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Helpa Pays For Itself.</h2>
            <p className="mt-4 text-muted-foreground font-medium">Compare the difference in efficiency, response times, and booked revenue.</p>
          </motion.div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Without Helpa */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-sm bento-card-glow transition-all duration-300"
            >
              <h3 className="text-xl font-extrabold text-red-500 flex items-center gap-2 mb-6">
                <XCircle className="h-6 w-6" /> Without Helpa
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Missed enquiries after work hours and on Sundays
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Slow replies during busy rush times (2-4 hours delay)
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Busy receptionist answering same basic queries 50 times/day
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Lost bookings because patients/clients got tired of waiting
                </li>
              </ul>
            </motion.div>

            {/* With Helpa */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border-2 border-[#25D366] bg-card p-8 shadow-2xl shadow-[#25D366]/15 relative bento-card-glow transition-all duration-300"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-4 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Recommended</span>
              <h3 className="text-xl font-extrabold text-[#075E54] dark:text-[#25D366] flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-6 w-6 text-[#25D366]" /> With Helpa
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Instant replies to queries 24/7/365 in 2 seconds
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Every single lead captured and stored inside CRM
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Bookings & PDF tickets automated without picking up a call
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Staff only handles complex or custom operations
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ PRODUCT VIDEO SECTION ═══════ */}
      <section id="product-video" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Watch Helpa In Action</h2>
          <p className="mt-3 text-muted-foreground font-medium">See how instantly Helpa responds, gathers info, and schedules customers.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="aspect-video max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-[#075E54]/25 bg-zinc-950 transition-all duration-300 p-2 relative"
        >
          <iframe
            className="w-full h-full rounded-2xl"
            src={actionVideoUrl}
            title="Helpa Walkthrough Video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </motion.div>
      </section>

      {/* ═══════ FEATURES BENTO GRID (3x3) ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Everything your WhatsApp reception needs</h2>
          <p className="mt-4 text-muted-foreground font-medium">Built specifically for customer-facing businesses that live on WhatsApp.</p>
        </motion.div>
        
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.0 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Zap className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Reply to Every Customer in Under 3 Seconds</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Every customer enquiry gets an accurate, on-brand reply in seconds — 24/7, without fail.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><CalendarCheck className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Book Appointments Automatically</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Clients can book, reschedule, or cancel slots directly inside WhatsApp, synced to your calendar.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><UserPlus className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Capture Leads & Enquiries Automatically</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Names, phone numbers, and requirements are structured and saved from every chat conversation.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.0 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><HelpCircle className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Automate Answers to Frequent Questions</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Train Helpa once on your fees, timings, and business location — it replies instantly without getting tired.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><UserCheck className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Hand Off to Live Staff Instantly</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Complex or VIP chats route to your support team instantly, with the complete history attached.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Globe2 className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Speak Any Local Language Fluently</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Helpa automatically detects if the user is texting in English, Hindi, or Bengali, and replies back in the same language.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.0 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><BarChart3 className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Gain Clear Performance Analytics</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Monitor response speed, chat resolution rate, bookings, and customer inquiries in one clean panel.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Radio className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Broadcast Festival & Promotional Offers</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Send festival offers, reminders, and service updates to filtered customer lists with a single click.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><RefreshCw className="h-6 w-6" /></div>
            <h3 className="font-extrabold text-foreground text-lg">Trigger Smart Automatic Follow-ups</h3>
            <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">Remind clients of upcoming appointments or follow-up with cold leads automatically.</p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS TIMELINE ═══════ */}
      <section className="border-y border-border bg-muted/30 py-28 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Go Live in Less Than 24 Hours</h2>
            <p className="mt-4 text-muted-foreground font-medium">No coding or developers required. Connect, train, and go live.</p>
          </motion.div>
          <div className="relative mt-16 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-1 bg-gradient-to-r from-[#075E54] via-[#25D366] to-[#075E54] md:block rounded-full"></div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.0 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">1</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">Connect WhatsApp Number</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">2</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">Upload Business Details</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">3</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">AI Starts Answering Chats</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">4</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">Monitor from CRM Panel</h3>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES GRID ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Built for Every Service Business</h2>
          <p className="mt-4 text-muted-foreground font-medium">Whether you operate one clinic or fifty coaching branches — Helpa handles the volume.</p>
        </motion.div>
        
        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { icon: Stethoscope, label: "Clinics & Hospitals" },
            { icon: GraduationCap, label: "Coaching Institutes" },
            { icon: School, label: "Schools & Colleges" },
            { icon: Scissors, label: "Salons & Spas" },
            { icon: Hotel, label: "Hotels & Guest Houses" },
            { icon: UtensilsCrossed, label: "Restaurants & Cafes" },
            { icon: Building2, label: "Real Estate Agents" },
            { icon: Store, label: "Local Service Shops" },
            { icon: Smile, label: "Dentists" },
            { icon: Scale, label: "Law Firms" },
            { icon: Dumbbell, label: "Fitness Centers" },
            { icon: Wrench, label: "Repair Shops" },
          ].map((ind, idx) => (
            <div key={idx} className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
                <ind.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-bold text-foreground">{ind.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE TABS ═══════ */}
      <section className="border-y border-border bg-muted/30 py-28 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">One Dashboard. Total Control.</h2>
            <p className="mt-4 text-muted-foreground font-medium">Manage conversations, schedule bookings, and track analytics — all in one place.</p>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {[
              { id: "conversations", label: "Conversations", icon: Inbox },
              { id: "knowledge", label: "AI Knowledge Base", icon: BookOpen },
              { id: "contacts", label: "Contacts & Patients", icon: Users2 },
              { id: "bookings", label: "Bookings & Queue", icon: CalendarCheck },
              { id: "analytics", label: "Analytics", icon: LineChart },
              { id: "broadcast", label: "Broadcasts", icon: Send },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveDashTab(tab.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${
                  activeDashTab === tab.id
                    ? "bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25"
                    : "bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" /> {tab.label}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-3xl border border-[#075E54]/25 bg-card shadow-2xl text-left transition-colors duration-300 relative">
            <div className="absolute top-4 right-4 z-20 flex flex-wrap gap-2 pointer-events-none">
              <span className="rounded-full bg-[#25D366]/15 backdrop-blur-md border border-[#25D366]/30 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#075E54] dark:text-[#25D366] animate-pulse">
                AI Replies Active
              </span>
              <span className="rounded-full bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-400 animate-pulse">
                Auto-Bookings Synced
              </span>
            </div>

            {activeDashTab === "conversations" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Total WhatsApp Chats</p><p className="mt-1 text-3xl font-black text-foreground">12,847</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+34% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Booked Appointments</p><p className="mt-1 text-3xl font-black text-foreground">3,291</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">AI Resolution Rate</p><p className="mt-1 text-3xl font-black text-foreground">96.4%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Excellent</p></div>
              </div>
            )}

            {activeDashTab === "knowledge" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Documents Trained</p><p className="mt-1 text-3xl font-black text-foreground">47</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+6 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">FAQs Learned</p><p className="mt-1 text-3xl font-black text-foreground">312</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">Auto-updated</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Answer Accuracy</p><p className="mt-1 text-3xl font-black text-foreground">98.2%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Verified</p></div>
              </div>
            )}

            {activeDashTab === "contacts" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Total Contacts</p><p className="mt-1 text-3xl font-black text-foreground">8,291</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+143 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">New Enquiries</p><p className="mt-1 text-3xl font-black text-foreground">621</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">Auto-captured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Repeat Customers</p><p className="mt-1 text-3xl font-black text-foreground">2,004</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+9% this month</p></div>
              </div>
            )}

            {activeDashTab === "bookings" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">This Month</p><p className="mt-1 text-3xl font-black text-foreground">3,291</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Upcoming Today</p><p className="mt-1 text-3xl font-black text-foreground">29</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">Live Queue</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">No-shows</p><p className="mt-1 text-3xl font-black text-foreground">4</p><p className="mt-1.5 text-xs text-amber-500 font-bold">Auto reminder sent</p></div>
              </div>
            )}

            {activeDashTab === "analytics" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Resolution Rate</p><p className="mt-1 text-3xl font-black text-foreground">96.4%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Excellent</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Avg Response Time</p><p className="mt-1 text-3xl font-black text-foreground">1.8s</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Instant</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">CSAT Rating</p><p className="mt-1 text-3xl font-black text-foreground">4.9 / 5</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+0.2 this month</p></div>
              </div>
            )}

            {activeDashTab === "broadcast" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Broadcasts Sent</p><p className="mt-1 text-3xl font-black text-foreground">24,100</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">This month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Open Rate</p><p className="mt-1 text-3xl font-black text-foreground">91%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Above average</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Conversions</p><p className="mt-1 text-3xl font-black text-foreground">1,840</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+22% this month</p></div>
              </div>
            )}

            {activeDashTab === "settings" && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Connected Numbers</p><p className="mt-1 text-3xl font-black text-foreground">3</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">All active</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Team Members</p><p className="mt-1 text-3xl font-black text-foreground">12</p><p className="mt-1.5 text-muted-foreground font-medium">Roles configured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Integrations</p><p className="mt-1 text-3xl font-black text-foreground">7</p><p className="mt-1.5 text-[#25D366] font-bold">All synced</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ($100B SAAS CARDS) ═══════ */}
      <section id="pricing" className="border-t border-border bg-muted/30 py-28 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Simple pricing that grows with your business</h2>
            <p className="mt-4 text-muted-foreground font-medium">Every plan includes onboarding, AI training, WhatsApp setup and dedicated support.</p>
          </motion.div>
          
          <div className="mt-16 grid gap-6 md:grid-cols-3 text-left">
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm bento-card-glow transition duration-200"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">Perfect for small businesses</span>
              <h3 className="text-2xl font-black text-foreground">Starter</h3>
              <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">Setup Fee: ₹9,999 (One Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹4,999</span>
                <span className="text-sm text-muted-foreground font-semibold">/month</span>
              </div>
              
              <ul className="mt-8 space-y-3.5 flex-1 border-t border-border/50 pt-6">
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />1 WhatsApp Business Number</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />AI Receptionist</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Appointment Booking</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />FAQ Automation</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Lead Capture</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Human Takeover</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Dashboard Analytics</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Multilingual AI</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Email Support</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Free Onboarding</li>
              </ul>
              <Link href={ctaHref} className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-sm font-extrabold text-foreground hover:bg-accent transition shadow-sm">
                Book Demo
              </Link>
            </motion.div>
            
            {/* Growth Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="flex flex-col rounded-3xl border-2 border-[#25D366] bg-card p-8 shadow-2xl shadow-[#25D366]/15 relative bento-card-glow transition duration-200"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-4 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Most Popular</span>
              <span className="text-xs font-bold uppercase text-[#075E54] dark:text-[#25D366] tracking-wider block mb-2 mt-2">Scale your operations</span>
              <h3 className="text-2xl font-black text-foreground">Growth</h3>
              <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">Setup Fee: ₹19,999</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹14,999</span>
                <span className="text-sm text-muted-foreground font-semibold">/month</span>
              </div>
              
              <ul className="mt-8 space-y-3.5 flex-1 border-t border-border/50 pt-6">
                <li className="text-xs font-black text-foreground tracking-wider uppercase mb-2">Everything in Starter plus</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Up to 3 WhatsApp Numbers</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Shared Team Inbox</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />CRM Integration</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Broadcast Campaigns</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Automated Follow-ups</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Priority Support</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Multiple Staff Members</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Advanced Analytics</li>
              </ul>
              <Link href={ctaHref} className="mt-8 rounded-full bg-[#25D366] hover:bg-[#075E54] px-6 py-3.5 text-center text-sm font-extrabold text-white transition-all duration-200 shadow-xl shadow-[#25D366]/25">
                Book Free Consultation
              </Link>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm bento-card-glow transition duration-200"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">For high-volume operations</span>
              <h3 className="text-2xl font-black text-foreground">Enterprise</h3>
              <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">Built for hospitals, franchises and high-volume businesses.</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">Custom</span>
              </div>
              
              <ul className="mt-8 space-y-3.5 flex-1 border-t border-border/50 pt-6">
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Unlimited Numbers</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Custom AI Training</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />API Access</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Custom Integrations</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Dedicated Account Manager</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />SLA</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />On-premise Deployment (Optional)</li>
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />White Label</li>
              </ul>
              <a href="mailto:sales@helpa.studio" className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-sm font-extrabold text-foreground hover:bg-accent transition shadow-sm">Contact Sales</a>
            </motion.div>
          </div>

          {/* Setup Fee Box */}
          <div className="mx-auto mt-14 max-w-3xl border border-[#075E54]/20 bg-card rounded-3xl p-8 shadow-xl text-left transition-colors duration-300">
            <h3 className="text-xl font-extrabold text-foreground mb-4">What's included in the setup fee?</h3>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                <span className="text-[#25D366] font-extrabold text-base">•</span> WhatsApp Business configuration
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                <span className="text-[#25D366] font-extrabold text-base">•</span> AI knowledge base training
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                <span className="text-[#25D366] font-extrabold text-base">•</span> Business workflow setup
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                <span className="text-[#25D366] font-extrabold text-base">•</span> Appointment flow configuration
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                <span className="text-[#25D366] font-extrabold text-base">•</span> Team onboarding
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                <span className="text-[#25D366] font-extrabold text-base">•</span> Go-live assistance
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ACCORDION ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Frequently asked questions</h2>
        </motion.div>
        
        <div className="mt-14 divide-y divide-border/80 text-left">
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 1 ? null : 1)} className="flex w-full items-center justify-between text-left cursor-pointer group">
              <span className="font-extrabold text-foreground group-hover:text-[#25D366] transition-colors">How does Helpa connect to our WhatsApp number?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 1 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 1 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-5 rounded-2xl animate-in fade-in duration-200 border border-border/60 leading-relaxed font-medium">
                Helpa connects directly using the official Meta WhatsApp Business Cloud API. You can continue using your existing business number — no SIM card changes or data migrations required. Setup takes only a few minutes.
              </div>
            )}
          </div>

          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 2 ? null : 2)} className="flex w-full items-center justify-between text-left cursor-pointer group">
              <span className="font-extrabold text-foreground group-hover:text-[#25D366] transition-colors">How accurate are the AI assistant's replies?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 2 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 2 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-5 rounded-2xl animate-in fade-in duration-200 border border-border/60 leading-relaxed font-medium">
                Helpa strictly answers based on the knowledge documents, FAQs, timings, and pricing list you upload. It never makes up or guesses details. If a customer asks something outside the scope, Helpa quietly flags it for human staff takeover.
              </div>
            )}
          </div>

          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 3 ? null : 3)} className="flex w-full items-center justify-between text-left cursor-pointer group">
              <span className="font-extrabold text-foreground group-hover:text-[#25D366] transition-colors">Can our staff step in and text the customer?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 3 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 3 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-5 rounded-2xl animate-in fade-in duration-200 border border-border/60 leading-relaxed font-medium">
                Yes, absolutely. A human takeover is built into Helpa. Your receptionist can click "Takeover" on the CRM dashboard to pause the AI and reply manually on the same thread anytime.
              </div>
            )}
          </div>

          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 4 ? null : 4)} className="flex w-full items-center justify-between text-left cursor-pointer group">
              <span className="font-extrabold text-foreground group-hover:text-[#25D366] transition-colors">How long does it take to go live?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 4 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 4 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-5 rounded-2xl animate-in fade-in duration-200 border border-border/60 leading-relaxed font-medium">
                Most Indian businesses set up Helpa and go live in less than 24 hours. Just sign up, connect your WhatsApp channel, paste your business FAQs, and Helpa starts responding to customer chats immediately.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CONVERSION BANNER ═══════ */}
      <section className="px-6 py-28">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#075E54]/40 bg-gradient-to-br from-[#075E54] via-[#075E54]/95 to-slate-950 p-12 sm:p-20 text-center shadow-2xl text-white">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#25D366]/20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#075E54]/40 blur-3xl pointer-events-none"></div>
          
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl text-white font-sans leading-tight">
            Ready to Stop Missing Customers?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-emerald-100/90 text-base leading-relaxed font-medium">
            See Helpa working with your own business in a live 15-minute demo.
          </p>
          
          <Link href={ctaHref} className="mt-9 inline-flex items-center gap-2.5 rounded-full bg-[#25D366] hover:bg-white hover:text-[#075E54] px-10 py-4 text-base font-extrabold text-white transition-all duration-200 shadow-2xl shadow-[#25D366]/30 hover:scale-105 active:scale-95">
            Book My Demo <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border bg-card px-6 py-12 transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-md shadow-[#25D366]/20"><MessageSquare className="h-4 w-4 fill-white" /></div>
            <span className="font-black text-foreground text-lg tracking-tight">Helpa</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-semibold">
            <a href="#demo" className="hover:text-[#25D366] transition-colors">Live Demo</a>
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#25D366] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#25D366] transition-colors">FAQ</a>
            <Link href="/privacy" className="hover:text-[#25D366] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#25D366] transition-colors">Terms of Service</Link>
          </div>
          
          <p className="text-xs text-muted-foreground font-semibold">© {new Date().getFullYear()} Helpa Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
