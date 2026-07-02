"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Compass, MapPin, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Package {
  id: string;
  name: string;
  destination: string;
  duration_days: number;
  price: number;
  description: string;
}

export default function PackagesPage() {
  const { accountId, defaultCurrency } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPackages = async () => {
    if (!accountId) return;
    const db = createClient();
    const { data, error } = await db
      .from("travel_packages")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (!error) {
      setPackages(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPackages();
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !destination || !price) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    const db = createClient();
    const { error } = await db.from("travel_packages").insert({
      account_id: accountId,
      name,
      destination,
      duration_days: parseInt(duration) || 1,
      price: parseFloat(price) || 0,
      description,
    });

    if (error) {
      toast.error("Failed to add package: " + error.message);
    } else {
      toast.success("Tour package added successfully!");
      setName("");
      setDestination("");
      setDuration("");
      setPrice("");
      setDescription("");
      setShowAddForm(false);
      loadPackages();
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
          <h1 className="text-2xl font-bold text-foreground">Travel Packages</h1>
          <p className="text-sm text-muted-foreground">Manage tour packages offered to clients.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Add Package
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Add New Package</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Package Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 7-Day Swiss Alps Adventure" required />
            </div>
            <div className="space-y-2">
              <Label>Destination *</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Zurich, Switzerland" required />
            </div>
            <div className="space-y-2">
              <Label>Duration (Days)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 7" />
            </div>
            <div className="space-y-2">
              <Label>Price * ({defaultCurrency})</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 2400" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Itinerary Overview / Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief package notes..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Package
            </Button>
          </div>
        </form>
      )}

      {packages.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No tour packages</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Create packages so customers can discover itineraries.</p>
          <Button onClick={() => setShowAddForm(true)}>Add Package</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="inline-block text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {pkg.duration_days} Days
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg leading-tight">{pkg.name}</h3>
                  <p className="text-muted-foreground text-sm flex items-center mt-1">
                    <MapPin className="h-4.5 w-4.5 mr-1 text-muted-foreground/70" /> {pkg.destination}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-normal line-clamp-2">
                  {pkg.description || "No description provided."}
                </p>
                <div className="border-t border-border pt-4 flex items-center justify-between">
                  <p className="text-xl font-extrabold text-foreground">
                    {formatCurrency(pkg.price, defaultCurrency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
