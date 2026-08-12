import { ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export class StorageRepository {
  private get storage() {
    return getAppwriteAdminClient().storage;
  }

  async ensureBucketExists(bucketId: string) {
    try {
      await this.storage.getBucket(bucketId);
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 404) {
        try {
          await this.storage.createBucket(
            bucketId,
            bucketId,
            [], // Private
            false,
            true,
            undefined,
            ['jpg', 'png', 'pdf', 'mp4', 'ogg', 'wav', 'json', 'txt']
          );
        } catch {
          // ignore creation race condition
        }
      }
    }
  }

  async uploadFile(
    bucketId: string,
    fileBuffer: Buffer,
    filename: string,
    _mimeType: string
  ) {
    await this.ensureBucketExists(bucketId);
    const inputFile = InputFile.fromBuffer(fileBuffer, filename);
    const result = await this.storage.createFile(
      bucketId,
      ID.unique(),
      inputFile
    );
    const fileUrl = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${bucketId}/files/${result.$id}/view?project=${APPWRITE_CONFIG.projectId}`;
    return { fileId: result.$id, fileUrl };
  }

  async deleteFile(bucketId: string, fileId: string) {
    await this.storage.deleteFile(bucketId, fileId);
  }
}

export const storageRepository = new StorageRepository();
