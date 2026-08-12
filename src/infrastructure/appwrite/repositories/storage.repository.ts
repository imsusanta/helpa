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
      if (code === 404 || String(err).includes('404')) {
        try {
          // Create bucket via REST with public permissions
          await fetch(`${APPWRITE_CONFIG.endpoint}/storage/buckets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
              'X-Appwrite-Key': APPWRITE_CONFIG.apiKey,
            },
            body: JSON.stringify({
              bucketId,
              name: bucketId,
              permissions: ['read("any")'],
              fileSecurity: false,
              enabled: true,
              maximumFileSize: 30 * 1024 * 1024,
            }),
          });
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
    mimeType: string = 'image/png'
  ): Promise<{ fileId: string; fileUrl: string }> {
    let targetBucket = bucketId;

    try {
      await this.ensureBucketExists(targetBucket);
      const inputFile = InputFile.fromBuffer(fileBuffer, filename);
      const result = await this.storage.createFile(
        targetBucket,
        ID.unique(),
        inputFile
      );

      const fileUrl = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${targetBucket}/files/${result.$id}/view?project=${APPWRITE_CONFIG.projectId}`;
      return { fileId: result.$id, fileUrl };
    } catch {
      // Try fallback to chatMedia bucket
      try {
        targetBucket = APPWRITE_CONFIG.buckets.chatMedia;
        await this.ensureBucketExists(targetBucket);
        const inputFile = InputFile.fromBuffer(fileBuffer, filename);
        const result = await this.storage.createFile(
          targetBucket,
          ID.unique(),
          inputFile
        );

        const fileUrl = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${targetBucket}/files/${result.$id}/view?project=${APPWRITE_CONFIG.projectId}`;
        return { fileId: result.$id, fileUrl };
      } catch {
        // Base64 Data URL fallback if storage engine fails
        const base64 = fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return { fileId: `base64_${Date.now()}`, fileUrl: dataUrl };
      }
    }
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
