import SunCalc from 'suncalc'
import type { CombinedWeather, SunData, WeatherForecast } from './types'

// WMO weather codes → description mapping
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle',
  55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Light showers',
  81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 99: 'Thunderstorm with hail'
}

// Source reliability weights (higher = more trusted for UK)
const SOURCE_WEIGHTS = {
  'Met Office': 0.50,
  'Open-Meteo': 0.35,
  'OpenWeatherMap': 0.15
} as const

export async function fetchOpenMeteo(lat: number, lon: number): Promise<WeatherForecast[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode&timezone=Europe%2FLondon&forecast_days=16`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Open-Meteo unavailable')
  const data = await res.json()
  return data.daily.time.map((date: string, i: number) => ({
    date,
    temp_max: data.daily.temperature_2m_max[i],
    temp_min: data.daily.temperature_2m_min[i],
    temp_avg: (data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2,
    precipitation_probability: data.daily.precipitation_probability_max[i] ?? 0,
    wind_speed: data.daily.windspeed_10m_max[i] ?? 0,
    weather_code: data.daily.weathercode[i] ?? 0,
    weather_description: WMO_CODES[data.daily.weathercode[i]] ?? 'Unknown',
    source: 'Open-Meteo',
    confidence: SOURCE_WEIGHTS['Open-Meteo']
  }))
}

export async function fetchMetOffice(lat: number, lon: number, apiKey: string): Promise<WeatherForecast[]> {
  const url = `https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/daily?latitude=${lat}&longitude=${lon}&includeLocationName=false`
  const res = await fetch(url, {
    headers: { apikey: apiKey, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error('Met Office unavailable')
  const data = await res.json()
  const params = data.features?.[0]?.properties?.timeSeries ?? []
  return params.map((p: Record<string, unknown>) => ({
    date: typeof p.time === 'string' ? p.time.split('T')[0] : '',
    temp_max: (p.dayMaxScreenTemperature as number) ?? (p.nightMinScreenTemperature as number) ?? 10,
    temp_min: (p.nightMinScreenTemperature as number) ?? 5,
    temp_avg: (((p.dayMaxScreenTemperature as number) ?? 10) + ((p.nightMinScreenTemperature as number) ?? 5)) / 2,
    precipitation_probability: (p.dayProbabilityOfPrecipitation as number) ?? (p.nightProbabilityOfPrecipitation as number) ?? 0,
    wind_speed: (p.midday10MWindSpeed as number) ?? 0,
    weather_code: 0,
    weather_description: getMODescription((p.daySignificantWeatherCode as number) ?? (p.nightSignificantWeatherCode as number)),
    source: 'Met Office',
    confidence: SOURCE_WEIGHTS['Met Office']
  }))
}

function getMODescription(code?: number): string {
  const mo: Record<number, string> = {
    0: 'Clear night', 1: 'Sunny', 2: 'Partly cloudy', 3: 'Partly cloudy',
    5: 'Mist', 6: 'Fog', 7: 'Cloudy', 8: 'Overcast', 9: 'Light rain shower',
    10: 'Light rain shower', 11: 'Drizzle', 12: 'Light drizzle', 14: 'Showers',
    15: 'Heavy rain shower', 17: 'Sleet shower', 20: 'Hail shower',
    21: 'Heavy hail shower', 22: 'Light snow shower', 23: 'Light snow shower',
    24: 'Heavy snow shower', 25: 'Heavy snow shower', 26: 'Light rain', 27: 'Heavy rain',
    28: 'Thunder shower', 29: 'Thunder shower', 30: 'Thunder'
  }
  return mo[code ?? -1] ?? 'Unknown'
}

export function combineForecasts(forecasts: WeatherForecast[][]): CombinedWeather[] {
  const byDate = new Map<string, WeatherForecast[]>()
  for (const sourceForecasts of forecasts) {
    for (const f of sourceForecasts) {
      if (!byDate.has(f.date)) byDate.set(f.date, [])
      byDate.get(f.date)!.push(f)
    }
  }

  const result: CombinedWeather[] = []
  for (const [date, items] of byDate.entries()) {
    const totalWeight = items.reduce((s, f) => s + f.confidence, 0)
    if (totalWeight === 0) continue
    const w = (f: WeatherForecast) => f.confidence / totalWeight

    result.push({
      date,
      temp_max: items.reduce((s, f) => s + f.temp_max * w(f), 0),
      temp_min: items.reduce((s, f) => s + f.temp_min * w(f), 0),
      temp_avg: items.reduce((s, f) => s + f.temp_avg * w(f), 0),
      // Pessimistic: take the highest weighted precipitation probability
      precipitation_probability: Math.max(...items.map(f => f.precipitation_probability)),
      wind_speed: items.reduce((s, f) => s + f.wind_speed * w(f), 0),
      weather_description: items.sort((a, b) => b.confidence - a.confidence)[0].weather_description,
      confidence: Math.min(totalWeight, 1),
      sources: [...new Set(items.map(f => f.source))]
    })
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

export function getSunData(date: Date, lat: number, lon: number): SunData {
  const times = SunCalc.getTimes(date, lat, lon)
  const golden = SunCalc.getTimes(date, lat, lon)
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    goldenHourStart: golden.goldenHour,
    goldenHourEnd: golden.goldenHourEnd,
    civilTwilightEnd: times.dusk,
    nauticalTwilightEnd: times.nauticalDusk,
    dusk: times.night
  }
}

// Average November 5th UK climate (for when forecast isn't available)
export function getNovemberClimate(): CombinedWeather {
  return {
    date: 'climate-average',
    temp_max: 10,
    temp_min: 5,
    temp_avg: 7.5,
    precipitation_probability: 55,
    wind_speed: 20,
    weather_description: 'Typically cloudy with some rain likely',
    confidence: 0.3, // low confidence — historical average only
    sources: ['Historical average']
  }
}

export function getWeatherIcon(description: string): string {
  const d = description.toLowerCase()
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('snow') || d.includes('sleet')) return '🌨️'
  if (d.includes('heavy rain') || d.includes('heavy shower')) return '🌧️'
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌦️'
  if (d.includes('fog') || d.includes('mist')) return '🌫️'
  if (d.includes('overcast') || d.includes('cloudy')) return '☁️'
  if (d.includes('partly')) return '⛅'
  if (d.includes('clear') || d.includes('sunny')) return '☀️'
  return '🌤️'
}
