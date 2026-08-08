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
  const { data: msgs, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", "2fbf3497-ef29-4bd9-aaa4-d996efa7bbdc")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Messages for conv:", JSON.stringify(msgs.map(m => ({
      id: m.id,
      sender_type: m.sender_type,
      content_text: m.content_text,
      created_at: m.created_at
    })), null, 2));
  }
}

run();
