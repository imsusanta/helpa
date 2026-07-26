import { NextRequest, NextResponse } from 'next/server'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { createMcpServer } from '@/mcp/server'

// Map of active SSE transports by session ID
const activeTransports = new Map<string, SSEServerTransport>()

export async function GET(req: NextRequest) {
  try {
    const server = createMcpServer()
    let transport: SSEServerTransport

    const responseStream = new ReadableStream({
      async start(controller) {
        // Create custom mock response object compatible with Node HTTP response interface required by SSEServerTransport
        const res: any = {
          writeHead: (statusCode: number, headers: Record<string, string>) => {
            // Headers set via SSEServerTransport
          },
          write: (chunk: any) => {
            controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
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

        transport = new SSEServerTransport('/api/mcp', res)
        await server.connect(transport)

        activeTransports.set(transport.sessionId, transport)
      },
      cancel() {
        if (transport && activeTransports.has(transport.sessionId)) {
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
  } catch (err: any) {
    return NextResponse.json({ error: `MCP Server Error: ${err.message}` }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId query parameter' }, { status: 400 })
    }

    const transport = activeTransports.get(sessionId)
    if (!transport) {
      return NextResponse.json({ error: `Session not found: ${sessionId}` }, { status: 404 })
    }

    const body = await req.json()
    await transport.handlePostMessage(req as any, {} as any, body)

    return NextResponse.json({ status: 'ok' })
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to process MCP message: ${err.message}` }, { status: 500 })
  }
}
