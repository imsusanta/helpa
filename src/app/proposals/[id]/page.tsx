'use client';

import { useEffect, useState, use } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Building2,
  Car,
  MessageSquare,
  Printer,
  Sparkles,
  Plane,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProposalData {
  id: string;
  proposal_number: string;
  title: string;
  destination: string;
  duration_days: number;
  duration_nights: number;
  start_date?: string;
  end_date?: string;
  adults_count: number;
  children_count: number;
  currency: string;
  base_price: number;
  tax_amount: number;
  discount_amount: number;
  total_price: number;
  inclusions: string[];
  exclusions: string[];
  itinerary: Array<{ day: number; title: string; description: string }>;
  hotel_details?: string;
  transport_details?: string;
  notes?: string;
  terms?: string;
  status: string;
  valid_until?: string;
  contacts?: { id: string; name?: string; phone?: string };
  accounts?: { name?: string; industry?: string };
  travel_packages?: { id: string; name?: string; description?: string };
}

export default function PublicProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const proposalId = resolvedParams.id;

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trip-proposals/public/${proposalId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setProposal(res.data);
        } else {
          setError(res.message || 'Trip proposal not found or expired.');
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load proposal.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [proposalId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">
            Loading your customized trip proposal...
          </p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <XCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Proposal Unavailable
          </h2>
          <p className="text-sm text-slate-500">
            {error || 'This trip proposal link could not be loaded.'}
          </p>
        </div>
      </div>
    );
  }

  const agencyName = proposal.accounts?.name || 'Helpa Travel';
  const travelerName = proposal.contacts?.name || 'Valued Traveler';
  const agencyPhone = proposal.contacts?.phone || '';

  const whatsappMessage = encodeURIComponent(
    `Hello ${agencyName}! I reviewed the Trip Proposal *${proposal.proposal_number}* for *${proposal.destination}* (Total: ₹${Number(proposal.total_price).toLocaleString('en-IN')}) and I would like to confirm my booking!`
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50/50 to-slate-100 text-slate-900">
      {/* Header Banner */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-sm">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {agencyName}
              </div>
              <div className="text-xs text-slate-500">
                Official Tour Proposal • {proposal.proposal_number}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hidden items-center gap-1.5 border-slate-200 text-xs text-slate-600 sm:inline-flex"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 text-xs text-white shadow-sm hover:bg-emerald-700"
              onClick={() => {
                const url = agencyPhone
                  ? `https://wa.me/${agencyPhone.replace(/\D/g, '')}?text=${whatsappMessage}`
                  : `https://wa.me/?text=${whatsappMessage}`;
                window.open(url, '_blank');
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Book on WhatsApp
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-10">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Exclusive Custom Tour Proposal
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
              {proposal.title}
            </h1>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Specially prepared for{' '}
              <span className="font-semibold text-white">{travelerName}</span>.
              Enjoy a handcrafted holiday experience with curated stays, private
              sightseeing, and seamless travel support.
            </p>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  Destination
                </div>
                <div className="mt-1 truncate text-sm font-semibold sm:text-base">
                  {proposal.destination}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  Duration
                </div>
                <div className="mt-1 text-sm font-semibold sm:text-base">
                  {proposal.duration_days} Days / {proposal.duration_nights}{' '}
                  Nights
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  Travel Dates
                </div>
                <div className="mt-1 truncate text-xs font-semibold sm:text-sm">
                  {proposal.start_date
                    ? proposal.end_date
                      ? `${proposal.start_date} to ${proposal.end_date}`
                      : proposal.start_date
                    : 'Flexible Dates'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Travelers
                </div>
                <div className="mt-1 text-sm font-semibold sm:text-base">
                  {proposal.adults_count} Adults
                  {proposal.children_count
                    ? `, ${proposal.children_count} Kids`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Summary Banner */}
        <section className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Total Package Price (All Inclusive)
            </div>
            <div className="text-3xl font-extrabold text-emerald-700 text-slate-900 sm:text-4xl">
              ₹{Number(proposal.total_price).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500">
              Covers accommodation, private transport, sightseeing, and
              mentioned inclusions for all{' '}
              {proposal.adults_count + (proposal.children_count || 0)} guests.
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              className="w-full gap-2 bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-700 sm:w-auto"
              onClick={() => {
                const url = agencyPhone
                  ? `https://wa.me/${agencyPhone.replace(/\D/g, '')}?text=${whatsappMessage}`
                  : `https://wa.me/?text=${whatsappMessage}`;
                window.open(url, '_blank');
              }}
            >
              <MessageSquare className="h-5 w-5" />
              Accept & Book on WhatsApp
            </Button>
          </div>
        </section>

        {/* Day-by-Day Itinerary Section */}
        {proposal.itinerary && proposal.itinerary.length > 0 && (
          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Calendar className="h-5 w-5 text-emerald-600" />
                Day-by-Day Tour Itinerary
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Detailed plan and sightseeing schedule for your trip.
              </p>
            </div>

            <div className="relative space-y-6 before:absolute before:top-3 before:bottom-3 before:left-4 before:w-0.5 before:bg-slate-200">
              {proposal.itinerary.map((item, idx) => (
                <div key={idx} className="relative pl-10">
                  <div className="absolute top-0.5 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-sm">
                    {item.day || idx + 1}
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-4.5">
                    <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                      Day {item.day || idx + 1}:{' '}
                      {item.title || 'Sightseeing & Activities'}
                    </h3>
                    <p className="text-xs leading-relaxed whitespace-pre-line text-slate-600 sm:text-sm">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stay & Transport Section */}
        {(proposal.hotel_details || proposal.transport_details) && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {proposal.hotel_details && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                  Hotel & Accommodation
                </div>
                <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-600">
                  {proposal.hotel_details}
                </p>
              </div>
            )}

            {proposal.transport_details && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Car className="h-5 w-5 text-emerald-600" />
                  Transport & Sightseeing Cab
                </div>
                <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-600">
                  {proposal.transport_details}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Inclusions vs Exclusions Grid */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              What&apos;s Included
            </h3>
            <ul className="space-y-2.5">
              {proposal.inclusions?.map((inc, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs text-slate-700 sm:text-sm"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{inc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-bold text-rose-900">
              <XCircle className="h-5 w-5 text-rose-500" />
              What&apos;s Excluded
            </h3>
            <ul className="space-y-2.5">
              {proposal.exclusions?.map((exc, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs text-slate-600 sm:text-sm"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  <span>{exc}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Terms & Conditions */}
        {proposal.terms && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Booking Terms & Payment Conditions
            </h3>
            <p className="text-xs leading-relaxed whitespace-pre-line text-slate-600">
              {proposal.terms}
            </p>
          </section>
        )}

        {/* Floating / Bottom Call to Action */}
        <section className="space-y-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-center text-white shadow-lg">
          <h2 className="text-2xl font-bold">
            Ready to embark on this journey?
          </h2>
          <p className="mx-auto max-w-xl text-sm text-emerald-100">
            Contact us directly on WhatsApp to confirm your dates, personalize
            your activities, or ask any questions.
          </p>
          <div className="flex justify-center pt-2">
            <Button
              size="lg"
              className="gap-2 bg-white px-8 font-bold text-emerald-800 shadow-md hover:bg-slate-100"
              onClick={() => {
                const url = agencyPhone
                  ? `https://wa.me/${agencyPhone.replace(/\D/g, '')}?text=${whatsappMessage}`
                  : `https://wa.me/?text=${whatsappMessage}`;
                window.open(url, '_blank');
              }}
            >
              <Phone className="h-4 w-4" />
              Connect with {agencyName} on WhatsApp
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
