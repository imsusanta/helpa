'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Coins, Loader2 } from 'lucide-react';

import { createClient } from '@/lib/appwrite-compat';
import { useAuth } from '@/hooks/use-auth';
import { CURRENCIES } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';

/**
 * Deals settings — account-wide default currency.
 *
 * One currency per account (issue #218): the chosen code seeds new
 * deals and formats every aggregated total. Existing deals keep their
 * own saved currency. Writes go straight to `accounts.default_currency`;
 * the `accounts_update` RLS policy (017) already restricts that to
 * admins+, so non-admins see a disabled, read-only control.
 */
export function DealsSettings() {
  const appwrite = createClient();
  const {
    accountId,
    defaultCurrency,
    canEditSettings,
    profileLoading,
    refreshProfile,
  } = useAuth();

  const [selected, setSelected] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);

  // Keep the select in sync once the profile (and its account default)
  // resolves, and after a save round-trips through refreshProfile.
  useEffect(() => {
    setSelected(defaultCurrency);
  }, [defaultCurrency]);

  const dirty = selected !== defaultCurrency;

  async function handleSave() {
    if (!accountId || !dirty) return;
    setSaving(true);

    try {
      // 1. Try server route /api/account PATCH first (validates admin role, applies rate limits)
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_currency: selected }),
      });

      if (!res.ok) {
        // 2. Client fallback to Appwrite DB update with dual attribute keys
        const { error } = await appwrite
          .from('accounts')
          .update({
            default_currency: selected,
            defaultCurrency: selected,
          })
          .eq('id', accountId);

        if (error) {
          const resJson = await res.json().catch(() => ({}));
          const errMsg =
            resJson.error || error.message || 'Unknown database error';
          toast.error(`Failed to save default currency: ${errMsg}`);
          setSaving(false);
          return;
        }
      }

      // Pull the new value back into the auth context so forms & dashboards update
      await refreshProfile();
      setSaving(false);
      toast.success('Default currency updated successfully');
    } catch (err: unknown) {
      console.error('Error saving currency:', err);
      const message = err instanceof Error ? err.message : 'Network error';
      toast.error(`Failed to save default currency: ${message}`);
      setSaving(false);
    }
  }

  return (
    <section className="animate-in fade-in-50 max-w-2xl duration-200">
      <SettingsPanelHead
        title="Currency & Billing Settings"
        description="Configure the default currency used across clinical billing, consultation fees, and dashboard financial totals."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Coins className="text-primary size-4" />
            Default Currency
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            New consultation fees default to this currency, and appointments and
            dashboard totals are shown in it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-xs">
            <Label className="text-muted-foreground">Currency</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!canEditSettings || profileLoading}
              className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
            {!canEditSettings && (
              <p className="text-muted-foreground text-xs">
                Only account admins can change the default currency.
              </p>
            )}
          </div>

          {canEditSettings && (
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
