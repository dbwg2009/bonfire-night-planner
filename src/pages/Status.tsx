import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, CheckCircle2, XCircle, CircleHelp, Activity } from 'lucide-react'
import { FireBackground } from '../components/FireBackground'
import { cn } from '../lib/utils'

interface ApiComponent {
  key: string
  label: string
  ok: boolean
  latency_ms: number
  error: string | null
  uptime_24h: number | null
  history: boolean[]
}
interface StatusResponse {
  checked_at: string
  overall: 'operational' | 'partial' | 'major'
  components: ApiComponent[]
}

type State = 'up' | 'down' | 'unknown'
interface Row {
  key: string
  label: string
  state: State
  latency_ms: number | null
  error: string | null
  uptime_24h: number | null
  history: boolean[]
}

// Mirrors the backend list — used to render a sensible fallback when the API
// itself can't be reached.
const COMPONENTS = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'api', label: 'API / Functions' },
  { key: 'database', label: 'Database (D1)' },
  { key: 'auth', label: 'Auth service' },
  { key: 'weather', label: 'Weather / external' }
]

export default function Status() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [apiLatency, setApiLatency] = useState<number | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const start = performance.now()
    try {
      const res = await fetch('/api/status', { headers: { 'cache-control': 'no-cache' } })
      setApiLatency(Math.round(performance.now() - start))
      const json = (await res.json()) as StatusResponse
      setData(json)
      setFailed(false)
    } catch {
      setFailed(true)
      setData(null)
    } finally {
      setLastChecked(new Date())
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const rows: Row[] = data
    ? data.components.map(c => ({
        key: c.key,
        label: c.label,
        state: c.ok ? 'up' : 'down',
        latency_ms: c.key === 'api' ? apiLatency : c.latency_ms,
        error: c.error,
        uptime_24h: c.uptime_24h,
        history: c.history
      }))
    : failed
      ? COMPONENTS.map(({ key, label }) => ({
          key,
          label,
          // The frontend is clearly up (this page rendered); the API is down;
          // anything behind the API can't be determined.
          state: key === 'frontend' ? 'up' : key === 'api' ? 'down' : 'unknown',
          latency_ms: key === 'api' ? apiLatency : null,
          error: key === 'api' ? 'No response from backend' : null,
          uptime_24h: null,
          history: []
        }))
      : []

  const overall: 'operational' | 'partial' | 'major' =
    failed || rows.some(r => r.key === 'api' && r.state === 'down')
      ? 'major'
      : data?.overall ?? 'operational'

  const banner = {
    operational: { label: 'All systems operational', dot: 'bg-emerald-400', text: 'text-emerald-400', box: 'bg-emerald-500/10 border-emerald-500/30' },
    partial: { label: 'Partial outage', dot: 'bg-amber-400', text: 'text-amber-400', box: 'bg-amber-500/10 border-amber-500/30' },
    major: { label: 'Major outage', dot: 'bg-red-400', text: 'text-red-400', box: 'bg-red-500/10 border-red-500/30' }
  }[overall]

  return (
    <div className="min-h-dvh min-h-screen relative">
      <FireBackground />
      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="text-fire-400" size={22} />
            <h1 className="text-xl font-bold text-smoke-100">System Status</h1>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl glass text-smoke-300 hover:text-smoke-100 transition-colors disabled:opacity-50 tap-highlight-none"
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        <div className={cn('rounded-2xl border px-4 py-4 mb-4 flex items-center gap-3', banner.box)}>
          <span className={cn('w-2.5 h-2.5 rounded-full animate-pulse-glow', banner.dot)} />
          <span className={cn('font-semibold', banner.text)}>{banner.label}</span>
        </div>

        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.key} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {r.state === 'up' && <CheckCircle2 size={18} className="text-emerald-400" />}
                  {r.state === 'down' && <XCircle size={18} className="text-red-400" />}
                  {r.state === 'unknown' && <CircleHelp size={18} className="text-smoke-400" />}
                  <span className="font-medium text-smoke-100">{r.label}</span>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      r.state === 'up' ? 'text-emerald-400' : r.state === 'down' ? 'text-red-400' : 'text-smoke-400'
                    )}
                  >
                    {r.state === 'up' ? 'Operational' : r.state === 'down' ? 'Down' : 'Unknown'}
                  </span>
                  {r.state === 'up' && r.latency_ms != null && (
                    <span className="block text-[11px] text-smoke-400">{r.latency_ms} ms</span>
                  )}
                </div>
              </div>

              {r.history.length > 0 && (
                <div className="flex items-end gap-[3px] mt-3 h-6">
                  {r.history.map((ok, i) => (
                    <div
                      key={i}
                      className={cn('flex-1 rounded-sm min-w-[2px]', ok ? 'bg-emerald-400/70' : 'bg-red-400/70')}
                      style={{ height: ok ? '100%' : '55%' }}
                      title={ok ? 'up' : 'down'}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-2 gap-2">
                {r.uptime_24h != null ? (
                  <span className="text-[11px] text-smoke-400">{r.uptime_24h}% uptime (24h)</span>
                ) : (
                  <span className="text-[11px] text-smoke-500">No history yet</span>
                )}
                {r.state !== 'up' && r.error && (
                  <span className="text-[11px] text-red-400/80 truncate" title={r.error}>{r.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between text-xs text-smoke-500">
          <span>{lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking…'}</span>
          <Link to="/" className="hover:text-smoke-300 transition-colors">← Back to app</Link>
        </div>
        <p className="mt-3 text-[11px] text-smoke-500 text-center">
          Checks run while this page is open and refresh every 30s. History reflects recent checks, not continuous monitoring.
        </p>
      </div>
    </div>
  )
}
