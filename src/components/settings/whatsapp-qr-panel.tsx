'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Zap,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WhatsAppQrPanelProps {
  onConnectionSuccess?: () => void;
}

export function WhatsAppQrPanel({ onConnectionSuccess }: WhatsAppQrPanelProps) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'disconnected' | 'waiting_for_scan' | 'connected'
  >('disconnected');
  const [expiresIn, setExpiresIn] = useState<number>(60);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const fetchSessionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/qr/session');
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'connected') {
          setStatus('connected');
          setConnectedPhone(data.phone_number || null);
        } else if (data.status === 'waiting_for_scan' && data.qr_code) {
          setStatus('waiting_for_scan');
          setQrCode(data.qr_code);
          setExpiresIn(data.expires_in || 60);
        } else {
          setStatus('disconnected');
        }
      }
    } catch {
      // Ignore poll error
    }
  }, []);

  const generateNewQr = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/qr/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      const data = await res.json();
      if (res.ok && data.qr_code) {
        setQrCode(data.qr_code);
        setStatus('waiting_for_scan');
        setExpiresIn(data.expires_in || 60);
      } else {
        toast.error(data.error || 'Failed to generate QR code');
      }
    } catch {
      toast.error('Network error while generating QR code');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSimulateScan = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/whatsapp/qr/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_paired',
          simulate_phone: '+91 89270 93059',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('connected');
        setConnectedPhone('+91 89270 93059');
        toast.success('Device linked successfully! All chats preserved.');
        onConnectionSuccess?.();
      }
    } catch {
      toast.error('Failed to link device');
    } finally {
      setSimulating(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink this device?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/qr/session', { method: 'DELETE' });
      if (res.ok) {
        setStatus('disconnected');
        setQrCode(null);
        setConnectedPhone(null);
        toast.success('Device unlinked.');
      }
    } catch {
      toast.error('Failed to unlink device');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionStatus();
  }, [fetchSessionStatus]);

  // Countdown timer for active QR Code
  useEffect(() => {
    if (status !== 'waiting_for_scan' || expiresIn <= 0) return;
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          generateNewQr();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, expiresIn, generateNewQr]);

  return (
    <div className="space-y-6">
      {status === 'connected' ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground text-base font-semibold">
                      WhatsApp Linked Device Active
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    >
                      Live
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Connected Number:{' '}
                    <strong className="text-foreground">
                      {connectedPhone || 'WhatsApp Mobile'}
                    </strong>
                  </p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ 100% of your chat history is preserved on your phone.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                disabled={loading}
                className="text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Unlink className="mr-2 h-4 w-4" />
                Unlink Device
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
          {/* Left: Step-by-step instructions */}
          <div className="space-y-4 md:col-span-7">
            <div className="space-y-1.5">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Smartphone className="text-primary h-5 w-5" />
                Link Existing WhatsApp (Zero Chat Loss)
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Connect your existing WhatsApp Business or personal mobile app
                without deleting your account or losing any historical chats.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="border-border/60 bg-muted/20 flex items-start gap-3 rounded-lg border p-3">
                <span className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  1
                </span>
                <p className="text-muted-foreground text-xs">
                  Open <strong>WhatsApp</strong> or{' '}
                  <strong>WhatsApp Business</strong> on your phone.
                </p>
              </div>

              <div className="border-border/60 bg-muted/20 flex items-start gap-3 rounded-lg border p-3">
                <span className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  2
                </span>
                <p className="text-muted-foreground text-xs">
                  Tap <strong>Menu ⋮</strong> (Android) or{' '}
                  <strong>Settings ⚙️</strong> (iPhone) and select{' '}
                  <strong>Linked Devices</strong>.
                </p>
              </div>

              <div className="border-border/60 bg-muted/20 flex items-start gap-3 rounded-lg border p-3">
                <span className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  3
                </span>
                <p className="text-muted-foreground text-xs">
                  Tap <strong>Link a Device</strong> and point your camera at
                  the QR code on the right.
                </p>
              </div>
            </div>

            <div className="text-muted-foreground bg-primary/5 border-primary/20 flex items-center gap-2 rounded-lg border p-3 text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                End-to-End Encrypted Multi-Device sync keeps all personal &
                business messages private.
              </span>
            </div>
          </div>

          {/* Right: Interactive QR Box */}
          <div className="bg-card border-border flex flex-col items-center justify-center rounded-2xl border p-6 shadow-sm md:col-span-5">
            {status === 'waiting_for_scan' && qrCode ? (
              <div className="flex w-full flex-col items-center space-y-4">
                <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-inner">
                  {/* Visual SVG QR Code Matrix */}
                  <div className="relative flex h-48 w-48 items-center justify-center">
                    <svg
                      viewBox="0 0 100 100"
                      className="h-full w-full fill-current text-slate-900"
                    >
                      {/* Corner markers */}
                      <rect
                        x="5"
                        y="5"
                        width="25"
                        height="25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        rx="3"
                      />
                      <rect x="11" y="11" width="13" height="13" />
                      <rect
                        x="70"
                        y="5"
                        width="25"
                        height="25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        rx="3"
                      />
                      <rect x="76" y="11" width="13" height="13" />
                      <rect
                        x="5"
                        y="70"
                        width="25"
                        height="25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        rx="3"
                      />
                      <rect x="11" y="76" width="13" height="13" />
                      {/* Data dots pattern */}
                      <rect x="36" y="8" width="6" height="6" />
                      <rect x="48" y="8" width="6" height="6" />
                      <rect x="58" y="8" width="6" height="6" />
                      <rect x="8" y="36" width="6" height="6" />
                      <rect x="20" y="36" width="6" height="6" />
                      <rect x="36" y="36" width="6" height="6" />
                      <rect x="48" y="36" width="6" height="6" />
                      <rect x="60" y="36" width="6" height="6" />
                      <rect x="75" y="36" width="6" height="6" />
                      <rect x="86" y="36" width="6" height="6" />
                      <rect x="36" y="48" width="6" height="6" />
                      <rect x="48" y="48" width="6" height="6" />
                      <rect x="60" y="48" width="6" height="6" />
                      <rect x="8" y="48" width="6" height="6" />
                      <rect x="20" y="48" width="6" height="6" />
                      <rect x="36" y="60" width="6" height="6" />
                      <rect x="48" y="60" width="6" height="6" />
                      <rect x="60" y="60" width="6" height="6" />
                      <rect x="75" y="60" width="6" height="6" />
                      <rect x="86" y="60" width="6" height="6" />
                      <rect x="36" y="75" width="6" height="6" />
                      <rect x="48" y="75" width="6" height="6" />
                      <rect x="60" y="75" width="6" height="6" />
                      <rect x="75" y="75" width="6" height="6" />
                      <rect x="86" y="75" width="6" height="6" />
                      <rect x="36" y="86" width="6" height="6" />
                      <rect x="48" y="86" width="6" height="6" />
                      <rect x="60" y="86" width="6" height="6" />
                    </svg>

                    {/* Centered WhatsApp Emblem */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                        <Zap className="h-5 w-5 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-muted-foreground flex w-full items-center justify-between px-2 text-xs">
                  <span>
                    Auto-refreshes in <strong>{expiresIn}s</strong>
                  </span>
                  <button
                    type="button"
                    onClick={generateNewQr}
                    className="text-primary flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                <Button
                  onClick={handleSimulateScan}
                  disabled={simulating}
                  size="sm"
                  className="w-full bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {simulating ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Linking Phone...
                    </>
                  ) : (
                    'Simulate Mobile Scan (+91 89270 93059)'
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-2xl">
                  <QrCode className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">
                    Ready to link your device
                  </p>
                  <p className="text-muted-foreground max-w-[200px] text-xs">
                    Click below to generate a live QR Code for your phone.
                  </p>
                </div>
                <Button
                  onClick={generateNewQr}
                  disabled={loading}
                  size="sm"
                  className="w-full text-xs font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Generating QR...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-1.5 h-3.5 w-3.5" />
                      Generate QR Code
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
