import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card } from '../../components/ui/card'
import { WhatsAppCopyButton } from '../../components/WhatsAppCopyButton'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { calculateFood, generateShoppingListWhatsApp } from '../../lib/food-algorithm'
import type { Guest } from '../../lib/types'

export default function Food() {
  const event = useEventStore(s => s.currentEvent)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const { data: guests = [], isLoading } = useQuery<Guest[]>({
    queryKey: ['guests', event?.id],
    queryFn: () => api.getGuests(event!.id) as Promise<Guest[]>,
    enabled: !!event?.id
  })

  const calc = calculateFood(
    guests,
    event?.food_split_ratio ?? 0.6,
    event?.food_buffer_factor ?? 1.1
  )

  const eventName = event?.name ?? 'Bonfire Night'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Food Tracker"
        subtitle="Smart quantity calculator"
        action={
          <WhatsAppCopyButton
            label="Shopping list"
            generate={() => generateShoppingListWhatsApp(calc, eventName)}
          />
        }
      />

      <PageContent>
        {/* Preference summary */}
        <Card>
          <h2 className="text-sm font-semibold text-smoke-300 mb-3">Guest Preferences</h2>
          <div className="grid grid-cols-2 gap-2">
            <PrefTile emoji="🍔" label="Burger only" count={calc.burger_only_count} />
            <PrefTile emoji="🌭" label="Sausage only" count={calc.sausage_only_count} />
            <PrefTile emoji="🍔🌭" label="Both" count={calc.both_count} highlight />
            <PrefTile emoji="❌" label="Neither" count={calc.neither_count} muted />
          </div>
        </Card>

        {/* Recommended quantities */}
        <Card className="glass-warm">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart size={16} className="text-fire-400" />
            <h2 className="text-sm font-semibold text-fire-300">Recommended to Buy</h2>
          </div>
          <div className="space-y-2.5">
            <BuyRow emoji="🍔" label="Burger patties" value={calc.buy_burgers} sub={`Rec: ${calc.recommended_burgers} + ${Math.round((calc.buffer_factor - 1) * 100)}% buffer`} />
            <BuyRow emoji="🌭" label="Sausages" value={calc.buy_sausages} sub={`Rec: ${calc.recommended_sausages} + ${Math.round((calc.buffer_factor - 1) * 100)}% buffer`} />
            <div className="border-t border-white/5 pt-2.5">
              <BuyRow emoji="🍞" label="Burger buns" value={calc.buy_burger_buns} />
              <BuyRow emoji="🌭" label="Hot dog buns" value={calc.buy_hot_dog_buns} />
            </div>
            <div className="border-t border-white/5 pt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-smoke-300 font-medium">Total bread products</span>
                <span className="text-lg font-bold text-gradient-fire">{calc.total_bread_products}</span>
              </div>
            </div>
          </div>

          <WhatsAppCopyButton
            label="Copy shopping list"
            generate={() => generateShoppingListWhatsApp(calc, eventName)}
            size="default"
            className="w-full mt-4"
          />
        </Card>

        {/* Algorithm info */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between glass-card p-3 tap-highlight-none"
        >
          <div className="flex items-center gap-2 text-sm text-smoke-400">
            <Info size={14} />
            How is this calculated?
          </div>
          {showBreakdown ? <ChevronUp size={14} className="text-smoke-500" /> : <ChevronDown size={14} className="text-smoke-500" />}
        </button>

        {showBreakdown && (
          <Card className="animate-slide-up text-sm text-smoke-400 space-y-2">
            <p><span className="text-smoke-200 font-medium">Burger-only guests</span> → counted at 100%</p>
            <p><span className="text-smoke-200 font-medium">Sausage-only guests</span> → counted at 100%</p>
            <p><span className="text-smoke-200 font-medium">"Both" guests</span> → counted at {Math.round(calc.split_ratio * 100)}% per item (configurable in event settings)</p>
            <p><span className="text-smoke-200 font-medium">Buffer</span> → {Math.round((calc.buffer_factor - 1) * 100)}% added for waste, unexpected guests and seconds</p>
            <p className="text-[11px] text-smoke-500 pt-1">
              Formula: <code className="bg-white/5 px-1 rounded">ceil((burger_only + both × {calc.split_ratio}) × {calc.buffer_factor})</code>
            </p>
          </Card>
        )}

        {/* Per-guest breakdown */}
        {isLoading ? (
          <Card className="h-32 shimmer" />
        ) : (
          <Card>
            <h2 className="text-sm font-semibold text-smoke-300 mb-3">Per-Guest Breakdown</h2>
            <div className="space-y-1.5">
              {guests.filter(g => g.rsvp_status === 'accepted').map(g => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span className="text-smoke-300">{g.name}</span>
                  <span className="text-smoke-500">
                    {g.dietary.length === 0 ? 'Nothing' : g.dietary.map(d => d === 'burger' ? '🍔' : '🌭').join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </PageContent>
    </div>
  )
}

function PrefTile({ emoji, label, count, highlight, muted }: {
  emoji: string; label: string; count: number; highlight?: boolean; muted?: boolean
}) {
  return (
    <div className={`glass rounded-xl p-3 flex items-center gap-2.5 ${highlight ? 'border-fire-400/20' : ''}`}>
      <span className="text-xl">{emoji}</span>
      <div>
        <p className={`text-xl font-bold ${muted ? 'text-smoke-500' : highlight ? 'text-fire-300' : 'text-smoke-100'}`}>{count}</p>
        <p className="text-[11px] text-smoke-500">{label}</p>
      </div>
    </div>
  )
}

function BuyRow({ emoji, label, value, sub }: { emoji: string; label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-smoke-200">{emoji} {label}</span>
        {sub && <p className="text-[11px] text-smoke-500">{sub}</p>}
      </div>
      <span className="text-lg font-bold text-smoke-100">{value}</span>
    </div>
  )
}
