'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-[#FAF9FC] border-t border-slate-200/80 pt-16 pb-12 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-slate-200/80">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#110E3D] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                <Sparkles className="w-4 h-4 text-[#B4F73C]" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-[#110E3D]">
                helpa<span className="text-[#0866FF]">.</span>
              </span>
            </Link>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              Multi-tenant, multi-industry AI business communication platform.
              Automating customer conversations, appointments, and workflows on WhatsApp.
            </p>
            <div className="text-[11px] text-slate-400">
              Built with ❤️ by <span className="font-bold text-slate-700">Helpa Studio</span>.
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#110E3D] uppercase tracking-wider text-[11px]">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="hover:text-[#110E3D] transition-colors">
                  Team Inbox
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-[#110E3D] transition-colors">
                  AI Receptionist
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-[#110E3D] transition-colors">
                  Automations
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-[#110E3D] transition-colors">
                  Pricing Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* Industry Modules */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#110E3D] uppercase tracking-wider text-[11px]">Industries</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#industries" className="hover:text-[#110E3D] transition-colors">
                  Health & Clinic
                </Link>
              </li>
              <li>
                <Link href="#industries" className="hover:text-[#110E3D] transition-colors">
                  Coaching Institute
                </Link>
              </li>
              <li>
                <Link href="#industries" className="hover:text-[#110E3D] transition-colors">
                  Solo Tutor
                </Link>
              </li>
              <li>
                <Link href="#industries" className="hover:text-[#110E3D] transition-colors">
                  Salon & Spa
                </Link>
              </li>
              <li>
                <Link href="#industries" className="hover:text-[#110E3D] transition-colors">
                  Real Estate
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Security */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#110E3D] uppercase tracking-wider text-[11px]">Legal & Trust</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="hover:text-[#110E3D] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#110E3D] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund" className="hover:text-[#110E3D] transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="#security" className="hover:text-[#110E3D] transition-colors">
                  Security Architecture
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div>© {new Date().getFullYear()} Helpa Studio. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>Official Meta Cloud API Verified</span>
            <span>•</span>
            <span>AES-256-GCM Encrypted</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
