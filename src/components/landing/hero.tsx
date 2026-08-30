import Link from 'next/link';
import { BarChart3, CalendarCheck, MessageCircle, SlidersHorizontal, Sparkles, TrendingUp, Users } from 'lucide-react';

interface HeroProps {
  isAuthenticated: boolean;
}

const outcomes = [
  { icon: MessageCircle, label: 'Reply to customers 24/7' },
  { icon: Users, label: 'Capture and qualify leads' },
  { icon: CalendarCheck, label: 'Book appointments automatically' },
];

const tabs = [
  { icon: Users, label: 'Capture' },
  { icon: SlidersHorizontal, label: 'Automate' },
  { icon: TrendingUp, label: 'Scale' },
  { icon: BarChart3, label: 'Analyze' },
];

export function LandingHero({ isAuthenticated }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FBFAFD] via-[#F8F6FD] to-[#F1EEFA] pt-28 pb-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-28 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[#DCD5FF]/25 blur-3xl" />
        <div className="absolute left-0 top-32 h-64 w-64 rounded-full bg-white/70 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#B4F73C]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1120px] text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-50/90 px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-sm backdrop-blur">
            <span className="text-emerald-500">✦</span>
            AI-powered WhatsApp automation for businesses
          </div>

          <h1 className="mx-auto max-w-[1050px] text-[54px] font-black leading-[0.98] tracking-[-0.045em] text-[#110E3D] sm:text-[64px] lg:text-[76px]">
            Automate WhatsApp.<br />
            Get{' '}
            <span className="relative inline-block bg-gradient-to-r from-[#14B884] via-[#25D1A7] to-[#14B6BC] bg-clip-text text-transparent">
              More Leads.
              <span
                className="pointer-events-none absolute -bottom-4 left-1/2 h-4 w-[96%] -translate-x-1/2 rotate-[-1.5deg] rounded-[50%] border-b-[4px] border-[#9D7CFF]"
                aria-hidden="true"
              />
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-[760px] text-base leading-8 text-[#5C587D] sm:text-lg lg:text-[19px]">
            AI-powered WhatsApp automation that captures leads, answers customers,
            <br className="hidden sm:block" /> follows up automatically, and helps you turn conversations into sales.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={isAuthenticated ? '/dashboard' : '/signup'}
              className="flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#B9F22F] via-[#7DE69B] to-[#4EE3C1] px-9 py-3.5 text-base font-extrabold text-[#110E3D] shadow-[0_10px_25px_rgba(75,220,170,0.22)] transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              <Sparkles className="h-4 w-4" />
            </Link>
            <Link
              href="#features"
              className="flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-9 py-3.5 text-base font-bold text-[#110E3D] shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[10px]">▶</span>
              See how it works
            </Link>
          </div>

          <div className="mx-auto mt-10 grid max-w-[1030px] gap-3 sm:grid-cols-3">
            {outcomes.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex h-[64px] items-center gap-3 rounded-2xl border border-white bg-white/85 px-5 text-left text-sm font-bold text-[#4D4A6B] shadow-[0_8px_30px_rgba(17,14,61,0.06)] backdrop-blur"
              >
                <Icon className="h-6 w-6 shrink-0 text-emerald-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <div className="mb-5 flex items-center justify-center gap-5 border-b border-slate-200/80 pb-2 sm:gap-10">
            {tabs.map(({ icon: Icon, label }, index) => (
              <button
                key={label}
                type="button"
                className={`flex items-center gap-2 border-b-2 px-3 pb-3 pt-2 text-sm font-bold sm:px-4 sm:text-base ${
                  index === 0
                    ? 'border-[#110E3D] text-[#110E3D]'
                    : 'border-transparent text-[#6B6886]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="mx-auto overflow-hidden rounded-[30px] border border-indigo-100/70 bg-[#ECEAFC] p-3 shadow-[0_20px_60px_rgba(54,46,120,0.14)] sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-indigo-200/50 px-2 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono text-xs text-slate-500">helpa.app/workspace/inbox</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#25D366]/20 px-3 py-1 text-[11px] font-bold text-[#075E54]">
                ● Live WhatsApp Connected
              </span>
            </div>

            <div className="grid min-h-[440px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:grid-cols-[220px_1fr_220px]">
              <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#110E3D]">All Conversations (48)</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Real-time</span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-indigo-100 bg-[#F7F8FD] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#110E3D]">Rahul Sharma</span>
                      <span className="text-[10px] text-slate-400">10:15 AM</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-600">Interested in your product</p>
                    <div className="mt-2 flex gap-1">
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">Lead</span>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Qualified</span>
                    </div>
                  </div>
                  <div className="rounded-xl p-3">
                    <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">Sneha Mukherjee</span><span className="text-[10px] text-slate-400">09:40 AM</span></div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">Can someone help me with pricing?</p>
                  </div>
                  <div className="rounded-xl p-3">
                    <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">Ananya Sen</span><span className="text-[10px] text-slate-400">Yesterday</span></div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">I would like to know more about your service.</p>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[440px] flex-col px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#110E3D] text-xs font-bold text-white">RS</div>
                    <div>
                      <div className="text-xs font-bold text-[#110E3D]">Rahul Sharma</div>
                      <div className="text-[10px] text-slate-400">+91 98765 43210 • Lead #LP-00001</div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">AI Active</span>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-3 py-4">
                  <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-800">Hi, I found your business on WhatsApp. Can you tell me more about your service?<div className="mt-1 text-right text-[9px] text-slate-400">10:14 AM</div></div>
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3 text-xs leading-relaxed text-slate-900 shadow-sm">Absolutely! 👋 I can help with pricing, availability, services, and next steps. What would you like to know?<div className="mt-1 text-right text-[9px] text-slate-400">10:14 AM ✓✓</div></div>
                  <div className="max-w-[42%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-xs text-slate-800">What are your pricing options?<div className="mt-1 text-right text-[9px] text-slate-400">10:15 AM</div></div>
                  <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3 text-xs leading-relaxed text-slate-900 shadow-sm">I can share the right option based on what you need. Would you like a quick consultation?<div className="mt-1 text-right text-[9px] text-slate-400">10:15 AM ✓✓</div></div>
                </div>
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3"><div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">Type a message to test AI assistant...</div><div className="rounded-xl bg-[#110E3D] p-2.5 text-white">➤</div></div>
              </div>

              <div className="border-t border-slate-100 p-4 lg:border-t-0 lg:border-l">
                <div className="text-xs font-bold text-[#110E3D]">Lead Profile</div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span className="text-slate-400">Status</span><span className="font-semibold text-emerald-600">Qualified</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-400">Source</span><span className="font-semibold">WhatsApp</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-400">Interest</span><span className="font-semibold">Product enquiry</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-400">Next step</span><span className="font-bold text-emerald-600">Follow-up</span></div>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="text-xs font-bold text-[#110E3D]">Automated Actions</div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg bg-emerald-50 p-2 text-[11px] font-semibold text-emerald-700">✓ Lead profile updated</div>
                    <div className="rounded-lg bg-blue-50 p-2 text-[11px] font-semibold text-blue-700">◷ Follow-up scheduled</div>
                    <div className="rounded-lg bg-indigo-50 p-2 text-[11px] font-semibold text-indigo-700">▣ Conversation tagged</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
