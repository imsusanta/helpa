import Link from "next/link";
import { MessageSquare, ArrowLeft, Mail, Phone, MapPin, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Contact Us — Helpa Studio",
  description: "Get in touch with Helpa Studio. Support, sales, and registered office details for Indian service businesses.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#075E54] dark:text-[#25D366] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Helpa
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-md">
            <MessageSquare className="h-5 w-5 fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Contact Us</h1>
        </div>
        <p className="text-sm text-muted-foreground">We're here to help your clinic, salon, or institute automate customer enquiries 24/7.</p>

        <div className="grid gap-6 sm:grid-cols-2 pt-4">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] flex items-center justify-center">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground">Email Support</h3>
            <p className="text-xs text-muted-foreground">Questions or technical assistance</p>
            <a href="mailto:hello@helpa.studio" className="text-sm font-bold text-[#075E54] dark:text-[#25D366] hover:underline block">
              hello@helpa.studio
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground">Phone & WhatsApp</h3>
            <p className="text-xs text-muted-foreground">Mon–Sat, 9:00 AM – 7:00 PM IST</p>
            <a href="tel:+919800000000" className="text-sm font-bold text-[#075E54] dark:text-[#25D366] hover:underline block">
              +91 98000 00000
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-sm mt-6">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <MapPin className="h-5 w-5 text-[#25D366]" /> Registered Business Address
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Helpa Studio Technologies Pvt. Ltd.<br />
            Level 4, Tech Park Campus, Sevoke Road,<br />
            Siliguri, West Bengal — 734001, India.
          </p>
        </div>

        <div className="rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-6 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-[#075E54] dark:text-[#25D366] font-bold text-sm">
            <ShieldCheck className="h-4 w-4" /> Compliance & DPDP Act 2023 Disclosure
          </div>
          <p>
            Helpa Studio is an Indian enterprise SaaS company. Customer data is hosted securely on encrypted Indian data center servers in compliance with the Digital Personal Data Protection (DPDP) Act 2023. Patient & clinic health records are encrypted at rest and in transit.
          </p>
        </div>
      </div>
    </div>
  );
}
