'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  friendlyQrSessionError,
  readQrSessionResponse,
  type QrSessionResponse,
  type QrUiStatus,
} from '@/core/whatsapp/qr-session-client';
import { WhatsAppConnectedModal } from './whatsapp-connected-modal';

interface WhatsAppQrPanelProps {
  onConnectionSuccess?: () => void;
  initialConnected?: boolean;
  initialPhoneNumber?: string | null;
  initialVerifiedName?: string | null;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 5 * 60 * 1000;

function mapStatus(payload: QrSessionResponse): QrUiStatus {
  if (payload.connected) return 'connected';
  const status = payload.status;
  if (
    status === 'creating_instance' ||
    status === 'waiting_for_qr' ||
    status === 'waiting_for_scan' ||
    status === 'connected' ||
    status === 'disconnected' ||
    status === 'reconnect_required' ||
    status === 'expired' ||
    status === 'error'
  ) {
    return status;
  }
  if (payload.qr || payload.qr_code || payload.qr_image) {
    return 'waiting_for_scan';
  }
  return 'disconnected';
}

function isRetryableQrError(
  payload: QrSessionResponse,
  httpStatus: number
): boolean {
  return (
    (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) &&
    payload.error_code === 'EVOLUTION_GO_UNREACHABLE'
  );
}

interface QrPollOutcome {
  next: QrUiStatus;
  retryable: boolean;
}

export function WhatsAppQrPanel({
  onConnectionSuccess,
  initialConnected = false,
  initialPhoneNumber = null,
  initialVerifiedName = null,
}: WhatsAppQrPanelProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<QrUiStatus>(
    initialConnected ? 'connected' : 'disconnected'
  );
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(
    initialPhoneNumber
  );
  const [displayName, setDisplayName] = useState<string | null>(
    initialVerifiedName
  );
  const [error, setError] = useState<string | null>(null);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const pollStartedAt = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const wasConnected = useRef(initialConnected);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const applyPayload = useCallback(
    (payload: QrSessionResponse) => {
      const next = mapStatus(payload);
      const nextQr = payload.qr_code || payload.qr || null;
      const nextImage =
        payload.qr_image ||
        (nextQr && nextQr.startsWith('data:') ? nextQr : null);
      setStatus(next);
      setQrCode(nextQr);
      setQrImage(nextImage);
      setPairingCode(payload.pairing_code ?? null);
      setExpiresIn(
        Number(payload.expires_in_seconds || payload.expires_in || 0)
      );
      setConnectedPhone(payload.phone_number ?? null);
      setDisplayName(payload.display_name || payload.verified_name || null);
      setError(payload.error ?? null);
      if (next === 'connected' && !wasConnected.current) {
        wasConnected.current = true;
        setShowCelebrationModal(true);
        onConnectionSuccess?.();
      }
      if (next !== 'connected') {
        wasConnected.current = false;
      }
      return next;
    },
    [onConnectionSuccess]
  );

  const pollOnce = useCallback(async (): Promise<QrPollOutcome> => {
    const res = await fetch('/api/whatsapp/qr/session', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const payload = await readQrSessionResponse(res);
    if (
      !res.ok &&
      res.status !== 502 &&
      res.status !== 503 &&
      res.status !== 504
    ) {
      throw new Error(payload.error || 'Failed to load QR session');
    }
    return {
      next: applyPayload(payload),
      retryable: isRetryableQrError(payload, res.status),
    };
  }, [applyPayload]);

  const schedulePoll = useCallback(() => {
    stopPolling();
    if (unmounted.current) return;
    if (Date.now() - pollStartedAt.current > MAX_POLL_MS) {
      setStatus('expired');
      return;
    }
    pollTimer.current = setTimeout(async () => {
      try {
        const outcome = await pollOnce();
        const next = outcome.next;
        if (
          next === 'connected' ||
          next === 'disconnected' ||
          next === 'expired' ||
          (next === 'error' && !outcome.retryable)
        ) {
          stopPolling();
          return;
        }
        // A 502/503/504 from Evolution Go is transient. Keep polling so a
        // slow/restarting companion service does not force a manual retry.
        schedulePoll();
      } catch {
        if (!unmounted.current) {
          setStatus('error');
          setError('Could not refresh WhatsApp QR status');
        }
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling]);

  const generateNewQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    stopPolling();
    setStatus('creating_instance');
    try {
      const res = await fetch('/api/whatsapp/qr/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ action: 'generate' }),
      });
      const payload = await readQrSessionResponse(res);
      if (
        !res.ok &&
        res.status !== 502 &&
        res.status !== 503 &&
        res.status !== 504 &&
        !payload.qr_code &&
        !payload.qr_image
      ) {
        throw new Error(payload.error || 'Failed to generate QR code');
      }
      const next = applyPayload(payload);
      pollStartedAt.current = Date.now();
      if (
        next === 'waiting_for_qr' ||
        next === 'waiting_for_scan' ||
        next === 'creating_instance'
      ) {
        schedulePoll();
      }
    } catch (err) {
      setStatus('error');
      const message = friendlyQrSessionError(err, 'Failed to generate QR code');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [applyPayload, schedulePoll, stopPolling]);

  const reconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    stopPolling();
    try {
      const res = await fetch('/api/whatsapp/qr/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ action: 'reconnect' }),
      });
      const payload = await readQrSessionResponse(res);
      if (
        !res.ok &&
        res.status !== 502 &&
        res.status !== 503 &&
        res.status !== 504 &&
        !payload.qr_code &&
        !payload.qr_image
      ) {
        throw new Error(payload.error || 'Reconnect failed');
      }
      const next = applyPayload(payload);
      pollStartedAt.current = Date.now();
      if (next !== 'connected' && next !== 'error') {
        schedulePoll();
      }
    } catch (err) {
      setStatus('error');
      setError(friendlyQrSessionError(err, 'Reconnect failed'));
    } finally {
      setLoading(false);
    }
  }, [applyPayload, schedulePoll, stopPolling]);

  const handleUnlink = async () => {
    if (!confirm('Unlink this WhatsApp QR device from Helpa?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/qr/session', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await readQrSessionResponse(res);
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to unlink device');
      }
      stopPolling();
      applyPayload({ ...payload, status: 'disconnected', connected: false });
      toast.success('QR WhatsApp disconnected. Conversation history kept.');
      onConnectionSuccess?.();
    } catch (err) {
      toast.error(friendlyQrSessionError(err, 'Failed to unlink device'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    unmounted.current = false;
    void pollOnce()
      .then(({ next }) => {
        if (
          next === 'waiting_for_qr' ||
          next === 'waiting_for_scan' ||
          next === 'creating_instance'
        ) {
          pollStartedAt.current = Date.now();
          schedulePoll();
        }
      })
      .catch((err: unknown) => {
        if (unmounted.current) return;
        setStatus('error');
        setError(
          friendlyQrSessionError(err, 'Could not load WhatsApp QR status')
        );
      });
    return () => {
      unmounted.current = true;
      stopPolling();
    };
  }, [pollOnce, schedulePoll, stopPolling]);

  useEffect(() => {
    if (status !== 'waiting_for_scan' || expiresIn <= 0) return;
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          void generateNewQr();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, expiresIn, generateNewQr]);

  const waiting =
    status === 'creating_instance' ||
    status === 'waiting_for_qr' ||
    status === 'waiting_for_scan';
  const qrSrc =
    qrImage || (qrCode && qrCode.startsWith('data:') ? qrCode : null);

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
                      WhatsApp QR device linked
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    >
                      Live
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Linked as{' '}
                    <strong className="text-foreground">
                      {displayName || connectedPhone || 'WhatsApp device'}
                    </strong>
                  </p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Inbox, AI, and automations use this QR linked-device
                    connection. Official Meta templates are not available.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleUnlink()}
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
          <div className="space-y-4 md:col-span-7">
            <div className="space-y-1.5">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Smartphone className="text-primary h-5 w-5" />
                Connect with QR
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Link an existing WhatsApp account as a device. This is not the
                official Meta Cloud API and does not support approved message
                templates.
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
                  Tap <strong>Menu</strong> (Android) or{' '}
                  <strong>Settings</strong> (iPhone) and select{' '}
                  <strong>Linked Devices</strong>.
                </p>
              </div>
              <div className="border-border/60 bg-muted/20 flex items-start gap-3 rounded-lg border p-3">
                <span className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  3
                </span>
                <p className="text-muted-foreground text-xs">
                  Tap <strong>Link a Device</strong> and scan the QR code on the
                  right.
                </p>
              </div>
            </div>

            <div className="text-muted-foreground bg-primary/5 border-primary/20 flex items-center gap-2 rounded-lg border p-3 text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                Helpa never talks to Evolution Go from the browser. The QR is
                fetched through your workspace API.
              </span>
            </div>
          </div>

          <div className="bg-card border-border flex flex-col items-center justify-center rounded-2xl border p-6 shadow-sm md:col-span-5">
            <p className="text-muted-foreground mb-3 self-start text-[11px] tracking-wide uppercase">
              {status.replaceAll('_', ' ')}
            </p>
            {waiting && qrSrc ? (
              <div className="flex w-full flex-col items-center space-y-4">
                <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt="WhatsApp QR code"
                    className="h-48 w-48"
                  />
                </div>
                {expiresIn > 0 ? (
                  <div className="text-muted-foreground flex w-full items-center justify-between px-2 text-xs">
                    <span>
                      Auto-refreshes in <strong>{expiresIn}s</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => void generateNewQr()}
                      className="text-primary flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                  </div>
                ) : null}
                {pairingCode ? (
                  <p className="text-muted-foreground text-xs">
                    Pairing code:{' '}
                    <span className="font-mono">{pairingCode}</span>
                  </p>
                ) : null}
              </div>
            ) : waiting ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-2xl">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">
                    {status === 'creating_instance'
                      ? 'Creating WhatsApp instance'
                      : 'Waiting for a live QR code'}
                  </p>
                  <p className="text-muted-foreground max-w-[220px] text-xs">
                    {error ||
                      'Helpa is talking to Evolution Go. Keep this tab open.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-2xl">
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <QrCode className="h-8 w-8" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">
                    {status === 'reconnect_required'
                      ? 'Reconnect required'
                      : status === 'error'
                        ? 'Could not start QR connection'
                        : status === 'expired'
                          ? 'QR expired'
                          : 'Ready to link your device'}
                  </p>
                  <p className="text-muted-foreground max-w-[220px] text-xs">
                    {error ||
                      'Generate a live QR from Evolution Go through Helpa.'}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    status === 'reconnect_required'
                      ? void reconnect()
                      : void generateNewQr()
                  }
                  disabled={loading}
                  size="sm"
                  className="w-full text-xs font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : status === 'reconnect_required' ? (
                    'Reconnect'
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

      {/* Celebration Dialog Modal */}
      <WhatsAppConnectedModal
        open={showCelebrationModal}
        onClose={() => setShowCelebrationModal(false)}
        phoneNumber={connectedPhone}
        verifiedName={displayName}
      />
    </div>
  );
}
