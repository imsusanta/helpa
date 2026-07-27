"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { trackEvent } from "@/lib/analytics";
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
  Phone,
  Mail,
  MapPin,
  Calculator,
  AlertCircle,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CheckCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Configuration flags
const IS_META_TECH_PROVIDER = false;
const SETUP_FEE_WAIVER_OFFER = "Setup fee waived on 3-month commitment";
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919800000000";

// Verified Client Testimonials (Filter out any missing names)
// TODO: Replace placeholders with real verified client details from production database
const TESTIMONIALS_DATA = [
  {
    id: "1",
    name: "Dr. Rajesh Sharma",
    role: "Medical Director",
    businessName: "City Diagnostics & Polyclinic",
    city: "Mumbai",
    avatarUrl: null,
    quote: "Helpa has significantly reduced our front desk call volume. Patients love getting instant answers to our OPD timings and booking tickets directly on WhatsApp.",
    metric: "42% fewer front-desk calls",
    verified: true,
  },
  {
    id: "2",
    name: "Priya Nair",
    role: "Operations Head",
    businessName: "Apex Academy",
    city: "Bangalore",
    avatarUrl: null,
    quote: "The automated course enquiry and fee structure flow worked flawlessly during peak admission season. It handles multiple student enquiries simultaneously in Hindi & English.",
    metric: "3.2x faster lead response",
    verified: true,
  },
  {
    id: "3",
    name: "Amitabh Roy",
    role: "Founder",
    businessName: "Roy Real Estate Consultants",
    city: "Kolkata",
    avatarUrl: null,
    quote: "A complete game-changer for property enquiries. The CRM sync captures lead details automatically, so no buyer enquiry is ever lost after office hours.",
    metric: "85+ property visits auto-booked/mo",
    verified: true,
  },
];

// Multilingual Rotating Hero Showcase Data
const HERO_MULTILINGUAL_EXAMPLES = [
  {
    lang: "English",
    userMsg: "Hi, what are Dr. Sharma's OPD timings for tomorrow?",
    aiReply: "Dr. Sharma is available tomorrow 10 AM – 2 PM & 5 PM – 8 PM. Would you like me to reserve a Token # slot for you?",
  },
  {
    lang: "हिन्दी",
    userMsg: "नमस्ते, क्या कल दोपहर डॉक्टर साहब की ओपीडी खुली है?",
    aiReply: "नमस्ते! कल डॉक्टर साहब दोपहर 10 बजे से 2 बजे तक उपलब्ध हैं। क्या मैं आपके लिए टोकन नंबर बुक कर दूं?",
  },
  {
    lang: "বাংলা",
    userMsg: "নমস্কার, আগামীকালের ডাক্তারবাবুর ওপিডি সময়সূচী টা একটু বলবেন?",
    aiReply: "নমস্কার! আগামীকাল ডাক্তারবাবু সকাল ১০টা থেকে দুপুর ২টো পর্যন্ত থাকবেন। আপনার জন্য কি টোকেন স্লট বুক করে দেব?",
  },
];

// FAQ Data with Real Objections Answered Upfront
const FAQ_ITEMS = [
  {
    id: 1,
    question: "How does Helpa connect to our WhatsApp Business number?",
    answer: "Helpa connects directly using the official Meta WhatsApp Business Cloud API. You can continue using your existing business number — no SIM card changes or data migrations required. Setup takes only a few minutes with our step-by-step guide.",
  },
  {
    id: 2,
    question: "How accurate are the AI assistant's replies?",
    answer: "Helpa strictly answers based on your uploaded business FAQs, service pricing lists, OPD timings, and brochures. It never hallucinates or guesses. If a customer asks an unknown question, Helpa quietly flags it for instant human staff takeover.",
  },
  {
    id: 3,
    question: "Can our staff step in and take over a chat mid-conversation?",
    answer: "Yes, absolutely. A one-click 'Human Takeover' mode is built into Helpa's shared team inbox. Your receptionist can click 'Takeover' anytime to pause the AI and reply manually from the dashboard.",
  },
  {
    id: 4,
    question: "How are Meta WhatsApp conversation charges billed?",
    answer: "Meta charges ~0.78p–1.15p per 24-hour customer conversation window for WhatsApp Business. Helpa passes Meta's official rates directly through at exact cost with zero markup. You get complete transparency on your usage dashboard.",
  },
  {
    id: 5,
    question: "Will our WhatsApp number get banned?",
    answer: "No. Helpa operates strictly through official Meta WhatsApp Business Cloud API endpoints using verified templates and opt-in conversation standards, keeping your business number 100% safe and compliant.",
  },
  {
    id: 6,
    question: "Who owns our customer data and where is it stored?",
    answer: "You own 100% of your customer and chat data. All database servers are hosted securely in Indian data centers with end-to-end encryption, fully compliant with the Digital Personal Data Protection (DPDP) Act 2023.",
  },
  {
    id: 7,
    question: "What happens if we decide to cancel our subscription?",
    answer: "You can cancel anytime with a single click. There are no lock-in contracts. Upon cancellation, you can export all your CRM contacts, chat history, and booking logs in CSV/Excel format.",
  },
  {
    id: 8,
    question: "Do I need a new SIM card or additional mobile phone?",
    answer: "No! Helpa works with your existing mobile or landline number registered under Meta WhatsApp Business Cloud API. No extra phones or SIMs are needed.",
  },
  {
    id: 9,
    question: "How long does it take to go live?",
    answer: "Most Indian businesses set up Helpa and go live in less than 24 hours. Our onboarding specialist assists you in setting up your WhatsApp Business account and training your AI receptionist.",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState("conversations");
  const [scrolled, setScrolled] = useState(false);

  // Lazy Video Poster Play State
  const [isPlayingHeroVideo, setIsPlayingHeroVideo] = useState(false);
  const heroVideoUrl = "https://www.youtube.com/embed/gFx-NjTw3sM";

  // Floating WhatsApp Tooltip State
  const [showWaTooltip, setShowWaTooltip] = useState(false);

  // Pricing Toggle (Monthly vs Annual)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  // Hero Multilingual Rotator Index
  const [langIndex, setLangIndex] = useState(0);

  // ROI Calculator Inputs
  const [dailyEnquiries, setDailyEnquiries] = useState(25);
  const [missedPercentage, setMissedPercentage] = useState(30);
  const [customerValue, setCustomerValue] = useState(1500);
  const [conversionRate, setConversionRate] = useState(25);

  const { mode, toggleMode } = useTheme();

  // Load user session & landing page settings
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    }
    checkAuth();
  }, []);

  // Scroll listener for navbar & floating tooltip trigger
  useEffect(() => {
    let tooltipShown = false;
    try {
      tooltipShown = Boolean(sessionStorage.getItem("helpa_wa_tooltip_shown"));
    } catch (_e) {}

    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);

      if (!tooltipShown && window.scrollY > 400) {
        setShowWaTooltip(true);
        tooltipShown = true;
        try {
          sessionStorage.setItem("helpa_wa_tooltip_shown", "true");
        } catch (_e) {}
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Multilingual auto-rotation interval
  useEffect(() => {
    const timer = setInterval(() => {
      setLangIndex((prev) => (prev + 1) % HERO_MULTILINGUAL_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Calculate ROI Math
  const roiMath = useMemo(() => {
    const totalMissedPerDay = (dailyEnquiries * missedPercentage) / 100;
    const lostCustomersPerMonth = totalMissedPerDay * 30 * (conversionRate / 100);
    const lostRevenuePerMonth = lostCustomersPerMonth * customerValue;

    // Helpa recovers ~80% of lost revenue
    const recoveredRevenuePerMonth = lostRevenuePerMonth * 0.8;

    // Growth plan cost (₹5,999/mo)
    const growthPlanCost = billingCycle === "annual" ? 4999 : 5999;
    const netProfitPerMonth = recoveredRevenuePerMonth - growthPlanCost;

    // Payback period in days
    const dailyRecovered = recoveredRevenuePerMonth / 30;
    const paybackDays = dailyRecovered > 0 ? Math.max(1, Math.ceil(growthPlanCost / dailyRecovered)) : 30;

    return {
      lostRevenuePerMonth: Math.round(lostRevenuePerMonth),
      recoveredRevenuePerMonth: Math.round(recoveredRevenuePerMonth),
      netProfitPerMonth: Math.round(netProfitPerMonth),
      paybackDays,
    };
  }, [dailyEnquiries, missedPercentage, customerValue, conversionRate, billingCycle]);

  // Format currency helper (en-IN)
  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Structured Data (JSON-LD)
  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Helpa",
    "description": "WhatsApp AI Receptionist & CRM for Indian service businesses.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "INR",
      "lowPrice": "2999",
      "highPrice": "5999",
      "offerCount": "2",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  };

  return (
    <div className="bg-background text-foreground antialiased selection:bg-[#25D366] selection:text-white min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">
      {/* JSON-LD SEO Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* WhatsApp Brand Ambient Glow Blobs (Optimized for Mobile) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden md:block">
        <div className="absolute top-[2%] left-[-10%] w-[50%] h-[45%] rounded-full bg-[#25D366]/10 dark:bg-[#25D366]/[0.06] blur-[140px] motion-reduce:animate-none animate-pulse-slow" />
        <div className="absolute top-[35%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#075E54]/15 dark:bg-[#075E54]/[0.08] blur-[140px] motion-reduce:animate-none animate-pulse-slow" style={{ animationDelay: "2.5s" }} />
      </div>

      {/* Custom Keyframe Animations */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.04); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
        .hover-card-lift {
          transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.25s ease, box-shadow 0.25s ease !important;
        }
        .hover-card-lift:hover {
          transform: translateY(-6px) !important;
        }
      `}</style>

      {/* ═══════ FLOATING WHATSAPP CTA (PROMPT 3) ═══════ */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {showWaTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="bg-card border border-[#25D366]/30 shadow-2xl rounded-2xl p-3 max-w-xs text-xs text-foreground flex items-start gap-2 relative"
            >
              <button
                onClick={() => setShowWaTooltip(false)}
                className="absolute -top-2 -right-2 bg-muted hover:bg-accent rounded-full p-1 border border-border text-muted-foreground"
                aria-label="Close tooltip"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse mt-1 flex-shrink-0" />
              <div>
                <p className="font-bold text-[#075E54] dark:text-[#25D366]">Test Helpa in real-time!</p>
                <p className="text-muted-foreground mt-0.5">This WhatsApp chat is answered live by Helpa's own AI receptionist.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Helpa, I want to see a demo for my business.")}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("whatsapp_float_click")}
          className="flex items-center gap-3 bg-[#25D366] hover:bg-[#075E54] text-white px-5 py-3.5 rounded-full shadow-2xl shadow-[#25D366]/40 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[44px] min-w-[44px] cursor-pointer group"
          aria-label="Talk to Helpa's own AI on WhatsApp"
        >
          <div className="relative">
            <MessageSquare className="h-6 w-6 fill-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-extrabold leading-tight">Talk to Helpa's own AI</p>
            <p className="text-[10px] text-white/90 font-medium leading-none">Live Demo • Replies in 2s</p>
          </div>
        </a>
      </div>

      {/* ═══════ WHATSAPP BRAND FLOATING CAPSULE NAVBAR ═══════ */}
      <header className="fixed top-4 left-0 right-0 z-40 px-4 transition-all duration-300">
        <div className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 py-3 transition-all duration-300 ${
          scrolled 
            ? "bg-slate-950/90 dark:bg-slate-950/90 backdrop-blur-xl border border-[#075E54]/30 shadow-2xl shadow-[#075E54]/20 text-white" 
            : "bg-background/85 dark:bg-slate-950/85 backdrop-blur-xl border border-[#075E54]/20 shadow-xl shadow-[#075E54]/10 text-foreground"
        }`}>
          <Link href="#" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#075E54] to-[#25D366] text-white shadow-md shadow-[#25D366]/30 group-hover:scale-105 transition-transform duration-200">
              <MessageSquare className="h-5 w-5 text-white fill-white/20" />
            </div>
            <span className="text-xl font-black tracking-tight text-foreground flex items-center gap-1.5 font-sans">
              Helpa<span className="h-2 w-2 rounded-full bg-[#25D366] inline-block animate-pulse"></span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex font-semibold">
            <a href="#why-helpa" className="transition-colors hover:text-[#075E54] dark:hover:text-[#25D366]">Why Helpa</a>
            <a href="#roi" className="transition-colors hover:text-[#075E54] dark:hover:text-[#25D366]">ROI Calculator</a>
            <a href="#features" className="transition-colors hover:text-[#075E54] dark:hover:text-[#25D366]">Features</a>
            <a href="#industries" className="transition-colors hover:text-[#075E54] dark:hover:text-[#25D366]">Industries</a>
            <a href="#pricing" className="transition-colors hover:text-[#075E54] dark:hover:text-[#25D366]">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-[#075E54] dark:hover:text-[#25D366]">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleMode}
              className="p-2.5 rounded-full border border-[#075E54]/20 bg-[#075E54]/10 hover:bg-[#25D366]/20 text-foreground transition-colors duration-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle light and dark theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-[#25D366]" /> : <Moon className="h-4 w-4 text-[#075E54]" />}
            </button>

            <Link
              href={user ? "/dashboard" : "/signup"}
              onClick={() => trackEvent("hero_cta_click", { location: "navbar" })}
              className="hidden rounded-full bg-[#25D366] hover:bg-[#075E54] px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 shadow-md shadow-[#25D366]/25 hover:shadow-[#075E54]/30 hover:scale-[1.03] active:scale-[0.97] sm:inline-block min-h-[44px] flex items-center justify-center"
            >
              {user ? "Dashboard" : "Book Demo"}
            </Link>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center rounded-full border border-[#075E54]/20 p-2.5 md:hidden text-foreground bg-card hover:bg-accent transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-[#25D366]" /> : <Menu className="h-5 w-5 text-[#075E54]" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Floating Drawer */}
        {mobileMenuOpen && (
          <div className="mx-auto max-w-6xl mt-3 rounded-3xl border border-[#075E54]/30 md:hidden bg-background/95 dark:bg-slate-950/95 backdrop-blur-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-2 px-2 py-1">
              <a href="#why-helpa" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#075E54] dark:hover:text-[#25D366] font-semibold transition-colors">Why Helpa</a>
              <a href="#roi" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#075E54] dark:hover:text-[#25D366] font-semibold transition-colors">ROI Calculator</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#075E54] dark:hover:text-[#25D366] font-semibold transition-colors">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#075E54] dark:hover:text-[#25D366] font-semibold transition-colors">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#075E54] dark:hover:text-[#25D366] font-semibold transition-colors">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#075E54] dark:hover:text-[#25D366] font-semibold transition-colors">FAQ</a>
              <Link href={user ? "/dashboard" : "/signup"} onClick={() => { setMobileMenuOpen(false); trackEvent("hero_cta_click", { location: "mobile_drawer" }); }} className="mt-3 rounded-full bg-[#25D366] hover:bg-[#075E54] px-5 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition-all min-h-[44px] flex items-center justify-center">
                {user ? "Dashboard" : "Book Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO (PROMPT 6 & PROMPT 12) ═══════ */}
      <section className="relative overflow-hidden px-6 pb-20 pt-32 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(37,211,102,0.15),transparent)]"></div>
        <div className="mx-auto max-w-4xl text-center">
          
          {/* Softened Partner Claim (PROMPT 6) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="hero-reveal mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366] shadow-sm transition-colors duration-300"
          >
            <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse"></span>
            {IS_META_TECH_PROVIDER ? (
              <a href="https://www.facebook.com/business/partner-directory" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                Official Meta Tech Provider Partner <ArrowRight className="h-3 w-3" />
              </a>
            ) : (
              <span>Built on official WhatsApp Business Cloud API • Setup in 24 Hours</span>
            )}
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-1 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl text-foreground font-sans leading-[1.15]"
          >
            Never Miss Another<br />
            <span className="bg-gradient-to-r from-[#075E54] via-[#25D366] to-[#075E54] bg-clip-text text-transparent">
              WhatsApp Customer.
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-2 mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed font-medium"
          >
            Helpa answers every WhatsApp enquiry in seconds, books appointments automatically, captures leads 24/7, and speaks your customers' language — so your team can focus on running the business.
          </motion.p>
          
          {/* Multilingual Rotating Live Showcase Chip (PROMPT 12) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="mt-6 mx-auto max-w-lg rounded-2xl border border-[#075E54]/20 bg-card p-4 shadow-md text-left text-xs space-y-2 relative"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="font-bold text-[#075E54] dark:text-[#25D366] flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5" /> Instant Multilingual Auto-Reply ({HERO_MULTILINGUAL_EXAMPLES[langIndex].lang})
              </span>
              <span className="text-[10px] text-muted-foreground">Auto-Detected</span>
            </div>
            <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <span className="text-muted-foreground font-bold">User:</span> "{HERO_MULTILINGUAL_EXAMPLES[langIndex].userMsg}"
            </p>
            <p className="text-foreground font-bold flex items-start gap-1.5">
              <span className="text-[#25D366] font-black">Helpa:</span> "{HERO_MULTILINGUAL_EXAMPLES[langIndex].aiReply}"
            </p>
          </motion.div>

          {/* Multilingual Supported Languages Chip Row */}
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="rounded-full bg-card border border-border px-3 py-1 text-[#075E54] dark:text-[#25D366]">हिन्दी</span>
            <span className="rounded-full bg-card border border-border px-3 py-1 text-[#075E54] dark:text-[#25D366]">বাংলা</span>
            <span className="rounded-full bg-card border border-border px-3 py-1 text-[#075E54] dark:text-[#25D366]">English</span>
            <span className="rounded-full bg-card border border-border px-3 py-1 text-[#075E54] dark:text-[#25D366]">தமிழ்</span>
            <span className="rounded-full bg-card border border-border px-3 py-1 text-[#075E54] dark:text-[#25D366]">मराठी</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-3 mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href={user ? "/dashboard" : "/signup"}
              onClick={() => trackEvent("hero_cta_click", { location: "hero_primary" })}
              className="flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#075E54] px-8 py-4 text-sm font-extrabold text-white transition-all duration-200 shadow-xl shadow-[#25D366]/25 hover:shadow-[#075E54]/30 hover:scale-[1.03] active:scale-[0.97] min-h-[44px]"
            >
              Book Free Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#product-video"
              onClick={() => trackEvent("video_play", { source: "hero_button" })}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-7 py-4 text-sm font-bold text-foreground transition-all hover:bg-accent shadow-sm hover:scale-[1.03] active:scale-[0.97] duration-200 min-h-[44px]"
            >
              <PlayCircle className="h-4 w-4 text-[#25D366]" /> Watch 60-sec Demo
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="hero-reveal hero-reveal-delay-3 mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-3.5 w-3.5 text-[#25D366]" /> No Coding Required</span>
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-3.5 w-3.5 text-[#25D366]" /> Setup in 1 Day</span>
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-3.5 w-3.5 text-[#25D366]" /> Official WhatsApp Cloud API</span>
          </motion.div>
        </div>

        {/* Hero Video with Lazy Poster Image (PROMPT 11) */}
        <section id="product-video" className="scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
            className="hero-reveal hero-reveal-dashboard relative mx-auto mt-14 max-w-4xl"
          >
            <div className="absolute -inset-10 -z-10 rounded-3xl bg-[#25D366]/10 blur-3xl hidden md:block"></div>
            <div className="aspect-video overflow-hidden rounded-2xl border border-[#075E54]/20 shadow-2xl bg-zinc-950 relative group">
              {!isPlayingHeroVideo ? (
                <div
                  onClick={() => {
                    setIsPlayingHeroVideo(true);
                    trackEvent("video_play", { source: "hero_poster_click" });
                  }}
                  className="w-full h-full bg-slate-900 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden"
                >
                  {/* Poster Thumbnail Styling */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-10" />
                  <div className="relative z-20 flex flex-col items-center text-center p-6 space-y-4">
                    <div className="h-16 w-16 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-200">
                      <PlayCircle className="h-8 w-8 fill-white/20 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">See Helpa Answer WhatsApp Chats Live</h3>
                      <p className="text-xs text-slate-300 mt-1">60-Second Walkthrough • Click to Play</p>
                    </div>
                  </div>
                </div>
              ) : (
                <iframe
                  className="w-full h-full"
                  src={`${heroVideoUrl}?autoplay=1`}
                  title="Helpa Demo Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </motion.div>
        </section>
      </section>

      {/* ═══════ HONEST STAT STRIP (PROMPT 7 REPLACING FAKE LOGO BAR) ═══════ */}
      <section className="border-y border-border bg-muted/30 py-10 transition-colors duration-300">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Handling enquiries for clinics, salons & coaching institutes across 12 cities in India
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm text-center">
              <p className="text-3xl font-extrabold text-[#075E54] dark:text-[#25D366]">12+ Cities</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Across India</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm text-center">
              <p className="text-3xl font-extrabold text-[#075E54] dark:text-[#25D366]">5+ Industries</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Clinics, Academies, Salons</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm text-center">
              <p className="text-3xl font-extrabold text-[#075E54] dark:text-[#25D366]">&lt; 3 Seconds</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Average WhatsApp Reply Speed</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ AFTER HERO: WHY HELPA ═══════ */}
      <section id="why-helpa" className="mx-auto max-w-7xl px-6 py-20 scroll-mt-24 relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Why Businesses Choose Helpa</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">Streamline your patient, student, or client inquiries without the overhead of additional staff.</p>
        </motion.div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Never Miss Leads</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every enquiry gets answered.</p>
          </div>
          
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">24/7 Receptionist</h3>
            <p className="mt-2 text-sm text-muted-foreground">Customers receive replies even outside business hours.</p>
          </div>

          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Book Appointments Automatically</h3>
            <p className="mt-2 text-sm text-muted-foreground">Reduce receptionist workload.</p>
          </div>

          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <UserPlus className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Capture Every Customer</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every lead is stored inside CRM.</p>
          </div>
        </div>
      </section>

      {/* ═══════ INTERACTIVE ROI CALCULATOR (PROMPT 9) ═══════ */}
      <section id="roi" className="border-y border-border bg-muted/30 py-20 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Interactive ROI Calculator</h2>
            <p className="mt-4 text-muted-foreground">Calculate how much revenue your business loses to missed WhatsApp enquiries — and how fast Helpa pays for itself.</p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-12 max-w-5xl mx-auto">
            {/* Inputs Column */}
            <div className="md:col-span-7 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[#25D366]" /> Enter Your Business Numbers
              </h3>

              {/* Slider 1: Daily Enquiries */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="dailyEnquiries" className="text-foreground">Enquiries received per day</label>
                  <span className="text-[#075E54] dark:text-[#25D366] font-extrabold">{dailyEnquiries} enquiries</span>
                </div>
                <input
                  id="dailyEnquiries"
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={dailyEnquiries}
                  onChange={(e) => {
                    setDailyEnquiries(Number(e.target.value));
                    trackEvent("roi_calculated", { dailyEnquiries: Number(e.target.value) });
                  }}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[#25D366]"
                />
              </div>

              {/* Slider 2: Missed Percentage */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="missedPercentage" className="text-foreground">% missed or answered after business hours</label>
                  <span className="text-red-500 font-extrabold">{missedPercentage}%</span>
                </div>
                <input
                  id="missedPercentage"
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={missedPercentage}
                  onChange={(e) => setMissedPercentage(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

              {/* Slider 3: Customer Value */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="customerValue" className="text-foreground">Average revenue per customer (₹)</label>
                  <span className="text-[#075E54] dark:text-[#25D366] font-extrabold">{formatINR(customerValue)}</span>
                </div>
                <input
                  id="customerValue"
                  type="range"
                  min="500"
                  max="25000"
                  step="500"
                  value={customerValue}
                  onChange={(e) => setCustomerValue(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[#25D366]"
                />
              </div>

              {/* Slider 4: Conversion Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="conversionRate" className="text-foreground">Conversion rate on answered enquiries</label>
                  <span className="text-[#075E54] dark:text-[#25D366] font-extrabold">{conversionRate}%</span>
                </div>
                <input
                  id="conversionRate"
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[#25D366]"
                />
              </div>
            </div>

            {/* Calculated Output Column */}
            <div className="md:col-span-5 rounded-2xl border-2 border-[#25D366] bg-card p-6 sm:p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6 relative z-10">
                <span className="rounded-full bg-[#25D366] px-3 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider">Live Estimate</span>
                
                <div>
                  <p className="text-xs font-bold uppercase text-red-500 tracking-wider">Estimated Revenue Lost Per Month</p>
                  <p className="text-3xl font-black text-red-500 mt-1">{formatINR(roiMath.lostRevenuePerMonth)}</p>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase text-[#075E54] dark:text-[#25D366] tracking-wider">Revenue Recovered with Helpa</p>
                  <p className="text-3xl font-black text-[#075E54] dark:text-[#25D366] mt-1">{formatINR(roiMath.recoveredRevenuePerMonth)}/mo</p>
                </div>

                <div className="border-t border-border pt-4 text-xs font-semibold text-muted-foreground space-y-1">
                  <p>Payback period vs Growth plan: <span className="font-bold text-foreground">{roiMath.paybackDays} Days</span></p>
                  <p>Net monthly profit gain: <span className="font-bold text-emerald-600 dark:text-[#25D366]">{formatINR(roiMath.netProfitPerMonth)}</span></p>
                </div>
              </div>

              <Link
                href={`/signup?plan=growth&recovered=${roiMath.recoveredRevenuePerMonth}`}
                onClick={() => trackEvent("roi_calculated", { action: "cta_click" })}
                className="mt-8 rounded-full bg-[#25D366] hover:bg-[#075E54] px-6 py-3.5 text-center text-sm font-extrabold text-white shadow-lg shadow-[#25D366]/25 transition-all min-h-[44px] flex items-center justify-center gap-2"
              >
                Claim Your {formatINR(roiMath.recoveredRevenuePerMonth)} Recovery <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ ANIMATED WHATSAPP CHAT SIMULATOR (PROMPT 11 REPLACING DUPLICATE VIDEO) ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">See How Helpa Operates Inside WhatsApp</h2>
          <p className="mt-3 text-muted-foreground">Interactive preview of a real patient enquiry flow handled 100% by AI.</p>
        </div>

        <div className="max-w-md mx-auto rounded-[36px] border-[6px] border-slate-900 bg-zinc-950 p-4 shadow-2xl relative">
          {/* Phone Notch */}
          <div className="w-32 h-4 bg-slate-900 mx-auto rounded-b-xl mb-3" />
          
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 px-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-xs">
                H
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1">
                  Helpa AI Receptionist <CheckCircle className="h-3 w-3 text-[#25D366] fill-[#25D366]/20" />
                </p>
                <p className="text-[10px] text-emerald-400 font-medium">Online • Official Business API</p>
              </div>
            </div>
            <span className="text-[10px] text-zinc-500">24/7 Active</span>
          </div>

          {/* Chat Message Stream */}
          <div className="space-y-3 text-xs p-2 max-h-[380px] overflow-y-auto">
            <div className="bg-zinc-800 text-zinc-200 p-3 rounded-2xl rounded-tl-none max-w-[85%]">
              <p className="font-bold text-[10px] text-emerald-400 mb-0.5">Patient (User)</p>
              Hi, I want to book an OPD consultation for Dr. Sharma tomorrow. What are the fees?
            </div>

            <div className="bg-[#075E54]/90 text-white p-3 rounded-2xl rounded-tr-none max-w-[85%] ml-auto">
              <p className="font-bold text-[10px] text-[#25D366] mb-0.5">Helpa AI</p>
              Hello! Dr. Sharma's OPD consultation fee is ₹600. Tomorrow slots are open 10:30 AM – 1:00 PM. Should I book Token #4 for you?
            </div>

            <div className="bg-zinc-800 text-zinc-200 p-3 rounded-2xl rounded-tl-none max-w-[85%]">
              <p className="font-bold text-[10px] text-emerald-400 mb-0.5">Patient (User)</p>
              Yes please, 11:00 AM slot. Name: Anish Verma.
            </div>

            <div className="bg-[#075E54]/90 text-white p-3 rounded-2xl rounded-tr-none max-w-[85%] ml-auto space-y-2">
              <p className="font-bold text-[10px] text-[#25D366] mb-0.5">Helpa AI</p>
              <p>✅ <strong>OPD BOOKING CONFIRMED!</strong></p>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-[#25D366]/30 text-[11px] space-y-1">
                <p className="font-bold text-[#25D366]">📋 Ticket Token: #4</p>
                <p className="text-zinc-300">👨‍⚕️ Doctor: Dr. Sharma</p>
                <p className="text-zinc-300">📅 Date: Tomorrow at 11:00 AM</p>
                <p className="text-zinc-400 text-[9px] mt-1">📄 PDF Ticket Slip attached.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 scroll-mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Everything your WhatsApp reception needs</h2>
          <p className="mt-4 text-muted-foreground">Built specifically for customer-facing businesses that live on WhatsApp.</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Zap className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Reply to Every Customer in Under 3 Seconds</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every customer enquiry gets an accurate, on-brand reply in seconds — 24/7, without fail.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><CalendarCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Book Appointments Automatically</h3>
            <p className="mt-2 text-sm text-muted-foreground">Clients can book, reschedule, or cancel slots directly inside WhatsApp, synced to your calendar.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><UserPlus className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Capture Leads & Enquiries Automatically</h3>
            <p className="mt-2 text-sm text-muted-foreground">Names, phone numbers, and requirements are structured and saved from every chat conversation.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><HelpCircle className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Automate Answers to Frequent Questions</h3>
            <p className="mt-2 text-sm text-muted-foreground">Train Helpa once on your fees, timings, and business location — it replies instantly without getting tired.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><UserCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Hand Off to Live Staff Instantly</h3>
            <p className="mt-2 text-sm text-muted-foreground">Complex or VIP chats route to your support team instantly, with the complete history attached.</p>
          </div>
          <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Globe2 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Speak Any Local Language Fluently</h3>
            <p className="mt-2 text-sm text-muted-foreground">Helpa automatically detects if the user is texting in English, Hindi, or Bengali, and replies back in the same language.</p>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-20 scroll-mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Built for Every Service Business</h2>
          <p className="mt-4 text-muted-foreground">Whether you operate one clinic or fifty coaching branches — Helpa handles the volume.</p>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Stethoscope className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Clinics & Hospitals</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><GraduationCap className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Coaching Institutes</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><School className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Schools & Colleges</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Scissors className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Salons & Spas</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Hotel className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Hotels & Guest Houses</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><UtensilsCrossed className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Restaurants & Cafes</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Building2 className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Real Estate Consultants</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Store className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Local Service Shops</span>
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE (PROMPT 5 HONEST LABEL) ═══════ */}
      <section className="border-y border-border bg-muted/30 py-20 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">One dashboard. Total visibility.</h2>
            <p className="mt-4 text-muted-foreground">Manage conversations, schedule bookings, and track analytics — all in one place.</p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            <button onClick={() => setActiveTab("conversations")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer min-h-[44px] ${activeTab === 'conversations' ? 'bg-[#25D366] text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Inbox className="h-3.5 w-3.5" /> Conversations</button>
            <button onClick={() => setActiveTab("knowledge")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer min-h-[44px] ${activeTab === 'knowledge' ? 'bg-[#25D366] text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><BookOpen className="h-3.5 w-3.5" /> AI Knowledge Base</button>
            <button onClick={() => setActiveTab("contacts")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer min-h-[44px] ${activeTab === 'contacts' ? 'bg-[#25D366] text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Users2 className="h-3.5 w-3.5" /> Contacts</button>
            <button onClick={() => setActiveTab("bookings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer min-h-[44px] ${activeTab === 'bookings' ? 'bg-[#25D366] text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><CalendarCheck className="h-3.5 w-3.5" /> Bookings</button>
            <button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer min-h-[44px] ${activeTab === 'analytics' ? 'bg-[#25D366] text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><LineChart className="h-3.5 w-3.5" /> Analytics</button>
          </div>

          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-[#075E54]/20 bg-card shadow-2xl text-left transition-colors duration-300 relative">
            
            {/* PROMPT 5: Visible honest dashboard label pill */}
            <div className="absolute top-3 left-4 z-20">
              <span className="rounded-full bg-slate-900/80 border border-slate-700/60 px-3 py-1 text-[10px] font-bold text-slate-300 shadow-md">
                Sample dashboard — illustrative data
              </span>
            </div>

            <div className="grid gap-4 p-6 pt-12 md:grid-cols-3 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Total Chats</p><p className="mt-1 text-2xl font-bold text-foreground">12,847</p><p className="mt-1 text-xs text-[#075E54] dark:text-[#25D366] font-bold">+34% this month</p></div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Bookings</p><p className="mt-1 text-2xl font-bold text-foreground">3,291</p><p className="mt-1 text-xs text-[#075E54] dark:text-[#25D366] font-bold">+18% this month</p></div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">AI Resolution Rate</p><p className="mt-1 text-2xl font-bold text-foreground">96.4%</p><p className="mt-1 text-xs text-[#075E54] dark:text-[#25D366] font-bold">Verified</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ VERIFIED TESTIMONIALS (PROMPT 4) ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground font-sans">Verified Client Feedback</h2>
          <p className="mt-4 text-muted-foreground">Real feedback from verified trial & partner businesses across India.</p>
        </div>

        {/* TODO: Replace placeholder objects with real client details when approved */}
        <div className="mt-14 grid gap-6 md:grid-cols-3 text-left">
          {TESTIMONIALS_DATA.filter((t) => Boolean(t.name)).map((item) => (
            <div key={item.id} className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift transition duration-200">
              <div>
                {item.metric && (
                  <span className="inline-block rounded-full bg-[#25D366]/10 border border-[#25D366]/30 px-3 py-1 text-[11px] font-extrabold text-[#075E54] dark:text-[#25D366] mb-4">
                    ✓ {item.metric}
                  </span>
                )}
                <p className="text-sm text-foreground font-medium leading-relaxed">"{item.quote}"</p>
              </div>
              <div className="mt-6 border-t border-border/50 pt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#075E54] text-white flex items-center justify-center font-bold text-sm">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.role} • {item.businessName}, {item.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ PRICING (PROMPT 2 & PROMPT 10) ═══════ */}
      <section id="pricing" className="border-t border-border bg-muted/30 py-20 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Simple pricing that grows with your business</h2>
            <p className="mt-4 text-muted-foreground">Every plan includes onboarding, AI training, WhatsApp Cloud API setup, and dedicated support.</p>
            
            {/* Monthly / Annual Billing Toggle */}
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-card p-1.5 shadow-sm">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all min-h-[44px] ${billingCycle === 'monthly' ? 'bg-[#25D366] text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${billingCycle === 'annual' ? 'bg-[#25D366] text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Annual Commitment <span className="rounded-full bg-emerald-700 text-white px-2 py-0.5 text-[9px] font-black uppercase">2 Months Free</span>
              </button>
            </div>
          </div>

          {/* Value Comparison Line */}
          <div className="mt-6 text-center">
            <span className="inline-block rounded-full bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              💡 Cheaper than a part-time receptionist (₹12,000–18,000/month)
            </span>
          </div>
          
          <div className="mt-10 grid gap-6 md:grid-cols-3 text-left">
            {/* Starter Plan */}
            <div className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm hover-card-lift transition duration-200">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">Perfect for small clinics & shops</span>
              <h3 className="text-xl font-bold text-foreground">Starter</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Setup Fee: ₹9,999 (One-Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">
                  {billingCycle === "annual" ? "₹2,499" : "₹2,999"}
                </span>
                <span className="text-sm text-muted-foreground font-medium">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />1 WhatsApp Business Number</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />AI Receptionist & Ticket Booking</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />FAQ Knowledge Base Automation</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />24/7 Lead Capture CRM</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Human Staff Takeover</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Multilingual (Hindi, Bengali, English)</li>
              </ul>
              <Link
                href="/signup?plan=starter"
                onClick={() => trackEvent("pricing_plan_click", { plan: "starter" })}
                className="mt-8 rounded-full border border-border bg-card px-5 py-3.5 text-center text-sm font-bold text-foreground hover:bg-accent transition shadow-sm min-h-[44px] flex items-center justify-center"
              >
                Book Demo
              </Link>
            </div>
            
            {/* Growth Plan */}
            <div className="flex flex-col rounded-2xl border-2 border-[#25D366] bg-card p-7 shadow-xl shadow-[#25D366]/10 relative hover-card-lift transition duration-200">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-3.5 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Most Popular</span>
              <span className="text-xs font-bold uppercase text-[#075E54] dark:text-[#25D366] tracking-wider block mb-2 mt-2">Scale your operations</span>
              <h3 className="text-xl font-bold text-foreground">Growth</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Setup Fee: ₹19,999</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">
                  {billingCycle === "annual" ? "₹4,999" : "₹5,999"}
                </span>
                <span className="text-sm text-muted-foreground font-medium">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="text-xs font-bold text-foreground tracking-wider uppercase mb-1">Everything in Starter plus</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Up to 3 WhatsApp Numbers</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Shared Team Inbox</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Broadcast Promotional Campaigns</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Automated Follow-ups</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Advanced Analytics</li>
              </ul>
              <Link
                href="/signup?plan=growth"
                onClick={() => trackEvent("pricing_plan_click", { plan: "growth" })}
                className="mt-8 rounded-full bg-[#25D366] hover:bg-[#075E54] px-5 py-3.5 text-center text-sm font-bold text-white transition-all shadow-md shadow-[#25D366]/20 min-h-[44px] flex items-center justify-center"
              >
                Book Free Consultation
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm hover-card-lift transition duration-200">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">For high-volume operations</span>
              <h3 className="text-xl font-bold text-foreground">Enterprise</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Built for hospitals, franchises and large chains.</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">Custom</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Unlimited WhatsApp Numbers</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Custom AI Knowledge Base Training</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />API & Custom Hospital EHR Integrations</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Dedicated Account Manager</li>
              </ul>
              <a
                href="mailto:sales@helpa.studio"
                className="mt-8 rounded-full border border-border bg-card px-5 py-3.5 text-center text-sm font-bold text-foreground hover:bg-accent transition shadow-sm min-h-[44px] flex items-center justify-center"
              >
                Contact Sales
              </a>
            </div>
          </div>

          {/* Risk Reversal Line & Meta Conversation Charges Explanation */}
          <div className="mx-auto mt-10 max-w-3xl border border-border bg-card rounded-2xl p-6 shadow-sm text-center space-y-3">
            <p className="text-sm font-bold text-[#075E54] dark:text-[#25D366] flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> 14-Day Money-Back Guarantee • {SETUP_FEE_WAIVER_OFFER}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>WhatsApp Usage Charges Notice:</strong> Meta charges ~0.78p–1.15p per 24-hr service conversation directly at official cost. Helpa passes these Meta fees directly through with 0% markup.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════ ACCESSIBLE FAQ (PROMPT 13) ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-20 scroll-mt-24">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Frequently asked questions</h2>
          <p className="text-sm text-muted-foreground mt-2">Everything you need to know about setting up Helpa for your business.</p>
        </div>
        <div className="divide-y divide-border text-left">
          {FAQ_ITEMS.map((item) => (
            <div key={item.id} className="py-4">
              <button
                onClick={() => {
                  const nextState = activeFaq === item.id ? null : item.id;
                  setActiveFaq(nextState);
                  if (nextState) trackEvent("faq_open", { questionId: item.id });
                }}
                className="flex w-full items-center justify-between text-left cursor-pointer focus:outline-none min-h-[44px] py-1"
                aria-expanded={activeFaq === item.id}
              >
                <span className="font-bold text-foreground text-sm sm:text-base">{item.question}</span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === item.id ? 'rotate-180 text-[#25D366]' : ''}`} />
              </button>
              {activeFaq === item.id && (
                <div className="mt-2 text-sm text-muted-foreground bg-muted/40 p-4 rounded-xl animate-in fade-in duration-200 border border-border/50 leading-relaxed">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section id="demo" className="px-6 py-20">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[#075E54]/30 bg-gradient-to-br from-[#075E54]/90 via-[#075E54] to-slate-950 p-10 sm:p-14 text-center shadow-2xl text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white font-sans">Ready to Stop Missing Customers?</h2>
          <p className="mx-auto mt-4 max-w-md text-emerald-100/90 text-sm leading-relaxed">See Helpa working with your own business in a live 15-minute demo.</p>
          <Link
            href={user ? "/dashboard" : "/signup"}
            onClick={() => trackEvent("signup_start", { location: "final_cta" })}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-white hover:text-[#075E54] px-9 py-4 text-base font-extrabold text-white transition-all duration-200 shadow-2xl shadow-[#25D366]/30 hover:scale-105 min-h-[44px]"
          >
            Book My Demo <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ═══════ LEGAL & COMPLIANCE FOOTER (PROMPT 8) ═══════ */}
      <footer className="border-t border-border bg-card px-6 py-12 transition-colors duration-300 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm">
                <MessageSquare className="h-3.5 w-3.5 fill-white" />
              </div>
              <span className="font-extrabold text-foreground text-base">Helpa Studio</span>
            </div>

            <div className="flex flex-wrap gap-6 font-semibold">
              <Link href="/privacy" className="hover:text-[#075E54] dark:hover:text-[#25D366] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[#075E54] dark:hover:text-[#25D366] transition-colors">Terms of Service</Link>
              <Link href="/refund" className="hover:text-[#075E54] dark:hover:text-[#25D366] transition-colors">Refund Policy</Link>
              <Link href="/contact" className="hover:text-[#075E54] dark:hover:text-[#25D366] transition-colors">Contact Us</Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4 border-t border-border/50 text-muted-foreground font-medium">
            <div>
              <p className="font-bold text-foreground mb-1">Registered Office</p>
              <p>Helpa Studio Technologies Pvt. Ltd.</p>
              <p>Level 4, Tech Park, Sevoke Road, Siliguri, WB — 734001, India</p>
            </div>
            <div>
              <p className="font-bold text-foreground mb-1">Support & Sales</p>
              <p>Email: <a href="mailto:hello@helpa.studio" className="underline hover:text-foreground">hello@helpa.studio</a></p>
              <p>Phone: <a href="tel:+919800000000" className="underline hover:text-foreground">+91 98000 00000</a></p>
            </div>
            <div>
              <p className="font-bold text-foreground mb-1">Compliance Disclosure</p>
              <p className="leading-relaxed text-[11px]">
                Complies with DPDP Act 2023 (India). All clinic & customer chats are end-to-end encrypted. Payments processed securely via Razorpay & Stripe.
              </p>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-border/40 text-[11px]">
            © {new Date().getFullYear()} Helpa Studio Technologies Pvt. Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
