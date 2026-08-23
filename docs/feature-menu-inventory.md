# Authenticated Feature and Menu Inventory

This inventory records the routes intentionally exposed by the centralized
navigation policy. Database and API identifiers remain unchanged; labels are
resolved from the active workspace terminology.

| Menu placement | Route | Feature/status | Minimum role | Module/credentials |
| --- | --- | --- | --- | --- |
| Overview | `/dashboard` | Dashboard, `PARTIAL` (tenant metrics continue to be hardened) | viewer | Core |
| Patient Conversations | `/inbox` | Inbox, `PARTIAL` (provider delivery depends on WhatsApp setup) | viewer | Core + Meta credentials for sending |
| Patient Conversations | `/follow-ups` | Follow-ups, `PARTIAL` | agent | Core |
| Patient Conversations | `/appointments` | Appointments, `PARTIAL` (notification delivery is provider-gated) | agent | `hospital_clinic` |
| Patient CRM | `/leads` | Lead/patient inquiry board, `PARTIAL` | agent | Core |
| Patient CRM | `/customers` | Customer/person directory, `PARTIAL` | agent | Core |
| Patient CRM | `/pipelines` | Pipeline, `PARTIAL` | agent | Core |
| Patient CRM | `/quotations` | Quotations, `PARTIAL` | agent | Core |
| Marketing | `/broadcasts` | Campaigns, `PARTIAL` | admin | Core + Meta credentials |
| Marketing | `/campaign-reports` | Campaign Reports, `WORKING` with live reports API | viewer | Marketing module |
| Marketing | `/lead-forms` | Lead Forms, `PARTIAL` with live CRUD APIs | agent | Marketing module + public token configuration |
| WhatsApp | `/patients` | Hospital patient alias to `/contacts`, `PARTIAL` | viewer | Hospital/Clinic only |
| WhatsApp | `/broadcasts` | Campaigns, same canonical destination as Marketing | admin | Core + Meta credentials |
| WhatsApp | `/settings?tab=whatsapp` | WhatsApp API setup, `CREDENTIAL_GATED` | admin | Meta credentials |
| Automation & AI | `/chatbot` | Chatbot configuration, `PARTIAL` | admin | AI/provider configuration |
| Automation & AI | `/faq-bot` | FAQ Bot, `PARTIAL` | agent | AI configuration |
| Automation & AI | `/ai-assistant` | AI Assistant tools, `PARTIAL` | agent | AI provider configuration |
| Automation & AI | `/automations` | Automations, `PARTIAL` | agent | Automation module |
| Automation & AI | `/knowledge-base` | Knowledge Base, `PARTIAL` | agent | Core |
| Billing | `/invoices` | Invoices, `PARTIAL` | agent | Core; payment provider for live payments |
| Billing | `/settings?tab=billing` | Billing settings, `PARTIAL` | admin | Payment credentials for upgrades |
| Workspace | `/services` | Services catalog, `PLACEHOLDER` for the current clinic product | admin | Hidden when route policy disallows it |
| Workspace | `/settings?tab=tags` | Tags/custom fields settings, `WORKING` | admin | Core |
| Workspace | `/integrations` | Integration catalog, `CREDENTIAL_GATED` | admin | Provider credentials vary by integration |
| Workspace | `/settings?tab=profile` | Profile settings, `WORKING` | viewer | Core |
| Workspace | `/settings?tab=team` | Team members, `PARTIAL` | admin | Core |

## Navigation policy

`src/components/layout/navigation-registry.ts` is the only global menu source.
`buildVisibleNavigation` applies industry aliases, route policy, role policy,
tenant modules, hospital-only items, terminology labels, and empty-group
removal before either the Sidebar or Command Search renders entries.

The `/patients` page intentionally redirects to `/contacts`; the route and
active alias are retained for hospital workspaces so existing bookmarks and
patient-focused wording continue to work without a second implementation.

Instagram, Messenger, Lead Ads, Voice, IndiaMART, ExportersIndia, and Webhooks
remain setup-required in the integrations catalog until their server-side
OAuth/provider flows are configured. They do not report simulated success.
