import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { FireBackground } from '../components/FireBackground'
import { Toaster } from '../components/ui/toast'
import { toast } from '../components/ui/toast'
import { useEventStore } from '../store/event'
import { api } from '../lib/api'
import { generateId } from '../lib/utils'
import type { Event } from '../lib/types'

export default function EventSetup() {
  const navigate = useNavigate()
  const setCurrentEvent = useEventStore(s => s.setCurrentEvent)
  const [loading, setLoading] = useState(false)
  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState({
    name: `Bonfire Night ${currentYear}`,
    date: `${currentYear}-11-05`,
    meeting_location: '',
    event_location: ''
  })

  function handleDateChange(newDate: string) {
    const newYear = new Date(newDate).getFullYear()
    const prevYear = new Date(form.date).getFullYear()
    setForm(f => ({
      ...f,
      date: newDate,
      name: f.name === `Bonfire Night ${prevYear}` ? `Bonfire Night ${newYear}` : f.name
    }))
  }

  async function create() {
    const year = new Date(form.date).getFullYear()
    setLoading(true)
    try {
      const event = await api.createEvent({
        id: generateId(),
        year,
        ...form,
        status: 'planning',
        conflict_event_enabled: false,
        food_split_ratio: 0.6,
        food_buffer_factor: 1.1
      }) as Event
      setCurrentEvent(event)
      navigate('/admin')
    } catch {
      toast('Failed to create event', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh min-h-screen relative flex items-center justify-center">
      <FireBackground />
      <Toaster />
      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-warm mb-3 glow-fire">
            <span className="text-3xl">🔥</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient-fire">Setup Bonfire Night</h1>
          <p className="text-sm text-smoke-400 mt-1">Create your {currentYear} event</p>
        </div>

        <Card className="space-y-3">
          <div>
            <label className="text-xs text-smoke-400 mb-1 block">Event name</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-smoke-400 mb-1 block">Date</label>
            <Input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-smoke-400 mb-1 block">Meeting location</label>
            <Input value={form.meeting_location} onChange={e => setForm(f => ({ ...f, meeting_location: e.target.value }))} placeholder="Where guests meet first" />
          </div>
          <div>
            <label className="text-xs text-smoke-400 mb-1 block">Event location (TBC is fine)</label>
            <Input value={form.event_location} onChange={e => setForm(f => ({ ...f, event_location: e.target.value }))} placeholder="Where the bonfire will be" />
          </div>
          <Button onClick={create} disabled={loading || !form.name.trim()} className="w-full mt-2">
            {loading ? 'Creating…' : 'Create Event'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
