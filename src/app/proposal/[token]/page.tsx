'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Hotel, MapPin, Users } from 'lucide-react';

interface ProposalData {
  quotation_number: string;
  status: string;
  valid_until?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
  contacts?: { name?: string; phone?: string; email?: string };
  quotation_items?: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  travel_details: {
    proposal_title: string;
    destination: string;
    start_date: string;
    end_date: string;
    adults: number;
    children: number;
    trip_type: string;
    duration_label: string;
    hotel_category: string;
    meal_plan: string;
    itinerary: Array<{ day: number; title: string; description: string }>;
    inclusions: string[];
    exclusions: string[];
    advance_amount: number;
    balance_amount: number;
  };
}

function money(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
}

function date(value?: string) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PublicTripProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(({ token }) =>
      fetch(`/api/public/trip-proposals/${encodeURIComponent(token)}`, { cache: 'no-store' })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || 'Unable to load proposal');
          setProposal(body.data);
        })
        .catch((err) => setError(err.message || 'Unable to load proposal'))
    );
  }, [params]);

  if (error) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-slate-900">Proposal unavailable</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>;
  }

  if (!proposal) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" /></main>;
  }

  const trip = proposal.travel_details;
  const whatsapp = proposal.contacts?.phone
    ? `https://wa.me/${proposal.contacts.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${proposal.contacts.name || ''}, I have reviewed the ${trip.proposal_title} proposal and would like to discuss it.`)}`
    : '';

  return (
    <main className="min-h-screen bg-slate-50 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
          <header className="bg-slate-950 px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Trip Proposal · {proposal.quotation_number}</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{trip.proposal_title || `${trip.destination} Trip`}</h1>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-400" />{trip.destination}</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-emerald-400" />{date(trip.start_date)} – {date(trip.end_date)}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-emerald-400" />{trip.adults + trip.children} travellers</span>
            </div>
          </header>

          <div className="space-y-8 p-6 sm:p-10">
            <section className="grid gap-3 sm:grid-cols-4">
              {[['Trip Type', trip.trip_type], ['Duration', trip.duration_label], ['Hotel', trip.hotel_category], ['Meals', trip.meal_plan]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-800">{value}</div></div>)}
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Your Itinerary</h2>
              <div className="mt-4 space-y-3">{trip.itinerary.map((day) => <div key={day.day} className="flex gap-4 rounded-2xl border border-slate-200 p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-extrabold text-emerald-700">{day.day}</div><div><div className="font-bold text-slate-900">{day.title}</div><div className="mt-1 text-sm leading-6 text-slate-500">{day.description}</div></div></div>)}</div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Package Includes</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{trip.inclusions.map((item, i) => <div key={`${item}-${i}`} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}</div>)}</div>
              {trip.exclusions.length > 0 && <><h3 className="mt-6 text-sm font-bold text-slate-900">Exclusions</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{trip.exclusions.map((item, i) => <div key={`${item}-${i}`} className="text-sm text-slate-500">• {item}</div>)}</div></>}
            </section>

            <section className="rounded-3xl bg-slate-50 p-5 sm:p-6">
              <div className="flex items-center gap-2"><Hotel className="h-5 w-5 text-emerald-600" /><h2 className="text-xl font-bold text-slate-900">Package Price</h2></div>
              <div className="mt-5 space-y-2 text-sm text-slate-500"><div className="flex justify-between"><span>Package subtotal</span><span>{money(proposal.subtotal, proposal.currency)}</span></div>{proposal.tax_amount > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(proposal.tax_amount, proposal.currency)}</span></div>}{proposal.discount_amount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(proposal.discount_amount, proposal.currency)}</span></div>}</div>
              <div className="mt-4 border-t border-slate-200 pt-4"><div className="flex items-end justify-between"><span className="font-bold text-slate-900">Total Package</span><span className="text-2xl font-black text-slate-900">{money(proposal.total, proposal.currency)}</span></div><div className="mt-2 flex justify-between text-xs text-emerald-700"><span>Advance</span><span>{money(trip.advance_amount, proposal.currency)}</span></div><div className="mt-1 flex justify-between text-xs font-bold text-slate-700"><span>Balance</span><span>{money(trip.balance_amount, proposal.currency)}</span></div></div>
            </section>

            {proposal.notes && <section><h2 className="text-sm font-bold text-slate-900">Notes & Instructions</h2><p className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{proposal.notes}</p></section>}

            <div className="flex flex-col gap-3 sm:flex-row"><button onClick={() => window.print()} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Print / Save PDF</button>{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-500 px-5 py-3 text-center text-sm font-bold text-white hover:bg-emerald-600">Discuss on WhatsApp</a>}</div>
            <p className="text-center text-[11px] text-slate-400">Prepared by your travel partner · Proposal valid until {date(proposal.valid_until)}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
