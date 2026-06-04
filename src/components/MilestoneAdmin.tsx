import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Download, Star, StarOff } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { MilestoneBar, getMilestoneIcon } from './MilestoneBar'
import { PRESET_ICONS } from '../lib/milestoneConstants'
import { api } from '../lib/api'
import { generateId } from '../lib/utils'
import { toast } from './ui/toast'
import { cn } from '../lib/utils'
import type { Milestone, MilestonesResponse } from '../lib/types'

const MAX_IMAGE_PX = 128 // resize uploaded images to this before base64

interface Props {
  eventId: string
}

type IconTab = 'emoji' | 'preset' | 'image'

const EMOJI_SUGGESTIONS = [
  '🔥','🎆','🎇','🌭','🍔','🍺','🎵','🪵','☕','🍫',
  '⭐','💥','🎉','🌙','🍡','🏮','🏆','🥁','🎸','✨',
  '🍕','🧁','🎪','🎠','🌟','🪄','🧨','🎭','🥂','🍾',
]

export function MilestoneAdmin({ eventId }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Milestone | null>(null)
  const [iconTab, setIconTab] = useState<IconTab>('emoji')
  const [form, setForm] = useState(defaultForm())
  const [emojiInput, setEmojiInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<MilestonesResponse>({
    queryKey: ['milestones', eventId],
    queryFn: () => api.getMilestones(eventId) as Promise<MilestonesResponse>,
    enabled: !!eventId
  })

  const milestones = data?.milestones ?? []
  const totalRaised = data?.total_raised ?? 0

  const save = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = {
        id: editing?.id ?? generateId(),
        name: f.name,
        description: f.description,
        amount: Math.round(parseFloat(f.amountGbp) * 100),
        emoji: iconTab === 'emoji' ? f.emoji : '',
        icon_preset: iconTab === 'preset' ? f.icon_preset : '',
        icon_image: iconTab === 'image' ? f.icon_image : '',
        important: f.important
      }
      if (editing) return api.updateMilestone(eventId, editing.id, payload)
      return api.createMilestone(eventId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', eventId] })
      setOpen(false)
      toast(editing ? 'Milestone updated' : 'Milestone added')
    },
    onError: () => toast('Failed to save milestone', 'error')
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMilestone(eventId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', eventId] })
      toast('Milestone removed')
    }
  })

  function openAdd() {
    setEditing(null)
    setForm(defaultForm())
    setIconTab('emoji')
    setEmojiInput('')
    setOpen(true)
  }

  function openEdit(m: Milestone) {
    setEditing(m)
    const tab: IconTab = m.icon_image ? 'image' : m.icon_preset ? 'preset' : 'emoji'
    setIconTab(tab)
    setForm({
      name: m.name,
      description: m.description,
      amountGbp: (m.amount / 100).toFixed(2),
      emoji: m.emoji || '🔥',
      icon_preset: m.icon_preset || '',
      icon_image: m.icon_image || '',
      important: m.important
    })
    setEmojiInput(m.emoji || '')
    setOpen(true)
  }

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(MAX_IMAGE_PX / img.width, MAX_IMAGE_PX / img.height, 1)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const b64 = canvas.toDataURL('image/png')
        setForm(f => ({ ...f, icon_image: b64 }))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  // PNG export — renders bar to canvas
  async function exportPng() {
    if (milestones.length === 0) return
    const sorted = [...milestones].sort((a, b) => a.amount - b.amount)
    const maxAmount = sorted[sorted.length - 1].amount

    const W = 800, H = 160, PAD = 24
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = '#0a0500'
    ctx.fillRect(0, 0, W, H)

    // Amount label
    ctx.fillStyle = '#f97316'
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.fillText(`£${(totalRaised / 100).toFixed(0)} raised`, PAD, 28)

    ctx.fillStyle = '#6b5f54'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`of £${(maxAmount / 100).toFixed(0)}`, PAD + 130, 28)

    // Bar track
    const barY = H / 2 + 10, barH = 10
    const barX = PAD, barW = W - PAD * 2
    ctx.fillStyle = '#ffffff18'
    roundRect(ctx, barX, barY, barW, barH, 5)
    ctx.fill()

    // Bar fill
    const fillW = Math.min(barW, Math.max(0, (totalRaised / maxAmount) * barW))
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
    grad.addColorStop(0, '#e85f00')
    grad.addColorStop(1, '#fbbf24')
    ctx.fillStyle = grad
    roundRect(ctx, barX, barY, fillW, barH, 5)
    ctx.fill()

    // Milestone icons (emoji)
    ctx.font = '20px system-ui, sans-serif'
    for (const m of sorted) {
      const pct = m.amount / maxAmount
      const x = barX + pct * barW
      const unlocked = totalRaised >= m.amount
      const icon = getMilestoneIcon(m)
      ctx.globalAlpha = unlocked ? 1 : 0.35
      ctx.fillText(icon, x - 12, barY - 10)
      // Amount label
      ctx.globalAlpha = unlocked ? 1 : 0.3
      ctx.fillStyle = unlocked ? '#f97316' : '#6b5f54'
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillText(`£${(m.amount / 100).toFixed(0)}`, x - 10, barY + barH + 16)
      ctx.font = '20px system-ui, sans-serif'
      ctx.fillStyle = '#ffffff'
    }
    ctx.globalAlpha = 1

    // Download
    const a = document.createElement('a')
    a.download = 'bonfire-milestones.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  if (isLoading) return null

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-smoke-300">Milestones</h2>
        <div className="flex gap-2">
          {milestones.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportPng}>
              <Download size={13} /> Export PNG
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus size={14} /> Add
          </Button>
        </div>
      </div>
      <p className="text-xs text-smoke-500 mb-3">Configure fundraising milestones. Guests see progress on the event page and /tracker.</p>

      {/* Live preview */}
      {milestones.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/8">
          <p className="text-[10px] text-smoke-500 mb-2 uppercase tracking-wider">Preview</p>
          <MilestoneBar milestones={milestones} totalRaisedPence={totalRaised} compact />
        </div>
      )}

      {/* Milestone list */}
      <div className="space-y-2" ref={exportRef}>
        {milestones.length === 0 && (
          <p className="text-xs text-smoke-500 text-center py-4">No milestones yet. Add one to get started.</p>
        )}
        {[...milestones].sort((a, b) => a.amount - b.amount).map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <span className="text-xl w-8 text-center flex-shrink-0">{getMilestoneIcon(m)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-smoke-100 truncate">{m.name}</p>
                {m.important
                  ? <Star size={11} className="text-fire-400 flex-shrink-0" />
                  : <StarOff size={11} className="text-smoke-600 flex-shrink-0" />
                }
              </div>
              <p className="text-xs text-smoke-500">£{(m.amount / 100).toFixed(0)}{m.description ? ` — ${m.description}` : ''}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => openEdit(m)} className="p-1.5 text-smoke-500 hover:text-smoke-200 tap-highlight-none"><Pencil size={13} /></button>
              <button onClick={() => { if (confirm(`Remove "${m.name}"?`)) remove.mutate(m.id) }} className="p-1.5 text-smoke-500 hover:text-red-400 tap-highlight-none"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
            <DialogDescription>Set a fundraising target and reward icon.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Milestone name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Better fireworks" />
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Description</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Upgraded display with bigger bursts" />
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Target amount (£) *</label>
              <Input
                type="number" min="1" step="1"
                value={form.amountGbp}
                onChange={e => setForm(f => ({ ...f, amountGbp: e.target.value }))}
                placeholder="100"
              />
              <p className="text-[11px] text-smoke-500 mt-1">Cumulative total raised needed to unlock this milestone</p>
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-xs text-smoke-400 mb-2 block">Icon</label>
              <div className="flex gap-1 mb-3">
                {(['emoji', 'preset', 'image'] as IconTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setIconTab(t)}
                    className={cn(
                      'flex-1 py-1.5 text-xs rounded-lg border transition-all tap-highlight-none capitalize',
                      iconTab === t ? 'bg-fire-500/15 text-fire-300 border-fire-400/30' : 'glass border-white/10 text-smoke-400'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {iconTab === 'emoji' && (
                <div className="space-y-2">
                  <Input
                    value={emojiInput}
                    onChange={e => { setEmojiInput(e.target.value); setForm(f => ({ ...f, emoji: e.target.value })) }}
                    placeholder="Type or paste any emoji"
                    className="text-lg"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_SUGGESTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => { setForm(f => ({ ...f, emoji: e })); setEmojiInput(e) }}
                        className={cn(
                          'w-9 h-9 text-lg rounded-lg border tap-highlight-none transition-all',
                          form.emoji === e ? 'bg-fire-500/15 border-fire-400/30' : 'glass border-white/10 hover:border-white/20'
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {iconTab === 'preset' && (
                <div className="grid grid-cols-5 gap-1.5">
                  {Object.entries(PRESET_ICONS).map(([key, icon]) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, icon_preset: key }))}
                      className={cn(
                        'flex flex-col items-center gap-0.5 p-2 rounded-xl border text-xs tap-highlight-none transition-all',
                        form.icon_preset === key ? 'bg-fire-500/15 border-fire-400/30' : 'glass border-white/10 hover:border-white/20'
                      )}
                      title={key}
                    >
                      <span className="text-lg">{icon}</span>
                      <span className="text-[9px] text-smoke-500 capitalize">{key}</span>
                    </button>
                  ))}
                </div>
              )}

              {iconTab === 'image' && (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    Choose image
                  </Button>
                  {form.icon_image && (
                    <div className="flex items-center gap-3">
                      <img src={form.icon_image} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                      <button onClick={() => setForm(f => ({ ...f, icon_image: '' }))} className="text-xs text-red-400 hover:text-red-300 tap-highlight-none">Remove</button>
                    </div>
                  )}
                  <p className="text-[11px] text-smoke-500">Images are compressed to 128×128px and stored in the database.</p>
                </div>
              )}
            </div>

            {/* Important toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm text-smoke-200">Show on compact bar</p>
                <p className="text-[11px] text-smoke-500">When the bar can't fit all milestones, only important ones are shown</p>
              </div>
              <Switch checked={form.important} onCheckedChange={v => setForm(f => ({ ...f, important: v }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate(form)}
              disabled={!form.name.trim() || !form.amountGbp || save.isPending}
            >
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add Milestone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function defaultForm() {
  return {
    name: '',
    description: '',
    amountGbp: '',
    emoji: '🔥',
    icon_preset: '',
    icon_image: '',
    important: true
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
