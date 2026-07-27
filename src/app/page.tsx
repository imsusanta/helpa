"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  Sparkles
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
      
      {/* WhatsApp Brand Ambient Glow Blobs (#075E54 & #25D366) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[2%] left-[-10%] w-[50%] h-[45%] rounded-full bg-[#25D366]/10 dark:bg-[#25D366]/[0.06] blur-[140px] animate-pulse-slow" />
        <div className="absolute top-[25%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#075E54]/15 dark:bg-[#075E54]/[0.08] blur-[140px] animate-pulse-slow" style={{ animationDelay: "2.5s" }} />
        <div className="absolute top-[55%] left-[-10%] w-[45%] h-[45%] rounded-full bg-[#25D366]/10 dark:bg-[#25D366]/[0.06] blur-[140px] animate-pulse-slow" style={{ animationDelay: "5s" }} />
        <div className="absolute bottom-[5%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#075E54]/15 dark:bg-[#075E54]/[0.08] blur-[140px] animate-pulse-slow" style={{ animationDelay: "7.5s" }} />
      </div>
      
      {/* Custom Styles for Animations & Selection */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes float-badge {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.04); }
        }
        .animate-float-badge {
          animation: float-badge 6s ease-in-out infinite;
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

      {/* ═══════ WHATSAPP BRAND FLOATING CAPSULE NAVBAR ═══════ */}
      <header className="fixed top-4 left-0 right-0 z-50 px-4 transition-all duration-300">
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
            <a href="#why-helpa" className="transition-colors hover:text-[#25D366]">Why Helpa</a>
            <a href="#roi" className="transition-colors hover:text-[#25D366]">ROI</a>
            <a href="#features" className="transition-colors hover:text-[#25D366]">Features</a>
            <a href="#industries" className="transition-colors hover:text-[#25D366]">Industries</a>
            <a href="#pricing" className="transition-colors hover:text-[#25D366]">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-[#25D366]">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleMode}
              className="p-2 rounded-full border border-[#075E54]/20 bg-[#075E54]/10 hover:bg-[#25D366]/20 text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-[#25D366]" /> : <Moon className="h-4 w-4 text-[#075E54]" />}
            </button>

            <Link href={user ? "/dashboard" : "/signup"} className="hidden rounded-full bg-[#25D366] hover:bg-[#075E54] px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 shadow-md shadow-[#25D366]/25 hover:shadow-[#075E54]/30 hover:scale-[1.03] active:scale-[0.97] sm:inline-block">
              {user ? "Dashboard" : "Book Demo"}
            </Link>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center justify-center rounded-full border border border-[#075E54]/20 p-2 md:hidden text-foreground bg-card hover:bg-accent transition-colors cursor-pointer" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5 text-[#25D366]" /> : <Menu className="h-5 w-5 text-[#075E54]" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Floating Drawer */}
        {mobileMenuOpen && (
          <div className="mx-auto max-w-6xl mt-3 rounded-3xl border border-[#075E54]/30 md:hidden bg-background/95 dark:bg-slate-950/95 backdrop-blur-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-2 px-2 py-1">
              <a href="#why-helpa" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Why Helpa</a>
              <a href="#roi" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">ROI</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Industries</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] font-semibold transition-colors">FAQ</a>
              <Link href={user ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)} className="mt-3 rounded-full bg-[#25D366] hover:bg-[#075E54] px-5 py-3 text-center text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition-all">
                {user ? "Dashboard" : "Book Demo"}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden px-6 pb-24 pt-32 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(37,211,102,0.18),transparent)]"></div>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="hero-reveal mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366] shadow-sm transition-colors duration-300"
          >
            <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse"></span>
            ✓ Official WhatsApp AI Partner • Setup in 24 Hours
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-1 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl text-foreground font-sans leading-[1.1]"
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
            className="hero-reveal hero-reveal-delay-2 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed"
          >
            Helpa answers every WhatsApp enquiry instantly, books appointments automatically, captures leads, and works 24/7—so your team can focus on running the business.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="hero-reveal hero-reveal-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href={user ? "/dashboard" : "/signup"} className="flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#075E54] px-8 py-4 text-sm font-extrabold text-white transition-all duration-200 shadow-xl shadow-[#25D366]/25 hover:shadow-[#075E54]/30 hover:scale-[1.03] active:scale-[0.97]">
              Book Free Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#product-video" className="flex items-center gap-2 rounded-full border border-border bg-card px-7 py-4 text-sm font-bold text-foreground transition-all hover:bg-accent shadow-sm hover:scale-[1.03] active:scale-[0.97] duration-200">
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

        {/* Embedded YouTube video preview */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
          className="hero-reveal hero-reveal-dashboard relative mx-auto mt-16 max-w-4xl"
        >
          <div className="absolute -inset-10 -z-10 rounded-3xl bg-[#25D366]/10 blur-3xl"></div>
          <div className="aspect-video overflow-hidden rounded-2xl border border-[#075E54]/20 shadow-2xl bg-zinc-950">
            <iframe
              className="w-full h-full"
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
        className="border-y border-border bg-muted/30 py-12 transition-colors duration-300"
      >
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by service businesses across India
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-6">
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors">Clinics & Labs</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors">Coaching Classes</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors">Salons & Spas</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors">Boutique Hotels</div>
          <div className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors">Real Estate Agents</div>
        </div>
      </motion.section>

      {/* ═══════ AFTER HERO: WHY HELPA ═══════ */}
      <section id="why-helpa" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-24 relative">
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
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Never Miss Leads</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every enquiry gets answered.</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">24/7 Receptionist</h3>
            <p className="mt-2 text-sm text-muted-foreground">Customers receive replies even outside business hours.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Book Appointments Automatically</h3>
            <p className="mt-2 text-sm text-muted-foreground">Reduce receptionist workload.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]">
              <UserPlus className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base">Capture Every Customer</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every lead is stored inside CRM.</p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ ROI SECTION ═══════ */}
      <section id="roi" className="border-y border-border bg-muted/30 py-24 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Helpa Pays For Itself.</h2>
            <p className="mt-4 text-muted-foreground">Compare the difference in efficiency, response times, and booked revenue.</p>
          </motion.div>

          <div className="mt-14 grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Without Helpa */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-sm hover-card-lift transition-all duration-300"
            >
              <h3 className="text-lg font-bold text-red-500 flex items-center gap-2 mb-6">
                Without Helpa
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold">❌</span> Missed enquiries after work hours
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold">❌</span> Slow replies during busy rush times
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold">❌</span> Busy receptionist answering same basic queries
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                  <span className="text-red-500 font-bold">❌</span> Lost bookings because patients/clients got tired of waiting
                </li>
              </ul>
            </motion.div>

            {/* With Helpa */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border-2 border-[#25D366] bg-card p-8 shadow-xl shadow-[#25D366]/10 relative hover-card-lift transition-all duration-300"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-3.5 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Recommended</span>
              <h3 className="text-lg font-bold text-[#075E54] dark:text-[#25D366] flex items-center gap-2 mb-6">
                With Helpa
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-foreground font-semibold">
                  <span className="text-[#25D366] font-bold">✅</span> Instant replies to queries 24/7/365
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-semibold">
                  <span className="text-[#25D366] font-bold">✅</span> Every single lead captured and stored inside your CRM
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-semibold">
                  <span className="text-[#25D366] font-bold">✅</span> Bookings automated without picking up a call
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground font-semibold">
                  <span className="text-[#25D366] font-bold">✅</span> Staff only handles complex or custom operations
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
            <p className="text-sm font-semibold text-muted-foreground">
              Just one missed customer each day can cost more than Helpa's monthly subscription.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ PRODUCT VIDEO SECTION ═══════ */}
      <section id="product-video" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Watch Helpa In Action</h2>
          <p className="mt-3 text-muted-foreground">See how instantly Helpa responds, gathers info, and schedules customers.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="aspect-video max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-[#075E54]/20 bg-zinc-950 transition-all duration-300"
        >
          <iframe
            className="w-full h-full"
            src={actionVideoUrl}
            title="Helpa Walkthrough Video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </motion.div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Everything your WhatsApp reception needs</h2>
          <p className="mt-4 text-muted-foreground">Built specifically for customer-facing businesses that live on WhatsApp.</p>
        </motion.div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.0 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Zap className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Reply to Every Customer in Under 3 Seconds</h3>
            <p className="mt-2 text-sm text-muted-foreground">Every customer enquiry gets an accurate, on-brand reply in seconds — 24/7, without fail.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><CalendarCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Book Appointments Automatically</h3>
            <p className="mt-2 text-sm text-muted-foreground">Clients can book, reschedule, or cancel slots directly inside WhatsApp, synced to your calendar.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><UserPlus className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Capture Leads & Enquiries Automatically</h3>
            <p className="mt-2 text-sm text-muted-foreground">Names, phone numbers, and requirements are structured and saved from every chat conversation.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.0 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><HelpCircle className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Automate Answers to Frequent Questions</h3>
            <p className="mt-2 text-sm text-muted-foreground">Train Helpa once on your fees, timings, and business location — it replies instantly without getting tired.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><UserCheck className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Hand Off to Live Staff Instantly</h3>
            <p className="mt-2 text-sm text-muted-foreground">Complex or VIP chats route to your support team instantly, with the complete history attached.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Globe2 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Speak Any Local Language Fluently</h3>
            <p className="mt-2 text-sm text-muted-foreground">Helpa automatically detects if the user is texting in English, Hindi, or Bengali, and replies back in the same language.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.0 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><BarChart3 className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Gain Clear Performance Analytics</h3>
            <p className="mt-2 text-sm text-muted-foreground">Monitor response speed, chat resolution rate, bookings, and customer inquiries in one clean panel.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Radio className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Broadcast Festival & Promotional Offers</h3>
            <p className="mt-2 text-sm text-muted-foreground">Send festival offers, reminders, and service updates to filtered customer lists with a single click.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift hover:border-[#25D366]/50 hover:shadow-md transition-all duration-200"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><RefreshCw className="h-5 w-5" /></div>
            <h3 className="font-semibold text-foreground text-base">Trigger Smart Automatic Follow-ups</h3>
            <p className="mt-2 text-sm text-muted-foreground">Remind clients of upcoming appointments or follow-up with cold leads automatically.</p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="border-y border-border bg-muted/30 py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Go Live in Less Than 24 Hours</h2>
            <p className="mt-4 text-muted-foreground">No coding or developers required. Connect, train, and go live.</p>
          </motion.div>
          <div className="relative mt-16 grid gap-8 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-border md:block"></div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.0 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-sm font-extrabold text-white md:mx-0 shadow-md shadow-[#25D366]/30">1</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">Connect WhatsApp Number</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-sm font-extrabold text-white md:mx-0 shadow-md shadow-[#25D366]/30">2</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">Upload Business Details</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-sm font-extrabold text-white md:mx-0 shadow-md shadow-[#25D366]/30">3</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">AI Starts Answering Chats</h3>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="relative"
            >
              <div className="relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-sm font-extrabold text-white md:mx-0 shadow-md shadow-[#25D366]/30">4</div>
              <h3 className="text-center text-base font-semibold text-foreground md:text-left">Monitor from CRM Panel</h3>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ INDUSTRIES ═══════ */}
      <section id="industries" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Built for Every Service Business</h2>
          <p className="mt-4 text-muted-foreground">Whether you operate one clinic or fifty coaching branches — Helpa handles the volume.</p>
        </motion.div>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Stethoscope className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Clinics & Hospitals</span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><GraduationCap className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Coaching Institutes</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><School className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Schools & Colleges</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Scissors className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Salons & Spas</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Hotel className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Hotels & Guest Houses</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><UtensilsCrossed className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Restaurants & Cafes</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.0 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Building2 className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Real Estate Consultants</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Store className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Local Service Shops</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Smile className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Dentists</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Scale className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Law Firms</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Dumbbell className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Fitness Centers</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm hover:border-[#25D366]/50 transition duration-300 col-span-2 sm:col-span-1 lg:col-span-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366]"><Wrench className="h-5 w-5" /></div>
            <span className="text-sm font-semibold text-foreground">Repair Shops</span>
          </motion.div>
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
            <button onClick={() => setActiveTab("conversations")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'conversations' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Inbox className="h-3.5 w-3.5" /> Conversations</button>
            <button onClick={() => setActiveTab("knowledge")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'knowledge' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><BookOpen className="h-3.5 w-3.5" /> AI Knowledge Base</button>
            <button onClick={() => setActiveTab("contacts")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'contacts' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Users2 className="h-3.5 w-3.5" /> Contacts</button>
            <button onClick={() => setActiveTab("bookings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'bookings' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><CalendarCheck className="h-3.5 w-3.5" /> Bookings</button>
            <button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'analytics' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><LineChart className="h-3.5 w-3.5" /> Analytics</button>
            <button onClick={() => setActiveTab("broadcast")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'broadcast' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Send className="h-3.5 w-3.5" /> Broadcasts</button>
            <button onClick={() => setActiveTab("settings")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${activeTab === 'settings' ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20' : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}><Settings className="h-3.5 w-3.5" /> Settings</button>
          </div>

          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-[#075E54]/20 bg-card shadow-2xl text-left transition-colors duration-300 relative">
            
            {/* Floating indicator labels pointing to features */}
            <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-1.5 pointer-events-none">
              <span className="rounded-full bg-[#25D366]/10 backdrop-blur-md border border-[#25D366]/30 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#075E54] dark:text-[#25D366] animate-pulse">AI Replies</span>
              <span className="rounded-full bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-500 animate-pulse">Bookings</span>
              <span className="rounded-full bg-blue-500/10 backdrop-blur-md border border-blue-500/20 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-blue-500 animate-pulse">CRM</span>
            </div>

            {activeTab === 'conversations' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Total Chats</p><p className="mt-1 text-2xl font-bold text-foreground">12,847</p><p className="mt-1 text-xs text-[#25D366] font-bold">+34% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Bookings</p><p className="mt-1 text-2xl font-bold text-foreground">3,291</p><p className="mt-1 text-xs text-[#25D366] font-bold">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">AI Resolution Rate</p><p className="mt-1 text-2xl font-bold text-foreground">96.4%</p><p className="mt-1 text-xs text-[#25D366] font-bold">Excellent</p></div>
              </div>
            )}
            {activeTab === 'knowledge' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Documents Trained</p><p className="mt-1 text-2xl font-bold text-foreground">47</p><p className="mt-1 text-xs text-[#25D366] font-bold">+6 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">FAQs Learned</p><p className="mt-1 text-2xl font-bold text-foreground">312</p><p className="mt-1 text-xs text-muted-foreground font-medium">Auto-updated</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Answer Accuracy</p><p className="mt-1 text-2xl font-bold text-foreground">98.2%</p><p className="mt-1 text-xs text-[#25D366] font-bold">Verified</p></div>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Total Contacts</p><p className="mt-1 text-2xl font-bold text-foreground">8,291</p><p className="mt-1 text-xs text-[#25D366] font-bold">+143 this week</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">New Enquiries</p><p className="mt-1 text-2xl font-bold text-foreground">621</p><p className="mt-1 text-xs text-muted-foreground font-medium">Auto-captured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Repeat Customers</p><p className="mt-1 text-2xl font-bold text-foreground">2,004</p><p className="mt-1 text-xs text-[#25D366] font-bold">+9% this month</p></div>
              </div>
            )}
            {activeTab === 'bookings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">This Month</p><p className="mt-1 text-2xl font-bold text-foreground">3,291</p><p className="mt-1 text-xs text-[#25D366] font-bold">+18% this month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Upcoming Today</p><p className="mt-1 text-2xl font-bold text-foreground">29</p><p className="mt-1 text-xs text-muted-foreground font-medium">Live</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">No-shows</p><p className="mt-1 text-2xl font-bold text-foreground">4</p><p className="mt-1 text-xs text-amber-600 font-medium">Auto follow-up sent</p></div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Resolution Rate</p><p className="mt-1 text-2xl font-bold text-foreground">96.4%</p><p className="mt-1 text-xs text-[#25D366] font-bold">Excellent</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Avg Response Time</p><p className="mt-1 text-2xl font-bold text-foreground">1.2s</p><p className="mt-1 text-xs text-[#25D366] font-bold">Instant</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">CSAT Score</p><p className="mt-1 text-2xl font-bold text-foreground">4.8 / 5</p><p className="mt-1 text-xs text-[#25D366] font-bold">+0.2 this month</p></div>
              </div>
            )}
            {activeTab === 'broadcast' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Messages Sent</p><p className="mt-1 text-2xl font-bold text-foreground">24,100</p><p className="mt-1 text-xs text-muted-foreground font-medium">This month</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Open Rate</p><p className="mt-1 text-2xl font-bold text-foreground">91%</p><p className="mt-1 text-xs text-[#25D366] font-bold">Above average</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Conversions</p><p className="mt-1 text-2xl font-bold text-foreground">1,840</p><p className="mt-1 text-xs text-[#25D366] font-bold">+22% this month</p></div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid gap-4 p-6 md:grid-cols-3 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Active Numbers</p><p className="mt-1 text-2xl font-bold text-foreground">3</p><p className="mt-1 text-xs text-[#25D366] font-bold">All connected</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Team Members</p><p className="mt-1 text-2xl font-bold text-foreground">12</p><p className="mt-1 text-muted-foreground font-medium">Roles configured</p></div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs text-muted-foreground font-semibold">Integrations</p><p className="mt-1 text-2xl font-bold text-foreground">7</p><p className="mt-1 text-[#25D366] font-bold">All synced</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground font-sans">Early Beta Feedback</h2>
          <p className="mt-4 text-muted-foreground">Real feedback from early trial users across India.</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3 text-left">
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift transition duration-200">
            <p className="text-sm text-foreground font-medium leading-relaxed">"Helpa has significantly reduced our front desk call volume. Customers love getting instant answers to our treatment fees and booking details directly on WhatsApp."</p>
            <p className="mt-6 text-xs font-bold text-[#075E54] dark:text-[#25D366]">Clinic Partner · Mumbai</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift transition duration-200">
            <p className="text-sm text-foreground font-medium leading-relaxed">"The automated appointment scheduling and course enquiry flow worked flawlessly during our testing phase. It handles multiple parents simultaneously."</p>
            <p className="mt-6 text-xs font-bold text-[#075E54] dark:text-[#25D366]">Coaching Institute Admin · Bangalore</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover-card-lift transition duration-200">
            <p className="text-sm text-foreground font-medium leading-relaxed">"A complete game-changer for businesses that handle high volumes of customer enquiries daily. The CRM sync has made it impossible to lose contacts."</p>
            <p className="mt-6 text-xs font-bold text-[#075E54] dark:text-[#25D366]">Service Agency Partner · Delhi</p>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="border-t border-border bg-muted/30 py-24 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15px" }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">Simple pricing that grows with your business</h2>
            <p className="mt-4 text-muted-foreground">Every plan includes onboarding, AI training, WhatsApp setup and dedicated support.</p>
          </motion.div>
          
          <div className="mt-14 grid gap-6 md:grid-cols-3 text-left">
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0 }}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm hover-card-lift transition duration-200"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">Perfect for small businesses</span>
              <h3 className="text-xl font-bold text-foreground">Starter</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Setup Fee: ₹9,999 (One Time)</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">₹2,999</span>
                <span className="text-sm text-muted-foreground font-medium">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />1 WhatsApp Business Number</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />AI Receptionist</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Appointment Booking</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />FAQ Automation</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Lead Capture</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Human Takeover</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Dashboard Analytics</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Multilingual AI</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Email Support</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Free Onboarding</li>
              </ul>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-8 rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-bold text-foreground hover:bg-accent transition shadow-sm">
                Book Demo
              </Link>
            </motion.div>
            
            {/* Growth Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="flex flex-col rounded-2xl border-2 border-[#25D366] bg-card p-7 shadow-xl shadow-[#25D366]/10 relative hover-card-lift transition duration-200"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-3.5 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider shadow-md shadow-[#25D366]/30">Most Popular</span>
              <span className="text-xs font-bold uppercase text-[#075E54] dark:text-[#25D366] tracking-wider block mb-2 mt-2">Scale your operations</span>
              <h3 className="text-xl font-bold text-foreground">Growth</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Setup Fee: ₹19,999</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">₹5,999</span>
                <span className="text-sm text-muted-foreground font-medium">/month</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="text-xs font-bold text-foreground tracking-wider uppercase mb-1">Everything in Starter plus</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Up to 3 WhatsApp Numbers</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Shared Team Inbox</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />CRM Integration</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Broadcast Campaigns</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Automated Follow-ups</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Priority Support</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Multiple Staff Members</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Advanced Analytics</li>
              </ul>
              <a href="mailto:hello@helpa.studio" className="mt-8 rounded-full bg-[#25D366] hover:bg-[#075E54] px-5 py-3 text-center text-sm font-bold text-white transition-all shadow-md shadow-[#25D366]/20">
                Book Free Consultation
              </a>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15px" }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm hover-card-lift transition duration-200"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">For high-volume operations</span>
              <h3 className="text-xl font-bold text-foreground">Enterprise</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Built for hospitals, franchises and high-volume businesses.</p>
              
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">Custom</span>
              </div>
              
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/40 pt-6">
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Unlimited Numbers</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Custom AI Training</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />API Access</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Custom Integrations</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />Dedicated Account Manager</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />SLA</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />On-premise Deployment (Optional)</li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#25D366]" />White Label</li>
              </ul>
              <a href="mailto:sales@helpa.studio" className="mt-8 rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-bold text-foreground hover:bg-accent transition shadow-sm">Contact Sales</a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15px" }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Frequently asked questions</h2>
        </motion.div>
        <div className="mt-12 divide-y divide-border text-left">
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 1 ? null : 1)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">How does Helpa connect to our WhatsApp number?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 1 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 1 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-4 rounded-xl animate-in fade-in duration-200 border border-border/50">
                Helpa connects directly using the official Meta WhatsApp Business Cloud API. You can continue using your existing business number — no SIM card changes or data migrations required. Setup takes only a few minutes.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 2 ? null : 2)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">How accurate are the AI assistant's replies?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 2 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 2 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-4 rounded-xl animate-in fade-in duration-200 border border-border/50">
                Helpa strictly answers based on the knowledge documents, FAQs, timings, and pricing list you upload. It never makes up or guesses details. If a customer asks something outside the scope, Helpa quietly flags it for human staff takeover.
              </div>
            )}
          </div>
          <div className="py-5">
            <button onClick={() => setActiveFaq(activeFaq === 3 ? null : 3)} className="flex w-full items-center justify-between text-left cursor-pointer">
              <span className="font-semibold text-foreground">Can our staff step in and text the customer?</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ${activeFaq === 3 ? 'rotate-180 text-[#25D366]' : ''}`} />
            </button>
            {activeFaq === 3 && (
              <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-4 rounded-xl animate-in fade-in duration-200 border border-border/50">
                Yes, absolutely. A human takeover is built into Helpa. Your receptionist can click "Takeover" on the CRM dashboard to pause the AI and reply manually on the same thread anytime.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section id="demo" className="px-6 py-24">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[#075E54]/30 bg-gradient-to-br from-[#075E54]/90 via-[#075E54] to-slate-950 p-12 sm:p-16 text-center shadow-2xl text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#25D366]/20 blur-3xl pointer-events-none"></div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white font-sans">Ready to Stop Missing Customers?</h2>
          <p className="mx-auto mt-4 max-w-md text-emerald-100/90 text-base leading-relaxed">See Helpa working with your own business in a live 15-minute demo.</p>
          <Link href={user ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-white hover:text-[#075E54] px-9 py-4 text-base font-extrabold text-white transition-all duration-200 shadow-2xl shadow-[#25D366]/30 hover:scale-105">
            Book My Demo <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border bg-card px-6 py-10 transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm"><MessageSquare className="h-3.5 w-3.5 fill-white" /></div>
            <span className="font-extrabold text-foreground">Helpa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-semibold">
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#industries" className="hover:text-[#25D366] transition-colors">Industries</a>
            <a href="#pricing" className="hover:text-[#25D366] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#25D366] transition-colors">FAQ</a>
            <Link href="/privacy" className="hover:text-[#25D366] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#25D366] transition-colors">Terms of Service</Link>
          </div>
          <p className="text-xs text-muted-foreground font-medium">© {new Date().getFullYear()} Helpa Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
