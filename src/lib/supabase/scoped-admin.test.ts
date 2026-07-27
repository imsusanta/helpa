import { describe, it, expect, beforeEach, vi } from "vitest";

// Records every builder call so we can assert on the filters that were
// actually sent to Postgrest, rather than trusting the wrapper's intent.
const h = vi.hoisted(() => ({
  state: {
    calls: [] as {
      table: string;
      op: string;
      filters: [string, unknown][];
      payload?: unknown;
    }[],
    // Result handed back by the ownership-check query in assertOwns.
    ownedRow: null as { id: string } | null,
    ownedError: null as { message: string } | null,
  },
}));

vi.mock("@supabase/supabase-js", () => {
  const { state } = h;

  function makeBuilder(entry: {
    table: string;
    op: string;
    filters: [string, unknown][];
    payload?: unknown;
  }) {
    // Thenable so `await builder` and `.maybeSingle()` both resolve.
    const builder: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        entry.filters.push([col, val]);
        return builder;
      },
      maybeSingle: () =>
        Promise.resolve({ data: state.ownedRow, error: state.ownedError }),
      single: () =>
        Promise.resolve({ data: state.ownedRow, error: state.ownedError }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(res),
    };
    return builder;
  }

  function from(table: string) {
    const mk = (op: string, payload?: unknown) => {
      const entry = { table, op, filters: [] as [string, unknown][], payload };
      state.calls.push(entry);
      return makeBuilder(entry);
    };
    return {
      select: () => mk("select"),
      insert: (payload: unknown) => mk("insert", payload),
      upsert: (payload: unknown) => mk("upsert", payload),
      update: (payload: unknown) => mk("update", payload),
      delete: () => mk("delete"),
    };
  }

  return {
    createClient: () => ({ from, rpc: vi.fn() }),
  };
});

import {
  scopedAdmin,
  TenantScopeError,
  __resetScopedAdminForTests,
} from "./scoped-admin";

const ACCOUNT_A = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_B = "22222222-2222-2222-2222-222222222222";

// The wrapper reads these at first use; vitest.config.ts does not provide them.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const last = () => h.state.calls[h.state.calls.length - 1];

describe("scopedAdmin", () => {
  beforeEach(() => {
    h.state.calls = [];
    h.state.ownedRow = { id: "parent-1" };
    h.state.ownedError = null;
    __resetScopedAdminForTests();
  });

  describe("refuses to issue an unscoped client", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["empty string", ""],
      ["whitespace", "   "],
    ])("throws on %s accountId", (_label, value) => {
      expect(() => scopedAdmin(value as string | null | undefined)).toThrow(
        TenantScopeError,
      );
    });

    it("accepts a real account id", () => {
      expect(() => scopedAdmin(ACCOUNT_A)).not.toThrow();
    });
  });

  describe("account_id injection on the 44 scoped tables", () => {
    it("injects account_id on select", async () => {
      await scopedAdmin(ACCOUNT_A).from("appointments").select("*");
      expect(last().table).toBe("appointments");
      expect(last().filters).toEqual([["account_id", ACCOUNT_A]]);
    });

    it("injects account_id on update and delete", async () => {
      const db = scopedAdmin(ACCOUNT_A);
      await db.from("contacts").update({ name: "x" });
      expect(last().filters).toEqual([["account_id", ACCOUNT_A]]);
      await db.from("contacts").delete();
      expect(last().filters).toEqual([["account_id", ACCOUNT_A]]);
    });

    it("stamps account_id onto inserted rows", async () => {
      await scopedAdmin(ACCOUNT_A).from("patients").insert({ name: "x" });
      expect(last().payload).toEqual({ name: "x", account_id: ACCOUNT_A });
    });

    it("stamps account_id onto every row of a bulk insert", async () => {
      await scopedAdmin(ACCOUNT_A)
        .from("patients")
        .insert([{ n: 1 }, { n: 2 }]);
      expect(last().payload).toEqual([
        { n: 1, account_id: ACCOUNT_A },
        { n: 2, account_id: ACCOUNT_A },
      ]);
    });

    it("overrides a caller-supplied foreign account_id", async () => {
      // A hostile or buggy caller must not be able to write into account B.
      await scopedAdmin(ACCOUNT_A)
        .from("patients")
        .insert({ account_id: ACCOUNT_B });
      expect(last().payload).toEqual({ account_id: ACCOUNT_A });
    });

    it("keeps extra caller filters alongside the injected one", async () => {
      await scopedAdmin(ACCOUNT_A)
        .from("hospital_lab_reports")
        .select("*")
        .eq("id", "report-9");
      expect(last().filters).toEqual([
        ["account_id", ACCOUNT_A],
        ["id", "report-9"],
      ]);
    });

    it("scopes the accounts root table by id, not account_id", async () => {
      await scopedAdmin(ACCOUNT_A).from("accounts").select("*");
      expect(last().filters).toEqual([["id", ACCOUNT_A]]);
    });
  });

  describe("fails closed", () => {
    it("throws on an unknown table so new tables must be classified", () => {
      expect(() => scopedAdmin(ACCOUNT_A).from("doctors")).toThrow(
        /unknown table 'doctors'/,
      );
    });

    it("directs child tables to fromChild instead of scoping them wrongly", () => {
      expect(() => scopedAdmin(ACCOUNT_A).from("messages")).toThrow(
        /use fromChild/,
      );
    });

    it("directs global tables to fromGlobal", () => {
      expect(() => scopedAdmin(ACCOUNT_A).from("plans")).toThrow(
        /use fromGlobal/,
      );
    });

    it("does not let fromGlobal open a tenant table", () => {
      expect(() => scopedAdmin(ACCOUNT_A).fromGlobal("contacts")).toThrow(
        TenantScopeError,
      );
    });

    it("allows fromGlobal on the real cross-tenant tables", () => {
      expect(() => scopedAdmin(ACCOUNT_A).fromGlobal("plans")).not.toThrow();
    });
  });

  describe("fromChild proves tenancy through the parent", () => {
    it("checks parent ownership then pins the child to the parent fk", async () => {
      const db = scopedAdmin(ACCOUNT_A);
      const q = await db.fromChild("messages", "conversation_id", "conv-1");

      // The ownership probe must itself be account-scoped.
      const probe = h.state.calls[0];
      expect(probe.table).toBe("conversations");
      expect(probe.filters).toEqual([
        ["id", "conv-1"],
        ["account_id", ACCOUNT_A],
      ]);

      await q.select("*");
      expect(last().table).toBe("messages");
      expect(last().filters).toEqual([["conversation_id", "conv-1"]]);
    });

    it("rejects a parent row owned by another account", async () => {
      h.state.ownedRow = null; // parent not visible under ACCOUNT_A
      await expect(
        scopedAdmin(ACCOUNT_A).fromChild("messages", "conversation_id", "conv-b"),
      ).rejects.toThrow(/does not belong to the current account/);
    });

    it("rejects a fk column that does not reach an account-bearing parent", async () => {
      await expect(
        scopedAdmin(ACCOUNT_A).fromChild("messages", "id", "m-1"),
      ).rejects.toThrow(/not an account-bearing parent/);
    });

    it("rejects a table that is not a registered child", async () => {
      await expect(
        scopedAdmin(ACCOUNT_A).fromChild("contacts", "account_id", ACCOUNT_A),
      ).rejects.toThrow(/not a registered child table/);
    });
  });

  describe("assertOwns", () => {
    it("passes for a row in this account", async () => {
      await expect(
        scopedAdmin(ACCOUNT_A).assertOwns("appointments", "appt-1"),
      ).resolves.toBeUndefined();
      expect(last().filters).toEqual([
        ["id", "appt-1"],
        ["account_id", ACCOUNT_A],
      ]);
    });

    it("throws for a row in another account", async () => {
      h.state.ownedRow = null;
      await expect(
        scopedAdmin(ACCOUNT_A).assertOwns("appointments", "appt-b"),
      ).rejects.toThrow(TenantScopeError);
    });

    it("throws on an empty row id rather than matching everything", async () => {
      await expect(
        scopedAdmin(ACCOUNT_A).assertOwns("appointments", ""),
      ).rejects.toThrow(/empty row id/);
    });

    it("leaks no identifiers in the failure message", async () => {
      h.state.ownedRow = null;
      await expect(
        scopedAdmin(ACCOUNT_A).assertOwns("appointments", "appt-secret"),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining("appt-secret"),
        }) as Error,
      );
    });
  });

  it("exposes the pinned accountId", () => {
    expect(scopedAdmin(ACCOUNT_A).accountId).toBe(ACCOUNT_A);
  });
});
