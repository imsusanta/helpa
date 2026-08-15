import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  storageRepository,
  StorageError,
} from '@/infrastructure/appwrite/repositories/storage.repository';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

const MAX_AVATAR_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function POST(request: Request) {
  try {
    let authContext;
    try {
      authContext = await getCurrentAccount();
    } catch {
      return NextResponse.json(
        {
          code: 'AUTH_REQUIRED',
          error: 'Authentication is required to upload avatar',
        },
        { status: 401 }
      );
    }

    if (!authContext || !authContext.userId) {
      return NextResponse.json(
        {
          code: 'AUTH_REQUIRED',
          error: 'Authentication session invalid or missing user ID',
        },
        { status: 401 }
      );
    }

    if (!authContext.accountId) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_MEMBERSHIP_REQUIRED',
          error: 'Account membership is required to upload avatar',
        },
        { status: 403 }
      );
    }

    const { userId, accountId } = authContext;

    // Verify user belongs to the active account in the database
    const { getAdminClient: getSupabaseAdminClient } =
      await import('@/lib/supabase/server');
    const supabase = getSupabaseAdminClient();

    const { data: memberCheck } = await supabase
      .from('account_members')
      .select('id, role, active')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (!memberCheck) {
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (!profileCheck) {
        return NextResponse.json(
          {
            code: 'ACCOUNT_MEMBERSHIP_REQUIRED',
            error: 'User does not belong to the specified account',
          },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { code: 'FILE_REQUIRED', error: 'No image file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        {
          code: 'FILE_TOO_LARGE',
          error: 'Avatar image must be under 10MB',
        },
        { status: 400 }
      );
    }

    const mimeType = file.type?.toLowerCase() || 'image/png';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          code: 'FILE_TYPE_UNSUPPORTED',
          error:
            'Unsupported image format. Allowed formats: JPEG, PNG, WEBP, GIF.',
        },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
      ? ext
      : 'png';
    const filename = `avatar_${userId}_${Date.now()}.${safeExt}`;

    const { fileUrl } = await storageRepository.uploadFile(
      APPWRITE_CONFIG.buckets.avatars,
      fileBuffer,
      filename,
      mimeType,
      [
        `read("user:${userId}")`,
        `update("user:${userId}")`,
        `delete("user:${userId}")`,
      ]
    );

    // Update user profile in Supabase strictly scoped to userId and accountId
    const { error: supErr } = await supabase
      .from('profiles')
      .update({
        avatar_url: fileUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('account_id', accountId);

    if (supErr) {
      console.warn('[Avatar Upload] Profile update in Supabase error:', supErr);
    }

    return NextResponse.json({
      success: true,
      avatar_url: fileUrl,
    });
  } catch (err: unknown) {
    if (err instanceof StorageError) {
      return NextResponse.json(
        { code: err.code, error: err.message },
        { status: err.status }
      );
    }

    console.error('[Avatar Upload API Error]:', err);
    return NextResponse.json(
      {
        code: 'FILE_UPLOAD_FAILED',
        error:
          err instanceof Error
            ? err.message
            : 'Internal server error during avatar upload',
      },
      { status: 500 }
    );
  }
}
