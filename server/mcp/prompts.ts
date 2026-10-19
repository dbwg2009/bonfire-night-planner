import { need, type McpContext } from './context'
import { buildFood, buildOverview, buildSunTiming, buildWeather } from './tools'

// Prompts embed live data fetched at request time, so they work even before
// Claude decides to call any tools.

interface PromptArg { name: string; description: string; required?: boolean }

interface PromptDef {
  name: string
  title: string
  description: string
  arguments: PromptArg[]
  build: (args: Record<string, string>, ctx: McpContext) => Promise<string>
}

const json = (label: string, data: unknown) => `### ${label}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``

export const PROMPTS: PromptDef[] = [
  {
    name: 'night_of_briefing',
    title: 'Night-of briefing',
    description: 'A phone-friendly briefing for the night: key times, weather, headcount, allergies, outstanding tasks and run sheet.',
    arguments: [],
    async build(_args, ctx) {
      const [overview, light, weather, tasks] = await Promise.all([
        buildOverview(ctx),
        buildSunTiming(ctx),
        buildWeather(ctx),
        ctx.call('GET', `/events/${ctx.eventId}/tasks`).then(r => (r.ok ? r.data : []) as Record<string, unknown>[])
      ])
      const dayOf = tasks.filter(t => t.stage === 'day_of' && t.status !== 'completed')
      return [
        'Write me a night-of briefing for our Bonfire Night, to read on my phone outside in the dark.',
        'Keep it short and scannable. Lead with the critical times (leave the meeting point by, bonfire window, fireworks after — prefer the organiser overrides where set),',
        'then weather and what to bring, headcount and check-in status, allergy alerts, outstanding day-of tasks, and the run sheet with how light it will be at each item.',
        'Flag anything that looks risky or forgotten. You can use the Bonfire tools to fix things if I ask.',
        '',
        json('Overview', overview),
        json('Sun & light timing', light),
        json('Weather', weather),
        json('Outstanding day-of tasks', dayOf)
      ].join('\n')
    }
  },
  {
    name: 'chase_pending_rsvps',
    title: 'Chase pending RSVPs',
    description: 'Draft a WhatsApp message nudging invited guests who have not replied yet.',
    arguments: [{ name: 'tone', description: 'Optional tone, e.g. friendly, firm, funny.' }],
    async build(args, ctx) {
      const [event, guests] = await Promise.all([
        need(ctx.call('GET', `/events/${ctx.eventId}`)),
        need(ctx.call('GET', `/events/${ctx.eventId}/guests`)) as Promise<Record<string, unknown>[]>
      ])
      const pending = guests
        .filter(g => g.rsvp_status === 'invited')
        .map(g => ({ id: g.id, name: g.name, on_whatsapp: g.on_whatsapp }))
      return [
        `Draft a WhatsApp message (${args.tone || 'friendly'} tone) chasing the guests below who have been invited to ${event.name} on ${event.date} but have not replied.`,
        'Use WhatsApp formatting (*bold*, _italic_), keep it brief, mention the RSVP link, and say what we need from them (yes/no, food choice, allergies, pickup time, emergency contact).',
        'Also give me a separate one-line nudge I could send individually, and point out anyone who is not on WhatsApp so I can contact them another way.',
        '',
        `RSVP link: ${ctx.origin}/rsvp/${event.id}`,
        json(`Guests awaiting a reply (${pending.length})`, pending)
      ].join('\n')
    }
  },
  {
    name: 'budget_review',
    title: 'Budget review',
    description: 'Summarise spending vs budget and contributions vs milestones, with suggestions.',
    arguments: [],
    async build(_args, ctx) {
      const [event, finance, milestones] = await Promise.all([
        need(ctx.call('GET', `/events/${ctx.eventId}`)),
        need(ctx.call('GET', `/events/${ctx.eventId}/finance`)),
        need(ctx.call('GET', `/events/${ctx.eventId}/milestones`)) as Promise<{ milestones: Record<string, unknown>[]; total_raised: number }>
      ])
      const milestoneSummary = milestones.milestones.map(m => ({
        name: m.name, target_gbp: Number(m.amount) / 100, unlocked: Number(m.amount) <= milestones.total_raised
      }))
      return [
        `Review the budget for ${event.name}. Amounts are GBP (milestone targets converted from pence).`,
        'Give me: total budgeted vs actual spend by category, where we are over/under, contributions raised vs the next milestone',
        `(match-funding ratio is ${event.contribution_match_ratio}), who has paid for what so we can settle up, and any missing costs you would expect for a bonfire night.`,
        '',
        json('Transactions', finance),
        json('Milestones', { total_raised_gbp: milestones.total_raised / 100, milestones: milestoneSummary })
      ].join('\n')
    }
  },
  {
    name: 'shopping_list',
    title: 'Food shopping list',
    description: 'Food quantities from the app\'s algorithm turned into a shopping list, with allergy considerations.',
    arguments: [],
    async build(_args, ctx) {
      const food = await buildFood(ctx)
      return [
        'Turn this into a practical shopping list for the bonfire BBQ. Keep the burger/sausage/bun quantities exactly as calculated,',
        'suggest sensible extras (sauces, napkins, charcoal, etc.), and call out anything needed for the guests with dietary needs (e.g. gluten-free buns).',
        'Finish with a WhatsApp-ready version.',
        '',
        json('Food calculation', food)
      ].join('\n')
    }
  }
]

export const PROMPTS_BY_NAME = new Map(PROMPTS.map(p => [p.name, p]))
