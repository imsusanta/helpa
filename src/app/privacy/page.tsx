"use client";

import Link from "next/link";
import { MessageSquare, ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";

export default function PrivacyPolicyPage() {
  const { mode, toggleMode } = useTheme();

  return (
    <div className="bg-background text-foreground antialiased selection:bg-indigo-600 selection:text-white min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* Background Aurora Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Helpa</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMode}
              className="p-2 rounded-full border border-border bg-card hover:bg-accent text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>
            <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24 relative z-10">
        
        {/* Title Block */}
        <div className="text-center md:text-left space-y-4 mb-16">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 mb-2">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: July 10, 2026
          </p>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            At Helpa Studio ("Helpa", "we", "us", or "our"), we protect your privacy. This Privacy Policy explains how we collect, use, and share information when you use our WhatsApp CRM services, website, and software products.
          </p>
        </div>

        {/* Highlight Cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-16">
          <div className="p-5 rounded-2xl border border-border bg-card/50 backdrop-blur-sm space-y-3">
            <Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-sm text-foreground">End-to-End Security</h3>
            <p className="text-xs text-muted-foreground">Your chat data, templates, and contact registers are encrypted and secured in isolation.</p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card/50 backdrop-blur-sm space-y-3">
            <Eye className="h-5 w-5 text-emerald-500" />
            <h3 className="font-bold text-sm text-foreground">No Hidden Tracking</h3>
            <p className="text-xs text-muted-foreground">We never sell, rent, or trade your operational records or patient/client information to any third parties.</p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card/50 backdrop-blur-sm space-y-3">
            <FileText className="h-5 w-5 text-blue-500" />
            <h3 className="font-bold text-sm text-foreground">GDPR & GDPR Aligned</h3>
            <p className="text-xs text-muted-foreground">We give you complete ownership and control to request data extraction or permanent deletion anytime.</p>
          </div>
        </div>

        {/* Policy Body */}
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10 text-left">
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="text-indigo-600">1.</span> Information We Collect
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect information necessary to provide our intelligent communication services:
            </p>
            <ul className="space-y-2.5 pl-5 list-disc text-sm text-muted-foreground">
              <li><strong>Account Registration Details:</strong> Full name, business email address, billing information, contact number, country, and timezone.</li>
              <li><strong>WhatsApp Integration Data:</strong> Meta WhatsApp Business Cloud API access tokens, phone numbers, and WhatsApp message metadata processed through your active channels.</li>
              <li><strong>Knowledge Base & Files:</strong> Uploaded spreadsheets, diagnostic templates, FAQs, price lists, or hospital files used to train your custom AI Receptionist.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="text-indigo-600">2.</span> How We Use Your Information
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We process data solely to execute requested services:
            </p>
            <ul className="space-y-2.5 pl-5 list-disc text-sm text-muted-foreground">
              <li>Configuring and running your industry workspace (Hospital, Coaching, Real Estate, etc.).</li>
              <li>Providing instant automatic AI replies, handling appointment scheduling, and synchronizing contacts into your CRM.</li>
              <li>Compiling performance logs, resolve-rate charts, and chat analytics for your account dashboard.</li>
              <li>Delivering critical account alerts, billing updates, or system notices.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="text-indigo-600">3.</span> Data Protection & Safety
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We secure your data with industry-leading measures:
            </p>
            <ul className="space-y-2.5 pl-5 list-disc text-sm text-muted-foreground">
              <li>All API communications are encrypted in transit via SSL/TLS.</li>
              <li>Databases are housed on isolated cloud servers with restricted credential controls.</li>
              <li>We strictly enforce human takeover and staff assignment routing parameters to ensure patient or client confidentiality is respected.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="text-indigo-600">4.</span> Your Rights
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Depending on your location, you have the right to access, edit, or delete your personal details. If you wish to close your Helpa Studio account and purge all associated records permanently, contact our privacy desk at <a href="mailto:privacy@helpa.studio" className="text-indigo-600 hover:underline">privacy@helpa.studio</a>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="text-indigo-600">5.</span> Changes to this Policy
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the date at the top.
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-10 transition-colors duration-300">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600"><MessageSquare className="h-3.5 w-3.5 text-white" /></div>
            <span className="font-semibold text-foreground">Helpa</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <a href="mailto:hello@helpa.studio" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Helpa Studio</p>
        </div>
      </footer>

    </div>
  );
}
