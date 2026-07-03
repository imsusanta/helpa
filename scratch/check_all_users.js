const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const envPath = "/Users/susantalohar/Documents/wacrm/.env.local";
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    envVars[match[1]] = value;
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth list error:", authErr);
  } else {
    console.log("Auth Users:", JSON.stringify(authUsers.users.map(u => ({ id: u.id, email: u.email, metadata: u.user_metadata })), null, 2));
  }

  const { data: profiles, error: profErr } = await supabase.from("profiles").select("*");
  if (profErr) {
    console.error("Profiles error:", profErr);
  } else {
    console.log("Profiles:", JSON.stringify(profiles, null, 2));
  }
}

run();
