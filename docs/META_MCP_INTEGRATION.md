# Meta Developer Tools MCP (Model Context Protocol) Setup Guide

Official Documentation: [https://developers.facebook.com/documentation/mcp/devtools-mcp](https://developers.facebook.com/documentation/mcp/devtools-mcp)

The **Meta Developer Tools MCP Server** connects AI assistants directly to the Meta Developer Platform, enabling management of Meta Apps, WhatsApp Business Accounts, Webhook Subscriptions, App Review compliance, and Graph API monitoring.

---

## 1. Project Configuration

We have configured `mcp.json` and `.mcp.json` at the root of the project:

```json
{
  "mcpServers": {
    "meta-devtools": {
      "url": "https://mcp.facebook.com/devtools",
      "description": "Official Meta Developer Tools MCP Server for Meta Apps, WhatsApp Business API, Webhooks, and App Review."
    }
  }
}
```

---

## 2. Client Setup Options

### Option A: Direct Remote MCP Connection (Recommended)
If your MCP client supports SSE remote transport, add `https://mcp.facebook.com/devtools` directly to your client config.

### Option B: Local Stdio Bridge (`mcp-remote`)
For MCP clients requiring local `stdio` process execution, use the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "meta-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.facebook.com/devtools"
      ]
    }
  }
}
```

---

## 3. Core Features & Capabilities

- **Meta App Inspection**: List Meta Apps, verify App ID, App Secret settings, and WhatsApp Business Account (WABA) links.
- **Webhook Topic Management**: Subscribe/unsubscribe to `messages`, `message_template_status_update`, or `leadgen` topics and trigger test webhooks.
- **App Review & Permissions**: Check permission requirements (`whatsapp_business_messaging`, `whatsapp_business_management`) and compliance submission status.
- **API Health & Limits**: Monitor Graph API rate limits, call volume, and version deprecations.
- **Documentation Search**: Search official Meta developer documentation directly from the AI prompt.
