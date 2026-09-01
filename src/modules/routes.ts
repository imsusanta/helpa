import type { IndustryModule } from './types';

const SHARED_WORKSPACE_ROUTES = [
  '/dashboard',
  '/inbox',
  '/follow-ups',
  '/leads',
  '/customers',
  '/pipelines',
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

/**
 * Routes owned by an industry module must never be treated as shared routes.
 * Keep this registry beside the route gate so adding a feature cannot
 * accidentally expose it through the generic CRM navigation or guard.
 */
export const INDUSTRY_ROUTE_OWNERS = [
  {
    route: '/appointments',
    industries: ['hospital_clinic', 'salon', 'travel'],
  },
  { route: '/booking-trip', industries: ['travel'] },
  { route: '/trip-proposals', industries: ['travel'] },
  { route: '/packages', industries: ['travel'] },
  { route: '/tour-packages', industries: ['travel'] },
  { route: '/quotations', industries: ['travel'] },
] as const;

function pathMatchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isIndustryRouteAllowed(
  manifest: IndustryModule,
  pathname: string
) {
  const canonicalIndustry = manifest.id;
  const owner = INDUSTRY_ROUTE_OWNERS.find(({ route }) =>
    pathMatchesRoute(pathname, route)
  );
  if (owner)
    return (owner.industries as readonly string[]).includes(canonicalIndustry);

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
