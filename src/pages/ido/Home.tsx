import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, ArrowRight, Banknote, BellRing, Check, CheckCircle2, Coins, Info, MessageSquareText, Percent, RotateCcw, ShieldCheck, TrendingUp } from 'lucide-react'
import { Card, Kpi, TenantMark } from '../../components/ui'
import { CountUp, Hero, Toast } from '../../components/fx'
import { ChartFromSpec, FinanceTrend } from '../../components/charts'
import { StageChip } from '../../components/finance'
import { useData } from '../../context/DataContext'
import { SECTORS, TENANTS, tenantById } from '../../data/tenants'
import { CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, CURRENT_MONTH, monthLabel } from '../../data/generate'
import { STAGES, bs, budget, companyKpis, financeTrend, pipelineFor, pl } from '../../lib/finance'
import { allAssurance } from '../../lib/assurance'
import { buildActions, type Severity } from '../../lib/actions'
import { fmtAED, fmtPct } from '../../lib/metrics'
import { STAGE_INFO } from './Journey'
import ActionList, { SEV } from '../../components/ActionList'


export default function Home() {
  const { ds, feeds } = useData()
  const nav = useNavigate()
  const [sev, setSev] = useState<Severity | ''>('')
  const [done, setDone] = useState<Set<string>>(new Set())

  const actions = useMemo(() => buildActions(ds, feeds), [ds, feeds])
  const open = actions.filter((a) => !done.has(a.id))
  const count = (s: Severity) => open.filter((a) => a.severity === s).length
  const atStake = open.reduce((s, a) => s + (a.impact ?? 0), 0)

  const p = pl('all', CURRENT_MONTH)
  const b = bs('all', CURRENT_MONTH)
  const bud = budget('all', CURRENT_MONTH)
  const vb = p.revenue / bud.revenue - 1
  const trend = useMemo(() => financeTrend('all'), [])
  const pipes = useMemo(() => TENANTS.map((t) => ({ t, cells: pipelineFor(ds, feeds, t.id) })), [ds, feeds])
  const closed = pipes.filter((x) => x.cells.every((c) => c.status === 'Done')).length
  const as = useMemo(() => allAssurance(), [])
  const rep = as.reduce((s, a) => s + a.reported, 0)
  const verified = as.reduce((s, a) => s + a.verifiedPct * a.reported, 0) / rep
  const kpis = useMemo(() => TENANTS.map((t) => companyKpis(t.id)), [])
  const stillOpen = pipes.filter((x) => !x.cells.every((c) => c.status === 'Done'))
  const riskByCo = as
    .map((a) => ({ company: tenantById(a.tenantId)!.name, amount: Math.round(a.findings.reduce((s, f) => s + f.amount, 0)) }))
    .filter((x) => x.amount)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  const toggleDone = (id: string) =>
    setDone((d) => {
      const n = new Set(d)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <>
      <Hero
        eyebrow={`IDO Group Finance · ${monthLabel(CURRENT_MONTH, true)} close · business day ${CLOSE_DAY_TODAY}`}
        title={open.length ? `${open.length} actions need attention` : 'All clear'}
        subtitle={`${count('Critical')} critical items block the close or put reported revenue in doubt. ${fmtAED(atStake)} is at stake across the open actions.`}
        right={
          <button onClick={() => nav('/ido/assistant')} className="btn bg-white text-ido-navy hover:bg-ido-mist">
            <MessageSquareText size={16} /> Ask IDO Assistant
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(['Critical', 'High', 'Medium'] as Severity[]).map((s) => {
            const on = sev === s
            const S = SEV[s]
            return (
              <button key={s} onClick={() => setSev(on ? '' : s)} className={`rounded-xl px-4 py-3 text-left ring-1 transition ${on ? 'bg-white text-ido-navy ring-white' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}>
                <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${on ? 'text-ido-slate' : 'text-white/55'}`}>
                  <span className={`h-2 w-2 rounded-full ${S.dot}`} /> {s}
                </div>
                <div className="mt-1 text-3xl font-semibold">{count(s)}</div>
                <div className={`text-xs ${on ? 'text-ido-slate' : 'text-white/55'}`}>{s === 'Critical' ? 'act today' : s === 'High' ? 'before sign-off' : 'this week'}</div>
              </button>
            )
          })}
          <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">AED at stake</div>
            <div className="mt-1 text-3xl font-semibold">{fmtAED(atStake).replace('AED ', '')}</div>
            <div className="text-xs text-white/55">{done.size} done this session</div>
          </div>
        </div>
      </Hero>

      <div className="grid gap-4 xl:grid-cols-3">
        <ActionList actions={actions} sev={sev} done={done} toggleDone={toggleDone} className="xl:col-span-2" />

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Close countdown" action={<button onClick={() => nav('/ido/journey')} className="text-xs font-semibold text-ido-teal hover:underline">Journey board</button>}>
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-semibold text-ido-primary">{closed}</span>
                  <span className="text-sm text-ido-slate">/{TENANTS.length} closed</span>
                </div>
                <span className={`text-xs font-semibold ${CLOSE_DAY_TODAY > CLOSE_SLA_DAYS ? 'text-rose-600' : 'text-ido-slate'}`}>
                  Day {CLOSE_DAY_TODAY} of {CLOSE_SLA_DAYS}-day deadline
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ido-mist">
                <div className="h-full bg-ido-teal" style={{ width: `${(closed / TENANTS.length) * 100}%` }} />
              </div>
              <ul className="mt-4 space-y-2">
                {stillOpen.map(({ t, cells }) => {
                  const worst = cells.find((c) => c.status === 'Blocked') ?? cells.find((c) => c.status !== 'Done')!
                  return (
                    <li key={t.id}>
                      <button onClick={() => nav(STAGE_INFO[worst.stage].to(t.id))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ido-mist">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ido-primary">{t.name}</span>
                        <span className="text-xs text-ido-slate">{worst.stage}</span>
                        <StageChip status={worst.status} compact />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Card>
          <Card title="Revenue at risk by company" action={<button onClick={() => nav('/ido/assurance')} className="text-xs font-semibold text-ido-teal hover:underline">Assurance</button>}>
            <div className="p-3">
              <ChartFromSpec spec={{ type: 'hbar', xKey: 'company', series: [{ key: 'amount', name: 'At risk' }], data: riskByCo }} height={220} />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Revenue" value={<CountUp value={p.revenue / 1e6} format={(n) => `AED ${n.toFixed(0)}M`} />} sub={<span className={vb >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{`${vb >= 0 ? '+' : ''}${fmtPct(vb)} vs budget`}</span>} icon={<TrendingUp size={18} />} spark={trend.map((t) => t.revenue)} onClick={() => nav('/ido/financials')} />
        <Kpi label="EBITDA" value={fmtAED(p.ebitda)} sub={`${fmtPct(p.ebitda / p.revenue)} margin`} icon={<Percent size={18} />} spark={trend.map((t) => t.ebitda)} onClick={() => nav('/ido/financials')} />
        <Kpi label="Net income" value={fmtAED(p.netIncome)} sub={`${kpis.filter((k) => k.netIncome < 0).length} loss-making`} icon={<Coins size={18} />} onClick={() => nav('/ido/financials')} />
        <Kpi label="Cash" value={fmtAED(b.cash)} sub={`net debt ${fmtAED(b.borrowings - b.cash)}`} icon={<Banknote size={18} />} onClick={() => nav('/ido/financials?view=bs')} />
        <Kpi label="Revenue verified" value={fmtPct(verified)} tone={verified >= 0.95 ? 'good' : 'warn'} sub="bank, ledger, invoices" icon={<ShieldCheck size={18} />} onClick={() => nav('/ido/assurance')} />
        <Kpi label="Close complete" value={`${closed}/${TENANTS.length}`} tone={closed === TENANTS.length ? 'good' : 'warn'} sub="all five stages done" icon={<CheckCircle2 size={18} />} onClick={() => nav('/ido/journey')} />
      </div>

      <Card title="Finance journey" action={<button onClick={() => nav('/ido/journey')} className="inline-flex items-center gap-1 text-xs font-semibold text-ido-teal hover:underline">Open board <ArrowRight size={12} /></button>} className="mt-4">
        <div className="grid gap-px overflow-hidden bg-ido-line sm:grid-cols-5">
          {STAGES.map((s, i) => {
            const cnt = (st: string) => pipes.filter((x) => x.cells.find((c) => c.stage === s)!.status === st).length
            const d = cnt('Done')
            return (
              <button key={s} onClick={() => nav('/ido/journey')} className="bg-white p-4 text-left transition hover:bg-ido-mist">
                <div className="text-xs font-semibold text-ido-slate">
                  {i + 1}. {s}
                </div>
                <div className="mt-1 text-2xl font-semibold text-ido-primary">
                  {d}
                  <span className="text-sm font-normal text-ido-slate">/{TENANTS.length}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ido-mist">
                  <div className="h-full bg-ido-teal" style={{ width: `${(d / TENANTS.length) * 100}%` }} />
                </div>
                <div className="mt-2 text-xs text-ido-slate">
                  {cnt('Blocked') > 0 && <span className="font-semibold text-rose-600">{cnt('Blocked')} blocked · </span>}
                  {cnt('In progress')} in progress
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Portfolio revenue vs budget" className="xl:col-span-2">
          <div className="p-3">
            <FinanceTrend data={trend} />
          </div>
        </Card>
        <Card title="Sectors this month">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Sector</th>
                  <th className="th text-right">Revenue</th>
                  <th className="th text-right">EBITDA %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {SECTORS.map((sec) => {
                  const ks = kpis.filter((k) => k.sector === sec)
                  const rev = ks.reduce((s, k) => s + k.revenue, 0)
                  const eb = ks.reduce((s, k) => s + k.ebitda, 0)
                  return (
                    <tr key={sec}>
                      <td className="td">
                        <div className="font-medium text-ido-primary">{sec}</div>
                        <div className="text-xs text-ido-slate">{ks.length} {ks.length > 1 ? 'companies' : 'company'}</div>
                      </td>
                      <td className="td text-right tabular-nums">{fmtAED(rev)}</td>
                      <td className="td text-right tabular-nums">{fmtPct(eb / rev)}</td>
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
