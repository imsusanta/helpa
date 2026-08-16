'use client';

import {
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export function LandingProblemSolution() {
  const painPoints = [
    'Scattered personal WhatsApp phones with zero team visibility',
    'Hours of delay replying to high-intent customer enquiries',
    'Lost leads forgotten in spreadsheets, sticky notes, and paper registers',
    'Manual follow-ups that staff frequently forget or miss',
    'High appointment no-show rates without automated reminders',
  ];

  const solutions = [
    'Unified team inbox with multi-agent assignments and live tags',
    'Instant 24/7 AI qualification, smart answers, and appointment booking',
    '360° CRM dossiers tracking visits, preferences, and conversations',
    'Automated WhatsApp follow-ups, fee reminders, and status alerts',
    'Automated 24h & 2h appointment reminders with OPD tokens & PDF tickets',
  ];

  return (
    <section className="py-20 lg:py-28 bg-background relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            The Communication Gap
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Your customers are already on WhatsApp.{' '}
            <span className="text-emerald-600">Your business should be too.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Stop losing high-value customers to slow replies, messy spreadsheets, and disconnected tools. See how Helpa transforms chaos into scalable revenue.
          </p>
        </div>

        {/* Before vs After Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Before Helpa Card */}
          <div className="p-8 rounded-2xl bg-red-500/[0.02] border border-red-500/20 shadow-sm space-y-6 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Before Helpa
                </h3>
                <p className="text-xs text-muted-foreground">
                  The manual, fragmented status quo
                </p>
              </div>
            </div>

            <ul className="space-y-4">
              {painPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-600/90 font-medium">
              Result: 35%+ lost leads, frustrated customers, and overworked receptionists.
            </div>
          </div>

          {/* After Helpa Card */}
          <div className="p-8 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/30 shadow-lg shadow-emerald-500/5 space-y-6 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    With Helpa
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                    Command Center
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automated, AI-powered & unified
                </p>
              </div>
            </div>

            <ul className="space-y-4">
              {solutions.map((sol, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{sol}</span>
                </li>
              ))}
            </ul>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-between">
              <span>Result: 3x faster response times, zero dropped leads, higher retention.</span>
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
