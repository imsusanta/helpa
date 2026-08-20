'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function DashboardWhatsAppStatus() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    'connected' | 'needs_attention' | 'disconnected'
  >('disconnected');
  const [phoneLabel, setPhoneLabel] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/whatsapp/config');
        if (res.ok) {
          const data = await res.json();
          if (data?.config?.is_active && data?.config?.phone_number_id) {
            setStatus('connected');
            setPhoneLabel(
              data?.phone_info?.verified_name ||
                data?.phone_info?.display_phone_number ||
                'Business Account'
            );
          } else if (
            data?.config?.phone_number_id &&
            !data?.config?.is_active
          ) {
            setStatus('needs_attention');
          } else {
            setStatus('disconnected');
          }
        } else {
          setStatus('disconnected');
        }
      } catch {
        setStatus('disconnected');
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  if (loading) return null;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs transition-colors ${
        status === 'connected'
          ? 'border-emerald-500/20 bg-emerald-500/[0.03] text-zinc-300'
          : status === 'needs_attention'
            ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
            : 'border-rose-500/20 bg-rose-500/5 text-zinc-300'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
            status === 'connected'
              ? 'bg-emerald-500/20 text-emerald-400'
              : status === 'needs_attention'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          <Smartphone className="size-3.5" />
        </div>

        <div>
          <span className="text-foreground font-semibold">
            {status === 'connected'
              ? 'WhatsApp is connected'
              : status === 'needs_attention'
                ? 'WhatsApp needs attention'
                : 'WhatsApp is disconnected'}
          </span>
          {phoneLabel && status === 'connected' && (
            <span className="text-muted-foreground ml-1.5 text-[11px]">
              ({phoneLabel})
            </span>
          )}
          <span className="text-muted-foreground ml-2 hidden text-[11px] sm:inline">
            {status === 'connected'
              ? '• AI Receptionist is actively receiving messages 24/7'
              : status === 'needs_attention'
                ? '• Reconnection required to receive customer chats'
                : '• Connect your WhatsApp number to start receiving customer chats'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] ${
            status === 'connected'
              ? 'border-emerald-500/30 text-emerald-400'
              : status === 'needs_attention'
                ? 'border-amber-500/30 text-amber-400'
                : 'border-rose-500/30 text-rose-400'
          }`}
        >
          {status === 'connected'
            ? '● Live'
            : status === 'needs_attention'
              ? '⚠ Attention'
              : '○ Offline'}
        </Badge>

        <Link href="/settings?tab=whatsapp">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-7 text-xs"
          >
            {status === 'connected' ? 'Manage' : 'Connect'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
