'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/appwrite-compat';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Plus, Loader2, Trash } from 'lucide-react';
import { toast } from 'sonner';

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
  const [name, setName] = useState('');
  const [cashless, setCashless] = useState(true);
  const [documents, setDocuments] = useState(
    'National Health ID Card, Government ID, Insurance Policy PDF'
  );
  const [saving, setSaving] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    try {
      const { data } = await db
        .from('hospital_insurance')
        .select('id, provider_name, cashless_available, required_documents')
        .eq('account_id', accountId)
        .order('provider_name', { ascending: true });

      setProviders(data || []);
    } catch (err) {
      console.error('Error loading insurance providers:', err);
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
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      const { error } = await db.from('hospital_insurance').insert({
        account_id: accountId,
        provider_name: name,
        cashless_available: cashless,
        required_documents: docsArray,
      });

      if (error) throw error;
      toast.success('Insurance provider added!');
      setName('');
      setCashless(true);
      setDocuments(
        'National Health ID Card, Government ID, Insurance Policy PDF'
      );
      loadProviders();
    } catch (err: unknown) {
      toast.error('Failed to add: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    const db = createClient();
    try {
      const { error } = await db
        .from('hospital_insurance')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Insurance provider removed.');
      loadProviders();
    } catch (err: unknown) {
      toast.error('Failed to delete: ' + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground text-lg font-bold">
          Supported Health Insurance
        </h3>
        <p className="text-muted-foreground text-sm font-medium">
          Configure supported healthcare insurance partners, cashless claims
          status, and patient requirements.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Add form */}
        <form
          onSubmit={handleAddProvider}
          className="bg-card border-border h-fit space-y-4 rounded-xl border p-5"
        >
          <h4 className="text-foreground font-bold">Add Insurance Partner</h4>
          <div className="space-y-2">
            <Label>Provider Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cigna, Blue Cross"
              required
            />
          </div>
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="cashless"
              checked={cashless}
              onChange={(e) => setCashless(e.target.checked)}
              className="border-border bg-background focus:ring-primary rounded"
            />
            <Label htmlFor="cashless" className="cursor-pointer select-none">
              Cashless claims available
            </Label>
          </div>
          <div className="space-y-2">
            <Label>Required Documents (comma separated) *</Label>
            <Input
              value={documents}
              onChange={(e) => setDocuments(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}{' '}
            Save Provider
          </Button>
        </form>

        {/* Right: Providers List */}
        <div className="bg-card border-border overflow-hidden rounded-xl border lg:col-span-2">
          <div className="border-border text-foreground border-b p-4 font-bold">
            Active Insurance Schemes
          </div>
          {providers.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              No insurance partners configured.
            </div>
          ) : (
            <div className="divide-border divide-y">
              {providers.map((prov) => (
                <div
                  key={prov.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Shield className="text-primary h-4 w-4 shrink-0" />
                      <div className="text-foreground truncate font-bold">
                        {prov.provider_name}
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          prov.cashless_available
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {prov.cashless_available
                          ? 'Cashless Claim'
                          : 'Reimbursement Only'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-muted-foreground text-xs font-semibold">
                        Docs:
                      </span>
                      {prov.required_documents.map((doc, idx) => (
                        <span
                          key={idx}
                          className="bg-muted text-muted-foreground border-border rounded border px-1.5 py-0.5 text-[10px] font-medium"
                        >
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteProvider(prov.id)}
                    className="h-8 w-8 cursor-pointer border-red-500/20 p-0 text-red-500 hover:bg-red-500/10"
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
