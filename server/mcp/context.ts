import type { JsonSchema } from './schema'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiResult {
  ok: boolean
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

// Everything a tool or prompt needs. `call` runs an existing REST route in-process
// as the token's organiser, so MCP gets exactly the app's validation + permissions.
export interface McpContext {
  eventId: string
  origin: string
  organiser: { id: string; name: string; is_owner: boolean; permissions: Record<string, boolean> }
  call: (method: HttpMethod, path: string, body?: unknown) => Promise<ApiResult>
}

export interface ToolAnnotations {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: ToolAnnotations
  run: (args: Record<string, unknown>, ctx: McpContext) => Promise<unknown>
}

// Thrown by tools for expected failures (API errors, not-found, bad input). The
// protocol layer turns it into an `isError` tool result Claude can read and react to.
export class ToolError extends Error {}

export async function need(res: Promise<ApiResult>): Promise<ApiResult['data']> {
  const r = await res
  if (!r.ok) {
    const msg = r.data?.error ?? 'Request failed'
    const hint = r.status === 403 ? ' (the organiser this Claude token belongs to lacks permission for this)' : ''
    throw new ToolError(`${msg} [HTTP ${r.status}]${hint}`)
  }
  return r.data
}

// ─── UK time helpers (the event is in the UK; Workers run in UTC) ──────────────

export const TIME_ZONE = 'Europe/London'

const hhmmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})

export function fmtUkTime(d: Date | null | undefined): string | null {
  return d instanceof Date && !isNaN(d.getTime()) ? hhmmFmt.format(d) : null
}

// Minutes UK local time is ahead of UTC at instant `d` (0 in GMT, 60 in BST)
function ukOffsetMins(d: Date): number {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map(x => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000)
}

// "2026-11-05" + "18:30" (UK wall-clock) → the matching instant
export function ukDateTime(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, h, mi))
  return new Date(guess.getTime() - ukOffsetMins(guess) * 60_000)
}

// Midday UTC on the given date — unambiguous anchor for SunCalc day calculations
export function middayUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function todayUk(): string {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
