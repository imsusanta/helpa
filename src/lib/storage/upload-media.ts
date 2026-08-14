import { getAppwriteClient } from '@/infrastructure/appwrite/client';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ID } from 'appwrite';

export const MEDIA_MAX_BYTES = 16 * 1024 * 1024;

export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const;

export function buildMediaPath(
  accountId: string,
  fileName: string,
  now: number = Date.now()
): string {
  const hasExt = /\.[^.]+$/.test(fileName);
  const ext = hasExt ? fileName.split('.').pop()!.toLowerCase() : 'bin';
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40) || 'file';
  return `account-${accountId}/${now}-${safeBase}.${ext}`;
}

export interface UploadAccountMediaResult {
  publicUrl: string;
  path: string;
}

export async function uploadAccountMedia(
  bucket: string,
  file: File
): Promise<UploadAccountMediaResult> {
  // 1. Try Supabase Storage first
  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = createSupabaseBrowserClient();
      const bucketName = bucket || 'chat-media';
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(data.path);

        return {
          publicUrl: publicUrlData.publicUrl,
          path: data.path,
        };
      }
    } catch {
      // Fallback to Appwrite
    }
  }

  // 2. Fallback to Appwrite Storage
  const { storage } = getAppwriteClient();
  const bucketId = APPWRITE_CONFIG.buckets.chatMedia || bucket;

  const uploaded = await storage.createFile(bucketId, ID.unique(), file);
  const fileUrl = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${bucketId}/files/${uploaded.$id}/view?project=${APPWRITE_CONFIG.projectId}`;

  return {
    publicUrl: fileUrl,
    path: uploaded.$id,
  };
}

export async function deleteAccountMedia(
  bucket: string,
  path: string
): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = createSupabaseBrowserClient();
      const bucketName = bucket || 'chat-media';
      await supabase.storage.from(bucketName).remove([path]);
      return;
    } catch {
      // Fallback to Appwrite
    }
  }

  try {
    const { storage } = getAppwriteClient();
    const bucketId = APPWRITE_CONFIG.buckets.chatMedia || bucket;
    await storage.deleteFile(bucketId, path);
  } catch {
    // best-effort
  }
}
