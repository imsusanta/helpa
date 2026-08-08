import type { NextConfig } from 'next';

/**
 * Enterprise Baseline Security Headers
 *
 * Enforces strict Content-Security-Policy, HSTS, clickjacking prevention (DENY),
 * MIME sniffing prevention (nosniff), and restricted device permissions.
 */
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === 'development'
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://avatar.vercel.sh https://images.unsplash.com",
      "media-src 'self' blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
] as const;

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  /**
   * Strict Cache-Control Policy.
   *
   * Protection Rules:
   * 1. All API endpoints (/api/*) are strictly no-store, private.
   * 2. All authenticated healthcare dashboard routes (/dashboard, /inbox, /patients,
   *    /appointments, /doctors, /settings, /admin, etc.) are strictly private, no-store
   *    to prevent public CDN/edge proxies from caching patient PHI or doctor schedules.
   * 3. Only public marketing and legal pages (/, /privacy, /terms, /refund) permit
   *    short edge revalidation.
   */
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source:
          '/:path(dashboard|inbox|contacts|patients|appointments|bookings|doctors|departments|lab-reports|settings|admin|pipelines|broadcasts|automations)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source:
          '/:path(dashboard|inbox|contacts|patients|appointments|bookings|doctors|departments|lab-reports|settings|admin|pipelines|broadcasts|automations)/:rest*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
