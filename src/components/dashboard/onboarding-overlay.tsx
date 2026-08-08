'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Stethoscope,
  Plane,
  GraduationCap,
  Utensils,
  Dumbbell,
  Loader2,
  Sparkles,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  Circle,
  BookOpenCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface IndustryItem {
  id: string;
  name: string;
  description: string;
  features: string[];
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
  border: string;
}

const INDUSTRIES: IndustryItem[] = [
  {
    id: 'hospital_clinic',
    name: 'Hospital & Clinic',
    description: 'AI Hospital Receptionist',
    features: [
      'Patient Communication',
      'Appointment Booking',
      'Doctor Directory',
      'AI Receptionist',
    ],
    icon: Stethoscope,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    description: 'AI Admission Assistant',
    features: [
      'Student Communication',
      'Course Enquiries',
      'Admission Management',
      'AI Counselor',
    ],
    icon: GraduationCap,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/5 hover:bg-indigo-500/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'AI Property Consultant',
    features: [
      'Lead Management',
      'Property Enquiries',
      'Site Visits',
      'AI Sales Assistant',
    ],
    icon: Building2,
    color: 'text-blue-500',
    bg: 'bg-blue-500/5 hover:bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    id: 'travel',
    name: 'Travel Agency',
    description: 'AI Travel Assistant',
    features: ['Booking Support', 'Tour Packages', 'Customer Communication'],
    icon: Plane,
    color: 'text-sky-500',
    bg: 'bg-sky-500/5 hover:bg-sky-500/10',
    border: 'border-sky-500/20 hover:border-sky-500/40',
  },
  {
    id: 'gym',
    name: 'Gym & Fitness',
    description: 'AI Membership Assistant',
    features: ['Member Support', 'Memberships', 'Class Booking'],
    icon: Dumbbell,
    color: 'text-red-500',
    bg: 'bg-red-500/5 hover:bg-red-500/10',
    border: 'border-red-500/20 hover:border-red-500/40',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'AI Reservation Assistant',
    features: ['Table Reservation', 'Customer Communication', 'Order Support'],
    icon: Utensils,
    color: 'text-orange-500',
    bg: 'bg-orange-500/5 hover:bg-orange-500/10',
    border: 'border-orange-500/20 hover:border-orange-500/40',
  },
  {
    id: 'solo_teacher',
    name: 'Solo Teacher',
    description: 'AI Teaching Assistant',
    features: [
      'Student Communication',
      'Course Management',
      'Enrollment Tracking',
      'AI Tutor',
    ],
    icon: BookOpenCheck,
    color: 'text-violet-500',
    bg: 'bg-violet-500/5 hover:bg-violet-500/10',
    border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  {
    id: 'other',
    name: 'Other Business',
    description: 'Create a custom workspace.',
    features: ['Custom Layouts', 'Flexible CRM Tools'],
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 hover:bg-muted/60',
    border: 'border-border hover:border-muted-foreground/30',
  },
];

interface ChecklistItem {
  label: string;
  status: 'idle' | 'loading' | 'done';
}

export function OnboardingOverlay() {
  const { profile, refreshProfile, refreshModules } = useAuth();

  // Steps: 0=Welcome, 1=Workspace Info, 2=Choose Industry, 3=Installing progress
  const [step, setStep] = useState(0);

  // Workspace Info State
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('India');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Selected Industry
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  // Seeding progress checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { label: 'Installing modules', status: 'idle' },
    { label: 'Creating dashboard', status: 'idle' },
    { label: 'Configuring AI', status: 'idle' },
    { label: 'Preparing Knowledge Base', status: 'idle' },
    { label: 'Preparing Campaign Templates', status: 'idle' },
    { label: 'Almost Ready...', status: 'idle' },
  ]);

  const handleNextStep = () => {
    if (step === 1 && !businessName.trim()) {
      toast.error('Please enter your Business Name.');
      return;
    }
    setStep(step + 1);
  };

  const updateChecklistItem = (
    index: number,
    status: 'idle' | 'loading' | 'done'
  ) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status } : item))
    );
  };

  const handleConfirmOnboard = async () => {
    if (!selectedIndustry) {
      toast.error('Selecting a business type is mandatory.');
      return;
    }

    setStep(3); // Render loading screen

    try {
      // Step-by-step progress checklist updates
      updateChecklistItem(0, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(0, 'done');

      updateChecklistItem(1, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(1, 'done');

      updateChecklistItem(2, 'loading');
      await new Promise((r) => setTimeout(r, 850));
      updateChecklistItem(2, 'done');

      updateChecklistItem(3, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(3, 'done');

      updateChecklistItem(4, 'loading');

      const response = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: selectedIndustry,
          name: businessName,
          ownerName,
          email,
          phone,
          country,
          timezone,
        }),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Failed to complete onboarding');

      updateChecklistItem(4, 'done');

      updateChecklistItem(5, 'loading');
      await new Promise((r) => setTimeout(r, 800));
      updateChecklistItem(5, 'done');

      toast.success('Workspace configured successfully!');

      // Force instant hot-reload of profile Context
      await refreshProfile();
      await refreshModules();
    } catch (err: any) {
      toast.error(err.message || 'Onboarding failed.');
      setStep(2); // Fallback to card selection on error
    }
  };

  // Calculate current progress percentage for Step 3
  const doneCount = checklist.filter((item) => item.status === 'done').length;
  const loadingCount = checklist.filter(
    (item) => item.status === 'loading'
  ).length;
  const setupPercentage = Math.round(
    ((doneCount + loadingCount * 0.5) / checklist.length) * 100
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md">
      {/* Background Aurora Glows */}
      <div className="bg-primary/10 pointer-events-none absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full blur-[120px] duration-[6000ms]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 animate-pulse rounded-full bg-indigo-500/10 blur-[120px] duration-[8000ms]" />

      <div className="bg-card/65 border-border/80 animate-in fade-in-50 zoom-in-95 relative z-10 flex w-full max-w-4xl flex-col gap-6 rounded-2xl border p-6 text-left shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl duration-300 md:p-8">
        {/* Step Indicators */}
        {step > 0 && step < 3 && (
          <div className="mt-1 flex items-center justify-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? 'bg-primary w-8 shadow-[0_0_8px_rgba(var(--primary),0.4)]'
                    : 'bg-border w-2'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <div className="flex flex-col items-center space-y-6 py-10 text-center">
            <div className="from-primary shadow-primary/10 flex h-20 w-20 animate-bounce items-center justify-center rounded-3xl bg-gradient-to-tr to-indigo-500 p-0.5 shadow-lg duration-[4000ms]">
              <div className="bg-card flex h-full w-full items-center justify-center rounded-[22px]">
                <Sparkles className="text-primary h-9.5 w-9.5 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-foreground from-foreground to-muted-foreground bg-gradient-to-r bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                Welcome to ReplyDesk
              </h2>
              <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
                Your intelligent multi-industry AI assistant dashboard. Let's
                seed your workspace parameters and templates in seconds.
              </p>
            </div>
            <Button
              onClick={handleNextStep}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-indigo-600 px-8 py-5.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-700 hover:shadow-indigo-500/35"
            >
              Get Started <ArrowRight className="h-4.5 w-4.5" />
            </Button>
          </div>
        )}

        {/* Step 1: Create Workspace */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-border/60 border-b pb-3.5">
              <h3 className="text-foreground text-2xl font-bold tracking-tight">
                Create Workspace
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Please provide setup details for your workspace settings.
              </p>
            </div>

            <div className="grid gap-4.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="bizName"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  Business Name
                </Label>
                <Input
                  id="bizName"
                  placeholder="e.g. Green Valley Agency"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-primary/20 rounded-lg transition-all focus:ring-1"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="owner"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  Owner Full Name
                </Label>
                <Input
                  id="owner"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-primary/20 rounded-lg transition-all focus:ring-1"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bizEmail"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  Business Email
                </Label>
                <Input
                  id="bizEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-primary/20 rounded-lg transition-all focus:ring-1"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bizPhone"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  Contact Phone
                </Label>
                <Input
                  id="bizPhone"
                  placeholder="+91..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-primary/20 rounded-lg transition-all focus:ring-1"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="country"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  Country
                </Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="border-border/80 bg-background/45 text-foreground focus:border-primary/50 h-10 w-full cursor-pointer rounded-lg border px-3 text-sm transition-all focus:outline-none"
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="timezone"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  Timezone
                </Label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="border-border/80 bg-background/45 text-foreground focus:border-primary/50 h-10 w-full cursor-pointer rounded-lg border px-3 text-sm transition-all focus:outline-none"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">
                    America/New_York (EST)
                  </option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                onClick={handleNextStep}
                disabled={!businessName.trim()}
                className="cursor-pointer rounded-full bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white transition-all duration-150 hover:scale-[1.01] hover:bg-indigo-700"
              >
                Next: Choose Business Type
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Business Type selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="mx-auto max-w-2xl space-y-2 text-center">
              <h2 className="text-foreground text-2xl font-extrabold tracking-tight sm:text-3xl">
                What type of business do you run?
              </h2>
              <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
                Choose your business type. ReplyDesk will automatically
                configure your workspace, AI assistant, dashboard, and
                workflows.
              </p>
            </div>

            <div className="grid max-h-[380px] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
              {INDUSTRIES.map((ind) => {
                const Icon = ind.icon;
                const isSelected = selectedIndustry === ind.id;

                // Dynamic styling profiles based on selections
                const borderClass = isSelected
                  ? 'border-primary ring-2 ring-primary/40 bg-primary/[0.04]'
                  : 'border-border/60 hover:border-primary/50 bg-background/25 hover:bg-background/45';

                return (
                  <button
                    key={ind.id}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`group relative flex cursor-pointer flex-col gap-3.5 overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all duration-200 outline-none hover:scale-[1.015] hover:shadow ${borderClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`bg-card border-border/80 rounded-xl border p-2.5 ${ind.color} shadow-sm transition-transform duration-200 group-hover:scale-110`}
                      >
                        <Icon className="h-5.5 w-5.5" />
                      </div>
                      {isSelected && (
                        <div className="bg-primary text-primary-foreground shadow-primary/20 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow-md">
                          ✓
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-foreground group-hover:text-primary text-sm font-bold transition-colors">
                        {ind.name}
                      </h4>
                      <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed font-medium">
                        {ind.description}
                      </p>
                    </div>

                    <div className="border-border/40 mt-auto space-y-1.5 border-t pt-2.5">
                      <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                        Primary Features:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ind.features.map((feat) => (
                          <span
                            key={feat}
                            className="bg-card border-border/50 text-muted-foreground rounded border px-2 py-0.5 text-[9px] font-medium"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-border/60 flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row">
              <p className="text-muted-foreground text-center text-[10px] sm:text-left">
                * Choosing a template is mandatory to pre-load matches.
              </p>
              <Button
                onClick={handleConfirmOnboard}
                disabled={!selectedIndustry}
                className="w-full cursor-pointer rounded-full bg-indigo-600 px-8 py-4 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] hover:bg-indigo-700 hover:shadow-indigo-500/35 disabled:opacity-50 sm:w-auto"
              >
                Confirm & Launch Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Seeding loading checklist screen */}
        {step === 3 && (
          <div className="mx-auto w-full max-w-md space-y-6 py-8 text-center">
            <div className="space-y-2">
              <h3 className="text-foreground text-2xl font-black tracking-tight">
                Setting up your workspace...
              </h3>
              <p className="text-muted-foreground text-xs">
                Please wait while we prepare your configuration settings.
              </p>
            </div>

            {/* Glowing Custom Progress Bar */}
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between px-1 text-[10px] font-bold tracking-wider uppercase">
                <span>Progress</span>
                <span className="text-primary font-extrabold">
                  {setupPercentage}%
                </span>
              </div>
              <div className="bg-muted/60 border-border/40 relative h-2.5 w-full overflow-hidden rounded-full border">
                <div
                  className="from-primary h-full rounded-full bg-gradient-to-r to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-300"
                  style={{ width: `${setupPercentage}%` }}
                />
              </div>
            </div>

            <div className="bg-muted/20 border-border/80 space-y-3.5 rounded-xl border p-5 text-left shadow-inner">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs"
                >
                  <span
                    className={`font-semibold tracking-wide ${
                      item.status === 'done'
                        ? 'text-foreground'
                        : item.status === 'loading'
                          ? 'animate-pulse font-bold text-indigo-600 dark:text-indigo-400'
                          : 'text-muted-foreground/60'
                    }`}
                  >
                    {item.label}
                  </span>
                  <div>
                    {item.status === 'done' ? (
                      <CheckCircle2 className="h-4.5 w-4.5 fill-emerald-500/10 text-emerald-500 shadow-sm" />
                    ) : item.status === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Circle className="text-muted-foreground/20 h-4.5 w-4.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
