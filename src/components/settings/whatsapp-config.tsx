'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Activity,
  Check,
} from 'lucide-react';
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embedded-signup';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
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

type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<WhatsAppConnectionStatus>('disconnected');
  const [connectionType, setConnectionType] =
    useState<WhatsAppConnectionType>('coexistence');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Disconnect Confirmation Dialog
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [connectingEmbedded, setConnectingEmbedded] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
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
        setConnectionType(
          payload.config.connection_type ||
            payload.connection_type ||
            'coexistence'
        );
      } else {
        setConfig(null);
      }

      if (payload.connected) {
        const isCoex =
          payload.status === 'coexistence_connected' ||
          payload.connection_type === 'coexistence';
        setConnectionStatus(isCoex ? 'coexistence_connected' : 'connected');
        setResetReason(null);
        setStatusMessage('');
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

  const handleMetaAuthResponse = useCallback(
    async (auth: {
      code?: string;
      accessToken?: string;
      state?: string;
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
            state: auth.state,
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

        toast.success('🎉 WhatsApp Connected Successfully!');
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
      // 1. Create secure connection session on Helpa backend to obtain OAuth state and config
      const sessionRes = await fetch('/api/whatsapp/oauth/session', {
        method: 'POST',
      });
      const sessionData = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok || !sessionData?.state) {
        throw new Error(
          sessionData?.error ||
            'Failed to initialize WhatsApp connection session'
        );
      }

      const appId =
        sessionData.appId ||
        process.env.NEXT_PUBLIC_META_APP_ID ||
        '1461038582135406';
      const configId =
        sessionData.configId ||
        process.env.NEXT_PUBLIC_META_CONFIG_ID ||
        '4607476386162686';

      const result = await launchWhatsAppEmbeddedSignup({
        appId,
        configId,
        mode,
      });

      await handleMetaAuthResponse({
        ...result,
        state: sessionData.state,
        mode,
      });
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
          description="Connect your Meta WhatsApp Business account to start receiving and replying to customer messages automatically."
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
        description="Connect your Meta WhatsApp Business account to start receiving and replying to customer messages automatically."
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
                  Disconnect WhatsApp?
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

      {/* STATE 2: During Connection */}
      {connectingEmbedded && (
        <Card className="bg-card border-emerald-500/30 p-6 shadow-md">
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <div>
              <h3 className="text-foreground text-lg font-bold">
                Connecting WhatsApp...
              </h3>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                Please complete the setup in the Meta window.
                <br />
                Do not close this page.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* STATE 4: Needs Attention / Error */}
      {!connectingEmbedded &&
        (connectionStatus === 'needs_reconnect' ||
          connectionStatus === 'error' ||
          resetReason) && (
          <Alert className="border-amber-600/40 bg-amber-950/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
              <div className="flex-1">
                <AlertTitle className="mb-1 font-bold text-amber-200">
                  WhatsApp connection needs attention
                </AlertTitle>
                <AlertDescription className="text-sm text-amber-100/80">
                  {statusMessage ||
                    "We couldn't complete the connection or your access token has expired."}
                </AlertDescription>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    onClick={() => handleLaunchEmbeddedSignup('coexistence')}
                    disabled={connectingEmbedded}
                    size="sm"
                    className="bg-amber-600 font-semibold text-white hover:bg-amber-700"
                  >
                    <RotateCcw className="mr-1.5 size-4" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </Alert>
        )}

      {/* STATE 3: After Success / Connected */}
      {!connectingEmbedded && isConnected && config && (
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
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                      <h3 className="text-foreground text-lg font-bold">
                        WhatsApp Connected
                      </h3>
                    </div>
                    <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                      <p>
                        <span className="text-foreground font-semibold">
                          Business:
                        </span>{' '}
                        {config.verified_name ||
                          config.business_name ||
                          'Connected Business'}
                      </p>
                      <p>
                        <span className="text-foreground font-semibold">
                          WhatsApp:
                        </span>{' '}
                        <span className="text-foreground font-mono font-medium">
                          {config.display_phone_number ||
                            config.phone_number ||
                            config.phone_number_id}
                        </span>
                      </p>
                    </div>
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
                    Test Health
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
                    <RotateCcw className="h-3.5 w-3.5" />
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

              {/* Status Checklist */}
              <div className="grid grid-cols-1 gap-2.5 border-t border-emerald-500/20 pt-4 text-xs sm:grid-cols-3">
                <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Business connected</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Number connected</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Webhook active</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STATE 1: Before Connection (Hero 1-Click Connect) */}
      {!connectingEmbedded && !isConnected && (
        <Card className="from-card via-card border-emerald-500/30 bg-gradient-to-br to-emerald-500/[0.04] shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="h-6 w-6" />
              <CardTitle className="text-foreground text-xl font-bold">
                WhatsApp
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">
              Connect your WhatsApp Business account to manage customer
              conversations and automate patient engagement with Helpa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Value Props */}
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="border-border bg-card/60 flex items-start gap-2.5 rounded-xl border p-3.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <h4 className="text-foreground font-bold">
                    Keep Your Existing Number
                  </h4>
                  <p className="text-muted-foreground mt-0.5">
                    Continue using your existing WhatsApp Business number
                    without disruption.
                  </p>
                </div>
              </div>
              <div className="border-border bg-card/60 flex items-start gap-2.5 rounded-xl border p-3.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <h4 className="text-foreground font-bold">
                    Automatic 1-Click Setup
                  </h4>
                  <p className="text-muted-foreground mt-0.5">
                    Meta Embedded Signup automatically configures tokens, WABAs,
                    and webhooks.
                  </p>
                </div>
              </div>
            </div>

            {/* Connect Button */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Button
                onClick={() => handleLaunchEmbeddedSignup('coexistence')}
                disabled={connectingEmbedded}
                size="lg"
                className="bg-emerald-600 px-8 font-bold text-white shadow-md hover:bg-emerald-700"
              >
                {connectingEmbedded ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Connect WhatsApp
              </Button>
              <span className="text-muted-foreground text-xs font-medium">
                Takes about 1 minute
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions Accordion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-sm font-bold">
            How It Works
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
                  Meta Embedded Signup Flow
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-xs leading-relaxed">
                <p>
                  Clicking <strong>Connect WhatsApp</strong> opens Meta&apos;s
                  official Embedded Signup popup. Log in with your Facebook
                  account, select your Business Manager and WhatsApp phone
                  number, and approve permissions. Helpa automatically completes
                  configuration and subscribes webhooks.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem className="border-border">
              <AccordionTrigger className="text-muted-foreground hover:text-foreground text-xs hover:no-underline">
                <span className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                    2
                  </span>
                  Data Privacy & Tenant Isolation
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-xs leading-relaxed">
                <p>
                  All WhatsApp credentials are encrypted at rest with
                  AES-256-GCM authenticated encryption. Inbound customer
                  messages and conversations are strictly isolated to your
                  workspace.
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
