const CANCELLED = new Set(['cancelled', 'canceled', 'no_show']);
const COMPLETED = new Set(['completed']);
const QUEUE_EXCLUDED = new Set([
  'cancelled',
  'canceled',
  'completed',
  'no_show',
]);
const UPCOMING = new Set(['pending', 'confirmed', 'calling']);

export function normalizeBookingStatus(status?: string | null): string {
  return String(status || '')
    .trim()
    .toLowerCase();
}

export function isUpcomingBookingStatus(status?: string | null): boolean {
  return UPCOMING.has(normalizeBookingStatus(status));
}

export function isCompletedBookingStatus(status?: string | null): boolean {
  return COMPLETED.has(normalizeBookingStatus(status));
}

export function isCancelledBookingStatus(status?: string | null): boolean {
  return CANCELLED.has(normalizeBookingStatus(status));
}

export function isActiveQueueBookingStatus(status?: string | null): boolean {
  return !QUEUE_EXCLUDED.has(normalizeBookingStatus(status));
}

export function matchesBookingTab(
  status: string | null | undefined,
  appointmentDate: string | null | undefined,
  tab: 'upcoming' | 'queue' | 'completed' | 'cancelled',
  today = new Date().toISOString().split('T')[0]
): boolean {
  const date = appointmentDate || '';
  if (tab === 'upcoming') {
    return isUpcomingBookingStatus(status) && (!date || date >= today);
  }
  if (tab === 'queue') {
    return date === today && isActiveQueueBookingStatus(status);
  }
  if (tab === 'completed') {
    return (
      isCompletedBookingStatus(status) ||
      (Boolean(date) && date < today && !isCancelledBookingStatus(status))
    );
  }
  return isCancelledBookingStatus(status);
}
