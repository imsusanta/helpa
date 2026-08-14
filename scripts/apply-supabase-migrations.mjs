import fs from 'fs';
import path from 'path';

const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ||
  process.env.SUPABASE_AUTH_TOKEN ||
  '';
const PROJECT_REF =
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ||
  'tmqlzsyqlprioeoowmtk';

async function executeSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `SQL Execution Error (HTTP ${res.status}): ${JSON.stringify(body)}`
    );
  }
  return body;
}

async function main() {
  console.log('🚀 Applying Supabase SQL Migrations...');
  const migrationsDir = path.join(
    process.cwd(),
    'docs',
    'legacy-postgres-migrations'
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  let successCount = 0;
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    process.stdout.write(`Applying ${file}... `);

    try {
      await executeSql(sql);
      console.log('✅ OK');
      successCount++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
    }
  }

  console.log(
    `\n🎉 Migrations complete: ${successCount}/${files.length} applied successfully.`
  );
}

main().catch(console.error);
