'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import {
  RAIL_GROUPS,
  getSectionMeta,
  isSectionVisible,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from './settings-sections';

// Width at/above which the rail is a vertical column (already in view, so
// no auto-scroll needed). Mirrors the Tailwind `lg:` breakpoint that
// drives the row→column switch in the markup below — keep the two in sync.
const RAIL_DESKTOP_MIN_PX = 1024;

/**
 * The settings left rail — grouped, vertical on desktop and a
 * horizontal scroller on narrow screens (mirrors the mockup's ≤920px
 * behaviour). The active item auto-scrolls into view when the rail is
 * horizontal so a deep-linked section is never off-screen.
 *
 * Labels and visible sections adapt dynamically based on the
 * account's active industry template.
 */
export function SettingsRail({
  active,
  onSelect,
  hints,
}: {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  hints?: Partial<Record<SettingsSection, ReactNode>>;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const { account } = useAuth();
  const sectionMeta = getSectionMeta(account?.industry);

  // When horizontal (mobile), keep the active chip in view. On desktop
  // the rail is a static column, so skip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia(`(min-width: ${RAIL_DESKTOP_MIN_PX}px)`).matches)
      return;
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        'flex [scrollbar-width:none] gap-1 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden',
        'border-border border-b',
        'lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0'
      )}
    >
      {RAIL_GROUPS.map(({ label, group }) => {
        const items = SETTINGS_SECTIONS.filter(
          (s) =>
            s !== 'members' &&
            sectionMeta[s].group === group &&
            isSectionVisible(s, account?.industry)
        );
        if (items.length === 0) return null;
        return (
          <div
            key={group}
            className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5"
          >
            {label ? (
              <div className="text-muted-foreground hidden px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.09em] uppercase lg:block">
                {label}
              </div>
            ) : null}
            {items.map((s) => {
              const meta = sectionMeta[s];
              const Icon = meta.icon;
              const isActive = s === active;
              return (
                <button
                  key={s}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                    'lg:w-full',
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{meta.label}</span>
                  {hints?.[s] != null ? (
                    <span
                      className={cn(
                        'hidden items-center gap-1.5 text-xs lg:inline-flex',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {hints[s]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
