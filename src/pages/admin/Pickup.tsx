import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { toast } from '../../components/ui/toast'

interface PickupSlot { id: string; label: string; sort_order: number }

export default function Pickup() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PickupSlot | null>(null)
  const [label, setLabel] = useState('')

  const { data: slots = [], isLoading } = useQuery<PickupSlot[]>({
    queryKey: ['pickup-slots', event?.id],
    queryFn: () => api.getPickupSlots(event!.id),
    enabled: !!event?.id
  })

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api.updatePickupSlot(event!.id, editing.id, { label, sort_order: editing.sort_order })
      }
      return api.createPickupSlot(event!.id, { label, sort_order: slots.length })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pickup-slots'] })
      setOpen(false)
      toast(editing ? 'Slot updated' : 'Slot added', 'success')
    },
    onError: () => toast('Failed to save', 'error')
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deletePickupSlot(event!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pickup-slots'] })
      toast('Slot removed', 'success')
    }
  })

  function openNew() {
    setEditing(null)
    setLabel('')
    setOpen(true)
  }

  function openEdit(slot: PickupSlot) {
    setEditing(slot)
    setLabel(slot.label)
    setOpen(true)
  }

  function submit() {
    if (!label.trim() || save.isPending) return
    save.mutate()
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pickup Times"
        subtitle="End-of-night collection slots"
        action={<Button size="icon" onClick={openNew}><Plus size={18} /></Button>}
      />

      <PageContent>
        <Card className="p-3 bg-amber-500/5 border-amber-400/20">
          <p className="text-xs text-amber-300/80 leading-relaxed">
            ⚠️ These slots appear on the RSVP form as pickup options. Guests select a preferred time — all times are approximate and subject to change.
          </p>
        </Card>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Card key={i} className="h-14 shimmer" />)}
          </div>
        ) : slots.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-smoke-500 text-sm">No pickup slots yet</p>
            <p className="text-smoke-600 text-xs mt-1">Add time slots that guests can choose from on the RSVP form</p>
            <Button size="sm" className="mt-3" onClick={openNew}>
              <Plus size={14} /> Add first slot
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {slots.map(slot => (
              <Card key={slot.id} className="flex items-center gap-3 p-3.5">
                <GripVertical size={16} className="text-smoke-600 shrink-0" />
                <p className="flex-1 text-sm font-medium text-smoke-100">{slot.label}</p>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(slot)}>
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (confirm(`Remove "${slot.label}"?`)) remove.mutate(slot.id) }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Slot' : 'Add Pickup Slot'}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-xs text-smoke-400 mb-1 block">Time label</label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. 10:30 PM or After fireworks"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
            <p className="text-[11px] text-smoke-500 mt-1.5">This is shown exactly as typed on the guest RSVP form</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!label.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
