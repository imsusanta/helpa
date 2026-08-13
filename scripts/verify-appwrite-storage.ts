import { Client, Storage } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../src/infrastructure/appwrite/config';
import { REQUIRED_STORAGE_BUCKETS } from '../src/infrastructure/appwrite/storage-manifest';

async function verifyAppwriteStorage() {
  console.log('🔍 Verifying Appwrite Required Storage Buckets...');

  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || APPWRITE_CONFIG.endpoint;
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || APPWRITE_CONFIG.projectId;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    console.warn(
      '⚠️ APPWRITE_API_KEY is not set. Storage verification skipped.'
    );
    process.exit(0);
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  const storage = new Storage(client);

  const required = Object.values(REQUIRED_STORAGE_BUCKETS);
  let failed = 0;

  for (const bDef of required) {
    try {
      const bucket = await storage.getBucket(bDef.id);
      console.log(
        `✅ Verified Bucket '${bucket.$id}' ('${bucket.name}') — Enabled: ${bucket.enabled}, Public Read: ${bucket.$permissions?.includes('read("any")') ?? false}`
      );
    } catch (err: unknown) {
      console.error(
        `❌ Missing Required Storage Bucket '${bDef.id}' ('${bDef.name}'):`,
        (err as Error).message
      );
      failed++;
    }
  }

  if (failed > 0) {
    console.error(
      `❌ Storage Verification Failed: ${failed} bucket(s) missing.`
    );
    process.exit(1);
  }

  console.log(
    `🎉 All ${required.length} required storage buckets successfully verified.`
  );
}

verifyAppwriteStorage();
