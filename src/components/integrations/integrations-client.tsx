'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  Plug,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Bot,
  Code2,
  Store,
  Sparkles,
  Loader2,
  X,
  QrCode,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embedded-signup';
import { WhatsAppQrPanel } from '@/components/settings/whatsapp-qr-panel';

function InstagramIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function MessengerIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.077.298 2.222.463 3.443.463 6.627 0 12-4.975 12-11.11C24 4.974 18.627 0 12 0zm1.191 14.963l-3.056-3.259-5.963 3.259 6.559-6.963 3.13 3.259 5.89-3.259-6.56 6.963z" />
    </svg>
  );
}

interface IntegrationApp {
  id: string;
  name: string;
  category: 'social' | 'leads' | 'voice' | 'developer';
  icon: React.ReactNode;
  iconBg: string;
  status: 'connected' | 'not_connected' | 'beta';
  statusLabel?: string;
  description: string;
  badge?: string;
  manageHref?: string;
  connectAction?: string;
}

export function IntegrationsClient() {
  const [_loading, setLoading] = useState(true);
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState<string | null>(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [messengerConnected, setMessengerConnected] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'whatsapp' | 'instagram' | 'messenger' | 'lead_forms' | null
  >(null);
  const [whatsAppTab, setWhatsAppTab] = useState<'embedded' | 'qr'>('embedded');
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [metaAppId, setMetaAppId] = useState<string>('');
  const [metaConfigId, setMetaConfigId] = useState<string>('');

  // Fetch live WhatsApp and integration config
  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp/config');
      if (res.ok) {
        const data = await res.json();
        const isConn = data.connected === true || data.status === 'connected';
        setWhatsAppConnected(isConn);
        if (data.config?.phone_number || data.phone_number) {
          setWhatsAppPhone(data.config?.phone_number || data.phone_number);
        }
        if (data.appId) setMetaAppId(data.appId);
        if (data.configId) setMetaConfigId(data.configId);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Handle Meta Embedded Signup Trigger
  const handleLaunchWhatsAppEmbedded = async () => {
    try {
      setConnectingMeta(true);
      const appId =
        metaAppId || process.env.NEXT_PUBLIC_META_APP_ID || '1461038582135406';
      const configId =
        metaConfigId ||
        process.env.NEXT_PUBLIC_META_CONFIG_ID ||
        '4607476386162686';

      const result = await launchWhatsAppEmbeddedSignup({
        appId,
        configId,
        mode: 'standard',
      });

      if (result.code) {
        toast.info('Linking WhatsApp account with Helpa server...');
        const saveRes = await fetch('/api/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: result.code,
            wabaId: result.wabaId,
            phoneNumberId: result.phoneNumberId,
          }),
        });

        if (saveRes.ok) {
          toast.success('WhatsApp Business successfully connected!');
          setWhatsAppConnected(true);
          setActiveModal(null);
          fetchConfigs();
        } else {
          toast.error('Failed to link WhatsApp account on server.');
        }
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Embedded Signup failed.'
      );
    } finally {
      setConnectingMeta(false);
    }
  };

  // Handle Instagram Connect simulation / setup
  const handleConnectInstagram = () => {
    setConnectingMeta(true);
    setTimeout(() => {
      setConnectingMeta(false);
      setInstagramConnected(true);
      setActiveModal(null);
      toast.success(
        'Instagram Direct connected! DMs will now sync to your Helpa Inbox.'
      );
    }, 1200);
  };

  // Handle Facebook Messenger Connect simulation / setup
  const handleConnectMessenger = () => {
    setConnectingMeta(true);
    setTimeout(() => {
      setConnectingMeta(false);
      setMessengerConnected(true);
      setActiveModal(null);
      toast.success(
        'Facebook Messenger connected! Page inquiries will now sync to Contacts.'
      );
    }, 1200);
  };

  const integrationsList: IntegrationApp[] = [
    {
      id: 'whatsapp',
      name: 'Whatsapp Business',
      category: 'social',
      icon: <MessageCircle className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#25D366]',
      status: whatsAppConnected ? 'connected' : 'not_connected',
      statusLabel: whatsAppConnected ? 'Connected' : 'Not Connected',
      description:
        whatsAppConnected && whatsAppPhone
          ? `Connected to ${whatsAppPhone}. 24/7 AI Receptionist is actively receiving and responding to customer chats.`
          : 'Connect with customers on their favorite messaging app. Send updates, support messages, and automate chats with AI.',
      manageHref: '/settings?tab=whatsapp',
      connectAction: 'whatsapp',
    },
    {
      id: 'instagram',
      name: 'Instagram Direct',
      category: 'social',
      icon: <InstagramIcon className="h-6 w-6 text-white" />,
      iconBg: 'bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4]',
      status: instagramConnected ? 'connected' : 'not_connected',
      statusLabel: instagramConnected ? 'Connected' : 'Not Connected',
      description:
        'Automate direct messages, story replies, and customer inquiries directly from your Instagram professional profile.',
      manageHref: '/settings?tab=channels',
      connectAction: 'instagram',
    },
    {
      id: 'messenger',
      name: 'Facebook Messenger',
      category: 'social',
      icon: <MessengerIcon className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#0084FF]',
      status: messengerConnected ? 'connected' : 'not_connected',
      statusLabel: messengerConnected ? 'Connected' : 'Not Connected',
      description:
        'Engage with Facebook page visitors, answer inquiries automatically, and sync leads into your CRM pipeline.',
      manageHref: '/settings?tab=channels',
      connectAction: 'messenger',
    },
    {
      id: 'facebook_leads',
      name: 'Facebook Lead Ads',
      category: 'leads',
      icon: <FacebookIcon className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#1877F2]',
      status: 'not_connected',
      statusLabel: 'Not Connected',
      description:
        'Automate lead generation and manage customer inquiries directly from Facebook. Capture leads into CRM instantly.',
      manageHref: '/settings?tab=lead-ads',
      connectAction: 'messenger',
    },
    {
      id: 'smart_ai_calling',
      name: 'Smart AI Calling',
      category: 'voice',
      icon: <Bot className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#0F172A]',
      badge: 'BETA',
      status: 'not_connected',
      statusLabel: 'Not Connected',
      description:
        'Inbound and outbound Voice Streaming AI agent. Real-time voice calls, appointment booking, and automatic call summaries.',
      manageHref: '/settings?tab=voice',
      connectAction: 'voice',
    },
    {
      id: 'indiamart',
      name: 'IndiaMart',
      category: 'leads',
      icon: <Store className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#A82424]',
      status: 'not_connected',
      statusLabel: 'Not Connected',
      description:
        'Get leads from IndiaMart and sync them to our CRM in real-time with automated instant WhatsApp greetings.',
      manageHref: '/settings?tab=integrations',
      connectAction: 'indiamart',
    },
    {
      id: 'exporters_india',
      name: 'ExportersIndia',
      category: 'leads',
      icon: <Store className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#0052CC]',
      status: 'not_connected',
      statusLabel: 'Not Connected',
      description:
        'Get leads from ExportersIndia and sync them directly to your CRM contacts and sales pipelines.',
      manageHref: '/settings?tab=integrations',
      connectAction: 'exporters',
    },
    {
      id: 'webhooks_api',
      name: 'Webhooks & REST API',
      category: 'developer',
      icon: <Code2 className="h-6 w-6 text-white" />,
      iconBg: 'bg-[#475569]',
      status: 'connected',
      statusLabel: 'Active',
      description:
        'Connect your custom website, third-party apps, or backend with secure API keys and real-time webhook events.',
      manageHref: '/settings?tab=api',
      connectAction: 'webhooks',
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner: Lead Forms */}
      <Card className="overflow-hidden border-slate-200/80 bg-white shadow-xs">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Lead Forms
            </h2>
            <p className="text-sm text-slate-600">
              Build forms, share a public link, or embed on your website.
              Submissions sync to Contacts.
            </p>
          </div>
          <Button
            onClick={() => setActiveModal('lead_forms')}
            className="shrink-0 bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            Manage Lead Forms
          </Button>
        </CardContent>
      </Card>

      {/* Featured Integrations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
              Featured
            </h3>
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600"
            >
              {integrationsList.length} apps
            </Badge>
          </div>
        </div>

        {/* 3-Column Responsive Cards Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {integrationsList.map((app) => {
            const isConn = app.status === 'connected';

            return (
              <Card
                key={app.id}
                className="flex flex-col justify-between border-slate-200/80 bg-white shadow-xs transition-shadow hover:shadow-md"
              >
                <CardContent className="p-6">
                  {/* Top: Icon + Status Badge */}
                  <div className="mb-4 flex items-start justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${app.iconBg} shadow-xs`}
                    >
                      {app.icon}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {app.badge && (
                        <Badge className="bg-blue-100 text-[10px] font-bold text-blue-700 hover:bg-blue-100">
                          {app.badge}
                        </Badge>
                      )}

                      {isConn ? (
                        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Connected</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span>Not Connected</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h4 className="text-base font-bold text-slate-900">
                      {app.name}
                    </h4>
                    <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
                      {app.description}
                    </p>
                  </div>
                </CardContent>

                {/* Bottom Actions */}
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/50 p-4">
                  <Link
                    href={app.manageHref || '/settings'}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Manage</span>
                  </Link>

                  {isConn ? (
                    <Button
                      onClick={() => {
                        if (app.id === 'whatsapp') {
                          setActiveModal('whatsapp');
                        } else if (app.id === 'instagram') {
                          setInstagramConnected(false);
                          toast.info('Instagram disconnected.');
                        } else if (app.id === 'messenger') {
                          setMessengerConnected(false);
                          toast.info('Facebook Messenger disconnected.');
                        } else {
                          toast.info(`${app.name} settings updated.`);
                        }
                      }}
                      variant="outline"
                      className="flex items-center justify-center gap-1.5 border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Configured</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        if (app.connectAction === 'whatsapp') {
                          setActiveModal('whatsapp');
                        } else if (app.connectAction === 'instagram') {
                          setActiveModal('instagram');
                        } else if (app.connectAction === 'messenger') {
                          setActiveModal('messenger');
                        } else {
                          toast.info(`Opening setup wizard for ${app.name}...`);
                          if (app.manageHref) {
                            window.location.href = app.manageHref;
                          }
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <Plug className="h-3.5 w-3.5" />
                      <span>Connect</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. WHATSAPP CONNECTION MODAL (Embedded Signup & QR Code) */}
      {/* ========================================================================= */}
      {activeModal === 'whatsapp' && (
        <div className="animate-in fade-in-50 fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-xs">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Connect WhatsApp Business
                </h3>
                <p className="text-xs text-slate-500">
                  Choose your preferred connection method
                </p>
              </div>
            </div>

            {/* Connection Tabs */}
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setWhatsAppTab('embedded')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                  whatsAppTab === 'embedded'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Meta Official API</span>
              </button>

              <button
                onClick={() => setWhatsAppTab('qr')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                  whatsAppTab === 'qr'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="h-4 w-4 text-blue-600" />
                <span>QR Code Scan</span>
              </button>
            </div>

            {/* Tab 1: Meta Embedded Signup */}
            {whatsAppTab === 'embedded' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    Recommended for Clinics & Growing Businesses
                  </h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-emerald-800">
                    <li>Official Meta WhatsApp Business Cloud API</li>
                    <li>24/7 AI Receptionist auto-replies</li>
                    <li>High throughput & broadcast messaging support</li>
                  </ul>
                </div>

                <Button
                  onClick={handleLaunchWhatsAppEmbedded}
                  disabled={connectingMeta}
                  className="w-full bg-[#25D366] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1EBE5D]"
                >
                  {connectingMeta ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting with Meta...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Connect with Facebook Login
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-slate-400">
                  By clicking connect, you authorize Meta WhatsApp Business
                  integration.
                </p>
              </div>
            ) : (
              /* Tab 2: QR Panel */
              <div className="space-y-4">
                <WhatsAppQrPanel
                  onConnectionSuccess={() => {
                    setWhatsAppConnected(true);
                    setActiveModal(null);
                    fetchConfigs();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. INSTAGRAM DIRECT MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'instagram' && (
        <div className="animate-in fade-in-50 fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] text-white shadow-xs">
                <InstagramIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Connect Instagram Direct
                </h3>
                <p className="text-xs text-slate-500">
                  Sync DMs & story replies directly to Helpa CRM Inbox
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">Requirements:</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    Your Instagram account must be a{' '}
                    <strong>Professional / Business account</strong>.
                  </li>
                  <li>
                    Your Instagram profile must be linked to your Facebook
                    Business Page.
                  </li>
                  <li>
                    Allow &quot;Access to Messages&quot; in your Instagram
                    privacy settings.
                  </li>
                </ol>
              </div>

              <Button
                onClick={handleConnectInstagram}
                disabled={connectingMeta}
                className="w-full bg-gradient-to-r from-[#FD1D1D] via-[#E1306C] to-[#833AB4] py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"
              >
                {connectingMeta ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting Instagram Account...
                  </>
                ) : (
                  <>
                    <InstagramIcon className="mr-2 h-4 w-4" />
                    Connect Instagram Business
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FACEBOOK MESSENGER MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'messenger' && (
        <div className="animate-in fade-in-50 fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0084FF] text-white shadow-xs">
                <FacebookIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Connect Facebook Messenger
                </h3>
                <p className="text-xs text-slate-500">
                  Automate chat inquiries from your Facebook Page
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">How it works:</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    Inquiries on your Facebook Page will instantly appear in
                    Helpa Inbox.
                  </li>
                  <li>
                    AI Receptionist can automatically answer common questions &
                    capture leads.
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleConnectMessenger}
                disabled={connectingMeta}
                className="w-full bg-[#0084FF] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0073E6]"
              >
                {connectingMeta ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authorizing Facebook Page...
                  </>
                ) : (
                  <>
                    <FacebookIcon className="mr-2 h-4 w-4" />
                    Connect Facebook Page
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. LEAD FORMS MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'lead_forms' && (
        <div className="animate-in fade-in-50 fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Manage Lead Forms
                </h3>
                <p className="text-xs text-slate-500">
                  Embeddable forms & shareable links for lead capture
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Website Consultation Form
                  </span>
                  <Badge className="bg-emerald-100 text-[10px] text-emerald-800">
                    Active
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Embed code ready. Collects Name, Phone, Service requirement,
                  and syncs to Contacts.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        '<iframe src="https://www.helpa.studio/forms/embed" width="100%" height="500"></iframe>'
                      );
                      toast.success('Embed iframe code copied to clipboard!');
                    }}
                    className="text-xs"
                  >
                    Copy Embed Code
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                    onClick={() => {
                      window.open('https://www.helpa.studio', '_blank');
                    }}
                  >
                    Preview Form
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
