import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Middleware page-gating tests.
 *
 * The rule is deny-by-default: anything that is not explicitly public and not
 * an /api/ path requires a session. These tests exist because the previous
 * allowlist silently left 27 dashboard routes open, and because a mistake in
 * the inverted logic would lock every user out instead.
 */

const h = vi.hoisted(() => ({
  state: { user: null as { id: string } | null },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: h.state.user }, error: null }),
    },
  }),
}));

import { middleware } from "./middleware";
import { NextRequest } from "next/server";

function req(pathname: string, search = "") {
  return new NextRequest(`https://app.example.com${pathname}${search}`);
}

const signedOut = () => {
  h.state.user = null;
};
const signedIn = () => {
  h.state.user = { id: "user-1" };
};

/** Location header, or null when the response is not a redirect. */
function redirectTarget(res: Response): string | null {
  if (res.status < 300 || res.status >= 400) return null;
  const loc = res.headers.get("location");
  return loc ? new URL(loc).pathname : null;
}

describe("middleware", () => {
  beforeEach(() => {
    h.state.user = null;
  });

  describe("signed out: dashboard pages redirect to /login", () => {
    // Every route group under src/app/(dashboard). The point of the inverted
    // logic is that this list needs no middleware change to stay covered.
    const dashboardRoutes = [
      "/dashboard",
      "/inbox",
      "/contacts",
      "/pipelines",
      "/broadcasts",
      "/automations",
      "/settings",
      // Previously UNPROTECTED — these are the regression cases.
      "/admin",
      "/admissions",
      "/agents",
      "/appointments",
      "/billing",
      "/bookings",
      "/classes",
      "/courses",
      "/customers",
      "/departments",
      "/doctors",
      "/knowledge-base",
      "/lab-reports",
      "/leads",
      "/members",
      "/memberships",
      "/orders",
      "/packages",
      "/patients",
      "/properties",
      "/reservations",
      "/site-visits",
      "/students",
      "/tables",
      "/teachers",
      "/trainers",
    ];

    it.each(dashboardRoutes)("%s redirects to /login", async (path) => {
      signedOut();
      const res = await middleware(req(path));
      expect(redirectTarget(res)).toBe("/login");
    });

    it("also protects nested sub-paths", async () => {
      signedOut();
      const res = await middleware(req("/patients/abc-123/history"));
      expect(redirectTarget(res)).toBe("/login");
    });

    it("preserves the intended destination", async () => {
      signedOut();
      const res = await middleware(req("/lab-reports"));
      const loc = new URL(res.headers.get("location")!);
      expect(loc.searchParams.get("redirectedFrom")).toBe("/lab-reports");
    });
  });

  describe("signed out: public paths stay reachable", () => {
    it.each([
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/privacy",
      "/terms",
      "/join/some-invite-token",
    ])("%s is not redirected", async (path) => {
      signedOut();
      const res = await middleware(req(path));
      expect(redirectTarget(res)).toBeNull();
    });
  });

  describe("signed out: API routes are not redirected", () => {
    // API routes must return their own JSON 401 rather than an HTML redirect,
    // otherwise fetch() callers get a login page with status 200.
    it.each([
      "/api/whatsapp/webhook",
      "/api/lab-reports/notify",
      "/api/appointments/notify",
      "/api/mcp",
      "/api/cron/campaigns",
    ])("%s is not redirected", async (path) => {
      signedOut();
      const res = await middleware(req(path));
      expect(redirectTarget(res)).not.toBe("/login");
    });
  });

  describe("signed in", () => {
    it.each(["/dashboard", "/admin", "/patients", "/lab-reports"])(
      "%s is allowed through",
      async (path) => {
        signedIn();
        const res = await middleware(req(path));
        expect(redirectTarget(res)).toBeNull();
      },
    );

    it.each(["/login", "/signup", "/forgot-password"])(
      "%s redirects to /dashboard",
      async (path) => {
        signedIn();
        const res = await middleware(req(path));
        expect(redirectTarget(res)).toBe("/dashboard");
      },
    );

    it("an invite link routes to /join/<token> instead of /dashboard", async () => {
      signedIn();
      const res = await middleware(req("/login", "?invite=tok-123"));
      expect(redirectTarget(res)).toBe("/join/tok-123");
    });
  });
});
