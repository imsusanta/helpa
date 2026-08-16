'use client';

import {
  ShieldCheck,
  Lock,
  Server,
  FileCheck2,
  KeyRound,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

export function LandingSecuritySection() {
  const securityFeatures = [
    {
      icon: ShieldCheck,
      title: 'Strict Multi-Tenant Isolation',
      desc: 'Server-side tenant verification ensures Tenant A can never read, modify, or access Tenant B data under any condition.',
    },
    {
      icon: Lock,
      title: 'AES-256-GCM Cryptography',
      desc: 'All third-party Meta tokens, API keys, and credentials are encrypted at rest with NIST-recommended 16-byte authentication tags.',
    },
    {
      icon: UserCheck,
      title: 'Granular Role-Based Access (RBAC)',
      desc: 'Role hierarchy (Owner, Admin, Staff, Viewer) enforced server-side. Staff cannot mutate billing or platform settings.',
    },
    {
      icon: FileCheck2,
      title: 'Sanitized Audit Logging',
      desc: 'Comprehensive audit trails of logins, role changes, and WhatsApp connections with zero secret or password leakage.',
    },
    {
      icon: Server,
      title: 'Official Meta Cloud API Infrastructure',
      desc: 'Official WhatsApp Cloud API integration with SHA-256 HMAC webhook verification and replay defense.',
    },
    {
      icon: KeyRound,
      title: 'Sliding-Window Rate Limiting',
      desc: 'Automatic protection against brute-force attacks, AI request bursts, and high-frequency webhook loops.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-muted/20 border-y border-border/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Enterprise Grade Security
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Built for enterprise reliability and privacy.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Helpa protects your customer conversations and business data with bank-grade encryption, rigorous tenant isolation, and audited access controls.
          </p>
        </div>

        {/* Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {securityFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {feat.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
