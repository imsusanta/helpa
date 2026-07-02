"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Users, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  orderSeq: string;
  clientName: string;
  itemsCount: number;
  totalValue: number;
  status: string;
  createdAt: string;
}

const DEFAULT_ORDERS: Order[] = [
  { id: "1", orderSeq: "ORD-9281", clientName: "John Doe", itemsCount: 3, totalValue: 124.99, status: "Processing", createdAt: "2026-07-02T12:00:00.000Z" },
  { id: "2", orderSeq: "ORD-9282", clientName: "Jane Smith", itemsCount: 1, totalValue: 45.00, status: "Shipped", createdAt: "2026-07-02T13:45:00.000Z" },
];

export default function OrdersPage() {
  const { defaultCurrency } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [itemsCount, setItemsCount] = useState("1");
  const [totalValue, setTotalValue] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ecommerce_orders");
    if (saved) {
      setOrders(JSON.parse(saved));
    } else {
      setOrders(DEFAULT_ORDERS);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !totalValue) {
      toast.error("Please fill in required fields.");
      return;
    }

    const newOrder: Order = {
      id: Date.now().toString(),
      orderSeq: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName,
      itemsCount: parseInt(itemsCount) || 1,
      totalValue: parseFloat(totalValue) || 0,
      status: "Placed",
      createdAt: new Date().toISOString(),
    };

    const updated = [newOrder, ...orders];
    setOrders(updated);
    localStorage.setItem("ecommerce_orders", JSON.stringify(updated));
    toast.success("E-commerce sales order logged successfully!");
    setClientName("");
    setItemsCount("1");
    setTotalValue("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">Manage online shop sales orders states.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Log Order
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Log Sales Order</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Johnathan Miller" required />
            </div>
            <div className="space-y-2">
              <Label>Items Count</Label>
              <Input type="number" min="1" value={itemsCount} onChange={(e) => setItemsCount(e.target.value)} placeholder="e.g. 2" />
            </div>
            <div className="space-y-2">
              <Label>Order Valuation * ({defaultCurrency})</Label>
              <Input type="number" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="e.g. 79.99" required />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit">Log Order</Button>
          </div>
        </form>
      )}

      {orders.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No orders logged</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Record ecommerce store sales orders.</p>
          <Button onClick={() => setShowAddForm(true)}>Log Order</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Items Count</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total Value</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">{o.orderSeq}</td>
                    <td className="px-6 py-4 flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4 text-muted-foreground" /> {o.clientName}
                    </td>
                    <td className="px-6 py-4">{o.itemsCount} Items</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-foreground">
                      {formatCurrency(o.totalValue, defaultCurrency)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        o.status === "Placed" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
                      }`}>
                        {o.status}
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
