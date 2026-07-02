"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, User, Home, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Visit {
  id: string;
  property: { title: string; location: string };
  contact: { full_name: string; phone: string };
  visit_at: string;
  status: string;
  notes: string;
}

export default function VisitsPage() {
  const { accountId } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAllData = async () => {
    if (!accountId) return;
    const db = createClient();
    
    // Load visits
    const { data: visitsData, error: visitsErr } = await db
      .from("real_estate_visits")
      .select("id, visit_at, status, notes, property:real_estate_properties(title, location), contact:contacts(full_name, phone)")
      .eq("account_id", accountId)
      .order("visit_at", { ascending: true });

    if (!visitsErr) setVisits((visitsData as any) || []);

    // Load dropdown selections
    const { data: props } = await db.from("real_estate_properties").select("id, title").eq("account_id", accountId);
    const { data: conts } = await db.from("contacts").select("id, full_name").eq("account_id", accountId);

    if (props) setProperties(props);
    if (conts) setContacts(conts);

    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !contactId || !visitAt) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    const db = createClient();
    const { error } = await db.from("real_estate_visits").insert({
      account_id: accountId,
      property_id: propertyId,
      contact_id: contactId,
      visit_at: new Date(visitAt).toISOString(),
      notes,
      status: "Scheduled",
    });

    if (error) {
      toast.error("Failed to schedule visit: " + error.message);
    } else {
      toast.success("Property tour scheduled successfully!");
      setPropertyId("");
      setContactId("");
      setVisitAt("");
      setNotes("");
      setShowAddForm(false);
      loadAllData();
    }
    setSaving(false);
  };

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
          <h1 className="text-2xl font-bold text-foreground">Site Visits & Tours</h1>
          <p className="text-sm text-muted-foreground">Coordinate property tours for qualified buyers.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Schedule Visit
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Schedule Showing / Visit</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Property *</Label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">-- Choose Property --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Select Buyer / Contact *</Label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} required className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">-- Choose Contact --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date & Time *</Label>
              <Input type="datetime-local" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Internal Notes / Agent Instructions</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Buyer is interested in the school district, emphasize quiet area." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Schedule Visit
            </Button>
          </div>
        </form>
      )}

      {visits.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No visits scheduled</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Book showing appointments for your property listings.</p>
          <Button onClick={() => setShowAddForm(true)}>Schedule Visit</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Property</th>
                  <th className="px-6 py-4">Client / Buyer</th>
                  <th className="px-6 py-4">Showing Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{v.property?.title || "N/A"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{v.property?.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{v.contact?.full_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{v.contact?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">
                      {new Date(v.visit_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs max-w-xs truncate">
                      {v.notes || "-"}
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
