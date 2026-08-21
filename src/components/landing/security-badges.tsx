import { KeyRound, Lock, Server, ShieldCheck } from 'lucide-react';

export function LandingSecurityBadges() {
  const securityFeatures = [
    {
      icon: ShieldCheck,
      title: 'Official Meta Cloud API',
      description: 'Uses Meta’s supported WhatsApp Business integration rather than unofficial scraping tools.',
    },
    {
      icon: Lock,
      title: 'Tenant isolation controls',
      description: 'Server-side authorization and database policies are designed to keep each clinic’s records separated.',
    },
    {
      icon: KeyRound,
      title: 'Encrypted credentials',
      description: 'Sensitive integration credentials are protected with authenticated encryption at rest.',
    },
    {
      icon: Server,
      title: 'Operational safeguards',
      description: 'Webhook verification, idempotency, rate limits, and private cache controls reduce common production risks.',
    },
  ];

  return (
    <section id="security" className="border-y border-slate-100 bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Security & Trust</span>
          <h2 className="text-2xl font-extrabold text-[#110E3D] sm:text-3xl">Security controls designed for sensitive workflows</h2>
          <p className="mt-2 text-sm text-slate-600">These are engineering safeguards, not a certification. Independent security and legal reviews are required before claiming regulatory compliance.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {securityFeatures.map(({ icon: Icon, title, description }) => (
            <div key={title} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-600"><Icon className="h-5 w-5" /></div>
              <h3 className="text-sm font-bold text-[#110E3D]">{title}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
