'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Layers,
  HelpCircle,
  Activity,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';
import { ConnectWhatsApp } from '@/components/whatsapp/connect-whatsapp';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type {
  WhatsAppConfig as WhatsAppConfigType,
  WhatsAppConnectionStatus,
  WhatsAppConnectionType,
} from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<WhatsAppConnectionStatus>('disconnected');
  const [connectionType, setConnectionType] =
    useState<WhatsAppConnectionType>('coexistence');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('Just now');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);
  const [activeMethod, setActiveMethod] = useState<
    'coexistence' | 'standard' | 'manual'
  >('coexistence');

  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;
  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] =
    useState<RegistrationProbe | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      setRegistrationProbe(null);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg =
          payload.error || payload.message || 'Failed to fetch configuration';
        setStatusMessage(errorMsg);
        setConnectionStatus('disconnected');
        toast.error(errorMsg);
        return;
      }
      if (payload.config) {
        setConfig(payload.config);
        setPhoneNumberId(
          payload.config.phone_number_id || payload.config.phoneNumberId || ''
        );
        setWabaId(payload.config.waba_id || payload.config.wabaId || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
        setConnectionType(
          payload.config.connection_type ||
            payload.connection_type ||
            'coexistence'
        );
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
      }
      if (payload.connected) {
        const isCoex =
          payload.status === 'coexistence_connected' ||
          payload.connection_type === 'coexistence';
        setConnectionStatus(isCoex ? 'coexistence_connected' : 'connected');
        setResetReason(null);
        setStatusMessage('');
        setLastCheckedAt('Just now');
      } else {
        setConnectionStatus(payload.status || 'disconnected');
        setResetReason(
          payload.needs_reset
            ? 'token_corrupted'
            : payload.reason === 'meta_api_error'
              ? 'meta_api_error'
              : null
        );
        setStatusMessage(payload.message || '');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      const msg = err instanceof Error ? err.message : 'Network error';
      toast.error(`Failed to load WhatsApp configuration: ${msg}`);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    fetchConfig();
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        pin: pin.trim() || null,
      };
      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }
      toast.success(
        data.phone_info?.verified_name
          ? `Live — ${data.phone_info.verified_name} can now receive events.`
          : 'WhatsApp configuration saved.'
      );
      setPin('');
      if (accountId) await fetchConfig();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();
      if (payload.connected) {
        const isCoex =
          payload.status === 'coexistence_connected' ||
          payload.connection_type === 'coexistence';
        setConnectionStatus(isCoex ? 'coexistence_connected' : 'connected');
        setResetReason(null);
        setStatusMessage('');
        setLastCheckedAt('Just now');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name} (Webhook & Messaging Active)`
            : 'API connection verified healthy'
        );
      } else {
        setConnectionStatus(payload.status || 'disconnected');
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('error');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration', {
        method: 'GET',
      });
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success('Number is fully wired — Meta is delivering events.');
      } else {
        toast.error(
          'Number is not fully registered. See the checks below for which step failed.',
          { duration: 8000 }
        );
      }
      if (accountId) await fetchConfig();
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error('Could not reach the verification endpoint.');
    } finally {
      setVerifyingRegistration(false);
    }
  }

  async function handleDisconnectConfirm() {
    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to disconnect WhatsApp');
        return;
      }
      toast.success(
        'WhatsApp disconnected from Helpa. Your existing WhatsApp Business account, phone number, and conversation history remain completely intact.'
      );
      setShowDisconnectModal(false);
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
    } catch (err) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect WhatsApp');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="WhatsApp connection"
          description="Connect your Meta WhatsApp Business API. Keep your existing WhatsApp Business number, configure webhooks, and automate patient communication."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-primary size-6 animate-spin" />
        </div>
      </section>
    );
  }

  const isConnected =
    connectionStatus === 'connected' ||
    connectionStatus === 'coexistence_connected';
  const isCoexistenceConnected =
    connectionStatus === 'coexistence_connected' ||
    connectionType === 'coexistence';

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="WhatsApp connection"
        description="Connect your Meta WhatsApp Business API. Keep your existing WhatsApp Business number, configure webhooks, and automate patient communication."
      />

      {!isConnected && (
        <ConnectWhatsApp />
      )}

      {showDisconnectModal && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card border-border animate-in zoom-in-95 w-full max-w-md space-y-5 rounded-2xl border p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="rounded-xl bg-red-100 p-2.5 dark:bg-red-950/50">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold">Disconnect WhatsApp Connection?</h3>
                <p className="text-muted-foreground text-xs">This action only disconnects Helpa.</p>
              </div>
            </div>
            <div className="border-border bg-muted/30 space-y-2 rounded-xl border p-3.5 text-xs">
              <div className="text-foreground flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>Your existing WhatsApp Business account & mobile app remain active.</span></div>
              <div className="text-foreground flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>Your business phone number will <strong>NOT</strong> be deleted.</span></div>
              <div className="text-foreground flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>Existing contacts and conversation history in Helpa are safely preserved.</span></div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowDisconnectModal(false)} disabled={resetting}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnectConfirm} disabled={resetting}>
                {resetting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Confirm Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}

      {resetReason === 'token_corrupted' && (
        <Alert className="border-amber-600/40 bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <AlertTitle className="mb-1 text-amber-200">Stored token can&apos;t be decrypted</AlertTitle>
              <AlertDescription className="text-sm text-amber-100/80">{statusMessage}</AlertDescription>
              <Button onClick={() => setShowDisconnectModal(true)} disabled={resetting} size="sm" className="mt-3 bg-amber-600 text-white hover:bg-amber-700">
                <RotateCcw className="mr-1.5 size-4" /> Reset Configuration
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {isConnected && config ? (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.03] shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm"><CheckCircle2 className="h-6 w-6" /></div>
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-foreground text-lg font-bold">WhatsApp Business Connected ✓</h3><span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span></div>
                    <p className="text-muted-foreground mt-0.5 text-xs">{config.verified_name || config.business_name || 'Verified WhatsApp Business'} • <span className="text-foreground font-mono font-medium">{config.display_phone_number || config.phone_number || phoneNumberId}</span></p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/inbox"><Button size="sm" className="gap-1.5 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"><MessageSquare className="h-4 w-4" />Open Inbox</Button></Link>
                  <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>{testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}Test Connection</Button>
                  <Button size="sm" variant="outline" onClick={handleDisconnectConfirm} disabled={resetting} className="border-red-500/30 text-red-500">Disconnect</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-emerald-500/20 pt-4 text-xs sm:grid-cols-4">
                <div><span className="text-muted-foreground block text-[11px] font-medium">WhatsApp Status</span><span className="flex items-center gap-1.5 font-bold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />Connected</span></div>
                <div><span className="text-muted-foreground block text-[11px] font-medium">Connection Type</span><span className="text-foreground font-semibold">{isCoexistenceConnected ? 'Existing Business / Coexistence' : 'Direct Cloud API'}</span></div>
                <div><span className="text-muted-foreground block text-[11px] font-medium">Webhook Status</span><span className="flex items-center gap-1.5 font-bold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />Healthy</span></div>
                <div><span className="text-muted-foreground block text-[11px] font-medium">Last Checked</span><span className="text-muted-foreground font-medium">{lastCheckedAt}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert className="bg-card border-border">
          <div className="flex items-center gap-2"><XCircle className="size-4 text-amber-500" /><AlertTitle className="text-foreground mb-0 font-bold">WhatsApp Not Connected</AlertTitle></div>
          <AlertDescription className="text-muted-foreground mt-1 text-xs">{statusMessage || 'Connect your WhatsApp Business account above to receive inbound messages and automate replies with Helpa AI.'}</AlertDescription>
        </Alert>
      )}

      {config && (
        <Alert className={isRegistered ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-amber-700/50 bg-amber-950/30'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">{isRegistered ? <CheckCircle2 className="size-4 text-emerald-400" /> : <AlertTriangle className="size-4 text-amber-400" />}<AlertTitle className={'mb-0 text-xs font-bold ' + (isRegistered ? 'text-emerald-200' : 'text-amber-200')}>{isRegistered ? 'Meta Inbound Subscribed — Live Event Delivery Active' : 'Pending Meta Inbound Verification'}</AlertTitle></div>
            <Button variant="outline" size="sm" onClick={handleVerifyRegistration} disabled={verifyingRegistration}>{verifyingRegistration ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 text-emerald-400" />}Verify with Meta</Button>
          </div>
          <AlertDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">{isRegistered ? <>Subscribed since {config.registered_at ? new Date(config.registered_at).toLocaleString() : 'unknown'}. Click <strong>Verify with Meta</strong> if message delivery stops.</> : lastRegistrationError ? <>Last attempt error: <span className="font-mono text-red-300">&quot;{lastRegistrationError}&quot;</span>.</> : <>Your WhatsApp number is registered for messaging. Click <strong>Verify with Meta</strong> to probe live webhook subscription.</>}</AlertDescription>
          {registrationProbe && <div className="border-border bg-card/60 mt-3 space-y-1.5 rounded-lg border px-3 py-2 text-[11px]"><p className="text-foreground font-medium">Diagnostic — last run: <span className={registrationProbe.live ? 'font-bold text-emerald-400' : 'font-bold text-amber-400'}>{registrationProbe.live ? 'LIVE (Healthy)' : 'INCOMPLETE'}</span></p><ul className="text-muted-foreground space-y-0.5">{Object.entries(registrationProbe.checks).map(([k, v]) => <li key={k} className="flex items-center gap-1.5">{v === true ? <CheckCircle2 className="size-3 shrink-0 text-emerald-400" /> : v === false ? <XCircle className="size-3 shrink-0 text-red-400" /> : <span className="border-border size-3 shrink-0 rounded-full border" />}<code>{k}</code></li>)}</ul></div>}
        </Alert>
      )}

      <div className="space-y-4">
        <div className="bg-muted/40 border-border grid grid-cols-3 gap-1.5 rounded-xl border p-1.5 text-xs font-semibold">
          <button type="button" onClick={() => setActiveMethod('coexistence')} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all ${activeMethod === 'coexistence' ? 'bg-card text-foreground border-border/50 border shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Smartphone className="h-4 w-4 text-emerald-500" /><span>Existing WhatsApp Business</span></button>
          <button type="button" onClick={() => setActiveMethod('standard')} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all ${activeMethod === 'standard' ? 'bg-card text-foreground border-border/50 border shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Sparkles className="h-4 w-4 text-blue-500" /><span>New Number / Direct API</span></button>
          <button type="button" onClick={() => setActiveMethod('manual')} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all ${activeMethod === 'manual' ? 'bg-card text-foreground border-border/50 border shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Zap className="h-4 w-4 text-amber-500" /><span>Manual Setup</span></button>
        </div>

        {activeMethod === 'coexistence' && <ConnectWhatsApp />}

        {activeMethod === 'standard' && <ConnectWhatsApp />}

        {activeMethod === 'manual' && (
          <Card>
            <CardHeader><CardTitle className="text-foreground text-sm font-bold">API Credentials</CardTitle><CardDescription className="text-muted-foreground text-xs">Enter your Meta WhatsApp Business API credentials manually.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">WhatsApp Registered Number ID (Phone Number ID)</Label><Input placeholder="e.g. 100234567890123" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">WhatsApp Business Account ID (WABA ID)</Label><Input placeholder="e.g. 100234567890456" value={wabaId} onChange={(e) => setWabaId(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Meta Security Key (Permanent Access Token)</Label><div className="relative"><Input type={showToken ? 'text' : 'password'} placeholder="Enter your access token" value={accessToken} onChange={(e) => { setAccessToken(e.target.value); setTokenEdited(true); }} onFocus={() => { if (accessToken === MASKED_TOKEN) { setAccessToken(''); setTokenEdited(true); } }} className="pr-10 font-mono text-xs" /><button type="button" onClick={() => setShowToken(!showToken)} className="absolute top-1/2 right-2 -translate-y-1/2">{showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
              <div className="space-y-2"><Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Webhook Verify Token</Label><Input placeholder="Create a custom verify token" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} className="font-mono text-xs" /></div>
              <div className="space-y-2"><Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Two-step PIN (Optional)</Label><Input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit PIN from Meta WhatsApp Manager" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="font-mono text-xs tracking-widest" /></div>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}{saving ? 'Saving...' : 'Save & Connect'}</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
