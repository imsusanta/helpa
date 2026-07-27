import { NextRequest, NextResponse } from 'next/server'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { createMcpServer } from '@/mcp/server'
import { getCurrentAccount, toErrorResponse, UnauthorizedError } from '@/lib/auth/account'
import { isMcpServerEnabled } from '@/lib/config/feature-flags'

/**
 * MCP transport endpoint.
 *
 * Auth: both verbs require a signed-in Genspark/Supabase session. Previously
 * neither did, so anyone on the internet could open a session over GET and
 * then drive every MCP tool over POST with a service-role client behind it.
 *
 * The MCP tools do not yet filter by account_id (see the Phase 0 audit), so
 * this endpoint is additionally gated behind ENABLE_MCP_SERVER, which
 * defaults to off. Authentication alone would still let any signed-in tenant
 * read every other tenant's rows.
 */

/**
 * Active SSE transports, keyed by session id. The owning user/account is
 * recorded alongside the transport so POST can verify that the caller owns
 * the session it names, rather than trusting an unguessable id.
 */
const activeTransports = new Map<
  string,
  { transport: SSEServerTransport; userId: string; accountId: string }
>()

export async function GET(req: NextRequest) {
  if (!isMcpServerEnabled()) {
    return NextResponse.json({ error: 'MCP server is disabled' }, { status: 404 })
  }

  let owner: { userId: string; accountId: string }
  try {
    const ctx = await getCurrentAccount()
    owner = { userId: ctx.userId, accountId: ctx.accountId }
  } catch (err) {
    return toErrorResponse(err)
  }

  try {
    const server = createMcpServer()
    let transport: SSEServerTransport

    const responseStream = new ReadableStream({
      async start(controller) {
        // Minimal Node-HTTP-shaped response object for SSEServerTransport.
        const res = {
          writeHead: () => {
            // Headers are set on the Response below.
          },
          write: (chunk: string | Uint8Array) => {
            controller.enqueue(
              typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk,
            )
          },
          end: () => {
            try {
              controller.close()
            } catch {
              // Stream already closed
            }
          },
          on: (event: string, listener: () => void) => {
            if (event === 'close') {
              req.signal.addEventListener('abort', listener)
            }
          },
        }

        transport = new SSEServerTransport(
          '/api/mcp',
          // The SDK wants a Node ServerResponse; in the App Router we only have
          // a ReadableStream controller, so we hand it the minimal shape it
          // actually calls (writeHead/write/end/on).
          res as unknown as ConstructorParameters<typeof SSEServerTransport>[1],
        )
        await server.connect(transport)

        activeTransports.set(transport.sessionId, { transport, ...owner })
      },
      cancel() {
        if (transport) {
          activeTransports.delete(transport.sessionId)
        }
      },
    })

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[mcp] failed to open SSE transport:', err)
    return NextResponse.json({ error: 'MCP server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!isMcpServerEnabled()) {
    return NextResponse.json({ error: 'MCP server is disabled' }, { status: 404 })
  }

  let userId: string
  try {
    const ctx = await getCurrentAccount()
    userId = ctx.userId
  } catch (err) {
    return toErrorResponse(err)
  }

  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId query parameter' }, { status: 400 })
    }

    const entry = activeTransports.get(sessionId)
    // Same 404 whether the session is absent or owned by someone else, so the
    // response cannot be used to probe for live session ids.
    if (!entry || entry.userId !== userId) {
      return toErrorResponse(new UnauthorizedError('Session not found'))
    }

    const body = await req.json()
    await entry.transport.handlePostMessage(
      req as unknown as Parameters<SSEServerTransport['handlePostMessage']>[0],
      {} as Parameters<SSEServerTransport['handlePostMessage']>[1],
      body,
    )

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[mcp] failed to process message:', err)
    return NextResponse.json({ error: 'Failed to process MCP message' }, { status: 500 })
  }
}
