import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import {
  contactsRepository,
  type ContactDocument,
} from '@/infrastructure/appwrite/repositories/contacts.repository';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new Error('INVALID_PAGINATION');
  return Number(value);
}

function errorResponse(
  status: number,
  code: string,
  correlationId: string
): NextResponse {
  return NextResponse.json(
    { error: code, requestId: correlationId },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

function isSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /attribute|index|collection.*not found|invalid query/i.test(message);
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /unauthorized|permission|not authorized/i.test(message);
}

/**
 * Tenant-scoped contact list boundary. Account identity is resolved only from
 * the validated Appwrite session and server-side profile; query parameters
 * never select a tenant.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const limit = parsePositiveInteger(
      request.nextUrl.searchParams.get('limit'),
      DEFAULT_LIMIT
    );
    const offset = parsePositiveInteger(
      request.nextUrl.searchParams.get('offset'),
      0
    );
    if (limit < 1 || limit > MAX_LIMIT || offset < 0) {
      return errorResponse(400, 'INVALID_PAGINATION', correlationId);
    }
    const search = request.nextUrl.searchParams.get('search')?.trim();
    if (search && search.length > 100) {
      return errorResponse(400, 'INVALID_SEARCH', correlationId);
    }

    const context = await requireRole('viewer');
    const result = await contactsRepository.listContactsPage(
      context.accountId,
      {
        limit,
        offset,
        search: search || undefined,
      }
    );

    return NextResponse.json(
      {
        data: result.contacts.map((contact) => ({
          id: contact.$id,
          account_id: contact.accountId,
          user_id: (contact as AppwriteContactDocument).userId ?? '',
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          address: (contact as ContactDocumentWithOptionalFields).address,
          metadata: (contact as ContactDocumentWithOptionalFields).metadata,
          consentStatus: contact.consentStatus,
          created_at: (contact as AppwriteContactDocument).$createdAt,
          updated_at: (contact as AppwriteContactDocument).$updatedAt,
        })),
        total: result.total,
        limit,
        offset,
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    if (isSchemaError(error)) {
      return errorResponse(503, 'CONTACTS_SCHEMA_MISMATCH', correlationId);
    }
    if (isPermissionError(error)) {
      return errorResponse(403, 'CONTACTS_PERMISSION_DENIED', correlationId);
    }
    console.error(
      JSON.stringify({
        event: 'contacts_query_failed',
        requestId: correlationId,
      })
    );
    return errorResponse(502, 'CONTACTS_QUERY_FAILED', correlationId);
  }
}

type ContactDocumentWithOptionalFields = {
  address?: string;
  metadata?: Record<string, unknown>;
};

type AppwriteContactDocument = ContactDocument &
  ContactDocumentWithOptionalFields & {
    $createdAt: string;
    $updatedAt: string;
    userId?: string;
  };
