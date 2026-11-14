import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, Coins, Percent, Sparkles } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useRole } from '../../context/RoleContext'
import { tenantById, type ReconType } from '../../data/tenants'
import { CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, CURRENT_MONTH, monthLabel } from '../../data/generate'
import { aging, ageDays, byReconType, fmtAED, isOpen, tenantSummary, tenantTrend } from '../../lib/metrics'
import { Card, Health, Kpi, Pill } from '../../components/ui'
import { CountUp, Hero, Timeline } from '../../components/fx'
import { AgingBars, MatchTrend, TypeBars } from '../../components/charts'

// Manual close tasks survive navigation within the session
const manualTasks = new Map<string, boolean>()

export default function Overview() {
  const { tenantId = '' } = useParams()
  const { ds, activity } = useData()
  const { persona } = useRole()
  const nav = useNavigate()
  const [, force] = useState(0)
  const t = tenantById(tenantId)!
  const s = tenantSummary(ds, tenantId)
  const trend = tenantTrend(ds, tenantId)
  const exc = ds.exceptions.filter((e) => e.tenantId === tenantId)
  const top = exc.filter(isOpen).sort((a, b) => b.amount - a.amount).slice(0, 6)
  const recons = ds.recons.filter((r) => r.tenantId === tenantId && r.month === CURRENT_MONTH)
  const isCfo = persona?.kind === 'cfo'
  const first = isCfo ? t.cfo.split(' ')[0] : null
  const go = (q: string) => nav(`/t/${tenantId}/exceptions${q}`)

  const doneFor = (types: ReconType[]) => recons.filter((r) => types.includes(r.type)).every((r) => r.stage === 'Signed off')
  const tasks: { id: string; label: string; auto?: boolean; done: boolean; link?: string }[] = [
    { id: 'bank', label: 'Bank reconciliations signed off', auto: true, done: doneFor(['Bank']), link: 'reconciliations?type=Bank' },
    { id: 'ic', label: 'Intercompany balances agreed', auto: true, done: doneFor(['Intercompany']), link: 'reconciliations?type=Intercompany' },
    { id: 'sub', label: 'AR / AP sub-ledgers tied out', auto: true, done: doneFor(['AR sub-ledger', 'AP sub-ledger']), link: 'reconciliations' },
    { id: 'accr', label: 'Accruals and GL to sub-ledger', auto: true, done: doneFor(['GL to sub-ledger']), link: 'reconciliations?type=GL%20to%20sub-ledger' },
    { id: 'fa', label: 'Fixed asset roll-forward', auto: true, done: doneFor(['Fixed assets']), link: 'reconciliations?type=Fixed%20assets' },
    { id: 'pay', label: 'Payroll and EOSB reconciled', auto: true, done: doneFor(['Payroll']), link: 'reconciliations?type=Payroll' },
    { id: 'hi', label: 'No high-priority exceptions open', auto: true, done: s.highOpen === 0, link: 'exceptions?priority=High' },
    { id: 'comm', label: 'Variance commentary written', done: manualTasks.get(`${tenantId}-comm`) ?? !s.closeRunning },
    { id: 'pack', label: 'Close pack sent to IDO', done: manualTasks.get(`${tenantId}-pack`) ?? false },
  ]
  const doneCount = tasks.filter((x) => x.done).length
  const feed = activity.filter((a) => a.tenantId === tenantId).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6)

  return (
    <>
      <Hero
        eyebrow={`${monthLabel(CURRENT_MONTH, true)} close · ${t.sector}`}
        title="Close checklist"
        subtitle={
          s.closeRunning
            ? `Business day ${CLOSE_DAY_TODAY} of the close. ${s.reconsTotal - s.reconsSignedOff} reconciliations still need sign-off and ${s.highOpen} high-priority exceptions are open.`
            : `October closed in ${s.closeDays} business days. ${s.openCount} exceptions carried forward, ${s.aged60Count} of them older than 60 days.`
        }
        right={
          <>
            <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/15">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Health</span>
              <span className="text-2xl font-semibold"><CountUp value={s.health} /></span>
              <span className="text-xs text-white/50">/ 100</span>
            </div>
            <Link to="exceptions" className="btn bg-white text-ido-navy hover:bg-ido-mist">
              Work exceptions <ArrowRight size={16} />
            </Link>
          </>
        }
      >
        <div className="flex items-center gap-3 text-xs text-white/70">
          <span>Close progress</span>
          <div className="h-1.5 max-w-md flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-ido-sky transition-all duration-700" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
          </div>
          <span className="font-semibold text-white">{doneCount}/{tasks.length} tasks</span>
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Kpi label="Match rate" value={<CountUp value={s.matchRate * 100} format={(n) => n.toFixed(1) + '%'} />} delta={s.matchDelta} sub="vs Sep" icon={<Percent size={18} />} spark={trend.map((x) => x.matchRate)} onClick={() => nav('reconciliations')} hint="Open the reconciliation workbench" />
        <Kpi label="Open exceptions" value={<CountUp value={s.openCount} />} sub={`${s.highOpen} high priority`} tone={s.highOpen > 3 ? 'warn' : 'default'} icon={<AlertTriangle size={18} />} spark={trend.map((x) => x.stillOpen)} onClick={() => go('')} />
        <Kpi label="Unreconciled" value={<CountUp value={s.openAmount} format={(n) => fmtAED(n)} />} sub="sum of open exceptions" icon={<Coins size={18} />} onClick={() => go('?priority=High')} hint="Show high-priority items" />
        <Kpi label="Aged over 60 days" value={<CountUp value={s.aged60Count} />} sub={fmtAED(s.aged60Amount)} tone={s.aged60Count > 8 ? 'bad' : s.aged60Count > 3 ? 'warn' : 'good'} icon={<CalendarClock size={18} />} onClick={() => go('?age=60%2B')} />
        <Kpi
          label="Close status"
          value={s.closeRunning ? `Day ${CLOSE_DAY_TODAY}` : `${s.closeDays} days`}
          sub={s.closeRunning ? `open, SLA is ${CLOSE_SLA_DAYS} days` : `${s.reconsSignedOff}/${s.reconsTotal} signed off`}
          tone={s.slaBreach ? 'bad' : 'good'}
          icon={<CheckCircle2 size={18} />}
          spark={trend.filter((x) => x.closeDays !== null).map((x) => x.closeDays as number)}
          onClick={() => nav(s.closeRunning ? 'reconciliations?stage=In%20progress' : 'reconciliations')}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Match rate trend" className="xl:col-span-2" action={<span className="text-xs text-ido-slate">Last 6 closes</span>}>
          <div className="p-4"><MatchTrend data={trend} /></div>
        </Card>
        <Card title="Month-end close checklist" action={<span className="text-xs font-semibold text-ido-teal">{doneCount}/{tasks.length}</span>}>
          <ul className="divide-y divide-ido-line">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
                <button
                  disabled={task.auto || !isCfo}
                  onClick={() => { manualTasks.set(`${tenantId}-${task.id}`, !task.done); force((n) => n + 1) }}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${task.done ? 'border-ido-teal bg-ido-teal text-white' : 'border-ido-line bg-white'} ${!task.auto && isCfo ? 'cursor-pointer hover:border-ido-teal' : 'cursor-default'}`}
                  aria-label={task.label}
                >
                  {task.done && <Check size={13} strokeWidth={3} />}
                </button>
                <span className={`flex-1 text-sm ${task.done ? 'text-ido-slate line-through decoration-ido-line' : 'text-ido-navy'}`}>{task.label}</span>
                {task.auto ? (
                  task.link && !task.done ? <Link to={task.link} className="text-xs font-semibold text-ido-teal hover:underline">Go</Link> : <span className="text-[10px] font-semibold uppercase tracking-wider text-ido-muted">auto</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Open exceptions by age" action={<span className="text-xs text-ido-slate">Click a bar</span>}>
          <div className="p-4"><AgingBars data={aging(exc)} onSelect={(b) => go(`?age=${b}`)} /></div>
        </Card>
        <Card title="Where the exceptions sit" action={<span className="text-xs text-ido-slate">Click a bar</span>}>
          <div className="p-4"><TypeBars data={byReconType(ds, tenantId).filter((r) => r.count)} onSelect={(ty) => go(`?type=${encodeURIComponent(ty)}`)} height={220} /></div>
          <div className="flex gap-2 border-t border-ido-line px-5 py-3 text-xs text-ido-slate">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-ido-teal" /> {t.profile.story}
          </div>
        </Card>
        <Card title="Recent activity">
          <div className="max-h-[330px] overflow-y-auto p-5"><Timeline items={feed} /></div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Largest open exceptions" className="xl:col-span-2" action={<Link to="exceptions" className="text-sm font-semibold text-ido-teal">View all</Link>}>
          <ul className="divide-y divide-ido-line">
            {top.map((e) => (
              <li key={e.id}>
                <button onClick={() => go(`?focus=${e.id}`)} className="flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-ido-mist/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ido-primary">{e.type}</span>
                      <Pill>{e.priority}</Pill>
                    </div>
                    <div className="truncate text-xs text-ido-slate">{e.reconType} · {e.counterparty} · {monthLabel(e.month)} close · {ageDays(e)}d old · {e.owner}</div>
                  </div>
                  <div className="text-right font-semibold tabular-nums">{fmtAED(e.amount, false)}</div>
                  <ArrowRight size={15} className="text-ido-muted" />
                </button>
              </li>
            ))}
            {!top.length && <li className="px-5 py-10 text-center text-sm text-ido-slate">No open exceptions. Nice work.</li>}
          </ul>
        </Card>
        <Card title={`${monthLabel(CURRENT_MONTH, true)} reconciliations`} action={<Link to="reconciliations" className="text-sm font-semibold text-ido-teal">Workbench</Link>}>
          <div className="grid grid-cols-2 gap-px bg-ido-line">
            {(['Signed off', 'Pending review', 'In progress', 'Not started'] as const).map((st) => {
              const n = recons.filter((r) => r.stage === st).length
              return (
                <button key={st} onClick={() => nav(`reconciliations?stage=${encodeURIComponent(st)}`)} className="bg-white px-5 py-4 text-left transition hover:bg-ido-mist/60">
                  <Pill>{st}</Pill>
                  <div className="mt-2 text-2xl font-semibold text-ido-primary">{n}</div>
                  <div className="text-xs text-ido-slate">of {recons.length}</div>
                </button>
              )
            })}
          </div>
          <div className="px-5 py-4"><Health value={s.health} /><div className="mt-1 text-xs text-ido-slate">Health blends match rate, exception age, close speed and sign-off progress.</div></div>
        </Card>
      </div>
    </>
  )
}
