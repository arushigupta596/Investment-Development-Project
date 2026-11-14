import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, CheckCircle2, ChevronRight, Lock, MessageSquarePlus, Send, Sparkles, Wand2 } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { actorName, useRole } from '../../context/RoleContext'
import { tenantById } from '../../data/tenants'
import { monthLabel } from '../../data/generate'
import { ageDays, fmtAED, fmtNum, isOpen } from '../../lib/metrics'
import { samplePairs, type PairStatus } from '../../lib/transactions'
import { Card, Pill } from '../../components/ui'
import { CountUp, Hero, Tabs, Timeline, Toast } from '../../components/fx'

type Tab = 'tx' | 'exc' | 'activity'
const STEPS = ['Loading statement and ledger lines', 'Applying exact amount + reference rules', 'Scoring fuzzy references and date windows', 'Testing one-to-many combinations', 'Writing match results']

export default function ReconDetail() {
  const { tenantId = '', reconId = '' } = useParams()
  const { ds, activity, autoMatch, setStage, setStatus, comment } = useData()
  const { persona } = useRole()
  const t = tenantById(tenantId)!
  const r = ds.recons.find((x) => x.id === reconId && x.tenantId === tenantId)
  const [tab, setTab] = useState<Tab>('tx')
  const [filter, setFilter] = useState<'All' | PairStatus>('All')
  const [running, setRunning] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const readOnly = persona?.kind === 'ido'
  const me = actorName(persona, t.cfo)

  const exc = useMemo(() => ds.exceptions.filter((e) => e.reconId === reconId), [ds.exceptions, reconId])
  const { pairs } = useMemo(() => (r ? samplePairs(r, exc) : { pairs: [] }), [r, exc])
  const acts = activity.filter((a) => a.refId === reconId || exc.some((e) => e.id === a.refId))
  if (!r) return <Navigate to={`/t/${tenantId}/reconciliations`} replace />

  const open = exc.filter(isOpen)
  const openAmt = open.reduce((s, e) => s + e.amount, 0)
  const unmatched = r.items - r.autoMatched - r.manualMatched
  const pct = (n: number) => (n / r.items) * 100
  const variance = r.glBalance - r.subBalance
  const shownPairs = pairs.filter((p) => filter === 'All' || p.status === filter)
  const counts = (s: PairStatus) => pairs.filter((p) => p.status === s).length

  const run = () => {
    setRunning(0)
    let i = 0
    const timer = setInterval(() => {
      i++
      setRunning(i)
      if (i >= STEPS.length) {
        clearInterval(timer)
        const res = autoMatch(r.id, me)
        setRunning(null)
        setToast(`Auto-match matched ${res.matched} more items and cleared ${res.resolved} exception${res.resolved === 1 ? '' : 's'}`)
      }
    }, 450)
  }

  return (
    <>
      <Hero
        eyebrow={`${r.type} reconciliation · ${monthLabel(r.month, true)}`}
        title={r.account}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={`/t/${tenantId}/reconciliations`} className="hover:text-white">Reconciliations</Link>
            <ChevronRight size={14} />
            <span>{t.name}</span>
            <span className="text-white/30">|</span>
            <span>Preparer {r.preparer}</span>
            <span>Reviewer {r.reviewer}</span>
            <span>{t.erp}</span>
          </span>
        }
        right={
          <>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{r.stage}</span>
            {readOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80">
                <Lock size={13} /> Read-only
              </span>
            ) : (
              <>
                <button onClick={run} disabled={running !== null || unmatched <= 0} className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
                  <Wand2 size={16} /> {running !== null ? 'Matching...' : 'Re-run auto-match'}
                </button>
                {r.stage !== 'Signed off' && r.stage !== 'Pending review' && (
                  <button className="btn bg-white text-ido-navy hover:bg-ido-mist" onClick={() => { setStage(r.id, 'Pending review', me); setToast('Submitted for review') }}>
                    <Send size={16} /> Submit for review
                  </button>
                )}
                {r.stage === 'Pending review' && (
                  <button className="btn bg-white text-ido-navy hover:bg-ido-mist" onClick={() => { setStage(r.id, 'Signed off', me); setToast('Reconciliation signed off') }}>
                    <CheckCircle2 size={16} /> Approve & sign off
                  </button>
                )}
              </>
            )}
          </>
        }
      >
        {running !== null && (
          <div className="max-w-xl rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={15} className="animate-pulse text-ido-sky" /> {STEPS[Math.min(running, STEPS.length - 1)]}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-ido-sky transition-all duration-500" style={{ width: `${(running / STEPS.length) * 100}%` }} />
            </div>
          </div>
        )}
      </Hero>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card card-pad">
          <div className="eyebrow">GL balance</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-ido-primary">{fmtAED(r.glBalance, false)}</div>
          <div className="text-xs text-ido-slate">{t.erp}</div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">{r.type === 'Bank' ? 'Bank statement' : 'Source balance'}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-ido-primary">{fmtAED(r.subBalance, false)}</div>
          <div className="text-xs text-ido-slate">as at {monthLabel(r.month, true)} month end</div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Variance</div>
          <div className={`mt-1 text-xl font-semibold tabular-nums ${Math.abs(variance) > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtAED(variance, false)}</div>
          <div className="text-xs text-ido-slate">{open.length} open exceptions · {fmtAED(openAmt)}</div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Items matched</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-ido-primary">
            <CountUp value={pct(r.autoMatched + r.manualMatched)} format={(n) => n.toFixed(1) + '%'} />
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ido-line">
            <div className="bg-ido-teal transition-all duration-700" style={{ width: `${pct(r.autoMatched)}%` }} />
            <div className="bg-ido-sky transition-all duration-700" style={{ width: `${pct(r.manualMatched)}%` }} />
            <div className="bg-rose-400" style={{ width: `${pct(Math.max(0, unmatched))}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ido-slate">
            <span>{fmtNum(r.autoMatched)} auto</span>
            <span>{fmtNum(r.manualMatched)} manual</span>
            <span className="text-rose-600">{fmtNum(Math.max(0, unmatched))} open</span>
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'tx', label: 'Transactions', count: pairs.length },
            { id: 'exc', label: 'Exceptions', count: open.length },
            { id: 'activity', label: 'Activity & comments', count: acts.length },
          ]}
        />

        {tab === 'tx' && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              {(['All', 'Unmatched', 'Auto-matched', 'Manually matched', 'Resolved'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f ? 'bg-ido-primary text-white' : 'bg-ido-mist text-ido-primary hover:bg-ido-line'}`}>
                  {f} {f !== 'All' && <span className="opacity-60">{counts(f)}</span>}
                </button>
              ))}
              <span className="ml-auto text-xs text-ido-slate">Showing latest {pairs.length} of {fmtNum(r.items)} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-ido-line bg-ido-mist/60">
                  <tr>
                    <th className="th" colSpan={3}>{r.type === 'Bank' ? 'Bank statement' : 'Source / sub-ledger'}</th>
                    <th className="th text-center">Match</th>
                    <th className="th" colSpan={3}>General ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ido-line">
                  {shownPairs.map((p) => {
                    const cell = (l: typeof p.source) =>
                      l ? (
                        <>
                          <td className="td text-xs text-ido-slate">{l.date.slice(5)}</td>
                          <td className="td max-w-[220px]">
                            <div className="truncate font-medium">{l.desc}</div>
                            <div className="font-mono text-[11px] text-ido-muted">{l.ref}</div>
                          </td>
                          <td className={`td text-right font-semibold tabular-nums ${l.amount < 0 ? 'text-ido-navy' : 'text-emerald-700'}`}>{fmtAED(l.amount, false).replace('AED -', '-')}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="td text-center text-xs italic text-rose-500">
                          No matching entry
                        </td>
                      )
                    const bg = p.status === 'Unmatched' ? 'bg-rose-50/50' : p.status === 'Resolved' ? 'bg-emerald-50/40' : ''
                    return (
                      <tr key={p.key} className={`${bg} hover:bg-ido-mist/50`}>
                        {cell(p.source)}
                        <td className="td text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <ArrowLeftRight size={15} className={p.status === 'Unmatched' ? 'text-rose-400' : p.status === 'Auto-matched' ? 'text-ido-teal' : p.status === 'Resolved' ? 'text-emerald-600' : 'text-ido-sky'} />
                            <span className="text-[11px] font-semibold text-ido-slate">{p.status}</span>
                            {p.rule && <span className="text-[10px] text-ido-muted">{p.rule}</span>}
                          </div>
                        </td>
                        {cell(p.ledger)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'exc' && (
          <ul className="divide-y divide-ido-line">
            {exc.length === 0 && <li className="px-5 py-10 text-center text-sm text-ido-slate">No exceptions on this reconciliation.</li>}
            {[...exc].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || b.amount - a.amount).map((e) => (
              <li key={e.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ido-slate">{e.id}</span>
                    <span className="font-semibold text-ido-primary">{e.type}</span>
                    <Pill>{e.priority}</Pill>
                    <Pill>{e.status}</Pill>
                  </div>
                  <div className="mt-0.5 text-sm text-ido-slate">{e.description}</div>
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-ido-teal">
                    <Sparkles size={13} className="mt-0.5 shrink-0" /> {e.suggestion} ({Math.round(e.confidence * 100)}%)
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{fmtAED(e.amount, false)}</div>
                    <div className="text-xs text-ido-slate">{ageDays(e)}d · {e.owner}</div>
                  </div>
                  {!readOnly && isOpen(e) && (
                    <button className="btn-primary py-1.5" onClick={() => setStatus(e.id, 'Resolved', me)}>
                      <CheckCircle2 size={15} /> Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'activity' && (
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_340px]">
            <Timeline items={acts} />
            <form
              className="h-fit rounded-xl border border-ido-line p-4"
              onSubmit={(ev) => {
                ev.preventDefault()
                if (!draft.trim()) return
                comment(r.id, r.tenantId, draft.trim(), me)
                setDraft('')
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-ido-primary">
                <MessageSquarePlus size={16} /> Add a comment
              </div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder={readOnly ? 'Leave a note for the company finance team...' : 'Explain a variance or tag a reviewer...'} className="mt-3 w-full rounded-lg border border-ido-line p-3 text-sm outline-none focus:border-ido-sky focus:ring-2 focus:ring-ido-sky/30" />
              <button className="btn-primary mt-2 w-full" disabled={!draft.trim()}>
                Post as {me}
              </button>
            </form>
          </div>
        )}
      </Card>
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  )
}
