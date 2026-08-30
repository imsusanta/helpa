import type { IndustryModule } from './types';

const TRAVEL_ONLY_ROUTES = ['/tour-packages', '/packages'] as const;

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
    TRAVEL_ONLY_ROUTES.some((route) => pathMatchesRoute(pathname, route)) &&
    manifest.id !== 'travel'
  ) {
    return false;
  }

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
