import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, Lock, MessageSquarePlus, Search, Sparkles, UserRound, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import { actorName, useRole } from '../context/RoleContext'
import { tenantById, RECON_TYPES } from '../data/tenants'
import { monthLabel, type ReconException } from '../data/generate'
import { ageDays, bucketOf, fmtAED, AGING_BUCKETS, isOpen } from '../lib/metrics'
import { Pill, TenantMark } from './ui'
import { Tabs, Timeline, Toast } from './fx'

const OWNERS = ['Aisha K.', 'Rahul M.', 'Noura S.', 'Ahmed T.', 'Grace L.', 'Yousef A.']
type SortKey = 'amount' | 'age' | 'priority'
const PRI = { High: 3, Medium: 2, Low: 1 }

/**
 * Filterable exception queue. Filters are mirrored in the URL (?age=, ?type=, ?tenant=, ?priority=, ?focus=)
 * so dashboard charts and KPIs can deep-link into a pre-filtered view.
 */
export default function ExceptionList({ tenantId, readOnly, showTenant }: { tenantId?: string; readOnly?: boolean; showTenant?: boolean }) {
  const { ds, setStatus, bulkStatus, bulkAssign } = useData()
  const { persona } = useRole()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'amount', dir: -1 })
  const [toast, setToast] = useState<string | null>(null)
  const me = actorName(persona, tenantId ? tenantById(tenantId)?.cfo : undefined)

  const status = sp.get('status') ?? 'open'
  const type = sp.get('type') ?? ''
  const age = sp.get('age') ?? ''
  const priority = sp.get('priority') ?? ''
  const tenantF = sp.get('tenant') ?? ''
  const focus = sp.get('focus')
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v)
    else n.delete(k)
    setSp(n, { replace: true })
  }

  const rows = useMemo(() => {
    const ql = q.toLowerCase()
    const out = ds.exceptions
      .filter((e) => !tenantId || e.tenantId === tenantId)
      .filter((e) => !tenantF || e.tenantId === tenantF)
      .filter((e) => (status === 'open' ? isOpen(e) : status === 'all' ? true : e.status === status))
      .filter((e) => !type || e.reconType === type)
      .filter((e) => !priority || e.priority === priority)
      .filter((e) => !age || (age === '60+' ? ageDays(e) > 60 : bucketOf(ageDays(e)) === age))
      .filter((e) => !ql || [e.id, e.type, e.description, e.counterparty, e.account, e.owner, tenantById(e.tenantId)?.name].join(' ').toLowerCase().includes(ql))
    const val = (e: ReconException) => (sort.k === 'amount' ? e.amount : sort.k === 'age' ? ageDays(e) : PRI[e.priority])
    return out.sort((a, b) => (val(a) - val(b)) * sort.dir)
  }, [ds.exceptions, tenantId, tenantF, q, status, type, age, priority, sort])

  useEffect(() => setChecked((c) => c.filter((id) => rows.some((r) => r.id === id))), [rows])

  const selected = ds.exceptions.find((e) => e.id === focus)
  const total = rows.reduce((s, e) => s + e.amount, 0)
  const visible = rows.slice(0, 150)
  const allChecked = visible.length > 0 && visible.every((r) => checked.includes(r.id))
  const activeFilters = [type && `Type: ${type}`, age && `Age: ${age} days`, priority && `Priority: ${priority}`, tenantF && `Company: ${tenantById(tenantF)?.name}`].filter(Boolean) as string[]

  const SortTh = ({ k, children, className = '' }: { k: SortKey; children: string; className?: string }) => (
    <th className={`th cursor-pointer select-none hover:text-ido-primary ${className}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : -1 }))}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.k === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  )

  return (
    <>
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ido-line p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ido-muted" />
            <input className="input w-full pl-10" placeholder="Search ID, counterparty, owner, account..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {showTenant && (
              <select className="input" value={tenantF} onChange={(e) => setParam('tenant', e.target.value)}>
                <option value="">All companies</option>
                {Array.from(new Set(ds.exceptions.map((e) => e.tenantId))).map((id) => (
                  <option key={id} value={id}>{tenantById(id)?.name}</option>
                ))}
              </select>
            )}
            <select className="input" value={type} onChange={(e) => setParam('type', e.target.value)}>
              <option value="">All account types</option>
              {RECON_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className="input" value={age} onChange={(e) => setParam('age', e.target.value)}>
              <option value="">Any age</option>
              {AGING_BUCKETS.map((b) => <option key={b} value={b}>{b} days</option>)}
              <option value="60+">Older than 60 days</option>
            </select>
            <select className="input" value={priority} onChange={(e) => setParam('priority', e.target.value)}>
              <option value="">Any priority</option>
              {['High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <Tabs
          value={status}
          onChange={(v) => setParam('status', v === 'open' ? '' : v)}
          tabs={[
            { id: 'open', label: 'Needs action' },
            { id: 'In review', label: 'In review' },
            { id: 'Resolved', label: 'Resolved' },
            { id: 'all', label: 'All' },
          ]}
        />

        <div className="flex min-h-[52px] flex-wrap items-center gap-2 px-4 py-2.5 text-xs text-ido-slate">
          {checked.length > 0 && !readOnly ? (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-ido-primary px-3 py-2 text-white">
              <span className="font-semibold">{checked.length} selected</span>
              <span className="text-white/60">· {fmtAED(rows.filter((r) => checked.includes(r.id)).reduce((s, e) => s + e.amount, 0))}</span>
              <button className="btn ml-auto bg-white py-1 text-xs text-ido-navy hover:bg-ido-mist" onClick={() => { bulkStatus(checked, 'Resolved', me); setToast(`${checked.length} exceptions resolved`); setChecked([]) }}>
                <CheckCircle2 size={14} /> Resolve
              </button>
              <button className="btn bg-white/10 py-1 text-xs text-white hover:bg-white/20" onClick={() => { bulkStatus(checked, 'In review', me); setToast(`${checked.length} sent to review`); setChecked([]) }}>
                Send to review
              </button>
              <select className="rounded-full bg-white/10 px-3 py-1 text-xs text-white outline-none" value="" onChange={(e) => { bulkAssign(checked, e.target.value, me); setToast(`Assigned ${checked.length} to ${e.target.value}`); setChecked([]) }}>
                <option value="" className="text-ido-navy">Assign to...</option>
                {OWNERS.map((o) => <option key={o} className="text-ido-navy">{o}</option>)}
              </select>
              <button className="text-white/70 hover:text-white" onClick={() => setChecked([])} aria-label="Clear selection"><X size={16} /></button>
            </div>
          ) : (
            <>
              <span>
                <span className="font-semibold text-ido-primary">{rows.length}</span> exceptions · <span className="font-semibold text-ido-primary">{fmtAED(total)}</span>
              </span>
              {activeFilters.map((f) => (
                <span key={f} className="rounded-full bg-ido-mist px-2.5 py-1 font-medium text-ido-primary">{f}</span>
              ))}
              {activeFilters.length > 0 && (
                <button className="font-semibold text-ido-teal hover:underline" onClick={() => setSp(new URLSearchParams(), { replace: true })}>Clear filters</button>
              )}
              {!readOnly && <span className="ml-auto hidden md:inline">Tick rows for bulk actions</span>}
            </>
          )}
        </div>

        <div className="max-h-[640px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 border-y border-ido-line bg-[#F4F7F8]">
              <tr>
                {!readOnly && (
                  <th className="th w-10">
                    <input type="checkbox" className="accent-ido-teal" checked={allChecked} onChange={() => setChecked(allChecked ? [] : visible.map((r) => r.id))} aria-label="Select all" />
                  </th>
                )}
                <th className="th">ID</th>
                {showTenant && <th className="th">Company</th>}
                <th className="th">Exception</th>
                <th className="th">Account</th>
                <SortTh k="amount" className="text-right">Amount</SortTh>
                <SortTh k="age" className="text-right">Age</SortTh>
                <SortTh k="priority">Priority</SortTh>
                <th className="th">Owner</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ido-line">
              {visible.map((e) => {
                const t = tenantById(e.tenantId)!
                const d = ageDays(e)
                const on = checked.includes(e.id)
                return (
                  <tr key={e.id} onClick={() => setParam('focus', e.id)} className={`cursor-pointer transition ${on ? 'bg-ido-sky/10' : 'hover:bg-ido-mist/60'}`}>
                    {!readOnly && (
                      <td className="td" onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" className="accent-ido-teal" checked={on} onChange={() => setChecked((c) => (on ? c.filter((x) => x !== e.id) : [...c, e.id]))} aria-label={`Select ${e.id}`} />
                      </td>
                    )}
                    <td className="td font-mono text-xs text-ido-slate">{e.id}</td>
                    {showTenant && (
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <TenantMark short={t.short} size={24} />
                          <span className="font-medium">{t.name}</span>
                        </div>
                      </td>
                    )}
                    <td className="td">
                      <div className="font-semibold text-ido-primary">{e.type}</div>
                      <div className="max-w-[320px] truncate text-xs text-ido-slate">{e.description}</div>
                    </td>
                    <td className="td">
                      <div>{e.reconType}</div>
                      <div className="text-xs text-ido-slate">{monthLabel(e.month)} close</div>
                    </td>
                    <td className="td text-right font-semibold tabular-nums">{fmtAED(e.amount, false)}</td>
                    <td className="td text-right">
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${d > 90 ? 'bg-rose-100 text-rose-700' : d > 60 ? 'bg-rose-50 text-rose-600' : d > 30 ? 'bg-amber-50 text-amber-700' : 'text-ido-slate'}`}>{d}d</span>
                    </td>
                    <td className="td"><Pill>{e.priority}</Pill></td>
                    <td className="td">{e.owner}</td>
                    <td className="td"><Pill>{e.status}</Pill></td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="td py-14 text-center text-ido-slate">
                    <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={28} />
                    Nothing here. No exceptions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > visible.length && <div className="border-t border-ido-line px-4 py-2.5 text-xs text-ido-slate">Showing the first {visible.length} of {rows.length}. Narrow the filters to see more.</div>}
      </div>

      {selected && <Drawer e={selected} readOnly={readOnly} me={me} onClose={() => setParam('focus', '')} setStatus={setStatus} onToast={setToast} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  )
}

function Drawer({ e, readOnly, me, onClose, setStatus, onToast }: { e: ReconException; readOnly?: boolean; me: string; onClose: () => void; setStatus: (id: string, s: ReconException['status'], who?: string) => void; onToast: (s: string) => void }) {
  const { activity, assign, comment } = useData()
  const t = tenantById(e.tenantId)!
  const [tab, setTab] = useState<'details' | 'activity'>('details')
  const [draft, setDraft] = useState('')
  const acts = activity.filter((a) => a.refId === e.id)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const seeded = [{ id: -1, at: e.raisedOn + 'T08:30:00.000Z', who: 'Auto-match engine', text: `Flagged as ${e.type.toLowerCase()} on ${e.account}`, kind: 'system' as const }, { id: -2, at: e.raisedOn + 'T09:10:00.000Z', who: 'System', text: `Assigned to ${e.owner} (${e.priority.toLowerCase()} priority)`, kind: 'system' as const }]

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ido-navy/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="bg-ido-navy p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-xs text-white/60">{e.id} · {t.name}</div>
              <h2 className="mt-1 text-xl font-semibold">{e.type}</h2>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-white/70 hover:bg-white/10" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="mt-4 text-3xl font-semibold tracking-tightish">{fmtAED(e.amount, false)}</div>
          <div className="mt-3 flex gap-2"><Pill>{e.status}</Pill><Pill>{e.priority}</Pill><span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold">{ageDays(e)} days old</span></div>
        </header>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'details', label: 'Details' }, { id: 'activity', label: 'Activity', count: acts.length + 2 }]} />
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {tab === 'details' ? (
            <>
              <p className="text-sm text-ido-navy/80">{e.description}</p>
              <div className="rounded-xl border border-ido-sky/40 bg-gradient-to-br from-ido-mist to-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-ido-primary">
                  <Sparkles size={16} className="text-ido-teal" /> Suggested resolution
                </div>
                <p className="mt-2 text-sm text-ido-navy/80">{e.suggestion}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ido-line"><div className="h-full rounded-full bg-ido-teal" style={{ width: `${e.confidence * 100}%` }} /></div>
                  <span className="text-xs font-semibold text-ido-slate">{Math.round(e.confidence * 100)}% confidence</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[['Account type', e.reconType], ['Account', e.account], ['Period', monthLabel(e.month, true)], ['Counterparty', e.counterparty], ['Raised on', e.raisedOn], ['Owner', e.owner], ['ERP', t.erp], ['Entity', t.name]].map(([k, v]) => (
                  <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>
                ))}
              </dl>
              <Link to={`/t/${e.tenantId}/reconciliations/${e.reconId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ido-teal hover:underline">
                Open the reconciliation <ExternalLink size={14} />
              </Link>
            </>
          ) : (
            <>
              <Timeline items={[...seeded, ...acts]} />
              <form className="rounded-xl border border-ido-line p-3" onSubmit={(ev) => { ev.preventDefault(); if (draft.trim()) { comment(e.id, e.tenantId, draft.trim(), me); setDraft('') } }}>
                <textarea rows={3} value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder="Add a note..." className="w-full resize-none text-sm outline-none" />
                <div className="flex justify-end"><button className="btn-primary py-1.5" disabled={!draft.trim()}><MessageSquarePlus size={15} /> Comment</button></div>
              </form>
            </>
          )}
        </div>
        <footer className="border-t border-ido-line p-5">
          {readOnly ? (
            <div className="flex items-center gap-2 text-sm text-ido-slate"><Lock size={15} /> IDO has read-only access. You can still comment in Activity.</div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {e.status !== 'Resolved' ? (
                <button className="btn-primary" onClick={() => { setStatus(e.id, 'Resolved', me); onToast(`${e.id} resolved`) }}><CheckCircle2 size={16} /> Accept & resolve</button>
              ) : (
                <button className="btn-ghost" onClick={() => setStatus(e.id, 'Open', me)}>Reopen</button>
              )}
              {e.status === 'Open' && <button className="btn-ghost" onClick={() => setStatus(e.id, 'In review', me)}>Send to review</button>}
              <label className="ml-auto flex items-center gap-1.5 text-sm text-ido-slate">
                <UserRound size={15} />
                <select className="input py-1.5" value={e.owner} onChange={(ev) => assign(e.id, ev.target.value, me)}>
                  {Array.from(new Set([e.owner, ...OWNERS])).map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>
          )}
        </footer>
      </aside>
    </div>
  )
}
