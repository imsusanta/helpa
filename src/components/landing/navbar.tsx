'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Menu,
  X,
  Sparkles,
  MessageSquare,
  Bot,
  Kanban,
  Zap,
  Stethoscope,
  GraduationCap,
  BookOpen,
  Scissors,
  Building2,
  ShieldCheck,
  ArrowRight,
  Globe,
} from 'lucide-react';

interface NavbarProps {
  isAuthenticated: boolean;
}

export function LandingNavbar({ isAuthenticated }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm py-3'
          : 'bg-white py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-[#110E3D] flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-[#B4F73C]" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-[#110E3D]">
                helpa<span className="text-[#0866FF]">.</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {/* Product Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setActiveDropdown('product')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 hover:text-[#110E3D] transition-colors rounded-lg hover:bg-slate-50"
                >
                  Product
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      activeDropdown === 'product' ? 'rotate-180 text-[#110E3D]' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {activeDropdown === 'product' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 w-80 p-3 bg-white rounded-2xl shadow-xl border border-slate-100 grid gap-2"
                    >
                      <Link
                        href="#features"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Unified Team Inbox</div>
                          <div className="text-[11px] text-slate-500">Shared multi-agent WhatsApp chat</div>
                        </div>
                      </Link>
                      <Link
                        href="#features"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">AI Receptionist & Copilot</div>
                          <div className="text-[11px] text-slate-500">Instant answers from your business knowledge</div>
                        </div>
                      </Link>
                      <Link
                        href="#features"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Kanban className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Smart CRM Pipeline</div>
                          <div className="text-[11px] text-slate-500">Auto-organize appointments & sales stages</div>
                        </div>
                      </Link>
                      <Link
                        href="#features"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Workflow Automations</div>
                          <div className="text-[11px] text-slate-500">Triggers, reminders & PDF generator</div>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Industries Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setActiveDropdown('industries')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 hover:text-[#110E3D] transition-colors rounded-lg hover:bg-slate-50"
                >
                  Industries
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      activeDropdown === 'industries' ? 'rotate-180 text-[#110E3D]' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {activeDropdown === 'industries' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 w-80 p-3 bg-white rounded-2xl shadow-xl border border-slate-100 grid gap-2"
                    >
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Health & Clinic</div>
                          <div className="text-[11px] text-slate-500">Patients, OPD tickets, Doctor booking</div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Coaching Institute</div>
                          <div className="text-[11px] text-slate-500">Batches, admissions & fee pipeline</div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Solo Tutor</div>
                          <div className="text-[11px] text-slate-500">Classes, student parents & assignments</div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                          <Scissors className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Salon & Beauty</div>
                          <div className="text-[11px] text-slate-500">Staff slots, beauty treatments & bookings</div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">Real Estate</div>
                          <div className="text-[11px] text-slate-500">Property matching & site visits</div>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pricing Link */}
              <Link
                href="#pricing"
                className="px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 hover:text-[#110E3D] transition-colors rounded-lg hover:bg-slate-50"
              >
                Pricing
              </Link>

              {/* Security Link */}
              <Link
                href="#security"
                className="px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 hover:text-[#110E3D] transition-colors rounded-lg hover:bg-slate-50"
              >
                Security
              </Link>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href={isAuthenticated ? '/dashboard' : '/login'}
              className="px-4 py-2 text-sm font-semibold text-[#110E3D] hover:text-[#0866FF] transition-colors"
            >
              {isAuthenticated ? 'Dashboard' : 'Log in'}
            </Link>

            <Link href={isAuthenticated ? '/dashboard' : '/signup'}>
              <button
                type="button"
                className="px-5 py-2.5 rounded-full bg-[#110E3D] text-white text-sm font-semibold hover:bg-[#1a1654] transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                {isAuthenticated ? 'Open Helpa' : 'Start Free Trial'}
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#110E3D] rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Modal */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-slate-100 bg-white px-4 pt-2 pb-6 space-y-3"
          >
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#110E3D]"
            >
              Product & Features
            </Link>
            <Link
              href="#industries"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#110E3D]"
            >
              Industries
            </Link>
            <Link
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#110E3D]"
            >
              Pricing
            </Link>
            <Link
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#110E3D]"
            >
              Security
            </Link>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link href={isAuthenticated ? '/dashboard' : '/login'}>
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-[#110E3D]"
                >
                  {isAuthenticated ? 'Open Dashboard' : 'Log in'}
                </button>
              </Link>
              <Link href={isAuthenticated ? '/dashboard' : '/signup'}>
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-[#110E3D] text-white text-sm font-semibold"
                >
                  Start Free Trial
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
