"use client";

import { useEffect, useState, useRef } from "react";
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
  BadgeCheck,
  Bot,
  MousePointerClick,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   HIGH-CONVERSION LANDING PAGE — HELPA
   Colors: #075E54 (Deep Teal) · #25D366 (Vibrant Green) · #FFFFFF
   Every section is designed to move visitors → Demo Booking
   ════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [heroVideoUrl, setHeroVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");
  const [actionVideoUrl, setActionVideoUrl] = useState("https://www.youtube.com/embed/gFx-NjTw3sM");

  // Animated counter hook
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

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

  // Intersection observer for stats animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const ctaHref = user ? "/dashboard" : "/signup";

  // Simulated WhatsApp chat messages for the hero
  const chatMessages = [
    { from: "customer", text: "Hi, I want to book an appointment for tomorrow evening", time: "7:32 PM" },
    { from: "helpa", text: "Hello! 👋 Welcome to SmileCare Dental Clinic. I'd be happy to help you book an appointment.\n\nDr. Sharma has these slots available tomorrow evening:\n\n🕐 4:00 PM\n🕐 5:30 PM\n🕐 7:00 PM\n\nWhich time works best for you?", time: "7:32 PM" },
    { from: "customer", text: "5:30 PM please", time: "7:33 PM" },
    { from: "helpa", text: "✅ Done! Your appointment is confirmed:\n\n📅 Tomorrow, 5:30 PM\n👨‍⚕️ Dr. Sharma\n📍 SmileCare Dental, MG Road\n\nYou'll receive a reminder 2 hours before. See you there! 😊", time: "7:33 PM" },
  ];

  return (
    <div className="bg-background text-foreground antialiased selection:bg-[#25D366]/30 selection:text-foreground min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">

      {/* Global ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-[10%] w-[60vw] h-[40vw] rounded-full bg-[#25D366]/[0.04] blur-[120px]" />
        <div className="absolute bottom-[20%] right-0 w-[50vw] h-[50vw] rounded-full bg-[#075E54]/[0.04] blur-[120px]" />
      </div>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes typing { 0%{opacity:.2} 50%{opacity:1} 100%{opacity:.2} }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .chat-bubble-enter { animation: chatBubbleIn 0.4s cubic-bezier(.16,1,.3,1) forwards; }
        @keyframes chatBubbleIn { 0%{opacity:0;transform:translateY(12px) scale(.96)} 100%{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      {/* ═══════════ FLOATING NAVBAR ═══════════ */}
      <header className="fixed top-4 left-0 right-0 z-50 px-4">
        <div className={`mx-auto flex max-w-5xl items-center justify-between rounded-2xl px-5 py-3 transition-all duration-300 ${
          scrolled
            ? "bg-background/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-[#075E54]/20 shadow-lg shadow-black/5"
            : "bg-background/80 dark:bg-slate-950/80 backdrop-blur-xl border border-transparent"
        }`}>
          <Link href="#" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#075E54] to-[#25D366] text-white shadow-md shadow-[#25D366]/20 group-hover:shadow-lg group-hover:shadow-[#25D366]/30 transition-shadow">
              <MessageSquare className="h-4.5 w-4.5 fill-white/20" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-foreground">Helpa</span>
          </Link>

          <nav className="hidden items-center gap-1 text-[13px] font-semibold text-muted-foreground md:flex">
            {["How It Works", "Features", "Pricing", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, "-")}`} className="px-3.5 py-2 rounded-lg transition-colors hover:text-foreground hover:bg-accent/60">{item}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button onClick={toggleMode} className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors cursor-pointer" aria-label="Toggle theme">
              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link href={ctaHref} className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#1fb855] px-5 py-2.5 text-[13px] font-bold text-white transition-all shadow-md shadow-[#25D366]/20 hover:shadow-lg hover:shadow-[#25D366]/30 active:scale-[0.97]">
              {user ? "Dashboard" : "Start Free Demo"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-accent/60 md:hidden text-foreground cursor-pointer" aria-label="Menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="mx-auto max-w-5xl mt-2 rounded-2xl border border-border bg-background/95 dark:bg-slate-950/95 backdrop-blur-2xl p-4 shadow-xl md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {["How It Works", "Features", "Pricing", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => setMobileMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">{item}</a>
            ))}
            <Link href={ctaHref} onClick={() => setMobileMenuOpen(false)} className="mt-2 block rounded-xl bg-[#25D366] px-4 py-3 text-center text-sm font-bold text-white">
              {user ? "Dashboard" : "Start Free Demo"}
            </Link>
          </div>
        )}
      </header>

      {/* ═══════════ HERO ═══════════
           Conversion levers: Pain → Solution → Proof → CTA */}
      <section className="relative px-6 pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/25 bg-[#25D366]/8 px-4 py-1.5 text-xs font-bold text-[#075E54] dark:text-[#25D366] mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse" />
                Trusted by 150+ Indian Businesses
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
                className="text-[2.5rem] leading-[1.1] font-black tracking-tight sm:text-5xl lg:text-[3.25rem] text-foreground">
                Your WhatsApp is <span className="text-[#25D366]">losing you ₹50,000+</span> every month.
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
                className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
                Every unanswered WhatsApp message is a customer who went to your competitor. <strong className="text-foreground">Helpa replies in 2 seconds, books appointments, and captures leads — 24/7.</strong>
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={ctaHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1fb855] px-7 py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/30 active:scale-[0.97]">
                  Book Free Demo <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#product-video" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-accent/60 transition-colors">
                  <PlayCircle className="h-4 w-4 text-[#25D366]" /> Watch 60s Demo
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-7 flex items-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-[#25D366]" /> Official WhatsApp API</span>
                <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[#25D366]" /> Live in 24 Hours</span>
                <span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-[#25D366]" /> No Coding</span>
              </motion.div>
            </div>

            {/* Right: Live WhatsApp Chat Simulation */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative mx-auto w-full max-w-sm lg:max-w-md"
            >
              <div className="absolute -inset-8 bg-gradient-to-br from-[#25D366]/15 via-[#075E54]/10 to-transparent rounded-[2rem] blur-2xl -z-10" />
              <div className="rounded-[1.5rem] border border-[#075E54]/20 bg-card shadow-2xl shadow-[#075E54]/10 overflow-hidden">
                {/* WhatsApp Header Bar */}
                <div className="bg-[#075E54] px-4 py-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">SC</div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold leading-tight">SmileCare Dental</p>
                    <p className="text-emerald-200/80 text-[11px] flex items-center gap-1"><Bot className="h-3 w-3" /> Helpa AI · Online</p>
                  </div>
                  <PhoneCall className="h-4.5 w-4.5 text-white/70" />
                </div>

                {/* Chat Body */}
                <div className="bg-[#0b141a] dark:bg-[#0b141a] p-4 space-y-3 min-h-[320px]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
                  {chatMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.35, delay: 0.5 + i * 0.6 }}
                      className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`relative max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-[1.45] shadow-sm ${
                        msg.from === "customer"
                          ? "bg-[#005c4b] text-emerald-50 rounded-tr-sm"
                          : "bg-[#1f2c34] text-gray-200 rounded-tl-sm"
                      }`}>
                        {msg.from === "helpa" && <p className="text-[10px] font-bold text-[#25D366] mb-1 flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Helpa AI</p>}
                        <p className="whitespace-pre-line">{msg.text}</p>
                        <p className={`text-[10px] mt-1 text-right ${msg.from === "customer" ? "text-emerald-300/60" : "text-gray-500"}`}>
                          {msg.time} {msg.from === "customer" && "✓✓"}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2 border-t border-white/5">
                  <div className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-xs text-gray-400">Type a message...</div>
                  <div className="h-8 w-8 rounded-full bg-[#25D366] flex items-center justify-center"><Send className="h-3.5 w-3.5 text-white" /></div>
                </div>
              </div>

              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3, duration: 0.3 }}
                className="absolute -bottom-4 -left-4 sm:-left-8 animate-float"
              >
                <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-3.5 py-2 text-xs font-bold shadow-lg">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]"><Zap className="h-3 w-3" /></span>
                  <span className="text-foreground">Replied in <span className="text-[#25D366]">1.8s</span></span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3.5, duration: 0.3 }}
                className="absolute -top-2 -right-4 sm:-right-8 animate-float" style={{ animationDelay: "2s" }}
              >
                <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-3.5 py-2 text-xs font-bold shadow-lg">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]"><CalendarCheck className="h-3 w-3" /></span>
                  <span className="text-foreground">Booked <span className="text-[#25D366]">automatically</span></span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════ PAIN POINT STRIP — "Is this you?" ═══════════ */}
      <section className="border-y border-border bg-muted/30 py-16 transition-colors duration-300">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-8">Sound familiar?</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Clock className="h-5 w-5" />, text: "Patients call 10 times asking the same thing" },
              { icon: <AlertTriangle className="h-5 w-5" />, text: "Enquiries go unanswered after 7 PM" },
              { icon: <XCircle className="h-5 w-5" />, text: "Staff is too busy to reply on WhatsApp" },
              { icon: <IndianRupee className="h-5 w-5" />, text: "You're losing bookings to faster competitors" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="flex items-start gap-3 rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-4 text-sm text-muted-foreground font-medium"
              >
                <span className="mt-0.5 text-red-400 shrink-0">{item.icon}</span>
                {item.text}
              </motion.div>
            ))}
          </div>
          <p className="text-center mt-8 text-sm font-bold text-foreground">
            Helpa fixes <span className="text-[#25D366]">all four</span> — starting today.
          </p>
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF STATS ═══════════ */}
      <section ref={statsRef} className="py-20 px-6">
        <div className="mx-auto max-w-4xl grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            { value: "150+", label: "Businesses Trust Helpa", color: "text-[#25D366]" },
            { value: "2 sec", label: "Average Reply Time", color: "text-[#25D366]" },
            { value: "98%", label: "AI Accuracy Rate", color: "text-[#25D366]" },
            { value: "24/7", label: "Always Online", color: "text-[#25D366]" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground font-semibold">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="how-it-works" className="border-y border-border bg-muted/30 py-24 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Go live in <span className="text-[#25D366]">3 simple steps</span></h2>
            <p className="mt-3 text-muted-foreground font-medium">No developers. No coding. No complicated setup.</p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Connect Your WhatsApp",
                desc: "Link your business WhatsApp number through Meta's official Cloud API. Takes under 5 minutes.",
                icon: <PhoneCall className="h-6 w-6" />,
              },
              {
                step: "2",
                title: "Train Your AI Assistant",
                desc: "Upload your fees, timings, services, and FAQs. Helpa learns your business instantly — no technical skills needed.",
                icon: <BookOpen className="h-6 w-6" />,
              },
              {
                step: "3",
                title: "Start Receiving Bookings",
                desc: "Helpa handles every incoming enquiry, books appointments, captures leads, and routes complex chats to your staff.",
                icon: <CalendarCheck className="h-6 w-6" />,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.1 }}
                className="relative rounded-2xl border border-border bg-card p-7 text-center shadow-sm group hover:border-[#25D366]/30 hover:shadow-md transition-all duration-300"
              >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/15 group-hover:bg-[#25D366]/15 transition-colors">
                  {item.icon}
                </div>
                <div className="absolute top-5 right-5 flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white text-xs font-black shadow-sm">{item.step}</div>
                <h3 className="text-lg font-extrabold text-foreground">{item.title}</h3>
                <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1fb855] px-7 py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-[#25D366]/20 active:scale-[0.97]">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ PRODUCT VIDEO ═══════════ */}
      <section id="product-video" className="py-24 px-6 scroll-mt-24">
        <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
          className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">See Helpa in action</h2>
          <p className="mt-3 text-muted-foreground font-medium">Watch how a real clinic books appointments automatically through WhatsApp.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="max-w-4xl mx-auto"
        >
          <div className="aspect-video rounded-2xl overflow-hidden border border-[#075E54]/15 shadow-2xl shadow-black/10 bg-black p-1.5 relative">
            <iframe className="w-full h-full rounded-xl" src={heroVideoUrl} title="Helpa Demo" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
        </motion.div>
      </section>

      {/* ═══════════ FEATURES — Benefit-driven ═══════════ */}
      <section id="features" className="border-y border-border bg-muted/30 py-24 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Everything you need to <span className="text-[#25D366]">never miss a customer</span></h2>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Zap className="h-5 w-5" />, title: "Instant AI Replies", desc: "Every enquiry answered in under 3 seconds — pricing, timings, directions, services. No waiting." },
              { icon: <CalendarCheck className="h-5 w-5" />, title: "Auto-Book Appointments", desc: "Patients and clients book, reschedule, or cancel directly inside WhatsApp. Zero phone calls." },
              { icon: <UserPlus className="h-5 w-5" />, title: "Capture Every Lead", desc: "Names, phone numbers, and requirements are auto-captured and saved to your CRM from every chat." },
              { icon: <HelpCircle className="h-5 w-5" />, title: "Smart FAQ Automation", desc: "Train once on your fees, timings, and services. Helpa answers the same 50 questions tirelessly." },
              { icon: <UserCheck className="h-5 w-5" />, title: "Live Staff Handover", desc: "Complex queries? Your team takes over with one click — full chat history included." },
              { icon: <Globe2 className="h-5 w-5" />, title: "Hindi, Bengali, English", desc: "Helpa detects the customer's language and replies naturally in the same language." },
              { icon: <Radio className="h-5 w-5" />, title: "Broadcast Campaigns", desc: "Send festival offers, reminders, and promotions to filtered customer lists with one click." },
              { icon: <RefreshCw className="h-5 w-5" />, title: "Smart Follow-ups", desc: "Automatically remind clients about upcoming appointments or re-engage cold leads." },
              { icon: <BarChart3 className="h-5 w-5" />, title: "Performance Dashboard", desc: "Track response times, bookings, chat volumes, and customer satisfaction in real-time." },
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: (i % 3) * 0.08 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm group hover:border-[#25D366]/25 hover:shadow-md transition-all duration-300"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] border border-[#25D366]/15 group-hover:bg-[#25D366]/15 transition-colors">
                  {feat.icon}
                </div>
                <h3 className="font-bold text-foreground">{feat.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground font-medium leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ROI — Before/After ═══════════ */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">The difference is <span className="text-[#25D366]">₹50,000+/month</span></h2>
            <p className="mt-3 text-muted-foreground font-medium">Just one missed customer per day costs more than Helpa&apos;s entire monthly plan.</p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
              className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-7">
              <h3 className="text-lg font-extrabold text-red-400 mb-5 flex items-center gap-2"><XCircle className="h-5 w-5" /> Without Helpa</h3>
              <ul className="space-y-3.5">
                {[
                  "Missed enquiries every night & weekend",
                  "Receptionist answers same questions 40+ times/day",
                  "Customers wait 2-4 hours for a reply",
                  "Leads vanish — no CRM, no tracking",
                  "₹1,500-3,000 lost per missed booking",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400/70" /> {t}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
              className="rounded-2xl border-2 border-[#25D366]/40 bg-[#25D366]/[0.04] p-7 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-4 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-md">With Helpa</span>
              <h3 className="text-lg font-extrabold text-[#25D366] mb-5 flex items-center gap-2 mt-1"><CheckCircle2 className="h-5 w-5" /> With Helpa</h3>
              <ul className="space-y-3.5">
                {[
                  "Every message answered in 2 seconds — 24/7/365",
                  "AI handles all repetitive queries automatically",
                  "Appointments booked without a single phone call",
                  "Every lead auto-captured in your CRM",
                  "Staff focuses only on complex, high-value work",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#25D366]" /> {t}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════ INDUSTRIES ═══════════ */}
      <section className="border-y border-border bg-muted/30 py-24 transition-colors duration-300">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Built for businesses that <span className="text-[#25D366]">live on WhatsApp</span></h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: <Stethoscope className="h-5 w-5" />, name: "Clinics & Hospitals" },
              { icon: <GraduationCap className="h-5 w-5" />, name: "Coaching Institutes" },
              { icon: <Scissors className="h-5 w-5" />, name: "Salons & Spas" },
              { icon: <Hotel className="h-5 w-5" />, name: "Hotels & Stays" },
              { icon: <School className="h-5 w-5" />, name: "Schools & Colleges" },
              { icon: <UtensilsCrossed className="h-5 w-5" />, name: "Restaurants" },
              { icon: <Building2 className="h-5 w-5" />, name: "Real Estate" },
              { icon: <Smile className="h-5 w-5" />, name: "Dentists" },
              { icon: <Scale className="h-5 w-5" />, name: "Law Firms" },
              { icon: <Dumbbell className="h-5 w-5" />, name: "Fitness Centers" },
              { icon: <Wrench className="h-5 w-5" />, name: "Repair Shops" },
              { icon: <Store className="h-5 w-5" />, name: "Local Services" },
            ].map((ind, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: (i % 4) * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm hover:border-[#25D366]/25 transition-colors"
              >
                <span className="text-[#075E54] dark:text-[#25D366] shrink-0">{ind.icon}</span>
                <span className="text-sm font-semibold text-foreground">{ind.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Businesses are <span className="text-[#25D366]">already seeing results</span></h2>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                quote: "Our front desk used to get 60+ calls daily asking about fees and timings. Now Helpa handles all of that on WhatsApp. We've saved ₹15,000/month in staff overtime alone.",
                name: "Dr. Priya Mehta",
                role: "SmileCare Dental · Mumbai",
                stars: 5,
              },
              {
                quote: "Parents kept messaging us at 10 PM asking about batch schedules. Helpa answers instantly and even collects admission enquiry forms. Our admissions are up 22%.",
                name: "Rajesh Agarwal",
                role: "Excel Coaching · Bangalore",
                stars: 5,
              },
              {
                quote: "We went from losing 8-10 booking enquiries per week to zero. Helpa books salon appointments while my staff focuses on the clients in the chair.",
                name: "Neha Sharma",
                role: "Glow Studio · Delhi",
                stars: 5,
              },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array(t.stars).fill(0).map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-foreground font-medium leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 pt-4 border-t border-border/60">
                  <p className="text-sm font-bold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <section id="pricing" className="border-y border-border bg-muted/30 py-24 scroll-mt-24 transition-colors duration-300">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Pricing that <span className="text-[#25D366]">pays for itself</span></h2>
            <p className="mt-3 text-muted-foreground font-medium">Every plan includes onboarding, AI training, and WhatsApp setup.</p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Starter */}
            <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">Small Business</p>
              <h3 className="text-xl font-black text-foreground">Starter</h3>
              <p className="text-xs text-muted-foreground font-medium mt-1">Setup: ₹9,999 (one-time)</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹4,999</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/50 pt-5">
                {["1 WhatsApp Number", "AI Receptionist", "Appointment Booking", "FAQ Automation", "Lead Capture", "Human Takeover", "Dashboard Analytics", "Multilingual AI", "Email Support", "Free Onboarding"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground font-medium">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#25D366]" /> {f}
                  </li>
                ))}
              </ul>
              <Link href={ctaHref} className="mt-6 rounded-xl border border-border px-5 py-3 text-center text-sm font-bold text-foreground hover:bg-accent/60 transition-colors">Book Demo</Link>
            </motion.div>

            {/* Growth */}
            <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: 0.08 }}
              className="flex flex-col rounded-2xl border-2 border-[#25D366]/50 bg-card p-7 shadow-xl shadow-[#25D366]/5 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-4 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-sm">Most Popular</span>
              <p className="text-xs font-bold uppercase text-[#25D366] tracking-wider mb-1 mt-1">Growing Business</p>
              <h3 className="text-xl font-black text-foreground">Growth</h3>
              <p className="text-xs text-muted-foreground font-medium mt-1">Setup: ₹19,999</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">₹14,999</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/50 pt-5">
                <li className="text-xs font-black text-foreground uppercase tracking-wider mb-1">Everything in Starter plus:</li>
                {["Up to 3 WhatsApp Numbers", "Shared Team Inbox", "CRM Integration", "Broadcast Campaigns", "Automated Follow-ups", "Priority Support", "Multiple Staff Members", "Advanced Analytics"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground font-medium">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#25D366]" /> {f}
                  </li>
                ))}
              </ul>
              <Link href={ctaHref} className="mt-6 rounded-xl bg-[#25D366] hover:bg-[#1fb855] px-5 py-3 text-center text-sm font-bold text-white transition-all shadow-md shadow-[#25D366]/20">Book Free Consultation</Link>
            </motion.div>

            {/* Enterprise */}
            <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: 0.16 }}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">High Volume</p>
              <h3 className="text-xl font-black text-foreground">Enterprise</h3>
              <p className="text-xs text-muted-foreground font-medium mt-1">For hospitals, franchises & chains</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">Custom</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1 border-t border-border/50 pt-5">
                {["Unlimited Numbers", "Custom AI Training", "API Access", "Custom Integrations", "Dedicated Account Manager", "SLA Guarantee", "On-premise Option", "White Label"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground font-medium">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#25D366]" /> {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:sales@helpa.studio" className="mt-6 rounded-xl border border-border px-5 py-3 text-center text-sm font-bold text-foreground hover:bg-accent/60 transition-colors">Contact Sales</a>
            </motion.div>
          </div>

          {/* What's in setup */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-7 max-w-3xl mx-auto shadow-sm">
            <h3 className="font-extrabold text-foreground mb-4">What&apos;s included in the setup fee?</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {["WhatsApp Business configuration", "AI knowledge base training", "Business workflow setup", "Appointment flow configuration", "Team onboarding", "Go-live assistance"].map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                  <Check className="h-3.5 w-3.5 text-[#25D366] shrink-0" /> {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="py-24 px-6 scroll-mt-24">
        <div className="mx-auto max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}
            className="text-center mb-14">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">Common questions</h2>
          </motion.div>

          <div className="divide-y divide-border">
            {[
              {
                q: "How does Helpa connect to our WhatsApp number?",
                a: "Helpa uses the official Meta WhatsApp Business Cloud API. Your existing number stays the same — no SIM changes, no data migration. Setup takes under 5 minutes.",
              },
              {
                q: "What if the AI gives a wrong answer?",
                a: "Helpa only answers from the knowledge you provide — fees, timings, services. It never guesses. If a question is outside its training, it flags it for your staff to handle manually.",
              },
              {
                q: "Can our staff take over a conversation?",
                a: "Yes. Any team member can click \"Takeover\" in the dashboard to pause AI and reply manually. The full chat history is always visible.",
              },
              {
                q: "How long does it take to go live?",
                a: "Most businesses go live within 24 hours. Sign up, connect WhatsApp, upload your business info, and Helpa starts answering immediately.",
              },
              {
                q: "Is our customer data safe?",
                a: "Absolutely. All data is encrypted, hosted on secure cloud infrastructure, and never shared with third parties. We comply with Meta's data protection requirements.",
              },
              {
                q: "What happens if we exceed usage limits?",
                a: "Every plan includes generous AI usage. If you exceed it, additional credits are billed transparently — you'll always see usage from your dashboard before any charges.",
              },
            ].map((faq, i) => (
              <div key={i} className="py-4">
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="flex w-full items-center justify-between text-left py-1 cursor-pointer group"
                >
                  <span className="font-bold text-foreground group-hover:text-[#25D366] transition-colors pr-4">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${activeFaq === i ? "rotate-180 text-[#25D366]" : ""}`} />
                </button>
                {activeFaq === i && (
                  <p className="mt-3 text-sm text-muted-foreground font-medium leading-relaxed bg-muted/40 border border-border/60 rounded-xl p-4 animate-in fade-in duration-150">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-[#075E54] to-[#064e46] p-10 sm:p-16 text-center shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#25D366]/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-[#25D366]/10 blur-3xl pointer-events-none" />

          <h2 className="text-3xl font-black tracking-tight sm:text-4xl text-white leading-tight relative z-10">
            Stop losing customers.<br />Start with a free demo.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-emerald-100/80 text-sm leading-relaxed font-medium relative z-10">
            See Helpa answer your real business questions in a live 15-minute walkthrough. No commitment, no credit card.
          </p>
          <Link href={ctaHref} className="mt-8 relative z-10 inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-white hover:text-[#075E54] px-8 py-4 text-sm font-bold text-white transition-all shadow-xl shadow-black/20 hover:shadow-lg active:scale-[0.97]">
            Book My Free Demo <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-emerald-200/70 font-medium relative z-10">
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Free 15-min demo</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> No credit card</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Live in 24 hours</span>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-border bg-card px-6 py-10 transition-colors duration-300">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366] text-white"><MessageSquare className="h-3.5 w-3.5 fill-white" /></div>
            <span className="font-extrabold text-foreground">Helpa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground font-semibold">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Helpa Studio</p>
        </div>
      </footer>
    </div>
  );
}
