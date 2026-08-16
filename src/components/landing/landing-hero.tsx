'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Bot,
  MessageSquare,
  User,
  Calendar,
  Send,
  Check,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  Phone,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingHero() {
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const demoChats = [
    {
      name: 'Rahul Sharma',
      avatar: 'RS',
      time: 'Just now',
      preview: 'I want to book an appointment for tomorrow.',
      tag: 'Appointment Intent',
      tagColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      industry: 'Health & Clinic',
      patientId: 'PT-000184',
      phone: '+91 98765 43210',
      status: 'Returning Patient (2 Visits)',
      lastMessage: 'Hi! I would like to book a consultation with Dr. Debasish Roy for tomorrow afternoon around 3 PM.',
      aiIntent: 'Doctor Consultation Booking',
      confidence: '99% Confidence',
      aiReply: 'Hello Rahul! Dr. Debasish Roy has open OPD slots tomorrow at 2:30 PM and 4:15 PM. Would 2:30 PM work for you? I can generate your queue token right away.',
      actionPrimary: 'Book Appointment & Issue Token',
      actionSecondary: 'View Medical History',
    },
    {
      name: 'Ananya Sen (Parent)',
      avatar: 'AS',
      time: '2m ago',
      preview: 'What are the batch timings for NEET 2027?',
      tag: 'Course Enquiry',
      tagColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      industry: 'Coaching Institute',
      patientId: 'STU-000842',
      phone: '+91 98765 11223',
      status: 'New Student Lead',
      lastMessage: 'Hi, I am looking for NEET 2027 Foundation batch timings and fee structure for my daughter.',
      aiIntent: 'Admission & Fee Enquiry',
      confidence: '97% Confidence',
      aiReply: 'Hello Mrs. Sen! Our NEET 2027 Morning Foundation batch runs Mon-Wed-Fri 8:00 AM - 10:00 AM. Total course fee is ₹45,000 with installment plans. Shall I reserve a free demo seat for your daughter?',
      actionPrimary: 'Create Admission Lead',
      actionSecondary: 'Send Brochure PDF',
    },
    {
      name: 'Sneha Mukherjee',
      avatar: 'SM',
      time: '15m ago',
      preview: 'Can I reschedule my haircut to Friday 4 PM?',
      tag: 'Salon Reschedule',
      tagColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      industry: 'Beauty & Salon',
      patientId: 'CUS-000412',
      phone: '+91 98765 99887',
      status: 'VIP Customer (8 Visits)',
      lastMessage: 'Can I reschedule my appointment with Priya Sharma to this Friday at 4:00 PM instead?',
      aiIntent: 'Stylist Rescheduling',
      confidence: '98% Confidence',
      aiReply: 'Hi Sneha! Priya Sharma is available this Friday at 4:00 PM. I have shifted your Haircut & Hydra-Glow session to Friday, 4:00 PM. See you then!',
      actionPrimary: 'Confirm Reschedule',
      actionSecondary: 'View Stylist Calendar',
    },
  ];

  const currentChat = demoChats[activeChatIndex];

  const handleUseReply = () => {
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  return (
    <section className="relative pt-32 pb-20 lg:pt-36 lg:pb-32 overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-gradient-to-br from-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Hero Typography */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Eyebrow Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>AI Business Communication Platform</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground font-normal">WhatsApp + AI + CRM</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1]"
          >
            Your WhatsApp. <br />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Powered by AI.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
          >
            Turn every WhatsApp conversation into a customer, appointment, lead, or follow-up — with AI. Helpa unifies your team inbox, CRM, autonomous AI agent, and workflow automations into one powerful workspace.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
          >
            <Link href="/signup" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base px-8 h-12 shadow-lg shadow-emerald-600/25 gap-2"
              >
                <span>Start Free 14-Day Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#product" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-border text-foreground hover:bg-muted font-medium text-base px-6 h-12"
              >
                Explore Live Demo
              </Button>
            </a>
          </motion.div>

          {/* Trust Guarantees */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-muted-foreground pt-1"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              1-Click Meta WhatsApp Setup
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Keep your existing WhatsApp number
            </span>
          </motion.div>
        </div>

        {/* HERO PRODUCT UI DEMO (Interactive 3-Column SaaS Mockup) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-14 max-w-6xl mx-auto"
        >
          <div className="rounded-2xl border border-border/80 bg-card shadow-2xl shadow-emerald-950/10 overflow-hidden ring-1 ring-black/5">
            {/* Window Topbar */}
            <div className="bg-muted/60 border-b border-border/70 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                <span className="text-xs font-semibold text-muted-foreground ml-3 hidden sm:inline">
                  Helpa Command Center — WhatsApp Live Workspace
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Meta Cloud API Connected
                </span>
              </div>
            </div>

            {/* Main 3-Column Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
              {/* Column 1: Conversations List */}
              <div className="lg:col-span-3 border-r border-border/70 bg-muted/20 p-3 space-y-2 hidden md:block">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Inbox ({demoChats.length})
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                    AI Auto-Pilot
                  </span>
                </div>

                <div className="space-y-1.5">
                  {demoChats.map((chat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveChatIndex(idx)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all border ${
                        activeChatIndex === idx
                          ? 'bg-card border-border shadow-sm'
                          : 'hover:bg-muted/50 border-transparent text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-600/10 text-emerald-700 font-bold text-xs flex items-center justify-center">
                            {chat.avatar}
                          </div>
                          <span className="text-xs font-bold text-foreground truncate max-w-[100px]">
                            {chat.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {chat.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5">
                        {chat.preview}
                      </p>
                      <span
                        className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full border ${chat.tagColor}`}
                      >
                        {chat.tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 2: Active Chat Thread */}
              <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-background border-r border-border/70">
                {/* Chat Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/70">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {currentChat.avatar}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        {currentChat.name}
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        {currentChat.phone} • {currentChat.industry}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                    WhatsApp Cloud
                  </span>
                </div>

                {/* Chat Bubble Area */}
                <div className="py-6 space-y-4 flex-1">
                  {/* Customer Message Bubble */}
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                      {currentChat.avatar}
                    </div>
                    <div className="bg-muted/80 rounded-2xl rounded-tl-none p-3.5 text-xs text-foreground leading-relaxed shadow-sm">
                      <p>{currentChat.lastMessage}</p>
                      <span className="text-[9px] text-muted-foreground block text-right mt-1">
                        11:42 AM
                      </span>
                    </div>
                  </div>

                  {/* AI Response Preview Bubble */}
                  <div className="flex items-start gap-2 max-w-[90%] ml-auto justify-end">
                    <div className="bg-emerald-600/10 border border-emerald-500/20 text-foreground rounded-2xl rounded-tr-none p-3.5 text-xs leading-relaxed shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mb-1">
                        <Bot className="w-3.5 h-3.5" />
                        <span>Helpa AI Agent • Auto-Draft</span>
                      </div>
                      <p>{currentChat.aiReply}</p>
                      <span className="text-[9px] text-emerald-700/60 block text-right mt-1">
                        11:42 AM • AI Generated
                      </span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] text-white shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Simulated Input Area */}
                <div className="pt-3 border-t border-border/70 flex items-center gap-2">
                  <input
                    readOnly
                    value="AI Copilot drafted reply ready..."
                    className="flex-1 bg-muted/50 border border-border/70 rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none"
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send</span>
                  </Button>
                </div>
              </div>

              {/* Column 3: AI Copilot & Contact Dossier */}
              <div className="lg:col-span-4 p-4 bg-muted/10 space-y-4">
                {/* AI Intent & Copilot Box */}
                <div className="bg-card border border-emerald-500/30 rounded-xl p-3.5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-foreground">
                        AI Copilot Intelligence
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {currentChat.confidence}
                    </span>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Detected Intent:</span>
                      <span className="font-semibold text-foreground">
                        {currentChat.aiIntent}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Module Scope:</span>
                      <span className="font-semibold text-emerald-600">
                        {currentChat.industry}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Recommended 1-Click Action:
                    </span>
                    <Button
                      size="sm"
                      onClick={handleUseReply}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8 shadow-sm gap-1.5"
                    >
                      {copiedResponse ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Action Executed!</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>{currentChat.actionPrimary}</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-border text-foreground hover:bg-muted text-xs h-8"
                    >
                      {currentChat.actionSecondary}
                    </Button>
                  </div>
                </div>

                {/* CRM 360-Degree Contact Profile */}
                <div className="bg-card border border-border/70 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      Customer CRM Dossier
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {currentChat.patientId}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="font-medium text-foreground">
                        {currentChat.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mobile:</span>
                      <span className="font-medium text-foreground">
                        {currentChat.phone}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lifecycle Stage:</span>
                      <span className="font-medium text-emerald-600">
                        {currentChat.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
