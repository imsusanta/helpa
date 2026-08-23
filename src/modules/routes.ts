import type { IndustryModule } from './types';

const SHARED_WORKSPACE_ROUTES = [
  '/dashboard',
  '/inbox',
  '/settings',
  '/broadcasts',
  '/campaign-reports',
  '/lead-forms',
  '/knowledge-base',
  '/chatbot',
  '/faq-bot',
  '/ai-assistant',
  '/admin',
  '/billing',
  '/automations',
  '/integrations',
  '/pipelines',
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
