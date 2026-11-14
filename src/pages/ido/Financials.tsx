import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, TenantMark } from '../../components/ui'
import { Hero, Tabs } from '../../components/fx'
import { FinanceTrend } from '../../components/charts'
import { Select, SidePanel, aed } from '../../components/finance'
import { TENANTS, tenantById } from '../../data/tenants'
import { CURRENT_MONTH, MONTHS, monthLabel, type Month } from '../../data/generate'
import { ACCOUNTS, bal, journalsFor, type BSLine, type PLLine } from '../../data/finance'
import { budget, bs, companyKpis, financeTrend, pl } from '../../lib/finance'
import { fmtAED, fmtPct } from '../../lib/metrics'
import { linksFor } from '../../lib/paths'

type Row = { label: string; line?: PLLine | BSLine; key: string; total?: boolean; sign?: 1 | -1 }
const PL_ROWS: Row[] = [
  { label: 'Revenue', line: 'Revenue', key: 'revenue' },
  { label: 'Cost of sales', line: 'Cost of sales', key: 'cogs', sign: -1 },
  { label: 'Gross profit', key: 'grossProfit', total: true },
  { label: 'Staff costs', line: 'Staff costs', key: 'staff', sign: -1 },
  { label: 'Other operating expenses', line: 'Other operating expenses', key: 'opex', sign: -1 },
  { label: 'EBITDA', key: 'ebitda', total: true },
  { label: 'Depreciation & amortisation', line: 'Depreciation & amortisation', key: 'da', sign: -1 },
  { label: 'Finance costs', line: 'Finance costs', key: 'finance', sign: -1 },
  { label: 'Profit before tax', key: 'pbt', total: true },
  { label: 'Corporate tax', line: 'Corporate tax', key: 'tax', sign: -1 },
  { label: 'Net income', key: 'netIncome', total: true },
]
const BS_ROWS: Row[] = [
  { label: 'Cash and bank', line: 'Cash and bank', key: 'cash' },
  { label: 'Trade receivables', line: 'Trade receivables', key: 'receivables' },
  { label: 'Inventory', line: 'Inventory', key: 'inventory' },
  { label: 'Other current assets', line: 'Other current assets', key: 'otherCurrent' },
  { label: 'Property, plant & equipment', line: 'Property, plant & equipment', key: 'ppe' },
  { label: 'Intangible assets', line: 'Intangible assets', key: 'intangibles' },
  { label: 'Suspense', line: 'Suspense', key: 'suspense' },
  { label: 'Total assets', key: 'totalAssets', total: true },
  { label: 'Trade payables', line: 'Trade payables', key: 'payables' },
  { label: 'Accruals & other payables', line: 'Accruals & other payables', key: 'accruals' },
  { label: 'Borrowings', line: 'Borrowings', key: 'borrowings' },
  { label: 'Total liabilities', key: 'totalLiabilities', total: true },
  { label: 'Share capital', line: 'Share capital', key: 'shareCapital' },
  { label: 'Retained earnings (incl. month profit)', line: 'Retained earnings', key: 'retained' },
  { label: 'Total equity', key: 'totalEquity', total: true },
]

export default function Financials() {
  const [sp, setSp] = useSearchParams()
  const { tenantId: locked } = useParams() // a company's own route shows only that company
  const company = locked || sp.get('company') || 'all'
  const month = (sp.get('month') as Month) || CURRENT_MONTH
  const view = (sp.get('view') as 'pl' | 'bs') || 'pl'
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    n.set(k, v)
    setSp(n, { replace: true })
  }
  const [drill, setDrill] = useState<Row | null>(null)
  const mi = MONTHS.indexOf(month)
  const prev = mi > 0 ? MONTHS[mi - 1] : null
  const cur = view === 'pl' ? (pl(company, month) as unknown as Record<string, number>) : (bs(company, month) as unknown as Record<string, number>)
  const pre = prev ? (view === 'pl' ? (pl(company, prev) as unknown as Record<string, number>) : (bs(company, prev) as unknown as Record<string, number>)) : null
  const ytd = (key: string) => MONTHS.slice(0, mi + 1).reduce((s, m) => s + (pl(company, m) as unknown as Record<string, number>)[key], 0)
  const bud = budget(company, month)
  const trend = useMemo(() => financeTrend(company), [company])
  const name = company === 'all' ? 'Portfolio (simple sum, no eliminations)' : tenantById(company)!.name
  const kpis = useMemo(() => TENANTS.map((t) => companyKpis(t.id, month)), [month])
  const rows = (view === 'pl' ? PL_ROWS : BS_ROWS).filter((r) => r.key !== 'suspense' || cur.suspense)

  return (
    <>
      <Hero eyebrow={`Financial statements · ${monthLabel(month, true)}`} title={name} subtitle="Built from each company's trial balance. Click any line to see the ledger accounts and journals behind it." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {!locked && <Select label="Company" value={company} onChange={(v) => set('company', v)} options={[{ value: 'all', label: 'All 15 companies' }, ...TENANTS.map((t) => ({ value: t.id, label: t.name }))]} />}
        <Select label="Month" value={month} onChange={(v) => set('month', v)} options={[...MONTHS].reverse().map((m) => ({ value: m, label: monthLabel(m, true) }))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="card xl:col-span-3">
          <Tabs
            tabs={[
              { id: 'pl', label: 'Profit and loss' },
              { id: 'bs', label: 'Balance sheet' },
            ]}
            value={view}
            onChange={(v) => set('view', v)}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">AED</th>
                  <th className="th text-right">{monthLabel(month)}</th>
                  {prev && <th className="th text-right">{monthLabel(prev)}</th>}
                  {prev && <th className="th text-right">Change</th>}
                  {view === 'pl' && <th className="th text-right">Budget</th>}
                  {view === 'pl' && <th className="th text-right">YTD (from May)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {rows.map((r) => {
                  const v = cur[r.key]
                  const p = pre?.[r.key]
                  const ch = p ? (v - p) / Math.abs(p) : 0
                  const budV = r.key === 'revenue' ? bud.revenue : r.key === 'ebitda' ? bud.ebitda : null
                  const show = (n: number) => aed(r.sign === -1 ? -n : n)
                  return (
                    <tr key={r.key} onClick={() => r.line && setDrill(r)} className={`${r.total ? 'bg-ido-mist/50 font-semibold' : ''} ${r.line ? 'cursor-pointer hover:bg-ido-mist/60' : ''} ${r.key === 'suspense' ? 'bg-rose-50/60' : ''}`}>
                      <td className={`td ${r.total ? 'text-ido-primary' : 'pl-7'}`}>{r.label}</td>
                      <td className="td text-right tabular-nums">{show(v)}</td>
                      {prev && <td className="td text-right tabular-nums text-ido-slate">{show(p ?? 0)}</td>}
                      {prev && <td className={`td text-right text-xs tabular-nums ${!p ? '' : (ch >= 0) === (r.sign !== -1) ? 'text-emerald-600' : 'text-rose-600'}`}>{p ? `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(1)}%` : ''}</td>}
                      {view === 'pl' && <td className="td text-right tabular-nums text-ido-slate">{budV !== null ? aed(budV) : ''}</td>}
                      {view === 'pl' && <td className="td text-right tabular-nums text-ido-slate">{show(ytd(r.key))}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {view === 'bs' && <p className="px-5 py-3 text-xs text-ido-muted">Check: total assets {aed(cur.totalAssets)} = liabilities + equity {aed(cur.totalLiabilities + cur.totalEquity)}.</p>}
        </div>
        <Card title="Revenue vs budget, with EBITDA" className="xl:col-span-2">
          <div className="p-3">
            <FinanceTrend data={trend} />
          </div>
        </Card>
      </div>

      {company === 'all' && (
        <Card title={`Company comparison · ${monthLabel(month, true)}`} className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Company</th>
                  <th className="th text-right">Revenue</th>
                  <th className="th text-right">vs budget</th>
                  <th className="th text-right">EBITDA</th>
                  <th className="th text-right">EBITDA margin</th>
                  <th className="th text-right">Net income</th>
                  <th className="th text-right">Cash</th>
                  <th className="th text-right">Net debt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {kpis
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((k) => {
                    const vb = k.revenue / k.revenueBudget - 1
                    return (
                      <tr key={k.tenantId} className="cursor-pointer hover:bg-ido-mist/60" onClick={() => set('company', k.tenantId)}>
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <TenantMark short={tenantById(k.tenantId)!.short} />
                            <span className="font-semibold text-ido-primary">{k.name}</span>
                          </div>
                        </td>
                        <td className="td text-right tabular-nums">{fmtAED(k.revenue)}</td>
                        <td className={`td text-right tabular-nums ${vb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{`${vb >= 0 ? '+' : ''}${(vb * 100).toFixed(1)}%`}</td>
                        <td className="td text-right tabular-nums">{fmtAED(k.ebitda)}</td>
                        <td className="td text-right tabular-nums">{fmtPct(k.ebitdaMargin)}</td>
                        <td className={`td text-right tabular-nums ${k.netIncome < 0 ? 'text-rose-600' : ''}`}>{fmtAED(k.netIncome)}</td>
                        <td className="td text-right tabular-nums">{fmtAED(k.cash)}</td>
                        <td className="td text-right tabular-nums">{fmtAED(k.netDebt)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {drill && <Drill row={drill} company={company} month={month} cfo={!!locked} onClose={() => setDrill(null)} />}
    </>
  )
}

function Drill({ row, company, month, cfo, onClose }: { row: Row; company: string; month: string; cfo: boolean; onClose: () => void }) {
  const accts = ACCOUNTS.filter((a) => a.line === row.line)
  const ids = company === 'all' ? TENANTS.map((t) => t.id) : [company]
  const [acct, setAcct] = useState(accts[0].code)
  const [co, setCo] = useState(ids[0])
  const natural = (v: number, code: string) => (ACCOUNTS.find((a) => a.code === code)!.normal === 'Cr' ? -v : v)
  const lines = journalsFor(co, month, acct)
  return (
    <SidePanel wide eyebrow={`${company === 'all' ? 'Portfolio' : tenantById(company)!.name} · ${monthLabel(month, true)}`} title={`${row.label}: ledger accounts and journals`} onClose={onClose}>
      <div className="space-y-5 p-5">
        <div>
          <div className="eyebrow mb-2">1. Ledger accounts on this line</div>
          <table className="w-full rounded-xl border border-ido-line">
            <tbody className="divide-y divide-ido-line">
              {accts.map((a) => {
                const v = ids.reduce((s, id) => s + bal(id, month, a.code), 0)
                return (
                  <tr key={a.code} onClick={() => setAcct(a.code)} className={`cursor-pointer ${acct === a.code ? 'bg-ido-mist' : 'hover:bg-ido-mist/60'}`}>
                    <td className="td font-mono text-xs text-ido-slate">{a.code}</td>
                    <td className="td font-medium text-ido-primary">{a.name}</td>
                    <td className="td text-right tabular-nums">{aed(natural(v, a.code))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {company === 'all' && (
          <div>
            <div className="eyebrow mb-2">2. By company</div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-ido-line">
              <table className="w-full">
                <tbody className="divide-y divide-ido-line">
                  {ids
                    .map((id) => ({ id, v: natural(bal(id, month, acct), acct) }))
                    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
                    .map(({ id, v }) => (
                      <tr key={id} onClick={() => setCo(id)} className={`cursor-pointer ${co === id ? 'bg-ido-mist' : 'hover:bg-ido-mist/60'}`}>
                        <td className="td font-medium text-ido-primary">{tenantById(id)!.name}</td>
                        <td className="td text-right tabular-nums">{aed(v)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="eyebrow">
              {company === 'all' ? '3' : '2'}. Journal lines · {tenantById(co)!.name} · {acct}
            </div>
            <Link to={linksFor(co, cfo).ledger(acct, month)} className="inline-flex items-center gap-1 text-xs font-semibold text-ido-teal hover:underline">
              Open full ledger <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-ido-line">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Journal</th>
                  <th className="th">Date</th>
                  <th className="th">Description</th>
                  <th className="th text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {lines.map((l) => (
                  <tr key={l.id} className={l.flag ? 'bg-rose-50/60' : ''}>
                    <td className="td font-mono text-xs">{l.id}</td>
                    <td className="td text-ido-slate">{l.date}</td>
                    <td className="td">{l.description}</td>
                    <td className="td text-right tabular-nums">{aed(natural(l.amount, acct))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ido-line font-semibold">
                  <td className="td" colSpan={3}>
                    Total {lines.length} lines {accts.find((a) => a.code === acct) && ACCOUNTS.find((a) => a.code === acct)!.statement === 'BS' ? '(movement in month)' : ''}
                  </td>
                  <td className="td text-right tabular-nums">{aed(natural(lines.reduce((s, l) => s + l.amount, 0), acct))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </SidePanel>
  )
}
