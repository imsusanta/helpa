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
  const { data, error } = await supabase.from("contacts").select("*").limit(1);
  if (error) {
    console.error("Error fetching contact:", error);
  } else {
    console.log("Contact columns:", Object.keys(data[0] || {}));
  }
}

run();
