import { getAdminClient } from '@/lib/supabase/server';

export type StorageErrorCode =
  | 'AUTH_REQUIRED'
  | 'ACCOUNT_MEMBERSHIP_REQUIRED'
  | 'STORAGE_BUCKET_NOT_CONFIGURED'
  | 'STORAGE_BUCKET_NOT_FOUND'
  | 'STORAGE_PERMISSION_DENIED'
  | 'FILE_TYPE_UNSUPPORTED'
  | 'FILE_TOO_LARGE'
  | 'FILE_UPLOAD_FAILED'
  | 'FILE_REFERENCE_PERSISTENCE_FAILED';

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageRepository {
  private get supabase() {
    return getAdminClient();
  }

  async verifyBucketExists(bucketId: string): Promise<void> {
    if (!bucketId) {
      throw new StorageError(
        'STORAGE_BUCKET_NOT_CONFIGURED',
        'Storage bucket ID is not configured.',
        500
      );
    }
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const exists = (buckets || []).some((b) => b.id === bucketId);
      if (!exists) {
        await this.supabase.storage.createBucket(bucketId, {
          public: true,
          fileSizeLimit: 20 * 1024 * 1024,
        });
      }
    } catch (err: unknown) {
      console.warn(
        `[StorageRepository] Auto-provision bucket '${bucketId}' notice:`,
        (err as Error).message
      );
    }
  }

  async uploadFile(
    bucketId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string = 'image/png',
    _permissions: string[] = []
  ): Promise<{ fileId: string; fileUrl: string }> {
    await this.verifyBucketExists(bucketId);
    try {
      const fileExt = filename.split('.').pop() || 'bin';
      const safeBaseName = filename
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 40);
      const filePath = `${Date.now()}-${safeBaseName}.${fileExt}`;
      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true,
        });
      if (error || !data) {
        throw new Error(error?.message || 'Supabase storage upload failed');
      }
      const { data: pubData } = this.supabase.storage
        .from(bucketId)
        .getPublicUrl(data.path);
      return { fileId: data.path, fileUrl: pubData.publicUrl };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown storage error';
      throw new StorageError(
        'FILE_UPLOAD_FAILED',
        `Failed to upload file to bucket '${bucketId}': ${message}`,
        500
      );
    }
  }

  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    if (!bucketId || !fileId) return;
    try {
      await this.supabase.storage.from(bucketId).remove([fileId]);
    } catch (err: unknown) {
      console.warn(
        `[StorageRepository] Warning deleting file ${fileId}:`,
        (err as Error).message
      );
    }
  }
}

export const storageRepository = new StorageRepository();
