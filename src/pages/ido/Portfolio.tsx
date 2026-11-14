import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CalendarClock, Coins, Gauge, MessageSquareText, Percent, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { SECTORS, TENANTS, tenantById } from '../../data/tenants'
import { CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, CURRENT_MONTH, MONTHS, monthLabel } from '../../data/generate'
import { ageDays, fmtAED, fmtPct, healthBand, isOpen, matchFor, portfolioSummary, portfolioTrend, tenantTrend, type TenantSummary } from '../../lib/metrics'
import { Card, Health, Kpi, Pill, TenantMark } from '../../components/ui'
import { CountUp, Hero, Sparkline } from '../../components/fx'
import { MatchTrend } from '../../components/charts'

type SortKey = 'health' | 'matchRate' | 'openCount' | 'openAmount' | 'aged60Count'

export default function Portfolio() {
  const { ds } = useData()
  const nav = useNavigate()
  const [sector, setSector] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'health', dir: 1 })
  // the assistant lives on its own page; questions are passed in the URL
  const setChat = (q: string) => nav(q ? `/ido/assistant?q=${encodeURIComponent(q)}` : '/ido/assistant')
  const [peek, setPeek] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const p = useMemo(() => portfolioSummary(ds), [ds])
  const trend = useMemo(() => portfolioTrend(ds), [ds])
  const prevMatch = trend[trend.length - 2].matchRate / 100
  const flags = useMemo(() => riskFlags(p.tenants, matchFor(ds, 'rak-ports', '2026-10').matchRate - matchFor(ds, 'rak-ports', '2026-07').matchRate), [p.tenants, ds])

  const rows = p.tenants
    .filter((t) => !sector || tenantById(t.tenantId)!.sector === sector)
    .filter((t) => !onlyOpen || t.closeRunning)
    .sort((a, b) => (a[sort.k] - b[sort.k]) * sort.dir)

  const sectors = SECTORS.map((sec) => {
    const ts = p.tenants.filter((t) => tenantById(t.tenantId)!.sector === sec)
    return { sec, n: ts.length, health: Math.round(ts.reduce((s, t) => s + t.health, 0) / ts.length), open: ts.reduce((s, t) => s + t.openAmount, 0), match: ts.reduce((s, t) => s + t.matchRate, 0) / ts.length }
  })

  const SortTh = ({ k, children, right }: { k: SortKey; children: string; right?: boolean }) => (
    <th className={`th cursor-pointer select-none hover:text-ido-primary ${right ? 'text-right' : ''}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : k === 'health' || k === 'matchRate' ? 1 : -1 }))}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.k === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  )
  const worst = [...p.tenants].sort((a, b) => a.health - b.health)[0]

  return (
    <>
      <Hero
        eyebrow={`Master view · ${monthLabel(CURRENT_MONTH, true)} close · business day ${CLOSE_DAY_TODAY}`}
        title="Account reconciliations"
        subtitle={`${p.closed} of ${TENANTS.length} companies have closed October. ${fmtAED(p.openAmount)} sits in open exceptions, and ${tenantById(worst.tenantId)!.name} needs the most attention.`}
        right={
          <>
            <button className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20" onClick={() => setChat('Which companies need attention?')}>
              What needs attention?
            </button>
            <button className="btn bg-white text-ido-navy hover:bg-ido-mist" onClick={() => setChat('')}>
              <MessageSquareText size={16} /> Ask the assistant
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {sectors.map((s) => {
            const on = sector === s.sec
            const band = healthBand(s.health)
            return (
              <button
                key={s.sec}
                onClick={() => setSector(on ? '' : s.sec)}
                className={`rounded-xl px-4 py-3 text-left ring-1 transition ${on ? 'bg-white text-ido-navy ring-white' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
              >
                <div className={`text-[11px] font-semibold uppercase tracking-wider ${on ? 'text-ido-slate' : 'text-white/55'}`}>{s.sec}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{s.health}</span>
                  <span className={`h-2 w-2 rounded-full ${band === 'good' ? 'bg-emerald-400' : band === 'watch' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                </div>
                <div className={`text-xs ${on ? 'text-ido-slate' : 'text-white/55'}`}>
                  {s.n} {s.n > 1 ? 'companies' : 'company'} · {fmtAED(s.open)}
                </div>
              </button>
            )
          })}
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Kpi label="Portfolio match rate" value={<CountUp value={p.matchRate * 100} format={(n) => n.toFixed(1) + '%'} />} delta={(p.matchRate - prevMatch) * 100} sub="vs Sep" icon={<Percent size={18} />} spark={trend.map((t) => t.matchRate)} onClick={() => document.getElementById('heatmap')?.scrollIntoView({ behavior: 'smooth' })} hint="Jump to heatmap" />
        <Kpi label="Open exceptions" value={<CountUp value={p.openCount} />} sub={fmtAED(p.openAmount) + ' unreconciled'} icon={<Coins size={18} />} spark={trend.map((t) => t.stillOpen)} onClick={() => nav('/ido/exceptions')} />
        <Kpi label="Aged over 60 days" value={<CountUp value={p.aged60Count} />} sub={fmtAED(p.aged60Amount)} tone="bad" icon={<CalendarClock size={18} />} onClick={() => nav('/ido/exceptions?age=60%2B')} />
        <Kpi label="Closes complete" value={`${p.closed}/${TENANTS.length}`} sub={`${p.slaBreaches} over ${CLOSE_SLA_DAYS}-day SLA`} tone={p.slaBreaches ? 'warn' : 'good'} icon={<AlertTriangle size={18} />} onClick={() => setOnlyOpen((v) => !v)} active={onlyOpen} hint="Filter to closes still running" />
        <Kpi label="Avg health score" value={<CountUp value={p.avgHealth} />} sub="out of 100" icon={<Gauge size={18} />} onClick={() => setSort({ k: 'health', dir: 1 })} hint="Sort leaderboard by health" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              Portfolio companies
              {sector && <button onClick={() => setSector('')} className="inline-flex items-center gap-1 rounded-full bg-ido-mist px-2.5 py-0.5 text-xs font-medium text-ido-primary">{sector} <X size={12} /></button>}
              {onlyOpen && <button onClick={() => setOnlyOpen(false)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">Close still open <X size={12} /></button>}
            </span>
          }
          className="xl:col-span-2"
          action={<span className="hidden text-xs text-ido-slate sm:inline">Click a row for a quick view</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-ido-line bg-ido-mist/60">
                <tr>
                  <th className="th">Company</th>
                  <SortTh k="health">Health</SortTh>
                  <SortTh k="matchRate" right>Match rate</SortTh>
                  <th className="th">6-mo trend</th>
                  <SortTh k="openCount" right>Open</SortTh>
                  <SortTh k="openAmount" right>Unreconciled</SortTh>
                  <SortTh k="aged60Count" right>60d+</SortTh>
                  <th className="th">Close</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {rows.map((s) => {
                  const t = tenantById(s.tenantId)!
                  const tr = tenantTrend(ds, t.id).map((x) => x.matchRate)
                  return (
                    <tr key={t.id} className={`cursor-pointer transition ${peek === t.id ? 'bg-ido-sky/10' : 'hover:bg-ido-mist/60'}`} onClick={() => setPeek(t.id)}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <TenantMark short={t.short} />
                          <div>
                            <div className="font-semibold text-ido-primary">{t.name}</div>
                            <div className="text-xs text-ido-slate">{t.sector}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td"><Health value={s.health} /></td>
                      <td className="td text-right">
                        <div className="font-semibold tabular-nums">{fmtPct(s.matchRate)}</div>
                        <div className={`text-xs tabular-nums ${s.matchDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{s.matchDelta >= 0 ? '+' : ''}{s.matchDelta.toFixed(1)} pts</div>
                      </td>
                      <td className="td"><Sparkline data={tr} color={tr.at(-1)! >= tr[0] ? '#015677' : '#E11D48'} width={80} /></td>
                      <td className="td text-right tabular-nums">{s.openCount}</td>
                      <td className="td text-right font-semibold tabular-nums">{fmtAED(s.openAmount)}</td>
                      <td className={`td text-right tabular-nums ${s.aged60Count > 8 ? 'font-semibold text-rose-600' : ''}`}>{s.aged60Count}</td>
                      <td className="td">
                        {s.closeRunning ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Open · day {CLOSE_DAY_TODAY}</span> : <span className={`text-sm ${s.slaBreach ? 'text-amber-600' : 'text-emerald-700'}`}>{s.closeDays} days</span>}
                      </td>
                    </tr>
                  )
                })}
                {!rows.length && <tr><td colSpan={8} className="td py-10 text-center text-ido-slate">No companies match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Risk flags" action={<span className="text-xs text-ido-slate">{flags.length} signals</span>}>
          <ul className="divide-y divide-ido-line">
            {flags.map((f, i) => (
              <li key={i}>
                <button onClick={() => setPeek(f.tenantId)} className="flex w-full gap-3 px-5 py-3.5 text-left transition hover:bg-ido-mist/60">
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${f.tone === 'good' ? 'bg-emerald-50 text-emerald-600' : f.tone === 'bad' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    {f.tone === 'good' ? <TrendingUp size={16} /> : f.tone === 'bad' ? <TrendingDown size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <div className="text-sm">
                    <div className="font-semibold text-ido-primary">{tenantById(f.tenantId)!.name}</div>
                    <div className="text-ido-slate">{f.text}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div id="heatmap" className="mt-4 grid scroll-mt-24 gap-4 xl:grid-cols-5">
        <Card title="Portfolio match rate trend" className="xl:col-span-2">
          <div className="p-4"><MatchTrend data={trend} /></div>
        </Card>
        <Card
          title="Match rate heatmap"
          className="xl:col-span-3"
          action={<span className="max-w-[60%] truncate text-right text-xs text-ido-slate">{hover ?? `Target ${(TARGET * 100).toFixed(0)}%. Hover or click a cell`}</span>}
        >
          <div className="overflow-x-auto p-4">
            <table className="w-full border-separate text-sm" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th />
                  {MONTHS.map((m) => <th key={m} className="pb-1.5 text-center text-xs font-semibold text-ido-slate">{monthLabel(m)}</th>)}
                  <th className="pb-1.5 pl-2 text-right text-xs font-semibold text-ido-slate">May to Oct</th>
                </tr>
              </thead>
              <tbody>
                {TENANTS.filter((t) => !sector || t.sector === sector).map((t) => {
                  const vals = MONTHS.map((m) => matchFor(ds, t.id, m).matchRate)
                  const change = (vals.at(-1)! - vals[0]) * 100
                  return (
                    <tr key={t.id} className="group">
                      <td className="whitespace-nowrap pr-3 text-xs font-medium text-ido-primary group-hover:font-semibold">{t.name}</td>
                      {MONTHS.map((m, i) => {
                        const v = vals[i]
                        const prev = i ? vals[i - 1] : null
                        const c = heat(v)
                        return (
                          <td key={m} className="p-0">
                            <button
                              onMouseEnter={() =>
                                setHover(`${t.name}, ${monthLabel(m, true)}: ${(v * 100).toFixed(1)}% (${v >= TARGET ? '+' : ''}${((v - TARGET) * 100).toFixed(1)} vs target${prev !== null ? `, ${v >= prev ? '+' : ''}${((v - prev) * 100).toFixed(1)} vs prior month` : ''})`)
                              }
                              onMouseLeave={() => setHover(null)}
                              onFocus={() => setHover(`${t.name}, ${monthLabel(m, true)}: ${(v * 100).toFixed(1)}%`)}
                              onClick={() => setPeek(t.id)}
                              title={`${t.name} · ${monthLabel(m, true)} · ${(v * 100).toFixed(1)}%`}
                              className="block w-full min-w-[46px] rounded py-2 text-center text-xs font-semibold tabular-nums outline-none ring-ido-navy transition hover:ring-2 focus-visible:ring-2"
                              style={{ background: c.bg, color: c.fg }}
                            >
                              {(v * 100).toFixed(1)}
                            </button>
                          </td>
                        )
                      })}
                      <td className="whitespace-nowrap pl-2 text-right text-xs font-semibold tabular-nums text-ido-navy">
                        <span className={change >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{change >= 0 ? '▲' : '▼'}</span> {Math.abs(change).toFixed(1)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ido-slate">
              <div className="flex items-center gap-2">
                <span>{(LOW * 100).toFixed(0)}% or less</span>
                <div className="relative h-2.5 w-48 rounded" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((f) => heat(LOW + f * (HIGH - LOW)).bg).join(', ')})` }}>
                  <span className="absolute -top-1 h-[18px] w-px bg-ido-navy" style={{ left: `${((TARGET - LOW) / (HIGH - LOW)) * 100}%` }} />
                </div>
                <span>{(HIGH * 100).toFixed(0)}%+</span>
              </div>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-ido-navy" /> {(TARGET * 100).toFixed(0)}% group target</span>
              <span>Red is below target, teal is above, grey is on target.</span>
            </div>
          </div>
        </Card>
      </div>

      {peek && <CompanyPeek id={peek} onClose={() => setPeek(null)} onAsk={(q) => setChat(q)} />}

    </>
  )
}

function CompanyPeek({ id, onClose, onAsk }: { id: string; onClose: () => void; onAsk: (q: string) => void }) {
  const { ds } = useData()
  const t = tenantById(id)!
  const s = portfolioSummary(ds).tenants.find((x) => x.tenantId === id)!
  const tr = tenantTrend(ds, id)
  const top = ds.exceptions.filter((e) => e.tenantId === id && isOpen(e)).sort((a, b) => b.amount - a.amount).slice(0, 4)
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ido-navy/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="bg-ido-navy p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-lg font-semibold">{t.short}</span>
              <div>
                <div className="text-xs text-white/60">{t.sector}</div>
                <h2 className="text-xl font-semibold">{t.name}</h2>
                <div className="text-xs text-white/60">CFO {t.cfo} · {t.erp} · {t.entities} {t.entities > 1 ? 'entities' : 'entity'}</div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-white/70 hover:bg-white/10" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[['Health', String(s.health)], ['Match rate', fmtPct(s.matchRate)], ['Unreconciled', fmtAED(s.openAmount)]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{k}</div>
                <div className="text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </header>
        <div className="space-y-5 p-6">
          <p className="rounded-lg bg-ido-mist px-4 py-3 text-sm text-ido-navy/80">{t.profile.story}</p>
          <div>
            <div className="eyebrow mb-2">Match rate, last 6 closes</div>
            <MatchTrend data={tr} height={190} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Open exceptions', `${s.openCount} (${s.highOpen} high)`], ['Aged over 60 days', `${s.aged60Count} · ${fmtAED(s.aged60Amount)}`], ['October close', s.closeRunning ? `Open, day ${CLOSE_DAY_TODAY}` : `${s.closeDays} business days`], ['Signed off', `${s.reconsSignedOff}/${s.reconsTotal} reconciliations`]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-ido-line px-3 py-2"><dt className="eyebrow">{k}</dt><dd className="mt-0.5 font-semibold text-ido-primary">{v}</dd></div>
            ))}
          </dl>
          <div>
            <div className="eyebrow mb-2">Largest open exceptions</div>
            <ul className="divide-y divide-ido-line rounded-lg border border-ido-line">
              {top.map((e) => (
                <li key={e.id}>
                  <Link to={`/t/${id}/exceptions?focus=${e.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-ido-mist/60">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ido-primary">{e.type}</div>
                      <div className="truncate text-xs text-ido-slate">{e.reconType} · {ageDays(e)}d old</div>
                    </div>
                    <Pill>{e.priority}</Pill>
                    <span className="font-semibold tabular-nums">{fmtAED(e.amount)}</span>
                  </Link>
                </li>
              ))}
              {!top.length && <li className="px-3 py-4 text-center text-sm text-ido-slate">No open exceptions.</li>}
            </ul>
          </div>
        </div>
        <footer className="mt-auto flex flex-wrap gap-2 border-t border-ido-line p-5">
          <Link to={`/t/${id}`} className="btn-primary">Open company view <ArrowRight size={16} /></Link>
          <button className="btn-ghost" onClick={() => onAsk(`What is driving exceptions at ${t.name}?`)}><MessageSquareText size={16} /> Ask about {t.name}</button>
        </footer>
      </aside>
    </div>
  )
}

// Diverging scale around the group match-rate target: rose below, neutral grey at target, IDO navy-teal above.
const TARGET = 0.92
const LOW = 0.85
const HIGH = 0.98
const NEG = [180, 35, 74] // #B4234A
const MID = [236, 240, 242] // #ECF0F2
const POS = [10, 61, 80] // #0A3D50 (IDO primary)
function mix(a: number[], b: number[], t: number) {
  return a.map((x, i) => Math.round(x + (b[i] - x) * t))
}
function heat(v: number) {
  const below = v < TARGET
  const t = below ? Math.min(1, (TARGET - v) / (TARGET - LOW)) : Math.min(1, (v - TARGET) / (HIGH - TARGET))
  const eased = Math.pow(t, 0.85)
  const [r, g, b] = mix(MID, below ? NEG : POS, eased)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return { bg: `rgb(${r},${g},${b})`, fg: lum < 0.55 ? '#FFFFFF' : '#001C27' }
}

function riskFlags(ts: TenantSummary[], rpGain: number) {
  const out: { tenantId: string; text: string; tone: 'good' | 'bad' | 'warn' }[] = []
  for (const s of [...ts].sort((a, b) => a.health - b.health)) {
    if (s.closeRunning) out.push({ tenantId: s.tenantId, text: `October close still open on day ${CLOSE_DAY_TODAY}, ${s.reconsTotal - s.reconsSignedOff} reconciliations not signed off.`, tone: 'bad' })
    if (s.aged60Count >= 8) out.push({ tenantId: s.tenantId, text: `${s.aged60Count} exceptions older than 60 days worth ${fmtAED(s.aged60Amount)}, concentrated in ${s.weakSpot}.`, tone: 'bad' })
    if (s.matchDelta < -0.5) out.push({ tenantId: s.tenantId, text: `Match rate down ${Math.abs(s.matchDelta).toFixed(1)} pts month on month.`, tone: 'warn' })
  }
  const flagged = out.slice(0, 5)
  flagged.push({ tenantId: 'rak-ports', text: `Match rate up ${(rpGain * 100).toFixed(1)} pts since July after rolling out automated receivables matching.`, tone: 'good' })
  return flagged
}
