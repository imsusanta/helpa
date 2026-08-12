import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { storageRepository } from '@/infrastructure/appwrite/repositories/storage.repository';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        { error: 'Avatar image must be under 5MB' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `avatar_${ctx.userId}_${Date.now()}.${ext}`;

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
  } catch (err) {
    return toErrorResponse(err);
  }
}
