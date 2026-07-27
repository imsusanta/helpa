import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived signed links for documents we message to patients.
 *
 * Patients have no session, so a WhatsApp-delivered link cannot be gated on
 * one. Before this existed the appointment PDF route was fully public and the
 * appointment UUID was the only secret — anyone holding or guessing it got the
 * patient's name, phone, email, doctor and visit time.
 *
 * A token is an HMAC-SHA256 over `route:resourceId:accountId:expiresAt`, so it
 * is bound to one route, one resource, one tenant and one time window. There
 * are deliberately no wildcards: a token that verifies for appointment A is
 * rejected on appointment B.
 *
 * KEY CHOICE — deliberate, do not "simplify" this:
 * this uses its own PDF_SIGNING_KEY rather than reusing ENCRYPTION_KEY.
 * ENCRYPTION_KEY protects stored WhatsApp access tokens; rotating it is an
 * operational event that already invalidates those. If link signing shared the
 * key, that rotation would silently break every appointment link already
 * delivered to a patient's phone. Separate concerns, separate keys, separate
 * rotation schedules.
 */

/** Namespaces the payload so a token can never be replayed on another route. */
const APPOINTMENT_PDF_ROUTE = "appointment-pdf";

/** 7 days, per product decision — long enough to survive a delayed read. */
export const APPOINTMENT_PDF_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Minimum key length. Not a cryptographic requirement of HMAC (which accepts
 * any length) but a guard against someone setting PDF_SIGNING_KEY=secret and
 * believing the links are protected.
 */
const MIN_KEY_LENGTH = 32;

/**
 * Read and validate the signing key at module load. Throwing here means a
 * misconfigured deployment fails at boot rather than silently issuing tokens
 * nobody can verify — or, worse, verifying tokens signed with a guessable key.
 */
function loadSigningKey(): string {
  const key = process.env.PDF_SIGNING_KEY?.trim();
  if (!key) {
    throw new Error(
      "PDF_SIGNING_KEY is not set. It is required to sign patient document " +
        "links. Generate one with `openssl rand -hex 32`. Do not reuse " +
        "ENCRYPTION_KEY — rotating that key would break already-delivered " +
        "patient links.",
    );
  }
  if (key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `PDF_SIGNING_KEY must be at least ${MIN_KEY_LENGTH} characters ` +
        `(got ${key.length}). Generate one with \`openssl rand -hex 32\`.`,
    );
  }
  return key;
}

const SIGNING_KEY = loadSigningKey();

function sign(payload: string): string {
  return createHmac("sha256", SIGNING_KEY).update(payload).digest("base64url");
}

function buildPayload(
  route: string,
  resourceId: string,
  accountId: string,
  expiresAt: number,
): string {
  return `${route}:${resourceId}:${accountId}:${expiresAt}`;
}

/** Constant-time compare that tolerates length mismatch without throwing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type VerifyFailureReason =
  | "malformed"
  | "bad_signature"
  | "expired"
  | "wrong_resource";

export type VerifyResult =
  | { valid: true; accountId: string; expiresAt: number }
  | { valid: false; reason: VerifyFailureReason };

/**
 * Issue a token for one appointment PDF, scoped to the owning account.
 *
 * `accountId` is baked into the signature so the reader cannot choose which
 * tenant to read as — the route uses the signed value, never a caller-supplied
 * one.
 */
export function signAppointmentPdfToken(
  appointmentId: string,
  accountId: string,
  ttlMs: number = APPOINTMENT_PDF_TTL_MS,
): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = buildPayload(
    APPOINTMENT_PDF_ROUTE,
    appointmentId,
    accountId,
    expiresAt,
  );
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(payload)}`;
}

/**
 * Verify a token against the appointment actually being requested.
 *
 * Order matters: the signature is checked BEFORE the payload is trusted for
 * anything, so an attacker cannot extend their own expiry or swap the account
 * id and have those values honoured.
 */
export function verifyAppointmentPdfToken(
  token: string,
  appointmentId: string,
): VerifyResult {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: "malformed" };
  }

  const [encoded, providedSig] = parts;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (!payload) return { valid: false, reason: "malformed" };

  // Signature first — nothing in the payload is trusted until this passes.
  if (!safeEqual(providedSig, sign(payload))) {
    return { valid: false, reason: "bad_signature" };
  }

  // `accountId` is a UUID and the route name is fixed, so splitting on ":" is
  // unambiguous: exactly 4 fields.
  const fields = payload.split(":");
  if (fields.length !== 4) return { valid: false, reason: "malformed" };

  const [route, signedResourceId, signedAccountId, expRaw] = fields;

  if (route !== APPOINTMENT_PDF_ROUTE) {
    return { valid: false, reason: "wrong_resource" };
  }

  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt)) {
    return { valid: false, reason: "malformed" };
  }

  // Bound to exactly one appointment. No wildcards, no prefix matching.
  if (!signedResourceId || signedResourceId !== appointmentId) {
    return { valid: false, reason: "wrong_resource" };
  }

  if (!signedAccountId) return { valid: false, reason: "malformed" };

  // Expiry is enforced here, server-side, from the signed payload — never from
  // a query parameter the holder controls.
  if (Date.now() > expiresAt) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, accountId: signedAccountId, expiresAt };
}

/**
 * Public base URL for patient-facing links. Falls back to the production host
 * that was previously hardcoded at each call site.
 */
function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://helpa.studio"
  );
}

/** Build the full patient-facing appointment PDF URL, token included. */
export function buildAppointmentPdfUrl(
  appointmentId: string,
  accountId: string,
  ttlMs: number = APPOINTMENT_PDF_TTL_MS,
): string {
  const token = signAppointmentPdfToken(appointmentId, accountId, ttlMs);
  return `${siteUrl()}/api/appointments/${appointmentId}/pdf?t=${token}`;
}

/** Test-only: read the expiry out of a token without verifying it. */
export function __peekExpiryForTests(token: string): number {
  const payload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
  return Number(payload.split(":")[3]);
}
