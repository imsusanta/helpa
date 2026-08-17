'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
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
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embedded-signup';
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

  // Disconnect Confirmation Dialog
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
  const [connectingEmbedded, setConnectingEmbedded] = useState(false);

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

      if (data.registered === false && data.registration_error) {
        toast.error(
          `Saved, but Meta couldn't register the number: ${data.registration_error}`,
          { duration: 12000 }
        );
      } else if (data.registration_skipped) {
        toast.success(
          'Credentials saved and verified. Inbound registration was skipped (no PIN) — see Registration status below.',
          { duration: 10000 }
        );
        setPin('');
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? `Live — ${data.phone_info.verified_name} can now receive events.`
            : 'WhatsApp connected. Events will start flowing within a minute.'
        );
        setPin('');
      }

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
        setResetReason(
          payload.needs_reset
            ? 'token_corrupted'
            : payload.reason === 'meta_api_error'
              ? 'meta_api_error'
              : null
        );
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

  const handleMetaAuthResponse = useCallback(
    async (auth: {
      code?: string;
      accessToken?: string;
      wabaId?: string;
      phoneNumberId?: string;
      mode?: 'standard' | 'coexistence';
    }) => {
      setConnectingEmbedded(true);
      try {
        const res = await fetch('/api/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: auth.code,
            accessToken: auth.accessToken,
            waba_id: auth.wabaId,
            phone_number_id: auth.phoneNumberId,
            mode: auth.mode || 'coexistence',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || 'Failed to complete WhatsApp Embedded Signup'
          );
        }

        toast.success(
          auth.mode === 'coexistence'
            ? '🎉 Existing WhatsApp Business connected successfully via Meta Coexistence!'
            : '🎉 WhatsApp connected successfully via Meta!'
        );
        await fetchConfig();
      } catch (err: unknown) {
        console.error('Embedded Signup error:', err);
        const msg = (err as Error)?.message || 'Failed to connect with Meta';
        if (/jssdk|javascript sdk/i.test(msg)) {
          toast.error(
            'Please enable "Login with JavaScript SDK" in your Meta App Dashboard under Facebook Login for Business > Settings.',
            { duration: 8000 }
          );
        } else {
          toast.error(msg);
        }
      } finally {
        setConnectingEmbedded(false);
      }
    },
    [fetchConfig]
  );

  async function handleLaunchEmbeddedSignup(
    mode: 'standard' | 'coexistence' = 'coexistence'
  ) {
    setConnectingEmbedded(true);
    setConnectionStatus('connecting');
    try {
      const appId = process.env.NEXT_PUBLIC_META_APP_ID || '1461038582135406';
      const configId =
        process.env.NEXT_PUBLIC_META_CONFIG_ID || '4607476386162686';
      const result = await launchWhatsAppEmbeddedSignup({
        appId,
        configId,
        mode,
      });
      await handleMetaAuthResponse({ ...result, mode });
    } catch (err: unknown) {
      console.error('Embedded Signup error:', err);
      const msg = (err as Error)?.message || 'Failed to connect with Meta';
      toast.error(msg);
      setConnectionStatus(config ? 'connected' : 'disconnected');
    } finally {
      setConnectingEmbedded(false);
    }
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

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card border-border animate-in zoom-in-95 w-full max-w-md space-y-5 rounded-2xl border p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="rounded-xl bg-red-100 p-2.5 dark:bg-red-950/50">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold">
                  Disconnect WhatsApp Connection?
                </h3>
                <p className="text-muted-foreground text-xs">
                  This action only disconnects Helpa.
                </p>
              </div>
            </div>

            <div className="border-border bg-muted/30 space-y-2 rounded-xl border p-3.5 text-xs">
              <div className="text-foreground flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  Your existing WhatsApp Business account & mobile app remain
                  active.
                </span>
              </div>
              <div className="text-foreground flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  Your business phone number will <strong>NOT</strong> be
                  deleted.
                </span>
              </div>
              <div className="text-foreground flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  Existing contacts and conversation history in Helpa are safely
                  preserved.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectModal(false)}
                disabled={resetting}
                className="border-border text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnectConfirm}
                disabled={resetting}
                className="bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
              >
                {resetting ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Confirm Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Corrupted-token reset banner */}
      {resetReason === 'token_corrupted' && (
        <Alert className="border-amber-600/40 bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <AlertTitle className="mb-1 text-amber-200">
                Stored token can&apos;t be decrypted
              </AlertTitle>
              <AlertDescription className="text-sm text-amber-100/80">
                {statusMessage}
              </AlertDescription>
              <Button
                onClick={() => setShowDisconnectModal(true)}
                disabled={resetting}
                size="sm"
                className="mt-3 bg-amber-600 text-white hover:bg-amber-700"
              >
                <RotateCcw className="mr-1.5 size-4" />
                Reset Configuration
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* 1. Connected Status & Health Overview */}
      {isConnected && config ? (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.03] shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6">
              {/* Status Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground text-lg font-bold">
                        WhatsApp Business Connected ✓
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        Live
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {config.verified_name ||
                        config.business_name ||
                        'Verified WhatsApp Business'}{' '}
                      •{' '}
                      <span className="text-foreground font-mono font-medium">
                        {config.display_phone_number ||
                          config.phone_number ||
                          phoneNumberId}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/inbox">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Open Inbox
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="border-border text-foreground hover:bg-muted gap-1.5 text-xs font-semibold"
                  >
                    {testing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleLaunchEmbeddedSignup(
                        isCoexistenceConnected ? 'coexistence' : 'standard'
                      )
                    }
                    disabled={connectingEmbedded}
                    className="border-border text-foreground hover:bg-muted gap-1.5 text-xs font-semibold"
                  >
                    {connectingEmbedded ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Reconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDisconnectModal(true)}
                    disabled={resetting}
                    className="border-red-500/30 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Health Grid */}
              <div className="grid grid-cols-2 gap-3 border-t border-emerald-500/20 pt-4 text-xs sm:grid-cols-4">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px] font-medium">
                    WhatsApp Status
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px] font-medium">
                    Connection Type
                  </span>
                  <span className="text-foreground font-semibold">
                    {isCoexistenceConnected
                      ? 'Existing Business / Coexistence'
                      : 'Direct Cloud API'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px] font-medium">
                    Webhook Status
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Healthy
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px] font-medium">
                    Last Checked
                  </span>
                  <span className="text-muted-foreground font-medium">
                    {lastCheckedAt}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Disconnected Alert */
        <Alert className="bg-card border-border">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 text-amber-500" />
            <AlertTitle className="text-foreground mb-0 font-bold">
              WhatsApp Not Connected
            </AlertTitle>
          </div>
          <AlertDescription className="text-muted-foreground mt-1 text-xs">
            {statusMessage ||
              'Connect your WhatsApp Business account below to keep your existing number, receive inbound messages, and automate replies with Helpa AI.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Registration Status Diagnostic Banner */}
      {config && (
        <Alert
          className={
            isRegistered
              ? 'border-emerald-700/50 bg-emerald-950/30'
              : 'border-amber-700/50 bg-amber-950/30'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isRegistered ? (
                <CheckCircle2 className="size-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-amber-400" />
              )}
              <AlertTitle
                className={
                  'mb-0 text-xs font-bold ' +
                  (isRegistered ? 'text-emerald-200' : 'text-amber-200')
                }
              >
                {isRegistered
                  ? 'Meta Inbound Subscribed — Live Event Delivery Active'
                  : 'Pending Meta Inbound Verification'}
              </AlertTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyRegistration}
              disabled={verifyingRegistration}
              className="border-border text-foreground hover:bg-muted h-7 bg-transparent text-xs"
            >
              {verifyingRegistration ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5 text-emerald-400" />
              )}
              Verify with Meta
            </Button>
          </div>

          <AlertDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {isRegistered ? (
              <>
                Subscribed since{' '}
                {config.registered_at
                  ? new Date(config.registered_at).toLocaleString()
                  : 'unknown'}
                . Click <strong>Verify with Meta</strong> if message delivery
                stops.
              </>
            ) : lastRegistrationError ? (
              <>
                Last attempt error:{' '}
                <span className="font-mono text-red-300">
                  &quot;{lastRegistrationError}&quot;
                </span>
                .
              </>
            ) : (
              <>
                Your WhatsApp number is registered for messaging. Click{' '}
                <strong>Verify with Meta</strong> to probe live webhook
                subscription.
              </>
            )}
          </AlertDescription>

          {registrationProbe && (
            <div className="border-border bg-card/60 mt-3 space-y-1.5 rounded-lg border px-3 py-2 text-[11px]">
              <p className="text-foreground font-medium">
                Diagnostic — last run:{' '}
                <span
                  className={
                    registrationProbe.live
                      ? 'font-bold text-emerald-400'
                      : 'font-bold text-amber-400'
                  }
                >
                  {registrationProbe.live ? 'LIVE (Healthy)' : 'INCOMPLETE'}
                </span>
              </p>
              <ul className="text-muted-foreground space-y-0.5">
                {Object.entries(registrationProbe.checks).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-1.5">
                    {v === true ? (
                      <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
                    ) : v === false ? (
                      <XCircle className="size-3 shrink-0 text-red-400" />
                    ) : (
                      <span className="border-border size-3 shrink-0 rounded-full border" />
                    )}
                    <code className="text-muted-foreground">{k}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Alert>
      )}

      {/* 2. Onboarding Cards: Target User Experience */}
      <div className="space-y-4">
        {/* Method Switcher Tabs */}
        <div className="bg-muted/40 border-border grid grid-cols-3 gap-1.5 rounded-xl border p-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMethod('coexistence')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all ${
              activeMethod === 'coexistence'
                ? 'bg-card text-foreground border-border/50 border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="h-4 w-4 text-emerald-500" />
            <span>Existing WhatsApp Business (Coexistence)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMethod('standard')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all ${
              activeMethod === 'standard'
                ? 'bg-card text-foreground border-border/50 border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span>Connect WhatsApp (New Number / Direct API)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMethod('manual')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all ${
              activeMethod === 'manual'
                ? 'bg-card text-foreground border-border/50 border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Developer / Manual Setup</span>
          </button>
        </div>

        {/* Option 1: Existing WhatsApp Business (Coexistence Flow) */}
        {activeMethod === 'coexistence' && (
          <Card className="border-emerald-500/30 bg-emerald-500/[0.03] shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Smartphone className="h-5 w-5" />
                <CardTitle className="text-foreground text-base">
                  Connect your existing WhatsApp Business
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Keep your existing WhatsApp Business number and connect it to
                Helpa to manage conversations, automate replies, and use AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Number Protection Reassurance */}
              <div className="border-border bg-card space-y-3 rounded-xl border p-4 text-xs">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <h4 className="text-foreground font-bold">
                      Existing Number Protection
                    </h4>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Your existing WhatsApp Business number will be kept where
                      Meta&apos;s supported Coexistence setup is available. You
                      will <strong>NOT</strong> need to delete your existing
                      WhatsApp Business app or purchase a new phone number.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Layers className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <h4 className="text-foreground font-bold">
                      WhatsApp Business App + Helpa Coexistence
                    </h4>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Continue chatting with patients on your mobile phone while
                      Helpa simultaneously manages automated AI responses,
                      conversation memory, and inbox workflows.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={() => handleLaunchEmbeddedSignup('coexistence')}
                  disabled={connectingEmbedded}
                  className="flex h-11 w-full items-center justify-center gap-2 bg-[#0866FF] px-6 font-semibold text-white shadow-md hover:bg-[#0759DF] sm:w-auto"
                >
                  {connectingEmbedded ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting with Meta...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Connect Existing WhatsApp Business
                    </>
                  )}
                </Button>
              </div>

              {/* Help Text / Meta Eligibility Disclaimer */}
              <div className="border-border text-muted-foreground flex items-start gap-2 border-t pt-3 text-[11px]">
                <HelpCircle className="text-muted-foreground/80 mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="leading-relaxed">
                  Helpa uses Meta&apos;s official WhatsApp integration. Whether
                  your existing WhatsApp Business account can be connected
                  without changing your current setup depends on Meta&apos;s
                  eligibility and supported Coexistence configuration.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Option 2: Standard Meta Connection */}
        {activeMethod === 'standard' && (
          <Card className="border-blue-500/20 bg-blue-500/[0.03] shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Sparkles className="h-5 w-5" />
                <CardTitle className="text-foreground text-base">
                  Connect WhatsApp
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground text-xs">
                Use WhatsApp with Helpa using a direct Meta Cloud API setup or
                new business number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-border bg-card space-y-2 rounded-xl border p-4 text-xs">
                <div className="text-foreground flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>Instant 1-Click Meta Embedded Setup</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Authenticates your Meta Business Manager, registers a
                  dedicated Cloud API phone number, and configures webhooks
                  automatically.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => handleLaunchEmbeddedSignup('standard')}
                  disabled={connectingEmbedded}
                  className="flex h-11 w-full items-center justify-center gap-2 bg-[#0866FF] px-6 font-semibold text-white shadow-md hover:bg-[#0759DF] sm:w-auto"
                >
                  {connectingEmbedded ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting with Meta...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Connect with Meta
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Option 3: Manual Developer Setup (Advanced) */}
        {activeMethod === 'manual' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground text-sm font-bold">
                  API Credentials
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Enter your Meta WhatsApp Business API credentials manually.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Phone Number ID
                  </Label>
                  <Input
                    placeholder="e.g. 100234567890123"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="bg-muted border-border text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    WhatsApp Business Account ID
                  </Label>
                  <Input
                    placeholder="e.g. 100234567890456"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    className="bg-muted border-border text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Permanent Access Token
                  </Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your access token"
                      value={accessToken}
                      onChange={(e) => {
                        setAccessToken(e.target.value);
                        setTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (accessToken === MASKED_TOKEN) {
                          setAccessToken('');
                          setTokenEdited(true);
                        }
                      }}
                      className="bg-muted border-border text-foreground pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                    >
                      {showToken ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Webhook Verify Token
                  </Label>
                  <Input
                    placeholder="Create a custom verify token"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    className="bg-muted border-border text-foreground font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Two-step PIN (Optional)
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit PIN from Meta WhatsApp Manager"
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="bg-muted border-border text-foreground font-mono text-xs tracking-widest"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
                  >
                    {saving ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : null}
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Webhook URL Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground text-sm font-bold">
                  Webhook Configuration
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Copy this URL into your Meta App Dashboard Webhook callback
                  settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="bg-muted border-border text-muted-foreground font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhookUrl}
                    className="border-border text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Setup Instructions Accordion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-sm font-bold">
            Setup Instructions
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Overview of Meta WhatsApp Business Platform connection steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion>
            <AccordionItem className="border-border">
              <AccordionTrigger className="text-muted-foreground hover:text-foreground text-xs hover:no-underline">
                <span className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                    1
                  </span>
                  Existing WhatsApp Business Coexistence Requirements
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-xs leading-relaxed">
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    Your phone number must be currently active on the official
                    WhatsApp Business mobile app.
                  </li>
                  <li>
                    Click <strong>Connect Existing WhatsApp Business</strong>{' '}
                    and complete the Meta authorization popup.
                  </li>
                  <li>
                    Meta will automatically connect the Cloud API without
                    deleting your mobile app registration.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className="border-border">
              <AccordionTrigger className="text-muted-foreground hover:text-foreground text-xs hover:no-underline">
                <span className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                    2
                  </span>
                  Meta Webhook & Inbound Message Routing
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-xs leading-relaxed">
                <p>
                  Helpa automatically subscribes your WABA to the Meta webhook
                  endpoint upon Embedded Signup completion. All incoming patient
                  chats are strictly routed to your tenant account with zero
                  cross-tenant leakage.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="border-border mt-3 border-t pt-3">
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Official Meta WhatsApp Business Platform Documentation
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
