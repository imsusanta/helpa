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

export function trackEvent(event: AnalyticsEvent, props?: Record<string, any>): void {
  try {
    if (typeof window === 'undefined') return;

    // Log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics Track]: ${event}`, props || {});
    }

    // Google Analytics (gtag)
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', event, props);
    }

    // Plausible Analytics
    if (typeof (window as any).plausible === 'function') {
      (window as any).plausible(event, { props });
    }
  } catch (err) {
    console.warn('[Analytics Error]:', err);
  }
}
