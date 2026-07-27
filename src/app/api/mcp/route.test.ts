import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * /api/mcp had no auth on either verb: GET minted a session for anyone and
 * POST drove every MCP tool (service-role backed, zero account_id filters)
 * for whoever held the session id. These tests pin both the kill switch and
 * the session-ownership check.
 */

const h = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    readonly status = 401 as const;
    constructor(message = "Unauthorized") {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  return {
    UnauthorizedError,
    state: {
      user: null as { userId: string; accountId: string } | null,
      connected: 0,
    },
  };
});

vi.mock("@/lib/auth/account", async () => {
  const { NextResponse } = await import("next/server");
  const { state, UnauthorizedError } = h;
  return {
    UnauthorizedError,
    getCurrentAccount: async () => {
      if (!state.user) throw new UnauthorizedError();
      return state.user;
    },
    toErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: (err as Error).message },
        { status: (err as { status?: number }).status ?? 500 },
      ),
  };
});

vi.mock("@modelcontextprotocol/sdk/server/sse.js", () => ({
  SSEServerTransport: class {
    sessionId = "session-fixed";
    async handlePostMessage() {
      /* no-op */
    }
  },
}));

vi.mock("@/mcp/server", () => {
  const { state } = h;
  return {
    createMcpServer: () => ({
      connect: async () => {
        state.connected += 1;
      },
    }),
  };
});

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

const ORIGINAL = { ...process.env };

function getReq() {
  return new NextRequest("https://app.example.com/api/mcp");
}
function postReq(sessionId?: string) {
  const url = sessionId
    ? `https://app.example.com/api/mcp?sessionId=${sessionId}`
    : "https://app.example.com/api/mcp";
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/mcp", () => {
  beforeEach(() => {
    h.state.user = null;
    h.state.connected = 0;
    process.env.ENABLE_MCP_SERVER = "true";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  describe("kill switch", () => {
    it.each([
      ["unset", undefined],
      ["false", "false"],
    ])("GET returns 404 when ENABLE_MCP_SERVER is %s", async (_l, value) => {
      if (value === undefined) delete process.env.ENABLE_MCP_SERVER;
      else process.env.ENABLE_MCP_SERVER = value;
      h.state.user = { userId: "u1", accountId: "a1" };
      const res = await GET(getReq());
      expect(res.status).toBe(404);
    });

    it("POST returns 404 when disabled", async () => {
      delete process.env.ENABLE_MCP_SERVER;
      h.state.user = { userId: "u1", accountId: "a1" };
      const res = await POST(postReq("session-fixed"));
      expect(res.status).toBe(404);
    });

    it("never connects a server while disabled", async () => {
      delete process.env.ENABLE_MCP_SERVER;
      h.state.user = { userId: "u1", accountId: "a1" };
      await GET(getReq());
      expect(h.state.connected).toBe(0);
    });
  });

  describe("authentication", () => {
    it("GET rejects an anonymous caller with 401", async () => {
      const res = await GET(getReq());
      expect(res.status).toBe(401);
    });

    it("GET opens no transport for an anonymous caller", async () => {
      await GET(getReq());
      expect(h.state.connected).toBe(0);
    });

    it("POST rejects an anonymous caller with 401", async () => {
      const res = await POST(postReq("session-fixed"));
      expect(res.status).toBe(401);
    });
  });

  describe("session ownership", () => {
    it("rejects a session opened by a different user", async () => {
      // User A opens the session. ReadableStream.start() runs eagerly on
      // construction, so the transport is registered without reading the body
      // (which would hang — an SSE stream never completes).
      h.state.user = { userId: "user-a", accountId: "acct-a" };
      const sse = await GET(getReq());
      expect(sse.status).toBe(200);
      await new Promise((r) => setTimeout(r, 0));

      // User B knows/guesses the id and tries to drive it.
      h.state.user = { userId: "user-b", accountId: "acct-b" };
      const res = await POST(postReq("session-fixed"));
      expect(res.status).toBe(401);
    });

    it("returns 401 (not 404) for an unknown session, so ids cannot be probed", async () => {
      h.state.user = { userId: "user-a", accountId: "acct-a" };
      const res = await POST(postReq("no-such-session"));
      expect(res.status).toBe(401);
    });

    it("requires a sessionId", async () => {
      h.state.user = { userId: "user-a", accountId: "acct-a" };
      const res = await POST(postReq());
      expect(res.status).toBe(400);
    });
  });
});
