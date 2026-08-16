'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Settings2,
  TrendingUp,
  BarChart3,
  Bot,
  Sparkles,
  Send,
  CheckCheck,
  Calendar,
  Clock,
  User,
  Phone,
  Tag,
  ArrowRight,
  Zap,
  Play,
  FileText,
  ShieldCheck,
  Check,
} from 'lucide-react';

type TabType = 'capture' | 'automate' | 'scale' | 'analyze';

export function LandingInteractiveShowcase() {
  const [activeTab, setActiveTab] = useState<TabType>('capture');
  const [activeChatTab, setActiveChatTab] = useState<'health' | 'salon' | 'coaching'>('health');
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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSimulatedReplies((prev) => [...prev, userMsg]);
    setChatMessage('');

    setTimeout(() => {
      setSimulatedReplies((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '✨ Helpa AI Copilot: Instant reply drafted from your Knowledge Base & verified with live calendar availability.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 600);
  };

  return (
    <section id="features" className="py-8 bg-gradient-to-b from-[#F1EEFA] to-[#FAF9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 4 Category Switcher Tabs */}
        <div className="flex items-center justify-center gap-2 sm:gap-6 border-b border-slate-200/80 mb-8 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('capture')}
            className={`flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'capture'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Capture</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('automate')}
            className={`flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'automate'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Automate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scale')}
            className={`flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'scale'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Scale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 px-4 py-3 text-sm sm:text-base font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'analyze'
                ? 'border-[#110E3D] text-[#110E3D]'
                : 'border-transparent text-slate-500 hover:text-[#110E3D]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analyze</span>
          </button>
        </div>

        {/* Outer Soft Lilac Showcase Frame */}
        <div className="relative rounded-3xl bg-[#EBE9FC] p-3 sm:p-6 lg:p-8 shadow-2xl border border-indigo-100/60">
          {/* Top Window Chrome */}
          <div className="flex items-center justify-between pb-4 border-b border-indigo-200/40 mb-4 px-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs font-mono text-slate-500">helpa.app/workspace/inbox</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#110E3D]">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#25D366]/20 text-[#075E54]">
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
                className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 min-h-[520px]"
              >
                {/* Column 1: Left Chat Thread List (3 cols) */}
                <div className="lg:col-span-3 border-r border-slate-100 pr-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-[#110E3D]">All Conversations (48)</span>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Real-time
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Active Conversation */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-indigo-100 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#110E3D]">Rahul Sharma</span>
                        <span className="text-[10px] text-slate-400">10:15 AM</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">
                        🎉 Confirmed! Appointment Token #A-018
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[9px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full">
                          Health
                        </span>
                        <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-full">
                          AI Booked
                        </span>
                      </div>
                    </div>

                    {/* Inactive Conversation 1 */}
                    <div className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Sneha Mukherjee</span>
                        <span className="text-[10px] text-slate-400">09:40 AM</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Can I reschedule my haircut to 2:00 PM?
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[9px] font-semibold bg-pink-100 text-pink-700 px-1.5 py-0.2 rounded-full">
                          Salon
                        </span>
                      </div>
                    </div>

                    {/* Inactive Conversation 2 */}
                    <div className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Ananya Sen</span>
                        <span className="text-[10px] text-slate-400">Yesterday</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Enquiry about NEET Foundation Batch
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[9px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full">
                          Coaching
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Center Live WhatsApp Simulator (6 cols) */}
                <div className="lg:col-span-6 flex flex-col justify-between px-2 sm:px-4">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#110E3D] text-white flex items-center justify-center font-bold text-xs">
                        RS
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#110E3D]">Rahul Sharma</div>
                        <div className="text-[10px] text-slate-400">+91 98765 43210 • Patient #PT-000001</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Bot className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="font-semibold text-[11px]">AI Copilot Active</span>
                    </div>
                  </div>

                  {/* Message Stream */}
                  <div className="py-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
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
                              ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                              : 'bg-[#DCF8C6] text-slate-900 shadow-xs rounded-tr-sm'
                          }`}
                        >
                          {msg.text}
                          <div className="text-[9px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
                            {msg.time}
                            {msg.sender === 'bot' && <CheckCheck className="w-3 h-3 text-blue-500" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input Form */}
                  <form
                    onSubmit={handleSendSimulatedMessage}
                    className="flex items-center gap-2 pt-3 border-t border-slate-100"
                  >
                    <input
                      type="text"
                      placeholder="Type a message to test AI receptionist..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#110E3D] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#110E3D]"
                    />
                    <button
                      type="submit"
                      className="p-2.5 rounded-xl bg-[#110E3D] text-white hover:bg-slate-800 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Column 3: Right Smart CRM Card (3 cols) */}
                <div className="lg:col-span-3 border-l border-slate-100 pl-3 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-[#110E3D]">Contact Profile</span>
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Industry:</span>
                        <span className="font-semibold text-rose-600">Health & Clinic</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Doctor:</span>
                        <span className="font-semibold">Dr. Debasish Roy</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Slot:</span>
                        <span className="font-semibold">Tomorrow, 10:30 AM</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Queue Token:</span>
                        <span className="font-bold text-emerald-600">#A-018</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-[#110E3D]">Automated Actions</span>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[11px]">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>OPD Confirmation PDF Sent</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 text-blue-800 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>24h Reminder Scheduled</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 text-indigo-800 text-[11px]">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
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
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 min-h-[520px] flex flex-col justify-center items-center text-center"
              >
                <div className="max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    Visual Workflow Automation Engine
                  </div>
                  <h3 className="text-2xl font-bold text-[#110E3D]">
                    Set it once. Let WhatsApp run 24/7 on autopilot.
                  </h3>
                  <p className="text-sm text-slate-500">
                    Automate lead qualification, appointment booking, payment links, prescription alerts, and retention follow-ups with zero coding.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <div className="text-xs font-bold text-[#110E3D]">Trigger Event</div>
                      <p className="text-[11px] text-slate-500">
                        Inbound WhatsApp message, unread message timeout, or new appointment enquiry.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <div className="text-xs font-bold text-[#110E3D]">AI Intelligence</div>
                      <p className="text-[11px] text-slate-500">
                        Classifies intent, searches Knowledge Base, and checks real-time doctor/staff availability.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <div className="text-xs font-bold text-[#110E3D]">Automated Action</div>
                      <p className="text-[11px] text-slate-500">
                        Sends instant reply, creates CRM contact, generates PDF slip, and schedules reminders.
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
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 min-h-[520px] flex flex-col justify-center items-center text-center"
              >
                <div className="max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Multi-Agent & Multi-Industry Scalability
                  </div>
                  <h3 className="text-2xl font-bold text-[#110E3D]">
                    Handles 100,000+ customer messages with zero slowdown
                  </h3>
                  <p className="text-sm text-slate-500">
                    Connect multiple team members to a single official WhatsApp number. Helpa routes messages intelligently to AI or specialized agents.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center pt-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-2xl font-extrabold text-[#110E3D]">&lt; 3s</div>
                      <div className="text-xs text-slate-500 mt-1">Average AI Response Time</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-2xl font-extrabold text-emerald-600">99.9%</div>
                      <div className="text-xs text-slate-500 mt-1">Webhook Delivery Rate</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-2xl font-extrabold text-blue-600">5x</div>
                      <div className="text-xs text-slate-500 mt-1">Booking Conversion Lift</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-2xl font-extrabold text-purple-600">100%</div>
                      <div className="text-xs text-slate-500 mt-1">Multi-Tenant Isolation</div>
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
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 min-h-[520px] flex flex-col justify-center items-center text-center"
              >
                <div className="max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Real-time ROI & Performance Analytics
                  </div>
                  <h3 className="text-2xl font-bold text-[#110E3D]">
                    Know exactly how much revenue your WhatsApp generates
                  </h3>
                  <p className="text-sm text-slate-500">
                    Track conversion funnels, appointments booked, broadcast campaign open rates, and agent response times in real time.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Bookings This Month
                      </span>
                      <div className="text-2xl font-extrabold text-[#110E3D] mt-1">1,482</div>
                      <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                        ↑ +28% vs last month
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Broadcast Open Rate
                      </span>
                      <div className="text-2xl font-extrabold text-[#110E3D] mt-1">98.4%</div>
                      <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                        Industry leading WhatsApp read rate
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Hours Saved / Week
                      </span>
                      <div className="text-2xl font-extrabold text-[#110E3D] mt-1">42 hrs</div>
                      <div className="text-[11px] text-blue-600 font-semibold mt-1">
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
