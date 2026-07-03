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
  console.log("Listening for new inbound messages in the database...");
  const startTime = new Date().toISOString();

  let count = 0;
  const interval = setInterval(async () => {
    count++;
    if (count > 6) {
      clearInterval(interval);
      console.log("Polling finished.");
      return;
    }

    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_type, content_text, created_at")
      .gt("created_at", startTime)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
    } else if (msgs && msgs.length > 0) {
      console.log("NEW MESSAGES DETECTED:", JSON.stringify(msgs, null, 2));
    } else {
      console.log("No new messages yet... polling...");
    }
  }, 3000);
}

run();
