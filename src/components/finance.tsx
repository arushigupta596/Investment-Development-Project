import { useEffect, type ReactNode } from 'react'
import { AlertOctagon, CheckCircle2, CircleDashed, Loader2, X } from 'lucide-react'
import type { StageStatus } from '../lib/finance'

export const aed = (n: number) => (n < 0 ? '(' : '') + Math.abs(Math.round(n)).toLocaleString('en-US') + (n < 0 ? ')' : '')

export function SidePanel({ title, eyebrow, onClose, children, wide }: { title: ReactNode; eyebrow?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ido-navy/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside className={`absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <header className="flex items-start justify-between gap-3 bg-ido-navy p-5 text-white">
          <div className="min-w-0">
            {eyebrow && <div className="truncate text-xs text-white/60">{eyebrow}</div>}
            <h2 className="mt-1 text-lg font-semibold">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/70 hover:bg-white/10" aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  )
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-0 rounded-lg border border-ido-line bg-white px-2.5 text-sm text-ido-navy outline-none focus:border-ido-teal focus:ring-1 focus:ring-ido-teal">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const STAGE_STYLE: Record<StageStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
  Done: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', Icon: CheckCircle2 },
  'In progress': { cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', Icon: Loader2 },
  Blocked: { cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', Icon: AlertOctagon },
  'Not started': { cls: 'bg-slate-100 text-slate-500 ring-slate-500/20', Icon: CircleDashed },
}
export function StageChip({ status, compact }: { status: StageStatus; compact?: boolean }) {
  const { cls, Icon } = STAGE_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <Icon size={12} /> {!compact && status}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-ido-slate">{children}</div>
}
