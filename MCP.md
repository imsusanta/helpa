# wacrm Model Context Protocol (MCP) Server Guide

This repository includes a built-in **Model Context Protocol (MCP)** server, allowing AI assistants (Claude Desktop, Cursor, Antigravity, Windsurf, custom LLM agents) to directly interact with your WhatsApp CRM.

---

## ⚡ Quick Start

### Transport 1: Stdio (Local AI Clients: Claude Desktop, Cursor, Antigravity)

You can run the MCP server locally over standard input/output using `npm run mcp`:

```bash
npm run mcp
# or
npx tsx src/mcp/server.ts
```

#### Environment Variables Required

Ensure your `.env.local` contains:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key # or NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 📁 AI Client Configuration Files

### Claude Desktop Configuration (`mcp.json`)

Add the following entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wacrm": {
      "command": "npx",
      "args": ["-y", "tsx", "/Users/susantalohar/Documents/wacrm/src/mcp/server.ts"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY"
      }
    }
  }
}
```

### Cursor Configuration (`.cursor/mcp.json`)

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wacrm": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY"
      }
    }
  }
}
```

---

## 🚀 Transport 2: HTTP / SSE (Remote Agent Access)

When running the Next.js dev or production server (`npm run dev` or `npm run start`), the MCP Server is exposed at:

```
GET/POST http://localhost:3000/api/mcp
```

This endpoint supports Server-Sent Events (SSE) for remote AI agents or microservices.

---

## 🛠️ Available MCP Tools

| Tool Name | Description |
|---|---|
| **`contacts_list`** | Search/list CRM contacts by query (name, phone, email) or tag. |
| **`contacts_get`** | Get full contact details, tags, notes, and custom fields by ID or phone. |
| **`contacts_create`** | Add a new contact with tags and metadata. |
| **`contacts_update`** | Update contact name, email, company, or phone. |
| **`contacts_delete`** | Remove a contact by UUID. |
| **`tags_list`** | List all tags in the workspace. |
| **`whatsapp_list_chats`** | List active WhatsApp conversations and inbox state. |
| **`whatsapp_get_chat_history`** | Get full message history for a chat or contact phone. |
| **`whatsapp_send_message`** | Send a direct text message to a contact via WhatsApp. |
| **`whatsapp_send_template`** | Send an approved WhatsApp template message. |
| **`whatsapp_list_templates`** | List available message templates. |
| **`pipelines_list`** | List sales pipelines and their stages. |
| **`deals_list`** | List deals filtered by pipeline, stage, or contact. |
| **`deals_create`** | Create a new sales deal card. |
| **`deals_update_stage`** | Move a deal to another stage or change deal value/status. |
| **`broadcasts_list`** | List campaign broadcasts. |
| **`broadcasts_create`** | Create and schedule a broadcast campaign. |
| **`automations_list`** | List active no-code automations and triggers. |
| **`automations_toggle`** | Enable or disable an automation flow. |
| **`appointments_list`** | List booked appointments. |
| **`appointments_create`** | Schedule an appointment for a patient/contact. |
| **`appointments_update_status`** | Update appointment status (confirmed, completed, cancelled). |
| **`workspace_get_stats`** | Get summary metrics for the entire CRM workspace. |
