import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const ALLOWED_BUCKETS = new Set([
  'chat-media',
  'flow-media',
  'avatars',
  'lab-reports',
  'medical-records',
  'voice-transcripts',
  'webhook-payloads',
  'pdf-tickets',
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId =
    request.headers.get('x-request-id') || crypto.randomUUID();
  try {
    const context = await requireRole('viewer');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawBucket = (formData.get('bucket') as string) || 'chat-media';
    const bucket = ALLOWED_BUCKETS.has(rawBucket) ? rawBucket : 'chat-media';

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided in upload request',
          requestId: correlationId,
        },
        {
          status: 400,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'File size exceeds maximum 20MB limit',
          requestId: correlationId,
        },
        {
          status: 400,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Ensure bucket exists in Supabase Storage
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = (buckets || []).some((b) => b.id === bucket);
      if (!exists) {
        await supabase.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 20 * 1024 * 1024,
        });
      }
    } catch {
      // Bucket check is best-effort
    }

    // Sanitize both parts of the user-controlled filename: the base name
    // AND the extension. Without the extension check a crafted name like
    // "x.pdf/../../evil" would smuggle path separators into the object key.
    const rawExt = file.name.split('.').pop() || 'bin';
    const fileExt = /^[a-zA-Z0-9]{1,10}$/.test(rawExt)
      ? rawExt.toLowerCase()
      : 'bin';
    const safeBaseName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40);
    const fileName = `account-${context.accountId}/${Date.now()}-${safeBaseName}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error(
        '[Upload API] Supabase storage upload failed:',
        uploadError
      );
      return NextResponse.json(
        {
          error: uploadError?.message || 'Storage upload failed',
          requestId: correlationId,
        },
        {
          status: 500,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    return NextResponse.json(
      {
        success: true,
        data: {
          publicUrl: publicUrlData.publicUrl,
          path: uploadData.path,
        },
        requestId: correlationId,
      },
      {
        status: 200,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (error) {
    console.error('[Upload API] Unexpected error:', error);
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const correlationId =
    request.headers.get('x-request-id') || crypto.randomUUID();
  try {
    const context = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || 'chat-media';
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'File path required for deletion', requestId: correlationId },
        {
          status: 400,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    // Deletion runs with the service-role client, so tenant scoping must
    // be enforced here: only allowlisted buckets and only objects under
    // the caller's own account prefix (the same prefix POST writes to).
    if (
      !ALLOWED_BUCKETS.has(bucket) ||
      !path.startsWith(`account-${context.accountId}/`)
    ) {
      return NextResponse.json(
        { error: 'File not found', requestId: correlationId },
        {
          status: 404,
          headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
        }
      );
    }

    const supabase = getSupabaseAdminClient();
    await supabase.storage.from(bucket).remove([path]);

    return NextResponse.json(
      { success: true, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    console.error('[Upload API] DELETE error:', error);
    return toErrorResponse(error);
  }
}
