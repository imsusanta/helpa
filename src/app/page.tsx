"use client";

import { useEffect, useState } from "react";
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
  Plane,
  Dumbbell,
  Smile,
  Shield,
  Check,
  Sparkles,
  Calculator,
  TrendingUp,
  Clock,
  Bot,
  MessageCircle,
  ChevronRight,
  PhoneCall,
  RotateCcw,
  Play,
  Volume2
} from "lucide-react";

// Chat Simulator Scenarios
const CHAT_SCENARIOS = {
  clinic: {
    title: "Dr. Sharma Dental Clinic",
    status: "Online • Helpa AI Active",
    avatarBg: "bg-emerald-600",
    messages: [
      { text: "Hi, do you have any open slots for a teeth cleaning tomorrow afternoon?", sender: "user", time: "06:14 PM" },
      { text: "Hello! Yes, we have 2 open slots available tomorrow:\n1️⃣ 02:30 PM with Dr. Sharma\n2️⃣ 05:00 PM with Dr. Verma\n\nWhich slot works best for you?", sender: "bot", time: "06:14 PM", quickReplies: ["Book 02:30 PM", "Book 05:00 PM"] },
      { text: "02:30 PM works great!", sender: "user", time: "06:15 PM" },
      { text: "Awesome! 🎉 Your teeth cleaning appointment is confirmed for Tomorrow at 02:30 PM.\n\n📅 Date: Tomorrow\n⏰ Time: 02:30 PM\n📍 Location: 4th Block, Indiranagar\n\nI have added this to our clinic calendar and sent a confirmation SMS to your number!", sender: "bot", time: "06:15 PM" }
    ]
  },
  coaching: {
    title: "Apex JEE Academy",
    status: "Online • Helpa AI Active",
    avatarBg: "bg-indigo-600",
    messages: [
      { text: "Hello, what are the fees and batch timings for 11th Science coaching?", sender: "user", time: "09:30 PM" },
      { text: "Welcome to Apex Academy! 📚 Our 11th Science (JEE/NEET) batches start on Monday:\n\n• Morning Batch: 08:00 AM - 11:30 AM\n• Evening Batch: 04:30 PM - 08:00 PM\n• Course Fee: ₹45,000 / year (Installments available)\n\nWould you like to book a free 2-day trial class?", sender: "bot", time: "09:30 PM", quickReplies: ["Book Trial Class", "Download Syllabus PDF"] },
      { text: "Book Trial Class for Evening Batch please", sender: "user", time: "09:31 PM" },
      { text: "Done! 🎓 Your seat for the 2-Day Free Trial (Evening Batch) has been registered. See you this Monday at 04:30 PM!", sender: "bot", time: "09:31 PM" }
    ]
  },
  salon: {
    title: "Glow & Shine Luxury Spa",
    status: "Online • Helpa AI Active",
    avatarBg: "bg-pink-600",
    messages: [
      { text: "Hi! Can I get price details for Hair Smoothening and Keratin?", sender: "user", time: "08:05 PM" },
      { text: "Hello Gorgeous! ✨ Here are our current festival special prices:\n\n💇‍♀️ Hair Smoothening: ₹2,999 (Reg. ₹4,500)\n✨ Keratin Treatment: ₹3,499 (Reg. ₹5,200)\n\nBoth packages include complimentary Hair Spa!", sender: "bot", time: "08:05 PM", quickReplies: ["Book Smoothening", "Book Keratin"] },
      { text: "I'd like to book Keratin for Sunday at 11 AM", sender: "user", time: "08:06 PM" },
      { text: "Reserved! 💇‍♀️ Sunday at 11:00 AM is booked under your number. We look forward to pampering you!", sender: "bot", time: "08:06 PM" }
    ]
  },
  realestate: {
    title: "Skyline Properties",
    status: "Online • Helpa AI Active",
    avatarBg: "bg-sky-600",
    messages: [
      { text: "Are 3BHK flats still available in Crestview Towers?", sender: "user", time: "11:20 PM" },
      { text: "Hello! Yes, we have 3 premium 3BHK units remaining on upper floors (12th & 15th floor).\n\n📐 Size: 1,850 sq.ft\n💰 Price: Starting ₹1.25 Cr\n📍 Location: HSR Layout, Sector 2\n\nWould you like a virtual video tour or to schedule a site visit?", sender: "bot", time: "11:20 PM", quickReplies: ["Schedule Site Visit", "Get Brochure PDF"] },
      { text: "Schedule Site Visit for Saturday 11 AM", sender: "user", time: "11:21 PM" },
      { text: "Confirmed! 🏢 Our relationship manager Amit will meet you at the site location Saturday at 11:00 AM. Location pin sent below!", sender: "bot", time: "11:21 PM" }
    ]
  }
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState("conversations");
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroVideoUrl, setHeroVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");
  const [actionVideoUrl, setActionVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");

  // Simulator State
  const [activeScenario, setActiveScenario] = useState<keyof typeof CHAT_SCENARIOS>("clinic");
  const [simStep, setSimStep] = useState(4);
  const [isTyping, setIsTyping] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  // ROI Calculator State
  const [dailyEnquiries, setDailyEnquiries] = useState(35);
  const [avgTicketValue, setAvgTicketValue] = useState(2000);
  const [missedPercent, setMissedPercent] = useState(30);

  const { mode, toggleMode } = useTheme();

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
          .in("key", ["landing_hero_video_url", "landing_action_video_url"]);
        if (settingsData && !error) {
          settingsData.forEach((row: any) => {
            if (row.key === "landing_hero_video_url" && typeof row.value === "string") {
              setHeroVideoUrl(row.value);
            } else if (row.key === "landing_action_video_url" && typeof row.value === "string") {
              setActionVideoUrl(row.value);
            }
          });
        }
      } catch (err) {
        console.error("Error loading video settings:", err);
      }
    }
    checkAuthAndSettings();
  }, []);

  // AutoPlay simulation timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (autoPlay && simStep < CHAT_SCENARIOS[activeScenario].messages.length) {
      setIsTyping(true);
      timer = setTimeout(() => {
        setIsTyping(false);
        setSimStep((prev) => prev + 1);
      }, 1400);
    } else if (simStep >= CHAT_SCENARIOS[activeScenario].messages.length) {
      setAutoPlay(false);
    }
    return () => clearTimeout(timer);
  }, [autoPlay, simStep, activeScenario]);

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

  const restartSimulation = () => {
    setSimStep(1);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setSimStep(2);
    }, 800);
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
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-600 to-purple-600 z-50 transition-all duration-150 origin-left"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Dynamic Ambient Background Animated Light Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[140px] animate-pulse-glow" />
        <div className="absolute top-[35%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 dark:bg-indigo-600/5 blur-[160px] animate-pulse-glow" style={{ animationDelay: "3s" }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[55%] h-[55%] rounded-full bg-purple-600/10 dark:bg-purple-600/5 blur-[150px] animate-pulse-glow" style={{ animationDelay: "6s" }} />
      </div>

      {/* ═══════ HEADER / NAVIGATION ═══════ */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "glass-header border-b border-border shadow-md" : "bg-transparent border-b border-border/40"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          <Link href="#" className="flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <MessageSquare className="h-5 w-5 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-foreground flex items-center gap-1">
                Helpa <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">AI</span>
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex font-semibold">
            <a href="#demo-simulator" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Live Demo</a>
            <a href="#why-helpa" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Why Helpa</a>
            <a href="#roi" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">ROI Calculator</a>
            <a href="#features" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Features</a>
            <a href="#industries" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Industries</a>
            <a href="#pricing" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">FAQ</a>
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleMode}
              className="p-2.5 rounded-full border border-border bg-card/80 hover:bg-accent text-foreground transition-all duration-200 cursor-pointer shadow-sm hover:scale-105"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>

            <Link href={user ? "/dashboard" : "/signup"} className="hidden rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-600/25 hover:scale-[1.03] active:scale-[0.97] sm:inline-flex items-center gap-2">
              <span>{user ? "Dashboard" : "Book Free Demo"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-xl border border-border p-2 md:hidden text-foreground bg-card hover:bg-accent transition-colors cursor-pointer" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Drawer Sheet */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border md:hidden glass-header overflow-hidden shadow-2xl"
            >
              <div className="flex flex-col gap-1 px-5 py-5">
                <a href="#demo-simulator" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors flex items-center justify-between">
                  <span>Live Demo Simulator</span>
                  <Bot className="h-4 w-4 text-indigo-600" />
                </a>
                <a href="#why-helpa" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors">Why Helpa</a>
                <a href="#roi" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors flex items-center justify-between">
                  <span>ROI Calculator</span>
                  <Calculator className="h-4 w-4 text-emerald-500" />
                </a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors">Features</a>
                <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors">Industries</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors">Pricing</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-foreground font-bold hover:bg-accent/80 transition-colors">FAQ</a>
                
                <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3.5 text-center text-sm font-extrabold text-white shadow-lg flex items-center justify-center gap-2">
                  <span>{user ? "Go to Dashboard" : "Book Free Demo"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════ HERO SECTION ═══════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 pb-20 pt-12 sm:pt-24 z-10">
        
        {/* Floating Decorative Cards (Desktop & Tablet) */}
        <div className="hidden lg:block pointer-events-none">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="absolute top-24 left-[5%] animate-float-slow"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-card/80 p-3.5 shadow-xl backdrop-blur-md">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">⚡</div>
              <div>
                <p className="text-xs font-black text-foreground">&lt; 3 Sec Reply</p>
                <p className="text-[10px] text-muted-foreground">Instant WhatsApp response</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute top-28 right-[5%] animate-float-reverse"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-purple-500/30 bg-card/80 p-3.5 shadow-xl backdrop-blur-md">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">📅</div>
              <div>
                <p className="text-xs font-black text-foreground">Auto Slot Booking</p>
                <p className="text-[10px] text-muted-foreground">Synced to Calendar</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mx-auto max-w-5xl text-center">
          
          {/* Animated Badge Pill */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-300 shadow-sm backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>⚡ Setup in 24 Hours • 99.4% AI Accuracy</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-400 ml-1" />
          </motion.div>

          {/* Dynamic Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl leading-[1.1] text-foreground"
          >
            Never Miss Another <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 bg-clip-text text-transparent animate-gradient-text">
              Customer Enquiry.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-5 sm:mt-6 max-w-2xl text-base sm:text-xl text-muted-foreground leading-relaxed font-normal px-2"
          >
            Helpa answers every WhatsApp chat in <strong>under 3 seconds</strong>, schedules appointments into your calendar, captures qualified leads 24/7, and drives sales automatically.
          </motion.p>

          {/* Mobile Quick Pill Cards */}
          <div className="mt-6 flex lg:hidden overflow-x-auto no-scrollbar gap-2 px-2 pb-2 justify-center">
            <div className="shrink-0 rounded-full border border-indigo-500/20 bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground shadow-sm flex items-center gap-1.5">
              <span>⚡</span> &lt; 3 Sec Reply
            </div>
            <div className="shrink-0 rounded-full border border-purple-500/20 bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground shadow-sm flex items-center gap-1.5">
              <span>📅</span> Auto Bookings
            </div>
            <div className="shrink-0 rounded-full border border-emerald-500/20 bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground shadow-sm flex items-center gap-1.5">
              <span>🌐</span> Multilingual
            </div>
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row px-2"
          >
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-8 py-4 text-sm sm:text-base font-extrabold text-white transition-all shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.04] active:scale-[0.98] duration-200 cursor-pointer"
            >
              <span>Book 15-Min Free Demo</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#demo-simulator"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border border-border bg-card/80 px-7 py-4 text-sm sm:text-base font-bold text-foreground transition-all shadow-sm hover:bg-accent hover:scale-[1.03] active:scale-[0.98] duration-200 backdrop-blur-md cursor-pointer"
            >
              <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>Try Live Interactive Chat</span>
            </a>
          </motion.div>

          {/* Micro Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-muted-foreground"
          >
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> 0 Coding Required
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Official Meta WhatsApp API
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> English, Hindi & Regional AI
            </span>
          </motion.div>
        </div>

        {/* Embedded Demo Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="relative mx-auto mt-14 max-w-4xl"
        >
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 blur-2xl opacity-75 animate-pulse-glow"></div>
          <div className="aspect-video overflow-hidden rounded-2xl border border-border shadow-2xl bg-zinc-950">
            <iframe
              className="w-full h-full"
              src={heroVideoUrl}
              title="Helpa Product Overview Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </motion.div>
      </section>

      {/* ═══════ INFINITE TRUST MARQUEE ═══════ */}
      <section className="border-y border-border bg-muted/40 py-7 overflow-hidden relative">
        <p className="mb-4 text-center text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.25em] text-muted-foreground">
          Trusted by 500+ Indian Service Businesses
        </p>
        <div className="flex overflow-hidden select-none">
          <div className="animate-marquee flex items-center gap-3.5 whitespace-nowrap">
            {[
              "🏥 Clinics & Diagnostic Labs",
              "📚 JEE & NEET Coaching Institutes",
              "💇‍♀️ Salons & Luxury Spas",
              "🏨 Boutique Hotels & Resorts",
              "🏢 Real Estate Consultants",
              "🏋️‍♂️ Fitness & Gym Centers",
              "🦷 Dental Care Clinics",
              "⚖️ Legal & Accounting Firms",
              "🚗 Auto Repair & Detailing",
              "✈️ Travel & Visa Agencies"
            ].concat([
              "🏥 Clinics & Diagnostic Labs",
              "📚 JEE & NEET Coaching Institutes",
              "💇‍♀️ Salons & Luxury Spas",
              "🏨 Boutique Hotels & Resorts",
              "🏢 Real Estate Consultants",
              "🏋️‍♂️ Fitness & Gym Centers",
              "🦷 Dental Care Clinics",
              "⚖️ Legal & Accounting Firms",
              "🚗 Auto Repair & Detailing",
              "✈️ Travel & Visa Agencies"
            ]).map((item, idx) => (
              <div
                key={idx}
                className="rounded-full border border-border/80 bg-card px-4.5 py-2 text-xs font-bold text-foreground shadow-sm hover:border-indigo-500/50 transition-colors"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ INTERACTIVE WHATSAPP LIVE DEMO SIMULATOR (MOBILE & DESKTOP) ═══════ */}
      <section id="demo-simulator" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-24 scroll-mt-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest inline-block mb-3">
            Interactive Experience
          </span>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            Test Helpa AI Right Now
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Tap any industry below to see how Helpa handles customer inquiries, schedules bookings, and answers questions live on WhatsApp.
          </p>
        </motion.div>

        {/* Mobile Swipeable Industry Selector Tabs */}
        <div className="mt-8 flex justify-start sm:justify-center overflow-x-auto no-scrollbar gap-2 px-1 pb-2">
          <button
            onClick={() => handleScenarioChange("clinic")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              activeScenario === "clinic"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Stethoscope className="h-4 w-4" /> Dental Clinic
          </button>
          <button
            onClick={() => handleScenarioChange("coaching")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              activeScenario === "coaching"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Coaching Institute
          </button>
          <button
            onClick={() => handleScenarioChange("salon")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              activeScenario === "salon"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Scissors className="h-4 w-4" /> Salon & Spa
          </button>
          <button
            onClick={() => handleScenarioChange("realestate")}
            className={`shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              activeScenario === "realestate"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Building2 className="h-4 w-4" /> Real Estate
          </button>
        </div>

        {/* WhatsApp Phone Mockup Container */}
        <div className="mt-8 mx-auto max-w-md">
          <div className="rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-950 p-2.5 sm:p-3 shadow-2xl shadow-indigo-500/10">
            {/* Speaker Notch */}
            <div className="mx-auto mb-2 h-3.5 w-24 rounded-full bg-zinc-800"></div>

            {/* Chat App Shell */}
            <div className="overflow-hidden rounded-[2rem] bg-[#0b141a] text-zinc-100 min-h-[460px] flex flex-col justify-between border border-zinc-800">
              
              {/* WhatsApp Header */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-zinc-700/50">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full ${currentChat.avatarBg} flex items-center justify-center font-bold text-white text-xs shadow-md`}>
                    H
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-100 flex items-center gap-1.5">
                      {currentChat.title}
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    </h4>
                    <p className="text-[10px] text-emerald-400 font-medium">{currentChat.status}</p>
                  </div>
                </div>

                {/* Simulation Control Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={restartSimulation}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition"
                    title="Restart Demo"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                      autoPlay ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300"
                    }`}
                    title="Auto Play"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Chat Conversation Window */}
              <div className="p-3.5 space-y-3 flex-1 overflow-y-auto bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
                {currentChat.messages.slice(0, simStep).map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-[#005c4b] text-zinc-100 rounded-tr-none"
                          : "bg-[#202c33] text-zinc-100 rounded-tl-none border border-zinc-700/40"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                      <span className="mt-1 block text-[9px] text-right text-zinc-400 opacity-80">{msg.time}</span>
                    </div>

                    {/* Quick reply buttons if bot */}
                    {msg.quickReplies && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.quickReplies.map((qr, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => setSimStep((prev) => Math.min(prev + 1, currentChat.messages.length))}
                            className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[10px] font-extrabold text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition cursor-pointer"
                          >
                            ⚡ {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-1 bg-[#202c33] px-3 py-2 rounded-xl w-16 text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="bg-[#202c33] p-2.5 flex items-center gap-2 border-t border-zinc-700/50">
                <div className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-xs text-zinc-400 flex items-center justify-between">
                  <span>Type a message...</span>
                  <Bot className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md">
                  <Send className="h-3.5 w-3.5" />
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ═══════ WHY HELPA ═══════ */}
      <section id="why-helpa" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-24 scroll-mt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            Why Businesses Choose Helpa
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
            Eliminate customer wait times, capture every lead, and cut operational costs without adding headcount.
          </p>
        </motion.div>

        <div className="mt-12 sm:mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Zap,
              title: "Never Miss Leads",
              desc: "Every incoming inquiry receives an immediate, intelligent response in under 3 seconds.",
              color: "text-amber-500 bg-amber-500/10"
            },
            {
              icon: UserCheck,
              title: "24/7 Digital Receptionist",
              desc: "Customers get instant replies even outside business hours, on weekends, and holidays.",
              color: "text-indigo-600 bg-indigo-600/10 dark:text-indigo-400"
            },
            {
              icon: CalendarCheck,
              title: "Automated Bookings",
              desc: "Allows clients to view slots, confirm appointments, or reschedule without staff intervention.",
              color: "text-emerald-500 bg-emerald-500/10"
            },
            {
              icon: UserPlus,
              title: "Automatic Lead Sync",
              desc: "Name, phone, service interest, and chat transcript are formatted and saved directly into your CRM.",
              color: "text-purple-600 bg-purple-600/10 dark:text-purple-400"
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ duration: 0.3, delay: idx * 0.08 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-indigo-500/50 hover:shadow-xl transition-all duration-300"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.color} group-hover:scale-110 transition-transform`}>
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-foreground text-base sm:text-lg">{item.title}</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════ INTERACTIVE ROI CALCULATOR SECTION ═══════ */}
      <section id="roi" className="border-y border-border bg-muted/30 py-20 sm:py-24 scroll-mt-16 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest inline-block mb-3">
              Calculate Your Growth
            </span>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
              How Much Revenue Are You Missing?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              Drag the sliders below to calculate your estimated lost revenue from delayed WhatsApp responses.
            </p>
          </motion.div>

          <div className="mt-10 sm:mt-14 max-w-4xl mx-auto grid gap-6 md:grid-cols-2 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xl">
            {/* Sliders Input Panel */}
            <div className="space-y-6">
              <h3 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
                <Calculator className="h-5 w-5 text-indigo-600" />
                Your Business Parameters
              </h3>

              {/* Slider 1: Daily Enquiries */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold mb-2">
                  <span className="text-muted-foreground">Daily WhatsApp Enquiries:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{dailyEnquiries} / day</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  value={dailyEnquiries}
                  onChange={(e) => setDailyEnquiries(Number(e.target.value))}
                  className="w-full h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Slider 2: Average Booking Value */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold mb-2">
                  <span className="text-muted-foreground">Avg Booking / Deal Value:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">₹{avgTicketValue.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="10000"
                  step="100"
                  value={avgTicketValue}
                  onChange={(e) => setAvgTicketValue(Number(e.target.value))}
                  className="w-full h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Slider 3: Estimated Missed After Hours % */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold mb-2">
                  <span className="text-muted-foreground">Estimated Missed / Delayed Leads:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{missedPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={missedPercent}
                  onChange={(e) => setMissedPercent(Number(e.target.value))}
                  className="w-full h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Live Calculated Results Card */}
            <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-indigo-600/10 via-purple-600/10 to-emerald-600/10 border border-indigo-500/20 p-5 sm:p-6">
              <div>
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-1">Estimated Monthly Impact</span>
                
                <div className="mt-3">
                  <p className="text-xs text-red-500 dark:text-red-400 font-bold uppercase tracking-wider">Estimated Monthly Lost Revenue</p>
                  <p className="text-2xl sm:text-3xl font-black text-red-500 dark:text-red-400 mt-1">₹{potentialLostRevenue.toLocaleString()}</p>
                </div>

                <div className="mt-5 border-t border-border/50 pt-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" /> Recovered Revenue With Helpa
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    +₹{recoveredRevenue.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">/ month</span>
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href={user ? "/dashboard" : "/signup"}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-indigo-700 transition"
                >
                  Claim Recovered Revenue Now <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PRODUCT VIDEO SECTION ═══════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center mb-10 sm:mb-12"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Watch Helpa In Action</h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">See how effortlessly Helpa manages high chat volumes, schedules appointments, and sends notifications.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="aspect-video max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border bg-zinc-950"
        >
          <iframe
            className="w-full h-full"
            src={actionVideoUrl}
            title="Helpa Detailed Walkthrough Video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </motion.div>
      </section>

      {/* ═══════ FEATURES GRID ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-24 scroll-mt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            Everything your WhatsApp Reception Needs
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground">Built specifically for businesses that depend on WhatsApp for customer leads.</p>
        </motion.div>

        <div className="mt-12 sm:mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Zap, title: "Sub-3-Second AI Replies", desc: "Instantly answers questions about pricing, availability, and business locations accurately." },
            { icon: CalendarCheck, title: "Automated Slot Booking", desc: "Customers pick available slots directly inside WhatsApp, synced to your Google or CRM calendar." },
            { icon: UserPlus, title: "Structured Lead Capture", desc: "Automatically extracts and stores contact details, service needs, and notes into your CRM." },
            { icon: HelpCircle, title: "Custom FAQ Training", desc: "Upload your existing PDF brochure or FAQ sheet — Helpa learns your entire business in 5 minutes." },
            { icon: UserCheck, title: "1-Click Human Takeover", desc: "Staff can pause the AI and take over any complex conversation immediately from the dashboard." },
            { icon: Globe2, title: "Multilingual Intelligence", desc: "Auto-detects and responds in English, Hindi, Bengali, Hinglish, Spanish, and 20+ languages." },
            { icon: BarChart3, title: "Real-time Analytics", desc: "Track conversation resolution speed, booking conversion rates, and total captured leads." },
            { icon: Radio, title: "WhatsApp Broadcast Campaigns", desc: "Send targeted promotional announcements or festival offers to thousands of contacts safely." },
            { icon: RefreshCw, title: "Automated Reminders", desc: "Reduces appointment no-shows by automatically sending reminder notifications prior to bookings." }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-foreground text-base">{item.title}</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="border-y border-border bg-muted/30 py-20 sm:py-24 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Go Live in 4 Simple Steps</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">No coding or IT setup required. Up and running in 24 hours.</p>
          </motion.div>

          <div className="relative mt-12 sm:mt-16 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              { num: "1", title: "Connect WhatsApp", desc: "Link your business phone number securely via official Meta API." },
              { num: "2", title: "Upload Knowledge", desc: "Paste your website link, price list, or FAQ document." },
              { num: "3", title: "AI Takes Over", desc: "Helpa starts answering inquiries & booking clients automatically 24/7." },
              { num: "4", title: "Track & Scale", desc: "Monitor leads and manage your team from the central CRM dashboard." }
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-sm text-center md:text-left hover:border-indigo-500/50 transition-colors"
              >
                <div className="mx-auto md:mx-0 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-lg font-black text-white shadow-md">
                  {step.num}
                </div>
                <h3 className="text-base font-extrabold text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE (SWIPEABLE TABS ON MOBILE) ═══════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
            One Dashboard. Total Control.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">Manage conversations, update AI knowledge, and track growth metrics in one place.</p>
        </div>

        {/* Mobile Swipeable Dashboard Tab Buttons */}
        <div className="mt-8 flex justify-start sm:justify-center overflow-x-auto no-scrollbar gap-2 px-1 pb-2">
          {[
            { id: "conversations", label: "Conversations", icon: Inbox },
            { id: "knowledge", label: "AI Knowledge Base", icon: BookOpen },
            { id: "contacts", label: "Contacts & Leads", icon: Users2 },
            { id: "bookings", label: "Bookings", icon: CalendarCheck },
            { id: "analytics", label: "Analytics", icon: LineChart },
            { id: "broadcast", label: "Broadcasts", icon: Send },
            { id: "settings", label: "Settings", icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 rounded-full px-4.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Preview Container */}
        <div className="mx-auto mt-6 sm:mt-8 max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl p-5 sm:p-6 transition-all duration-300">
          {activeTab === "conversations" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Total Chats Managed</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">14,290</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">+38% vs last month</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Appointments Scheduled</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">3,840</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">+24% vs last month</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">AI Resolution Rate</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">96.8%</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Optimal Performance</p>
              </div>
            </motion.div>
          )}

          {activeTab === "knowledge" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Documents & FAQs Learned</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">348</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Auto-synced</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Answer Accuracy Rate</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">99.4%</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Verified</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Unanswered Escalations</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">3</p>
                <p className="mt-1 text-xs text-muted-foreground font-semibold">Handed off to staff</p>
              </div>
            </motion.div>
          )}

          {activeTab === "contacts" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Total Contacts Stored</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">9,410</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">+180 this week</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Hot Leads Captured</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">742</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Ready for sales</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Repeat Customer Ratio</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">42%</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">High Loyalty</p>
              </div>
            </motion.div>
          )}

          {activeTab === "bookings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Bookings Today</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">42</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">All confirmed</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">No-Show Rate</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-500">&lt; 2%</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Auto reminders active</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Calendar Sync</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">Google / Outlook</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Real-time sync</p>
              </div>
            </motion.div>
          )}

          {activeTab === "analytics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Average Response Time</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">1.8s</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Instant</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Customer CSAT Score</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">4.9 / 5.0</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">98% Satisfied</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Monthly Saved Hours</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">120 hrs</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Staff efficiency boost</p>
              </div>
            </motion.div>
          )}

          {activeTab === "broadcast" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Broadcast Delivery Rate</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">99.2%</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Meta Approved</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Open Rate</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">93%</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">5x higher than email</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Direct Broadcast Bookings</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">1,240</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">High ROI</p>
              </div>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Active WhatsApp Numbers</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">3 Numbers</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">All Connected</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Team Members</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">12 Staff</p>
                <p className="mt-1 text-xs text-muted-foreground font-semibold">Roles configured</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-xs text-muted-foreground font-semibold">Security & SSL</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground">256-bit AES</p>
                <p className="mt-1 text-xs text-emerald-600 font-bold">Encrypted</p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ═══════ PRICING SECTION ═══════ */}
      <section id="pricing" className="border-t border-border bg-muted/30 py-20 sm:py-24 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
              Simple Pricing That Pays For Itself
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">Every plan includes complete onboarding, AI setup, WhatsApp connection and dedicated support.</p>
          </motion.div>
          
          <div className="mt-12 sm:mt-14 grid gap-6 md:grid-cols-3 text-left">
            
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">Starter Tier</span>
              <h3 className="text-2xl font-black text-foreground">Starter</h3>
              <p className="mt-1 text-xs text-muted-foreground">Setup Fee: ₹9,999 (One-Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹2,999</span>
                <span className="text-xs font-bold text-muted-foreground">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                {[
                  "1 WhatsApp Business Number",
                  "24/7 AI Receptionist",
                  "Appointment Scheduling",
                  "FAQ Automation",
                  "Lead Capture & Sync",
                  "Human Takeover Mode",
                  "Analytics Dashboard",
                  "Multilingual Support",
                  "Free Onboarding Session"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-xs text-muted-foreground font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-xs sm:text-sm font-extrabold text-foreground hover:bg-accent transition shadow-sm"
              >
                Book Free Demo
              </Link>
            </motion.div>
            
            {/* Growth Plan (Popular) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -8 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative flex flex-col rounded-3xl border-2 border-indigo-600 bg-card p-6 sm:p-8 shadow-2xl shadow-indigo-600/10 transition-all duration-300"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-[10px] font-black text-white uppercase tracking-widest shadow-md">
                ★ Most Popular
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">Growth Tier</span>
              <h3 className="text-2xl font-black text-foreground">Growth</h3>
              <p className="mt-1 text-xs text-muted-foreground">Setup Fee: ₹19,999 (One-Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹5,999</span>
                <span className="text-xs font-bold text-muted-foreground">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="text-[11px] font-extrabold text-foreground uppercase tracking-wider mb-2">Everything in Starter plus:</li>
                {[
                  "Up to 3 WhatsApp Numbers",
                  "Shared Team Inbox",
                  "CRM Integration & Pipeline",
                  "WhatsApp Broadcast Campaigns",
                  "Automated Follow-up Sequences",
                  "Multiple Staff Member Roles",
                  "Priority 24/7 Support"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-xs text-foreground font-extrabold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="mt-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-center text-xs sm:text-sm font-extrabold text-white transition hover:shadow-lg shadow-md"
              >
                Book Free Consultation
              </Link>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">Enterprise Tier</span>
              <h3 className="text-2xl font-black text-foreground">Enterprise</h3>
              <p className="mt-1 text-xs text-muted-foreground">Custom Multi-Branch Setup</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">Custom</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                {[
                  "Unlimited WhatsApp Numbers",
                  "Custom Fine-Tuned AI Models",
                  "Full REST API & Webhooks Access",
                  "Custom Database Integrations",
                  "Dedicated Account Manager",
                  "Guaranteed SLA Agreement",
                  "White-Label Option Available"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-xs text-muted-foreground font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="mailto:sales@helpa.studio"
                className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-xs sm:text-sm font-extrabold text-foreground hover:bg-accent transition shadow-sm"
              >
                Contact Sales Team
              </a>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ═══════ FAQ SECTION (ANIMATED ACCORDION) ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-24 scroll-mt-16">
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
                className="flex w-full items-center justify-between p-4.5 sm:p-5 text-left font-extrabold text-foreground text-xs sm:text-base cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${activeFaq === item.id ? "rotate-180 text-indigo-600" : ""}`} />
              </button>
              
              <AnimatePresence>
                {activeFaq === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-border/50 px-4.5 sm:px-5 py-4 text-xs sm:text-sm text-muted-foreground leading-relaxed bg-muted/20"
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
      <section className="px-4 sm:px-6 py-16 sm:py-20 z-10 relative">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-indigo-500/30 bg-gradient-to-br from-indigo-900/90 via-zinc-900 to-purple-950 p-8 sm:p-16 text-center text-white shadow-2xl">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl"></div>
          
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white relative z-10">
            Ready to Stop Missing Customers?
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-lg text-indigo-100 text-xs sm:text-base leading-relaxed relative z-10">
            See Helpa configured live with your business FAQs in a 15-minute demo session.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3.5 relative z-10">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-xs sm:text-sm font-extrabold text-indigo-950 hover:bg-zinc-100 transition-all shadow-xl hover:scale-105"
            >
              <span>Book My 15-Min Demo</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border bg-card px-4 sm:px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="font-extrabold text-foreground text-lg">Helpa AI</span>
          </div>

          <div className="flex flex-wrap justify-center gap-5 sm:gap-6 text-xs text-muted-foreground font-bold">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#demo-simulator" className="hover:text-foreground transition-colors">Live Demo</a>
            <a href="#roi" className="hover:text-foreground transition-colors">ROI Calculator</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="mailto:hello@helpa.studio" className="hover:text-foreground transition-colors">Contact</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>

          <p className="text-xs text-muted-foreground font-semibold">
            © {new Date().getFullYear()} Helpa AI Studio. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Sticky Bottom-Right Quick Demo Floating Widget (Mobile Optimized) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        className="fixed bottom-5 right-5 z-40"
      >
        <Link
          href={user ? "/dashboard" : "/signup"}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-5 py-3 text-xs font-extrabold text-white shadow-2xl hover:scale-105 active:scale-95 transition-all border border-white/20"
        >
          <MessageCircle className="h-4 w-4 text-emerald-300 animate-pulse" />
          <span>Book Demo</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>

    </div>
  );
}
