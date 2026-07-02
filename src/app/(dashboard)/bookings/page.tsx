"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, User, Compass, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Booking {
  id: string;
  package: { name: string; destination: string };
  contact: { full_name: string; phone: string };
  travel_date: string;
  guests_count: number;
  total_price: number;
  status: string;
}

export default function BookingsPage() {
  const { accountId, defaultCurrency } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string; price: number }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [contactId, setContactId] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [guestsCount, setGuestsCount] = useState("1");
  const [saving, setSaving] = useState(false);

  const loadAllData = async () => {
    if (!accountId) return;
    const db = createClient();

    // Load bookings
    const { data: bookingsData, error: bookingsErr } = await db
      .from("travel_bookings")
      .select("id, travel_date, guests_count, total_price, status, package:travel_packages(name, destination), contact:contacts(full_name, phone)")
      .eq("account_id", accountId)
      .order("travel_date", { ascending: true });

    if (!bookingsErr) setBookings((bookingsData as any) || []);

    // Load packages & contacts dropdowns
    const { data: pkgs } = await db.from("travel_packages").select("id, name, price").eq("account_id", accountId);
    const { data: conts } = await db.from("contacts").select("id, full_name").eq("account_id", accountId);

    if (pkgs) setPackages(pkgs);
    if (conts) setContacts(conts);

    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageId || !contactId || !travelDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const selectedPkg = packages.find((p) => p.id === packageId);
    const pricePerGuest = selectedPkg ? selectedPkg.price : 0;
    const guests = parseInt(guestsCount) || 1;
    const total = pricePerGuest * guests;

    setSaving(true);
    const db = createClient();
    const { error } = await db.from("travel_bookings").insert({
      account_id: accountId,
      package_id: packageId,
      contact_id: contactId,
      travel_date: travelDate,
      guests_count: guests,
      total_price: total,
      status: "Confirmed",
    });

    if (error) {
      toast.error("Failed to book: " + error.message);
    } else {
      toast.success("Tour package booked successfully!");
      setPackageId("");
      setContactId("");
      setTravelDate("");
      setGuestsCount("1");
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
          <h1 className="text-2xl font-bold text-foreground">Tour Bookings</h1>
          <p className="text-sm text-muted-foreground">Manage trips booked by customers.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> New Booking
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Add Tour Booking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Package *</Label>
              <select value={packageId} onChange={(e) => setPackageId(e.target.value)} required className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">-- Choose Package --</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price, defaultCurrency)})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Select Traveler *</Label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} required className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">-- Choose Traveler --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Travel Date *</Label>
              <Input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input type="number" min="1" value={guestsCount} onChange={(e) => setGuestsCount(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Book Tour
            </Button>
          </div>
        </form>
      )}

      {bookings.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No bookings recorded</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Book travel packages for registered contacts.</p>
          <Button onClick={() => setShowAddForm(true)}>New Booking</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Package</th>
                  <th className="px-6 py-4">Traveler</th>
                  <th className="px-6 py-4">Departure Date</th>
                  <th className="px-6 py-4">Guests</th>
                  <th className="px-6 py-4">Total Price</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <Compass className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{b.package?.name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{b.package?.destination}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{b.contact?.full_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{b.contact?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">
                      {new Date(b.travel_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {b.guests_count}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-foreground">
                      {formatCurrency(b.total_price, defaultCurrency)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                        {b.status}
                      </span>
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
