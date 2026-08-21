import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileCheck2,
  MessageCircle,
} from 'lucide-react';

const CLINIC_WORKFLOW = [
  {
    icon: MessageCircle,
    title: 'Patient asks on WhatsApp',
    description: 'Helpa handles common questions using clinic-approved information.',
  },
  {
    icon: CalendarCheck,
    title: 'Helpa checks availability',
    description: 'Available doctor slots are offered without double-booking.',
  },
  {
    icon: CheckCircle2,
    title: 'Appointment is confirmed',
    description: 'The patient and clinic receive a clear confirmation and reminder.',
  },
  {
    icon: FileCheck2,
    title: 'Visit follow-up stays organized',
    description: 'OPD slips, reports, and approved follow-ups remain connected to the patient record.',
  },
];

export function LandingIndustrySolutions() {
  return (
    <section id="clinic-workflow" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            Built for clinics first
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl">
            One patient journey, from first message to follow-up
          </h2>
          <p className="mt-3 text-base text-slate-600">
            A focused workflow for independent clinics and outpatient teams—not a generic CRM with healthcare labels.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CLINIC_WORKFLOW.map(({ icon: Icon, title, description }, index) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-400">0{index + 1}</span>
              </div>
              <h3 className="text-base font-bold text-[#110E3D]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-emerald-950">Designed for accountable automation</h3>
            <p className="mt-1 text-sm text-emerald-800">Staff can review conversations, take over when needed, and keep clinical decisions with qualified people.</p>
          </div>
          <Link href="/signup" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#110E3D] px-6 py-3 text-sm font-bold text-white sm:mt-0">
            Start clinic workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
