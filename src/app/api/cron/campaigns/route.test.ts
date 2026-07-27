import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * This route read `authorization` into a variable and never compared it, so it
 * was a fully open trigger for cross-tenant broadcast dispatch. It now ships
 * disabled behind ENABLE_CAMPAIGNS_CRON and, when enabled, requires
 * CRON_SECRET from a header.
 */

const h = vi.hoisted(() => ({
  state: { queried: 0 },
}));

vi.mock("@/lib/automations/admin-client", () => {
  const { state } = h;
  const b: Record<string, unknown> = {
    select: () => b,
    update: () => b,
    insert: () => b,
    eq: () => b,
    lte: () => b,
    then: (res: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(res),
  };
  return {
    supabaseAdmin: () => ({
      from: () => {
        state.queried += 1;
        return b;
      },
    }),
  };
});

vi.mock("@/lib/automations/meta-send", () => ({
  engineSendText: async () => ({ whatsapp_message_id: "wamid.1" }),
  engineSendDocument: async () => ({ whatsapp_message_id: "wamid.2" }),
}));

import { GET } from "./route";

const ORIGINAL = { ...process.env };
const SECRET = "correct-horse-battery-staple";

function req(headers: Record<string, string> = {}, search = "") {
  return new Request(`https://app.example.com/api/cron/campaigns${search}`, {
    headers,
  });
}

describe("GET /api/cron/campaigns", () => {
  beforeEach(() => {
    h.state.queried = 0;
    process.env.ENABLE_CAMPAIGNS_CRON = "true";
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  describe("kill switch", () => {
    it("returns 404 when the flag is unset", async () => {
      delete process.env.ENABLE_CAMPAIGNS_CRON;
      const res = await GET(req({ "x-cron-secret": SECRET }));
      expect(res.status).toBe(404);
    });

    it("runs no queries while disabled", async () => {
      delete process.env.ENABLE_CAMPAIGNS_CRON;
      await GET(req({ "x-cron-secret": SECRET }));
      expect(h.state.queried).toBe(0);
    });
  });

  describe("secret enforcement", () => {
    it("returns 503 when CRON_SECRET is not configured (never open)", async () => {
      delete process.env.CRON_SECRET;
      const res = await GET(req({ "x-cron-secret": "anything" }));
      expect(res.status).toBe(503);
      expect(h.state.queried).toBe(0);
    });

    it("returns 401 when the header is missing", async () => {
      const res = await GET(req());
      expect(res.status).toBe(401);
      expect(h.state.queried).toBe(0);
    });

    it("returns 401 for a wrong secret", async () => {
      const res = await GET(req({ "x-cron-secret": "wrong" }));
      expect(res.status).toBe(401);
    });

    it("returns 401 for a same-length wrong secret", async () => {
      const res = await GET(
        req({ "x-cron-secret": "x".repeat(SECRET.length) }),
      );
      expect(res.status).toBe(401);
    });

    it("does NOT accept the secret from the query string", async () => {
      // Query strings leak into access logs, history and Referer headers.
      const res = await GET(req({}, `?secret=${SECRET}`));
      expect(res.status).toBe(401);
    });

    it("does NOT accept the old authorization header", async () => {
      const res = await GET(req({ authorization: `Bearer ${SECRET}` }));
      expect(res.status).toBe(401);
    });

    it("proceeds past the guard with the correct header secret", async () => {
      const res = await GET(req({ "x-cron-secret": SECRET }));
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(404);
      expect(res.status).not.toBe(503);
    });
  });
});
