import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, BookOpenCheck, FileText, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Card, Kpi, TenantMark } from '../../components/ui'
import { Hero } from '../../components/fx'
import { ChartFromSpec } from '../../components/charts'
import { tenantById } from '../../data/tenants'
import { allAssurance } from '../../lib/assurance'
import { fmtAED, fmtPct } from '../../lib/metrics'

export default function AssuranceOverview() {
  const nav = useNavigate()
  const all = useMemo(() => allAssurance().map((a) => ({ a, t: tenantById(a.tenantId)!, risk: a.findings.reduce((s, f) => s + f.amount, 0) })), [])
  const reported = all.reduce((s, x) => s + x.a.reported, 0)
  const verified = all.reduce((s, x) => s + x.a.verifiedPct * x.a.reported, 0) / reported
  const risk = all.reduce((s, x) => s + x.risk, 0)
  const nFind = all.reduce((s, x) => s + x.a.findings.length, 0)
  const clean = all.filter((x) => !x.a.findings.length).length
  const rows = [...all].sort((x, y) => x.a.verifiedPct - y.a.verifiedPct)
  const byType = new Map<string, number>()
  all.forEach((x) => x.a.findings.forEach((f) => byType.set(f.type, (byType.get(f.type) ?? 0) + f.amount)))

  const cell = (n: number, amt: number) =>
    n ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span className="font-semibold text-ido-primary">{n}</span>
        <span className="text-xs text-ido-slate">{fmtAED(amt)}</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Pass
      </span>
    )

  return (
    <>
      <Hero
        eyebrow="Revenue assurance · October 2026"
        title="Is every reported number true?"
        subtitle="For each company, an agent tests reported revenue against three independent sources: the general ledger, invoices and contracts, and bank statements."
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Reported revenue" value={fmtAED(reported)} sub="15 companies, October" icon={<FileText size={18} />} />
        <Kpi label="Verified" value={fmtPct(verified)} tone={verified >= 0.95 ? 'good' : 'warn'} sub="revenue-weighted" icon={<ShieldCheck size={18} />} />
        <Kpi label="Value at risk" value={fmtAED(risk)} tone="bad" sub={`${nFind} findings`} icon={<TriangleAlert size={18} />} />
        <Kpi label="Clean companies" value={`${clean}/15`} tone="good" sub="no findings on any check" icon={<ShieldCheck size={18} />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Companies by verified revenue" action={<span className="text-xs text-ido-slate">Click a row for the evidence</span>} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Company</th>
                  <th className="th">Verified</th>
                  <th className="th text-right">Reported</th>
                  <th className="th">
                    <span className="inline-flex items-center gap-1">
                      <BookOpenCheck size={13} /> Ledger
                    </span>
                  </th>
                  <th className="th">
                    <span className="inline-flex items-center gap-1">
                      <FileText size={13} /> Invoices
                    </span>
                  </th>
                  <th className="th">
                    <span className="inline-flex items-center gap-1">
                      <Banknote size={13} /> Bank
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {rows.map(({ a, t }) => {
                  const c = (id: string) => a.checks.find((x) => x.id === id)!
                  const pct = a.verifiedPct
                  return (
                    <tr key={t.id} className="cursor-pointer hover:bg-ido-mist/60" onClick={() => nav(`/ido/assurance/${t.id}`)}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <TenantMark short={t.short} />
                          <div>
                            <div className="font-semibold text-ido-primary">{t.name}</div>
                            <div className="text-xs text-ido-slate">{t.sector}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ido-line">
                            <div className={`h-full ${pct >= 0.95 ? 'bg-emerald-500' : pct >= 0.85 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct * 100}%` }} />
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{fmtPct(pct)}</span>
                        </div>
                      </td>
                      <td className="td text-right tabular-nums">{fmtAED(a.reported)}</td>
                      <td className="td">{cell(c('gl').findings.length, c('gl').amount)}</td>
                      <td className="td">{cell(c('billing').findings.length, c('billing').amount)}</td>
                      <td className="td">{cell(c('bank').findings.length, c('bank').amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Value at risk by finding type">
          <div className="p-3">
            <ChartFromSpec
              spec={{
                type: 'hbar',
                xKey: 'type',
                series: [{ key: 'amount', name: 'At risk' }],
                data: [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, amount]) => ({ type, amount: Math.round(amount) })),
              }}
            />
          </div>
        </Card>
      </div>
    </>
  )
}
