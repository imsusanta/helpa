import { Client, Databases, Storage } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../src/infrastructure/appwrite/config';

async function setupAppwriteDatabase() {
  console.log('🚀 Starting Appwrite Database & Storage Setup...');

  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || APPWRITE_CONFIG.endpoint;
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || APPWRITE_CONFIG.projectId;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    console.warn(
      '⚠️ APPWRITE_API_KEY is not set. Setup script requires server API key to provision databases.'
    );
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

  // 1. Create Database if not existing
  try {
    await databases.get(databaseId);
    console.log(`✅ Database '${databaseId}' already exists.`);
  } catch {
    console.log(`📦 Creating Database '${databaseId}'...`);
    await databases.create(databaseId, databaseId);
    console.log(`✅ Database '${databaseId}' created.`);
  }

  // 2. Collections Setup
  const collections = Object.values(APPWRITE_CONFIG.collections);

  for (const collectionId of collections) {
    try {
      await databases.getCollection(databaseId, collectionId);
      console.log(`✅ Collection '${collectionId}' exists.`);
    } catch {
      console.log(`📄 Creating Collection '${collectionId}'...`);
      await databases.createCollection(
        databaseId,
        collectionId,
        collectionId,
        [
          'read("any")',
          'create("users")',
          'update("users")',
          'delete("users")',
        ],
        true,
        true
      );
      console.log(`✅ Collection '${collectionId}' created.`);
    }
  }

  // 3. Storage Buckets Setup
  const buckets = Object.values(APPWRITE_CONFIG.buckets);
  for (const bucketId of buckets) {
    try {
      await storage.getBucket(bucketId);
      console.log(`✅ Storage Bucket '${bucketId}' exists.`);
    } catch {
      console.log(`🪣 Creating Storage Bucket '${bucketId}'...`);
      await storage.createBucket(
        bucketId,
        bucketId,
        [
          'read("any")',
          'create("users")',
          'update("users")',
          'delete("users")',
        ],
        false,
        true,
        undefined,
        ['jpg', 'png', 'pdf', 'mp4', 'ogg', 'wav', 'json']
      );
      console.log(`✅ Storage Bucket '${bucketId}' created.`);
    }
  }

  console.log('🎉 Appwrite setup completed successfully.');
}

setupAppwriteDatabase().catch((err) => {
  console.error('❌ Appwrite database setup error:', err);
  process.exit(1);
});
