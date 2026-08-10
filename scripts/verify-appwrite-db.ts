import { Client, Databases } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../src/infrastructure/appwrite/config';

async function verifyAppwriteDatabase() {
  console.log('🔍 Verifying Appwrite Database Configuration...');

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
  const databaseId =
    process.env.APPWRITE_DATABASE_ID || APPWRITE_CONFIG.databaseId;

  try {
    const db = await databases.get(databaseId);
    console.log(`✅ Verified Database ID: ${db.$id}`);

    const collections = Object.values(APPWRITE_CONFIG.collections);
    for (const col of collections) {
      await databases.getCollection(databaseId, col);
    }
    console.log(
      `✅ Verified ${collections.length} Appwrite collections successfully.`
    );
  } catch (err) {
    console.error('❌ Appwrite verification failed:', err);
    process.exit(1);
  }
}

verifyAppwriteDatabase();
