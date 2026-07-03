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
  const { data: configs, error: configErr } = await supabase.from("whatsapp_config").select("*");
  if (configErr) {
    console.error("Configs error:", configErr);
  } else {
    // Decrypt or print safely
    console.log("Configs:", JSON.stringify(configs.map(c => ({
      id: c.id,
      phone_number_id: c.phone_number_id,
      business_account_id: c.business_account_id,
      has_verify_token: !!c.verify_token,
      has_access_token: !!c.access_token,
    })), null, 2));
  }
}

run();
