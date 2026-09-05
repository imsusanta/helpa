'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Plane,
  UtensilsCrossed,
  Briefcase,
  Dumbbell,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Bot,
  Send,
  Clock,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embedded-signup';
import { WhatsAppQrPanel } from '@/components/settings/whatsapp-qr-panel';

interface IndustryOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultServices: Array<{ name: string; price: number; desc: string }>;
  sampleQuestions: string[];
}

const INDUSTRIES: IndustryOption[] = [
  {
    id: 'hospital_clinic',
    name: 'Clinic / Healthcare',
    description: 'Patient bookings, doctors, and clinic inquiries.',
    icon: Stethoscope,
    color: 'text-emerald-500',
    defaultServices: [
      {
        name: 'Doctor Consultation',
        price: 500,
        desc: 'General physician OPD consultation',
      },
      {
        name: 'Dental Checkup',
        price: 800,
        desc: 'Complete dental checkup and clean',
      },
      {
        name: 'Health Package',
        price: 1500,
        desc: 'Comprehensive health screening',
      },
    ],
    sampleQuestions: [
      'What are your consultation fees?',
      'What are your clinic timings?',
      'Where is your clinic located?',
      'Can I book an appointment for tomorrow?',
    ],
  },
  {
    id: 'salon',
    name: 'Salon / Beauty',
    description: 'Stylist appointments, haircuts, and salon services.',
    icon: Sparkles,
    color: 'text-pink-500',
    defaultServices: [
      {
        name: 'Haircut & Styling',
        price: 300,
        desc: 'Professional cut and styling',
      },
      { name: 'Facial & Glow', price: 800, desc: 'Herbal facial treatment' },
      { name: 'Hair Spa', price: 1200, desc: 'Deep conditioning therapy' },
    ],
    sampleQuestions: [
      'How much is a haircut?',
      'What are your salon hours?',
      'Do you offer bridal packages?',
      'Can I book a facial appointment?',
    ],
  },
  {
    id: 'travel',
    name: 'Travel Agency',
    description: 'Holiday packages, tours, and travel itineraries.',
    icon: Plane,
    color: 'text-sky-500',
    defaultServices: [
      {
        name: 'Goa Tour Package',
        price: 18999,
        desc: '4 Days / 3 Nights with hotel & transfers',
      },
      {
        name: 'Darjeeling Tour',
        price: 12999,
        desc: '3 Days / 2 Nights scenic hill stay',
      },
      {
        name: 'Sikkim Adventure',
        price: 15999,
        desc: '5 Days / 4 Nights mountain explorer',
      },
    ],
    sampleQuestions: [
      'What is your Goa package price?',
      'Do you have a Darjeeling tour?',
      'What is included in the package?',
      'How can I book a tour?',
    ],
  },
  {
    id: 'coaching',
    name: 'Coaching / Education',
    description: 'Student admissions, courses, and batch inquiries.',
    icon: GraduationCap,
    color: 'text-indigo-500',
    defaultServices: [
      {
        name: 'Class 10 Math & Science',
        price: 1500,
        desc: 'Monthly batch with weekly tests',
      },
      {
        name: 'Competitive Exam Prep',
        price: 4500,
        desc: '3-month intensive course',
      },
      {
        name: 'English Speaking Course',
        price: 2000,
        desc: 'Spoken English & communication',
      },
    ],
    sampleQuestions: [
      'What courses do you teach?',
      'What is the monthly batch fee?',
      'When does the new batch start?',
      'Can I attend a free demo class?',
    ],
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Properties, site visits, and commercial listings.',
    icon: Building2,
    color: 'text-blue-500',
    defaultServices: [
      {
        name: '2 BHK Modern Apartment',
        price: 4500000,
        desc: 'Prime location, ready to move',
      },
      {
        name: '3 BHK Luxury Flat',
        price: 7500000,
        desc: 'Gated community with amenities',
      },
      {
        name: 'Commercial Space',
        price: 3000000,
        desc: 'High footfall retail shop',
      },
    ],
    sampleQuestions: [
      'What properties are available in the city?',
      'What is the starting price for 2 BHK?',
      'Can I book a site visit?',
      'Are bank loans available?',
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant / Cafe',
    description: 'Table reservations, menu pricing, and food orders.',
    icon: UtensilsCrossed,
    color: 'text-amber-500',
    defaultServices: [
      {
        name: 'Executive Buffet Dinner',
        price: 799,
        desc: 'Unlimited multi-cuisine buffet',
      },
      {
        name: 'Special Family Combo',
        price: 1299,
        desc: 'Starters, mains & dessert for 4',
      },
      {
        name: 'Chef Special Platter',
        price: 450,
        desc: 'Signature gourmet selection',
      },
    ],
    sampleQuestions: [
      'What are your restaurant timings?',
      'Can I reserve a table for 4 tonight?',
      'What is the price of your buffet?',
      'Do you offer home delivery?',
    ],
  },
  {
    id: 'gym',
    name: 'Fitness / Gym',
    description: 'Gyms, fitness centers, and personal trainers.',
    icon: Dumbbell,
    color: 'text-emerald-400',
    defaultServices: [
      {
        name: 'Monthly Gym Membership',
        price: 1499,
        desc: 'Full gym floor & cardio access',
      },
      {
        name: 'Personal Training (10 Sessions)',
        price: 4999,
        desc: '1-on-1 personalized trainer coaching',
      },
      {
        name: 'Annual VIP Fitness Pass',
        price: 11999,
        desc: 'Unlimited annual access + diet plan',
      },
    ],
    sampleQuestions: [
      'What are your gym membership fees?',
      'What are your operating hours?',
      'Do you provide personal trainers?',
      'Can I get a free trial pass?',
    ],
  },
  {
    id: 'general',
    name: 'Other Business',
    description: 'Custom services, general business support.',
    icon: Briefcase,
    color: 'text-violet-500',
    defaultServices: [
      {
        name: 'Standard Consultation',
        price: 999,
        desc: 'Professional service consultation',
      },
      {
        name: 'Standard Service Plan',
        price: 2499,
        desc: 'Full service delivery',
      },
      {
        name: 'Premium Support Package',
        price: 4999,
        desc: 'Priority dedicated assistance',
      },
    ],
    sampleQuestions: [
      'What services do you provide?',
      'What are your pricing rates?',
      'How do I get started?',
      'What are your business hours?',
    ],
  },
];

interface OnboardingOverlayProps {
  /** Called after successful onboarding completion. Parent should close the overlay. */
  onComplete?: () => Promise<void>;
  /** Called when the user chooses to defer onboarding. Parent hides for this session. */
  onDefer?: () => void;
}

export function OnboardingOverlay({
  onComplete,
  onDefer,
}: OnboardingOverlayProps = {}) {
  const { account, refreshProfile, refreshModules } = useAuth();

  // Active step: 1 to 6
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // STEP 1: Business Profile
  const [businessName, setBusinessName] = useState(account?.name || '');
  const [selectedIndustry, setSelectedIndustry] =
    useState<string>('hospital_clinic');
  const [city, setCity] = useState('');
  const [workingDays, setWorkingDays] = useState('Mon - Sat (Sunday Closed)');

  // STEP 2: Services
  const [services, setServices] = useState<
    Array<{ name: string; price: string | number; desc: string }>
  >([
    {
      name: 'Doctor Consultation',
      price: '500',
      desc: 'General physician OPD consultation',
    },
    {
      name: 'Dental Checkup',
      price: '800',
      desc: 'Complete dental checkup and clean',
    },
    {
      name: 'Health Checkup',
      price: '1500',
      desc: 'Comprehensive health screening',
    },
  ]);

  // STEP 3: WhatsApp
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [whatsappTab, setWhatsappTab] = useState<'embedded' | 'qr' | 'manual'>(
    'embedded'
  );
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [token, setToken] = useState('');
  const [connectingEmbedded, setConnectingEmbedded] = useState(false);

  // STEP 4: AI Receptionist Greeting
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Namaste! Welcome to our practice. How can I help you today?'
  );

  // STEP 5: Test AI Chat
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);
  const [inputMsg, setInputMsg] = useState('');
  const [testingAi, setTestingAi] = useState(false);
  const [hasTestedAi, setHasTestedAi] = useState(false);

  // Sync default services and sample questions when industry changes
  useEffect(() => {
    const matched = INDUSTRIES.find((i) => i.id === selectedIndustry);
    if (matched) {
      setServices(
        matched.defaultServices.map((s) => ({
          name: s.name,
          price: String(s.price),
          desc: s.desc,
        }))
      );
      if (businessName) {
        setWelcomeMessage(
          `Namaste! Welcome to ${businessName}. How can I assist you today?`
        );
      }
    }
  }, [selectedIndustry, businessName]);

  // Check initial WhatsApp connection status
  useEffect(() => {
    async function checkWhatsApp() {
      try {
        const res = await fetch('/api/whatsapp/config');
        if (res.ok) {
          const data = await res.json();
          const isConnected = data?.connected === true;
          const isConfigured = Boolean(
            data?.configured || data?.config?.phone_number_id
          );
          setWhatsappConnected(isConnected);
          setWhatsappConfigured(isConfigured);
        }
      } catch {
        /* ignore fallback */
      }
    }
    checkWhatsApp();
  }, []);

  const activeIndustryData =
    INDUSTRIES.find((i) => i.id === selectedIndustry) || INDUSTRIES[0];

  // Handler for Step 1 -> Step 2
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error('Please enter your Business Name');
      return;
    }
    setCurrentStep(2);
  };

  // Handler for Step 2 -> Step 3
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = services.some((s) => s.name.trim() !== '');
    if (!valid) {
      toast.error('Please add at least 1 service or product');
      return;
    }
    setCurrentStep(3);
  };

  // Handler for WhatsApp Embedded Signup
  const handleLaunchMetaSignup = async () => {
    setConnectingEmbedded(true);
    try {
      // 1. Create secure connection session on Helpa backend to obtain OAuth state and config
      const sessionRes = await fetch('/api/whatsapp/oauth/session', {
        method: 'POST',
      });
      const sessionData = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok || !sessionData?.state) {
        throw new Error(
          sessionData?.error ||
            'Failed to initialize WhatsApp connection session'
        );
      }

      const appId =
        sessionData.appId ||
        process.env.NEXT_PUBLIC_META_APP_ID ||
        '1461038582135406';
      const configId =
        sessionData.configId ||
        process.env.NEXT_PUBLIC_META_CONFIG_ID ||
        '4607476386162686';

      const result = await launchWhatsAppEmbeddedSignup({
        appId,
        configId,
        mode: 'coexistence',
      });

      if (result?.code || result?.accessToken) {
        const res = await fetch('/api/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: result.code,
            accessToken: result.accessToken,
            state: sessionData.state,
            waba_id: result.wabaId,
            phone_number_id: result.phoneNumberId,
            mode: 'coexistence',
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setWhatsappConnected(true);
          toast.success('🎉 WhatsApp connected successfully!');
        } else {
          toast.error(data.error || 'Failed to complete WhatsApp connection');
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'WhatsApp connection cancelled';
      toast.error(msg);
    } finally {
      setConnectingEmbedded(false);
    }
  };

  // Handler for Manual WhatsApp Save
  const handleSaveManualWhatsApp = async () => {
    if (!phoneId || !wabaId || !token) {
      toast.error('Please enter Phone ID, WABA ID, and Permanent Token');
      return;
    }
    setConnectingEmbedded(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneId.trim(),
          waba_id: wabaId.trim(),
          access_token: token.trim(),
          is_active: true,
        }),
      });
      if (res.ok) {
        setWhatsappConfigured(true);
        // Verify live connectivity
        const checkRes = await fetch('/api/whatsapp/config').catch(() => null);
        const checkData =
          checkRes && checkRes.ok
            ? await checkRes.json().catch(() => ({}))
            : null;
        if (checkData?.connected === true) {
          setWhatsappConnected(true);
          toast.success('WhatsApp connected and verified!');
        } else {
          setWhatsappConnected(false);
          toast.info('WhatsApp credentials saved (verification pending).');
        }
      } else {
        toast.error('Failed to save WhatsApp credentials');
      }
    } catch {
      toast.error('Network error saving WhatsApp');
    } finally {
      setConnectingEmbedded(false);
    }
  };

  // Handler for Step 5: Live AI Test Chat (No fake replies on error)
  const handleSendTestMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMsg;
    if (!textToSend.trim() || testingAi) return;

    const newChat = [
      ...chatMessages,
      { role: 'user' as const, text: textToSend },
    ];
    setChatMessages(newChat);
    setInputMsg('');
    setTestingAi(true);

    try {
      const res = await fetch('/api/account/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        setChatMessages([
          ...newChat,
          { role: 'assistant' as const, text: data.reply },
        ]);
        setHasTestedAi(true);
      } else {
        const errorReply =
          data.error ||
          'Unable to reach AI test service. Please verify AI provider configuration or retry.';
        setChatMessages([
          ...newChat,
          { role: 'assistant' as const, text: `⚠️ ${errorReply}` },
        ]);
        setHasTestedAi(false);
      }
    } catch {
      setChatMessages([
        ...newChat,
        {
          role: 'assistant' as const,
          text: '⚠️ Network error communicating with AI test service. Please retry.',
        },
      ]);
      setHasTestedAi(false);
    } finally {
      setTestingAi(false);
    }
  };

  // STEP 6: Final Setup Submission
  const handleCompleteGoLive = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: selectedIndustry,
          name: businessName,
          city,
          location: city,
          workingDays,
          welcomeMessage,
          services: services.filter((s) => s.name.trim() !== ''),
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to complete setup');
      }

      if (resData.status === 'already_completed') {
        toast.info('Workspace setup is already saved.');
      } else {
        toast.success('🎉 Workspace setup saved!');
      }

      await refreshProfile();
      await refreshModules();
      // Notify parent gate so the overlay closes and does not reappear
      await onComplete?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error completing setup'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
    >
      <div className="mx-auto my-auto flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#090D16] p-5 shadow-2xl sm:p-6 md:p-8">
          {/* Step Progress Header */}
          <div className="mb-6">
            <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold tracking-wider uppercase">
              <span>Step {currentStep} of 6</span>
              <span className="font-bold text-emerald-400">
                {currentStep === 1 && 'Business Profile'}
                {currentStep === 2 && 'Services & Prices'}
                {currentStep === 3 && 'WhatsApp Setup'}
                {currentStep === 4 && 'AI Greeting'}
                {currentStep === 5 && 'Test AI Receptionist'}
                {currentStep === 6 && 'Review Setup'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1: Business Profile */}
          {currentStep === 1 && (
            <form
              onSubmit={handleStep1Submit}
              className="animate-in fade-in-50 space-y-5 duration-200"
            >
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-xl font-bold text-white"
                >
                  Tell us about your business
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Helpa uses this to personalize your AI Receptionist and
                  customer conversations.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="bName"
                    className="text-xs font-semibold text-zinc-300 uppercase"
                  >
                    Business / Practice Name *
                  </Label>
                  <Input
                    id="bName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Dr. Sharma Clinic or Royal Spa"
                    className="mt-1.5 border-white/10 bg-white/5 text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-zinc-300 uppercase">
                    Business Type *
                  </Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {INDUSTRIES.map((ind) => {
                      const Icon = ind.icon;
                      const isSelected = selectedIndustry === ind.id;
                      return (
                        <button
                          type="button"
                          key={ind.id}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedIndustry(ind.id)}
                          className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                              : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <Icon
                            className={`mb-1.5 size-5 ${isSelected ? 'text-emerald-400' : ind.color}`}
                          />
                          <span className="text-xs font-medium">
                            {ind.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label
                      htmlFor="city"
                      className="text-xs font-semibold text-zinc-300 uppercase"
                    >
                      City / Location
                    </Label>
                    <div className="relative mt-1.5">
                      <MapPin className="absolute top-3 left-3 size-4 text-zinc-400" />
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Mumbai, Kolkata, Delhi"
                        className="border-white/10 bg-white/5 pl-9 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="hours"
                      className="text-xs font-semibold text-zinc-300 uppercase"
                    >
                      Working Days & Hours
                    </Label>
                    <div className="relative mt-1.5">
                      <Clock className="absolute top-3 left-3 size-4 text-zinc-400" />
                      <Input
                        id="hours"
                        value={workingDays}
                        onChange={(e) => setWorkingDays(e.target.value)}
                        placeholder="e.g. Mon - Sat (09:00 AM - 08:00 PM)"
                        className="border-white/10 bg-white/5 pl-9 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-white/10 pt-4">
                <Button
                  type="submit"
                  className="bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-700"
                >
                  Continue <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Services & Pricing */}
          {currentStep === 2 && (
            <form
              onSubmit={handleStep2Submit}
              className="animate-in fade-in-50 space-y-5 duration-200"
            >
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-xl font-bold text-white"
                >
                  Tell your AI what you offer
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Add your top services or products so your AI receptionist can
                  accurately quote prices to customers.
                </p>
              </div>

              <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
                {services.map((srv, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase">
                      <span>Service #{idx + 1}</span>
                      <span className="text-emerald-400">Price in ₹ INR</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={srv.name}
                        onChange={(e) => {
                          const copy = [...services];
                          copy[idx].name = e.target.value;
                          setServices(copy);
                        }}
                        placeholder="Service Name (e.g. Haircut / Consultation)"
                        className="col-span-2 border-white/10 bg-white/5 text-sm text-white"
                        required={idx === 0}
                      />
                      <Input
                        value={srv.price}
                        onChange={(e) => {
                          const copy = [...services];
                          copy[idx].price = e.target.value;
                          setServices(copy);
                        }}
                        placeholder="₹ Amount"
                        type="number"
                        className="border-white/10 bg-white/5 text-sm text-white"
                        required={idx === 0}
                      />
                    </div>
                    <Input
                      value={srv.desc}
                      onChange={(e) => {
                        const copy = [...services];
                        copy[idx].desc = e.target.value;
                        setServices(copy);
                      }}
                      placeholder="Short description or duration (optional)"
                      className="border-white/10 bg-white/5 text-xs text-zinc-300"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="border-white/10 text-zinc-300 hover:text-white"
                >
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-700"
                >
                  Continue <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: Connect WhatsApp */}
          {currentStep === 3 && (
            <div className="animate-in fade-in-50 space-y-5 duration-200">
              <div>
                <div className="flex items-center justify-between">
                  <h2
                    id="onboarding-step-title"
                    className="text-xl font-bold text-white"
                  >
                    Connect your WhatsApp
                  </h2>
                  {whatsappConnected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
                      <AlertTriangle className="size-3.5" /> Not Connected
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  Connect your WhatsApp number so Helpa can automatically answer
                  incoming chats.
                </p>
              </div>

              {/* Methods Tab */}
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setWhatsappTab('embedded')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    whatsappTab === 'embedded'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Meta 1-Click Connect
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappTab('qr')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    whatsappTab === 'qr'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  WhatsApp QR Scan
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappTab('manual')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    whatsappTab === 'manual'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Manual API Key
                </button>
              </div>

              {/* Tab 1: Embedded Meta */}
              {whatsappTab === 'embedded' && (
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                  <Smartphone className="mx-auto size-10 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Meta Official Embedded Connection
                    </h3>
                    <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                      Log in with Facebook to link your WhatsApp Business number
                      directly in seconds.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleLaunchMetaSignup}
                    disabled={connectingEmbedded}
                    className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                  >
                    {connectingEmbedded ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Smartphone className="mr-1.5 size-4" />
                    )}
                    Connect with WhatsApp Meta
                  </Button>
                </div>
              )}

              {/* Tab 2: QR Scanner */}
              {whatsappTab === 'qr' && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                  <WhatsAppQrPanel
                    onConnectionSuccess={() => setWhatsappConnected(true)}
                  />
                </div>
              )}

              {/* Tab 3: Manual API */}
              {whatsappTab === 'manual' && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div>
                    <Label className="text-xs text-zinc-300">
                      Phone Number ID
                    </Label>
                    <Input
                      value={phoneId}
                      onChange={(e) => setPhoneId(e.target.value)}
                      placeholder="e.g. 104829104829104"
                      className="mt-1 border-white/10 bg-white/5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-300">
                      WhatsApp Business Account ID (WABA ID)
                    </Label>
                    <Input
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      placeholder="e.g. 984729104829104"
                      className="mt-1 border-white/10 bg-white/5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-300">
                      Permanent Access Token
                    </Label>
                    <Input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="EAAB..."
                      type="password"
                      className="mt-1 border-white/10 bg-white/5 text-xs text-white"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveManualWhatsApp}
                    disabled={connectingEmbedded}
                    className="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                  >
                    Save & Connect
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="border-white/10 text-zinc-300 hover:text-white"
                >
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  {!whatsappConnected && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        toast.info(
                          'You can connect WhatsApp later in Settings.'
                        );
                        setCurrentStep(4);
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Skip for now
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-700"
                  >
                    Continue <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AI Receptionist Greeting */}
          {currentStep === 4 && (
            <div className="animate-in fade-in-50 space-y-5 duration-200">
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-xl font-bold text-white"
                >
                  Configure your AI Receptionist
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Personalize how your AI greets customers when they text you on
                  WhatsApp.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="greeting"
                    className="text-xs font-semibold text-zinc-300 uppercase"
                  >
                    Welcome Greeting Message
                  </Label>
                  <Textarea
                    id="greeting"
                    rows={3}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Namaste! Welcome to our practice. How can I help you today?"
                    className="mt-1.5 border-white/10 bg-white/5 text-sm text-white"
                  />
                </div>

                {/* Summary Card */}
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
                  <div className="flex items-center justify-between font-medium text-zinc-400">
                    <span>Business</span>
                    <span className="font-bold text-white">
                      {businessName || 'My Practice'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-zinc-400">
                    <span>Industry Type</span>
                    <span className="font-semibold text-emerald-400">
                      {activeIndustryData.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-zinc-400">
                    <span>Hours</span>
                    <span className="text-white">{workingDays}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-zinc-400">
                    <span>Multilingual Support</span>
                    <span className="font-semibold text-emerald-400">
                      Auto-detect (Hindi, Bengali, English, Hinglish)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="border-white/10 text-zinc-300 hover:text-white"
                >
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-700"
                >
                  Continue to Test AI <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Test AI Chat Simulator */}
          {currentStep === 5 && (
            <div className="animate-in fade-in-50 space-y-5 duration-200">
              <div>
                <div className="flex items-center justify-between">
                  <h2
                    id="onboarding-step-title"
                    className="text-xl font-bold text-white"
                  >
                    Test your AI Receptionist
                  </h2>
                  {hasTestedAi && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> AI Tested
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ask a sample question just like one of your customers.
                </p>
              </div>

              {/* Quick Sample Question Chips */}
              <div className="flex flex-wrap gap-1.5">
                {activeIndustryData.sampleQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendTestMessage(q)}
                    disabled={testingAi}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-left text-xs text-zinc-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300"
                  >
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>

              {/* Chat Simulator Box */}
              <div className="h-52 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3.5">
                {chatMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-xs text-zinc-500">
                    <Bot className="mb-1 size-8 text-emerald-500/40" />
                    <p>
                      Click a suggested question above or type below to test
                      your AI receptionist.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                          m.role === 'user'
                            ? 'rounded-br-none bg-emerald-600 text-white'
                            : 'rounded-bl-none bg-white/10 text-zinc-200'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
                {testingAi && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Loader2 className="size-3.5 animate-spin" /> AI
                    Receptionist is replying...
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <Input
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendTestMessage();
                  }}
                  placeholder="Type a customer question..."
                  className="border-white/10 bg-white/5 text-sm text-white"
                />
                <Button
                  type="button"
                  onClick={() => handleSendTestMessage()}
                  disabled={testingAi || !inputMsg.trim()}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Send className="size-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(4)}
                  className="border-white/10 text-zinc-300 hover:text-white"
                >
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-700"
                >
                  Review Setup <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: Final Review & Save Setup */}
          {currentStep === 6 && (
            <div className="animate-in fade-in-50 space-y-5 duration-200">
              <div>
                <h2
                  id="onboarding-step-title"
                  className="text-xl font-bold text-white"
                >
                  📋 Review Workspace Setup
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Review your setup checklist and save your workspace
                  configuration.
                </p>
              </div>

              <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
                <div className="flex items-center justify-between border-b border-white/5 py-1.5">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="size-4 text-emerald-400" />{' '}
                    Business Profile
                  </span>
                  <span className="font-semibold text-white">
                    {businessName}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 py-1.5">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="size-4 text-emerald-400" />{' '}
                    Services Configured
                  </span>
                  <span className="font-semibold text-emerald-400">
                    {services.filter((s) => s.name).length} Services
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 py-1.5">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="size-4 text-emerald-400" /> AI
                    Receptionist Greeting
                  </span>
                  <span className="text-white">Configured</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 py-1.5">
                  <span className="flex items-center gap-2 text-zinc-300">
                    {hasTestedAi ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-400" />
                    )}
                    AI Testing
                  </span>
                  <span
                    className={
                      hasTestedAi
                        ? 'font-semibold text-emerald-400'
                        : 'text-amber-400'
                    }
                  >
                    {hasTestedAi ? 'Passed' : 'Skipped / Untested'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="flex items-center gap-2 text-zinc-300">
                    {whatsappConnected ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-400" />
                    )}
                    WhatsApp Connection
                  </span>
                  <span
                    className={
                      whatsappConnected
                        ? 'font-semibold text-emerald-400'
                        : 'text-amber-400'
                    }
                  >
                    {whatsappConnected
                      ? 'Connected'
                      : whatsappConfigured
                        ? 'Credentials saved (Unverified)'
                        : 'Pending (Connect in Settings)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(5)}
                  className="border-white/10 text-zinc-300 hover:text-white"
                >
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  {onDefer && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        toast.info(
                          'You can resume setup anytime from the dashboard.'
                        );
                        onDefer();
                      }}
                      disabled={saving}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Finish later
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleCompleteGoLive}
                    disabled={saving}
                    className="bg-emerald-600 px-8 font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
                  >
                    {saving ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : null}
                    Save Setup & Open Dashboard
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
