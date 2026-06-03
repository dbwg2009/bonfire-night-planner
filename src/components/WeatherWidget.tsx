import { useState, useEffect } from 'react'
import { Wind, Droplets, Sun, Moon, Thermometer, AlertCircle } from 'lucide-react'
import { Card } from './ui/card'
import { combineForecasts, fetchOpenMeteo, getNovemberClimate, getSunData, getWeatherIcon } from '../lib/weather'
import type { CombinedWeather, SunData } from '../lib/types'
import { formatDate, formatTime } from '../lib/utils'
import { cn } from '../lib/utils'

interface WeatherWidgetProps {
  lat?: number
  lon?: number
  eventDate: Date
  compact?: boolean
}

// Default coords: Abergavenny / Monmouthshire area (approximate based on spreadsheet context)
const DEFAULT_LAT = 51.822
const DEFAULT_LON = -3.016

export function WeatherWidget({ lat = DEFAULT_LAT, lon = DEFAULT_LON, eventDate, compact = false }: WeatherWidgetProps) {
  const [forecast, setForecast] = useState<CombinedWeather | null>(null)
  const [sunData, setSunData] = useState<SunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const sun = getSunData(eventDate, lat, lon)
        setSunData(sun)

        const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / 86400000)

        if (daysUntil > 16) {
          // No forecast available yet — show climate average
          setForecast(getNovemberClimate())
        } else {
          const [openMeteo] = await Promise.allSettled([
            fetchOpenMeteo(lat, lon)
          ])

          const forecasts: CombinedWeather[] = []
          if (openMeteo.status === 'fulfilled') {
            const dateStr = eventDate.toISOString().split('T')[0]
            const match = openMeteo.value.find(f => f.date === dateStr)
            if (match) forecasts.push(match as unknown as CombinedWeather)
          }

          if (forecasts.length === 0) {
            const combined = await fetchOpenMeteo(lat, lon)
            const dateStr = eventDate.toISOString().split('T')[0]
            const all = combineForecasts([combined])
            setForecast(all.find(f => f.date === dateStr) ?? getNovemberClimate())
          } else {
            setForecast(forecasts[0])
          }
        }
      } catch {
        setError(true)
        setForecast(getNovemberClimate())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [lat, lon, eventDate])

  if (loading) {
    return (
      <Card className={cn('shimmer', compact ? 'p-3' : 'p-4')}>
        <div className="h-20 opacity-0" />
      </Card>
    )
  }

  const icon = getWeatherIcon(forecast?.weather_description ?? '')
  const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / 86400000)
  const isEstimate = daysUntil > 16 || (forecast?.confidence ?? 1) < 0.5

  if (compact) {
    return (
      <Card className="p-3 flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-smoke-100 truncate">{forecast?.weather_description}</p>
          <p className="text-xs text-smoke-400">
            {Math.round(forecast?.temp_min ?? 0)}° – {Math.round(forecast?.temp_max ?? 0)}°C · {forecast?.precipitation_probability ?? 0}% rain
          </p>
        </div>
        {isEstimate && (
          <AlertCircle size={14} className="text-amber-400 shrink-0" aria-label="Estimate only" />
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

      <p className="text-base font-medium text-smoke-200 mb-3">{forecast?.weather_description}</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="glass rounded-lg p-2 text-center">
          <Thermometer size={14} className="text-fire-400 mx-auto mb-1" />
          <p className="text-xs text-smoke-400">Temp</p>
          <p className="text-sm font-semibold text-smoke-100">
            {Math.round(forecast?.temp_min ?? 0)}–{Math.round(forecast?.temp_max ?? 0)}°C
          </p>
        </div>
        <div className="glass rounded-lg p-2 text-center">
          <Droplets size={14} className="text-blue-400 mx-auto mb-1" />
          <p className="text-xs text-smoke-400">Rain chance</p>
          <p className="text-sm font-semibold text-smoke-100">{forecast?.precipitation_probability ?? 0}%</p>
        </div>
        <div className="glass rounded-lg p-2 text-center">
          <Wind size={14} className="text-smoke-400 mx-auto mb-1" />
          <p className="text-xs text-smoke-400">Wind</p>
          <p className="text-sm font-semibold text-smoke-100">{Math.round(forecast?.wind_speed ?? 0)} km/h</p>
        </div>
      </div>

      {sunData && (
        <div className="border-t border-white/5 pt-3">
          <p className="text-xs font-medium text-smoke-400 uppercase tracking-wider mb-2">Light levels</p>
          <div className="space-y-1.5">
            <LightRow icon={<Sun size={12} className="text-amber-400" />} label="Sunrise" time={sunData.sunrise} />
            <LightRow icon={<Sun size={12} className="text-orange-400" />} label="Golden hour" time={sunData.goldenHourStart} suffix="starts" />
            <LightRow icon={<Sun size={12} className="text-fire-400" />} label="Sunset" time={sunData.sunset} />
            <LightRow icon={<Moon size={12} className="text-indigo-400" />} label="Civil twilight ends" time={sunData.civilTwilightEnd} note="Start walk by here" />
            <LightRow icon={<Moon size={12} className="text-purple-400" />} label="Full dark" time={sunData.nauticalTwilightEnd} note="Good for fireworks 🎆" highlight />
          </div>
        </div>
      )}

      {isEstimate && (
        <p className="text-xs text-amber-400/70 mt-3 flex items-center gap-1">
          <AlertCircle size={11} />
          {daysUntil > 16 ? 'No forecast yet — showing historical average' : 'Estimate only — confidence low'}
        </p>
      )}

      {forecast?.sources && (
        <p className="text-[10px] text-smoke-600 mt-1">
          Sources: {forecast.sources.join(', ')}
        </p>
      )}
    </Card>
  )
}

function LightRow({ icon, label, time, suffix, note, highlight }: {
  icon: React.ReactNode
  label: string
  time: Date
  suffix?: string
  note?: string
  highlight?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2 text-xs', highlight && 'text-fire-300')}>
      <span className="shrink-0">{icon}</span>
      <span className={cn('flex-1', highlight ? 'text-fire-300 font-medium' : 'text-smoke-400')}>
        {label}{suffix ? ` ${suffix}` : ''}
      </span>
      <span className={cn('font-mono font-medium', highlight ? 'text-fire-300' : 'text-smoke-200')}>
        {formatTime(time.toTimeString().slice(0, 5))}
      </span>
      {note && <span className="text-smoke-500 italic ml-1">{note}</span>}
    </div>
  )
}
