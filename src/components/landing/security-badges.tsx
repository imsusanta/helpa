'use client';

import { ShieldCheck, Lock, KeyRound, Server } from 'lucide-react';

export function LandingSecurityBadges() {
  const securityFeatures = [
    {
      icon: ShieldCheck,
      title: 'Official Meta Partnership',
      description:
        'Built directly on official WhatsApp Cloud APIs. Zero risk of banned numbers or unofficial scrapers.',
    },
    {
      icon: Lock,
      title: '100% Private to Your Business',
      description:
        'Your patient notes, customer chats, and student lists are strictly private. No one outside your team can ever see them.',
    },
    {
      icon: KeyRound,
      title: 'Bank-Grade Data Protection',
      description:
        'All logins, client phone numbers, and WhatsApp tokens are protected with industry-standard AES-256 encryption.',
    },
    {
      icon: Server,
      title: 'Always Online & Reliable',
      description:
        'Runs 24/7 in the cloud so you never miss a client message, even when your phone is turned off or you are asleep.',
    },
  ];

  return (
    <section id="security" className="border-y border-slate-100 bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            Safety & Privacy
          </span>
          <h2 className="text-2xl font-extrabold text-[#110E3D] sm:text-3xl">
            Your customer data is 100% safe & private
          </h2>
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">
            We treat your patient records, student details, and business
            conversations with the highest standard of privacy.
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
