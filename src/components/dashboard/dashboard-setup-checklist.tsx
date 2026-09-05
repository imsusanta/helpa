'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Smartphone, X } from 'lucide-react';

interface DashboardSetupChecklistProps {
  onResumeOnboarding?: () => void;
}

export function DashboardSetupChecklist({
  onResumeOnboarding,
}: DashboardSetupChecklistProps = {}) {
  const { account, accountId, accountRole } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [hasWhatsApp, setHasWhatsApp] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if dismissed in session
    if (typeof window !== 'undefined') {
      const isDismissed = window.sessionStorage.getItem(
        `dismiss_checklist_${accountId}`
      );
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/whatsapp/config');
        if (res.ok) {
          const data = await res.json();
          if (data?.connected === true) {
            setHasWhatsApp(true);
          } else {
            setHasWhatsApp(false);
          }
        }
      } catch {
        /* ignore fallback */
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [accountId]);

  // Do not force workspace setup onto invited staff or unauthorized roles
  if (accountRole !== 'owner' && accountRole !== 'admin') return null;

  if (dismissed || loading) return null;

  const items = [
    {
      label: 'Business Profile configured',
      done: Boolean(
        account?.name && account?.industry && account?.industry !== 'general'
      ),
      href: '/settings',
    },
    { label: 'Services & Pricing saved', done: true, href: '/knowledge-base' },
    { label: 'AI Receptionist configured', done: true, href: '/settings/ai' },
    {
      label: 'WhatsApp connected',
      done: hasWhatsApp,
      href: '/settings/whatsapp',
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  // If all completed, auto-hide
  if (completedCount === totalCount) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(`dismiss_checklist_${accountId}`, 'true');
    }
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-900/40 p-5 shadow-sm">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-zinc-500 transition-colors hover:text-zinc-300"
        title="Dismiss checklist"
        aria-label="Dismiss setup checklist"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
              {completedCount}/{totalCount}
            </span>
            <h3 className="text-sm font-bold text-white">
              Get Started with Helpa
            </h3>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Complete the remaining setup to let your AI handle customer
            inquiries automatically.
          </p>

          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onResumeOnboarding && accountRole === 'owner' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onResumeOnboarding}
              className="border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
            >
              Resume Setup
            </Button>
          )}
          {!hasWhatsApp && (
            <Link href="/settings/whatsapp">
              <Button
                size="sm"
                className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Smartphone className="mr-1.5 size-3.5" /> Connect WhatsApp
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Checklist items */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 sm:grid-cols-4">
        {items.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="group flex items-center gap-2 text-xs text-zinc-300 transition-colors hover:text-white"
          >
            {item.done ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="size-3.5 shrink-0 text-amber-400" />
            )}
            <span
              className={
                item.done ? 'text-zinc-500 line-through' : 'font-medium'
              }
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
