import Link from 'next/link';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Refund & Cancellation Policy — Helpa Studio',
  description:
    'Official Refund and Cancellation Policy for Helpa WhatsApp AI Receptionist & CRM.',
};

export default function RefundPolicyPage() {
  return (
    <div className="bg-background text-foreground min-h-screen px-6 py-12 font-sans">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#075E54] hover:underline dark:text-[#25D366]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Helpa
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-md">
            <MessageSquare className="h-5 w-5 fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Refund & Cancellation Policy
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">Last updated: July 2026</p>

        <div className="text-muted-foreground space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-foreground text-lg font-bold">
              1. 14-Day Money-Back Guarantee
            </h2>
            <p>
              We want you to be completely satisfied with Helpa. If you are not
              satisfied with our WhatsApp AI Receptionist service within the
              first 14 days of subscription, you are eligible for a 100% full
              refund of your subscription fee — no questions asked.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground text-lg font-bold">
              2. Subscription Cancellation
            </h2>
            <p>
              You can cancel your Helpa monthly or annual subscription anytime
              directly from your dashboard settings or by contacting our support
              team at{' '}
              <a
                href="mailto:hello@helpa.studio"
                className="text-[#25D366] underline"
              >
                hello@helpa.studio
              </a>
              . Upon cancellation, your service will remain active until the end
              of your current billing period.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground text-lg font-bold">
              3. One-Time Setup Fee Policy
            </h2>
            <p>
              Setup fees cover custom AI knowledge base training, WhatsApp
              Business Cloud API channel onboarding, and dedicated technical
              integration assistance. If requested within the 14-day risk-free
              window, setup fees are fully refundable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground text-lg font-bold">
              4. Refund Processing
            </h2>
            <p>
              Refunds are processed within 5–7 business days to the original
              payment method used via Razorpay / Stripe / UPI / Bank Transfer.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground text-lg font-bold">
              5. Contact Support
            </h2>
            <p>
              For refund or billing inquiries, please reach out to us at{' '}
              <a
                href="mailto:hello@helpa.studio"
                className="text-[#25D366] underline"
              >
                hello@helpa.studio
              </a>{' '}
              or call +91 98000 00000.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
