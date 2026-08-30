'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#030712]">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const urlError = searchParams.get('error') || searchParams.get('error_description');

  useEffect(() => {
    if (urlError) {
      setError(urlError);
      setCheckingSession(false);
      return;
    }

    const supabase = createClient();

    // Check existing session or listen for recovery auth state
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
        }
      } catch (err) {
        console.warn('Session check failed:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setSessionReady(true);
          setCheckingSession(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      // 1. Attempt server-side password update (verifies SSR cookies)
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setSuccess(true);
        setLoading(false);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
        return;
      }

      // 2. Fallback to client SDK updateUser if server endpoint didn't have SSR cookie yet
      const supabase = createClient();
      const { error: clientUpdateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (clientUpdateError) {
        setError(
          clientUpdateError.message ||
            data.error ||
            'Failed to update password. Your reset link may have expired.'
        );
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch {
      setError('A network error occurred while updating your password.');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#030712] font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Background glowing gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 -z-10 h-[400px] w-[500px] rounded-full bg-cyan-600/10 blur-[140px]" />

      {/* Main Container */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        {/* Header Branding */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-3 transition-opacity duration-200 hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-zinc-950">
                <Image
                  src="/helpa-logo.svg?v=4"
                  alt="Helpa"
                  width={22}
                  height={22}
                  className="transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold tracking-tight text-white">
                Helpa
              </span>
              <span className="text-[10px] font-medium tracking-wider text-emerald-400 uppercase">
                AI Healthcare CRM
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Secure Recovery</span>
          </div>
        </div>

        {/* Card Body */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-8 ring-emerald-500/5">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-white">
                Password Reset Complete!
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your password has been successfully updated. Redirecting you to sign in...
              </p>

              <div className="mt-6">
                <Link href="/login">
                  <Button className="h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-zinc-950 transition-all duration-200 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Choose New Password</span>
                </div>
                <h1 className="font-heading mt-3 text-2xl font-extrabold text-white sm:text-3xl">
                  Set new password
                </h1>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Please enter your new password below. It must be at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, scale: 0.95 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.95 }}
                      className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400 backdrop-blur-md"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <span>{error}</span>
                        {error.toLowerCase().includes('expired') ||
                        error.toLowerCase().includes('invalid') ? (
                          <div className="mt-2">
                            <Link
                              href="/forgot-password"
                              className="font-semibold text-red-300 underline hover:text-white"
                            >
                              Request a new reset link
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* New Password Input */}
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="newPassword"
                    className="text-xs font-bold tracking-wider text-zinc-300 uppercase"
                  >
                    New Password
                  </Label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12 rounded-xl border border-white/10 bg-white/[0.03] pr-10 pl-10 text-sm text-white transition-all duration-200 placeholder:text-zinc-600 hover:border-white/20 focus-visible:border-emerald-500/60 focus-visible:bg-white/[0.06] focus-visible:ring-4 focus-visible:ring-emerald-500/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 transition-colors duration-200 hover:text-zinc-300 focus:outline-hidden"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-xs font-bold tracking-wider text-zinc-300 uppercase"
                  >
                    Confirm New Password
                  </Label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12 rounded-xl border border-white/10 bg-white/[0.03] pr-10 pl-10 text-sm text-white transition-all duration-200 placeholder:text-zinc-600 hover:border-white/20 focus-visible:border-emerald-500/60 focus-visible:bg-white/[0.06] focus-visible:ring-4 focus-visible:ring-emerald-500/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 transition-colors duration-200 hover:text-zinc-300 focus:outline-hidden"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || checkingSession}
                  className="mt-2 h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 hover:shadow-emerald-500/30 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating password...</span>
                    </div>
                  ) : (
                    'Set New Password'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors duration-200 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} Helpa Inc. All rights reserved.
      </footer>
    </div>
  );
}
