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
            ['read("any")'], // Public read permissions for media viewing
            false,
            true
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
    let targetBucket = bucketId;
    try {
      await this.ensureBucketExists(targetBucket);
    } catch {
      targetBucket = APPWRITE_CONFIG.buckets.chatMedia;
    }

    const inputFile = InputFile.fromBuffer(fileBuffer, filename);
    let result;
    try {
      result = await this.storage.createFile(
        targetBucket,
        ID.unique(),
        inputFile
      );
    } catch {
      // Fallback to chatMedia bucket if target bucket upload fails
      targetBucket = APPWRITE_CONFIG.buckets.chatMedia;
      await this.ensureBucketExists(targetBucket);
      result = await this.storage.createFile(
        targetBucket,
        ID.unique(),
        inputFile
      );
    }

    const fileUrl = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${targetBucket}/files/${result.$id}/view?project=${APPWRITE_CONFIG.projectId}`;
    return { fileId: result.$id, fileUrl };
  }

  async deleteFile(bucketId: string, fileId: string) {
    try {
      await this.storage.deleteFile(bucketId, fileId);
    } catch {
      /* safe fallback */
    }
  }
}

export const storageRepository = new StorageRepository();
