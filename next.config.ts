import type { NextConfig } from 'next';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getCommitSha(): string {
  if (process.env.APP_COMMIT_SHA) return process.env.APP_COMMIT_SHA;
  if (process.env.VERCEL_GIT_COMMIT_SHA)
    return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.SOURCE_VERSION) return process.env.SOURCE_VERSION;
  if (process.env.APPWRITE_GIT_COMMIT_SHA)
    return process.env.APPWRITE_GIT_COMMIT_SHA;
  if (process.env.NEXT_PUBLIC_APPWRITE_GIT_COMMIT_SHA)
    return process.env.NEXT_PUBLIC_APPWRITE_GIT_COMMIT_SHA;
  if (process.env.NEXT_PUBLIC_COMMIT_SHA)
    return process.env.NEXT_PUBLIC_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

const COMMIT_SHA = getCommitSha();
const BUILD_TIME = new Date().toISOString();

// Write build metadata during build
try {
  const buildInfoDir = path.join(process.cwd(), 'src', 'lib');
  if (fs.existsSync(buildInfoDir)) {
    fs.writeFileSync(
      path.join(buildInfoDir, 'build-info.json'),
      JSON.stringify(
        {
          commit: COMMIT_SHA || null,
          buildTime: BUILD_TIME,
          source: 'next.config.ts',
        },
        null,
        2
      )
    );
  }
} catch {
  // Ignore build file write errors
}

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
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://*.facebook.com https://*.facebook.net"
        : "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://*.facebook.com https://*.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.appwrite.io https://*.appwrite.network https://images.unsplash.com https://*.facebook.com https://*.fbcdn.net https://*.supabase.co",
      "media-src 'self' blob: https://*.appwrite.io https://*.appwrite.network https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.appwrite.io https://*.appwrite.network wss://*.appwrite.network https://openrouter.ai https://*.supabase.co wss://*.supabase.co https://*.facebook.com https://*.facebook.net https://graph.facebook.com",
      "frame-src 'self' https://*.facebook.com https://*.facebook.net https://web.facebook.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      'date-fns',
    ],
  },
  env: {
    APP_COMMIT_SHA: COMMIT_SHA,
    NEXT_PUBLIC_COMMIT_SHA: COMMIT_SHA,
    BUILD_TIME: BUILD_TIME,
  },
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
          '/:path(dashboard|inbox|contacts|patients|appointments|bookings|doctors|departments|lab-reports|settings|admin|pipelines|broadcasts|campaign-reports|automations|admissions|agents|billing|classes|courses|customers|follow-ups|knowledge-base|leads|lead-forms|members|memberships|orders|packages|properties|reservations|site-visits|students|tables|teachers|trainers)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source:
          '/:path(dashboard|inbox|contacts|patients|appointments|bookings|doctors|departments|lab-reports|settings|admin|pipelines|broadcasts|campaign-reports|automations|admissions|agents|billing|classes|courses|customers|follow-ups|knowledge-base|leads|lead-forms|members|memberships|orders|packages|properties|reservations|site-visits|students|tables|teachers|trainers)/:rest*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path(privacy|terms|refund|contact|login|signup)',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
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
