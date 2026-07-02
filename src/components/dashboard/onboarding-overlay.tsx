"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Stethoscope,
  Plane,
  GraduationCap,
  Utensils,
  Dumbbell,
  ShoppingBag,
  Laptop,
  Briefcase,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

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
    id: "hospital_clinic",
    name: "Hospital & Clinic",
    description: "Manage patients, appointments, schedules, invoices, and lab reports.",
    icon: Stethoscope,
    color: "text-emerald-500",
    bg: "bg-emerald-500/5 hover:bg-emerald-500/10",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
  },
  {
    id: "real_estate",
    name: "Real Estate",
    description: "Track buyers, schedule site visits, list properties, and manage agents.",
    icon: Building2,
    color: "text-blue-500",
    bg: "bg-blue-500/5 hover:bg-blue-500/10",
    border: "border-blue-500/20 hover:border-blue-500/40",
  },
  {
    id: "travel",
    name: "Travel Agency",
    description: "Organize tour packages, client bookings, quotations, and active trips.",
    icon: Plane,
    color: "text-sky-500",
    bg: "bg-sky-500/5 hover:bg-sky-500/10",
    border: "border-sky-500/20 hover:border-sky-500/40",
  },
  {
    id: "coaching",
    name: "Coaching Institute",
    description: "Manage student admissions, batch courses, class hours, and tuition fees.",
    icon: GraduationCap,
    color: "text-indigo-500",
    bg: "bg-indigo-500/5 hover:bg-indigo-500/10",
    border: "border-indigo-500/20 hover:border-indigo-500/40",
  },
  {
    id: "restaurant",
    name: "Restaurant",
    description: "Coordinate reservations, tables, food order states, and menu offers.",
    icon: Utensils,
    color: "text-orange-500",
    bg: "bg-orange-500/5 hover:bg-orange-500/10",
    border: "border-orange-500/20 hover:border-orange-500/40",
  },
  {
    id: "gym",
    name: "Gym & Fitness",
    description: "Track gym members, memberships, class schedules, and personal training.",
    icon: Dumbbell,
    color: "text-red-500",
    bg: "bg-red-500/5 hover:bg-red-500/10",
    border: "border-red-500/20 hover:border-red-500/40",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Monitor catalog products, orders, returns, and client campaigns.",
    icon: ShoppingBag,
    color: "text-pink-500",
    bg: "bg-pink-500/5 hover:bg-pink-500/10",
    border: "border-pink-500/20 hover:border-pink-500/40",
  },
  {
    id: "digital_agency",
    name: "Digital Agency",
    description: "Qualify client inbound needs, manage project proposals, and schedule calls.",
    icon: Laptop,
    color: "text-purple-500",
    bg: "bg-purple-500/5 hover:bg-purple-500/10",
    border: "border-purple-500/20 hover:border-purple-500/40",
  },
  {
    id: "general",
    name: "General CRM",
    description: "Clean core platform with shared inbox, pipeline deals, and automations.",
    icon: Briefcase,
    color: "text-muted-foreground",
    bg: "bg-muted/30 hover:bg-muted/60",
    border: "border-border hover:border-muted-foreground/30",
  },
];

export function OnboardingOverlay() {
  const { refreshProfile, refreshModules } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = async (industryId: string) => {
    setSelected(industryId);
  };

  const handleConfirm = async () => {
    if (!selected) {
      toast.error("Please select an industry template to proceed.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/account/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: selected }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to onboard");
      }

      toast.success("Workspace configured successfully!");
      // Hot reload the profile context so sidebar and pages update immediately
      await refreshProfile();
      await refreshModules();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during onboarding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Workspace Setup
          </div>
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
            Choose Your Industry Template
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Select a tailored layout for your CRM. We will automatically pre-load matching dashboards, sidebar configurations, AI response prompts, pipeline stages, and knowledge base directories.
          </p>
        </div>

        {/* Industry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            const isSelected = selected === ind.id;
            return (
              <button
                key={ind.id}
                disabled={loading}
                onClick={() => handleSelect(ind.id)}
                className={`text-left p-4 rounded-xl border flex flex-col gap-3 transition-all duration-200 cursor-pointer outline-none relative overflow-hidden group ${ind.bg} ${ind.border} ${
                  isSelected
                    ? "ring-2 ring-primary border-primary shadow-lg scale-[1.02]"
                    : "hover:scale-[1.01]"
                }`}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg bg-background border border-border/50 group-hover:scale-110 transition-transform duration-200 ${ind.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {isSelected && (
                    <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold">
                      ✓
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                    {ind.name}
                  </h4>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    {ind.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-6 mt-2">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            * You can switch templates or customize modules individually anytime under Settings.
          </p>
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="w-full sm:w-auto px-8 py-6 font-bold shadow-md cursor-pointer hover:shadow-lg transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Configuring Workspace...
              </>
            ) : (
              "Initialize Workspace"
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
