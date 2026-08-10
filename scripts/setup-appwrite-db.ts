import { Client, Databases } from 'node-appwrite';

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!projectId || !apiKey) {
  console.error(
    'Error: NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY environment variables are required.'
  );
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);
const databases = new Databases(client);

async function setupAppwrite() {
  console.log('[Appwrite Setup] Initializing Database & Collections...');

  try {
    // 1. Create main Database
    const dbId = 'helpa_main';
    try {
      await databases.create(dbId, 'Helpa Main Database');
      console.log('✅ Created Database: helpa_main');
    } catch {
      console.log('ℹ Database helpa_main already exists.');
    }

    // 2. Collections & Attributes Definitions
    const collections = [
      { id: 'deals', name: 'Deals / Leads' },
      { id: 'contacts', name: 'Contacts & Patients' },
      { id: 'appointments', name: 'Appointments' },
      { id: 'calls', name: 'Voice Calls' },
      { id: 'lead_stage_history', name: 'Lead Stage History' },
      { id: 'clinic_integrations', name: 'Clinic Integrations' },
    ];

    for (const col of collections) {
      try {
        await databases.createCollection(dbId, col.id, col.name);
        console.log(`✅ Created Collection: ${col.name} (${col.id})`);
      } catch {
        console.log(`ℹ Collection ${col.id} already exists.`);
      }
    }

    console.log('[Appwrite Setup] Database schema creation complete!');
  } catch (err) {
    console.error('[Appwrite Setup] Error setup:', err);
  }
}

setupAppwrite();
