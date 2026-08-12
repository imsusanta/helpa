import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { storageRepository } from '@/infrastructure/appwrite/repositories/storage.repository';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

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
