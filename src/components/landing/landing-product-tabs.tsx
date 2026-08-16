'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Users,
  Bot,
  Workflow,
  Send,
  BarChart3,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingProductTabs() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'crm' | 'ai' | 'automation' | 'campaigns' | 'analytics'>('inbox');

  const tabs = [
    { id: 'inbox', label: 'Team Inbox', icon: Inbox },
    { id: 'crm', label: 'Contact CRM', icon: Users },
    { id: 'ai', label: 'AI Copilot', icon: Bot },
    { id: 'automation', label: 'Automations', icon: Workflow },
    { id: 'campaigns', label: 'Broadcasts', icon: Send },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ] as const;

  return (
    <section id="product" className="py-20 lg:py-28 bg-muted/30 border-y border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Unified Core Platform
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            One workspace for every customer conversation.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Everything your team needs to capture leads, answer questions, book slots, and grow customer relationships — without switching between fragmented tools.
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center justify-start sm:justify-center overflow-x-auto pb-4 gap-2 mb-10 no-scrollbar">
          <div className="bg-card border border-border p-1.5 rounded-2xl flex items-center gap-1.5 shadow-xs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Dynamic Mockup */}
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'inbox' && (
              <motion.div
                key="inbox"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Multichannel WhatsApp Team Inbox
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Shared team inbox with real-time sync, agent assignments, and internal notes.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-500/10 text-emerald-600 font-semibold px-3 py-1 rounded-full border border-emerald-500/20">
                      ⚡ 2.4s Avg Response Time
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Multi-Agent Assignment</span>
                    <p className="text-muted-foreground">
                      Route conversations automatically to specific staff members, receptionists, or counselors based on topic.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Custom Tags & Pipelines</span>
                    <p className="text-muted-foreground">
                      Organize leads with custom status tags (e.g. VIP, Appointment Scheduled, Payment Pending, Enrolled).
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Internal Private Notes</span>
                    <p className="text-muted-foreground">
                      Leave internal notes visible only to teammates directly in the chat without alerting the customer.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'crm' && (
              <motion.div
                key="crm"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      360-Degree Contact CRM & Timelines
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Know every customer&apos;s history, appointments, notes, and purchases before you reply.
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded text-muted-foreground">
                    Auto-Synchronized
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Family & Multi-Profile Support</span>
                    <p className="text-muted-foreground">
                      Register multiple family members (e.g. Rahul, Mother, Child) under a single phone number with distinct IDs.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Chronological Timeline</span>
                    <p className="text-muted-foreground">
                      Complete activity log of every WhatsApp message, booking, consultation, and invoice.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Dynamic Custom Fields</span>
                    <p className="text-muted-foreground">
                      Track industry-specific data: Blood group, Target exam, Preferred stylist, or Budget.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Dual AI Engine: 24/7 Agent + Staff Copilot
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Autonomous customer-facing answers paired with intelligent drafting for human staff.
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 font-semibold px-3 py-1 rounded-full">
                    Powered by OpenRouter LLMs
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Instant Intent Recognition</span>
                    <p className="text-muted-foreground">
                      Identifies whether a customer wants an appointment, fee info, directions, or urgent staff triage.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Connected Knowledge Base</span>
                    <p className="text-muted-foreground">
                      Upload PDFs, FAQs, price lists, and clinic timings so AI gives 100% accurate, hallucination-free replies.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">1-Click Action Execution</span>
                    <p className="text-muted-foreground">
                      AI suggests ready-to-send replies and auto-populates appointment tokens, invoices, and reminders.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'automation' && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Visual Trigger & Action Automation Builder
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Automate repetitive follow-ups, appointment reminders, and lead qualification with no code.
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 font-semibold px-3 py-1 rounded-full">
                    Loop-Protected Engine
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Event Triggers</span>
                    <p className="text-muted-foreground">
                      Trigger flows on incoming messages, new contact creation, missed appointments, or tags.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Smart Delays & Timing</span>
                    <p className="text-muted-foreground">
                      Send reminders 24 hours and 2 hours before appointments, or follow up 3 days after enquiries.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Dynamic Placeholders</span>
                    <p className="text-muted-foreground">
                      Inject patient name, doctor name, token number, or fee amount dynamically into WhatsApp templates.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'campaigns' && (
              <motion.div
                key="campaigns"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Segmented WhatsApp Broadcast Campaigns
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Send personalized offers, announcements, and health checkup reminders directly to your audience.
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 font-semibold px-3 py-1 rounded-full">
                    98% Open Rates
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Audience Segmentation</span>
                    <p className="text-muted-foreground">
                      Filter by tag, last visit date, past purchase, doctor visited, or course enrolled.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Meta Template Sync</span>
                    <p className="text-muted-foreground">
                      Create and sync approved WhatsApp Business utility and marketing templates with buttons and media headers.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Delivery & Read Analytics</span>
                    <p className="text-muted-foreground">
                      Track delivery, read receipts, and direct replies in real time from a single dashboard.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Real-Time Revenue & Conversion Analytics
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      See what your conversations are actually producing in appointments, admissions, and sales.
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 font-semibold px-3 py-1 rounded-full">
                    Live Insights
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">AI Deflection Rate</span>
                    <p className="text-muted-foreground">
                      Measure how many repetitive enquiries were resolved completely by AI without human staff intervention.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Appointment Conversion</span>
                    <p className="text-muted-foreground">
                      Track the percentage of inbound inquiries that turn into confirmed bookings and attended visits.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground block">Staff Performance</span>
                    <p className="text-muted-foreground">
                      Review response speeds, resolution times, and customer satisfaction across your team.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
