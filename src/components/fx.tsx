import { useEffect, useRef, useState, type ReactNode } from 'react'
import { C } from './charts'
import { currentBrand } from '../lib/brand'

/** Animates a number from its previous value to the new one. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), ms = 700 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(a + (value - a) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    // rAF pauses in hidden tabs; make sure the final value always lands
    const done = setTimeout(() => {
      setShown(value)
      from.current = value
    }, ms + 80)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [value, ms])
  return <>{format(shown)}</>
}

export function Sparkline({ data, color = C.teal, height = 28, width = 96 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const id = 'sp' + Math.abs(data.reduce((s, v) => s * 31 + v, 7) | 0)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={2.6} fill={color} />
    </svg>
  )
}

/** Navy hero band in the ido.ae style. */
export function Hero({ eyebrow, title, subtitle, right, children }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative -mx-4 -mt-6 mb-6 overflow-hidden bg-ido-navy px-4 pb-8 pt-8 text-white md:-mx-8 md:-mt-8 md:px-8 md:pt-10">
      {currentBrand().mark && <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] opacity-[0.06]" style={{ backgroundImage: `url(${currentBrand().mark})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', filter: 'brightness(0) invert(1)', maskImage: 'linear-gradient(to left, black 30%, transparent 90%)', WebkitMaskImage: 'linear-gradient(to left, black 30%, transparent 90%)' }} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ido-sky/50 to-transparent" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ido-sky">{eyebrow}</div>}
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-[40px]">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-white/65 md:text-base">{subtitle}</p>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {children && <div className="relative mt-6">{children}</div>}
    </section>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-ido-line px-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`relative whitespace-nowrap px-3 py-3 text-sm font-semibold transition ${value === t.id ? 'text-ido-primary' : 'text-ido-slate hover:text-ido-primary'}`}
        >
          {t.label}
          {t.count !== undefined && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${value === t.id ? 'bg-ido-primary text-white' : 'bg-ido-mist text-ido-slate'}`}>{t.count}</span>}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ido-teal" />}
        </button>
      ))}
    </div>
  )
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ido-navy px-5 py-3 text-sm font-medium text-white shadow-2xl ring-1 ring-white/10">
      {text}
    </div>
  )
}

export function Timeline({ items }: { items: { id: number; at: string; who: string; text: string; kind: 'system' | 'action' | 'comment' }[] }) {
  if (!items.length) return <div className="py-6 text-center text-sm text-ido-slate">No activity yet.</div>
  return (
    <ol className="relative space-y-4 border-l border-ido-line pl-5">
      {[...items].sort((a, b) => (a.at < b.at ? 1 : -1)).map((a) => (
        <li key={a.id} className="relative">
          <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${a.kind === 'system' ? 'bg-ido-sky' : a.kind === 'comment' ? 'bg-amber-500' : 'bg-ido-teal'}`} />
          <div className="text-sm">
            <span className="font-semibold text-ido-primary">{a.who}</span>{' '}
            {a.kind === 'comment' ? <span className="text-ido-slate">commented</span> : <span className="text-ido-navy/80">{a.text}</span>}
          </div>
          {a.kind === 'comment' && <div className="mt-1 rounded-lg bg-ido-mist px-3 py-2 text-sm text-ido-navy/90">{a.text}</div>}
          <div className="mt-0.5 text-xs text-ido-muted">{new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
        </li>
      ))}
    </ol>
  )
}
