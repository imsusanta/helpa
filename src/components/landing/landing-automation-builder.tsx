'use client';

import {
  Workflow,
  Sparkles,
  Bot,
  UserCheck,
  Calendar,
  Send,
  Clock,
  ArrowDown,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function LandingAutomationBuilder() {
  const steps = [
    {
      type: 'trigger',
      title: 'Trigger: Inbound WhatsApp Message',
      desc: 'Customer sends message with appointment or service enquiry',
      icon: Send,
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    {
      type: 'ai',
      title: 'AI Intelligence: Intent & Entity Extraction',
      desc: 'AI detects requested doctor, desired time, and patient details',
      icon: Bot,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    {
      type: 'crm',
      title: 'CRM Action: Create / Link Contact Dossier',
      desc: 'Generates unique sequential ID (e.g. PT-000123) and logs history',
      icon: UserCheck,
      color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    },
    {
      type: 'system',
      title: 'System Action: Reserve Slot & Generate OPD Token',
      desc: 'Issues token number (A-018) and generates digital PDF appointment slip',
      icon: Calendar,
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    },
    {
      type: 'delay',
      title: 'Smart Delay: 24h & 2h Pre-Visit Reminders',
      desc: 'Automated WhatsApp reminder dispatch reducing no-shows to under 4%',
      icon: Clock,
      color: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    },
  ];

  return (
    <section id="automations" className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Visual Workflow Engine
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Automate the work that keeps repeating.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Build multi-step automated workflows with visual triggers, AI classification, smart time delays, and personalized WhatsApp messages.
          </p>
        </div>

        {/* Visual Workflow Node Diagram */}
        <div className="max-w-3xl mx-auto space-y-3 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;
            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-emerald-500/30 transition-all">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${step.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {step.title}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Step 0{idx + 1}
                  </span>
                </div>

                {!isLast && (
                  <div className="py-1.5 flex flex-col items-center text-muted-foreground/50">
                    <ArrowDown className="w-4 h-4 text-emerald-600/70" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 h-11 shadow-md shadow-emerald-600/20 gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Build Your First Workflow</span>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
