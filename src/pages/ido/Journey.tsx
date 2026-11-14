import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, TenantMark } from '../../components/ui'
import { Hero } from '../../components/fx'
import { StageChip } from '../../components/finance'
import { useData } from '../../context/DataContext'
import { SECTORS, TENANTS } from '../../data/tenants'
import { CURRENT_MONTH } from '../../data/generate'
import { STAGES, pipelineFor, type StageName, type StageStatus } from '../../lib/finance'
import { linksFor } from '../../lib/paths'

export const STAGE_INFO: Record<StageName, { what: string; to: (id: string, cfo?: boolean) => string }> = {
  Ingest: { what: 'Journals, bank statements, sub-ledgers and payroll files arrive from each company', to: (id, cfo = false) => linksFor(id, cfo).feeds },
  Ledger: { what: 'Journal lines posted to the general ledger', to: (id, cfo = false) => linksFor(id, cfo).journals },
  'Trial balance': { what: 'Debits equal credits and suspense is clear', to: (id, cfo = false) => linksFor(id, cfo).tb },
  Statements: { what: 'P&L and balance sheet built from the trial balance', to: (id, cfo = false) => linksFor(id, cfo).financials() },
  Reconciliation: { what: 'Accounts reconciled and revenue verified against bank, ledger and invoices', to: (id, cfo = false) => linksFor(id, cfo).assurance },
}

export default function Journey() {
  const { ds, feeds } = useData()
  const nav = useNavigate()
  const [sector, setSector] = useState('')
  const [only, setOnly] = useState<StageStatus | ''>('')
  const rows = useMemo(() => TENANTS.map((t) => ({ t, cells: pipelineFor(ds, feeds, t.id, CURRENT_MONTH) })), [ds, feeds])
  const shown = rows.filter((r) => (!sector || r.t.sector === sector) && (!only || r.cells.some((c) => c.status === only)))
  const count = (stage: StageName, s: StageStatus) => rows.filter((r) => r.cells.find((c) => c.stage === stage)!.status === s).length
  const complete = rows.filter((r) => r.cells.every((c) => c.status === 'Done')).length

  return (
    <>
      <Hero
        eyebrow="Finance journey · October 2026 close"
        title="From journal to verified numbers"
        subtitle={`${complete} of ${TENANTS.length} companies have completed every stage. Click any cell to see the data behind it.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((s, i) => (
            <div key={s} className="relative rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                {i + 1}. {s}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {count(s, 'Done')}
                <span className="text-sm font-normal text-white/50">/{TENANTS.length} done</span>
              </div>
              <div className="text-xs text-white/55">
                {count(s, 'Blocked') ? <span className="text-rose-300">{count(s, 'Blocked')} blocked · </span> : null}
                {count(s, 'In progress')} in progress
              </div>
            </div>
          ))}
        </div>
      </Hero>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {['', ...SECTORS].map((s) => (
          <button key={s} onClick={() => setSector(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${sector === s ? 'bg-ido-primary text-white' : 'bg-white text-ido-primary ring-1 ring-ido-line hover:bg-ido-mist'}`}>
            {s || 'All sectors'}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-ido-line sm:block" />
        {(['Blocked', 'In progress'] as const).map((s) => (
          <button key={s} onClick={() => setOnly(only === s ? '' : s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${only === s ? 'bg-ido-primary text-white' : 'bg-white text-ido-primary ring-1 ring-ido-line hover:bg-ido-mist'}`}>
            Has {s.toLowerCase()}
          </button>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ido-line">
                <th className="th">Company</th>
                {STAGES.map((s, i) => (
                  <th key={s} className="th" title={STAGE_INFO[s].what}>
                    <span className="inline-flex items-center gap-1">
                      {i + 1}. {s} {i < STAGES.length - 1 && <ArrowRight size={11} className="text-ido-sky" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ido-line">
              {shown.map(({ t, cells }) => (
                <tr key={t.id}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <TenantMark short={t.short} />
                      <div>
                        <div className="font-semibold text-ido-primary">{t.name}</div>
                        <div className="text-xs text-ido-slate">{t.erp}</div>
                      </div>
                    </div>
                  </td>
                  {cells.map((c) => (
                    <td key={c.stage} className="px-2 py-2 align-top">
                      <button onClick={() => nav(STAGE_INFO[c.stage].to(t.id))} className="w-full min-w-[150px] max-w-[210px] rounded-lg p-2 text-left transition hover:bg-ido-mist">
                        <StageChip status={c.status} />
                        <div className="mt-1 line-clamp-2 whitespace-normal text-xs text-ido-slate">{c.detail}</div>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-ido-muted">September and earlier months are fully closed for every company.</p>
    </>
  )
}
