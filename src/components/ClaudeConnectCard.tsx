import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Copy, Check, Trash2, Plus } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { api } from '../lib/api'
import { timeAgo } from '../lib/utils'
import { toast } from './ui/toast'
import type { McpToken } from '../lib/types'

// D1 datetime('now') is UTC without a zone marker ("2026-10-19 18:02:11")
const fromD1 = (v: string) => v.replace(' ', 'T') + (v.endsWith('Z') ? '' : 'Z')

// Owner-only: create/revoke tokens that let Claude talk to this event via MCP.
export function ClaudeConnectCard({ eventId }: { eventId: string }) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [created, setCreated] = useState<{ url: string; label: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens = [], isLoading } = useQuery<McpToken[]>({
    queryKey: ['mcp-tokens', eventId],
    queryFn: () => api.getMcpTokens(eventId)
  })

  const create = useMutation({
    mutationFn: () => api.createMcpToken(eventId, label.trim() || 'Claude'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mcp-tokens', eventId] })
      setCreated({ url: res.url, label: res.label })
      setLabel('')
    },
    onError: () => toast('Could not create connection', 'error')
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.deleteMcpToken(eventId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mcp-tokens', eventId] }); toast('Connection revoked') },
    onError: () => toast('Could not revoke connection', 'error')
  })

  function copyUrl() {
    if (!created) return
    navigator.clipboard.writeText(created.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Bot size={15} className="text-fire-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-smoke-300">Connect Claude</h2>
        </div>
        <p className="text-[11px] text-smoke-500 mb-3">
          Let Claude read and manage this event (guests, check-ins, tasks, schedule, money, light levels) through a private connector link. Claude acts as you, with your permissions.
        </p>

        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); create.mutate() }}
        >
          <label htmlFor="claude-token-label" className="sr-only">Connection name</label>
          <Input
            id="claude-token-label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Name, e.g. My phone"
            maxLength={60}
          />
          <Button type="submit" size="sm" variant="outline" disabled={create.isPending} className="shrink-0">
            <Plus size={14} aria-hidden="true" /> {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </form>

        <div className="mt-3 space-y-2" aria-live="polite">
          {isLoading && <p className="text-[11px] text-smoke-500">Loading connections…</p>}
          {!isLoading && tokens.length === 0 && (
            <p className="text-[11px] text-smoke-500">No Claude connections yet.</p>
          )}
          {tokens.map(t => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl glass px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-smoke-100 truncate">
                  {t.label} <span className="text-smoke-500 text-[11px] tabular-nums">…{t.token_hint}</span>
                </p>
                <p className="text-[11px] text-smoke-500">
                  {t.organiser_name ?? 'Removed organiser'} · created {timeAgo(fromD1(t.created_at))} · {t.last_used_at ? `used ${timeAgo(fromD1(t.last_used_at))}` : 'never used'}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Revoke ${t.label}`}
                onClick={() => { if (confirm(`Revoke "${t.label}"? Claude will lose access through this link immediately.`)) revoke.mutate(t.id) }}
                className="p-2 -m-1 text-smoke-500 hover:text-red-400 tap-highlight-none"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!created} onOpenChange={open => { if (!open) { setCreated(null); setCopied(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connector link for “{created?.label}”</DialogTitle>
            <DialogDescription>
              Copy this now — it won't be shown again. Anyone with this link can act as you, so treat it like a password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <label htmlFor="claude-connector-url" className="sr-only">Connector URL</label>
              <Input id="claude-connector-url" readOnly value={created?.url ?? ''} onFocus={e => e.currentTarget.select()} className="font-mono text-xs" />
              <Button type="button" size="sm" variant="outline" onClick={copyUrl} aria-label="Copy connector URL" className="shrink-0">
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              </Button>
            </div>
            <ol className="text-[12px] text-smoke-400 space-y-1 list-decimal pl-4">
              <li>In Claude (claude.ai or the app) open <span className="text-smoke-200">Settings → Connectors</span>.</li>
              <li>Choose <span className="text-smoke-200">Add custom connector</span>, name it “Bonfire Night” and paste the link as the URL.</li>
              <li>Leave the OAuth fields empty and add it, then enable it in a chat from the tools menu.</li>
            </ol>
            <p className="text-[11px] text-smoke-500">
              Claude Code: <code className="text-smoke-300">claude mcp add --transport http bonfire &lt;link&gt;</code>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setCreated(null); setCopied(false) }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
