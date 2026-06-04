import { useState, useEffect } from 'react'
import { Wind, Droplets, Sun, Moon, Thermometer, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import SunCalc from 'suncalc'
import { Card } from './ui/card'
import { formatDate, formatTime, cn } from '../lib/utils'

interface WeatherResult {
  date: string
  temp_max: number
  temp_min: number
  temp_avg: number
  precipitation_probability: number
  wind_speed: number
  weather_description: string
  confidence: number
  is_estimate: boolean
  sources: string[]
}

interface SunData {
  sunrise: Date
  sunset: Date
  goldenHourStart: Date
  civilTwilightEnd: Date
  nauticalTwilightEnd: Date
}

interface WeatherWidgetProps {
  lat?: number
  lon?: number
  eventDate: Date
  compact?: boolean
  walkByOverride?: string
  fireworksOverride?: string
  lightNotes?: string
}

interface WeatherCardProps {
  lat?: number
  lon?: number
  eventDate: Date
}

interface LightLevelsCardProps {
  lat?: number
  lon?: number
  eventDate: Date
  walkByOverride?: string
  fireworksOverride?: string
  lightNotes?: string
}

const DEFAULT_LAT = 51.822
const DEFAULT_LON = -3.016

function getSunData(date: Date, lat: number, lon: number): SunData {
  const times = SunCalc.getTimes(date, lat, lon)
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    goldenHourStart: times.goldenHour,
    civilTwilightEnd: times.dusk,
    nauticalTwilightEnd: times.nauticalDusk
  }
}

function getWeatherIcon(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('snow')) return '🌨️'
  if (d.includes('heavy rain') || d.includes('heavy shower')) return '🌧️'
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌦️'
  if (d.includes('fog') || d.includes('mist')) return '🌫️'
  if (d.includes('overcast') || d.includes('cloud')) return '☁️'
  if (d.includes('partly')) return '⛅'
  if (d.includes('clear') || d.includes('sunny')) return '☀️'
  return '🌤️'
}

function useWeather(eventDate: Date, lat: number, lon: number) {
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dateStr = eventDate.toISOString().split('T')[0]
    fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}&date=${dateStr}`)
      .then(r => r.ok ? r.json() as Promise<WeatherResult> : null)
      .then(data => { if (data) setWeather(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lat, lon, eventDate])

  return { weather, loading }
}

export function WeatherCard({ lat = DEFAULT_LAT, lon = DEFAULT_LON, eventDate }: WeatherCardProps) {
  const { weather, loading } = useWeather(eventDate, lat, lon)

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-32">
        <Loader2 size={16} className="text-fire-400 animate-spin" />
      </Card>
    )
  }

  const icon = getWeatherIcon(weather?.weather_description ?? '')

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-smoke-100">5th November Forecast</h3>
          <p className="text-xs text-smoke-500">{formatDate(eventDate, 'EEEE d MMMM yyyy')}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>

      <p className="text-base font-medium text-smoke-200 mb-3">
        {weather?.weather_description ?? 'No forecast available yet'}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <StatBox icon={<Thermometer size={14} className="text-fire-400" />} label="Temp"
          value={weather ? `${weather.temp_min}–${weather.temp_max}°C` : '–'} />
        <StatBox icon={<Droplets size={14} className="text-blue-400" />} label="Rain"
          value={weather ? `${weather.precipitation_probability}%` : '–'} />
        <StatBox icon={<Wind size={14} className="text-smoke-400" />} label="Wind"
          value={weather ? `${weather.wind_speed} km/h` : '–'} />
      </div>

      <div className="mt-3 space-y-1">
        {weather?.is_estimate && (
          <p className="text-[11px] text-amber-400/70 flex items-center gap-1">
            <AlertCircle size={10} />
            No forecast available yet — showing historical average
          </p>
        )}
        {weather?.sources && !weather.is_estimate && (
          <p className="text-[10px] text-smoke-600">
            Sources: {[...new Set(weather.sources)].join(' + ')}
            {weather.confidence < 0.8 && ' · low confidence'}
          </p>
        )}
      </div>
    </Card>
  )
}

export function LightLevelsCard({ lat = DEFAULT_LAT, lon = DEFAULT_LON, eventDate, walkByOverride, fireworksOverride, lightNotes }: LightLevelsCardProps) {
  const sunData = getSunData(eventDate, lat, lon)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-smoke-100">Light Levels</h3>
        <span className="flex items-center gap-0.5 text-xs text-fire-400">
          Configure <ChevronRight size={12} />
        </span>
      </div>

      <div className="space-y-1.5">
        <LightRow icon={<Sun size={12} className="text-amber-400" />} label="Sunrise" time={sunData.sunrise} />
        <LightRow icon={<Sun size={12} className="text-orange-400" />} label="Golden hour" time={sunData.goldenHourStart} />
        <LightRow icon={<Sun size={12} className="text-fire-400" />} label="Sunset" time={sunData.sunset} />
        <LightRow icon={<Moon size={12} className="text-indigo-400" />} label="Civil dusk" time={sunData.civilTwilightEnd}
          note={walkByOverride ? `⚑ Start walk by ${formatTime(walkByOverride)}` : 'Start walk by here'} />
        <LightRow icon={<Moon size={12} className="text-purple-400" />} label="Full dark" time={sunData.nauticalTwilightEnd}
          note={fireworksOverride ? `🎆 Fireworks after ${formatTime(fireworksOverride)}` : '🎆 Good for fireworks'} highlight />
      </div>

      {(walkByOverride || fireworksOverride) && (
        <div className="mt-2 space-y-1">
          {walkByOverride && (
            <p className="text-xs text-fire-400 font-medium">⚑ Walk starts by {formatTime(walkByOverride)}</p>
          )}
          {fireworksOverride && (
            <p className="text-xs text-purple-400 font-medium">🎆 Fireworks planned after {formatTime(fireworksOverride)}</p>
          )}
        </div>
      )}

      {lightNotes && (
        <p className="text-xs text-smoke-400 mt-2 border-t border-white/5 pt-2">{lightNotes}</p>
      )}
    </Card>
  )
}

export function WeatherWidget({ lat = DEFAULT_LAT, lon = DEFAULT_LON, eventDate, compact = false, walkByOverride, fireworksOverride, lightNotes }: WeatherWidgetProps) {
  const { weather, loading } = useWeather(eventDate, lat, lon)
  const [sunData, setSunData] = useState<SunData | null>(null)

  useEffect(() => {
    setSunData(getSunData(eventDate, lat, lon))
  }, [lat, lon, eventDate])

  if (loading) {
    return (
      <Card className={cn('flex items-center justify-center', compact ? 'h-14' : 'h-40')}>
        <Loader2 size={16} className="text-fire-400 animate-spin" />
      </Card>
    )
  }

  const icon = getWeatherIcon(weather?.weather_description ?? '')

  if (compact) {
    return (
      <Card className="p-3 flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-smoke-100 truncate">
            {weather?.weather_description ?? 'Loading…'}
          </p>
          <p className="text-xs text-smoke-400">
            {weather ? `${weather.temp_min}° – ${weather.temp_max}°C · ${weather.precipitation_probability}% rain` : ''}
          </p>
        </div>
        {weather?.is_estimate && (
          <AlertCircle size={14} className="text-amber-400 shrink-0" aria-label="Historical estimate" />
        )}
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-smoke-100">5th November Forecast</h3>
          <p className="text-xs text-smoke-500">{formatDate(eventDate, 'EEEE d MMMM yyyy')}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>

      <p className="text-base font-medium text-smoke-200 mb-3">
        {weather?.weather_description ?? 'No forecast available yet'}
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox icon={<Thermometer size={14} className="text-fire-400" />} label="Temp"
          value={weather ? `${weather.temp_min}–${weather.temp_max}°C` : '–'} />
        <StatBox icon={<Droplets size={14} className="text-blue-400" />} label="Rain"
          value={weather ? `${weather.precipitation_probability}%` : '–'} />
        <StatBox icon={<Wind size={14} className="text-smoke-400" />} label="Wind"
          value={weather ? `${weather.wind_speed} km/h` : '–'} />
      </div>

      {sunData && (
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-smoke-400 uppercase tracking-wider">Light levels</p>
            <p className="text-[10px] text-smoke-600">Set precise times in Settings</p>
          </div>
          <div className="space-y-1.5">
            <LightRow icon={<Sun size={12} className="text-amber-400" />} label="Sunrise" time={sunData.sunrise} />
            <LightRow icon={<Sun size={12} className="text-orange-400" />} label="Golden hour" time={sunData.goldenHourStart} />
            <LightRow icon={<Sun size={12} className="text-fire-400" />} label="Sunset" time={sunData.sunset} />
            <LightRow icon={<Moon size={12} className="text-indigo-400" />} label="Civil dusk" time={sunData.civilTwilightEnd}
              note={walkByOverride ? `⚑ Start walk by ${formatTime(walkByOverride)}` : 'Start walk by here'} />
            <LightRow icon={<Moon size={12} className="text-purple-400" />} label="Full dark" time={sunData.nauticalTwilightEnd}
              note={fireworksOverride ? `🎆 Fireworks after ${formatTime(fireworksOverride)}` : '🎆 Good for fireworks'} highlight />
          </div>
          {(walkByOverride || fireworksOverride) && (
            <div className="mt-2 space-y-1">
              {walkByOverride && (
                <p className="text-xs text-fire-400 font-medium">⚑ Walk starts by {formatTime(walkByOverride)}</p>
              )}
              {fireworksOverride && (
                <p className="text-xs text-purple-400 font-medium">🎆 Fireworks planned after {formatTime(fireworksOverride)}</p>
              )}
            </div>
          )}
          {lightNotes && (
            <p className="text-xs text-smoke-400 mt-2 border-t border-white/5 pt-2">{lightNotes}</p>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1">
        {weather?.is_estimate && (
          <p className="text-[11px] text-amber-400/70 flex items-center gap-1">
            <AlertCircle size={10} />
            No forecast available yet — showing historical average
          </p>
        )}
        {weather?.sources && !weather.is_estimate && (
          <p className="text-[10px] text-smoke-600">
            Sources: {[...new Set(weather.sources)].join(' + ')}
            {weather.confidence < 0.8 && ' · low confidence'}
          </p>
        )}
      </div>
    </Card>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-2 text-center">
      <span className="flex justify-center mb-1">{icon}</span>
      <p className="text-xs text-smoke-400">{label}</p>
      <p className="text-sm font-semibold text-smoke-100">{value}</p>
    </div>
  )
}

function LightRow({ icon, label, time, note, highlight }: {
  icon: React.ReactNode; label: string; time: Date; note?: string; highlight?: boolean
}) {
  const timeStr = time instanceof Date && !isNaN(time.getTime())
    ? formatTime(time.toTimeString().slice(0, 5))
    : '–'
  return (
    <div className={cn('flex items-center gap-2 text-xs', highlight ? 'text-fire-300' : '')}>
      <span className="shrink-0">{icon}</span>
      <span className={cn('flex-1', highlight ? 'text-fire-300 font-medium' : 'text-smoke-400')}>{label}</span>
      <span className={cn('font-mono font-medium shrink-0', highlight ? 'text-fire-300' : 'text-smoke-200')}>{timeStr}</span>
      {note && <span className="text-smoke-500 text-[10px] ml-1 shrink-0">{note}</span>}
    </div>
  )
}
