'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Menu,
  X,
  MessageSquare,
  Bot,
  Kanban,
  Zap,
  Stethoscope,
  GraduationCap,
  BookOpen,
  Scissors,
  Building2,
  ArrowRight,
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
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-100 bg-white/90 py-3 shadow-sm backdrop-blur-md'
          : 'bg-white py-4'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="group flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/helpa-logo.png"
                alt="Helpa"
                className="h-9 w-9 rounded-xl object-contain shadow-sm transition-transform group-hover:scale-105"
              />
              <span className="text-2xl font-extrabold tracking-tight text-[#110E3D]">
                helpa<span className="text-[#0866FF]">.</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden items-center gap-1 md:flex">
              {/* Product Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setActiveDropdown('product')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 transition-colors hover:bg-slate-50 hover:text-[#110E3D]"
                >
                  Product
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                      activeDropdown === 'product'
                        ? 'rotate-180 text-[#110E3D]'
                        : ''
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
                      className="absolute top-full left-0 grid w-80 gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl"
                    >
                      <Link
                        href="#features"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Unified Team Inbox
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Shared multi-agent WhatsApp chat
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#features"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            AI Receptionist & Copilot
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Instant answers from your business knowledge
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#features"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <Kanban className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Smart CRM Pipeline
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Auto-organize appointments & sales stages
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#features"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Workflow Automations
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Triggers, reminders & PDF generator
                          </div>
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
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 transition-colors hover:bg-slate-50 hover:text-[#110E3D]"
                >
                  Industries
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                      activeDropdown === 'industries'
                        ? 'rotate-180 text-[#110E3D]'
                        : ''
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
                      className="absolute top-full left-0 grid w-80 gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl"
                    >
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                          <Stethoscope className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Health & Clinic
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Patients, OPD tickets, Doctor booking
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Coaching Institute
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Batches, admissions & fee pipeline
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Solo Tutor
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Classes, student parents & assignments
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                          <Scissors className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Salon & Beauty
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Staff slots, beauty treatments & bookings
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="#industries"
                        className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#110E3D]">
                            Real Estate
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Property matching & site visits
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pricing Link */}
              <Link
                href="#pricing"
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 transition-colors hover:bg-slate-50 hover:text-[#110E3D]"
              >
                Pricing
              </Link>

              {/* Security Link */}
              <Link
                href="#security"
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-[#110E3D]/80 transition-colors hover:bg-slate-50 hover:text-[#110E3D]"
              >
                Security
              </Link>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-[#110E3D] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1a1654] hover:shadow-lg active:scale-95"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-4 w-4 text-[#B4F73C]" />
                </button>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-semibold text-[#110E3D] transition-colors hover:text-[#0866FF]"
                >
                  Log in
                </Link>

                <Link href="/signup">
                  <button
                    type="button"
                    className="cursor-pointer rounded-full bg-[#110E3D] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1a1654] hover:shadow-lg active:scale-95"
                  >
                    Start Free Trial
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-[#110E3D] hover:bg-slate-100"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
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
            className="space-y-3 border-b border-slate-100 bg-white px-4 pt-2 pb-6 md:hidden"
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
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#110E3D] py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight className="h-4 w-4 text-[#B4F73C]" />
                  </button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[#110E3D]"
                    >
                      Log in
                    </button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-[#110E3D] py-2.5 text-sm font-semibold text-white"
                    >
                      Start Free Trial
                    </button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
