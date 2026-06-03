import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle2, Circle, Clock3, Pencil, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input, Textarea } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId, formatDate, TASK_STAGE_LABELS } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import type { Task } from '../../lib/types'

const STAGES = ['pre_event', 'day_of', 'post_event'] as const
const EMPTY_TASK = { title: '', status: 'pending' as Task['status'], owner: '', stage: 'pre_event' as Task['stage'], due_date: '', notes: '' }

export default function Tasks() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState(EMPTY_TASK)
  const [stageFilter, setStageFilter] = useState<Task['stage'] | 'all'>('all')

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', event?.id],
    queryFn: () => api.getTasks(event!.id) as Promise<Task[]>,
    enabled: !!event?.id
  })

  const save = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) return api.updateTask(event!.id, editing.id, data)
      return api.createTask(event!.id, { ...data, id: generateId(), event_id: event!.id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setOpen(false); toast('Task saved') }
  })

  const cycleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) => {
      const next = status === 'pending' ? 'in_progress' : status === 'in_progress' ? 'completed' : 'pending'
      return api.updateTask(event!.id, id, { status: next })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] })
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTask(event!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast('Task deleted') }
  })

  function openEdit(task: Task) {
    setEditing(task)
    setForm({ title: task.title, status: task.status, owner: task.owner ?? '', stage: task.stage, due_date: task.due_date ?? '', notes: task.notes ?? '' })
    setOpen(true)
  }

  const filtered = tasks.filter(t => stageFilter === 'all' || t.stage === stageFilter)
  const grouped: Record<Task['stage'], Task[]> = { pre_event: [], day_of: [], post_event: [] }
  for (const t of filtered) grouped[t.stage].push(t)

  const done = tasks.filter(t => t.status === 'completed').length
  const total = tasks.length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tasks"
        subtitle={`${done}/${total} completed`}
        action={<Button size="icon" onClick={() => { setEditing(null); setForm(EMPTY_TASK); setOpen(true) }}><Plus size={18} /></Button>}
      />

      <PageContent>
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {(['all', ...STAGES] as const).map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all tap-highlight-none',
                stageFilter === s ? 'bg-fire-400/15 text-fire-300 border-fire-400/30' : 'glass border-white/10 text-smoke-400'
              )}
            >
              {s === 'all' ? 'All' : TASK_STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="flex items-center gap-3 glass-card p-3">
            <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fire-500 to-fire-400 rounded-full transition-all duration-700"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-smoke-400 shrink-0">{done}/{total}</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Card key={i} className="h-14 shimmer" />)}</div>
        ) : (
          STAGES.map(stage => {
            const stageTasks = grouped[stage]
            if (stageTasks.length === 0) return null
            return (
              <div key={stage}>
                <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider mb-2 px-1">
                  {TASK_STAGE_LABELS[stage]}
                </h3>
                <div className="space-y-2">
                  {stageTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onCycle={() => cycleStatus.mutate({ id: task.id, status: task.status })}
                      onEdit={() => openEdit(task)}
                      onDelete={() => { if (confirm('Delete task?')) remove.mutate(task.id) }}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}

        {!isLoading && tasks.length === 0 && (
          <Card className="text-center py-8 text-smoke-500">No tasks yet — add one above</Card>
        )}
      </PageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Stage</label>
                <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v as Task['stage'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_event">Pre-event</SelectItem>
                    <SelectItem value="day_of">Day of</SelectItem>
                    <SelectItem value="post_event">Post-event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Task['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Owner (name or email)" />
            <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" className="min-h-[60px]" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.title.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskRow({ task, onCycle, onEdit, onDelete }: {
  task: Task; onCycle: () => void; onEdit: () => void; onDelete: () => void
}) {
  const StatusIcon = task.status === 'completed' ? CheckCircle2 : task.status === 'in_progress' ? Clock3 : Circle
  const iconColor = task.status === 'completed' ? 'text-emerald-400' : task.status === 'in_progress' ? 'text-amber-400' : 'text-smoke-600'

  return (
    <Card className={cn('p-3 flex items-center gap-3', task.status === 'completed' && 'opacity-60')}>
      <button onClick={onCycle} className="shrink-0 tap-highlight-none">
        <StatusIcon size={20} className={iconColor} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', task.status === 'completed' ? 'line-through text-smoke-400' : 'text-smoke-100')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.owner && <span className="text-[11px] text-smoke-500">{task.owner}</span>}
          {task.due_date && <span className="text-[11px] text-smoke-500">Due {formatDate(task.due_date, 'dd MMM')}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-smoke-500 hover:text-smoke-200 tap-highlight-none"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1.5 text-smoke-500 hover:text-red-400 tap-highlight-none"><Trash2 size={13} /></button>
      </div>
    </Card>
  )
}
