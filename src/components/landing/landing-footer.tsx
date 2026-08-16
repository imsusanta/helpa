'use client';

import Link from 'next/link';
import { Sparkles, Heart } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-card border-t border-border py-16 text-muted-foreground text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-foreground">
                  HELPA
                </span>
                <span className="text-[9px] font-medium tracking-wider text-muted-foreground uppercase -mt-0.5">
                  by Helpa Studio
                </span>
              </div>
            </Link>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Helpa is the unified AI communication and CRM platform turning WhatsApp conversations into revenue, bookings, and loyal customers for modern businesses.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Official Meta WhatsApp Cloud API Solution Provider.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#product" className="hover:text-foreground transition-colors">
                  Team Inbox
                </a>
              </li>
              <li>
                <a href="#ai-copilot" className="hover:text-foreground transition-colors">
                  AI Agent & Copilot
                </a>
              </li>
              <li>
                <a href="#product" className="hover:text-foreground transition-colors">
                  Contact CRM
                </a>
              </li>
              <li>
                <a href="#automations" className="hover:text-foreground transition-colors">
                  Workflow Automations
                </a>
              </li>
              <li>
                <a href="#product" className="hover:text-foreground transition-colors">
                  Broadcast Campaigns
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground transition-colors">
                  Plans & Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Industry Solutions */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
              Industries
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/signup?industry=health" className="hover:text-foreground transition-colors">
                  Health & Clinics
                </Link>
              </li>
              <li>
                <Link href="/signup?industry=coaching" className="hover:text-foreground transition-colors">
                  Coaching Institutes
                </Link>
              </li>
              <li>
                <Link href="/signup?industry=solo_teacher" className="hover:text-foreground transition-colors">
                  Solo Tutors & Teachers
                </Link>
              </li>
              <li>
                <Link href="/signup?industry=salon" className="hover:text-foreground transition-colors">
                  Beauty Salons & Spas
                </Link>
              </li>
              <li>
                <Link href="/signup?industry=real_estate" className="hover:text-foreground transition-colors">
                  Real Estate Agencies
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Company */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
              Company & Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  Contact Sales & Support
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund" className="hover:text-foreground transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Account Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© {new Date().getFullYear()} Helpa by Helpa Studio. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Built with precision for modern service businesses</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
