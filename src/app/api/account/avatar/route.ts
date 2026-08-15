import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  storageRepository,
  StorageError,
} from '@/infrastructure/appwrite/repositories/storage.repository';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { Query } from 'node-appwrite';

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

    const { fileId, fileUrl } = await storageRepository.uploadFile(
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

    // Update user profile in Supabase & Appwrite database strictly scoped to userId and accountId
    try {
      await supabase
        .from('profiles')
        .update({
          avatar_url: fileUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('account_id', accountId);
    } catch {
      // Ignore Supabase update error
    }

    const db = getAppwriteAdminClient().databases;
    let profileDoc: Record<string, unknown> | null = null;
    let oldAvatarFileId: string | null = null;

    try {
      const res = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        'profiles',
        [
          Query.equal('user_id', userId),
          Query.equal('account_id', accountId),
          Query.limit(1),
        ]
      );
      profileDoc = res.documents[0] || null;

      const currentAvatarUrl = (profileDoc as { avatar_url?: string } | null)
        ?.avatar_url;
      if (currentAvatarUrl) {
        const matches = currentAvatarUrl.match(/\/files\/([^\/]+)\/view/);
        if (matches && matches[1]) {
          oldAvatarFileId = matches[1];
        }
      }

      if (profileDoc && (profileDoc as { $id?: string }).$id) {
        await db.updateDocument(
          APPWRITE_CONFIG.databaseId,
          'profiles',
          (profileDoc as { $id: string }).$id,
          {
            avatar_url: fileUrl,
            updated_at: new Date().toISOString(),
          }
        );
      }
    } catch {
      // Ignore Appwrite db error if Supabase is primary
    }

    // Clean up previous avatar file after successful commit
    if (oldAvatarFileId && oldAvatarFileId !== fileId) {
      await storageRepository.deleteFile(
        APPWRITE_CONFIG.buckets.avatars,
        oldAvatarFileId
      );
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
