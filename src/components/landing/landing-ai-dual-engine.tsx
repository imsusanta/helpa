'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Zap,
  CheckCircle2,
  UserCheck,
  BrainCircuit,
  Send,
  Check,
  ArrowRight,
  ShieldCheck,
  FileText,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingAiDualEngine() {
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [copiedAction, setCopiedAction] = useState(false);

  const scenarios = [
    {
      title: 'Clinic Appointment',
      customerMessage: 'Hi, I need an appointment with Dr. Debasish Roy for tomorrow afternoon.',
      intent: 'Doctor Appointment Booking',
      confidence: '99%',
      knowledgeSource: 'Doctor Schedule & OPD Slot Registry',
      analysis: 'Customer wants a general consultation slot. Identified 2 open slots for Dr. Roy tomorrow: 2:30 PM & 4:15 PM.',
      suggestedReply: 'Hello! Dr. Debasish Roy is available tomorrow at 2:30 PM and 4:15 PM. Would you like me to book the 2:30 PM slot and generate your OPD token?',
      actionLabel: 'Book 2:30 PM & Issue Token A-019',
    },
    {
      title: 'Coaching Admission',
      customerMessage: 'What are the batch timings and fees for NEET 2027 Foundation?',
      intent: 'Course Admission & Fee Enquiry',
      confidence: '98%',
      knowledgeSource: 'Coaching Course Catalog & Fee Matrix',
      analysis: 'Identified enquiry for NEET 2027. Morning Starters batch has 18 open seats at ₹45,000.',
      suggestedReply: 'Hi! Our NEET 2027 Morning batch runs Mon-Wed-Fri 8:00 AM - 10:00 AM. Total course fee is ₹45,000 with installment options. Would you like to reserve a free demo class?',
      actionLabel: 'Create Student Lead & Send Syllabus PDF',
    },
    {
      title: 'Real Estate Visit',
      customerMessage: 'Do you have ready to move 2 BHK apartments in New Town under 70 Lakhs?',
      intent: 'Property Requirement Match',
      confidence: '97%',
      knowledgeSource: 'Property Listing Database',
      analysis: 'Matching criteria: 2 BHK, Ready to Move, New Town, Budget < ₹70L. Found 1 top match: New Town Residency at ₹62L.',
      suggestedReply: 'Yes! We have a luxury ready-to-move 2 BHK in New Town Residency priced at ₹62 Lakhs. Would you like to schedule a site visit this Saturday at 11:00 AM?',
      actionLabel: 'Schedule Site Visit & Assign Agent',
    },
  ];

  const current = scenarios[selectedScenario];

  const handleAction = () => {
    setCopiedAction(true);
    setTimeout(() => setCopiedAction(false), 2000);
  };

  return (
    <section id="ai-copilot" className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Intelligent Dual Engine
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            AI that works with your team.{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Not just another chatbot.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Helpa combines a 24/7 autonomous customer-facing AI Agent with an intelligent Staff Copilot that assists your team with every reply and action.
          </p>
        </div>

        {/* Dual Engine 2-Column Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-5xl mx-auto">
          {/* Engine 1: AI Agent */}
          <div className="p-8 rounded-2xl bg-card border border-border shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  AI Autonomous Agent
                </h3>
                <p className="text-xs text-muted-foreground">
                  Customer-Facing • 24/7 Always On
                </p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Answers routine customer questions instantly from your knowledge base.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Collects required customer info and qualifies leads automatically.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Books appointments, issues queue tokens, and shares digital PDFs.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Hands off complex cases smoothly to human staff with full context.</span>
              </li>
            </ul>
          </div>

          {/* Engine 2: AI Copilot */}
          <div className="p-8 rounded-2xl bg-card border border-border shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  AI Staff Copilot
                </h3>
                <p className="text-xs text-muted-foreground">
                  Staff-Facing • Real-Time Assistance
                </p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>Summarizes long chat threads in seconds so agents get instant context.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>Drafts perfect, contextual responses with 1-click approval.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>Recommends next best actions (e.g. Schedule visit, Send prescription).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>Translates and refines tone across team members on WhatsApp.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Interactive Live Copilot Simulator */}
        <div className="max-w-5xl mx-auto rounded-2xl border border-border bg-muted/30 p-6 sm:p-8 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Interactive Simulator
              </span>
              <h3 className="text-xl font-bold text-foreground">
                Try the AI Copilot in real time
              </h3>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {scenarios.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedScenario(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedScenario === idx
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Customer Message */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Incoming Customer Message
              </span>
              <div className="p-4 rounded-xl bg-card border border-border text-xs text-foreground leading-relaxed shadow-xs">
                <p className="font-medium">{current.customerMessage}</p>
                <span className="text-[10px] text-muted-foreground block mt-2">
                  Source: WhatsApp Webhook Event
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Intent Detected:</span>
                  <span className="font-bold text-foreground">{current.intent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Confidence Score:</span>
                  <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {current.confidence}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Knowledge Source:</span>
                  <span className="font-medium text-foreground">{current.knowledgeSource}</span>
                </div>
              </div>
            </div>

            {/* AI Copilot Suggestion & Action */}
            <div className="lg:col-span-7 space-y-3">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                AI Copilot Smart Suggestion
              </span>

              <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/30 text-xs space-y-3 shadow-xs">
                <p className="text-foreground leading-relaxed italic">
                  &ldquo;{current.suggestedReply}&rdquo;
                </p>

                <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleAction}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-sm"
                  >
                    {copiedAction ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Action Executed & Message Sent!</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>{current.actionLabel}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
