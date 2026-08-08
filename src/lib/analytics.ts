/**
 * Lightweight analytics event helper (no vendor lock-in).
 * Safely forwards events to window.gtag, window.plausible, or console log in development.
 */
export type AnalyticsEvent =
  | 'hero_cta_click'
  | 'video_play'
  | 'roi_calculated'
  | 'pricing_plan_click'
  | 'whatsapp_float_click'
  | 'faq_open'
  | 'signup_start';

declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      params?: Record<string, unknown>
    ) => void;
    plausible?: (
      event: string,
      options?: { props?: Record<string, unknown> }
    ) => void;
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  props?: Record<string, unknown>
): void {
  try {
    if (typeof window === 'undefined') return;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics Track]: ${event}`, props || {});
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', event, props);
    }

    if (typeof window.plausible === 'function') {
      window.plausible(event, { props });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Analytics Error]:', message);
  }
}
