'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  CheckCircle,
  UsersRound,
  Loader2,
  User,
  Mail,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#030712]">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      if (data.redirect === '/dashboard') {
        if (inviteToken) {
          router.push(`/join/${encodeURIComponent(inviteToken)}`);
        } else {
          router.push('/dashboard');
        }
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch {
      setError('Network error while creating your account.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030712] px-4">
        {/* Background Glow Spheres */}
        <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="z-10 w-full max-w-md"
        >
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <CheckCircle className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              </motion.div>

              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Check your email
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                We&apos;ve sent a confirmation link to{' '}
                <span className="font-semibold text-white">{email}</span>.
                Please check your inbox and click the link to verify your
                account.
              </p>

              <div className="mt-8 w-full">
                <Link
                  href={
                    inviteToken
                      ? `/login?invite=${encodeURIComponent(inviteToken)}`
                      : '/login'
                  }
                  className="w-full"
                >
                  <Button
                    variant="outline"
                    className="h-11 w-full cursor-pointer rounded-xl border-white/10 font-bold text-zinc-300 hover:bg-white/5 hover:text-white"
                  >
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030712] px-4 py-12">
      {/* Background Glow Spheres */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[50%] w-[50%] animate-pulse rounded-full bg-emerald-500/10 blur-[120px] duration-[8s]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[50%] w-[50%] animate-pulse rounded-full bg-indigo-500/10 blur-[120px] duration-[12s]" />

      {/* Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] bg-[size:24px_24px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {/* Logo Section */}
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              {inviteToken ? (
                <UsersRound className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              ) : (
                <MessageSquare className="h-6 w-6 text-indigo-400 drop-shadow-[0_0_6px_rgba(129,140,248,0.5)]" />
              )}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-extrabold tracking-tight text-white"
            >
              {inviteToken ? 'Create account & join' : 'Create account'}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-2 max-w-xs text-xs text-zinc-400"
            >
              {inviteToken
                ? 'Verify your email, then accept the invitation to join your team.'
                : 'Get started with Helpa Studio'}
            </motion.p>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400"
              >
                {error}
              </motion.div>
            )}

            {/* Name Field */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="flex flex-col gap-1.5"
            >
              <Label
                htmlFor="fullName"
                className="text-xs font-bold tracking-wider text-zinc-400 uppercase"
              >
                Full Name
              </Label>
              <div className="group relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
                  <User className="size-4" />
                </span>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-10 rounded-xl border-white/5 bg-white/[0.03] pl-10 text-white transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:bg-white/[0.05] focus-visible:ring-emerald-500/20"
                />
              </div>
            </motion.div>

            {/* Email Field */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-1.5"
            >
              <Label
                htmlFor="email"
                className="text-xs font-bold tracking-wider text-zinc-400 uppercase"
              >
                Email Address
              </Label>
              <div className="group relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
                  <Mail className="size-4" />
                </span>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 rounded-xl border-white/5 bg-white/[0.03] pl-10 text-white transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:bg-white/[0.05] focus-visible:ring-emerald-500/20"
                />
              </div>
            </motion.div>

            {/* Password Field */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-col gap-1.5"
            >
              <Label
                htmlFor="password"
                className="text-xs font-bold tracking-wider text-zinc-400 uppercase"
              >
                Password
              </Label>
              <div className="group relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
                  <KeyRound className="size-4" />
                </span>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 rounded-xl border-white/5 bg-white/[0.03] pl-10 text-white transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:bg-white/[0.05] focus-visible:ring-emerald-500/20"
                />
              </div>
            </motion.div>

            {/* Confirm Password Field */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col gap-1.5"
            >
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-bold tracking-wider text-zinc-400 uppercase"
              >
                Confirm Password
              </Label>
              <div className="group relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
                  <KeyRound className="size-4" />
                </span>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-10 rounded-xl border-white/5 bg-white/[0.03] pl-10 text-white transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:bg-white/[0.05] focus-visible:ring-emerald-500/20"
                />
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-2"
            >
              <Button
                type="submit"
                disabled={loading}
                className="group relative h-11 w-full cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/10 transition-all duration-200 hover:from-emerald-500 hover:to-indigo-500 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Create Account{' '}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Footer Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-xs font-semibold text-zinc-500"
          >
            Already have an account?{' '}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : '/login'
              }
              className="text-emerald-400 transition-colors duration-200 hover:text-emerald-300"
            >
              Sign in
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
