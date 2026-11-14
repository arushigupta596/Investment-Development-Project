import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, ArrowRight, BellRing, Check, CheckCircle2, Info, RotateCcw } from 'lucide-react'
import { Card, TenantMark } from './ui'
import { Toast } from './fx'
import { tenantById } from '../data/tenants'
import type { Action, Category, Severity } from '../lib/actions'
import { fmtAED } from '../lib/metrics'

export const SEV: Record<Severity, { cls: string; dot: string; Icon: typeof AlertOctagon }> = {
  Critical: { cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500', Icon: AlertOctagon },
  High: { cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500', Icon: AlertTriangle },
  Medium: { cls: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500', Icon: Info },
}
const CATS: Category[] = ['Close blocker', 'Revenue at risk', 'Data feed', 'Performance', 'Exceptions']

/** Prioritised action list with filters, reminders and done marks. */
export default function ActionList({ actions, sev, done, toggleDone, className = '', showCompany = true }: { actions: Action[]; sev: Severity | ''; done: Set<string>; toggleDone: (id: string) => void; className?: string; showCompany?: boolean }) {
  const nav = useNavigate()
  const [cat, setCat] = useState<Category | ''>('')
  const [all, setAll] = useState(false)
  const [toast, setToast] = useState('')
  const cats = CATS.filter((c) => actions.some((a) => a.category === c))
  const filtered = actions.filter((a) => (!sev || a.severity === sev) && (!cat || a.category === cat)).sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id)))
  const shown = all ? filtered : filtered.slice(0, 8)
  return (
    <>
        <Card
          title="Immediate actions"
          className={className}
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              {(['', ...cats] as (Category | '')[]).map((c) => (
                <button key={c} onClick={() => setCat(c)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cat === c ? 'bg-ido-primary text-white' : 'bg-ido-mist text-ido-primary hover:bg-ido-line'}`}>
                  {c || 'All'}
                </button>
              ))}
            </div>
          }
        >
          {shown.length ? (
            <ul className="divide-y divide-ido-line">
              {shown.map((a) => {
                const t = tenantById(a.tenantId)!
                const S = SEV[a.severity]
                const isDone = done.has(a.id)
                return (
                  <li key={a.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start ${isDone ? 'opacity-50' : ''}`}>
                    {showCompany && <TenantMark short={t.short} size={36} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${S.cls}`}>
                          <S.Icon size={11} /> {a.severity}
                        </span>
                        {showCompany && <span className="text-xs font-semibold text-ido-slate">{t.name}</span>}
                        <span className="text-xs text-ido-muted">{showCompany ? '· ' : ''}{a.category}</span>
                      </div>
                      <div className={`mt-1 font-semibold text-ido-primary ${isDone ? 'line-through' : ''}`}>{a.title}</div>
                      <p className="mt-0.5 text-sm text-ido-navy/75">{a.detail}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ido-slate">
                        {a.impact ? (
                          <span>
                            At stake <strong className="text-ido-primary">{fmtAED(a.impact)}</strong>
                          </span>
                        ) : null}
                        <span>Owner {a.owner}</span>
                        <span>
                          Due <strong className={a.due === 'Today' ? 'text-rose-600' : 'text-ido-primary'}>{a.due}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                      <button onClick={() => nav(a.to)} className="btn-primary py-1.5 text-xs">
                        {a.cta} <ArrowRight size={13} />
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => setToast(`Reminder sent to ${a.owner.replace(' (CFO)', '')} (demo)`)} disabled={isDone} className="btn-ghost flex-1 py-1.5 text-xs" title="Send a reminder to the owner">
                          <BellRing size={13} />
                        </button>
                        <button onClick={() => toggleDone(a.id)} className="btn-ghost flex-1 py-1.5 text-xs" title={isDone ? 'Reopen' : 'Mark as done'}>
                          {isDone ? <RotateCcw size={13} /> : <Check size={13} />}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-emerald-700">
              <CheckCircle2 size={18} /> Nothing in this view.
            </div>
          )}
          {filtered.length > 8 && (
            <button onClick={() => setAll((v) => !v)} className="w-full border-t border-ido-line py-3 text-sm font-semibold text-ido-teal hover:bg-ido-mist/60">
              {all ? 'Show top 8' : `Show all ${filtered.length} actions`}
            </button>
          )}
        </Card>
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </>
  )
}
