import Link from 'next/link';
import { BarChart3, CalendarCheck, MessageCircle, SlidersHorizontal, Sparkles, TrendingUp, Users } from 'lucide-react';

interface HeroProps { isAuthenticated: boolean; }

const outcomes = [
  { icon: MessageCircle, label: 'Reply to customers 24/7' },
  { icon: Users, label: 'Capture and qualify leads' },
  { icon: CalendarCheck, label: 'Follow up automatically' },
];

const tabs = [
  { icon: Users, label: 'Capture' },
  { icon: SlidersHorizontal, label: 'Automate' },
  { icon: TrendingUp, label: 'Scale' },
  { icon: BarChart3, label: 'Analyze' },
];

export function LandingHero({ isAuthenticated }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF9FC] via-[#F7F5FC] to-[#F1EEFA] pt-28 pb-16 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
        <div className="absolute left-1/2 top-40 h-80 w-80 -translate-x-1/2 rounded-full bg-[#CFC7FF]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-emerald-300/80 bg-emerald-50/90 px-5 py-2 text-xs font-black text-emerald-900 shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse shadow-[0_0_8px_#25D366]" />
            AI-powered WhatsApp automation for modern businesses
          </div>

          <h1 className="mx-auto mb-6 max-w-5xl text-5xl leading-[0.98] font-black tracking-tight text-[#110E3D] sm:text-6xl lg:text-[76px]">
            Automate WhatsApp.<br />
            <span className="bg-gradient-to-r from-[#110E3D] via-[#25BFA8] to-[#25D366] bg-clip-text text-transparent">
              Get More Customers.
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-3xl text-base leading-8 text-[#5C587D] sm:text-lg lg:text-xl font-medium">
            Helpa helps businesses reply faster, capture leads, answer questions, and follow up automatically — all from one powerful WhatsApp workspace.
          </p>

          <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={isAuthenticated ? '/dashboard' : '/signup'}
              className="flex min-h-12 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#B4F73C] via-[#52E0A8] to-[#25D3C8] px-8 py-3.5 text-base font-extrabold text-[#110E3D] shadow-lg shadow-[#25D366]/20 transition hover:scale-[1.04] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#075E54]"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              <Sparkles className="h-4 w-4" />
            </Link>
            <Link
              href="#features"
              className="flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3.5 text-base font-bold text-[#110E3D] shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:scale-[1.02]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[10px]">▶</span>
              See how it works
            </Link>
          </div>

          <div className="mx-auto grid max-w-4xl gap-3 text-left sm:grid-cols-3">
            {outcomes.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/90 bg-white/80 p-4 text-sm font-bold text-slate-800 shadow-[0_8px_30px_rgba(17,14,61,0.06)] backdrop-blur-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100/70 text-[#075E54]">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <div className="mb-5 flex items-center justify-center gap-2 overflow-x-auto border-b border-slate-200/80 pb-2">
            {tabs.map(({ icon: Icon, label }, index) => (
              <button key={label} type="button" className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold sm:text-base ${index === 0 ? 'border-[#110E3D] text-[#110E3D]' : 'border-transparent text-slate-500'}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="mx-auto overflow-hidden rounded-3xl border border-indigo-100/70 bg-[#EBE9FC] p-3 shadow-[0_20px_60px_rgba(54,46,120,0.14)] sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-indigo-200/50 px-2 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono text-xs text-slate-500">helpa.app/workspace/inbox</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#25D366]/20 px-3 py-1 text-[11px] font-bold text-[#075E54]">● Live WhatsApp Connected</span>
            </div>

            <div className="grid min-h-[420px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:grid-cols-[240px_1fr_240px]">
              <div className="border-b border-slate-100 p-4 lg:border-r lg:border-b-0">
                <div className="mb-4 flex items-center justify-between"><span className="text-xs font-bold text-[#110E3D]">All Conversations (48)</span><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Real-time</span></div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-indigo-100 bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-[#110E3D]">Rahul Sharma</span><span className="text-[10px] text-slate-400">10:15 AM</span></div><p className="mt-1 truncate text-[11px] text-slate-600">Thanks! Please send me the details.</p><div className="mt-2 flex gap-1"><span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">Lead</span><span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Qualified</span></div></div>
                  <div className="rounded-xl p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">Sneha Mukherjee</span><span className="text-[10px] text-slate-400">09:40 AM</span></div><p className="mt-1 truncate text-[11px] text-slate-500">Can someone help me with pricing?</p></div>
                  <div className="rounded-xl p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">Ananya Sen</span><span className="text-[10px] text-slate-400">Yesterday</span></div><p className="mt-1 truncate text-[11px] text-slate-500">I would like to know more about your service.</p></div>
                </div>
              </div>

              <div className="flex min-h-[420px] flex-col px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#110E3D] text-xs font-bold text-white">RS</div><div><div className="text-xs font-bold text-[#110E3D]">Rahul Sharma</div><div className="text-[10px] text-slate-400">+91 98765 43210 • Lead #LP-00001</div></div></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">AI Active</span></div>
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
                <div className="mt-3 space-y-2 text-xs"><div className="flex items-center justify-between"><span className="text-slate-400">Status</span><span className="font-semibold text-emerald-600">Qualified</span></div><div className="flex items-center justify-between"><span className="text-slate-400">Source</span><span className="font-semibold">WhatsApp</span></div><div className="flex items-center justify-between"><span className="text-slate-400">Interest</span><span className="font-semibold">Product enquiry</span></div><div className="flex items-center justify-between"><span className="text-slate-400">Next step</span><span className="font-bold text-emerald-600">Follow-up</span></div></div>
                <div className="mt-5 border-t border-slate-100 pt-4"><div className="text-xs font-bold text-[#110E3D]">Automated Actions</div><div className="mt-3 space-y-2"><div className="rounded-lg bg-emerald-50 p-2 text-[11px] font-semibold text-emerald-700">✓ Lead profile updated</div><div className="rounded-lg bg-blue-50 p-2 text-[11px] font-semibold text-blue-700">◷ Follow-up scheduled</div><div className="rounded-lg bg-indigo-50 p-2 text-[11px] font-semibold text-indigo-700">▣ Conversation tagged</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
