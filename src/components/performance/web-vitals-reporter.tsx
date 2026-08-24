'use client';

import { useReportWebVitals } from 'next/web-vitals';

const TRACKED_METRICS = new Set(['LCP', 'INP', 'CLS']);

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!TRACKED_METRICS.has(metric.name)) return;

    const payload = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      pathname: window.location.pathname,
      userAgent: navigator.userAgent,
      recordedAt: new Date().toISOString(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/performance/vitals', payload);
      return;
    }

    fetch('/api/performance/vitals', {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => undefined);
  });

  return null;
}
