'use client';

import Link from 'next/link';
import {
  MessageSquare,
  ArrowLeft,
  ShieldAlert,
  Award,
  FileText,
  Activity,
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { Sun, Moon } from 'lucide-react';

export default function TermsOfServicePage() {
  const { mode, toggleMode } = useTheme();

  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-x-hidden font-sans antialiased transition-colors duration-300 selection:bg-indigo-600 selection:text-white">
      {/* Background Aurora Glows */}
      <div className="bg-primary/5 pointer-events-none absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-500/5 blur-[120px]" />

      {/* Header */}
      <header className="border-border/80 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-foreground text-lg font-semibold tracking-tight">
              Helpa
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleMode}
              className="border-border bg-card hover:bg-accent text-foreground cursor-pointer rounded-full border p-2 transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-16 md:py-24">
        {/* Title Block */}
        <div className="mb-16 space-y-4 text-center md:text-left">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-foreground text-4xl font-extrabold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm">
            Last updated: July 10, 2026
          </p>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
            Please read these Terms of Service ("Terms") carefully before using
            the Helpa Studio website, CRM application, and AI receptionist
            features (collectively, the "Services").
          </p>
        </div>

        {/* Highlight Cards */}
        <div className="mb-16 grid gap-4 sm:grid-cols-3">
          <div className="border-border bg-card/50 space-y-3 rounded-2xl border p-5 backdrop-blur-sm">
            <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-foreground text-sm font-bold">
              Usage Authorization
            </h3>
            <p className="text-muted-foreground text-xs">
              You must connect only business-owned numbers that you are legally
              authorized to configure.
            </p>
          </div>
          <div className="border-border bg-card/50 space-y-3 rounded-2xl border p-5 backdrop-blur-sm">
            <FileText className="h-5 w-5 text-emerald-500" />
            <h3 className="text-foreground text-sm font-bold">
              Fair Usage Policy
            </h3>
            <p className="text-muted-foreground text-xs">
              Broadcast messages must strictly comply with local anti-spam
              guidelines and Meta Business Rules.
            </p>
          </div>
          <div className="border-border bg-card/50 space-y-3 rounded-2xl border p-5 backdrop-blur-sm">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="text-foreground text-sm font-bold">
              Uptime & Support
            </h3>
            <p className="text-muted-foreground text-xs">
              We provide cloud CRM database availability backed by industry
              standard hosting providers.
            </p>
          </div>
        </div>

        {/* Terms Body */}
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10 text-left">
          <section className="space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
              <span className="text-indigo-600">1.</span> Acceptance of Terms
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              By registering an account on Helpa Studio or accessing our online
              dashboard, you agree to comply with and be bound by these Terms
              and our Privacy Policy. If you disagree with any part of these
              terms, you must not use our Services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
              <span className="text-indigo-600">2.</span> Account & Channel
              Connection
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              When creating an account and connecting your communication
              channels, you agree to:
            </p>
            <ul className="text-muted-foreground list-disc space-y-2.5 pl-5 text-sm">
              <li>Provide accurate, complete, and current information.</li>
              <li>
                Maintain the security and confidentiality of your credentials.
              </li>
              <li>
                Assume full responsibility for all activities, messages, and
                automated AI responses sent through your linked Meta WhatsApp
                numbers.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
              <span className="text-indigo-600">3.</span> Acceptable Use &
              Anti-Spam Compliance
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Helpa Studio connects to WhatsApp via Meta Business API channels.
              You agree to strictly follow Meta's Developer Terms. You must not
              use Helpa to broadcast unsolicited spam, fraudulent promotions, or
              offensive messages. Violating Meta terms may result in your
              WhatsApp number being suspended by Meta, for which Helpa Studio
              holds no liability.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
              <span className="text-indigo-600">4.</span> Billing, Renewals &
              Upgrades
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Subscriptions are billed on a recurring monthly or annual basis.
              You can cancel your subscription anytime. Upgrades to multi-number
              capacities or volume tiers will be billed immediately on a
              pro-rata basis. Refund requests are handled at our discretion.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
              <span className="text-indigo-600">5.</span> Disclaimers &
              Limitation of Liability
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Our Services are provided "as is" without warranties of any kind.
              Helpa Studio does not guarantee uninterrupted service in the event
              of third-party API disruptions (such as Meta platform downtime).
              In no event shall Helpa Studio be liable for any loss of profits,
              data, or business opportunities resulting from your use of the
              Services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
              <span className="text-indigo-600">6.</span> Contact Us
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              If you have any questions or require clarifications regarding
              these Terms of Service, contact our team at{' '}
              <a
                href="mailto:support@helpa.studio"
                className="text-indigo-600 hover:underline"
              >
                support@helpa.studio
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-border bg-card border-t px-6 py-10 transition-colors duration-300">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
              <MessageSquare className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-foreground font-semibold">Helpa</span>
          </div>
          <div className="text-muted-foreground flex flex-wrap justify-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <a
              href="mailto:hello@helpa.studio"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Helpa Studio
          </p>
        </div>
      </footer>
    </div>
  );
}
