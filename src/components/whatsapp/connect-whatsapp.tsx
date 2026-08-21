'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FacebookLoginResponse {
  authResponse?: { code?: string };
}

declare global {
  interface Window {
    FB?: {
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>
      ) => void;
    };
  }
}

function readMetaSignupIds(data: Record<string, unknown>) {
  const candidates = [data, data.data, data.payload, data.session_info].filter(
    (value): value is Record<string, unknown> =>
      Boolean(value && typeof value === 'object')
  );
  let wabaId = '';
  let phoneNumberId = '';
  for (const candidate of candidates) {
    wabaId = wabaId || String(candidate.waba_id || candidate.wabaId || '');
    phoneNumberId =
      phoneNumberId ||
      String(candidate.phone_number_id || candidate.phoneNumberId || '');
  }
  return { wabaId, phoneNumberId };
}

export function ConnectWhatsApp() {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const metaSignupIds = useRef({ wabaId: '', phoneNumberId: '' });
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      )
        return;
      let data: Record<string, unknown> | null = null;
      try {
        data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

      const ids = readMetaSignupIds(data);
      if (ids.wabaId) metaSignupIds.current.wabaId = ids.wabaId;
      if (ids.phoneNumberId)
        metaSignupIds.current.phoneNumberId = ids.phoneNumberId;

      if (data.event === 'CANCEL' || data.event === 'ERROR') {
        setLoading(false);
        setError('WhatsApp setup was cancelled or could not be completed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const connect = async () => {
    setError(null);
    metaSignupIds.current = { wabaId: '', phoneNumberId: '' };
    if (!appId || !configId) {
      setError('WhatsApp setup is not configured yet.');
      return;
    }
    if (!window.FB) {
      setError('Meta connection is still loading. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const stateResponse = await fetch('/api/whatsapp/embedded-signup/state', {
        cache: 'no-store',
      });
      const stateData = await stateResponse.json();
      if (!stateResponse.ok || !stateData.state)
        throw new Error('Could not start secure WhatsApp connection');

      window.FB.login(
        async (response) => {
          const code = response.authResponse?.code;
          if (!code) {
            setLoading(false);
            setError(
              'Meta did not return an authorization code. Please try again.'
            );
            return;
          }
          try {
            const completeResponse = await fetch(
              '/api/whatsapp/embedded-signup/complete',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code,
                  state: stateData.state,
                  waba_id: metaSignupIds.current.wabaId || undefined,
                  phone_number_id:
                    metaSignupIds.current.phoneNumberId || undefined,
                }),
              }
            );
            const result = await completeResponse.json();
            if (!completeResponse.ok)
              throw new Error(result.error || 'WhatsApp connection failed');
            setConnected(true);
          } catch (completionError) {
            setError(
              completionError instanceof Error
                ? completionError.message
                : 'WhatsApp connection failed'
            );
          } finally {
            setLoading(false);
          }
        },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { sessionInfoVersion: 3 },
        }
      );
    } catch (connectError) {
      setLoading(false);
      setError(
        connectError instanceof Error
          ? connectError.message
          : 'Unable to connect WhatsApp'
      );
    }
  };

  return (
    <>
      <Script
        id="facebook-sdk"
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.FB && appId) {
            const fb = window.FB as unknown as {
              init?: (options: Record<string, unknown>) => void;
            };
            fb.init?.({ appId, cookie: true, xfbml: false, version: 'v21.0' });
            setSdkReady(true);
          }
        }}
      />
      <div className="border-border bg-card rounded-2xl border p-6 shadow-sm">
        {connected ? (
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-500" />
            <div>
              <h3 className="font-semibold">WhatsApp connected</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Your WhatsApp Business account is now connected to Helpa.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                <h3 className="font-semibold">Connect WhatsApp</h3>
              </div>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                Connect your WhatsApp Business account securely through Meta. No
                Phone Number ID, WABA ID, or access token is required.
              </p>
              {error ? (
                <p className="text-destructive mt-2 text-sm">{error}</p>
              ) : null}
            </div>
            <Button
              onClick={connect}
              disabled={loading || !sdkReady}
              className="shrink-0"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {loading
                ? 'Connecting…'
                : sdkReady
                  ? 'Connect WhatsApp'
                  : 'Loading Meta…'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
