/**
 * Seed demo tour packages for the Travel workplace.
 *
 * Idempotent: re-running skips packages whose name already exists for the
 * account. Safe for production — creates clearly-labelled demo rows only.
 *
 * Usage:
 *   node scripts/seed-demo-tour-packages.mjs <ACCOUNT_ID>
 *   node scripts/seed-demo-tour-packages.mjs            # uses the first account
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or the standard
 * NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY pair) in env.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY_FALLBACK;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✗ Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (never commit them).'
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DEMO_PACKAGES = [
  {
    name: 'Kashmir Delight 5D4N',
    destination: 'Srinagar, Kashmir',
    package_type: 'domestic',
    category: 'Honeymoon',
    duration_days: 5,
    duration_nights: 4,
    starting_price: 27999,
    currency: 'INR',
    status: 'active',
    description:
      'Srinagar houseboat stay, Gulmarg gondola, Pahalgam valley day-trip. Breakfast + dinner included.',
    booking_notes: 'Confirm with ₹5,000 advance per guest.',
    featured: true,
  },
  {
    name: 'Golden Triangle 4D3N',
    destination: 'Delhi–Agra–Jaipur',
    package_type: 'domestic',
    category: 'Heritage',
    duration_days: 4,
    duration_nights: 3,
    starting_price: 18999,
    currency: 'INR',
    status: 'active',
    description:
      'Taj Mahal sunrise, Agra Fort, Amber Fort with private AC cab and 3-star hotels.',
    booking_notes: 'Full payment 7 days before departure.',
  },
  {
    name: 'Andaman Honeymoon 6D5N',
    destination: 'Port Blair, Havelock',
    package_type: 'domestic',
    category: 'Beach',
    duration_days: 6,
    duration_nights: 5,
    starting_price: 42999,
    currency: 'INR',
    status: 'active',
    description:
      'Radhanagar sunset, scuba intro at Elephant Beach, candle-light dinner, private ferry transfers.',
    booking_notes: 'Advance ₹10,000; balance before travel date.',
  },
  {
    name: 'Dubai Explorer 5D4N',
    destination: 'Dubai, UAE',
    package_type: 'international',
    category: 'Luxury',
    duration_days: 5,
    duration_nights: 4,
    starting_price: 89999,
    currency: 'INR',
    status: 'active',
    description:
      'Burj Khalifa 124th floor, desert safari with BBQ, dhow cruise, visa assistance included.',
    booking_notes: 'Passport required with 6-month validity.',
  },
  {
    name: 'Darjeeling–Gangtok 5D4N',
    destination: 'Darjeeling, Sikkim',
    package_type: 'domestic',
    category: 'Hill Station',
    duration_days: 5,
    duration_nights: 4,
    starting_price: 21999,
    currency: 'INR',
    status: 'active',
    description:
      'Tiger Hill sunrise, Tsomgo Lake, Baba Mandir, toy-train ride with mountain-view hotels.',
    booking_notes: 'Carry photo ID for Sikkim permits.',
  },
];

async function pickAccountId() {
  const argId = process.argv[2];
  if (argId) return argId;
  const { data, error } = await db.from('accounts').select('id').limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

const accountId = await pickAccountId();
if (!accountId) {
  console.error('✗ No account found. Pass ACCOUNT_ID: node scripts/seed-demo-tour-packages.mjs <id>');
  process.exit(1);
}
console.log(`Seeding demo tour packages for account ${accountId}...\n`);

let created = 0;
let skipped = 0;

for (const pkg of DEMO_PACKAGES) {
  const { data: existing } = await db
    .from('tour_packages')
    .select('id')
    .eq('account_id', accountId)
    .ilike('name', pkg.name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    console.log(`= skip (exists): ${pkg.name}`);
    skipped += 1;
    continue;
  }

  const { data, error } = await db
    .from('tour_packages')
    .insert({ ...pkg, account_id: accountId })
    .select('id, name')
    .single();

  if (error) {
    console.error(`✗ ${pkg.name}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`+ created ${data.name} (${data.id})`);
  created += 1;
}

console.log(`\nDone: ${created} created, ${skipped} skipped.`);
console.log('Next: send a WhatsApp enquiry mentioning one of these packages to test the booking-confirm flow.');
