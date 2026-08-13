import { ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

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
  private get storage() {
    return getAppwriteAdminClient().storage;
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
      await this.storage.getBucket(bucketId);
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 404 || String(err).includes('404')) {
        throw new StorageError(
          'STORAGE_BUCKET_NOT_FOUND',
          `Storage bucket '${bucketId}' does not exist on Appwrite backend. Run schema setup scripts.`,
          500
        );
      }
      if (code === 401 || code === 403) {
        throw new StorageError(
          'STORAGE_PERMISSION_DENIED',
          `Permission denied when accessing bucket '${bucketId}'. Check API key scopes.`,
          403
        );
      }
      throw new StorageError(
        'FILE_UPLOAD_FAILED',
        `Failed to verify storage bucket '${bucketId}': ${(err as Error).message}`,
        500
      );
    }
  }

  async uploadFile(
    bucketId: string,
    fileBuffer: Buffer,
    filename: string,
    _mimeType: string = 'image/png',
    permissions: string[] = []
  ): Promise<{ fileId: string; fileUrl: string }> {
    await this.verifyBucketExists(bucketId);

    try {
      const inputFile = InputFile.fromBuffer(fileBuffer, filename);
      const result = await this.storage.createFile(
        bucketId,
        ID.unique(),
        inputFile,
        permissions.length > 0 ? permissions : undefined
      );

      const fileUrl = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${bucketId}/files/${result.$id}/view?project=${APPWRITE_CONFIG.projectId}`;
      return { fileId: result.$id, fileUrl };
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
      await this.storage.deleteFile(bucketId, fileId);
    } catch (err: unknown) {
      console.warn(
        `[StorageRepository] Warning deleting file ${fileId} from bucket ${bucketId}:`,
        (err as Error).message
      );
    }
  }
}

export const storageRepository = new StorageRepository();
