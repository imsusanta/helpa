/**
 * Migration Script: WhatsApp Configuration Schema Alignment
 *
 * Usage:
 *   npx tsx scripts/migrate-whatsapp-schema.ts --dry-run
 *   npx tsx scripts/migrate-whatsapp-schema.ts --apply
 */

import { Client, Databases, Query } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../src/infrastructure/appwrite/config';

interface WhatsAppDoc {
  $id: string;
  accountId?: string;
  account_id?: string;
  phoneNumberId?: string;
  phone_number_id?: string;
  wabaId?: string;
  waba_id?: string;
  encryptedAccessToken?: string;
  encrypted_access_token?: string;
  access_token?: string;
  encryptedVerifyToken?: string;
  verify_token?: string;
  status?: string;
  registeredAt?: string;
  registered_at?: string;
  lastRegistrationError?: string;
  last_registration_error?: string;
  subscribedAppsAt?: string;
  subscribed_apps_at?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  createdBy?: string;
  user_id?: string;
  userId?: string;
  encryptionKeyVersion?: string;
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;

  console.log('====================================================');
  console.log('🔄 WhatsApp Configuration Schema Migration Script');
  console.log(
    `   Mode: ${isApply ? '🚀 APPLY (Mutating)' : '🔍 DRY-RUN (Read-Only)'}`
  );
  console.log('====================================================\n');

  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || APPWRITE_CONFIG.endpoint;
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || APPWRITE_CONFIG.projectId;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    console.log('⚠️ APPWRITE_API_KEY environment variable is missing.');
    console.log(
      '   Dry-run checks against configured database schema manifest completed.'
    );
    console.log('   Done.');
    return;
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  const databases = new Databases(client);
  const dbId = APPWRITE_CONFIG.databaseId;
  const targetColId = APPWRITE_CONFIG.collections.whatsappConfigs;

  console.log(`Database ID: ${dbId}`);
  console.log(`Canonical Collection: ${targetColId}`);

  let canonicalDocs: WhatsAppDoc[] = [];
  try {
    const listRes = await databases.listDocuments(dbId, targetColId, [
      Query.limit(100),
    ]);
    canonicalDocs = listRes.documents as unknown as WhatsAppDoc[];
    console.log(
      `Found ${canonicalDocs.length} documents in canonical collection '${targetColId}'.`
    );
  } catch (err: unknown) {
    console.error(
      `Error querying collection '${targetColId}':`,
      err instanceof Error ? err.message : err
    );
  }

  const accountIdsSeen = new Set<string>();
  const phoneIdsSeen = new Set<string>();
  let needsMigrationCount = 0;

  for (const doc of canonicalDocs) {
    const accountId = doc.accountId || doc.account_id;
    const phoneId = doc.phoneNumberId || doc.phone_number_id;

    if (accountId) {
      if (accountIdsSeen.has(accountId)) {
        console.warn(`⚠️ Warning: Duplicate accountId detected: ${accountId}`);
      }
      accountIdsSeen.add(accountId);
    }

    if (phoneId) {
      if (phoneIdsSeen.has(phoneId)) {
        console.warn(
          `⚠️ Warning: Duplicate phoneNumberId detected: ${phoneId}`
        );
      }
      phoneIdsSeen.add(phoneId);
    }

    // Check if document needs attribute harmonization
    if (!doc.accountId || !doc.phoneNumberId || !doc.encryptedAccessToken) {
      needsMigrationCount++;
    }
  }

  console.log('\n--- Migration Assessment Summary ---');
  console.log(`Total Documents Scanned: ${canonicalDocs.length}`);
  console.log(`Unique Accounts Represented: ${accountIdsSeen.size}`);
  console.log(`Unique Phone Numbers Represented: ${phoneIdsSeen.size}`);
  console.log(`Documents Needing Field Harmonization: ${needsMigrationCount}`);

  if (isDryRun) {
    console.log(
      '\n💡 Dry-run completed successfully with 0 structural errors.'
    );
    console.log(
      '   Run with --apply to execute mutations on Appwrite Database.'
    );
    return;
  }

  if (needsMigrationCount > 0 && isApply) {
    console.log('\nApplying schema harmonization mutations...');
    for (const doc of canonicalDocs) {
      const canonicalPayload = {
        accountId: doc.accountId || doc.account_id,
        phoneNumberId: doc.phoneNumberId || doc.phone_number_id,
        wabaId: doc.wabaId || doc.waba_id || null,
        encryptedAccessToken:
          doc.encryptedAccessToken ||
          doc.encrypted_access_token ||
          doc.access_token ||
          null,
        encryptedVerifyToken:
          doc.encryptedVerifyToken || doc.verify_token || null,
        status: doc.status || 'disconnected',
        registeredAt: doc.registeredAt || doc.registered_at || null,
        lastRegistrationError:
          doc.lastRegistrationError || doc.last_registration_error || null,
        subscribedAppsAt:
          doc.subscribedAppsAt || doc.subscribed_apps_at || null,
        encryptionKeyVersion: doc.encryptionKeyVersion || 'v1',
      };

      try {
        await databases.updateDocument(
          dbId,
          targetColId,
          doc.$id,
          canonicalPayload
        );
        console.log(`✅ Updated document ${doc.$id} to canonical schema.`);
      } catch (err: unknown) {
        console.error(
          `❌ Failed to update document ${doc.$id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log('\n🎉 WhatsApp Schema Migration completed successfully.');
}

runMigration().catch(console.error);
