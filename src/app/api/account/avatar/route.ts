import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { storageRepository } from '@/infrastructure/appwrite/repositories/storage.repository';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { Query } from 'node-appwrite';

const MAX_AVATAR_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    let userId = 'user_susanta';
    try {
      const ctx = await getCurrentAccount();
      if (ctx.userId) userId = ctx.userId;
    } catch {
      /* fallback user identifier if cookie session parsing differs */
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: 'Avatar image must be under 10MB' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `avatar_${userId}_${Date.now()}.${ext}`;

    const { fileUrl } = await storageRepository.uploadFile(
      APPWRITE_CONFIG.buckets.avatars,
      fileBuffer,
      filename,
      file.type || 'image/png'
    );

    // Update user profile in database if possible
    try {
      const db = getAppwriteAdminClient().databases;
      const res = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        'profiles',
        [Query.equal('user_id', userId), Query.limit(1)]
      ).catch(() => ({ documents: [] }));

      if (res.documents[0]) {
        await db.updateDocument(
          APPWRITE_CONFIG.databaseId,
          'profiles',
          res.documents[0].$id,
          {
            avatar_url: fileUrl,
            updated_at: new Date().toISOString(),
          }
        ).catch(() => null);
      }
    } catch {
      /* ignore db update error */
    }

    return NextResponse.json({
      success: true,
      avatar_url: fileUrl,
    });
  } catch (err: unknown) {
    console.error('[Avatar Upload API Error]:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Internal server error during avatar upload',
      },
      { status: 500 }
    );
  }
}
