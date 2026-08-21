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
  ArrowLeft,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BUSINESS_TYPE_OPTIONS } from '@/modules/registry';

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

  const [step, setStep] = useState<'credentials' | 'business_type'>(
    'credentials'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Advance to Business Type selection step
    setStep('business_type');
  };

  const handleSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!selectedIndustry) {
      setError('Please select a valid business type.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          industry: selectedIndustry,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          data.error || "We couldn't save your business type. Please try again."
        );
        setLoading(false);
        return;
      }

      if (data.sessionSecret && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('appwrite_session', data.sessionSecret);
        } catch {
          // ignore storage errors
        }
      }

      if (data.redirect === '/dashboard') {
        router.refresh();
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
      setError('Network error while creating your account. Please try again.');
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
        className={`z-10 w-full transition-all duration-300 ${
          step === 'business_type' ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8">
          <AnimatePresence mode="wait">
            {step === 'credentials' ? (
              <motion.div
                key="step-credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Logo Section */}
                <div className="mb-8 flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/helpa-logo.png"
                      alt="Helpa"
                      className="h-full w-full object-contain"
                    />
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

                <form
                  onSubmit={handleCredentialsSubmit}
                  className="flex flex-col gap-4"
                >
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
                  <div className="flex flex-col gap-1.5">
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
                  </div>

                  {/* Email Field */}
                  <div className="flex flex-col gap-1.5">
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
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-1.5">
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
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-10 rounded-xl border-white/5 bg-white/[0.03] pl-10 text-white transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:bg-white/[0.05] focus-visible:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col gap-1.5">
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
                  </div>

                  {/* Continue to Step 2 Button */}
                  <div className="mt-2">
                    <Button
                      type="submit"
                      className="group relative h-11 w-full cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/10 transition-all duration-200 hover:from-emerald-500 hover:to-indigo-500 active:scale-[0.98]"
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        Continue{' '}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Button>
                  </div>
                </form>

                {/* Footer Text */}
                <p className="mt-6 text-center text-xs font-semibold text-zinc-500">
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
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="step-business-type"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Header */}
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <span className="text-xl">🏢</span>
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                    What type of business do you run?
                  </h2>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Choose the option that best describes your business.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                    {error}
                  </div>
                )}

                {/* 8 Business Type Cards Grid */}
                <div
                  role="radiogroup"
                  aria-label="What type of business do you run?"
                  className="grid max-h-[380px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 sm:pr-0"
                >
                  {BUSINESS_TYPE_OPTIONS.map((opt) => {
                    const isSelected = selectedIndustry === opt.id;
                    return (
                      <div
                        key={opt.id}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${opt.label}: ${opt.description}`}
                        tabIndex={0}
                        onClick={() => setSelectedIndustry(opt.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedIndustry(opt.id);
                          }
                        }}
                        className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                          isSelected
                            ? 'border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40'
                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl border text-lg transition-colors ${
                            isSelected
                              ? 'border-emerald-500/30 bg-emerald-500/20'
                              : 'border-white/5 bg-white/[0.04] group-hover:border-white/10'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                        </div>

                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-bold transition-colors ${
                                isSelected ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-zinc-400">
                            {opt.description}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-sm">
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setStep('credentials');
                    }}
                    disabled={loading}
                    className="h-11 cursor-pointer rounded-xl border-white/10 font-bold text-zinc-300 hover:bg-white/5 hover:text-white"
                  >
                    <ArrowLeft className="mr-1.5 size-4" />
                    Back
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleSignup()}
                    disabled={!selectedIndustry || loading}
                    className="group relative h-11 flex-1 cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/10 transition-all duration-200 hover:from-emerald-500 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        Continue
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
