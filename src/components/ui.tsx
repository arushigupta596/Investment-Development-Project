import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { healthBand } from '../lib/metrics'
import { Hero, Sparkline } from './fx'
import { C } from './charts'

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-ido-line px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-ido-primary">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Kpi({
  label, value, sub, delta, tone = 'default', icon, spark, onClick, active, hint,
}: {
  label: string; value: ReactNode; sub?: ReactNode; delta?: number; tone?: 'default' | 'warn' | 'bad' | 'good'; icon?: ReactNode
  spark?: number[]; onClick?: () => void; active?: boolean; hint?: string
}) {
  const toneCls = { default: 'text-ido-primary', warn: 'text-amber-600', bad: 'text-rose-600', good: 'text-emerald-600' }[tone]
  const sparkColor = { default: C.teal, warn: '#D97706', bad: '#E11D48', good: '#059669' }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      title={hint}
      className={`card card-pad group flex flex-col gap-1.5 text-left transition ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-ido-sky hover:shadow-md' : ''} ${active ? 'border-ido-teal ring-2 ring-ido-teal/20' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-ido-sky transition group-hover:text-ido-teal">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className={`text-[28px] font-semibold leading-tight tracking-tightish ${toneCls}`}>{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      <div className="flex items-center gap-2 text-xs text-ido-slate">
        {delta !== undefined && (
          <span className={`inline-flex items-center font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(delta).toFixed(1)} pts
          </span>
        )}
        {sub}
        {onClick && <span className="ml-auto text-ido-teal opacity-0 transition group-hover:opacity-100">View →</span>}
      </div>
    </Tag>
  )
}

const PILL: Record<string, string> = {
  'Signed off': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'Pending review': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'In progress': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Not started': 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Open: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  'In review': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  High: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Low: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Done: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Blocked: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  OK: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Delayed: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'Short-paid': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Unpaid, past due': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  'Not yet due': 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Pass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Variance: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Fail: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Manual: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Unsupported: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Suspense: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}
export function Pill({ children }: { children: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PILL[children] ?? 'bg-ido-mist text-ido-primary ring-ido-line'}`}>{children}</span>
}

export function Health({ value }: { value: number }) {
  const band = healthBand(value)
  const cls = band === 'good' ? 'bg-emerald-500' : band === 'watch' ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ido-line">
        <div className={`h-full ${cls}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function TenantMark({ short, size = 32 }: { short: string; size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-lg bg-ido-primary/10 font-semibold text-ido-primary" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {short}
    </span>
  )
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return <Hero eyebrow={eyebrow} title={title} subtitle={subtitle} right={children} />
}
