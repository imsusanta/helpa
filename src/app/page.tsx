"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import {
  MessageSquare,
  ArrowRight,
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
  Scissors,
  Building2,
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
  Sparkles,
  Calculator,
  TrendingUp,
  Bot,
  MessageCircle,
  ChevronRight,
  PhoneCall,
  RotateCcw,
  Play,
  Cpu,
  Terminal,
  ShieldCheck,
  Lock,
  MessageCircleQuestion,
  Smartphone,
  Check
} from "lucide-react";

// 21st.dev Border Beam Component
function BorderBeam({
  className = "",
  size = 200,
  duration = 12,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = "#6366f1",
  colorTo = "#a855f7",
  delay = 0
}: {
  className?: string;
  size?: number;
  duration?: number;
  anchor?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": `${duration}s`,
          "--anchor": anchor,
          "--border-width": borderWidth,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": `-${delay}s`
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)] after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))] ${className}`}
    />
  );
}

// 21st.dev Orbiting Circles Component
function OrbitingCircles({
  className = "",
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 160,
  path = true
}: {
  className?: string;
  children?: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
}) {
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-indigo-500/20 stroke-1 dark:stroke-indigo-400/20"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            strokeDasharray="4 4"
          />
        </svg>
      )}
      <div
        style={
          {
            "--duration": `${duration}s`,
            "--radius": radius,
            "--delay": `-${delay}s`
          } as React.CSSProperties
        }
        className={`absolute flex size-8 transform-gpu items-center justify-center rounded-full border border-indigo-500/30 bg-card/80 backdrop-blur-md shadow-md ${
          reverse ? "[animation-direction:reverse]" : ""
        } animate-orbit ${className}`}
      >
        {children}
      </div>
    </>
  );
}

// Dynamic Rotator Words for 5-Second Instant Clarity
const ROTATOR_WORDS = [
  "Automatic 24/7 AI Receptionist",
  "Instant Booking Assistant",
  "24/7 Lead Capture Engine",
  "Smart WhatsApp Support Agent"
];

// Chat Simulator Scenarios
const CHAT_SCENARIOS = {
  clinic: {
    title: "Dr. Sharma Dental Clinic",
    status: "Active • Helpa AI Engine v2.4",
    avatarBg: "bg-emerald-600",
    confidence: "99.8%",
    messages: [
      { text: "Hi, do you have any open slots for a teeth cleaning tomorrow afternoon?", sender: "user", time: "06:14 PM" },
      { text: "Hello! Yes, we have 2 open slots available tomorrow:\n1️⃣ 02:30 PM with Dr. Sharma\n2️⃣ 05:00 PM with Dr. Verma\n\nWhich slot works best for you?", sender: "bot", time: "06:14 PM", quickReplies: ["Book 02:30 PM", "Book 05:00 PM"] },
      { text: "02:30 PM works great!", sender: "user", time: "06:15 PM" },
      { text: "Awesome! 🎉 Your teeth cleaning appointment is confirmed for Tomorrow at 02:30 PM.\n\n📅 Date: Tomorrow\n⏰ Time: 02:30 PM\n📍 Location: Indiranagar\n\nAdded to calendar & confirmation SMS dispatched!", sender: "bot", time: "06:15 PM" }
    ]
  },
  coaching: {
    title: "Apex JEE Academy",
    status: "Active • Helpa AI Engine v2.4",
    avatarBg: "bg-indigo-600",
    confidence: "99.4%",
    messages: [
      { text: "Hello, what are the fees and batch timings for 11th Science coaching?", sender: "user", time: "09:30 PM" },
      { text: "Welcome to Apex Academy! 📚 Our 11th Science (JEE/NEET) batches start on Monday:\n\n• Morning Batch: 08:00 AM - 11:30 AM\n• Evening Batch: 04:30 PM - 08:00 PM\n• Course Fee: ₹45,000 / year\n\nWould you like to book a free 2-day trial class?", sender: "bot", time: "09:30 PM", quickReplies: ["Book Trial Class", "Download Syllabus"] },
      { text: "Book Trial Class for Evening Batch please", sender: "user", time: "09:31 PM" },
      { text: "Done! 🎓 Your seat for the 2-Day Free Trial (Evening Batch) has been registered. See you this Monday at 04:30 PM!", sender: "bot", time: "09:31 PM" }
    ]
  },
  salon: {
    title: "Glow & Shine Luxury Spa",
    status: "Active • Helpa AI Engine v2.4",
    avatarBg: "bg-pink-600",
    confidence: "99.6%",
    messages: [
      { text: "Hi! Can I get price details for Hair Smoothening and Keratin?", sender: "user", time: "08:05 PM" },
      { text: "Hello Gorgeous! ✨ Here are our current festival special prices:\n\n💇‍♀️ Hair Smoothening: ₹2,999\n✨ Keratin Treatment: ₹3,499\n\nBoth packages include complimentary Hair Spa!", sender: "bot", time: "08:05 PM", quickReplies: ["Book Smoothening", "Book Keratin"] },
      { text: "I'd like to book Keratin for Sunday at 11 AM", sender: "user", time: "08:06 PM" },
      { text: "Reserved! 💇‍♀️ Sunday at 11:00 AM is booked under your number. We look forward to pampering you!", sender: "bot", time: "08:06 PM" }
    ]
  },
  realestate: {
    title: "Skyline Properties",
    status: "Active • Helpa AI Engine v2.4",
    avatarBg: "bg-sky-600",
    confidence: "99.2%",
    messages: [
      { text: "Are 3BHK flats still available in Crestview Towers?", sender: "user", time: "11:20 PM" },
      { text: "Hello! Yes, we have 3 premium 3BHK units remaining on upper floors (12th & 15th floor).\n\n📐 Size: 1,850 sq.ft\n💰 Price: Starting ₹1.25 Cr\n📍 Location: HSR Layout\n\nWould you like a virtual tour or site visit?", sender: "bot", time: "11:20 PM", quickReplies: ["Schedule Site Visit", "Get Brochure"] },
      { text: "Schedule Site Visit for Saturday 11 AM", sender: "user", time: "11:21 PM" },
      { text: "Confirmed! 🏢 Our relationship manager Amit will meet you at the site Saturday at 11:00 AM!", sender: "bot", time: "11:21 PM" }
    ]
  }
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroVideoUrl, setHeroVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");

  // Dynamic Word Rotator State
  const [wordIndex, setWordIndex] = useState(0);

  // Simulator State
  const [activeScenario, setActiveScenario] = useState<keyof typeof CHAT_SCENARIOS>("clinic");
  const [simStep, setSimStep] = useState(4);
  const [isTyping, setIsTyping] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  // ROI Calculator State
  const [dailyEnquiries, setDailyEnquiries] = useState(40);
  const [avgTicketValue, setAvgTicketValue] = useState(2500);
  const [missedPercent, setMissedPercent] = useState(30);

  const { mode, toggleMode } = useTheme();

  // Rotate hero words every 2.8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATOR_WORDS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Scroll listener for sticky header glass and progress bar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load user session & landing page settings
  useEffect(() => {
    async function checkAuthAndSettings() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      try {
        const { data: settingsData, error } = await supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["landing_hero_video_url"]);
        if (settingsData && !error) {
          settingsData.forEach((row: any) => {
            if (row.key === "landing_hero_video_url" && typeof row.value === "string") {
              setHeroVideoUrl(row.value);
            }
          });
        }
      } catch (err) {
        console.error("Error loading video settings:", err);
      }
    }
    checkAuthAndSettings();
  }, []);

  // Reset chat simulation step when scenario changes
  const handleScenarioChange = (key: keyof typeof CHAT_SCENARIOS) => {
    setActiveScenario(key);
    setSimStep(1);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setSimStep(2);
    }, 1000);
  };

  const currentChat = CHAT_SCENARIOS[activeScenario];

  // ROI Calculations
  const monthlyEnquiries = dailyEnquiries * 30;
  const missedMonthlyEnquiries = Math.round((monthlyEnquiries * missedPercent) / 100);
  const potentialLostRevenue = missedMonthlyEnquiries * avgTicketValue * 0.4;
  const recoveredRevenue = Math.round(potentialLostRevenue * 0.85);

  return (
    <div className="bg-background text-foreground antialiased selection:bg-indigo-600 selection:text-white min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* Scroll Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 z-50 transition-all duration-150 origin-left"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Ambient Spotlight & Grid Pattern Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 right-0 h-[650px] bg-spotlight" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-30" />
      </div>

      {/* ═══════ HEADER / NAVIGATION ═══════ */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "glass-header border-b border-border shadow-lg" : "bg-transparent border-b border-border/40"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          
          <Link href="#" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background shadow-md group-hover:scale-105 transition-transform font-black">
              H
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-foreground">Helpa</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                24/7 AI RECEPTIONS OPERATIONAL
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest md:flex">
            <a href="#command-center" className="transition-colors hover:text-foreground">Live Demo</a>
            <a href="#bento-architecture" className="transition-colors hover:text-foreground">How It Works</a>
            <a href="#roi-engine" className="transition-colors hover:text-foreground">ROI Calculator</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleMode}
              className="p-2 rounded-full border border-border bg-card hover:bg-accent text-foreground transition-all cursor-pointer shadow-sm"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>

            <Link href={user ? "/dashboard" : "/signup"} className="hidden sm:inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-xs font-mono font-bold text-background transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]">
              <span>{user ? "CONSOLE" : "BOOK FREE DEMO"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-xl border border-border p-2 md:hidden text-foreground bg-card hover:bg-accent transition-colors" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Sheet */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border md:hidden glass-header overflow-hidden"
            >
              <div className="flex flex-col gap-1 px-5 py-5 text-sm font-mono font-bold uppercase tracking-wider">
                <a href="#command-center" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-accent transition-colors">Live Demo</a>
                <a href="#bento-architecture" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-accent transition-colors">How It Works</a>
                <a href="#roi-engine" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-accent transition-colors">ROI Calculator</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-accent transition-colors">Pricing Tiers</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-accent transition-colors">FAQ</a>
                <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-3 rounded-full bg-foreground py-3.5 text-center text-xs font-mono font-bold text-background">
                  {user ? "GO TO CONSOLE" : "BOOK FREE DEMO"}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════ REDESIGNED 10/10 ALL-DEVICE RESPONSIVE HERO SECTION ═══════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-8 sm:pt-16 lg:pt-20 pb-16 sm:pb-24 z-10">
        
        {/* 21st.dev Orbiting Circles Background Element (Desktop) */}
        <div className="hidden lg:block pointer-events-none absolute inset-0 overflow-hidden">
          <div className="relative mx-auto h-full max-w-6xl flex items-center justify-center">
            <OrbitingCircles radius={300} duration={35} delay={0}>
              <MessageSquare className="h-4 w-4 text-indigo-500" />
            </OrbitingCircles>
            <OrbitingCircles radius={300} duration={35} delay={17.5} reverse>
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
            </OrbitingCircles>
            <OrbitingCircles radius={440} duration={50} delay={0}>
              <Zap className="h-4 w-4 text-amber-500" />
            </OrbitingCircles>
            <OrbitingCircles radius={440} duration={50} delay={25} reverse>
              <Lock className="h-4 w-4 text-purple-500" />
            </OrbitingCircles>
          </div>
        </div>

        {/* Desktop Floating Micro-Widgets */}
        <div className="hidden lg:block pointer-events-none">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="absolute top-24 left-[3%] animate-float-slow z-20"
          >
            <div className="relative flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-card/90 p-3.5 shadow-2xl backdrop-blur-xl">
              <BorderBeam size={110} duration={8} colorFrom="#6366f1" colorTo="#a855f7" />
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-mono font-bold text-xs">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-foreground">1.1s Response Speed</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">Instant WhatsApp Reply</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="absolute top-28 right-[3%] animate-float-reverse z-20"
          >
            <div className="relative flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-card/90 p-3.5 shadow-2xl backdrop-blur-xl">
              <BorderBeam size={110} duration={10} colorFrom="#10b981" colorTo="#6366f1" delay={2} />
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-sm">
                🎉
              </div>
              <div>
                <p className="text-xs font-extrabold text-foreground">New Booking Confirmed!</p>
                <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Tomorrow • 02:30 PM (Auto-Synced)</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mx-auto max-w-5xl text-center relative z-20">
          
          {/* Mobile Swipeable Micro-Status Pill Bar (For Mobile & Tablet) */}
          <div className="flex lg:hidden overflow-x-auto no-scrollbar gap-2 py-1 mb-5 justify-start sm:justify-center px-1">
            <div className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-mono font-bold text-indigo-500 dark:text-indigo-300 flex items-center gap-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              ⚡ 1.1s Speed
            </div>
            <div className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shadow-sm">
              🎉 Booking Auto-Synced
            </div>
            <div className="shrink-0 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[10px] font-mono font-bold text-purple-500 dark:text-purple-300 flex items-center gap-1.5 shadow-sm">
              🔒 99.4% Accuracy
            </div>
          </div>

          {/* 21st.dev Shimmer Hero Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 sm:px-4.5 py-1.5 text-[11px] sm:text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300 shadow-sm backdrop-blur-md overflow-hidden max-w-[95%] sm:max-w-none"
          >
            <BorderBeam size={90} duration={6} colorFrom="#6366f1" colorTo="#ec4899" />
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="truncate">[ ⚡ 24/7 AUTOMATIC WHATSAPP RECEPTIONIST ]</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-400 ml-1 animate-spin shrink-0" style={{ animationDuration: "6s" }} />
          </motion.div>

          {/* Fluid Responsive Headline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-4xl mx-auto relative z-30"
          >
            <h1 className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.12] text-foreground">
              Turn Your WhatsApp Into An
            </h1>

            {/* Dynamic Word Rotator Component - Fluid Height & Zero Clipping */}
            <div className="min-h-[52px] sm:min-h-[76px] flex items-center justify-center py-1 mt-1 font-black">
              <AnimatePresence mode="wait">
                <motion.span
                  key={wordIndex}
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 dark:from-indigo-400 dark:via-purple-300 dark:to-emerald-300 bg-clip-text text-transparent font-black text-2xl xs:text-3xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.2] inline-block px-2 py-1"
                >
                  {ROTATOR_WORDS[wordIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* 5-Second Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-5 sm:mt-6 max-w-2xl text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed font-normal px-2"
          >
            Helpa instantly answers every customer question, books appointments into your calendar, and captures new leads 24/7—so you never lose another client.
          </motion.p>

          {/* 5-Second Value Pills */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-2.5 px-1"
          >
            <div className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-foreground shadow-sm flex items-center gap-1.5 backdrop-blur-md">
              <span className="text-emerald-500">⚡</span> Replies in 3 Seconds
            </div>
            <div className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-foreground shadow-sm flex items-center gap-1.5 backdrop-blur-md">
              <span className="text-indigo-500">📅</span> Books Slots Automatically
            </div>
            <div className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-foreground shadow-sm flex items-center gap-1.5 backdrop-blur-md">
              <span className="text-purple-500">🗣️</span> Speaks English & Hindi
            </div>
            <div className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-foreground shadow-sm flex items-center gap-1.5 backdrop-blur-md">
              <span className="text-amber-500">🚀</span> Setup in 24 Hours
            </div>
          </motion.div>

          {/* Shimmer Action Buttons (100% Touch Responsive) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md sm:max-w-none mx-auto px-2"
          >
            <div className="relative w-full sm:w-auto rounded-full overflow-hidden p-[1px]">
              <BorderBeam size={140} duration={7} colorFrom="#6366f1" colorTo="#10b981" />
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-8 py-4 min-h-[48px] text-xs sm:text-sm font-mono font-bold text-white transition-all shadow-xl hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
              >
                <span>BOOK FREE DEMO</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <a
              href="#command-center"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/80 px-7 py-4 min-h-[48px] text-xs sm:text-sm font-mono font-bold text-foreground transition-all hover:bg-accent hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Bot className="h-4 w-4 text-indigo-500" />
              <span>TEST LIVE DEMO CHAT</span>
            </a>
          </motion.div>

          {/* All-Device Responsive Micro Specs Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 sm:mt-12 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 text-left font-mono"
          >
            <div className="rounded-2xl border border-border/80 bg-card/50 p-3.5 sm:p-4 backdrop-blur-md hover:border-indigo-500/40 transition-colors">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">Response Speed</p>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5 sm:mt-1">&lt; 3 Seconds</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/50 p-3.5 sm:p-4 backdrop-blur-md hover:border-emerald-500/40 transition-colors">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">Accuracy Rate</p>
              <p className="text-base sm:text-lg font-black text-emerald-500 mt-0.5 sm:mt-1">99.4% Verified</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/50 p-3.5 sm:p-4 backdrop-blur-md hover:border-purple-500/40 transition-colors">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">Meta API Status</p>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5 sm:mt-1">Official Cloud API</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/50 p-3.5 sm:p-4 backdrop-blur-md hover:border-indigo-500/40 transition-colors">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">Total Chats</p>
              <p className="text-base sm:text-lg font-black text-indigo-400 mt-0.5 sm:mt-1">10,000,000+</p>
            </div>
          </motion.div>
        </div>

        {/* Embedded Video Showcase Container with 21st.dev Border Beam */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="relative mx-auto mt-10 sm:mt-14 max-w-4xl"
        >
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border shadow-2xl bg-zinc-950">
            <BorderBeam size={300} duration={14} colorFrom="#6366f1" colorTo="#a855f7" borderWidth={2} />
            <iframe
              className="w-full h-full"
              src={heroVideoUrl}
              title="Helpa Platform Overview"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </motion.div>
      </section>

      {/* ═══════ COMMAND CENTER (INTERACTIVE PRODUCTION DASHBOARD) ═══════ */}
      <section id="command-center" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-500 block mb-2">
            [ LIVE CONSOLE SIMULATOR ]
          </span>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            Test Helpa AI Right Now
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Select a business model below to test how Helpa executes automated replies, slot bookings, and lead parsing live.
          </p>
        </motion.div>

        {/* Mobile Swipeable Industry Selector Tabs */}
        <div className="mt-8 flex justify-start sm:justify-center overflow-x-auto no-scrollbar gap-2 px-1 pb-2">
          <button
            onClick={() => handleScenarioChange("clinic")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
              activeScenario === "clinic"
                ? "bg-foreground text-background shadow-md scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5" /> DENTAL CLINIC
          </button>
          <button
            onClick={() => handleScenarioChange("coaching")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
              activeScenario === "coaching"
                ? "bg-foreground text-background shadow-md scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" /> ACADEMY
          </button>
          <button
            onClick={() => handleScenarioChange("salon")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
              activeScenario === "salon"
                ? "bg-foreground text-background shadow-md scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scissors className="h-3.5 w-3.5" /> LUXURY SPA
          </button>
          <button
            onClick={() => handleScenarioChange("realestate")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
              activeScenario === "realestate"
                ? "bg-foreground text-background shadow-md scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> REAL ESTATE
          </button>
        </div>

        {/* Command Center Mockup */}
        <div className="mt-8 mx-auto max-w-xl">
          <div className="relative rounded-3xl border border-zinc-800 bg-zinc-950 p-3.5 sm:p-4 shadow-2xl font-sans overflow-hidden">
            <BorderBeam size={220} duration={12} colorFrom="#6366f1" colorTo="#10b981" />
            {/* Header bar */}
            <div className="bg-zinc-900/90 rounded-2xl px-3.5 py-3 flex items-center justify-between border border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-xl ${currentChat.avatarBg} flex items-center justify-center font-bold text-white text-xs shrink-0`}>
                  H
                </div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-100 flex items-center gap-2">
                    {currentChat.title}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-mono">{currentChat.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Confidence: {currentChat.confidence}
                </span>
              </div>
            </div>

            {/* Conversation Window */}
            <div className="p-3.5 sm:p-4 space-y-3 min-h-[360px] sm:min-h-[380px] bg-zinc-950/60 rounded-2xl mt-2 border border-zinc-900 overflow-y-auto">
              {currentChat.messages.slice(0, simStep).map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <span className="mt-1 block text-[9px] text-right opacity-60 font-mono">{msg.time}</span>
                  </div>

                  {msg.quickReplies && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.quickReplies.map((qr, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => setSimStep((prev) => Math.min(prev + 1, currentChat.messages.length))}
                          className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 text-[10px] font-mono font-bold text-indigo-400 hover:bg-indigo-500/20 transition cursor-pointer"
                        >
                          ⚡ {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1 bg-zinc-900 px-3 py-2 rounded-xl w-14 text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ BENTO GRID ARCHITECTURE ═══════ */}
      <section id="bento-architecture" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-500 block mb-2">
            [ HOW HELPA WORKS ]
          </span>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            How Your 24/7 AI Receptionist Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Built from the ground up for high-concurrency WhatsApp traffic, strict knowledge accuracy, and seamless CRM integrations.
          </p>
        </motion.div>

        {/* 4-Card Bento Grid */}
        <div className="mt-10 sm:mt-14 grid gap-5 md:grid-cols-3">
          
          {/* Card 1: Span 2 (Large) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-colors relative overflow-hidden"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-mono font-bold mb-4">
                <Cpu className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-500">01 / REASONING ENGINE</span>
              <h3 className="text-2xl font-black text-foreground mt-1">Instant Accurate Answers</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Helpa learns your business fees, schedules, and FAQs from your documents. Questions are answered accurately in under 3 seconds without making up details.
              </p>
            </div>
            <div className="mt-6 font-mono text-[11px] bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-zinc-400">
              <span className="text-emerald-400 font-bold">query_matched</span> -&gt; Vector Confidence: 99.4% -&gt; Instant Reply Sent
            </div>
          </motion.div>

          {/* Card 2: Span 1 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-colors"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-mono font-bold mb-4">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-500">02 / CALENDAR SYNC</span>
              <h3 className="text-xl font-black text-foreground mt-1">Automatic Slot Lock</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Clients select open appointment slots inside WhatsApp threads. Automatically locks Google Calendar & Outlook slots.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Span 1 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-colors"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-mono font-bold mb-4">
                <UserPlus className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-500">03 / CRM SAVER</span>
              <h3 className="text-xl font-black text-foreground mt-1">Automatic Lead Capture</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Extracts phone numbers, customer names, intent, and service requirements directly into your CRM database tables.
              </p>
            </div>
          </motion.div>

          {/* Card 4: Span 2 (Large) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-colors"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-mono font-bold mb-4">
                <UserCheck className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">04 / HUMAN HANDOFF</span>
              <h3 className="text-2xl font-black text-foreground mt-1">1-Click Human Staff Escrow</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                If a customer asks a complex question or requests human assistance, Helpa quietly alerts your staff and hands off the thread with complete history.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-emerald-500">
              <CheckCircle2 className="h-4 w-4" /> 100% Transcript History Saved
            </div>
          </motion.div>

        </div>
      </section>

      {/* ═══════ INTERACTIVE ROI METRIC ENGINE ═══════ */}
      <section id="roi-engine" className="border-y border-border bg-muted/30 py-16 sm:py-24 scroll-mt-16 relative font-mono">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="text-xs uppercase tracking-widest text-indigo-500 block mb-2">
              [ HIGH-PRECISION REVENUE CALCULATOR ]
            </span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">
              Quantify Your Lost Revenue
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground font-sans">
              Adjust parameters below to compute real-time revenue lost from delayed WhatsApp response times.
            </p>
          </motion.div>

          <div className="mt-10 sm:mt-12 max-w-4xl mx-auto grid gap-6 md:grid-cols-2 bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-8 shadow-2xl">
            {/* Sliders Input Panel */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-2 font-sans">
                <Calculator className="h-4 w-4 text-indigo-400" />
                INPUT PARAMETERS
              </h3>

              {/* Slider 1: Daily Enquiries */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-zinc-400">DAILY CHAT VOLUME:</span>
                  <span className="text-indigo-400">{dailyEnquiries} / day</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  value={dailyEnquiries}
                  onChange={(e) => setDailyEnquiries(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Slider 2: Average Booking Value */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-zinc-400">AVG CONTRACT VALUE:</span>
                  <span className="text-indigo-400">₹{avgTicketValue.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="15000"
                  step="250"
                  value={avgTicketValue}
                  onChange={(e) => setAvgTicketValue(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Slider 3: Estimated Missed After Hours % */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-zinc-400">MISSED / DELAYED %:</span>
                  <span className="text-indigo-400">{missedPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={missedPercent}
                  onChange={(e) => setMissedPercent(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Live Calculated Results Panel */}
            <div className="flex flex-col justify-between rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6 relative overflow-hidden">
              <BorderBeam size={160} duration={10} colorFrom="#10b981" colorTo="#6366f1" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">REAL-TIME IMPACT ANALYSIS</span>
                
                <div className="mt-3">
                  <p className="text-[11px] text-red-400 font-bold uppercase">MONTHLY LOST REVENUE</p>
                  <p className="text-3xl font-black text-red-400 mt-1">₹{potentialLostRevenue.toLocaleString()}</p>
                </div>

                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <p className="text-[11px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> RECOVERED REVENUE WITH HELPA
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                    +₹{recoveredRevenue.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">/ mo</span>
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href={user ? "/dashboard" : "/signup"}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-xs font-mono font-bold text-background shadow-md hover:opacity-90 transition"
                >
                  CLAIM RECOVERED REVENUE <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING TIERS ═══════ */}
      <section id="pricing" className="border-t border-border bg-muted/20 py-16 sm:py-24 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
              Simple Transparent Tiers
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">Every plan includes Meta API setup, custom document indexing, and 24/7 dedicated support.</p>
          </motion.div>
          
          <div className="mt-10 sm:mt-14 grid gap-6 md:grid-cols-3 text-left">
            
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:border-indigo-500/40 transition-colors"
            >
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground block mb-2">TIER 01 / STARTER</span>
              <h3 className="text-2xl font-black text-foreground">Starter</h3>
              <p className="mt-1 text-xs text-muted-foreground">Setup Fee: ₹9,999 (One-Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹2,999</span>
                <span className="text-xs font-mono font-bold text-muted-foreground">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6 font-mono text-xs">
                {[
                  "1 Meta WhatsApp Business Number",
                  "24/7 AI Receptionist Engine",
                  "Google / Outlook Slot Locking",
                  "Custom FAQ Document Training",
                  "CRM Lead Parsing & Storage",
                  "1-Click Human Takeover Escrow",
                  "Analytics & Latency Console"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-muted-foreground font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-xs font-mono font-bold text-foreground hover:bg-accent transition"
              >
                BOOK FREE DEMO
              </Link>
            </motion.div>
            
            {/* Growth Plan (Popular) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative flex flex-col rounded-3xl border-2 border-foreground bg-card p-6 sm:p-8 shadow-2xl overflow-hidden"
            >
              <BorderBeam size={200} duration={8} colorFrom="#6366f1" colorTo="#10b981" />
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-1 text-[9px] font-mono font-black text-background uppercase tracking-widest shadow-md">
                ★ MOST POPULAR
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400 block mb-2">TIER 02 / GROWTH</span>
              <h3 className="text-2xl font-black text-foreground">Growth</h3>
              <p className="mt-1 text-xs text-muted-foreground">Setup Fee: ₹19,999 (One-Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹5,999</span>
                <span className="text-xs font-mono font-bold text-muted-foreground">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6 font-mono text-xs">
                <li className="text-[10px] font-bold text-foreground uppercase tracking-widest mb-1">EVERYTHING IN STARTER PLUS:</li>
                {[
                  "Up to 3 WhatsApp Business Numbers",
                  "Shared Multi-User Staff Inbox",
                  "Custom CRM Database Sync",
                  "WhatsApp Broadcast Campaign Engine",
                  "Automated Follow-up Sequences",
                  "Priority 24/7 Developer Support"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-foreground font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="mt-8 rounded-full bg-foreground px-6 py-3.5 text-center text-xs font-mono font-bold text-background transition hover:opacity-90 shadow-md"
              >
                BOOK FREE CONSULTATION
              </Link>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:border-indigo-500/40 transition-colors"
            >
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground block mb-2">TIER 03 / ENTERPRISE</span>
              <h3 className="text-2xl font-black text-foreground">Enterprise</h3>
              <p className="mt-1 text-xs text-muted-foreground">Custom Multi-Branch Deployment</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">Custom</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6 font-mono text-xs">
                {[
                  "Unlimited WhatsApp Business Numbers",
                  "Fine-Tuned Model Weights",
                  "Full REST API & Webhook Stream",
                  "Dedicated Account Manager",
                  "Guaranteed 99.99% SLA Agreement",
                  "White-Label Options Available"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-muted-foreground font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="mailto:sales@helpa.studio"
                className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-xs font-mono font-bold text-foreground hover:bg-accent transition"
              >
                CONTACT SALES TEAM
              </a>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ═══════ FAQ SECTION ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">Everything you need to know about setting up Helpa for your business.</p>
        </motion.div>

        <div className="mt-10 sm:mt-12 space-y-3">
          {[
            {
              id: 1,
              q: "How does Helpa connect to our existing WhatsApp number?",
              a: "Helpa connects directly via Meta's official WhatsApp Business Cloud API. You keep your current number — no SIM card change or data migration needed. Setup takes less than 15 minutes."
            },
            {
              id: 2,
              q: "How accurate are the AI's answers?",
              a: "Helpa strictly bases its answers on the knowledge documents, pricing lists, and FAQs you upload. It never invents information. If a customer asks a question outside its training, it hands off the conversation to your staff."
            },
            {
              id: 3,
              q: "Can our staff step in and text customers manually?",
              a: "Yes! A 1-click Human Takeover is built into Helpa. Your staff can pause the AI and reply manually from the CRM dashboard anytime."
            },
            {
              id: 4,
              q: "Does Helpa support regional languages like Hindi or Bengali?",
              a: "Yes, Helpa is natively multilingual. It automatically detects and responds in the customer's preferred language, including English, Hindi, Hinglish, Bengali, Marathi, and Tamil."
            },
            {
              id: 5,
              q: "How long does setup take?",
              a: "Most businesses complete setup and go live in less than 24 hours. Our onboarding team assists you step-by-step."
            }
          ].map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card overflow-hidden transition-all">
              <button
                onClick={() => setActiveFaq(activeFaq === item.id ? null : item.id)}
                className="flex w-full items-center justify-between p-4 sm:p-5 text-left font-bold text-foreground text-xs sm:text-base cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${activeFaq === item.id ? "rotate-180 text-indigo-500" : ""}`} />
              </button>
              
              <AnimatePresence>
                {activeFaq === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-border/50 px-4 sm:px-5 py-4 text-xs sm:text-sm text-muted-foreground leading-relaxed bg-muted/20"
                  >
                    {item.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ FINAL CALL TO ACTION ═══════ */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 z-10 relative">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-border bg-zinc-950 p-6 sm:p-16 text-center text-white shadow-2xl">
          <BorderBeam size={250} duration={12} colorFrom="#6366f1" colorTo="#10b981" />
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white relative z-10">
            Ready to Automate Your WhatsApp Operations?
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-lg text-zinc-400 text-xs sm:text-base leading-relaxed relative z-10">
            See Helpa configured live with your business FAQs in a 15-minute demo session.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3.5 relative z-10 font-mono">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-xs sm:text-sm font-bold text-zinc-950 hover:bg-zinc-100 transition-all shadow-xl hover:scale-105"
            >
              <span>BOOK 15-MIN DEMO</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border bg-card px-4 sm:px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-foreground text-background font-black text-xs">
              H
            </div>
            <span className="font-extrabold text-foreground text-base">Helpa AI</span>
            <span className="text-[10px] font-mono text-emerald-500 font-bold flex items-center gap-1">
              ● All Systems Operational
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-5 sm:gap-6 text-xs font-mono text-muted-foreground uppercase tracking-widest font-bold">
            <a href="#command-center" className="hover:text-foreground transition-colors">Console</a>
            <a href="#bento-architecture" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#roi-engine" className="hover:text-foreground transition-colors">ROI Metric</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>

          <p className="text-xs font-mono text-muted-foreground">
            © {new Date().getFullYear()} Helpa AI Studio.
          </p>
        </div>
      </footer>

      {/* Floating Quick Action Console Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        className="fixed bottom-5 right-5 z-40"
      >
        <Link
          href={user ? "/dashboard" : "/signup"}
          className="flex items-center gap-2 rounded-full bg-foreground px-4 sm:px-5 py-3 text-xs font-mono font-bold text-background shadow-2xl hover:scale-105 active:scale-95 transition-all border border-border"
        >
          <Bot className="h-4 w-4 text-emerald-400" />
          <span>BOOK DEMO</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>

    </div>
  );
}
