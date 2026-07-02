"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Utensils, Calendar, Users, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

interface Reservation {
  id: string;
  clientName: string;
  phone: string;
  partySize: number;
  reserveAt: string;
  tableNum: string;
  status: string;
}

const DEFAULT_RESERVATIONS: Reservation[] = [
  { id: "1", clientName: "Alice Smith", phone: "+15550199", partySize: 4, reserveAt: "2026-07-02T19:00:00.000Z", tableNum: "T-04", status: "Seated" },
  { id: "2", clientName: "Bob Jones", phone: "+15550188", partySize: 2, reserveAt: "2026-07-02T20:30:00.000Z", tableNum: "T-02", status: "Confirmed" },
];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("");
  const [reserveAt, setReserveAt] = useState("");
  const [tableNum, setTableNum] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("restaurant_reservations");
    if (saved) {
      setReservations(JSON.parse(saved));
    } else {
      setReservations(DEFAULT_RESERVATIONS);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !reserveAt) {
      toast.error("Please fill in required fields.");
      return;
    }

    const newRes: Reservation = {
      id: Date.now().toString(),
      clientName,
      phone: phone || "+15550000",
      partySize: parseInt(partySize) || 2,
      reserveAt: new Date(reserveAt).toISOString(),
      tableNum: tableNum || `T-${Math.floor(Math.random() * 10) + 1}`,
      status: "Confirmed",
    };

    const updated = [newRes, ...reservations];
    setReservations(updated);
    localStorage.setItem("restaurant_reservations", JSON.stringify(updated));
    toast.success("Table reservation created successfully!");
    setClientName("");
    setPhone("");
    setPartySize("");
    setReserveAt("");
    setTableNum("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Table Reservations</h1>
          <p className="text-sm text-muted-foreground">Manage guest seating reservations.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Book Table
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Add Reservation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Guest Name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Alice Cooper" required />
            </div>
            <div className="space-y-2">
              <Label>Guest Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +15551234" />
            </div>
            <div className="space-y-2">
              <Label>Guests Count (Party Size)</Label>
              <Input type="number" min="1" value={partySize} onChange={(e) => setPartySize(e.target.value)} placeholder="e.g. 4" />
            </div>
            <div className="space-y-2">
              <Label>Reservation Time *</Label>
              <Input type="datetime-local" value={reserveAt} onChange={(e) => setReserveAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Assigned Table</Label>
              <Input value={tableNum} onChange={(e) => setTableNum(e.target.value)} placeholder="e.g. T-05" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit">Book Table</Button>
          </div>
        </form>
      )}

      {reservations.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No reservations</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Book restaurant tables for walk-ins or chat bookings.</p>
          <Button onClick={() => setShowAddForm(true)}>Book Table</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Party Size</th>
                  <th className="px-6 py-4">Reserved Time</th>
                  <th className="px-6 py-4">Table</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> {r.clientName}
                    </td>
                    <td className="px-6 py-4">{r.phone}</td>
                    <td className="px-6 py-4 font-semibold">{r.partySize} Pax</td>
                    <td className="px-6 py-4 font-medium text-primary">
                      {new Date(r.reserveAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-orange-500">{r.tableNum}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        r.status === "Seated" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {r.status}
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
