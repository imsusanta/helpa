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
    <section id="security" className="border-y border-slate-100 bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            Security & Trust
          </span>
          <h2 className="text-2xl font-extrabold text-[#110E3D] sm:text-3xl">
            Enterprise-grade security by default
          </h2>
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">
            Your patient records, student details, customer conversations, and
            business data are protected by defense-in-depth security.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {securityFeatures.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition-colors hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-[#110E3D] shadow-xs">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-bold text-[#110E3D]">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
