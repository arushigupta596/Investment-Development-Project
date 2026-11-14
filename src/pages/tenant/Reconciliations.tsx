import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useRole } from '../../context/RoleContext'
import { MONTHS, CURRENT_MONTH, monthLabel, type Month } from '../../data/generate'
import { RECON_TYPES } from '../../data/tenants'
import { fmtAED, fmtNum, isOpen } from '../../lib/metrics'
import { PageHeader, Pill } from '../../components/ui'

export default function Reconciliations() {
  const { tenantId = '' } = useParams()
  const { ds } = useData()
  const { persona } = useRole()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [month, setMonth] = useState<Month>(CURRENT_MONTH)
  const type = sp.get('type') ?? ''
  const stage = sp.get('stage') ?? ''
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    v ? n.set(k, v) : n.delete(k)
    setSp(n, { replace: true })
  }
  const setType = (v: string) => setParam('type', v)
  const setStageF = (v: string) => setParam('stage', v)
  const monthRecons = ds.recons.filter((r) => r.tenantId === tenantId && r.month === month)
  const STAGES = ['Not started', 'In progress', 'Pending review', 'Signed off'] as const

  const rows = useMemo(
    () =>
      ds.recons
        .filter((r) => r.tenantId === tenantId && r.month === month && (!type || r.type === type) && (!stage || r.stage === stage))
        .map((r) => {
          const exc = ds.exceptions.filter((e) => e.reconId === r.id)
          const open = exc.filter(isOpen)
          return { ...r, excTotal: exc.length, open: open.length, openAmt: open.reduce((s, e) => s + e.amount, 0) }
        }),
    [ds, tenantId, month, type, stage],
  )

  return (
    <>
      <PageHeader eyebrow="Workbench" title="Reconciliations" subtitle="Balances, match progress and sign-off status for every account in the period.">
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value as Month)}>
          {[...MONTHS].reverse().map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, true)}
            </option>
          ))}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All account types</option>
          {RECON_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="input" value={stage} onChange={(e) => setStageF(e.target.value)}>
          <option value="">All stages</option>
          {['Not started', 'In progress', 'Pending review', 'Signed off'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setStageF('')} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${!stage ? 'bg-ido-primary text-white' : 'bg-white text-ido-primary ring-1 ring-ido-line hover:ring-ido-sky'}`}>
          All <span className="opacity-60">{monthRecons.length}</span>
        </button>
        {STAGES.map((st) => (
          <button key={st} onClick={() => setStageF(stage === st ? '' : st)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${stage === st ? 'bg-ido-primary text-white' : 'bg-white text-ido-primary ring-1 ring-ido-line hover:ring-ido-sky'}`}>
            {st} <span className="opacity-60">{monthRecons.filter((r) => r.stage === st).length}</span>
          </button>
        ))}
      </div>
      {persona?.kind === 'ido' && <p className="-mt-3 mb-4 text-sm text-ido-slate">Read-only view of the company workbench.</p>}
      {persona?.kind !== 'ido' && <p className="-mt-3 mb-4 text-sm text-ido-slate">Click a reconciliation to see matched transactions, run auto-match and sign off.</p>}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-ido-line bg-ido-mist/60">
            <tr>
              <th className="th">Account</th>
              <th className="th text-right">GL balance</th>
              <th className="th text-right">Source balance</th>
              <th className="th text-right">Items</th>
              <th className="th">Match</th>
              <th className="th text-right">Open exceptions</th>
              <th className="th">Preparer / reviewer</th>
              <th className="th">Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ido-line">
            {rows.map((r) => {
              const total = r.autoMatched + r.manualMatched
              const pct = total / r.items
              const autoPct = r.autoMatched / r.items
              return (
                <tr key={r.id} className="group cursor-pointer hover:bg-ido-mist/50" onClick={() => nav(r.id)}>
                  <td className="td">
                    <div className="font-semibold text-ido-primary">{r.account}</div>
                    <div className="text-xs text-ido-slate">{r.type}</div>
                  </td>
                  <td className="td text-right tabular-nums">{fmtAED(r.glBalance, false)}</td>
                  <td className="td text-right tabular-nums">{fmtAED(r.subBalance, false)}</td>
                  <td className="td text-right tabular-nums">{fmtNum(r.items)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="relative h-2 w-28 overflow-hidden rounded-full bg-ido-line">
                        <div className="absolute inset-y-0 left-0 bg-ido-sky" style={{ width: `${pct * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-ido-teal" style={{ width: `${autoPct * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{(pct * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="td text-right">
                    {r.open ? (
                      <span className="font-semibold text-rose-600">
                        {r.open} · {fmtAED(r.openAmt)}
                      </span>
                    ) : (
                      <span className="text-ido-muted">None</span>
                    )}
                  </td>
                  <td className="td text-ido-slate">
                    {r.preparer} / {r.reviewer}
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-between gap-2">
                      <Pill>{r.stage}</Pill>
                      <ChevronRight size={16} className="text-ido-muted transition group-hover:translate-x-0.5 group-hover:text-ido-teal" />
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="td py-12 text-center text-ido-slate">
                  No reconciliations in this view.{' '}
                  <button className="font-semibold text-ido-teal hover:underline" onClick={() => setSp(new URLSearchParams(), { replace: true })}>Clear filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-ido-slate">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-ido-teal" /> Auto-matched</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-ido-sky" /> Manually matched</span>
      </div>
    </>
  )
}
