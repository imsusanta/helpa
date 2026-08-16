'use client';

import {
  MessageSquare,
  Bot,
  Users,
  Workflow,
  Send,
  BarChart3,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function LandingTrustBar() {
  const pillars = [
    {
      icon: MessageSquare,
      title: 'WhatsApp Engine',
      subtitle: 'Official Meta Cloud API',
    },
    {
      icon: Bot,
      title: 'Dual AI Intelligence',
      subtitle: 'Agent + Staff Copilot',
    },
    {
      icon: Users,
      title: 'Contextual CRM',
      subtitle: '360° Customer Dossiers',
    },
    {
      icon: Workflow,
      title: 'Visual Automations',
      subtitle: 'No-Code Workflow Engine',
    },
    {
      icon: Send,
      title: 'Broadcast Campaigns',
      subtitle: 'Segmented Outreach',
    },
    {
      icon: ShieldCheck,
      title: 'Enterprise Security',
      subtitle: 'AES-256 Multi-Tenant',
    },
  ];

  return (
    <section className="py-12 border-y border-border/60 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-8">
          The all-in-one platform powering modern WhatsApp business communication
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 shadow-xs hover:border-emerald-500/30 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {pillar.title}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    {pillar.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
