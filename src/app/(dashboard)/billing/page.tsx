"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  Plus,
  Loader2,
  Check,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Bill {
  id: string;
  bill_number: string;
  description: string;
  amount: number;
  status: "unpaid" | "paid" | "overdue";
  created_at: string;
  patient: { id: string; name: string; phone: string } | null;
}

interface Patient {
  id: string;
  name: string;
}

export default function BillingPage() {
  const { accountId } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "unpaid" | "paid" | "overdue">("all");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"unpaid" | "paid">("unpaid");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    try {
      const { data: billRows } = await db
        .from("hospital_bills")
        .select("id, bill_number, description, amount, status, created_at, patient:contacts(id, name, phone)")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      setBills((billRows as any) || []);

      const { data: pats } = await db
        .from("patients")
        .select("id, contact:contacts(name)")
        .eq("account_id", accountId);

      const mappedPats = (pats || []).map((p: any) => ({
        id: p.id,
        name: p.contact?.name || "Unknown Patient",
      }));
      setPatients(mappedPats);
    } catch (err) {
      console.error("Error loading bills:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !description || !amount) {
      toast.error("Please fill in patient, description and amount.");
      return;
    }

    setSaving(true);
    const db = createClient();

    try {
      const billNo = `BIL-${Date.now().toString().slice(-6)}`;
      const { error } = await db.from("hospital_bills").insert({
        account_id: accountId,
        patient_id: patientId,
        bill_number: billNo,
        description: description,
        amount: parseFloat(amount),
        status: status,
      });

      if (error) throw error;

      toast.success("Invoice generated successfully!");
      setPatientId("");
      setDescription("");
      setAmount("");
      setShowAddForm(false);
      loadData();
    } catch (err: any) {
      toast.error("Failed to generate bill: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (billId: string, newStatus: "unpaid" | "paid" | "overdue") => {
    const db = createClient();
    try {
      const { error } = await db
        .from("hospital_bills")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", billId);

      if (error) throw error;
      toast.success(`Bill status updated to ${newStatus}.`);
      loadData();
    } catch (err: any) {
      toast.error("Status update failed: " + err.message);
    }
  };

  const filteredBills = bills.filter((b) => {
    if (activeFilter === "all") return true;
    return b.status === activeFilter;
  });

  const totalPaid = bills.filter(b => b.status === "paid").reduce((sum, b) => sum + Number(b.amount), 0);
  const totalUnpaid = bills.filter(b => b.status === "unpaid").reduce((sum, b) => sum + Number(b.amount), 0);
  const totalOverdue = bills.filter(b => b.status === "overdue").reduce((sum, b) => sum + Number(b.amount), 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clinical Billing & Invoices</h1>
          <p className="text-sm text-muted-foreground font-medium">Create invoices, manage patient payments, and track outpatient revenue.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Generate Invoice
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase">Total Collected</div>
            <div className="text-xl font-bold text-foreground mt-0.5">${totalPaid.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase">Pending Invoices</div>
            <div className="text-xl font-bold text-foreground mt-0.5">${totalUnpaid.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase">Overdue Amount</div>
            <div className="text-xl font-bold text-foreground mt-0.5">${totalOverdue.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateBill} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">New Outpatient Invoice</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Patient *</Label>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">-- Select Patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Service / Item Description *</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Cardiology Consultation Fee" required />
            </div>
            <div className="space-y-2">
              <Label>Amount (USD) *</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Issue Invoice
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["all", "unpaid", "paid", "overdue"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-2 border-b-2 text-sm font-semibold capitalize transition-colors ${
              activeFilter === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bills listing */}
      {filteredBills.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No invoices generated</h3>
          <p className="text-muted-foreground text-sm mt-1">There are no billing records matching this filter.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                      {b.bill_number}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      <div>
                        <div>{b.patient?.name || "Unknown Patient"}</div>
                        <div className="text-xs text-muted-foreground font-normal">{b.patient?.phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {b.description}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      ${Number(b.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        b.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : b.status === "unpaid"
                          ? "bg-amber-500/10 text-amber-500 animate-pulse"
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 flex justify-end items-center">
                      {b.status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(b.id, "paid")}
                          className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 text-xs py-1 px-2.5 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Mark Paid
                        </Button>
                      )}
                      {b.status === "unpaid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(b.id, "overdue")}
                          className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 text-xs py-1 px-2.5 cursor-pointer"
                        >
                          Overdue
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
