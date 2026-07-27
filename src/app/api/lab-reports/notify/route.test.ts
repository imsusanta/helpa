import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * These tests pin the authorization behaviour of the notify endpoint, which
 * previously accepted BOTH the report id and the account id from an
 * unauthenticated request body and looked the report up by id alone.
 */

// Everything referenced by a vi.mock factory must live in the hoisted block,
// including the error class, since vi.mock is lifted above module init.
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
      // What requireRole() should do.
      authed: null as { accountId: string } | null,
      authError: null as Error | null,
      // Filters applied to the hospital_lab_reports SELECT.
      reportFilters: [] as [string, unknown][],
      reportRow: null as Record<string, unknown> | null,
      sends: [] as string[],
    },
  };
});

vi.mock("@/lib/auth/account", async () => {
  const { NextResponse } = await import("next/server");
  const { state, UnauthorizedError } = h;
  return {
    UnauthorizedError,
    requireRole: async () => {
      if (state.authError) throw state.authError;
      return { accountId: state.authed!.accountId };
    },
    toErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: (err as Error).message },
        { status: (err as { status?: number }).status ?? 500 },
      ),
  };
});

vi.mock("@/lib/automations/admin-client", () => {
  const { state } = h;

  function builder(table: string, op: string) {
    const filters: [string, unknown][] = [];
    const b: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        if (table === "hospital_lab_reports" && op === "select") {
          state.reportFilters = filters;
        }
        return b;
      },
      select: () => b,
      single: () =>
        Promise.resolve(
          state.reportRow
            ? { data: state.reportRow, error: null }
            : { data: null, error: { message: "no rows" } },
        ),
      maybeSingle: () => Promise.resolve({ data: { id: "conv-1" }, error: null }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(res),
    };
    return b;
  }

  return {
    supabaseAdmin: () => ({
      from: (table: string) => ({
        select: () => builder(table, "select"),
        insert: () => builder(table, "insert"),
        update: () => builder(table, "update"),
      }),
    }),
  };
});

vi.mock("@/lib/automations/meta-send", () => {
  const { state } = h;
  return {
    engineSendText: async () => {
      state.sends.push("text");
      return { whatsapp_message_id: "wamid.1" };
    },
    engineSendDocument: async () => {
      state.sends.push("document");
      return { whatsapp_message_id: "wamid.2" };
    },
  };
});

import { POST } from "./route";

const ACCOUNT_A = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_B = "22222222-2222-2222-2222-222222222222";

function post(body: unknown) {
  return new Request("http://localhost/api/lab-reports/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/lab-reports/notify", () => {
  beforeEach(() => {
    h.state.authed = { accountId: ACCOUNT_A };
    h.state.authError = null;
    h.state.reportFilters = [];
    h.state.reportRow = null;
    h.state.sends = [];
  });

  it("rejects an unauthenticated request with 401", async () => {
    h.state.authError = new h.UnauthorizedError();
    const res = await POST(post({ reportId: "report-1" }));
    expect(res.status).toBe(401);
  });

  it("sends nothing when unauthenticated", async () => {
    h.state.authError = new h.UnauthorizedError();
    await POST(post({ reportId: "report-1", accountId: ACCOUNT_B }));
    expect(h.state.sends).toEqual([]);
  });

  it("scopes the report lookup to the SESSION account", async () => {
    h.state.reportRow = {
      id: "report-1",
      test_name: "CBC",
      patient: { id: "c1", name: "P", phone: "+911" },
    };
    await POST(post({ reportId: "report-1" }));
    expect(h.state.reportFilters).toEqual([
      ["id", "report-1"],
      ["account_id", ACCOUNT_A],
    ]);
  });

  it("IGNORES an accountId supplied in the body", async () => {
    // The core regression test: a caller authenticated as account A must not be
    // able to act on account B by putting B's id in the payload.
    h.state.reportRow = {
      id: "report-1",
      test_name: "CBC",
      patient: { id: "c1", name: "P", phone: "+911" },
    };
    await POST(post({ reportId: "report-1", accountId: ACCOUNT_B }));

    const accountFilters = h.state.reportFilters.filter(
      ([col]) => col === "account_id",
    );
    expect(accountFilters).toEqual([["account_id", ACCOUNT_A]]);
    expect(JSON.stringify(h.state.reportFilters)).not.toContain(ACCOUNT_B);
  });

  it("returns 404 for a report owned by another account", async () => {
    h.state.reportRow = null; // invisible under the session's account filter
    const res = await POST(post({ reportId: "report-of-account-b" }));
    expect(res.status).toBe(404);
    expect(h.state.sends).toEqual([]);
  });

  it("rejects a missing reportId with 400", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  it("rejects a non-string reportId with 400", async () => {
    const res = await POST(post({ reportId: { $ne: null } }));
    expect(res.status).toBe(400);
  });

  it("does not leak internal error text on failure", async () => {
    h.state.reportRow = { id: "report-1", test_name: "CBC", patient: null };
    const res = await POST(post({ reportId: "report-1" }));
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/at \/|node_modules|supabase/i);
  });
});
