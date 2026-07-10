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
  BookOpenCheck
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
    features: ['Patient Communication', 'Appointment Booking', 'Doctor Directory', 'AI Receptionist'],
    icon: Stethoscope,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    description: 'AI Admission Assistant',
    features: ['Student Communication', 'Course Enquiries', 'Admission Management', 'AI Counselor'],
    icon: GraduationCap,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/5 hover:bg-indigo-500/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'AI Property Consultant',
    features: ['Lead Management', 'Property Enquiries', 'Site Visits', 'AI Sales Assistant'],
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
    features: ['Student Communication', 'Course Management', 'Enrollment Tracking', 'AI Tutor'],
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
    { label: 'Almost Ready...', status: 'idle' }
  ]);

  const handleNextStep = () => {
    if (step === 1 && !businessName.trim()) {
      toast.error('Please enter your Business Name.');
      return;
    }
    setStep(step + 1);
  };

  const updateChecklistItem = (index: number, status: 'idle' | 'loading' | 'done') => {
    setChecklist(prev => prev.map((item, i) => i === index ? { ...item, status } : item));
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
      await new Promise(r => setTimeout(r, 800));
      updateChecklistItem(0, 'done');

      updateChecklistItem(1, 'loading');
      await new Promise(r => setTimeout(r, 800));
      updateChecklistItem(1, 'done');

      updateChecklistItem(2, 'loading');
      await new Promise(r => setTimeout(r, 850));
      updateChecklistItem(2, 'done');

      updateChecklistItem(3, 'loading');
      await new Promise(r => setTimeout(r, 800));
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
          timezone
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to complete onboarding');

      updateChecklistItem(4, 'done');

      updateChecklistItem(5, 'loading');
      await new Promise(r => setTimeout(r, 800));
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
  const doneCount = checklist.filter(item => item.status === 'done').length;
  const loadingCount = checklist.filter(item => item.status === 'loading').length;
  const setupPercentage = Math.round(((doneCount + (loadingCount * 0.5)) / checklist.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      {/* Background Aurora Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="w-full max-w-4xl bg-card/65 backdrop-blur-xl border border-border/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-6 md:p-8 flex flex-col gap-6 animate-in fade-in-50 zoom-in-95 duration-300 relative z-10 text-left">
        
        {/* Step Indicators */}
        {step > 0 && step < 3 && (
          <div className="flex items-center justify-center gap-2 mt-1">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s ? "w-8 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" : "w-2 bg-border"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <div className="text-center py-10 space-y-6 flex flex-col items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary to-indigo-500 p-0.5 shadow-lg shadow-primary/10 animate-bounce duration-[4000ms]">
              <div className="h-full w-full bg-card rounded-[22px] flex items-center justify-center">
                <Sparkles className="h-9.5 w-9.5 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-5xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Welcome to ReplyDesk
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                Your intelligent multi-industry AI assistant dashboard. Let's seed your workspace parameters and templates in seconds.
              </p>
            </div>
            <Button
              onClick={handleNextStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-5.5 font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200 hover:scale-[1.02] inline-flex items-center gap-1.5 cursor-pointer text-sm"
            >
              Get Started <ArrowRight className="h-4.5 w-4.5" />
            </Button>
          </div>
        )}

        {/* Step 1: Create Workspace */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b border-border/60 pb-3.5">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">Create Workspace</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Please provide setup details for your workspace settings.</p>
            </div>

            <div className="grid gap-4.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bizName" className="text-muted-foreground font-semibold text-xs">Business Name</Label>
                <Input
                  id="bizName"
                  placeholder="e.g. Green Valley Agency"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner" className="text-muted-foreground font-semibold text-xs">Owner Full Name</Label>
                <Input
                  id="owner"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizEmail" className="text-muted-foreground font-semibold text-xs">Business Email</Label>
                <Input
                  id="bizEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizPhone" className="text-muted-foreground font-semibold text-xs">Contact Phone</Label>
                <Input
                  id="bizPhone"
                  placeholder="+91..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-background/45 border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-muted-foreground font-semibold text-xs">Country</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border/80 bg-background/45 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone" className="text-muted-foreground font-semibold text-xs">Timezone</Label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border/80 bg-background/45 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                onClick={handleNextStep}
                disabled={!businessName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 py-2.5 font-bold hover:scale-[1.01] transition-all duration-150 cursor-pointer text-xs"
              >
                Next: Choose Business Type
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Business Type selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
                What type of business do you run?
              </h2>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Choose your business type. ReplyDesk will automatically configure your workspace, AI assistant, dashboard, and workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[380px] overflow-y-auto pr-1">
              {INDUSTRIES.map((ind) => {
                const Icon = ind.icon;
                const isSelected = selectedIndustry === ind.id;
                
                // Dynamic styling profiles based on selections
                const borderClass = isSelected
                  ? "border-primary ring-2 ring-primary/40 bg-primary/[0.04]"
                  : "border-border/60 hover:border-primary/50 bg-background/25 hover:bg-background/45";

                return (
                  <button
                    key={ind.id}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`text-left p-4 rounded-xl border flex flex-col gap-3.5 transition-all duration-200 cursor-pointer relative overflow-hidden group outline-none hover:scale-[1.015] shadow-sm hover:shadow ${borderClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl bg-card border border-border/80 ${ind.color} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className="h-5.5 w-5.5" />
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-black shadow-md shadow-primary/20">
                          ✓
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        {ind.name}
                      </h4>
                      <p className="text-muted-foreground text-[11px] leading-relaxed mt-0.5 font-medium">
                        {ind.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t border-border/40 pt-2.5 mt-auto">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Primary Features:</span>
                      <div className="flex flex-wrap gap-1">
                        {ind.features.map((feat) => (
                          <span key={feat} className="text-[9px] bg-card border border-border/50 text-muted-foreground px-2 py-0.5 rounded font-medium">
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 pt-4">
              <p className="text-[10px] text-muted-foreground text-center sm:text-left">
                * Choosing a template is mandatory to pre-load matches.
              </p>
              <Button
                onClick={handleConfirmOnboard}
                disabled={!selectedIndustry}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-4 font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50 text-xs"
              >
                Confirm & Launch Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Seeding loading checklist screen */}
        {step === 3 && (
          <div className="max-w-md mx-auto w-full py-8 space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground tracking-tight">Setting up your workspace...</h3>
              <p className="text-xs text-muted-foreground">Please wait while we prepare your configuration settings.</p>
            </div>

            {/* Glowing Custom Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">
                <span>Progress</span>
                <span className="text-primary font-extrabold">{setupPercentage}%</span>
              </div>
              <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden border border-border/40 relative">
                <div
                  className="bg-gradient-to-r from-primary to-indigo-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                  style={{ width: `${setupPercentage}%` }}
                />
              </div>
            </div>

            <div className="bg-muted/20 border border-border/80 rounded-xl p-5 text-left space-y-3.5 shadow-inner">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className={`font-semibold tracking-wide ${
                    item.status === 'done'
                      ? 'text-foreground'
                      : item.status === 'loading'
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold animate-pulse'
                      : 'text-muted-foreground/60'
                  }`}>
                    {item.label}
                  </span>
                  <div>
                    {item.status === 'done' ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 fill-emerald-500/10 shadow-sm" />
                    ) : item.status === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Circle className="h-4.5 w-4.5 text-muted-foreground/20" />
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
