import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, TrendingDown, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId, formatDate } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import type { Transaction } from '../../lib/types'

const CATEGORIES = ['contribution', 'venue', 'food', 'equipment', 'other']
const EMPTY_TX: Omit<Transaction, 'id' | 'event_id' | 'created_at'> = {
  description: '', category: 'contribution', budget_amount: undefined, actual_amount: undefined,
  transaction_date: '', paid_by: '', notes: '', transaction_type: 'contribution'
}

export default function Finance() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<typeof EMPTY_TX>(EMPTY_TX)
  const [tab, setTab] = useState<'contributions' | 'expenses'>('contributions')

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', event?.id],
    queryFn: () => api.getTransactions(event!.id) as Promise<Transaction[]>,
    enabled: !!event?.id
  })

  const save = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) return api.updateTransaction(event!.id, editing.id, data)
      return api.createTransaction(event!.id, { ...data, id: generateId(), event_id: event!.id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance'] }); setOpen(false); toast('Saved') }
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(event!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance'] }); toast('Deleted') }
  })

  function openEdit(tx: Transaction) {
    setEditing(tx)
    setForm({ description: tx.description, category: tx.category, budget_amount: tx.budget_amount, actual_amount: tx.actual_amount, transaction_date: tx.transaction_date ?? '', paid_by: tx.paid_by ?? '', notes: tx.notes ?? '', transaction_type: tx.transaction_type })
    setOpen(true)
  }

  const contributions = transactions.filter(t => t.transaction_type === 'contribution')
  const expenses = transactions.filter(t => t.transaction_type === 'expense')

  const totalBudget = expenses.reduce((s, t) => s + (t.budget_amount ?? 0), 0)
  const totalSpent = expenses.reduce((s, t) => s + (t.actual_amount ?? 0), 0)
  const totalIn = contributions.reduce((s, t) => s + (t.actual_amount ?? 0), 0)
  const balance = totalIn - totalSpent

  const current = tab === 'contributions' ? contributions : expenses

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Finance"
        subtitle="Costs & contributions"
        action={
          <Button size="icon" onClick={() => {
            setEditing(null)
            setForm({ ...EMPTY_TX, transaction_type: tab === 'contributions' ? 'contribution' : 'expense' })
            setOpen(true)
          }}>
            <Plus size={18} />
          </Button>
        }
      />

      <PageContent>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile label="Total in" value={totalIn} positive />
          <SummaryTile label="Total spent" value={totalSpent} negative={totalSpent > totalBudget} />
          <SummaryTile label="Balance" value={balance} positive={balance >= 0} negative={balance < 0} />
        </div>

        {totalBudget > 0 && (
          <Card className="p-3">
            <div className="flex justify-between text-xs text-smoke-400 mb-1.5">
              <span>Budget vs Spent</span>
              <span>£{totalSpent.toFixed(2)} / £{totalBudget.toFixed(2)}</span>
            </div>
            <div className="bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  totalSpent > totalBudget ? 'bg-red-500' : 'bg-emerald-500'
                )}
                style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
              />
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2">
          <TabBtn active={tab === 'contributions'} onClick={() => setTab('contributions')} label={`Contributions (${contributions.length})`} />
          <TabBtn active={tab === 'expenses'} onClick={() => setTab('expenses')} label={`Expenses (${expenses.length})`} />
        </div>

        {/* List */}
        {current.length === 0 ? (
          <Card className="text-center py-8 text-smoke-500">No {tab} yet</Card>
        ) : (
          <div className="space-y-2">
            {current.map(tx => (
              <Card key={tx.id} className="p-3 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', tx.transaction_type === 'contribution' ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                  {tx.transaction_type === 'contribution'
                    ? <TrendingUp size={14} className="text-emerald-400" />
                    : <TrendingDown size={14} className="text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-smoke-100 truncate">{tx.description}</p>
                  <div className="flex gap-2 text-[11px] text-smoke-500">
                    <span>{tx.category}</span>
                    {tx.paid_by && <span>· {tx.paid_by}</span>}
                    {tx.transaction_date && <span>· {formatDate(tx.transaction_date, 'dd MMM')}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {tx.actual_amount != null && (
                    <p className={cn('text-sm font-bold', tx.transaction_type === 'contribution' ? 'text-emerald-400' : 'text-smoke-100')}>
                      £{tx.actual_amount.toFixed(2)}
                    </p>
                  )}
                  {tx.budget_amount != null && tx.actual_amount == null && (
                    <p className="text-sm text-smoke-400">£{tx.budget_amount.toFixed(2)}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(tx)} className="p-1.5 text-smoke-500 hover:text-smoke-200 tap-highlight-none"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm('Delete?')) remove.mutate(tx.id) }} className="p-1.5 text-smoke-500 hover:text-red-400 tap-highlight-none"><Trash2 size={13} /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} {form.transaction_type === 'contribution' ? 'Contribution' : 'Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['contribution', 'expense'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, transaction_type: t }))}
                    className={cn('py-2 rounded-xl text-sm border tap-highlight-none transition-all', form.transaction_type === t ? 'bg-fire-400/15 text-fire-300 border-fire-400/30' : 'glass border-white/10 text-smoke-400')}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as Transaction['category'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Budget (£)</label>
                <Input type="number" step="0.01" value={form.budget_amount ?? ''} onChange={e => setForm(f => ({ ...f, budget_amount: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Actual (£)</label>
                <Input type="number" step="0.01" value={form.actual_amount ?? ''} onChange={e => setForm(f => ({ ...f, actual_amount: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="0.00" />
              </div>
            </div>
            <Input value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))} placeholder="Paid by (name/email)" />
            <Input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.description.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryTile({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <Card className="p-3 text-center">
      <p className={cn('text-lg font-bold', positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-smoke-100')}>
        £{Math.abs(value).toFixed(2)}
      </p>
      <p className="text-[10px] text-smoke-500 mt-0.5">{label}</p>
    </Card>
  )
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={cn('py-2 rounded-xl text-xs font-medium border transition-all tap-highlight-none', active ? 'bg-fire-400/15 text-fire-300 border-fire-400/30' : 'glass border-white/10 text-smoke-400')}>
      {label}
    </button>
  )
}
