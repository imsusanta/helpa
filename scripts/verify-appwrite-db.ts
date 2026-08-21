import { Client, Databases, Storage } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../src/infrastructure/appwrite/config';
import { SCHEMA_MANIFEST, SCHEMA_VERSION } from './setup-appwrite-db';

async function verifyAppwriteDatabase() {
  console.log(
    `🔍 Verifying Appwrite Schema-as-Code Manifest (Version ${SCHEMA_VERSION})...`
  );

  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || APPWRITE_CONFIG.endpoint;
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || APPWRITE_CONFIG.projectId;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ APPWRITE_API_KEY is not set. Verification skipped.');
    process.exit(0);
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  const databases = new Databases(client);
  const storage = new Storage(client);
  const databaseId =
    process.env.APPWRITE_DATABASE_ID || APPWRITE_CONFIG.databaseId;

  try {
    const db = await databases.get(databaseId);
    console.log(`✅ Verified Database ID: ${db.$id}`);

    const collections = Object.values(APPWRITE_CONFIG.collections);
    let verifiedAttrs = 0;
    let verifiedIndexes = 0;

    for (const colId of collections) {
      const col = await databases.getCollection(databaseId, colId);
      const manifest = SCHEMA_MANIFEST[colId];

      // Check broad collection permissions
      const hasBroadUserAccess = col.$permissions?.some(
        (perm) => perm.includes('users') || perm.includes('role:all')
      );
      if (hasBroadUserAccess) {
        throw new Error(
          `SECURITY VIOLATION: Collection '${colId}' grants broad user/public collection-level access!`
        );
      }

      if (manifest) {
        const existingAttrs = new Map(col.attributes.map((a) => [a.key, a]));
        for (const attr of manifest.attributes) {
          const existing = existingAttrs.get(attr.key);
          if (!existing) {
            throw new Error(
              `Collection '${colId}' is missing required attribute '${attr.key}'`
            );
          }
          verifiedAttrs++;
        }

        const existingIndexes = new Map(
          col.indexes.map((idx) => [idx.key, idx])
        );
        for (const idx of manifest.indexes) {
          const existing = existingIndexes.get(idx.key);
          if (!existing) {
            throw new Error(
              `Collection '${colId}' is missing required index '${idx.key}'`
            );
          }
          if (idx.type === 'unique' && existing.type !== 'unique') {
            throw new Error(
              `Collection '${colId}' index '${idx.key}' MUST be unique!`
            );
          }
          verifiedIndexes++;
        }
      }
    }

    // Verify Storage Buckets
    const buckets = Object.values(APPWRITE_CONFIG.buckets);
    for (const bucketId of buckets) {
      const bucket = await storage.getBucket(bucketId);
      console.log(
        `✅ Verified Storage Bucket '${bucket.$id}' (Enabled: ${bucket.enabled})`
      );
    }

    console.log(
      `✅ Verified Schema v${SCHEMA_VERSION}: ${collections.length} collections, ${verifiedAttrs} attributes, and ${verifiedIndexes} indexes successfully.`
    );
  } catch (err) {
    console.error('❌ Appwrite schema verification failed:', err);
    process.exit(1);
  }
}

verifyAppwriteDatabase();
