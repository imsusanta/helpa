"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Plus,
  Loader2,
  Trash,
  Check,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface InsuranceProvider {
  id: string;
  provider_name: string;
  cashless_available: boolean;
  required_documents: string[];
}

export function InsurancePanel() {
  const { accountId } = useAuth();
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [cashless, setCashless] = useState(true);
  const [documents, setDocuments] = useState("National Health ID Card, Government ID, Insurance Policy PDF");
  const [saving, setSaving] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    try {
      const { data } = await db
        .from("hospital_insurance")
        .select("id, provider_name, cashless_available, required_documents")
        .eq("account_id", accountId)
        .order("provider_name", { ascending: true });

      setProviders(data || []);
    } catch (err) {
      console.error("Error loading insurance providers:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    const db = createClient();
    try {
      const docsArray = documents
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      const { error } = await db.from("hospital_insurance").insert({
        account_id: accountId,
        provider_name: name,
        cashless_available: cashless,
        required_documents: docsArray,
      });

      if (error) throw error;
      toast.success("Insurance provider added!");
      setName("");
      setCashless(true);
      setDocuments("National Health ID Card, Government ID, Insurance Policy PDF");
      loadProviders();
    } catch (err: any) {
      toast.error("Failed to add: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    const db = createClient();
    try {
      const { error } = await db.from("hospital_insurance").delete().eq("id", id);
      if (error) throw error;
      toast.success("Insurance provider removed.");
      loadProviders();
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Supported Health Insurance</h3>
        <p className="text-sm text-muted-foreground font-medium">Configure supported healthcare insurance partners, cashless claims status, and patient requirements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add form */}
        <form onSubmit={handleAddProvider} className="bg-card border border-border p-5 rounded-xl space-y-4 h-fit">
          <h4 className="font-bold text-foreground">Add Insurance Partner</h4>
          <div className="space-y-2">
            <Label>Provider Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cigna, Blue Cross" required />
          </div>
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="cashless"
              checked={cashless}
              onChange={(e) => setCashless(e.target.checked)}
              className="rounded border-border bg-background focus:ring-primary"
            />
            <Label htmlFor="cashless" className="cursor-pointer select-none">Cashless claims available</Label>
          </div>
          <div className="space-y-2">
            <Label>Required Documents (comma separated) *</Label>
            <Input value={documents} onChange={(e) => setDocuments(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full cursor-pointer" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Save Provider
          </Button>
        </form>

        {/* Right: Providers List */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border font-bold text-foreground">Active Insurance Schemes</div>
          {providers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No insurance partners configured.</div>
          ) : (
            <div className="divide-y divide-border">
              {providers.map((prov) => (
                <div key={prov.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary shrink-0" />
                      <div className="font-bold text-foreground truncate">{prov.provider_name}</div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        prov.cashless_available
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {prov.cashless_available ? "Cashless Claim" : "Reimbursement Only"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-xs text-muted-foreground font-semibold">Docs:</span>
                      {prov.required_documents.map((doc, idx) => (
                        <span key={idx} className="text-[10px] bg-muted text-muted-foreground font-medium px-1.5 py-0.5 rounded border border-border">
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteProvider(prov.id)}
                    className="h-8 w-8 p-0 border-red-500/20 text-red-500 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
