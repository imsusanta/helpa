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
  PhoneCall,
  Sparkles,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState("conversations");
  const [scrolled, setScrolled] = useState(false);
  const [heroVideoUrl, setHeroVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");
  const [actionVideoUrl, setActionVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");

  const { mode, toggleMode } = useTheme();

  // Load user session & landing page settings
  useEffect(() => {
    async function checkAuthAndSettings() {
      const supabase = createClient();
      
      // Load user auth session
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      // Load landing page video settings
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

  // Scroll event for navbar glassmorphism
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="bg-background text-foreground antialiased selection:bg-[#25D366] selection:text-white min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* ═══════ $100B STARTUP BACKGROUND GRID & AMBIENT SPOTLIGHTS ═══════ */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle Engineering Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(7,94,84,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(7,94,84,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* WhatsApp Brand Ambient Spotlight Rays (#075E54 & #25D366) */}
        <div className="absolute top-[0%] left-[15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#25D366]/15 via-[#075E54]/10 to-transparent blur-[140px] animate-pulse-slow pointer-events-none" />
        <div className="absolute top-[35%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tl from-[#075E54]/15 via-[#25D366]/10 to-transparent blur-[140px] animate-pulse-slow pointer-events-none" style={{ animationDelay: "3s" }} />
        <div className="absolute top-[65%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-[#25D366]/10 via-[#075E54]/10 to-transparent blur-[140px] animate-pulse-slow pointer-events-none" style={{ animationDelay: "6s" }} />
      </div>
      
      {/* Custom Keyframe Animations */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes float-badge {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-7px) scale(1.02); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.38; transform: scale(1.04); }
        }
        .animate-float-badge {
          animation: float-badge 6s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
        .bento-card-glow {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .bento-card-glow:hover {
          transform: translateY(-6px) !important;
          border-color: rgba(37, 211, 102, 0.45) !important;
          box-shadow: 0 20px 40px -15px rgba(37, 211, 102, 0.15) !important;
        }
      `}</style>

      {/* ═══════ FLOATING CAPSULE GLASS NAVBAR ($100B STARTUP DESIGN) ═══════ */}
      <header className="fixed top-5 left-0 right-0 z-50 px-4 transition-all duration-300">
        <div className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 py-3.5 transition-all duration-300 ${
          scrolled 
            ? "bg-slate-950/90 dark:bg-slate-950/90 backdrop-blur-2xl border border-[#25D366]/30 shadow-[0_12px_40px_rgba(7,94,84,0.25)] text-white" 
            : "bg-background/85 dark:bg-slate-950/85 backdrop-blur-xl border border-[#075E54]/20 shadow-xl shadow-[#075E54]/10 text-foreground"
        }`}>
          {/* Logo Badge */}
          <Link href="#" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#075E54] to-[#25D366] text-white shadow-lg shadow-[#25D366]/30 group-hover:scale-110 transition-transform duration-300">
              <MessageSquare className="h-5 w-5 text-white fill-white/20" />
            </div>
            <span className="text-xl font-black tracking-tight text-foreground flex items-center gap-1.5 font-sans">
              Helpa<span className="h-2.5 w-2.5 rounded-full bg-[#25D366] inline-block animate-pulse shadow-[0_0_8px_#25D366]"></span>
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden items-center gap-2 text-sm text-muted-foreground md:flex font-semibold">
            <a href="#why-helpa" className="px-3 py-1.5 rounded-full transition-all hover:text-[#25D366] hover:bg-[#25D366]/10">Why Helpa</a>
            <a href="#roi" className="px-3 py-1.5 rounded-full transition-all hover:text-[#25D366] hover:bg-[#25D366]/10">ROI</a>
            <a href="#features" className="px-3 py-1.5 rounded-full transition-all hover:text-[#25D366] hover:bg-[#25D366]/10">Features</a>
            <a href="#industries" className="px-3 py-1.5 rounded-full transition-all hover:text-[#25D366] hover:bg-[#25D366]/10">Industries</a>
            <a href="#pricing" className="px-3 py-1.5 rounded-full transition-all hover:text-[#25D366] hover:bg-[#25D366]/10">Pricing</a>
            <a href="#faq" className="px-3 py-1.5 rounded-full transition-all hover:text-[#25D366] hover:bg-[#25D366]/10">FAQ</a>
          </nav>

          {/* Right Action Pill */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleMode}
              className="p-2.5 rounded-full border border-[#075E54]/20 bg-[#075E54]/10 hover:bg-[#25D366]/20 text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-[#25D366]" /> : <Moon className="h-4 w-4 text-[#075E54]" />}
            </button>

            <Link href={user ? "/dashboard" : "/signup"} className="hidden rounded-full bg-[#25D366] hover:bg-[#075E54] px-6 py-2.5 text-sm font-extrabold text-white transition-all duration-200 shadow-lg shadow-[#25D366]/25 hover:shadow-[#075E54]/30 hover:scale-[1.04] active:scale-[0.96] sm:inline-block">
              {user ? "Dashboard" : "Book Demo"}
            </Link>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-full border border-[#075E54]/20 p-2.5 md:hidden text-foreground bg-card hover:bg-accent transition-colors cursor-pointer" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5 text-[#25D366]" /> : <Menu className="h-5 w-5 text-[#075E54]" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Floating Menu Drawer */}
        {mobileMenuOpen && (
          <div className="mx-auto max-w-6xl mt-3 rounded-3xl border border-[#075E54]/30 md:hidden bg-background/95 dark:bg-slate-950/95 backdrop-blur-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-2 px-2 py-1">
              <a href="#why-helpa" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Why Helpa</a>
              <a href="#roi" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">ROI</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">FAQ</a>
              <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-3 rounded-full bg-[#25D366] hover:bg-[#075E54] px-5 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-[#25D366]/25 transition-all">
                {user ? "Dashboard" : "Book Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO SECTION ($100B STARTUP ENTERPRISE STANDARDS) ═══════ */}
      <section className="relative overflow-hidden px-6 pb-24 pt-36 sm:pt-44">
        {/* Side Telemetry Floating Badges for $100B Aesthetic */}
        <div className="hidden lg:block pointer-events-none">
          <div className="absolute top-44 left-8 animate-float-badge z-20">
            <div className="flex items-center gap-2.5 rounded-full border border-[#25D366]/30 bg-slate-950/80 backdrop-blur-xl px-4 py-2 text-xs font-bold text-white shadow-2xl shadow-[#25D366]/10">
              <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse"></span>
              ⚡ 1.1s Speed • WhatsApp Cloud API
            </div>
          </div>
          <div className="absolute top-48 right-8 animate-float-badge z-20" style={{ animationDelay: "3s" }}>
            <div className="flex items-center gap-2.5 rounded-full border border-[#075E54]/40 bg-slate-950/80 backdrop-blur-xl px-4 py-2 text-xs font-bold text-white shadow-2xl shadow-[#075E54]/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              🔒 99.4% AI Accuracy • 24/7 Active
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="hero-reveal mx-auto mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-5 py-2 text-xs font-extrabold text-[#075E54] dark:text-[#25D366] shadow-sm backdrop-blur-md transition-colors duration-300"
          >
            <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse shadow-[0_0_8px_#25D366]"></span>
            ✓ Official WhatsApp AI Partner • Setup in 24 Hours
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-1 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl text-foreground font-sans leading-[1.08]"
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
            className="hero-reveal hero-reveal-delay-2 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed font-medium"
          >
            Helpa answers every WhatsApp enquiry instantly, books appointments automatically, captures leads, and works 24/7—so your team can focus on running the business.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href={user ? "/dashboard" : "/signup"} className="flex items-center gap-2.5 rounded-full bg-[#25D366] hover:bg-[#075E54] px-8 py-4 text-sm font-extrabold text-white transition-all duration-200 shadow-xl shadow-[#25D366]/30 hover:shadow-[#075E54]/40 hover:scale-[1.04] active:scale-[0.96]">
              Book Free Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#product-video" className="flex items-center gap-2 rounded-full border border-[#075E54]/25 bg-card/80 backdrop-blur-md px-7 py-4 text-sm font-extrabold text-foreground transition-all hover:bg-accent shadow-sm hover:scale-[1.03] active:scale-[0.97] duration-200">
              <PlayCircle className="h-4 w-4 text-[#25D366]" /> Watch 60-sec Demo
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="hero-reveal hero-reveal-delay-3 mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-4 w-4 text-[#25D366]" /> No Coding Required</span>
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-4 w-4 text-[#25D366]" /> Setup in 1 Day</span>
            <span className="flex items-center gap-1.5 text-[#075E54] dark:text-[#25D366]"><Check className="h-4 w-4 text-[#25D366]" /> Official WhatsApp Cloud API</span>
          </motion.div>
        </div>

        {/* Embedded Video Feature Frame */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.45, ease: "easeOut" }}
          className="hero-reveal hero-reveal-dashboard relative mx-auto mt-16 max-w-4xl"
        >
          <div className="absolute -inset-10 -z-10 rounded-3xl bg-gradient-to-r from-[#075E54]/20 via-[#25D366]/20 to-[#075E54]/20 blur-3xl"></div>
          <div className="aspect-video overflow-hidden rounded-3xl border border-[#25D366]/30 shadow-[0_25px_60px_rgba(37,211,102,0.18)] bg-zinc-950 p-2 sm:p-3 relative">
            <div className="absolute top-4 left-5 z-20 flex items-center gap-2 pointer-events-none">
              <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
              <span className="h-3 w-3 rounded-full bg-amber-500/80"></span>
              <span className="h-3 w-3 rounded-full bg-emerald-500/80"></span>
              <span className="ml-2 text-[10px] font-mono text-zinc-400">helpa-whatsapp-ai-preview.mp4</span>
            </div>
            <iframe
              className="w-full h-full rounded-2xl pt-6 sm:pt-4"
              src={heroVideoUrl}
              title="Helpa Demo Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </motion.div>
      </section>

      {/* ═══════ TRUSTED BY ═══════ */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.4 }}
        className="border-y border-border/80 bg-muted/30 py-12 transition-colors duration-300"
      >
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by service businesses across India
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-6">
          <div className="rounded-full border border-border/80 bg-card/60 backdrop-blur-md px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:border-[#25D366]/40 transition-colors">Clinics & Labs</div>
          <div className="rounded-full border border-border/80 bg-card/60 backdrop-blur-md px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:border-[#25D366]/40 transition-colors">Coaching Classes</div>
          <div className="rounded-full border border-border/80 bg-card/60 backdrop-blur-md px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:border-[#25D366]/40 transition-colors">Salons & Spas</div>
          <div className="rounded-full border border-border/80 bg-card/60 backdrop-blur-md px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:border-[#25D366]/40 transition-colors">Boutique Hotels</div>
          <div className="rounded-full border border-border/80 bg-card/60 backdrop-blur-md px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:border-[#25D366]/40 transition-colors">Real Estate Agents</div>
        </div>
      </motion.section>

      {/* ═══════ AFTER HERO: WHY HELPA BENTO GRID ═══════ */}
      <section id="why-helpa" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24 relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Why Businesses Choose Helpa</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed font-medium">Streamline your patient, student, or client inquiries without the overhead of additional staff.</p>
        </motion.div>
        
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Never Miss Leads</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Every enquiry gets answered instantly.</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">24/7 Receptionist</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Customers receive replies even outside business hours.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Book Appointments Automatically</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Reduce receptionist workload completely.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="group bento-card-glow rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-200"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Capture Every Customer</h3>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed font-medium">Every lead is structured & stored inside CRM.</p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ ROI SECTION ═══════ */}
      <section id="roi" className="border-y border-border bg-muted/30 py-28 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
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
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-sm bento-card-glow transition-all duration-300"
            >
              <h3 className="text-xl font-extrabold text-red-500 flex items-center gap-2 mb-6">
                Without Helpa
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Missed enquiries after work hours
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Slow replies during busy rush times
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold text-base">❌</span> Busy receptionist answering same basic queries
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
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border-2 border-[#25D366] bg-card p-8 shadow-2xl shadow-[#25D366]/15 relative bento-card-glow transition-all duration-300"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-4 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Recommended</span>
              <h3 className="text-xl font-extrabold text-[#075E54] dark:text-[#25D366] flex items-center gap-2 mb-6">
                With Helpa
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Instant replies to queries 24/7/365
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Every single lead captured and stored inside your CRM
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Bookings automated without picking up a call
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-bold">
                  <span className="text-[#25D366] font-extrabold text-base">✅</span> Staff only handles complex or custom operations
                </li>
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-center mt-12 max-w-md mx-auto"
          >
            <p className="text-sm font-bold text-muted-foreground">
              Just one missed customer each day can cost more than Helpa's monthly subscription.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ PRODUCT VIDEO SECTION ═══════ */}
      <section id="product-video" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Watch Helpa In Action</h2>
          <p className="mt-3 text-muted-foreground font-medium">See how instantly Helpa responds, gathers info, and schedules customers.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
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

      {/* ═══════ FEATURES BENTO GRID ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
            viewport={{ once: true, margin: "-15px" }}
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
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.0 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">1</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">Connect WhatsApp Number</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">2</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">Upload Business Details</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">3</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">AI Starts Answering Chats</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-base font-black text-white md:mx-0 shadow-lg shadow-[#25D366]/30 border-4 border-background">4</div>
              <h3 className="text-center text-base font-extrabold text-foreground md:text-left">Monitor from CRM Panel</h3>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Built for Every Service Business</h2>
          <p className="mt-4 text-muted-foreground font-medium">Whether you operate one clinic or fifty coaching branches — Helpa handles the volume.</p>
        </motion.div>
        
        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Stethoscope className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Clinics & Hospitals</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><GraduationCap className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Coaching Institutes</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><School className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Schools & Colleges</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Scissors className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Salons & Spas</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Hotel className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Hotels & Guest Houses</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><UtensilsCrossed className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Restaurants & Cafes</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Building2 className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Real Estate Consultants</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Store className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Local Service Shops</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Smile className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Dentists</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Scale className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Law Firms</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Dumbbell className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Fitness Centers</span>
          </div>

          <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm bento-card-glow transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/20"><Wrench className="h-6 w-6" /></div>
            <span className="text-sm font-bold text-foreground">Repair Shops</span>
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD SHOWCASE ═══════ */}
      <section className="border-y border-border bg-muted/30 py-28 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">One dashboard. Total visibility.</h2>
            <p className="mt-4 text-muted-foreground font-medium">Manage conversations, schedule bookings, and track analytics — all in one place.</p>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-2">
            <button onClick={() => setActiveTab("conversations")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'conversations' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Inbox className="h-4 w-4" /> Conversations</button>
            <button onClick={() => setActiveTab("knowledge")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'knowledge' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><BookOpen className="h-4 w-4" /> AI Knowledge Base</button>
            <button onClick={() => setActiveTab("contacts")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'contacts' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Users2 className="h-4 w-4" /> Contacts</button>
            <button onClick={() => setActiveTab("bookings")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'bookings' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><CalendarCheck className="h-4 w-4" /> Bookings</button>
            <button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'analytics' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><LineChart className="h-4 w-4" /> Analytics</button>
            <button onClick={() => setActiveTab("broadcast")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'broadcast' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Send className="h-4 w-4" /> Broadcasts</button>
            <button onClick={() => setActiveTab("settings")} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition cursor-pointer ${activeTab === 'settings' ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Settings className="h-4 w-4" /> Settings</button>
          </div>

          <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-3xl border border-[#075E54]/25 bg-card shadow-2xl text-left transition-colors duration-300 relative">
            
            {/* Floating indicator labels */}
            <div className="absolute top-4 right-4 z-20 flex flex-wrap gap-2 pointer-events-none">
              <span className="rounded-full bg-[#25D366]/15 backdrop-blur-md border border-[#25D366]/30 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#075E54] dark:text-[#25D366] animate-pulse">AI Replies Active</span>
              <span className="rounded-full bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-400 animate-pulse">Auto-Bookings</span>
            </div>

            {activeTab === 'conversations' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Total Chats</p><p className="mt-1 text-3xl font-black text-foreground">12,847</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+34% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Bookings</p><p className="mt-1 text-3xl font-black text-foreground">3,291</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">AI Resolution Rate</p><p className="mt-1 text-3xl font-black text-foreground">96.4%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Excellent</p></div>
              </div>
            )}
            {activeTab === 'knowledge' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Documents Trained</p><p className="mt-1 text-3xl font-black text-foreground">47</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+6 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">FAQs Learned</p><p className="mt-1 text-3xl font-black text-foreground">312</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">Auto-updated</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Answer Accuracy</p><p className="mt-1 text-3xl font-black text-foreground">98.2%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Verified</p></div>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Total Contacts</p><p className="mt-1 text-3xl font-black text-foreground">8,291</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+143 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">New Enquiries</p><p className="mt-1 text-3xl font-black text-foreground">621</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">Auto-captured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Repeat Customers</p><p className="mt-1 text-3xl font-black text-foreground">2,004</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+9% this month</p></div>
              </div>
            )}
            {activeTab === 'bookings' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">This Month</p><p className="mt-1 text-3xl font-black text-foreground">3,291</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Upcoming Today</p><p className="mt-1 text-3xl font-black text-foreground">29</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">Live</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">No-shows</p><p className="mt-1 text-3xl font-black text-foreground">4</p><p className="mt-1.5 text-xs text-amber-500 font-bold">Auto follow-up sent</p></div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Resolution Rate</p><p className="mt-1 text-3xl font-black text-foreground">96.4%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Excellent</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Avg Response Time</p><p className="mt-1 text-3xl font-black text-foreground">1.2s</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Instant</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">CSAT Score</p><p className="mt-1 text-3xl font-black text-foreground">4.8 / 5</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+0.2 this month</p></div>
              </div>
            )}
            {activeTab === 'broadcast' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Messages Sent</p><p className="mt-1 text-3xl font-black text-foreground">24,100</p><p className="mt-1.5 text-xs text-muted-foreground font-medium">This month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Open Rate</p><p className="mt-1 text-3xl font-black text-foreground">91%</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">Above average</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Conversions</p><p className="mt-1 text-3xl font-black text-foreground">1,840</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">+22% this month</p></div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid gap-4 p-8 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Active Numbers</p><p className="mt-1 text-3xl font-black text-foreground">3</p><p className="mt-1.5 text-xs text-[#25D366] font-bold">All connected</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Team Members</p><p className="mt-1 text-3xl font-black text-foreground">12</p><p className="mt-1.5 text-muted-foreground font-medium">Roles configured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-5"><p className="text-xs text-muted-foreground font-semibold">Integrations</p><p className="mt-1 text-3xl font-black text-foreground">7</p><p className="mt-1.5 text-[#25D366] font-bold">All synced</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground font-sans">Early Beta Feedback</h2>
          <p className="mt-4 text-muted-foreground font-medium">Real feedback from early trial users across India.</p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3 text-left">
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-7 shadow-sm bento-card-glow transition duration-200">
            <p className="text-sm text-foreground font-medium leading-relaxed">"Helpa has significantly reduced our front desk call volume. Customers love getting instant answers to our treatment fees and booking details directly on WhatsApp."</p>
            <p className="mt-6 text-xs font-bold text-[#075E54] dark:text-[#25D366]">Clinic Partner · Mumbai</p>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-7 shadow-sm bento-card-glow transition duration-200">
            <p className="text-sm text-foreground font-medium leading-relaxed">"The automated appointment scheduling and course enquiry flow worked flawlessly during our testing phase. It handles multiple parents simultaneously."</p>
            <p className="mt-6 text-xs font-bold text-[#075E54] dark:text-[#25D366]">Coaching Institute Admin · Bangalore</p>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-7 shadow-sm bento-card-glow transition duration-200">
            <p className="text-sm text-foreground font-medium leading-relaxed">"A complete game-changer for businesses that handle high volumes of customer enquiries daily. The CRM sync has made it impossible to lose contacts."</p>
            <p className="mt-6 text-xs font-bold text-[#075E54] dark:text-[#25D366]">Service Agency Partner · Delhi</p>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ($100B SAAS CARDS) ═══════ */}
      <section id="pricing" className="border-t border-border bg-muted/30 py-28 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
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
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm bento-card-glow transition duration-200"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">Perfect for small businesses</span>
              <h3 className="text-2xl font-black text-foreground">Starter</h3>
              <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">Setup Fee: ₹9,999 (One Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹2,999</span>
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
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full border border-border bg-card px-6 py-3.5 text-center text-sm font-extrabold text-foreground hover:bg-accent transition shadow-sm">
                Book Demo
              </Link>
            </motion.div>
            
            {/* Growth Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="flex flex-col rounded-3xl border-2 border-[#25D366] bg-card p-8 shadow-2xl shadow-[#25D366]/15 relative bento-card-glow transition duration-200"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-4 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Most Popular</span>
              <span className="text-xs font-bold uppercase text-[#075E54] dark:text-[#25D366] tracking-wider block mb-2 mt-2">Scale your operations</span>
              <h3 className="text-2xl font-black text-foreground">Growth</h3>
              <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">Setup Fee: ₹19,999</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹5,999</span>
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
              <a href="mailto:hello@helpa.studio" className="mt-8 rounded-full bg-[#25D366] hover:bg-[#075E54] px-6 py-3.5 text-center text-sm font-extrabold text-white transition-all duration-200 shadow-xl shadow-[#25D366]/25">
                Book Free Consultation
              </a>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
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

          {/* Policy note */}
          <div className="text-center mt-8 max-w-lg mx-auto">
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              "Each plan includes generous AI usage. If your business exceeds the included usage, additional AI credits are billed separately."
            </p>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-28 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
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
              <span className="font-extrabold text-foreground group-hover:text-[#25D366] transition-colors">How is the billing calculated?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 4 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 4 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-5 rounded-2xl animate-in fade-in duration-200 border border-border/60 leading-relaxed font-medium">
                Pricing is based on monthly conversation volume and the features you need. There are no hidden per-message fees, and usage is always visible from your dashboard.
              </div>
            )}
          </div>

          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 5 ? null : 5)} className="flex w-full items-center justify-between text-left cursor-pointer group">
              <span className="font-extrabold text-foreground group-hover:text-[#25D366] transition-colors">How long does it take to go live?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 5 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 5 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-5 rounded-2xl animate-in fade-in duration-200 border border-border/60 leading-relaxed font-medium">
                Most Indian businesses set up Helpa and go live in less than 24 hours. Just sign up, connect your WhatsApp channel, paste your business FAQs, and Helpa starts responding to customer chats immediately.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CONVERSION CTA BANNER ($100B STARTUP DESIGN) ═══════ */}
      <section id="demo" className="px-6 py-28">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#075E54]/40 bg-gradient-to-br from-[#075E54] via-[#075E54]/95 to-slate-950 p-12 sm:p-20 text-center shadow-2xl text-white">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#25D366]/20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#075E54]/40 blur-3xl pointer-events-none"></div>
          
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl text-white font-sans leading-tight">
            Ready to Stop Missing Customers?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-emerald-100/90 text-base leading-relaxed font-medium">
            See Helpa working with your own business in a live 15-minute demo.
          </p>
          
          <Link href={user ? "/dashboard" : "/signup"} className="mt-9 inline-flex items-center gap-2.5 rounded-full bg-[#25D366] hover:bg-white hover:text-[#075E54] px-10 py-4 text-base font-extrabold text-white transition-all duration-200 shadow-2xl shadow-[#25D366]/30 hover:scale-105 active:scale-95">
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
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#industries" className="hover:text-[#25D366] transition-colors">Industries</a>
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
