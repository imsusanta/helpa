'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Bot,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Inbox,
  Menu,
  MessageCircle,
  MessagesSquare,
  PhoneCall,
  Play,
  Scissors,
  School,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

import { createClient } from '@/lib/appwrite-compat';

const features = [
  {
    icon: Zap,
    title: 'Instant conversations',
    description: 'Every enquiry gets a helpful, on-brand reply in seconds.',
  },
  {
    icon: CalendarCheck,
    title: 'Bookings, handled',
    description:
      'Let customers pick a slot and receive their confirmation on WhatsApp.',
  },
  {
    icon: UsersRound,
    title: 'A CRM that remembers',
    description:
      'Capture every lead, preference, follow-up and conversation in one place.',
  },
];

const steps = [
  {
    icon: PhoneCall,
    title: 'Connect your number',
    description:
      'Link your official WhatsApp Business number in a few guided steps.',
  },
  {
    icon: Sparkles,
    title: 'Teach Helpa your business',
    description: 'Add your services, prices, FAQs, timings and booking rules.',
  },
  {
    icon: Workflow,
    title: 'Let conversations flow',
    description:
      'Helpa answers, qualifies, books and brings your team in when needed.',
  },
  {
    icon: BarChart3,
    title: 'See what is working',
    description:
      'Track conversations, bookings, leads and response time from one dashboard.',
  },
];

interface LandingPlan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  max_users: number;
  max_contacts: number;
  max_whatsapp_numbers: number;
  max_ai_requests: number;
  features: string | string[];
}

function isLandingPlan(value: unknown): value is LandingPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;

  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.monthly_price === 'number' &&
    typeof plan.yearly_price === 'number' &&
    typeof plan.max_users === 'number' &&
    typeof plan.max_contacts === 'number' &&
    typeof plan.max_whatsapp_numbers === 'number' &&
    typeof plan.max_ai_requests === 'number' &&
    (typeof plan.features === 'string' || Array.isArray(plan.features))
  );
}

function planFeatures(features: LandingPlan['features']): string[] {
  const values =
    typeof features === 'string'
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(features);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : features;

  const labels: Record<string, string> = {
    ai_chat: 'AI customer replies',
    automations: 'Automated workflows',
    broadcasts: 'Broadcast campaigns',
    flows: 'Custom conversation flows',
    pipelines: 'Lead pipelines',
  };

  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => labels[value] ?? value.replaceAll('_', ' '));
}

function formatPlanPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function formatPlanDescription(plan: LandingPlan): string {
  const team =
    plan.max_users >= 999
      ? 'Unlimited team members'
      : `${plan.max_users} team member${plan.max_users === 1 ? '' : 's'}`;
  const contacts =
    plan.max_contacts >= 99999
      ? 'unlimited contacts'
      : `${plan.max_contacts.toLocaleString('en-IN')} contacts`;
  return `${team} and ${contacts}`;
}

const faqs = [
  {
    question: 'Can I keep using my existing WhatsApp Business number?',
    answer:
      'Yes. Helpa connects through the official WhatsApp Cloud API, so your business can keep its existing number while conversations arrive in one shared inbox.',
  },
  {
    question: 'Will the AI answer in Bengali, Hindi and English?',
    answer:
      'Yes. Helpa can understand and reply in the language your customer uses, while keeping your business details and policies consistent.',
  },
  {
    question: 'Can my team take over a conversation?',
    answer:
      'Absolutely. A teammate can take over any conversation from the inbox, with the full customer history and AI context ready for them.',
  },
  {
    question: 'How quickly can we go live?',
    answer:
      'Most businesses can be set up within a day. Connect WhatsApp, add your business information and let your team test the customer experience before launch.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [user, setUser] = useState<unknown>(null);
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (active && data?.success && data?.user) {
            setUser(data.user);
            return;
          }
        }
      } catch {
        // ignore
      }

      const appwrite = createClient();
      appwrite.auth
        .getUser()
        .then(({ data }) => {
          if (active) setUser(data.user);
        })
        .catch(() => {
          if (active) setUser(null);
        });
    }

    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPlans() {
      try {
        const response = await fetch('/api/plans', { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load landing plans');

        const data: unknown = await response.json();
        if (!Array.isArray(data))
          throw new Error('Invalid landing plans response');

        if (active) {
          setPlans(data.filter(isLandingPlan));
          setPlansError(false);
        }
      } catch (error) {
        console.error('Unable to load landing plans:', error);
        if (active) setPlansError(true);
      } finally {
        if (active) setPlansLoading(false);
      }
    }

    void loadPlans();

    const refreshPlans = () => {
      if (document.visibilityState === 'visible') void loadPlans();
    };

    window.addEventListener('focus', refreshPlans);
    document.addEventListener('visibilitychange', refreshPlans);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshPlans);
      document.removeEventListener('visibilitychange', refreshPlans);
    };
  }, []);

  const ctaHref = user ? '/dashboard' : '/signup';
  const featuredPlanId =
    plans.find((plan) => plan.name.toLowerCase() === 'growth')?.id ??
    plans[Math.floor(plans.length / 2)]?.id;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7faf8] text-[#17332a] selection:bg-[#25d366] selection:text-white">
      <header className="relative z-40 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-xl border border-[#dce8e1] bg-white/90 px-4 py-3 shadow-[0_8px_30px_rgba(18,58,43,0.06)] backdrop-blur sm:px-5">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Helpa home"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#075e54] text-white shadow-[0_6px_14px_rgba(7,94,84,0.22)]">
              <MessageCircle className="size-4.5 fill-[#25d366] text-[#25d366]" />
            </span>
            <span className="text-[1.05rem] font-bold tracking-normal text-[#17332a]">
              Helpa
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#5b7066] md:flex">
            <a
              className="transition-colors hover:text-[#075e54]"
              href="#product"
            >
              Product
            </a>
            <a
              className="transition-colors hover:text-[#075e54]"
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className="transition-colors hover:text-[#075e54]"
              href="#pricing"
            >
              Pricing
            </a>
            <a className="transition-colors hover:text-[#075e54]" href="#faq">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {!user && (
              <Link
                href="/login"
                className="hidden px-2 py-2 text-sm font-semibold text-[#3d554a] transition-colors hover:text-[#075e54] sm:inline-flex"
              >
                Log in
              </Link>
            )}
            <Link
              href={ctaHref}
              className="hidden items-center gap-1.5 rounded-lg bg-[#075e54] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(7,94,84,0.18)] transition-colors hover:bg-[#064b43] sm:inline-flex"
            >
              {user ? 'Open dashboard' : 'Get started'}
              <ArrowUpRight className="size-3.5" />
            </Link>
            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid size-9 place-items-center rounded-lg border border-[#dce8e1] text-[#075e54] md:hidden"
            >
              {mobileMenuOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto mt-2 max-w-6xl rounded-xl border border-[#dce8e1] bg-white p-3 shadow-[0_10px_28px_rgba(18,58,43,0.1)] md:hidden"
            >
              {[
                ['Product', '#product'],
                ['How it works', '#how-it-works'],
                ['Pricing', '#pricing'],
                ['FAQ', '#faq'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#3d554a] hover:bg-[#edf7f0] hover:text-[#075e54]"
                >
                  {label}
                </a>
              ))}
              <div
                className={`mt-2 grid ${user ? 'grid-cols-1' : 'grid-cols-2'} gap-2 border-t border-[#e5eee8] pt-3`}
              >
                {!user && (
                  <Link
                    href="/login"
                    className="rounded-lg border border-[#cfe0d6] px-3 py-2.5 text-center text-sm font-semibold text-[#075e54]"
                  >
                    Log in
                  </Link>
                )}
                <Link
                  href={ctaHref}
                  className="rounded-lg bg-[#075e54] px-3 py-2.5 text-center text-sm font-semibold text-white"
                >
                  {user ? 'Open dashboard' : 'Get started'}
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pt-18 pb-12 sm:px-8 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#cbe8d5] bg-[#effaf2] px-3 py-1.5 text-xs font-semibold text-[#087f4c]"
          >
            <span className="size-1.5 rounded-full bg-[#25d366]" />
            Your always-on WhatsApp reception desk
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-5 text-4xl leading-[1.02] font-semibold tracking-normal text-[#17332a] sm:text-6xl"
          >
            The WhatsApp AI receptionist built around your business.
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#60756b] sm:text-lg"
          >
            Helpa answers customer questions, books appointments and keeps every
            lead organised while your team stays focused on the work that
            matters.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"
          >
            <Link
              href={ctaHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#075e54] px-5 text-sm font-semibold text-white shadow-[0_9px_20px_rgba(7,94,84,0.2)] transition-colors hover:bg-[#064b43]"
            >
              {user ? 'Go to dashboard' : 'Start free setup'}
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#cfe0d6] bg-white px-5 text-sm font-semibold text-[#075e54] transition-colors hover:border-[#9ccdaf] hover:bg-[#f4fbf6]"
            >
              <Play className="size-3.5 fill-current" />
              See how it works
            </a>
          </motion.div>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-[#6e8177]"
          >
            <ShieldCheck className="size-3.5 text-[#079653]" />
            Official WhatsApp Cloud API. Set up without changing your number.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.25 }}
          className="relative mx-auto mt-9 h-[350px] max-w-[700px] sm:mt-12 sm:h-[475px]"
        >
          <div className="absolute inset-x-5 bottom-0 h-[62%] rounded-t-[2rem] border-x border-t border-[#d9e8df] bg-[#eff7f1] sm:inset-x-0" />
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[23%] left-0 z-10 hidden w-44 rounded-lg border border-[#d4e6da] bg-white p-3 text-left shadow-[0_14px_30px_rgba(20,73,50,0.12)] sm:block"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-[#e7f9ed] text-[#079653]">
                <CalendarCheck className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-[#71847a]">
                  New booking
                </p>
                <p className="text-xs font-semibold text-[#17332a]">
                  Confirmed in WhatsApp
                </p>
              </div>
            </div>
          </motion.div>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.6,
            }}
            className="absolute top-[31%] right-0 z-10 hidden w-40 rounded-lg border border-[#d4e6da] bg-white p-3 text-left shadow-[0_14px_30px_rgba(20,73,50,0.12)] sm:block"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-[#e7f9ed] text-[#079653]">
                <Clock3 className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-[#71847a]">
                  Avg. response
                </p>
                <p className="text-xs font-semibold text-[#17332a]">
                  Under 3 seconds
                </p>
              </div>
            </div>
          </motion.div>
          <div className="absolute inset-x-0 bottom-0 z-10 mx-auto h-[350px] w-[245px] overflow-hidden sm:h-[475px] sm:w-[335px]">
            <Image
              src="/images/helpa-whatsapp-hero.png"
              alt="Helpa AI receptionist booking a customer through a WhatsApp-style conversation"
              width={864}
              height={1792}
              priority
              sizes="(max-width: 640px) 245px, 335px"
              className="absolute inset-x-0 top-[-65px] w-full max-w-none sm:top-[-88px]"
            />
          </div>
        </motion.div>
      </section>

      <section
        id="product"
        className="border-y border-[#e0ebe4] bg-white py-16 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-xl text-center"
          >
            <p className="text-xs font-semibold text-[#079653]">
              BUILT FOR REAL CONVERSATIONS
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold text-[#17332a] sm:text-4xl">
              Everything a sharp front desk needs, without the busywork.
            </h2>
          </motion.div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeUp}
                transition={{ duration: 0.4, delay: index * 0.07 }}
                className="rounded-lg border border-[#dfeae3] bg-[#fbfdfb] p-5 shadow-[0_8px_20px_rgba(20,73,50,0.04)]"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-[#e9f8ee] text-[#087f4c]">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-[#17332a]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#698075]">
                  {feature.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-18 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
            transition={{ duration: 0.45 }}
          >
            <p className="text-xs font-semibold text-[#079653]">HOW IT WORKS</p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold text-[#17332a] sm:text-4xl">
              From first hello to a neatly handled day.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-[#657a70]">
              Helpa learns your service flow, then gives customers the kind of
              fast, thoughtful reply they expect from your best receptionist.
            </p>
            <ol className="mt-7 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#bbdfc8] bg-white text-xs font-semibold text-[#087f4c]">
                    0{index + 1}
                  </span>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">
                      <step.icon className="size-4 text-[#079653]" />
                      <h3 className="text-sm font-semibold text-[#17332a]">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#6a8075]">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-xl border border-[#d8e7de] bg-white p-3 shadow-[0_20px_50px_rgba(20,73,50,0.1)] sm:p-4"
          >
            <div className="flex items-center justify-between border-b border-[#edf2ee] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-[#075e54] text-white">
                  <Bot className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[#17332a]">
                    Helpa setup
                  </p>
                  <p className="text-[10px] text-[#779084]">
                    AI receptionist workspace
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f9ed] px-2 py-1 text-[10px] font-semibold text-[#087f4c]">
                <span className="size-1.5 rounded-full bg-[#25d366]" /> Ready
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[0.82fr_1.18fr]">
              <aside className="rounded-lg bg-[#f5f9f6] p-3">
                <p className="text-[10px] font-semibold text-[#789084] uppercase">
                  Your channels
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-md bg-white p-2 shadow-sm">
                  <span className="grid size-6 place-items-center rounded-md bg-[#e8f8ed] text-[#079653]">
                    <MessageCircle className="size-3" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-[#254236]">
                      WhatsApp Business
                    </p>
                    <p className="text-[9px] text-[#079653]">Connected</p>
                  </div>
                </div>
                <p className="mt-5 text-[10px] font-semibold text-[#789084] uppercase">
                  Knowledge
                </p>
                {[
                  'Services & pricing',
                  'Working hours',
                  'Appointment rules',
                ].map((label) => (
                  <div
                    key={label}
                    className="mt-2 flex items-center gap-1.5 text-[10px] text-[#5d7468]"
                  >
                    <CircleCheck className="size-3 text-[#20a95d]" />
                    {label}
                  </div>
                ))}
              </aside>
              <div className="rounded-lg border border-[#e1ece5] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#17332a]">
                    Today&apos;s customer flow
                  </p>
                  <BellRing className="size-3.5 text-[#769083]" />
                </div>
                <div className="mt-3 space-y-2.5">
                  {[
                    { name: 'New enquiry', value: '42', color: 'bg-[#dff6e7]' },
                    {
                      name: 'Appointments booked',
                      value: '18',
                      color: 'bg-[#e2f0e9]',
                    },
                    {
                      name: 'Needs team follow-up',
                      value: '5',
                      color: 'bg-[#fff3d8]',
                    },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className={`flex items-center justify-between rounded-md ${item.color} px-3 py-2`}
                    >
                      <span className="text-[10px] font-medium text-[#466155]">
                        {item.name}
                      </span>
                      <span className="text-xs font-semibold text-[#17332a]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-md border border-[#e4eee7] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#17332a]">
                    <Sparkles className="size-3 text-[#079653]" />
                    Helpa is replying now
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf3ef]">
                    <motion.div
                      initial={{ width: '20%' }}
                      whileInView={{ width: '78%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.3, delay: 0.25 }}
                      className="h-full rounded-full bg-[#25d366]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-[#dfeae3] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="text-xs font-semibold text-[#079653]">
              MADE FOR SERVICE TEAMS
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold text-[#17332a] sm:text-4xl">
              One conversational layer. A clearer operation behind it.
            </h2>
          </motion.div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[#dfeae3] bg-[#dfeae3] sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                Stethoscope,
                'Clinics',
                'Appointments, reports and patient queries',
              ],
              [School, 'Coaching', 'Admissions, courses and demo classes'],
              [Scissors, 'Salons', 'Slots, services and repeat visits'],
              [
                Inbox,
                'Growing teams',
                'Leads, sales and support conversations',
              ],
            ].map(([Icon, title, description]) => {
              const IndustryIcon = Icon as typeof Stethoscope;
              return (
                <div key={title as string} className="bg-white p-5">
                  <IndustryIcon className="size-5 text-[#079653]" />
                  <h3 className="mt-5 text-sm font-semibold text-[#17332a]">
                    {title as string}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#71877b]">
                    {description as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-18 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-xl text-center"
          >
            <p className="text-xs font-semibold text-[#079653]">
              SIMPLE PRICING
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold text-[#17332a] sm:text-4xl">
              Start with the desk you need today.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6a8075]">
              Monthly plans designed to grow with your conversations.
            </p>
          </motion.div>
          <div
            className="mt-10 grid gap-4 lg:grid-cols-3 lg:items-stretch"
            aria-busy={plansLoading}
          >
            {plansLoading &&
              Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-[360px] animate-pulse rounded-xl border border-[#dbe8df] bg-white/70"
                />
              ))}
            {!plansLoading &&
              plans.map((plan) => {
                const featured = plan.id === featuredPlanId;
                const items = planFeatures(plan.features);
                const displayItems =
                  items.length > 0
                    ? items
                    : [
                        `${plan.max_whatsapp_numbers} WhatsApp number${plan.max_whatsapp_numbers === 1 ? '' : 's'}`,
                        `${plan.max_ai_requests.toLocaleString('en-IN')} AI replies / month`,
                      ];

                return (
                  <motion.article
                    key={plan.id}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.15 }}
                    variants={fadeUp}
                    transition={{ duration: 0.4 }}
                    className={`relative flex flex-col rounded-xl border p-6 ${featured ? 'border-[#075e54] bg-[#075e54] text-white shadow-[0_16px_36px_rgba(7,94,84,0.22)]' : 'border-[#dbe8df] bg-white text-[#17332a]'}`}
                  >
                    {featured && (
                      <span className="absolute top-5 right-5 rounded-full bg-[#25d366] px-2.5 py-1 text-[10px] font-semibold text-[#064b43]">
                        Most popular
                      </span>
                    )}
                    <p
                      className={`text-sm font-semibold ${featured ? 'text-[#9ee9bb]' : 'text-[#087f4c]'}`}
                    >
                      {plan.name}
                    </p>
                    <p className="mt-4 text-3xl font-semibold">
                      {formatPlanPrice(plan.monthly_price)}
                      <span
                        className={`ml-1 text-sm font-medium ${featured ? 'text-[#c9ead6]' : 'text-[#71877b]'}`}
                      >
                        /mo
                      </span>
                    </p>
                    <p
                      className={`mt-1 text-sm ${featured ? 'text-[#c9ead6]' : 'text-[#71877b]'}`}
                    >
                      {formatPlanDescription(plan)}
                    </p>
                    <div
                      className={`my-6 h-px ${featured ? 'bg-white/15' : 'bg-[#e5eee8]'}`}
                    />
                    <ul className="space-y-3">
                      {displayItems.map((item) => (
                        <li
                          key={item}
                          className={`flex items-center gap-2 text-sm ${featured ? 'text-white' : 'text-[#536b5f]'}`}
                        >
                          <Check
                            className={`size-4 ${featured ? 'text-[#25d366]' : 'text-[#079653]'}`}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={ctaHref}
                      className={`mt-8 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors ${featured ? 'bg-[#25d366] text-[#064b43] hover:bg-[#71e997]' : 'border border-[#bcd7c5] text-[#075e54] hover:bg-[#eff9f2]'}`}
                    >
                      {plan.name.toLowerCase().includes('enterprise')
                        ? 'Talk to us'
                        : 'Get started'}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </motion.article>
                );
              })}
            {!plansLoading && plans.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-[#c8ddd0] bg-white px-5 py-10 text-center text-sm text-[#6a8075]">
                {plansError
                  ? 'Pricing is temporarily unavailable. Please check back shortly.'
                  : 'No plans are available yet.'}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="border-t border-[#dfeae3] bg-white py-16 sm:py-24"
      >
        <div className="mx-auto grid max-w-5xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-semibold text-[#079653]">FAQ</p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold text-[#17332a]">
              A few useful answers.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6a8075]">
              Everything you need to know before your first customer message
              lands.
            </p>
          </div>
          <div className="divide-y divide-[#e4eee7] border-y border-[#e4eee7]">
            {faqs.map((faq, index) => (
              <div key={faq.question} className="py-4">
                <button
                  type="button"
                  onClick={() =>
                    setActiveFaq((current) =>
                      current === index ? null : index
                    )
                  }
                  className="flex w-full items-center justify-between gap-4 text-left text-sm font-semibold text-[#17332a]"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-[#079653] transition-transform ${activeFaq === index ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {activeFaq === index && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pt-3 pr-8 text-sm leading-6 text-[#6b8176]"
                    >
                      {faq.answer}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-xl bg-[#075e54] px-6 py-11 text-center text-white shadow-[0_18px_40px_rgba(7,94,84,0.18)] sm:px-12 sm:py-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.45 }}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 text-[#8dedad]">
              <MessagesSquare className="size-5" />
            </span>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl leading-tight font-semibold sm:text-4xl">
              Give every customer a better first reply.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#cfebd8]">
              Bring your WhatsApp conversations, customer records and front desk
              workflows into one calm, capable space.
            </p>
            <Link
              href={ctaHref}
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#25d366] px-5 text-sm font-semibold text-[#064b43] transition-colors hover:bg-[#8df0ad]"
            >
              {user ? 'Open dashboard' : 'Start with Helpa'}
              <Send className="size-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-[#dfeae3] bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-[#075e54] text-[#25d366]">
                <MessageCircle className="size-4 fill-current" />
              </span>
              <span className="text-base font-semibold text-[#17332a]">
                Helpa
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[#70867a]">
              A thoughtful WhatsApp AI receptionist for teams that care about
              every conversation.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-[#5e766a]">
            <a href="#product" className="hover:text-[#075e54]">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-[#075e54]">
              How it works
            </a>
            <a href="#pricing" className="hover:text-[#075e54]">
              Pricing
            </a>
            <Link href="/privacy" className="hover:text-[#075e54]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#075e54]">
              Terms
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-[#edf2ee] pt-5 text-xs text-[#84968c]">
          © {new Date().getFullYear()} Helpa Studio. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
