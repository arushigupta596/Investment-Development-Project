import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Banknote, CheckCircle2, Coins, Percent, ShieldCheck, TrendingUp } from 'lucide-react'
import ActionList, { SEV } from '../../components/ActionList'
import { Card, Kpi } from '../../components/ui'
import { CountUp, Hero } from '../../components/fx'
import { FinanceTrend } from '../../components/charts'
import { StageChip } from '../../components/finance'
import { useData } from '../../context/DataContext'
import { useRole } from '../../context/RoleContext'
import { tenantById } from '../../data/tenants'
import { CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, CURRENT_MONTH, monthLabel } from '../../data/generate'
import { bs, companyKpis, financeTrend, pipelineFor } from '../../lib/finance'
import { assuranceFor } from '../../lib/assurance'
import { buildActions, type Severity } from '../../lib/actions'
import { fmtAED, fmtPct, tenantSummary } from '../../lib/metrics'
import { linksFor } from '../../lib/paths'
import { STAGE_INFO } from '../ido/Journey'

export default function TenantHome() {
  const { tenantId = '' } = useParams()
  const { persona } = useRole()
  const cfo = persona?.kind === 'cfo'
  const t = tenantById(tenantId)!
  const L = linksFor(tenantId, cfo)
  const { ds, feeds } = useData()
  const nav = useNavigate()
  const [sev, setSev] = useState<Severity | ''>('')
  const [done, setDone] = useState<Set<string>>(new Set())

  const actions = useMemo(() => buildActions(ds, feeds, tenantId), [ds, feeds, tenantId])
  const open = actions.filter((a) => !done.has(a.id))
  const count = (s: Severity) => open.filter((a) => a.severity === s).length
  const atStake = open.reduce((s, a) => s + (a.impact ?? 0), 0)
  const k = companyKpis(tenantId)
  const b = bs(tenantId, CURRENT_MONTH)
  const rs = tenantSummary(ds, tenantId)
  const a = assuranceFor(tenantId)
  const trend = useMemo(() => financeTrend(tenantId), [tenantId])
  const cells = pipelineFor(ds, feeds, tenantId)
  const vb = k.revenue / k.revenueBudget - 1
  const first = cfo ? t.cfo.split(' ')[0] : ''
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
        eyebrow={`${monthLabel(CURRENT_MONTH, true)} close · business day ${CLOSE_DAY_TODAY} · ${CLOSE_SLA_DAYS}-day deadline`}
        title={cfo ? `Good morning, ${first}` : t.name}
        subtitle={open.length ? `${open.length} actions need your attention. ${count('Critical') ? `${count('Critical')} are critical and block the close or put reported revenue in doubt.` : 'Nothing is critical.'}` : 'Nothing needs your attention right now.'}
        right={
          <button onClick={() => nav(L.journey)} className="btn bg-white text-ido-navy hover:bg-ido-mist">
            Finance journey <ArrowRight size={16} />
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(['Critical', 'High', 'Medium'] as Severity[]).map((s) => {
            const on = sev === s
            return (
              <button key={s} onClick={() => setSev(on ? '' : s)} className={`rounded-xl px-4 py-3 text-left ring-1 transition ${on ? 'bg-white text-ido-navy ring-white' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}>
                <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${on ? 'text-ido-slate' : 'text-white/55'}`}>
                  <span className={`h-2 w-2 rounded-full ${SEV[s].dot}`} /> {s}
                </div>
                <div className="mt-1 text-3xl font-semibold">{count(s)}</div>
                <div className={`text-xs ${on ? 'text-ido-slate' : 'text-white/55'}`}>{s === 'Critical' ? 'act today' : s === 'High' ? 'before sign-off' : 'this week'}</div>
              </button>
            )
          })}
          <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">AED at stake</div>
            <div className="mt-1 text-3xl font-semibold">{atStake ? fmtAED(atStake).replace('AED ', '') : '0'}</div>
            <div className="text-xs text-white/55">{done.size} done this session</div>
          </div>
        </div>
      </Hero>

      <div className="grid gap-4 xl:grid-cols-3">
        {actions.length ? (
          <ActionList actions={actions} sev={sev} done={done} toggleDone={toggleDone} showCompany={false} className="xl:col-span-2" />
        ) : (
          <Card title="Immediate actions" className="xl:col-span-2">
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-emerald-700">
              <CheckCircle2 size={18} /> All clear for October.
            </div>
          </Card>
        )}
        <Card title="October close" action={<button onClick={() => nav(L.journey)} className="text-xs font-semibold text-ido-teal hover:underline">Journey</button>}>
          <ol className="space-y-1 p-4">
            {cells.map((c, i) => (
              <li key={c.stage}>
                <button onClick={() => nav(STAGE_INFO[c.stage].to(tenantId, cfo))} className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-ido-mist">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ido-mist text-xs font-semibold text-ido-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ido-primary">{c.stage}</span>
                      <StageChip status={c.status} />
                    </div>
                    <div className="mt-0.5 text-xs text-ido-slate">{c.detail}</div>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Revenue" value={<CountUp value={k.revenue / 1e6} format={(n) => `AED ${n.toFixed(1)}M`} />} sub={<span className={vb >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{`${vb >= 0 ? '+' : ''}${fmtPct(vb)} vs budget`}</span>} icon={<TrendingUp size={18} />} spark={trend.map((x) => x.revenue)} onClick={() => nav(L.financials())} />
        <Kpi label="EBITDA" value={fmtAED(k.ebitda)} sub={`${fmtPct(k.ebitdaMargin)} margin`} icon={<Percent size={18} />} spark={trend.map((x) => x.ebitda)} onClick={() => nav(L.financials())} />
        <Kpi label="Net income" value={fmtAED(k.netIncome)} tone={k.netIncome < 0 ? 'bad' : 'default'} sub={`${fmtPct(k.netMargin)} net margin`} icon={<Coins size={18} />} onClick={() => nav(L.financials())} />
        <Kpi label="Cash" value={fmtAED(b.cash)} sub={`net debt ${fmtAED(k.netDebt)}`} icon={<Banknote size={18} />} onClick={() => nav(L.financials('bs'))} />
        <Kpi label="Revenue verified" value={fmtPct(a.verifiedPct)} tone={a.verifiedPct >= 0.95 ? 'good' : a.verifiedPct >= 0.85 ? 'warn' : 'bad'} sub={`${a.findings.length} findings`} icon={<ShieldCheck size={18} />} onClick={() => nav(L.assurance)} />
        <Kpi label="Match rate" value={fmtPct(rs.matchRate)} sub={`${rs.openCount} open exceptions`} icon={<CheckCircle2 size={18} />} onClick={() => nav(L.reconciliations)} />
      </div>

      <Card title="Revenue vs budget, with EBITDA" className="mt-4">
        <div className="p-3">
          <FinanceTrend data={trend} />
        </div>
      </Card>
    </>
  )
}
