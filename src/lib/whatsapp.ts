import type { Guest, Event, ScheduleItem } from './types'
import { formatTime } from './utils'

export function buildPickupMessage(guests: Guest[], event: Event): string {
  const accepted = guests.filter(g => g.rsvp_status === 'accepted' && g.pickup_time)
  const grouped: Record<string, string[]> = {}

  for (const g of accepted) {
    const t = g.pickup_time!
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(g.name)
  }

  const sorted = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  const lines = [
    `🔥 *${event.name} — End of Night Pick-ups*`,
    '',
    `Pick-ups from ${event.meeting_location || 'the meeting point'}:`,
    ''
  ]

  for (const [time, names] of sorted) {
    lines.push(`_${formatTime(time)}_ — ${names.join(', ')}`)
  }

  lines.push('')
  lines.push('📝 _All times are approximate and subject to change_')

  return lines.join('\n')
}

export function buildEventInfoMessage(event: Event): string {
  const date = new Date(event.date)
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const lines = [
    `🔥 *${event.name}*`,
    '',
    `📅 *Date:* ${dateStr}`,
    `📍 *Meeting at:* ${event.meeting_location || 'TBC'}`,
    `🏕️ *Event at:* ${event.event_location || 'TBC'}`,
    '',
    '_More details to follow. See you there!_ 🎆'
  ]

  return lines.join('\n')
}

export function buildRsvpSummaryMessage(guests: Guest[], event: Event): string {
  const accepted = guests.filter(g => g.rsvp_status === 'accepted')
  const declined = guests.filter(g => g.rsvp_status === 'declined')
  const awaiting = guests.filter(g => g.rsvp_status === 'invited')

  const lines = [
    `🔥 *${event.name} — RSVP Summary*`,
    '',
    `✅ *Accepted (${accepted.length}):*`,
    ...accepted.map(g => `• ${g.name}`),
    '',
  ]

  if (declined.length > 0) {
    lines.push(`❌ *Declined (${declined.length}):*`)
    lines.push(...declined.map(g => `• ${g.name}`))
    lines.push('')
  }

  if (awaiting.length > 0) {
    lines.push(`⏳ *Awaiting response (${awaiting.length}):*`)
    lines.push(...awaiting.map(g => `• ${g.name}`))
    lines.push('')
  }

  lines.push(`_Total invited: ${guests.filter(g => g.rsvp_status !== 'in_consideration').length}_`)

  return lines.join('\n')
}

export function buildScheduleMessage(items: ScheduleItem[], event: Event): string {
  const sorted = [...items].sort((a, b) => (a.sort_order - b.sort_order) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))

  const lines = [
    `🔥 *${event.name} — Evening Schedule*`,
    ''
  ]

  for (const item of sorted) {
    const time = item.start_time ? `_${formatTime(item.start_time)}_` : ''
    const location = item.location ? ` @ ${item.location}` : ''
    lines.push(`${time ? time + ' ' : ''}*${item.title}*${location}`)
    if (item.notes) lines.push(`  ${item.notes}`)
  }

  return lines.join('\n')
}
