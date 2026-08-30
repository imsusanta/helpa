import Link from 'next/link';
import {
  CalendarCheck,
  MessageCircle,
  Sparkles,
  Users,
  SlidersHorizontal,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

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
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF9FC] via-[#F7F5FC] to-[#F1EEFA] pt-24 pb-10 sm:pt-28 lg:pt-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      >
        <div className="absolute top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#CFC7FF]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm">
            <MessageCircle className="h-4 w-4" />
            AI-powered WhatsApp automation for businesses
          </div>

          <h1 className="mx-auto mb-6 max-w-5xl text-5xl leading-[0.98] font-extrabold tracking-tight text-[#110E3D] sm:text-6xl lg:text-[76px]">
            Automate WhatsApp.
            <br />
            Get{' '}
            <span className="bg-gradient-to-r from-[#12B886] via-[#25CFA0] to-[#16BFAF] bg-clip-text text-transparent">
              More Leads.
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-3xl text-base leading-8 text-[#5C587D] sm:text-lg lg:text-xl">
            AI-powered WhatsApp automation that captures leads, answers
            customers, follows up automatically, and helps you turn
            conversations into sales.
          </p>

          <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={isAuthenticated ? '/dashboard' : '/signup'}
              className="flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#C4F135] via-[#7EE69D] to-[#4EE3C2] px-8 py-3.5 text-base font-bold text-[#110E3D] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              <Sparkles className="h-4 w-4" />
            </Link>
            <Link
              href="#clinic-workflow"
              className="flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3.5 text-base font-bold text-[#110E3D] shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[10px]">
                ▶
              </span>
              See how it works
            </Link>
          </div>

          <div className="mx-auto grid max-w-4xl gap-3 text-left sm:grid-cols-3">
            {outcomes.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-[0_8px_30px_rgba(17,14,61,0.06)]"
              >
                <Icon className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <div className="mb-5 flex items-center justify-center gap-2 overflow-x-auto border-b border-slate-200/80 pb-2">
            {tabs.map(({ icon: Icon, label }, index) => (
              <button
                key={label}
                type="button"
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap sm:text-base ${index === 0 ? 'border-[#110E3D] text-[#110E3D]' : 'border-transparent text-slate-500'}`}
              >
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
                <span className="ml-2 font-mono text-xs text-slate-500">
                  helpa.app/workspace/inbox
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#25D366]/20 px-3 py-1 text-[11px] font-bold text-[#075E54]">
                ● Live WhatsApp Connected
              </span>
            </div>

            <div className="grid min-h-[420px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:grid-cols-[240px_1fr_240px]">
              <div className="border-b border-slate-100 p-4 lg:border-r lg:border-b-0">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#110E3D]">
                    All Conversations (48)
                  </span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                    Real-time
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-indigo-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#110E3D]">
                        Rahul Sharma
                      </span>
                      <span className="text-[10px] text-slate-400">
                        10:15 AM
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-600">
                      🎉 Confirmed! Appointment Token #A-018
                    </p>
                    <div className="mt-2 flex gap-1">
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                        Health
                      </span>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                        AI Booked
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Sneha Mukherjee
                      </span>
                      <span className="text-[10px] text-slate-400">
                        09:40 AM
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      Can I reschedule my haircut to 2:00 PM?
                    </p>
                  </div>
                  <div className="rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Ananya Sen
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Yesterday
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      Enquiry about NEET Foundation Batch
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[420px] flex-col px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#110E3D] text-xs font-bold text-white">
                      RS
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#110E3D]">
                        Rahul Sharma
                      </div>
                      <div className="text-[10px] text-slate-400">
                        +91 98765 43210 • Lead #LP-00001
                      </div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    AI Active
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-3 py-4">
                  <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-800">
                    Hi, I would like to book an appointment with Dr. Debasish
                    Roy for tomorrow morning.
                    <div className="mt-1 text-right text-[9px] text-slate-400">
                      10:14 AM
                    </div>
                  </div>
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3 text-xs leading-relaxed text-slate-900 shadow-sm">
                    Hello Rahul! 👋 Dr. Debasish Roy is available tomorrow at
                    10:30 AM or 11:30 AM. Which time works best for you?
                    <div className="mt-1 text-right text-[9px] text-slate-400">
                      10:14 AM ✓✓
                    </div>
                  </div>
                  <div className="max-w-[30%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-xs text-slate-800">
                    10:30 AM works for me.
                    <div className="mt-1 text-right text-[9px] text-slate-400">
                      10:15 AM
                    </div>
                  </div>
                  <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3 text-xs leading-relaxed text-slate-900 shadow-sm">
                    ✅ Confirmed! Appointment booked for tomorrow at 10:30 AM.
                    Here is your OPD slip.
                    <div className="mt-1 text-right text-[9px] text-slate-400">
                      10:15 AM ✓✓
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">
                    Type a message to test AI receptionist...
                  </div>
                  <div className="rounded-xl bg-[#110E3D] p-2.5 text-white">
                    ➤
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-4 lg:border-t-0 lg:border-l">
                <div className="text-xs font-bold text-[#110E3D]">
                  Contact Profile
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Industry</span>
                    <span className="font-semibold text-rose-600">
                      Health & Clinic
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Doctor</span>
                    <span className="font-semibold">Dr. Debasish Roy</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Slot</span>
                    <span className="font-semibold">Tomorrow, 10:30 AM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Queue Token</span>
                    <span className="font-bold text-emerald-600">#A-018</span>
                  </div>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="text-xs font-bold text-[#110E3D]">
                    Automated Actions
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg bg-emerald-50 p-2 text-[11px] font-semibold text-emerald-700">
                      ✓ OPD Confirmation PDF Sent
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2 text-[11px] font-semibold text-blue-700">
                      ◷ 24h Reminder Scheduled
                    </div>
                    <div className="rounded-lg bg-indigo-50 p-2 text-[11px] font-semibold text-indigo-700">
                      ▣ Patient Timeline Updated
                    </div>
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
