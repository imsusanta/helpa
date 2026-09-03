import Link from 'next/link';
import { ArrowRight, CalendarCheck, CheckCircle2, MessageCircle, UsersRound, BarChart3 } from 'lucide-react';

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Automate Conversations',
    description: 'Answer common questions, capture enquiries, and keep every WhatsApp conversation moving.',
  },
  {
    icon: CalendarCheck,
    title: 'Book Appointments',
    description: 'Let customers check availability and book, reschedule, or cancel without back-and-forth.',
  },
  {
    icon: UsersRound,
    title: 'Manage Customers',
    description: 'Keep contacts, conversation history, follow-ups, and customer details together in one place.',
  },
  {
    icon: BarChart3,
    title: 'Grow Your Business',
    description: 'Qualify leads, organize opportunities, and help your team follow up faster.',
  },
];

export function LandingIndustrySolutions() {
  return (
    <section id="clinic-workflow" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_2fr]">
          <div className="max-w-md">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              <span className="h-px w-8 bg-emerald-500" />
              Why businesses love us
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#110E3D] sm:text-4xl lg:text-5xl">
              Everything you need to grow on <span className="text-emerald-600">WhatsApp</span>
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              From conversations to conversions — automate routine work so your team can focus on customers and growth.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#110E3D] transition hover:text-emerald-600"
            >
              Explore what you can automate
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(17,14,61,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(17,14,61,0.09)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-7 text-lg font-bold text-[#110E3D]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                <div className="mt-6 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition group-hover:bg-emerald-50 group-hover:text-emerald-600">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
