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
  Globe,
  Settings,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface IndustryItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
  border: string;
}

const INDUSTRIES: IndustryItem[] = [
  {
    id: 'hospital_clinic',
    name: 'Hospital & Clinic',
    description: 'AI Hospital Receptionist - Manage patients, doctors, appointments, and lab reports.',
    icon: Stethoscope,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'coaching',
    name: 'Coaching Institute',
    description: 'AI Admission Assistant - Track student admissions, batch courses, and fees.',
    icon: GraduationCap,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/5 hover:bg-indigo-500/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'AI Property Consultant - Manage leads, site tours, agents, and listings.',
    icon: Building2,
    color: 'text-blue-500',
    bg: 'bg-blue-500/5 hover:bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    id: 'travel',
    name: 'Travel Agency',
    description: 'AI Travel Assistant - Organize client packages, quotations, and active trips.',
    icon: Plane,
    color: 'text-sky-500',
    bg: 'bg-sky-500/5 hover:bg-sky-500/10',
    border: 'border-sky-500/20 hover:border-sky-500/40',
  },
  {
    id: 'gym',
    name: 'Gym & Fitness',
    description: 'AI Membership Assistant - Manage members, memberships, and personal trainers.',
    icon: Dumbbell,
    color: 'text-red-500',
    bg: 'bg-red-500/5 hover:bg-red-500/10',
    border: 'border-red-500/20 hover:border-red-500/40',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'AI Reservation Assistant - Coordinate guest table bookings and special menus.',
    icon: Utensils,
    color: 'text-orange-500',
    bg: 'bg-orange-500/5 hover:bg-orange-500/10',
    border: 'border-orange-500/20 hover:border-orange-500/40',
  },
];

export function OnboardingOverlay() {
  const { profile, refreshProfile, refreshModules } = useAuth();
  
  // Wizard steps: 0=Welcome, 1=Workspace Info, 2=Choose Industry, 3=Installing
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
  const [loading, setLoading] = useState(false);
  const [installStatus, setInstallStatus] = useState('');

  const handleNextStep = () => {
    if (step === 1 && !businessName.trim()) {
      toast.error('Please enter a Business Name for your workspace.');
      return;
    }
    setStep(step + 1);
  };

  const handleOnboard = async (industryId: string) => {
    setSelectedIndustry(industryId);
    setStep(3); // Go to installation progress screen
    setLoading(true);

    try {
      setInstallStatus('Creating workspace databases...');
      // Wait 1s for transition
      await new Promise(r => setTimeout(r, 600));

      setInstallStatus('Installing industry custom pipeline stages...');
      await new Promise(r => setTimeout(r, 600));

      setInstallStatus('Seeding FAQ directories & Knowledge base...');
      await new Promise(r => setTimeout(r, 600));

      setInstallStatus('Pre-loading customized Campaign marketing templates...');
      
      const response = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: industryId,
          name: businessName,
          ownerName,
          email,
          phone,
          country,
          timezone
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to complete onboarding setup');

      setInstallStatus('Finalizing modules activation...');
      await new Promise(r => setTimeout(r, 400));

      toast.success('Workspace templates configured successfully!');
      await refreshProfile();
      await refreshModules();
    } catch (err: any) {
      toast.error(err.message || 'Onboarding configuration failed.');
      setStep(2); // Fall back to industry selection if failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 animate-in fade-in zoom-in duration-200 text-left">
        
        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <div className="text-center py-6 space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10">
              <Sparkles className="h-7 w-7 text-indigo-600 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-foreground tracking-tight sm:text-4xl">
                Welcome to ReplyDesk
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Your AI Communication Platform. Let's configure your workspace in just 2 minutes.
              </p>
            </div>
            <Button
              onClick={handleNextStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-3 font-semibold shadow-md inline-flex items-center gap-1.5 cursor-pointer"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Create Workspace */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="text-xl font-bold text-foreground">Create Workspace</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Please provide details about your business settings.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bizName" className="text-muted-foreground font-semibold">Business Name</Label>
                <Input
                  id="bizName"
                  placeholder="e.g. Metro Cardiac Clinic"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner" className="text-muted-foreground font-semibold">Owner Full Name</Label>
                <Input
                  id="owner"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizEmail" className="text-muted-foreground font-semibold">Business Email</Label>
                <Input
                  id="bizEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizPhone" className="text-muted-foreground font-semibold">Contact Phone</Label>
                <Input
                  id="bizPhone"
                  placeholder="+91..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-muted-foreground font-semibold">Country</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none"
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone" className="text-muted-foreground font-semibold">Timezone</Label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleNextStep}
                disabled={!businessName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 py-2.5 font-semibold cursor-pointer"
              >
                Next: Choose Business Type
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Business Type */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center max-w-xl mx-auto space-y-1.5">
              <h3 className="text-xl font-bold text-foreground">Choose Business Type</h3>
              <p className="text-xs text-muted-foreground">
                We will automatically install dynamic dashboards, sidebars, AI prompts, and workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[360px] overflow-y-auto pr-1">
              {INDUSTRIES.map((ind) => {
                const Icon = ind.icon;
                return (
                  <button
                    key={ind.id}
                    onClick={() => handleOnboard(ind.id)}
                    className={`text-left p-4 rounded-xl border flex flex-col gap-2.5 transition group cursor-pointer outline-none relative overflow-hidden ${ind.bg} ${ind.border}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg bg-background border border-border/50 ${ind.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {ind.name}
                      </h4>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">
                        {ind.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Installing module progress overlay */}
        {step === 3 && (
          <div className="text-center py-10 space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-foreground">Configuring Your SaaS Workspace</h4>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">{installStatus}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
