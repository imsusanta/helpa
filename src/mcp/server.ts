import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { contactTools } from './tools/contacts'
import { whatsappTools } from './tools/whatsapp'
import { dealTools } from './tools/deals'
import { broadcastTools } from './tools/broadcasts'
import { automationTools } from './tools/automations'
import { appointmentTools } from './tools/appointments'
import { analyticsTools } from './tools/analytics'

export const ALL_TOOLS = [
  // Contacts
  {
    name: 'contacts_list',
    description: 'List or search CRM contacts by query string (name, phone, email) or tag.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for name, phone, or email' },
        tag: { type: 'string', description: 'Filter contacts by tag name' },
        limit: { type: 'number', description: 'Number of results to return (default 20)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
  },
  {
    name: 'contacts_get',
    description: 'Get full contact details including tags, notes, and custom fields by ID or phone number.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact UUID' },
        phone: { type: 'string', description: 'Contact phone number' },
      },
    },
  },
  {
    name: 'contacts_create',
    description: 'Create a new CRM contact.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number (required)' },
        name: { type: 'string', description: 'Full name' },
        email: { type: 'string', description: 'Email address' },
        company: { type: 'string', description: 'Company name' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names to attach' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'contacts_update',
    description: 'Update existing contact details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact UUID (required)' },
        name: { type: 'string' },
        email: { type: 'string' },
        company: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'contacts_delete',
    description: 'Delete a contact by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact UUID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tags_list',
    description: 'List all tags defined in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // WhatsApp Messaging
  {
    name: 'whatsapp_list_chats',
    description: 'List WhatsApp conversations and shared inbox chats.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'pending', 'closed'], description: 'Filter by conversation status' },
        limit: { type: 'number', description: 'Max chats to return (default 20)' },
        offset: { type: 'number', description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'whatsapp_get_chat_history',
    description: 'Get message history for a conversation ID or phone number.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: { type: 'string', description: 'Conversation UUID' },
        phone: { type: 'string', description: 'Contact phone number' },
        limit: { type: 'number', description: 'Max messages to return (default 50)' },
        offset: { type: 'number', description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'whatsapp_send_message',
    description: 'Send a direct WhatsApp text message to a contact.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Destination phone number' },
        conversation_id: { type: 'string', description: 'Existing conversation UUID' },
        message: { type: 'string', description: 'Message body text' },
      },
      required: ['message'],
    },
  },
  {
    name: 'whatsapp_send_template',
    description: 'Send a WhatsApp template message to a contact.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Destination phone number' },
        conversation_id: { type: 'string', description: 'Existing conversation UUID' },
        template_name: { type: 'string', description: 'Meta approved template name' },
        language: { type: 'string', description: 'Language code (default en_US)' },
      },
      required: ['template_name'],
    },
  },
  {
    name: 'whatsapp_list_templates',
    description: 'List WhatsApp message templates.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (Marketing, Utility, etc.)' },
        status: { type: 'string', description: 'Filter by status (Approved, Draft, Pending)' },
      },
    },
  },

  // Deals & Pipelines
  {
    name: 'pipelines_list',
    description: 'List sales pipelines and their stages.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'deals_list',
    description: 'List sales deals, optionally filtered by pipeline, stage, or contact.',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline_id: { type: 'string' },
        stage_id: { type: 'string' },
        contact_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'deals_create',
    description: 'Create a new sales deal card.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deal title' },
        contact_id: { type: 'string', description: 'Associated contact UUID' },
        stage_id: { type: 'string', description: 'Target pipeline stage UUID' },
        pipeline_id: { type: 'string', description: 'Target pipeline UUID' },
        value: { type: 'number', description: 'Deal value amount' },
        currency: { type: 'string', description: 'Currency code (default USD)' },
        notes: { type: 'string', description: 'Notes or description' },
      },
      required: ['title', 'contact_id', 'stage_id'],
    },
  },
  {
    name: 'deals_update_stage',
    description: 'Update deal stage, value, or status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal UUID' },
        stage_id: { type: 'string', description: 'New stage UUID' },
        status: { type: 'string', enum: ['open', 'won', 'lost'] },
        value: { type: 'number' },
      },
      required: ['id'],
    },
  },

  // Campaigns & Broadcasts
  {
    name: 'broadcasts_list',
    description: 'List campaign broadcasts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'broadcasts_create',
    description: 'Create and schedule a WhatsApp broadcast campaign.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        template_id: { type: 'string', description: 'Template UUID' },
        tag_id: { type: 'string', description: 'Audience tag UUID' },
        scheduled_at: { type: 'string', description: 'ISO timestamp to schedule send' },
      },
      required: ['name', 'template_id'],
    },
  },

  // Automations & Flows
  {
    name: 'automations_list',
    description: 'List active no-code automations and triggers.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'automations_toggle',
    description: 'Enable or disable an automation flow by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Automation UUID' },
        active: { type: 'boolean', description: 'True to enable, false to disable' },
      },
      required: ['id', 'active'],
    },
  },

  // Appointments
  {
    name: 'appointments_list',
    description: 'List booked appointments.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string' },
        status: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD date' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'appointments_create',
    description: 'Schedule a new appointment.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string', description: 'Contact/patient UUID' },
        appointment_date: { type: 'string', description: 'YYYY-MM-DD' },
        appointment_time: { type: 'string', description: 'HH:MM' },
        doctor_id: { type: 'string' },
        department: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['patient_id', 'appointment_date', 'appointment_time'],
    },
  },
  {
    name: 'appointments_update_status',
    description: 'Update appointment status (pending, confirmed, completed, cancelled, no_show).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Appointment UUID' },
        status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] },
        notes: { type: 'string' },
      },
      required: ['id', 'status'],
    },
  },

  // Workspace Stats
  {
    name: 'workspace_get_stats',
    description: 'Get workspace metrics and overview statistics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

export function createMcpServer() {
  const server = new Server(
    {
      name: 'wacrm-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: ALL_TOOLS }
  })

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params

    switch (name) {
      // Contacts
      case 'contacts_list':
        return contactTools.contacts_list(args as any)
      case 'contacts_get':
        return contactTools.contacts_get(args as any)
      case 'contacts_create':
        return contactTools.contacts_create(args as any)
      case 'contacts_update':
        return contactTools.contacts_update(args as any)
      case 'contacts_delete':
        return contactTools.contacts_delete(args as any)
      case 'tags_list':
        return contactTools.tags_list()

      // WhatsApp
      case 'whatsapp_list_chats':
        return whatsappTools.whatsapp_list_chats(args as any)
      case 'whatsapp_get_chat_history':
        return whatsappTools.whatsapp_get_chat_history(args as any)
      case 'whatsapp_send_message':
        return whatsappTools.whatsapp_send_message(args as any)
      case 'whatsapp_send_template':
        return whatsappTools.whatsapp_send_template(args as any)
      case 'whatsapp_list_templates':
        return whatsappTools.whatsapp_list_templates(args as any)

      // Deals
      case 'pipelines_list':
        return dealTools.pipelines_list()
      case 'deals_list':
        return dealTools.deals_list(args as any)
      case 'deals_create':
        return dealTools.deals_create(args as any)
      case 'deals_update_stage':
        return dealTools.deals_update_stage(args as any)

      // Broadcasts
      case 'broadcasts_list':
        return broadcastTools.broadcasts_list(args as any)
      case 'broadcasts_create':
        return broadcastTools.broadcasts_create(args as any)

      // Automations
      case 'automations_list':
        return automationTools.automations_list()
      case 'automations_toggle':
        return automationTools.automations_toggle(args as any)

      // Appointments
      case 'appointments_list':
        return appointmentTools.appointments_list(args as any)
      case 'appointments_create':
        return appointmentTools.appointments_create(args as any)
      case 'appointments_update_status':
        return appointmentTools.appointments_update_status(args as any)

      // Analytics
      case 'workspace_get_stats':
        return analyticsTools.workspace_get_stats()

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool name: ${name}` }],
          isError: true,
        }
    }
  })

  return server
}

async function main() {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('wacrm MCP Server running on stdio')
}

// Only auto-run if executed directly as entrypoint script
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts')) {
  main().catch((error) => {
    console.error('Fatal error starting Stdio MCP Server:', error)
    process.exit(1)
  })
}
