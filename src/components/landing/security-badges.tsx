'use client';

import { ShieldCheck, Lock, KeyRound, Server } from 'lucide-react';

export function LandingSecurityBadges() {
  const securityFeatures = [
    {
      icon: ShieldCheck,
      title: 'Official Meta Cloud API',
      description:
        'Zero unofficial scrapers or reverse-engineered APIs. 100% compliant with Meta Business Policies.',
    },
    {
      icon: Lock,
      title: 'Strict Multi-Tenant Isolation',
      description:
        'Tenant A can never read, see, or mutate Tenant B data. Rigorously verified by server-side authorization guards.',
    },
    {
      icon: KeyRound,
      title: 'AES-256-GCM Encryption',
      description:
        'All WhatsApp tokens and API credentials are encrypted at rest with NIST-approved cryptographic authentication tags.',
    },
    {
      icon: Server,
      title: 'Enterprise High-Availability',
      description:
        'Idempotent webhooks, Redis-grade memory caching, automatic rate limiting, and 99.9% uptime architecture.',
    },
  ];

  return (
    <section id="security" className="py-16 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 mb-2">
            Security & Trust
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#110E3D]">
            Enterprise-grade security by default
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Your patient records, student details, customer conversations, and business data are protected by defense-in-depth security.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityFeatures.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2 hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white text-[#110E3D] shadow-xs flex items-center justify-center border border-slate-200/60">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-bold text-[#110E3D]">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
