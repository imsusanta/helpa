"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, MapPin, DollarSign, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Property {
  id: string;
  title: string;
  type: string;
  status: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
}

export default function PropertiesPage() {
  const { accountId, defaultCurrency } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Apartment");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProperties = async () => {
    if (!accountId) return;
    const db = createClient();
    const { data, error } = await db
      .from("real_estate_properties")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading properties:", error);
    } else {
      setProperties(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProperties();
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !location) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    const db = createClient();
    const { error } = await db.from("real_estate_properties").insert({
      account_id: accountId,
      title,
      type,
      price: parseFloat(price) || 0,
      location,
      bedrooms: parseInt(bedrooms) || null,
      bathrooms: parseInt(bathrooms) || null,
      area_sqft: parseInt(area) || null,
      status: "Available",
    });

    if (error) {
      toast.error("Failed to add property: " + error.message);
    } else {
      toast.success("Property listing added successfully!");
      setTitle("");
      setPrice("");
      setLocation("");
      setBedrooms("");
      setBathrooms("");
      setArea("");
      setShowAddForm(false);
      loadProperties();
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
          <h1 className="text-2xl font-bold text-foreground">Property Listings</h1>
          <p className="text-sm text-muted-foreground">Manage active properties portfolio.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Add Property
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Add New Listing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Property Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Modern Sunset Condo" required />
            </div>
            <div className="space-y-2">
              <Label>Location / Address *</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. 742 Evergreen Terrace" required />
            </div>
            <div className="space-y-2">
              <Label>Property Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="Apartment">Apartment</option>
                <option value="House">House</option>
                <option value="Land">Land</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Price * ({defaultCurrency})</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 350000" required />
            </div>
            <div className="space-y-2">
              <Label>Bedrooms</Label>
              <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="e.g. 3" />
            </div>
            <div className="space-y-2">
              <Label>Bathrooms</Label>
              <Input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder="e.g. 2" />
            </div>
            <div className="space-y-2">
              <Label>Area (Sq Ft)</Label>
              <Input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 1500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Listing
            </Button>
          </div>
        </form>
      )}

      {properties.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No property listings</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Get started by creating your first property listing.</p>
          <Button onClick={() => setShowAddForm(true)}>Add Property</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {properties.map((prop) => (
            <div key={prop.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="inline-block text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {prop.type}
                  </span>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {prop.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg leading-tight">{prop.title}</h3>
                  <p className="text-muted-foreground text-sm flex items-center mt-1">
                    <MapPin className="h-4.5 w-4.5 mr-1 text-muted-foreground/70" /> {prop.location}
                  </p>
                </div>
                <div className="border-t border-border pt-4 flex items-center justify-between">
                  <p className="text-xl font-extrabold text-foreground">
                    {formatCurrency(prop.price, defaultCurrency)}
                  </p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {prop.bedrooms && `${prop.bedrooms} Bed`} {prop.bathrooms && `• ${prop.bathrooms} Bath`} {prop.area_sqft && `• ${prop.area_sqft} sqft`}
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
