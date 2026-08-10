import { Client, Databases, Users, ID } from 'node-appwrite';
import { supabaseAdmin } from '../src/lib/automations/admin-client';

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://sgp.cloud.appwrite.io/v1';
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a79822b003adde92f63';
const apiKey =
  process.env.APPWRITE_API_KEY ||
  'standard_95784974917c87f02101954bf8fa40f5d4f6ac92d6e0230624a7792818adef2635d4faa049316bb8a90d9436b7a94f299304dd07f4f53bb6df25d7fadb63c4d44f50f981fcfb7e5b8c0232f5aae36a80399f3cf71beba0b85faf34faa078980e3e5668cfdb416fe5d283c41d170dcb870f87880f670e5dabeb5a2dbac350ba81';

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);
const databases = new Databases(client);
const users = new Users(client);

const DB_ID = 'helpa_main';

// Helper to sleep between attribute creations (Appwrite requires attribute indexing time)
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function ensureAttribute(
  collectionId: string,
  key: string,
  type: 'string' | 'integer' | 'boolean' | 'float',
  size: number = 255,
  required: boolean = false
) {
  try {
    if (type === 'string') {
      await databases.createStringAttribute(
        DB_ID,
        collectionId,
        key,
        size,
        required
      );
    } else if (type === 'integer') {
      await databases.createIntegerAttribute(
        DB_ID,
        collectionId,
        key,
        required
      );
    } else if (type === 'boolean') {
      await databases.createBooleanAttribute(
        DB_ID,
        collectionId,
        key,
        required
      );
    } else if (type === 'float') {
      await databases.createFloatAttribute(DB_ID, collectionId, key, required);
    }
    await sleep(200);
  } catch {
    // Attribute already exists
  }
}

async function migrateData() {
  console.log('🚀 Starting Full Migration from Supabase to Appwrite...');

  const db = supabaseAdmin();

  // 1. Migrate Accounts
  console.log('📦 Migrating Accounts...');
  const { data: accounts } = await db.from('accounts').select('*');
  if (accounts && accounts.length > 0) {
    await ensureAttribute('accounts', 'name', 'string', 255);
    await ensureAttribute('accounts', 'owner_user_id', 'string', 255);
    await ensureAttribute('accounts', 'industry', 'string', 255);
    await ensureAttribute('accounts', 'status', 'string', 255);

    for (const acc of accounts) {
      try {
        await databases.createDocument(
          DB_ID,
          'accounts',
          acc.id || ID.unique(),
          {
            name: acc.name || 'Clinic Account',
            owner_user_id: acc.owner_user_id || '',
            industry: acc.industry || 'healthcare',
            status: acc.status || 'active',
          }
        );
        console.log(`  ✓ Migrated Account: ${acc.name} (${acc.id})`);
      } catch {
        console.log(`  ℹ Account already exists in Appwrite: ${acc.id}`);
      }
    }
  }

  // 2. Migrate Users / Profiles & Appwrite Auth
  console.log('👥 Migrating Users & Profiles to Appwrite Auth...');
  const { data: profiles } = await db.from('profiles').select('*');
  if (profiles && profiles.length > 0) {
    for (const prof of profiles) {
      try {
        // Create user in Appwrite Auth
        await users.create(
          prof.user_id || ID.unique(),
          prof.email,
          undefined,
          'HelpaTempPassword2026!',
          prof.full_name
        );
        console.log(
          `  ✓ Created Appwrite Auth User: ${prof.email} (${prof.user_id})`
        );
      } catch {
        console.log(`  ℹ Appwrite Auth User already exists: ${prof.email}`);
      }
    }
  }

  // 3. Migrate Contacts
  console.log('📇 Migrating Contacts & Patients...');
  const { data: contacts } = await db.from('contacts').select('*');
  if (contacts && contacts.length > 0) {
    await ensureAttribute('contacts', 'account_id', 'string', 255);
    await ensureAttribute('contacts', 'name', 'string', 255);
    await ensureAttribute('contacts', 'phone', 'string', 255);
    await ensureAttribute('contacts', 'email', 'string', 255);

    for (const c of contacts) {
      try {
        await databases.createDocument(DB_ID, 'contacts', c.id || ID.unique(), {
          account_id: c.account_id || '',
          name: c.name || 'Patient',
          phone: c.phone || '',
          email: c.email || '',
        });
      } catch {
        // Already exists
      }
    }
    console.log(`  ✓ Migrated ${contacts.length} Contacts to Appwrite.`);
  }

  // 4. Migrate Deals / Leads
  console.log('📋 Migrating Deals & Leads (Kanban Board)...');
  const { data: deals } = await db.from('deals').select('*');
  if (deals && deals.length > 0) {
    await ensureAttribute('deals', 'account_id', 'string', 255);
    await ensureAttribute('deals', 'title', 'string', 255);
    await ensureAttribute('deals', 'stage', 'string', 255);
    await ensureAttribute('deals', 'contact_id', 'string', 255);
    await ensureAttribute('deals', 'ai_lead_score', 'string', 255);

    for (const d of deals) {
      try {
        await databases.createDocument(DB_ID, 'deals', d.id || ID.unique(), {
          account_id: d.account_id || '',
          title: d.title || 'Lead Inquiry',
          stage: d.stage || 'NEW',
          contact_id: d.contact_id || '',
          ai_lead_score: d.ai_lead_score || 'warm',
        });
      } catch {
        // Already exists
      }
    }
    console.log(`  ✓ Migrated ${deals.length} Deals/Leads to Appwrite.`);
  }

  // 5. Migrate Appointments
  console.log('📅 Migrating Appointments...');
  const { data: appts } = await db.from('appointments').select('*');
  if (appts && appts.length > 0) {
    await ensureAttribute('appointments', 'account_id', 'string', 255);
    await ensureAttribute('appointments', 'contact_id', 'string', 255);
    await ensureAttribute('appointments', 'appointment_date', 'string', 255);
    await ensureAttribute('appointments', 'status', 'string', 255);

    for (const a of appts) {
      try {
        await databases.createDocument(
          DB_ID,
          'appointments',
          a.id || ID.unique(),
          {
            account_id: a.account_id || '',
            contact_id: a.contact_id || '',
            appointment_date: a.appointment_date || '',
            status: a.status || 'confirmed',
          }
        );
      } catch {
        // Already exists
      }
    }
    console.log(`  ✓ Migrated ${appts.length} Appointments to Appwrite.`);
  }

  console.log('\n🎉 FULL MIGRATION TO APPWRITE COMPLETE!');
}

migrateData().catch((err) => console.error('Migration error:', err));
