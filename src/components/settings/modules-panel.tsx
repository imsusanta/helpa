"use client";

import { useEffect, useState } from "react";
import { Hospital, Loader2, Puzzle, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface TenantModule {
  module_key: string;
  enabled: boolean;
  settings: any;
}

export function ModulesPanel() {
  const { canEditSettings, enabledModules, refreshModules, account, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [localModules, setLocalModules] = useState<Record<string, boolean>>({
    hospital_clinic: false,
  });

  useEffect(() => {
    async function loadModules() {
      try {
        const res = await fetch("/api/account/modules");
        const data = await res.json();
        if (data.modules) {
          const mapped: Record<string, boolean> = { hospital_clinic: false };
          data.modules.forEach((mod: TenantModule) => {
            mapped[mod.module_key] = mod.enabled;
          });
          setLocalModules(mapped);
        }
      } catch (err) {
        console.error("Failed to load modules", err);
        toast.error("Failed to load feature modules");
      } finally {
        setLoading(false);
      }
    }
    loadModules();
  }, []);

  const handleToggle = async (key: string, checked: boolean) => {
    if (!canEditSettings) {
      toast.error("Only administrators can modify workspace modules");
      return;
    }

    setUpdatingKey(key);
    try {
      const res = await fetch("/api/account/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_key: key, enabled: checked }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setLocalModules((prev) => ({ ...prev, [key]: checked }));
        await refreshModules();
        toast.success(
          checked
            ? `${key === "hospital_clinic" ? "Hospital & Clinic" : key} module enabled!`
            : `${key === "hospital_clinic" ? "Hospital & Clinic" : key} module disabled.`
        );
      }
    } catch (err) {
      console.error("Failed to update module", err);
      toast.error("Failed to update module state");
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleResetIndustry = async () => {
    if (!canEditSettings) {
      toast.error("Only administrators can change workspace templates");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/account/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Workspace template reset! Choose a new template.");
        await refreshProfile();
        await refreshModules();
      }
    } catch (err) {
      toast.error("Failed to reset workspace industry template");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeTemplateName = {
    hospital_clinic: "🏥 Hospital & Clinic",
    real_estate: "🏠 Real Estate",
    travel: "✈ Travel Agency",
    coaching: "🏫 Coaching Institute",
    restaurant: "🍽 Restaurant",
    gym: "🏋 Gym & Fitness",
    ecommerce: "🛍 E-commerce",
    digital_agency: "💼 Digital Agency",
    general: "🌐 General CRM",
  }[account?.industry || "general"] || "🌐 General CRM";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Feature Marketplace & Templates</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your active Industry template configurations and toggle modular CRM components.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Industry Template Status Card */}
        <Card className="border border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">
                Active Template
              </span>
              <CardTitle className="text-xl font-extrabold text-foreground mt-1.5">
                {activeTemplateName}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-xl">
                This workspace is preconfigured with layouts, dashboards, stage structures, and custom AI receptionist prompt instructions for the selected industry.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={resetting || !canEditSettings}
              onClick={handleResetIndustry}
              className="border-border text-foreground hover:bg-muted font-semibold shrink-0 cursor-pointer"
            >
              {resetting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Switch Industry Template
            </Button>
          </CardHeader>
        </Card>

        {/* Hospital & Clinic Card */}
        <Card className="overflow-hidden border border-border bg-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Hospital className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Hospital & Clinic Management</CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-xl">
                  Adds Patient CRM, doctor databases, appointment scheduling, automated lab reports, WhatsApp billing reminders, emergency keyphrase triggers, and multi-branch management.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {updatingKey === "hospital_clinic" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={localModules.hospital_clinic || account?.industry === "hospital_clinic"}
                disabled={!canEditSettings || updatingKey !== null || account?.industry === "hospital_clinic"}
                onCheckedChange={(checked) => handleToggle("hospital_clinic", checked)}
              />
            </div>
          </CardHeader>
          <CardContent className="border-t border-border/50 bg-muted/30 px-5 py-4">
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Patient CRM & Demographic Collection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Shift Schedules & Fees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Outbound Lab & Billing WhatsApp Alerts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>AI Conversational Bookings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Emergency AI Takeover</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Multi-branch Staff Allocations</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Future Placeholder Card to Demonstrate Modular Layout */}
        <Card className="overflow-hidden border border-border/40 bg-card/50 opacity-60">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Puzzle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-muted-foreground">Real Estate & Property CRM</CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-xl">
                  Future module. Adds property listings, virtual booking logs, auto-lead assignment, and automated brochures.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={false} disabled={true} />
            </div>
          </CardHeader>
        </Card>
      </div>

      {!canEditSettings && (
        <p className="text-xs text-amber-500 font-medium">
          * Only workspace administrators can enable or disable feature modules.
        </p>
      )}
    </div>
  );
}
