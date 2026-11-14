import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { Card, Pill } from '../../components/ui'
import { Hero } from '../../components/fx'
import { StageChip } from '../../components/finance'
import { useData } from '../../context/DataContext'
import { tenantById } from '../../data/tenants'
import { CURRENT_MONTH, MONTHS, monthLabel } from '../../data/generate'
import { allJournals } from '../../data/finance'
import { STAGES, pipelineFor, trialBalance } from '../../lib/finance'
import { STAGE_INFO } from '../ido/Journey'
import { useRole } from '../../context/RoleContext'

export default function CompanyJourney() {
  const { tenantId = '' } = useParams()
  const { persona } = useRole()
  const cfo = persona?.kind === 'cfo'
  const t = tenantById(tenantId)!
  const { ds, feeds } = useData()
  const nav = useNavigate()
  const cells = useMemo(() => pipelineFor(ds, feeds, tenantId, CURRENT_MONTH), [ds, feeds, tenantId])
  const done = cells.filter((c) => c.status === 'Done').length
  const myFeeds = feeds.filter((f) => f.tenantId === tenantId)
  const lines = useMemo(() => allJournals(tenantId, CURRENT_MONTH), [tenantId])
  const tb = trialBalance(tenantId, CURRENT_MONTH)
  const stat = (i: number) =>
    [
      `${myFeeds.length} feeds · ${myFeeds.reduce((s, f) => s + f.rows, 0).toLocaleString('en-US')} rows`,
      `${lines.length.toLocaleString('en-US')} journal lines · ${lines.filter((l) => l.manual).length} manual`,
      tb.suspense ? 'Suspense not clear' : 'Debits = credits',
      'P&L and balance sheet',
      'Accounts and revenue checked',
    ][i]

  return (
    <>
      <Hero
        eyebrow={`Finance journey · ${monthLabel(CURRENT_MONTH, true)} close`}
        title={`${t.name}: ${done} of ${STAGES.length} stages done`}
        subtitle="Follow October from the data your systems send to verified numbers. Open any stage to see the data behind it."
      />

      <div className="grid gap-3 lg:grid-cols-5">
        {cells.map((c, i) => (
          <div key={c.stage} className="relative">
            <button onClick={() => nav(STAGE_INFO[c.stage].to(tenantId, cfo))} className="card card-pad flex h-full w-full flex-col text-left transition hover:-translate-y-0.5 hover:border-ido-sky hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ido-slate">Step {i + 1}</span>
                <StageChip status={c.status} />
              </div>
              <div className="mt-2 text-lg font-semibold text-ido-primary">{c.stage}</div>
              <p className="mt-1 text-xs text-ido-slate">{STAGE_INFO[c.stage].what.replace('from each company', '')}</p>
              <p className={`mt-3 text-sm ${c.status === 'Blocked' ? 'font-semibold text-rose-700' : 'text-ido-navy/80'}`}>{c.detail}</p>
              <div className="mt-auto pt-3 text-xs text-ido-muted">{stat(i)}</div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ido-teal">
                Open <ArrowRight size={12} />
              </span>
            </button>
            {i < cells.length - 1 && <ChevronRight size={18} className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-ido-mist text-ido-sky lg:block" />}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Your data feeds" action={<button onClick={() => nav(STAGE_INFO.Ingest.to(tenantId, cfo))} className="text-xs font-semibold text-ido-teal hover:underline">Data explorer</button>}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Feed</th>
                  <th className="th">Last received</th>
                  <th className="th text-right">Rows</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {myFeeds.map((f) => (
                  <tr key={f.id}>
                    <td className="td">
                      <div className="font-medium text-ido-primary">{f.name}</div>
                      {f.note && <div className="max-w-[280px] whitespace-normal text-xs text-ido-slate">{f.note}</div>}
                    </td>
                    <td className="td text-ido-slate">{new Date(f.lastSync).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="td text-right tabular-nums">{f.rows.toLocaleString('en-US')}</td>
                    <td className="td">
                      <Pill>{f.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Close history">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Month</th>
                  {STAGES.map((s) => (
                    <th key={s} className="th">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {[...MONTHS].reverse().map((m) => {
                  const cs = pipelineFor(ds, feeds, tenantId, m)
                  return (
                    <tr key={m}>
                      <td className="td font-medium text-ido-primary">{monthLabel(m)}</td>
                      {cs.map((c) => (
                        <td key={c.stage} className="px-4 py-2.5" title={c.detail}>
                          <StageChip status={c.status} compact />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
