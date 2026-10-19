import SunCalc from 'suncalc'

// Pure sun/light-level maths shared by the Light Levels page and the MCP server.
// Minute-based helpers work in the runtime's local time zone (the browser for the
// page); callers needing a specific zone should use the Date-based `sunAltDegAt`.

export const DEFAULT_LAT = 51.822
export const DEFAULT_LON = -3.016

// ─── Time helpers ───────────────────────────────────────────────────────────────

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(mins: number): string {
  const v = Math.max(0, Math.min(1439, Math.round(mins)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

export function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function dateToMinutes(d: Date | null): number | null {
  return d ? d.getHours() * 60 + d.getMinutes() : null
}

// ─── Sun position ───────────────────────────────────────────────────────────────

export function sunAltDegAt(when: Date, lat: number, lon: number): number {
  return (SunCalc.getPosition(when, lat, lon).altitude * 180) / Math.PI
}

export function getSunAltDeg(minutes: number, date: Date, lat: number, lon: number): number {
  const d = new Date(date)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return sunAltDegAt(d, lat, lon)
}

// Perceptual brightness 0–100 from sun altitude. Anchored so that below the
// horizon reads low: sunset(0°)≈60, civil dusk(−6°)≈25, nautical(−12°)≈6, astro(−18°)=0.
export function lightPctFromAlt(altDeg: number): number {
  const stops: [number, number][] = [[6, 100], [0, 60], [-6, 25], [-12, 6], [-18, 0]]
  if (altDeg >= stops[0][0]) return 100
  if (altDeg <= stops[stops.length - 1][0]) return 0
  for (let i = 0; i < stops.length - 1; i++) {
    const [a1, p1] = stops[i]
    const [a2, p2] = stops[i + 1]
    if (altDeg <= a1 && altDeg >= a2) {
      const t = (altDeg - a2) / (a1 - a2)
      return Math.round(p2 + t * (p1 - p2))
    }
  }
  return 0
}

// ─── Smart timing ─────────────────────────────────────────────────────────────

export interface SmartTiming {
  departBy: Date | null
  bonfireStart: Date | null
  bonfireEnd: Date | null
  fireworksAfter: Date | null
}

export function computeSmartTiming(
  eventDate: Date, lat: number, lon: number, walkMins: number, setupMins: number
): SmartTiming {
  const times = SunCalc.getTimes(eventDate, lat, lon)
  const valid = (d: unknown): d is Date => d instanceof Date && !isNaN((d as Date).getTime())

  const civilDusk    = valid(times.dusk)         ? times.dusk         : null
  const nauticalDusk = valid(times.nauticalDusk) ? times.nauticalDusk : null
  const astDusk      = valid(times.night)        ? times.night        : null  // sun 18° below

  // Setup must finish halfway into nautical twilight (between civil & nautical dusk)
  const setupDeadline = civilDusk && nauticalDusk
    ? new Date((civilDusk.getTime() + nauticalDusk.getTime()) / 2)
    : null
  const departBy = setupDeadline
    ? new Date(setupDeadline.getTime() - (walkMins + setupMins) * 60_000)
    : null

  return { departBy, bonfireStart: nauticalDusk, bonfireEnd: astDusk, fireworksAfter: astDusk }
}
