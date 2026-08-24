'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Mail, CircleAlert } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setEmail(profile.email ?? '');
  }, [profile]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const currentAvatar =
    previewUrl ?? (!removeAvatar ? (profile?.avatar_url ?? null) : null);
  const initial = (fullName || profile?.full_name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Unsupported image type', {
        description: 'Use PNG, JPG, WebP, or GIF.',
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image is too large', { description: 'Maximum 2 MB.' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const onRemoveAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return toast.error('Display name is required');
    if (!EMAIL_RE.test(trimmedEmail))
      return toast.error('Enter a valid email address');

    setSaving(true);
    try {
      let nextAvatarUrl: string | null = profile.avatar_url ?? null;
      if (pendingAvatar) {
        try {
          const formData = new FormData();
          formData.append('file', pendingAvatar);
          const avatarRes = await fetch('/api/account/avatar', {
            method: 'POST',
            body: formData,
          });
          const avatarData = await avatarRes.json().catch(() => ({}));
          if (avatarRes.ok && avatarData.avatar_url)
            nextAvatarUrl = avatarData.avatar_url;
          else throw new Error(avatarData.error || 'Server upload failed');
        } catch {
          try {
            const { uploadAccountMedia } =
              await import('@/lib/storage/upload-media');
            nextAvatarUrl = (
              await uploadAccountMedia('chat-media', pendingAvatar)
            ).publicUrl;
          } catch {
            nextAvatarUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve('');
              reader.readAsDataURL(pendingAvatar);
            });
          }
        }
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }

      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: trimmedName,
          email: trimmedEmail,
          avatar_url: nextAvatarUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Unable to save profile');
      }
      setEmailChangePending(false);
      setPendingAvatar(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      await refreshProfile();
      toast.success('Profile saved successfully');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to save profile'
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!profile &&
    (fullName.trim() !== (profile.full_name ?? '') ||
      email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase() ||
      pendingAvatar !== null ||
      removeAvatar);

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <section className="animate-in fade-in-50 w-full max-w-4xl duration-200">
      <SettingsPanelHead
        title="Your profile"
        description="Manage the personal information your team sees across Helpa."
      />

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {/* Profile identity */}
        <Card className="border-border/70 overflow-hidden shadow-sm">
          <div className="h-1 bg-emerald-500" />
          <CardContent className="p-0">
            <div className="via-background to-background bg-gradient-to-r from-emerald-50/80 px-6 py-6 sm:px-8 dark:from-emerald-950/20">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar
                  size="lg"
                  className="border-background size-20 shrink-0 rounded-2xl border-4 shadow-md"
                >
                  {currentAvatar ? (
                    <AvatarImage
                      src={currentAvatar}
                      alt={fullName || 'Avatar'}
                    />
                  ) : null}
                  <AvatarFallback className="rounded-xl bg-emerald-500/10 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                    Profile photo
                  </p>
                  <h2 className="text-foreground mt-1 text-xl font-semibold tracking-tight">
                    {fullName || 'Your profile'}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    This photo and name appear in your workspace header and
                    sidebar.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={onPickFile}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-lg"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                    >
                      <Upload className="size-4" />
                      {currentAvatar ? 'Change photo' : 'Upload photo'}
                    </Button>
                    {currentAvatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive h-9 rounded-lg"
                        onClick={onRemoveAvatar}
                        disabled={saving}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    )}
                    <span className="text-muted-foreground text-xs">
                      PNG, JPG, WebP or GIF · max 2 MB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal information */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-[0.14em] text-emerald-600 uppercase dark:text-emerald-400">
                Personal information
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Basic account information
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Keep your name and email address up to date.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="profile-full-name"
                  className="text-sm font-medium"
                >
                  Display name
                </Label>
                <Input
                  id="profile-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  maxLength={120}
                  disabled={saving}
                  required
                  className="bg-background h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-sm font-medium">
                  Email address
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                  required
                  className="bg-background h-11 rounded-xl"
                />
                {emailChangePending && (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <Mail className="mt-0.5 size-3.5 shrink-0" />
                    <span>Check both inboxes to confirm the email change.</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account information */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-5">
              <p className="text-xs font-semibold tracking-[0.14em] text-emerald-600 uppercase dark:text-emerald-400">
                Account
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Account details
              </h2>
            </div>
            <dl className="grid gap-3 md:grid-cols-2">
              <div className="border-border/60 bg-muted/40 rounded-xl border p-4">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Role
                </dt>
                <dd className="mt-2 inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-700 capitalize dark:text-emerald-300">
                  {profile?.role ?? 'user'}
                </dd>
              </div>
              <div className="border-border/60 bg-muted/40 rounded-xl border p-4">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Member since
                </dt>
                <dd className="text-foreground mt-2 text-sm font-medium">
                  {joined}
                </dd>
              </div>
              <div className="border-border/60 bg-muted/40 rounded-xl border p-4 md:col-span-2">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  User ID
                </dt>
                <dd className="text-muted-foreground mt-2 font-mono text-xs break-all">
                  {user?.id ?? '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {!profile && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CircleAlert className="size-4" />
            Loading your profile…
          </p>
        )}

        {/* Save bar */}
        <div className="border-border/70 bg-background/95 flex items-center justify-between gap-4 rounded-2xl border p-3 shadow-sm backdrop-blur sm:px-4">
          <p className="text-muted-foreground hidden text-xs sm:block">
            Changes are saved to your Helpa account.
          </p>
          <Button
            type="submit"
            disabled={saving || !dirty || !profile}
            className="ml-auto h-10 rounded-xl px-5"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
