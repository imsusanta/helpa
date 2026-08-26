import Link from 'next/link';
import { ArrowUpRight, Globe, MessageSquare, Settings2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WebsitePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-emerald-600">
          Clinic Operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Website
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Manage the public-facing clinic experience and the settings that power
          website enquiries and appointment journeys.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/settings?tab=profile"
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Globe className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-emerald-600" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900">
            Business Profile
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Update clinic name, contact details and public business information.
          </p>
        </Link>

        <Link
          href="/lead-forms"
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-emerald-600" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900">Enquiry Forms</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Create public forms that turn website visitors into patient
            enquiries.
          </p>
        </Link>

        <Link
          href="/settings?tab=whatsapp"
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-emerald-600" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900">
            WhatsApp Connection
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Connect WhatsApp so website enquiries can continue directly into the
            inbox.
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Website workspace</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your website controls are now available from Clinic Operations.
              Full visual website-builder controls can be added here without
              changing the existing CRM navigation.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Setup hub
          </span>
        </div>
      </section>
    </div>
  );
}
