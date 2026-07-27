import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Signed patient links — security tests.
 *
 * These run RED against a missing/naive implementation and GREEN only once
 * the HMAC payload is bound to route + appointment id + account id + expiry.
 */

const APPT_A = "11111111-1111-1111-1111-111111111111";
const APPT_B = "22222222-2222-2222-2222-222222222222";
const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ROUTE = "appointment-pdf";

async function loadModule() {
  vi.resetModules();
  return import("./signed-links");
}

describe("signed-links", () => {
  beforeEach(() => {
    vi.stubEnv("PDF_SIGNING_KEY", "x".repeat(48));
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("boot-time key requirement", () => {
    it("throws when PDF_SIGNING_KEY is unset", async () => {
      vi.stubEnv("PDF_SIGNING_KEY", "");
      await expect(loadModule()).rejects.toThrow(/PDF_SIGNING_KEY/);
    });

    it("throws when PDF_SIGNING_KEY is too short to be a real secret", async () => {
      vi.stubEnv("PDF_SIGNING_KEY", "short");
      await expect(loadModule()).rejects.toThrow(/PDF_SIGNING_KEY/);
    });

    it("does NOT fall back to ENCRYPTION_KEY", async () => {
      // Rotating ENCRYPTION_KEY orphans stored WhatsApp tokens. It must not
      // also silently invalidate (or worse, keep validating) patient links.
      vi.stubEnv("PDF_SIGNING_KEY", "");
      vi.stubEnv("ENCRYPTION_KEY", "e".repeat(64));
      await expect(loadModule()).rejects.toThrow(/PDF_SIGNING_KEY/);
    });
  });

  describe("happy path", () => {
    it("a freshly issued token verifies for its own appointment", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const result = m.verifyAppointmentPdfToken(token, APPT_A);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.accountId).toBe(ACCOUNT_A);
    });

    it("issues a URL containing the token", async () => {
      const m = await loadModule();
      const url = m.buildAppointmentPdfUrl(APPT_A, ACCOUNT_A);
      expect(url).toContain(`/api/appointments/${APPT_A}/pdf`);
      expect(url).toMatch(/[?&]t=/);
    });

    it("defaults to a 7 day expiry", async () => {
      const m = await loadModule();
      const before = Date.now();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const exp = m.__peekExpiryForTests(token);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(exp).toBeGreaterThanOrEqual(before + sevenDays - 5_000);
      expect(exp).toBeLessThanOrEqual(before + sevenDays + 5_000);
    });
  });

  describe("expiry is enforced server-side from the signed payload", () => {
    it("rejects an expired token", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);

      // Travel past the 7 day window.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));

      const result = m.verifyAppointmentPdfToken(token, APPT_A);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("expired");
    });

    it("rejects a token whose expiry was extended by the holder", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const [payload, sig] = token.split(".");
      const decoded = Buffer.from(payload, "base64url").toString("utf8");
      const far = String(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const tampered = decoded.replace(/\d+$/, far);
      const forged =
        Buffer.from(tampered, "utf8").toString("base64url") + "." + sig;

      const result = m.verifyAppointmentPdfToken(forged, APPT_A);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("bad_signature");
    });
  });

  describe("tamper resistance", () => {
    it("rejects a tampered payload", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const [, sig] = token.split(".");
      const forged =
        Buffer.from(`${ROUTE}:${APPT_B}:${ACCOUNT_A}:${Date.now() + 1000}`)
          .toString("base64url") + "." + sig;
      const result = m.verifyAppointmentPdfToken(forged, APPT_B);
      expect(result.valid).toBe(false);
    });

    it("rejects a tampered signature", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const [payload, sig] = token.split(".");
      const flipped = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a");
      const result = m.verifyAppointmentPdfToken(`${payload}.${flipped}`, APPT_A);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("bad_signature");
    });

    it("rejects a signature of the wrong length without throwing", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const [payload] = token.split(".");
      const result = m.verifyAppointmentPdfToken(`${payload}.abc`, APPT_A);
      expect(result.valid).toBe(false);
    });

    it("rejects malformed and empty tokens without throwing", async () => {
      const m = await loadModule();
      for (const bad of ["", "...", "nodot", "a.b.c.d", "!!!.???"]) {
        expect(() => m.verifyAppointmentPdfToken(bad, APPT_A)).not.toThrow();
        expect(m.verifyAppointmentPdfToken(bad, APPT_A).valid).toBe(false);
      }
    });

    it("rejects a token signed with a different key", async () => {
      const m1 = await loadModule();
      const token = m1.signAppointmentPdfToken(APPT_A, ACCOUNT_A);

      vi.stubEnv("PDF_SIGNING_KEY", "y".repeat(48));
      const m2 = await loadModule();

      const result = m2.verifyAppointmentPdfToken(token, APPT_A);
      expect(result.valid).toBe(false);
    });
  });

  describe("the token is valid for exactly one appointment — no wildcards", () => {
    it("rejects a token for appointment A when presented on appointment B", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const result = m.verifyAppointmentPdfToken(token, APPT_B);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("wrong_resource");
    });

    it("rejects a wildcard appointment id", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken("*", ACCOUNT_A);
      expect(m.verifyAppointmentPdfToken(token, APPT_A).valid).toBe(false);
    });

    it("binds the token to its route — a token is not reusable elsewhere", async () => {
      const m = await loadModule();
      const token = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const decoded = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
      expect(decoded.startsWith(`${ROUTE}:`)).toBe(true);
    });
  });

  describe("cross-account", () => {
    it("carries the signed account id so the caller cannot choose one", async () => {
      const m = await loadModule();
      const tokenA = m.signAppointmentPdfToken(APPT_A, ACCOUNT_A);
      const tokenB = m.signAppointmentPdfToken(APPT_A, ACCOUNT_B);
      expect(tokenA).not.toBe(tokenB);

      const rA = m.verifyAppointmentPdfToken(tokenA, APPT_A);
      const rB = m.verifyAppointmentPdfToken(tokenB, APPT_A);
      expect(rA.valid && rA.accountId).toBe(ACCOUNT_A);
      expect(rB.valid && rB.accountId).toBe(ACCOUNT_B);
    });
  });
});
