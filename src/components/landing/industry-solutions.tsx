import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileCheck2,
  MessageCircle,
} from 'lucide-react';

const WORKFLOW = [
  {
    icon: MessageCircle,
    title: 'Customers message on WhatsApp',
    description:
      'Helpa answers common questions instantly using your approved business information.',
  },
  {
    icon: CalendarCheck,
    title: 'Helpa handles the next step',
    description:
      'Availability, service details, bookings, or enquiries are handled without back-and-forth.',
  },
  {
    icon: CheckCircle2,
    title: 'Leads are captured and qualified',
    description:
      'Important customer details and intent are organized automatically for your team.',
  },
  {
    icon: FileCheck2,
    title: 'Follow-up stays organized',
    description:
      'Tasks, reminders, conversations, and customer history stay connected in one workspace.',
  },
];

export function LandingIndustrySolutions() {
  return (
    <section id="clinic-workflow" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            WhatsApp workflow
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl">
            From first message to next action
          </h2>
          <p className="mt-3 text-base text-slate-600">
            One connected workflow for teams that use WhatsApp to answer customers,
            capture leads, automate routine work, and keep follow-ups organized.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW.map(({ icon: Icon, title, description }, index) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-400">
                  0{index + 1}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#110E3D]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-emerald-950">
              Designed for accountable automation
            </h3>
            <p className="mt-1 text-sm text-emerald-800">
              Teams can review conversations, take over when needed, and keep
              important customer decisions with the right people.
            </p>
          </div>
          <Link
            href="/signup"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#110E3D] px-6 py-3 text-sm font-bold text-white sm:mt-0"
          >
            Start your workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
