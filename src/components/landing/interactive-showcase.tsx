'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Settings2,
  TrendingUp,
  BarChart3,
  Bot,
  Send,
  CheckCheck,
  Clock,
  Zap,
  FileText,
  Check,
} from 'lucide-react';

type TabType = 'capture' | 'automate' | 'scale' | 'analyze';

export function LandingInteractiveShowcase() {
  const [activeTab, setActiveTab] = useState<TabType>('capture');
  const [chatMessage, setChatMessage] = useState('');
  const [simulatedReplies, setSimulatedReplies] = useState<
    Array<{ sender: 'user' | 'bot'; text: string; time: string }>
  >([
    {
      sender: 'user',
      text: 'Hi, I would like to book an appointment with Dr. Debasish Roy for tomorrow morning.',
      time: '10:14 AM',
    },
    {
      sender: 'bot',
      text: 'Hello Rahul! 👋 Dr. Debasish Roy is available tomorrow at 10:30 AM or 11:30 AM. Would 10:30 AM work best for you?',
      time: '10:14 AM',
    },
    {
      sender: 'user',
      text: 'Yes, 10:30 AM is perfect.',
      time: '10:15 AM',
    },
    {
      sender: 'bot',
      text: '🎉 Confirmed! Appointment Token #A-018 has been booked for tomorrow at 10:30 AM. Here is your digital OPD slip 📄',
      time: '10:15 AM',
    },
  ]);

  const handleSendSimulatedMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = {
      sender: 'user' as const,
      text: chatMessage.trim(),
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setSimulatedReplies((prev) => [...prev, userMsg]);
    setChatMessage('');

    setTimeout(() => {
      setSimulatedReplies((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '✨ Helpa AI Copilot: Instant reply drafted from your Knowledge Base & verified with live calendar availability.',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    }, 600);
  };

  return (
    <section
      id="features"
      className="bg-gradient-to-b from-[#F1EEFA] to-[#FAF9FC] py-8"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 4 Category Switcher Tabs */}
        <div className="mb-8 flex items-center justify-center gap-2 overflow-x-auto border-b border-slate-200/80 pb-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('capture')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap transition-all sm:text-base ${
              activeTab === 'capture'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Capture</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('automate')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap transition-all sm:text-base ${
              activeTab === 'automate'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span>Automate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scale')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap transition-all sm:text-base ${
              activeTab === 'scale'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Scale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap transition-all sm:text-base ${
              activeTab === 'analyze'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analyze</span>
          </button>
        </div>

        {/* Outer Soft Lilac Showcase Frame */}
        <div className="relative rounded-3xl border border-indigo-100/60 bg-[#EBE9FC] p-3 shadow-2xl sm:p-6 lg:p-8">
          {/* Top Window Chrome */}
          <div className="mb-4 flex items-center justify-between border-b border-indigo-200/40 px-2 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-400" />
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 font-mono text-xs text-slate-500">
                helpa.app/workspace/inbox
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#110E3D]">
              <span className="inline-flex items-center rounded-full bg-[#25D366]/20 px-2 py-0.5 text-[11px] font-bold text-[#075E54]">
                ● Live WhatsApp Connected
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* 1. CAPTURE TAB */}
            {activeTab === 'capture' && (
              <motion.div
                key="capture"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="grid min-h-[520px] grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-12"
              >
                {/* Column 1: Left Chat Thread List (3 cols) */}
                <div className="space-y-2 border-r border-slate-100 pr-3 lg:col-span-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-[#110E3D]">
                      All Conversations (48)
                    </span>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Real-time
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Active Conversation */}
                    <div className="cursor-pointer rounded-xl border border-indigo-100 bg-slate-50 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#110E3D]">
                          Rahul Sharma
                        </span>
                        <span className="text-[10px] text-slate-400">
                          10:15 AM
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600">
                        🎉 Confirmed! Appointment Token #A-018
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="py-0.2 rounded-full bg-blue-100 px-1.5 text-[9px] font-semibold text-blue-700">
                          Health
                        </span>
                        <span className="py-0.2 rounded-full bg-emerald-100 px-1.5 text-[9px] font-semibold text-emerald-700">
                          AI Booked
                        </span>
                      </div>
                    </div>

                    {/* Inactive Conversation 1 */}
                    <div className="cursor-pointer rounded-xl border border-transparent p-2.5 transition-colors hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Sneha Mukherjee
                        </span>
                        <span className="text-[10px] text-slate-400">
                          09:40 AM
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        Can I reschedule my haircut to 2:00 PM?
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="py-0.2 rounded-full bg-pink-100 px-1.5 text-[9px] font-semibold text-pink-700">
                          Salon
                        </span>
                      </div>
                    </div>

                    {/* Inactive Conversation 2 */}
                    <div className="cursor-pointer rounded-xl border border-transparent p-2.5 transition-colors hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Ananya Sen
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Yesterday
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        Enquiry about NEET Foundation Batch
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="py-0.2 rounded-full bg-indigo-100 px-1.5 text-[9px] font-semibold text-indigo-700">
                          Coaching
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Center Live WhatsApp Simulator (6 cols) */}
                <div className="flex flex-col justify-between px-2 sm:px-4 lg:col-span-6">
                  {/* Chat Header */}
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
                          +91 98765 43210 • Patient #PT-000001
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      <Bot className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="text-[11px] font-semibold">
                        AI Copilot Active
                      </span>
                    </div>
                  </div>

                  {/* Message Stream */}
                  <div className="max-h-[340px] space-y-3 overflow-y-auto py-4 pr-1">
                    {simulatedReplies.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex flex-col ${
                          msg.sender === 'user' ? 'items-start' : 'items-end'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'rounded-tl-sm bg-slate-100 text-slate-800'
                              : 'rounded-tr-sm bg-[#DCF8C6] text-slate-900 shadow-xs'
                          }`}
                        >
                          {msg.text}
                          <div className="mt-1 flex items-center justify-end gap-1 text-right text-[9px] text-slate-400">
                            {msg.time}
                            {msg.sender === 'bot' && (
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input Form */}
                  <form
                    onSubmit={handleSendSimulatedMessage}
                    className="flex items-center gap-2 border-t border-slate-100 pt-3"
                  >
                    <input
                      type="text"
                      placeholder="Type a message to test AI receptionist..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-[#110E3D] placeholder:text-slate-400 focus:ring-1 focus:ring-[#110E3D] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#110E3D] p-2.5 text-white transition-colors hover:bg-slate-800"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>

                {/* Column 3: Right Smart CRM Card (3 cols) */}
                <div className="space-y-4 border-l border-slate-100 pl-3 lg:col-span-3">
                  <div>
                    <span className="text-xs font-bold text-[#110E3D]">
                      Contact Profile
                    </span>
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Industry:</span>
                        <span className="font-semibold text-rose-600">
                          Health & Clinic
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Doctor:</span>
                        <span className="font-semibold">Dr. Debasish Roy</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Slot:</span>
                        <span className="font-semibold">
                          Tomorrow, 10:30 AM
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Queue Token:</span>
                        <span className="font-bold text-emerald-600">
                          #A-018
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-xs font-bold text-[#110E3D]">
                      Automated Actions
                    </span>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>OPD Confirmation PDF Sent</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-2 text-[11px] text-blue-800">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        <span>24h Reminder Scheduled</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-2 text-[11px] text-indigo-800">
                        <FileText className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Patient Timeline Updated</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. AUTOMATE TAB */}
            {activeTab === 'automate' && (
              <motion.div
                key="automate"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm"
              >
                <div className="max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    <Zap className="h-3.5 w-3.5" />
                    Visual Workflow Automation Engine
                  </div>
                  <h3 className="text-2xl font-bold text-[#110E3D]">
                    Set it once. Let WhatsApp run 24/7 on autopilot.
                  </h3>
                  <p className="text-sm text-slate-500">
                    Automate lead qualification, appointment booking, payment
                    links, prescription alerts, and retention follow-ups with
                    zero coding.
                  </p>

                  <div className="grid grid-cols-1 gap-4 pt-4 text-left sm:grid-cols-3">
                    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700">
                        1
                      </div>
                      <div className="text-xs font-bold text-[#110E3D]">
                        Trigger Event
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Inbound WhatsApp message, unread message timeout, or new
                        appointment enquiry.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                        2
                      </div>
                      <div className="text-xs font-bold text-[#110E3D]">
                        AI Intelligence
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Classifies intent, searches Knowledge Base, and checks
                        real-time doctor/staff availability.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">
                        3
                      </div>
                      <div className="text-xs font-bold text-[#110E3D]">
                        Automated Action
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sends instant reply, creates CRM contact, generates PDF
                        slip, and schedules reminders.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. SCALE TAB */}
            {activeTab === 'scale' && (
              <motion.div
                key="scale"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm"
              >
                <div className="max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Multi-Agent & Multi-Industry Scalability
                  </div>
                  <h3 className="text-2xl font-bold text-[#110E3D]">
                    Handles 100,000+ customer messages with zero slowdown
                  </h3>
                  <p className="text-sm text-slate-500">
                    Connect multiple team members to a single official WhatsApp
                    number. Helpa routes messages intelligently to AI or
                    specialized agents.
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-4 text-center sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-2xl font-extrabold text-[#110E3D]">
                        &lt; 3s
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Average AI Response Time
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-2xl font-extrabold text-emerald-600">
                        99.9%
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Webhook Delivery Rate
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-2xl font-extrabold text-blue-600">
                        5x
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Booking Conversion Lift
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-2xl font-extrabold text-purple-600">
                        100%
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Multi-Tenant Isolation
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 4. ANALYZE TAB */}
            {activeTab === 'analyze' && (
              <motion.div
                key="analyze"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm"
              >
                <div className="max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Real-time ROI & Performance Analytics
                  </div>
                  <h3 className="text-2xl font-bold text-[#110E3D]">
                    Know exactly how much revenue your WhatsApp generates
                  </h3>
                  <p className="text-sm text-slate-500">
                    Track conversion funnels, appointments booked, broadcast
                    campaign open rates, and agent response times in real time.
                  </p>

                  <div className="grid grid-cols-1 gap-4 pt-4 text-left sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Bookings This Month
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-[#110E3D]">
                        1,482
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-emerald-600">
                        ↑ +28% vs last month
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Broadcast Open Rate
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-[#110E3D]">
                        98.4%
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-emerald-600">
                        Industry leading WhatsApp read rate
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Hours Saved / Week
                      </span>
                      <div className="mt-1 text-2xl font-extrabold text-[#110E3D]">
                        42 hrs
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-blue-600">
                        Automated by AI Receptionist
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
