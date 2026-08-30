'use client';

import { Megaphone, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhatsAppChatKind } from '@/core/whatsapp/group-identity';

interface WhatsAppChatAvatarProps {
  kind: WhatsAppChatKind;
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function WhatsAppChatAvatar({
  kind,
  name,
  avatarUrl,
  size = 'md',
}: WhatsAppChatAvatarProps) {
  const box =
    size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  const icon =
    size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const initialsClass = size === 'lg' ? 'text-lg' : 'text-sm';

  if (avatarUrl) {
    return (
      <div
        className={cn(
          'bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          box
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name}
          className={cn('rounded-full object-cover', box)}
        />
      </div>
    );
  }

  if (kind === 'group') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white',
          box
        )}
        title="Group"
      >
        <Users className={icon} />
      </div>
    );
  }

  if (kind === 'channel') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-sky-600 text-white',
          box
        )}
        title="Channel"
      >
        <Megaphone className={icon} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-muted text-foreground flex shrink-0 items-center justify-center rounded-full font-medium',
        initialsClass,
        box
      )}
    >
      {(name.charAt(0) || 'C').toUpperCase()}
    </div>
  );
}
