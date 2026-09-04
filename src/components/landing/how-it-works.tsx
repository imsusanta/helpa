'use client';

import Link from 'next/link';
import {
  MessageSquare,
  Bot,
  Rocket,
  ArrowRight,
  TrendingUp,
  Clock,
  HelpCircle,
  Settings2,
  BookOpen,
} from 'lucide-react';

export function LandingHowItWorks() {
  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#00A884]">
            HOW IT WORKS
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl leading-tight">
            Get Started in <span className="text-[#00A884]">3 Simple Steps</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500 font-normal">
            Launch your AI receptionist in minutes and start converting conversations.
          </p>
        </div>

        {/* Step Numbers & Icons Flow (Desktop & Tablet) */}
        <div className="mt-14 mb-8 hidden md:grid md:grid-cols-3 items-center max-w-5xl mx-auto">
          
          {/* Step 1 Flow Header */}
          <div className="flex flex-col items-center relative">
            <span className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#00A884] text-xs font-bold text-white shadow-sm">
              1
            </span>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F8EE] text-[#00A884] shadow-sm">
              <MessageSquare className="h-7 w-7 fill-[#00A884] text-[#00A884]" />
            </div>

            {/* Dotted Arrow to Step 2 */}
            <div className="absolute top-[60%] -right-12 lg:-right-16 w-24 lg:w-32 flex items-center">
              <div className="w-full border-t-2 border-dashed border-[#00A884]/40" />
              <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-6 border-l-[#00A884]" />
            </div>
          </div>

          {/* Step 2 Flow Header */}
          <div className="flex flex-col items-center relative">
            <span className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#00A884] text-xs font-bold text-white shadow-sm">
              2
            </span>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F8EE] text-[#00A884] shadow-sm">
              <Bot className="h-7 w-7 text-[#00A884]" />
            </div>

            {/* Dotted Arrow to Step 3 */}
            <div className="absolute top-[60%] -right-12 lg:-right-16 w-24 lg:w-32 flex items-center">
              <div className="w-full border-t-2 border-dashed border-[#00A884]/40" />
              <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-6 border-l-[#00A884]" />
            </div>
          </div>

          {/* Step 3 Flow Header */}
          <div className="flex flex-col items-center">
            <span className="mb-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#00A884] text-xs font-bold text-white shadow-sm">
              3
            </span>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F8EE] text-[#00A884] shadow-sm">
              <Rocket className="h-7 w-7 text-[#00A884]" />
            </div>
          </div>

        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          
          {/* STEP 1 */}
          <div className="flex flex-col">
            {/* Mobile Step Badge */}
            <div className="md:hidden flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00A884] text-xs font-bold text-white">
                1
              </span>
              <span className="text-xs font-bold text-[#00A884] uppercase">Step 1</span>
            </div>

            {/* Preview Box */}
            <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-3xl border border-slate-100 bg-[#F4FBF7] p-5 shadow-sm">
              {/* Background Watermark WhatsApp Icon */}
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex h-20 w-20 items-center justify-center rounded-full bg-[#00A884] text-white shadow-lg opacity-90">
                <MessageSquare className="h-10 w-10 fill-white" />
              </div>

              {/* Foreground White Dialog */}
              <div className="relative z-10 w-full max-w-[215px] rounded-2xl border border-slate-100 bg-white p-4 shadow-lg">
                <div className="text-xs font-bold text-slate-900 leading-tight">Connect WhatsApp</div>
                <div className="mt-1 text-[10px] text-slate-500 leading-snug">
                  Connect your WhatsApp Business number to get started.
                </div>
                
                {/* Phone Input Box */}
                <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-800 font-mono">
                  <span className="text-xs">🇮🇳</span>
                  <span>+91 9547771118</span>
                </div>

                {/* Connect Button */}
                <button
                  type="button"
                  className="mt-2.5 w-full rounded-lg bg-[#00A884] py-1.5 text-center text-xs font-bold text-white shadow-sm hover:bg-[#008f70] transition"
                >
                  Connect
                </button>
              </div>
            </div>

            {/* Step Text Below */}
            <div className="mt-6 text-center">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                1. Connect Your WhatsApp
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Connect your WhatsApp Business number in a few clicks and we&apos;ll sync everything instantly.
              </p>
            </div>
          </div>

          {/* STEP 2 */}
          <div className="flex flex-col">
            {/* Mobile Step Badge */}
            <div className="md:hidden flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00A884] text-xs font-bold text-white">
                2
              </span>
              <span className="text-xs font-bold text-[#00A884] uppercase">Step 2</span>
            </div>

            {/* Preview Box */}
            <div className="flex min-h-[220px] rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden text-[10px]">
              
              {/* Left Mini Sidebar */}
              <div className="w-[110px] border-r border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between">
                <div>
                  <div className="font-extrabold text-slate-900 text-[11px] mb-2">AI Receptionist</div>
                  <div className="space-y-1 text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5 rounded-md bg-[#E8F8EE] px-1.5 py-1 text-[#00A884] font-bold">
                      <MessageSquare className="h-3 w-3" />
                      <span className="truncate">Welcome Message</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-1 text-slate-600">
                      <BookOpen className="h-3 w-3 text-slate-400" />
                      <span className="truncate">Business Info</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-1 text-slate-600">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="truncate">Working Hours</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-1 text-slate-600">
                      <HelpCircle className="h-3 w-3 text-slate-400" />
                      <span className="truncate">FAQs</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-1 text-slate-600">
                      <Settings2 className="h-3 w-3 text-slate-400" />
                      <span className="truncate">Behavior</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Mini Chat Simulator */}
              <div className="flex-1 p-3 bg-slate-50/40 flex flex-col justify-center space-y-2">
                <div className="max-w-[85%] rounded-xl bg-white p-2 text-slate-800 shadow-sm border border-slate-100">
                  <p className="leading-snug">Hi! ☀️<br />How can I help you today?</p>
                </div>
                <div className="ml-auto max-w-[85%] rounded-xl bg-[#E8F8EE] p-2 text-slate-900 shadow-sm border border-[#00A884]/20">
                  <p className="leading-snug">I want to book an appointment.</p>
                </div>
                <div className="max-w-[85%] rounded-xl bg-white p-2 text-slate-800 shadow-sm border border-slate-100">
                  <p className="leading-snug">Sure! May I know your preferred date and time?</p>
                </div>
              </div>

            </div>

            {/* Step Text Below */}
            <div className="mt-6 text-center">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                2. Configure Your AI
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Set your business info, working hours, FAQs and let AI handle conversations the way you want.
              </p>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="flex flex-col">
            {/* Mobile Step Badge */}
            <div className="md:hidden flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00A884] text-xs font-bold text-white">
                3
              </span>
              <span className="text-xs font-bold text-[#00A884] uppercase">Step 3</span>
            </div>

            {/* Preview Box */}
            <div className="min-h-[220px] rounded-3xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="font-extrabold text-xs text-slate-900">Live Dashboard</div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00A884]">
                  <span className="h-2 w-2 rounded-full bg-[#00A884] animate-pulse" />
                  <span>AI is Active</span>
                </div>
              </div>

              {/* 2x2 Metric Cards */}
              <div className="grid grid-cols-2 gap-2.5 my-2">
                
                {/* Metric 1 */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="text-[10px] text-slate-500 font-medium">Conversations</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">128</div>
                  <div className="mt-1 h-3 flex items-end">
                    <svg viewBox="0 0 60 15" className="w-full h-full stroke-emerald-500 fill-emerald-500/15" preserveAspectRatio="none">
                      <path d="M0 12 Q15 4, 30 8 T60 2 L60 15 L0 15 Z" />
                      <path d="M0 12 Q15 4, 30 8 T60 2" fill="none" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="text-[10px] text-slate-500 font-medium">New Leads</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">45</div>
                  <div className="mt-1 h-3 flex items-end">
                    <svg viewBox="0 0 60 15" className="w-full h-full stroke-purple-500 fill-purple-500/15" preserveAspectRatio="none">
                      <path d="M0 14 Q20 2, 40 10 T60 4 L60 15 L0 15 Z" />
                      <path d="M0 14 Q20 2, 40 10 T60 4" fill="none" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="text-[10px] text-slate-500 font-medium">Appointments</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">28</div>
                  <div className="mt-1 h-3 flex items-end">
                    <svg viewBox="0 0 60 15" className="w-full h-full stroke-amber-500 fill-amber-500/15" preserveAspectRatio="none">
                      <path d="M0 10 Q15 13, 30 5 T60 3 L60 15 L0 15 Z" />
                      <path d="M0 10 Q15 13, 30 5 T60 3" fill="none" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="text-[10px] text-slate-500 font-medium">Closed Deals</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">16</div>
                  <div className="mt-1 h-3 flex items-end">
                    <svg viewBox="0 0 60 15" className="w-full h-full stroke-blue-500 fill-blue-500/15" preserveAspectRatio="none">
                      <path d="M0 14 Q25 12, 45 6 T60 2 L60 15 L0 15 Z" />
                      <path d="M0 14 Q25 12, 45 6 T60 2" fill="none" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

              </div>
            </div>

            {/* Step Text Below */}
            <div className="mt-6 text-center">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                3. Go Live & Grow
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Your AI receptionist is live 24/7 – engaging leads, booking appointments and growing your business.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-16 max-w-4xl mx-auto rounded-3xl border border-emerald-100 bg-[#F0FDF4] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow-md shadow-[#00A884]/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                That&apos;s it! Your AI receptionist is ready to work for you{' '}
                <span className="text-[#00A884]">24/7.</span>
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                Save time. Engage more leads. Close more deals.
              </p>
            </div>
          </div>

          <Link
            href="/signup"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#00A884] hover:bg-[#008f70] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#00A884]/25 transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Book a Demo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

        </div>

      </div>
    </section>
  );
}
