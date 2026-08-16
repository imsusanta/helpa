'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Menu,
  X,
  Stethoscope,
  GraduationCap,
  BookOpen,
  Scissors,
  Building2,
  Bot,
  Inbox,
  Workflow,
  BarChart3,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/85 backdrop-blur-md border-b border-border/60 py-3 shadow-sm'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                HELPA
              </span>
              <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                AI Platform
              </span>
            </div>
            <span className="text-[9px] font-medium tracking-wider text-muted-foreground uppercase -mt-0.5">
              by Helpa Studio
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a
            href="#product"
            className="hover:text-foreground transition-colors"
          >
            Product
          </a>
          <a
            href="#ai-copilot"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-500" />
            AI Copilot
          </a>
          <a
            href="#industries"
            className="hover:text-foreground transition-colors"
          >
            Industries
          </a>
          <a
            href="#automations"
            className="hover:text-foreground transition-colors"
          >
            Automations
          </a>
          <a
            href="#pricing"
            className="hover:text-foreground transition-colors"
          >
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-muted font-medium text-sm"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 gap-1.5 px-4"
            >
              <span>Start Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex items-center sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden bg-background/95 backdrop-blur-lg border-b border-border/80 px-4 pt-3 pb-6 space-y-4"
          >
            <nav className="flex flex-col space-y-3 pt-2 text-sm font-medium text-muted-foreground">
              <a
                href="#product"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-foreground"
              >
                Product Overview
              </a>
              <a
                href="#ai-copilot"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 flex items-center gap-2 text-foreground"
              >
                <Bot className="w-4 h-4 text-emerald-500" />
                AI Agent & Copilot
              </a>
              <a
                href="#industries"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-foreground"
              >
                Industry Workflows
              </a>
              <a
                href="#automations"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-foreground"
              >
                Visual Automations
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-foreground"
              >
                Plans & Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-foreground"
              >
                Frequently Asked Questions
              </a>
            </nav>

            <div className="pt-3 border-t border-border flex flex-col gap-2.5">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full justify-center">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Start Free 14-Day Trial
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
