import type { IndustryModule } from './types';

const SHARED_WORKSPACE_ROUTES = [
  '/dashboard',
  '/inbox',
  '/follow-ups',
  '/appointments',
  '/booking-trip',
  '/leads',
  '/customers',
  '/pipelines',
  '/trip-proposals',
  '/packages',
  '/tour-packages',
  '/quotations',
  '/settings',
  '/broadcasts',
  '/campaign-reports',
  '/lead-forms',
  '/knowledge-base',
  '/chatbot',
  '/faq-bot',
  '/admin',
  '/billing',
  '/invoices',
  '/automations',
  '/integrations',
] as const;

function pathMatchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isIndustryRouteAllowed(
  manifest: IndustryModule,
  pathname: string
) {
  if (
    SHARED_WORKSPACE_ROUTES.some((route) => pathMatchesRoute(pathname, route))
  ) {
    return true;
  }

  if (!manifest.allowedRoutes || manifest.allowedRoutes.length === 0) {
    return true;
  }

  return manifest.allowedRoutes.some((route) =>
    pathMatchesRoute(pathname, route)
  );
}
