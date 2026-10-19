import { ToolError, type McpContext } from './context'
import { TOOLS, TOOLS_BY_NAME } from './tools'
import { PROMPTS, PROMPTS_BY_NAME } from './prompts'
import { validate } from './schema'

// Stateless MCP server over Streamable HTTP: every POST carries one JSON-RPC
// message (or a batch) and gets a plain JSON response — no sessions, no SSE.

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'bonfire-night-planner', title: 'Bonfire Night Planner', version: '1.0.0' }

interface JsonRpcMessage {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string; data?: unknown } }

class RpcError extends Error {
  constructor(public code: number, message: string) { super(message) }
}

function instructions(ctx: McpContext): string {
  return [
    'Tools for planning and running a Bonfire Night event (guests/RSVPs, check-ins, tasks, schedule, money, venues, light levels, weather).',
    `Every tool acts on one event (id ${ctx.eventId}) as organiser "${ctx.organiser.name}"${ctx.organiser.is_owner ? ' (owner)' : ''}, with that organiser's permissions.`,
    'Start with get_event_overview. Times are UK local (Europe/London), money is GBP except milestone amounts which are pence.',
    'update_* tools only change the fields you pass. Ask the user before calling destructive tools (delete_*).'
  ].join(' ')
}

async function dispatch(method: string, params: Record<string, unknown>, ctx: McpContext): Promise<unknown> {
  switch (method) {
    case 'initialize': {
      const requested = String(params.protocolVersion ?? '')
      return {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: instructions(ctx)
      }
    }
    case 'ping':
      return {}

    case 'tools/list':
      return {
        tools: TOOLS.map(t => ({
          name: t.name, title: t.title, description: t.description,
          inputSchema: t.inputSchema, annotations: { title: t.title, ...t.annotations }
        }))
      }

    case 'tools/call': {
      const name = String(params.name ?? '')
      const tool = TOOLS_BY_NAME.get(name)
      if (!tool) throw new RpcError(-32602, `Unknown tool: ${name}`)
      const args = (params.arguments ?? {}) as Record<string, unknown>
      const problems = validate(args, tool.inputSchema)
      if (problems.length) return toolError(`Invalid arguments for ${name}:\n- ${problems.join('\n- ')}`)
      try {
        const result = await tool.run(args, ctx)
        return { content: [{ type: 'text', text: JSON.stringify(result ?? null, null, 2) }], isError: false }
      } catch (e) {
        if (e instanceof ToolError) return toolError(e.message)
        console.error(`MCP tool ${name} failed`, e)
        return toolError(`Unexpected error in ${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    case 'prompts/list':
      return {
        prompts: PROMPTS.map(p => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments }))
      }

    case 'prompts/get': {
      const name = String(params.name ?? '')
      const prompt = PROMPTS_BY_NAME.get(name)
      if (!prompt) throw new RpcError(-32602, `Unknown prompt: ${name}`)
      const args = (params.arguments ?? {}) as Record<string, string>
      let text: string
      try {
        text = await prompt.build(args, ctx)
      } catch (e) {
        throw new RpcError(-32603, `Could not build prompt ${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
      return { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text } }] }
    }

    default:
      throw new RpcError(-32601, `Method not found: ${method}`)
  }
}

function toolError(text: string) {
  return { content: [{ type: 'text', text }], isError: true }
}

async function handleOne(msg: unknown, ctx: McpContext): Promise<JsonRpcResponse | null> {
  const m = (msg ?? {}) as JsonRpcMessage
  const id = m.id ?? null
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
    // A response or malformed message — nothing sensible to reply to unless it had an id
    return m.id === undefined ? null : { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } }
  }
  // Notifications (no id) get no response
  const isNotification = m.id === undefined
  try {
    const result = await dispatch(m.method, m.params ?? {}, ctx)
    return isNotification ? null : { jsonrpc: '2.0', id, result }
  } catch (e) {
    if (isNotification) return null
    const err = e instanceof RpcError ? e : new RpcError(-32603, e instanceof Error ? e.message : String(e))
    return { jsonrpc: '2.0', id, error: { code: err.code, message: err.message } }
  }
}

// Returns the JSON body to send, or null when only notifications were received (→ HTTP 202).
export async function handleMcpBody(body: unknown, ctx: McpContext): Promise<unknown | null> {
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(m => handleOne(m, ctx)))).filter(r => r !== null)
    return responses.length ? responses : null
  }
  return handleOne(body, ctx)
}
