'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Smartphone,
  MessageSquare,
  Sparkles,
  Bot,
  Zap,
  ArrowRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WhatsAppConnectedModalProps {
  open: boolean;
  onClose: () => void;
  phoneNumber?: string | null;
  verifiedName?: string | null;
}

export function WhatsAppConnectedModal({
  open,
  onClose,
  phoneNumber,
  verifiedName,
}: WhatsAppConnectedModalProps) {
  useEffect(() => {
    if (!open) return;

    // Trigger celebratory confetti burst
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      void confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#22c55e', '#10b981', '#14b8a6', '#3b82f6', '#f59e0b'],
    });
    fire(0.2, {
      spread: 60,
      colors: ['#22c55e', '#4ade80', '#86efac', '#60a5fa'],
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#10b981', '#059669', '#34d399', '#f43f5e'],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#22c55e', '#10b981', '#fbbf24'],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#22c55e', '#3b82f6', '#ec4899'],
    });
  }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-card text-card-foreground border-border relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border p-6 shadow-2xl sm:p-8"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Decorative background glow */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl" />

          {/* Header Icon with pulse rings */}
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.6, 0.2, 0.6],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 rounded-full bg-emerald-500/20"
            />
            <motion.div
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.4, 0.1, 0.4],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.3,
              }}
              className="absolute inset-0 rounded-full bg-emerald-500/10"
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
            </div>
          </div>

          {/* Titles */}
          <div className="mt-5 space-y-1.5 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Connection Successful
            </div>
            <h2 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
              WhatsApp is Live! 🎉
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Your device has been paired successfully and is ready to automate
              conversations.
            </p>
          </div>

          {/* Account Details Box */}
          <div className="border-border/80 bg-muted/30 mt-6 space-y-3 rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-foreground text-sm font-bold">
                    {verifiedName || 'Connected WhatsApp User'}
                  </h4>
                  <p className="text-muted-foreground font-mono text-xs font-medium">
                    {phoneNumber || 'Linked Device'}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Connected
              </Badge>
            </div>
          </div>

          {/* Features Enabled Checklist */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Bot className="h-3 w-3" />
              </div>
              <span>24/7 AI Receptionist & Auto-Replies active</span>
            </div>
            <div className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <MessageSquare className="h-3 w-3" />
              </div>
              <span>Real-time Team Inbox synchronized</span>
            </div>
            <div className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Zap className="h-3 w-3" />
              </div>
              <span>Smart Reminders & Lead Capture ready</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground text-xs font-semibold sm:w-auto"
            >
              Done
            </Button>
            <Link href="/inbox" className="w-full sm:w-auto">
              <Button
                onClick={onClose}
                className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 sm:text-sm"
              >
                <MessageSquare className="h-4 w-4" />
                Open Team Inbox
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
