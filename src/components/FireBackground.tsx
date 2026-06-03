import { useEffect, useRef, useCallback } from 'react'

interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  decay: number
  color: string
}

const COLORS = ['#ff6b00', '#ff8c2a', '#ffb366', '#e85f00', '#c24800', '#ffd9aa']

export function FireBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const embersRef = useRef<Ember[]>([])
  const animFrameRef = useRef<number>(0)

  const spawnEmber = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    embersRef.current.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(Math.random() * 1.5 + 0.8),
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.3,
      decay: Math.random() * 0.008 + 0.004,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let lastSpawn = 0
    const SPAWN_INTERVAL = 120 // ms between new embers

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (time - lastSpawn > SPAWN_INTERVAL && embersRef.current.length < 40) {
        spawnEmber()
        lastSpawn = time
      }

      embersRef.current = embersRef.current.filter(e => e.opacity > 0)

      for (const ember of embersRef.current) {
        ember.x += ember.vx + Math.sin(time * 0.001 + ember.y * 0.01) * 0.3
        ember.y += ember.vy
        ember.opacity -= ember.decay
        ember.size *= 0.998

        ctx.save()
        ctx.globalAlpha = Math.max(0, ember.opacity)
        ctx.fillStyle = ember.color
        ctx.shadowBlur = ember.size * 4
        ctx.shadowColor = ember.color
        ctx.beginPath()
        ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [spawnEmber])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.35 }}
      aria-hidden="true"
    />
  )
}
