import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * GET /api/appointments/[id]/pdf — auth tests.
 *
 * The route must accept EITHER a valid staff session OR a valid patient
 * token. Never neither.
 */

const h = vi.hoisted(() => {
  const APPT_A = "11111111-1111-1111-1111-111111111111";
  const APPT_B = "22222222-2222-2222-2222-222222222222";
  const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ACCOUNT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  class UnauthorizedError extends Error {
    status = 401;
    constructor(m = "Unauthorized") {
      super(m);
      this.name = "UnauthorizedError";
    }
  }

  /** Rows keyed by `${accountId}:${apptId}` — the tenancy fixture. */
  const rows = new Map<string, Record<string, unknown>>();

  const makeRow = (id: string, accountId: string) => ({
    id,
    account_id: accountId,
    appointment_date: "2026-08-01",
    appointment_time: "10:00",
    token_number: 7,
    queue_position: 3,
    booking_id: "APT-2026-TEST1",
    notes: null,
    department: "Cardiology",
    patient: { id: "p1", name: "Test Patient", phone: "+911234567890", email: "p@example.com" },
    doctor: { id: "d1", name: "Strange", specialization: "Cardiology" },
  });

  rows.set(`${ACCOUNT_A}:${APPT_A}`, makeRow(APPT_A, ACCOUNT_A));
  rows.set(`${ACCOUNT_B}:${APPT_B}`, makeRow(APPT_B, ACCOUNT_B));

  /** Minimal Postgrest chain recording .eq() filters. */
  function makeDb() {
    return {
      from(table: string) {
        const filters: Record<string, string> = {};
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq(col: string, val: string) {
            filters[col] = val;
            return builder;
          },
          maybeSingle: async () => {
            if (table === "accounts") {
              return { data: { name: "Test Hospital" }, error: null };
            }
            const key = `${filters.account_id}:${filters.id}`;
            return { data: rows.get(key) ?? null, error: null };
          },
        };
        return builder;
      },
    };
  }

  let currentAccount: { accountId: string } | null = null;

  return {
    APPT_A,
    APPT_B,
    ACCOUNT_A,
    ACCOUNT_B,
    UnauthorizedError,
    makeDb,
    rows,
    setSession(accountId: string | null) {
      currentAccount = accountId ? { accountId } : null;
    },
    // Deliberately a plain function, not vi.fn(): the suite-level
    // `clearMocks` / `restoreAllMocks` would otherwise strip the
    // implementation and every session test would 401 for the wrong reason.
    getCurrentAccount: async () => {
      if (!currentAccount) throw new UnauthorizedError();
      return {
        accountId: currentAccount.accountId,
        userId: "u1",
        role: "agent",
        supabase: makeDb(),
        account: { id: currentAccount.accountId, name: "Test Hospital" },
      };
    },
    adminDb: () => makeDb(),
  };
});

const { APPT_A, APPT_B, ACCOUNT_A } = h;

vi.mock("@/lib/auth/account", () => ({
  getCurrentAccount: h.getCurrentAccount,
  UnauthorizedError: h.UnauthorizedError,
  toErrorResponse: (err: unknown) => {
    const status = (err as { status?: number })?.status ?? 500;
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: { "content-type": "application/json" },
    });
  },
}));

vi.mock("@/lib/supabase/scoped-admin", () => ({
  scopedAdmin: h.adminDb,
}));

// jsPDF / qrcode are heavy and irrelevant to auth — stub them.
vi.mock("jspdf", () => {
  // Every drawing call is a no-op; only `output` matters. A Proxy avoids the
  // stub drifting out of sync with the route's drawing calls.
  const handler = {
    get(_t: object, prop: string) {
      if (prop === "output") return () => new ArrayBuffer(8);
      return () => undefined;
    },
  };
  return {
    jsPDF: class {
      constructor() {
        return new Proxy({}, handler);
      }
    },
  };
});

vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,AAAA" },
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function req(url: string) {
  return new Request(url) as unknown as Parameters<
    Awaited<ReturnType<typeof loadRoute>>["GET"]
  >[0];
}

describe("GET /api/appointments/[id]/pdf", () => {
  beforeEach(() => {
    vi.stubEnv("PDF_SIGNING_KEY", "x".repeat(48));
    h.setSession(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects with no session and no token", async () => {
    const { GET } = await loadRoute();
    const res = await GET(req(`https://x.test/api/appointments/${APPT_A}/pdf`), {
      params: Promise.resolve({ id: APPT_A }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token with no session", async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      req(`https://x.test/api/appointments/${APPT_A}/pdf?t=not-a-token`),
      { params: Promise.resolve({ id: APPT_A }) },
    );
    expect(res.status).toBe(401);
  });

  it("allows a staff session for its own account", async () => {
    h.setSession(ACCOUNT_A);
    const { GET } = await loadRoute();
    const res = await GET(req(`https://x.test/api/appointments/${APPT_A}/pdf`), {
      params: Promise.resolve({ id: APPT_A }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("404s a staff session reaching for another account's appointment", async () => {
    h.setSession(ACCOUNT_A);
    const { GET } = await loadRoute();
    const res = await GET(req(`https://x.test/api/appointments/${APPT_B}/pdf`), {
      params: Promise.resolve({ id: APPT_B }),
    });
    expect(res.status).toBe(404);
  });

  it("allows a valid patient token with NO session", async () => {
    const { signAppointmentPdfToken } = await import("@/lib/security/signed-links");
    const token = signAppointmentPdfToken(APPT_A, ACCOUNT_A);
    const { GET } = await loadRoute();
    const res = await GET(
      req(`https://x.test/api/appointments/${APPT_A}/pdf?t=${token}`),
      { params: Promise.resolve({ id: APPT_A }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("rejects an expired token", async () => {
    const { signAppointmentPdfToken } = await import("@/lib/security/signed-links");
    const token = signAppointmentPdfToken(APPT_A, ACCOUNT_A);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    const { GET } = await loadRoute();
    const res = await GET(
      req(`https://x.test/api/appointments/${APPT_A}/pdf?t=${token}`),
      { params: Promise.resolve({ id: APPT_A }) },
    );
    vi.useRealTimers();
    expect(res.status).toBe(401);
  });

  it("rejects a token for appointment A presented on appointment B", async () => {
    const { signAppointmentPdfToken } = await import("@/lib/security/signed-links");
    const token = signAppointmentPdfToken(APPT_A, ACCOUNT_A);
    const { GET } = await loadRoute();
    const res = await GET(
      req(`https://x.test/api/appointments/${APPT_B}/pdf?t=${token}`),
      { params: Promise.resolve({ id: APPT_B }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects an account A token used against account B's appointment", async () => {
    // Signed for APPT_B but claiming ACCOUNT_A — the row lives under
    // ACCOUNT_B, so the scoped lookup must miss.
    const { signAppointmentPdfToken } = await import("@/lib/security/signed-links");
    const token = signAppointmentPdfToken(APPT_B, ACCOUNT_A);
    const { GET } = await loadRoute();
    const res = await GET(
      req(`https://x.test/api/appointments/${APPT_B}/pdf?t=${token}`),
      { params: Promise.resolve({ id: APPT_B }) },
    );
    expect([401, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it("does not log patient name, phone or email on token access", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
      logs.push(a.map(String).join(" "));
    });
    vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => {
      logs.push(a.map(String).join(" "));
    });

    const { signAppointmentPdfToken } = await import("@/lib/security/signed-links");
    const token = signAppointmentPdfToken(APPT_A, ACCOUNT_A);
    const { GET } = await loadRoute();
    await GET(req(`https://x.test/api/appointments/${APPT_A}/pdf?t=${token}`), {
      params: Promise.resolve({ id: APPT_A }),
    });

    const all = logs.join("\n");
    expect(all).not.toContain("Test Patient");
    expect(all).not.toContain("+911234567890");
    expect(all).not.toContain("p@example.com");
    // But it SHOULD record that a token access happened, with the id.
    expect(all).toContain(APPT_A);
  });
});
