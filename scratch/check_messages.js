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
  const { data: convs, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (convErr) {
    console.error("Conversations error:", convErr);
  } else {
    console.log("Recent Conversations:", JSON.stringify(convs, null, 2));
  }

  const { data: msgs, error: msgErr } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, content_text, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (msgErr) {
    console.error("Messages error:", msgErr);
  } else {
    console.log("Recent Messages:", JSON.stringify(msgs, null, 2));
  }
}

run();
