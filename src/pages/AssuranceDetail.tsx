import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Banknote, BookOpenCheck, CheckCircle2, FileText, Loader2, Play, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Card, Kpi, Pill } from '../components/ui'
import { Hero, Tabs } from '../components/fx'
import { Waterfall } from '../components/charts'
import { SidePanel, aed } from '../components/finance'
import { tenantById } from '../data/tenants'
import { accountByCode } from '../data/finance'
import { assuranceFor, type CheckId, type Finding } from '../lib/assurance'
import { fmtAED, fmtPct } from '../lib/metrics'

const CHECK_ICON: Record<CheckId, typeof BookOpenCheck> = { gl: BookOpenCheck, billing: FileText, bank: Banknote }
const statusLabel = { pass: 'Pass', variance: 'Variance', fail: 'Fail' } as const

export default function AssuranceDetail() {
  const { tenantId = '' } = useParams()
  const t = tenantById(tenantId)!
  const a = useMemo(() => assuranceFor(tenantId), [tenantId])
  const [tab, setTab] = useState<'findings' | 'invoices' | 'bank' | 'journals' | 'contracts'>('findings')
  const [checkFilter, setCheckFilter] = useState<CheckId | ''>('')
  const [open, setOpen] = useState<Finding | null>(null)
  const [run, setRun] = useState<{ step: number; running: boolean }>({ step: 3, running: false })
  const evidenceRef = useRef<HTMLDivElement>(null)

  const atRisk = a.findings.reduce((s, f) => s + f.amount, 0)
  const unsupported = a.findings.filter((f) => f.type === 'Unsupported journal').reduce((s, f) => s + f.amount, 0)
  const cn = a.findings.filter((f) => f.type === 'Credit note not posted').reduce((s, f) => s + f.amount, 0)
  const reportDiff = a.reported - a.glRevenue
  const dup = a.invoices.filter((x) => x.duplicateOf).reduce((s, x) => s + x.amount, 0)
  const price = a.invoices.filter((x) => x.kind === 'Invoice' && !x.duplicateOf).reduce((s, x) => s + (x.expected - x.amount), 0)
  const steps = [
    { label: 'Reported', value: a.reported, total: true },
    ...(reportDiff ? [{ label: 'Pack vs ledger', value: -reportDiff }] : []),
    { label: 'Ledger', value: a.glRevenue, total: true },
    ...(unsupported ? [{ label: 'Unsupported', value: -unsupported }] : []),
    ...(cn ? [{ label: 'Credit notes', value: -cn }] : []),
    { label: 'Invoiced', value: a.invoicedNet, total: true },
    ...(dup ? [{ label: 'Duplicates', value: -dup }] : []),
    ...(price ? [{ label: 'Price errors', value: price }] : []),
    { label: 'Per contract', value: a.contractCorrect, total: true },
  ]

  const runAgent = () => {
    setRun({ step: 0, running: true })
    ;[1, 2, 3].forEach((s) => window.setTimeout(() => setRun({ step: s, running: s < 3 }), s * 1100))
  }
  const findings = a.findings.filter((f) => !checkFilter || f.check === checkFilter)
  const invoiceById = (id?: string) => a.invoices.find((x) => x.id === id)
  const contractById = (id?: string) => a.contracts.find((x) => x.id === id)
  const receiptById = (id?: string) => a.receipts.find((x) => x.id === id)
  const journalById = (id?: string) => a.revenueJournals.find((x) => x.id === id)

  const collectedPct = a.collected / (a.collected + a.shortfall + a.unpaidPastDue + a.notYetDue)

  return (
    <>
      <Hero
        eyebrow={`Revenue assurance · October 2026 · ${t.name}`}
        title="Is that number actually true?"
        subtitle={
          <>
            {t.name} reported <strong className="text-white">{fmtAED(a.reported)}</strong> of October revenue. The agent tested it against the general ledger, invoices and contracts, and bank statements:{' '}
            <strong className="text-white">{fmtPct(a.verifiedPct)} is verified</strong>.
          </>
        }
        right={
          <button onClick={runAgent} disabled={run.running} className="btn bg-white text-ido-navy hover:bg-ido-mist">
            {run.running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {run.running ? 'Agent running…' : 'Re-run assurance agent'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Reported revenue" value={fmtAED(a.reported)} sub="management pack, October" icon={<FileText size={18} />} />
        <Kpi label="Verified" value={fmtPct(a.verifiedPct)} tone={a.verifiedPct >= 0.95 ? 'good' : a.verifiedPct >= 0.85 ? 'warn' : 'bad'} sub="billed per contract and collected or not yet due" icon={<ShieldCheck size={18} />} />
        <Kpi label="Value at risk" value={fmtAED(atRisk)} tone={atRisk ? 'bad' : 'good'} sub={`${a.findings.length} findings`} icon={<TriangleAlert size={18} />} />
        <Kpi label="Cash collected" value={fmtPct(collectedPct, 0)} sub={`${fmtAED(a.collected)} of invoiced`} icon={<Banknote size={18} />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {a.checks.map((c, i) => {
          const Icon = CHECK_ICON[c.id]
          const pending = run.step <= i
          const active = run.running && run.step === i
          return (
            <button
              key={c.id}
              onClick={() => {
                setTab('findings')
                setCheckFilter(c.id)
                evidenceRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="card card-pad text-left transition hover:border-ido-sky hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-ido-primary">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-ido-mist text-ido-teal">
                    <Icon size={16} />
                  </span>
                  {i + 1}. {c.title}
                </span>
                {active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ido-teal">
                    <Loader2 size={13} className="animate-spin" /> Checking
                  </span>
                ) : pending ? (
                  <span className="text-xs text-ido-muted">Queued</span>
                ) : (
                  <Pill>{statusLabel[c.status]}</Pill>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-ido-navy">{c.question}</p>
              <p className="mt-1 text-sm text-ido-slate">{pending ? '…' : c.summary}</p>
              {!pending && c.findings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...new Set(c.findings.map((f) => f.type))].map((ty) => (
                    <span key={ty} className="rounded-full bg-ido-mist px-2 py-0.5 text-[11px] font-medium text-ido-primary">
                      {ty} × {c.findings.filter((f) => f.type === ty).length}
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="From reported revenue to what the contracts support" className="xl:col-span-2">
          <div className="p-4">
            <Waterfall steps={steps} />
            <p className="px-2 text-xs text-ido-slate">
              Navy bars are totals; red steps reduce revenue, green steps add to it.
              {a.unbilled > 0 && <> Separately, <strong className="text-ido-primary">{fmtAED(a.unbilled)}</strong> of contracted revenue was never invoiced (missing invoices).</>}
            </p>
          </div>
        </Card>
        <Card title="Did the cash arrive?">
          <div className="space-y-3 p-5">
            {[
              { label: 'Collected', v: a.collected, cls: 'bg-emerald-500' },
              { label: 'Short-paid (shortfall)', v: a.shortfall, cls: 'bg-amber-500' },
              { label: 'Unpaid, past due', v: a.unpaidPastDue, cls: 'bg-rose-500' },
              { label: 'Not yet due', v: a.notYetDue, cls: 'bg-slate-300' },
            ].map((r) => {
              const tot = a.collected + a.shortfall + a.unpaidPastDue + a.notYetDue
              return (
                <div key={r.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ido-slate">{r.label}</span>
                    <span className="font-semibold tabular-nums text-ido-primary">{fmtAED(r.v)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-ido-mist">
                    <div className={`h-full ${r.cls}`} style={{ width: `${(r.v / tot) * 100}%` }} />
                  </div>
                </div>
              )
            })}
            <p className="pt-2 text-xs text-ido-muted">Bank statements matched to {a.invoices.filter((x) => x.kind === 'Invoice').length} invoices as of 12 Nov 2026. Duplicate invoices are excluded.</p>
          </div>
        </Card>
      </div>

      <div ref={evidenceRef} className="card mt-4 scroll-mt-20">
        <Tabs
          tabs={[
            { id: 'findings', label: 'Findings', count: a.findings.length },
            { id: 'invoices', label: 'Invoices vs contracts vs bank', count: a.invoices.length },
            { id: 'bank', label: 'Bank receipts', count: a.receipts.length },
            { id: 'journals', label: 'Revenue journals', count: a.revenueJournals.length },
            { id: 'contracts', label: 'Contracts', count: a.contracts.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'findings' && (
          <>
            <div className="flex flex-wrap gap-2 px-5 pt-4">
              {(['', 'gl', 'billing', 'bank'] as const).map((c) => (
                <button key={c} onClick={() => setCheckFilter(c)} className={`rounded-full px-3 py-1 text-xs font-semibold ${checkFilter === c ? 'bg-ido-primary text-white' : 'bg-ido-mist text-ido-primary hover:bg-ido-line'}`}>
                  {c === '' ? 'All checks' : a.checks.find((x) => x.id === c)!.title}
                </button>
              ))}
            </div>
            {findings.length ? (
              <div className="overflow-x-auto p-2">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">ID</th>
                      <th className="th">Finding</th>
                      <th className="th">What the agent saw</th>
                      <th className="th text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ido-line">
                    {findings.map((f) => (
                      <tr key={f.id} className="cursor-pointer hover:bg-ido-mist/60" onClick={() => setOpen(f)}>
                        <td className="td font-mono text-xs text-ido-slate">{f.id}</td>
                        <td className="td font-semibold text-ido-primary">{f.type}</td>
                        <td className="td max-w-[480px] whitespace-normal text-ido-navy/80">{f.description}</td>
                        <td className="td text-right tabular-nums">{aed(f.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-emerald-700">
                <CheckCircle2 size={18} /> Nothing to flag. Revenue agrees across all sources.
              </div>
            )}
          </>
        )}
        {tab === 'invoices' && (
          <div className="overflow-x-auto p-2">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Invoice</th>
                  <th className="th">Customer</th>
                  <th className="th">Contract</th>
                  <th className="th text-right">Billed</th>
                  <th className="th text-right">Per contract</th>
                  <th className="th">Due</th>
                  <th className="th text-right">Cash received</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {a.invoices.map((x) => {
                  const off = x.kind === 'Invoice' && (x.duplicateOf || x.amount !== x.expected)
                  return (
                    <tr key={x.id} className={off ? 'bg-rose-50/40' : ''}>
                      <td className="td font-mono text-xs">
                        {x.id}
                        {x.duplicateOf && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">DUP</span>}
                        {x.kind === 'Credit note' && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">NOT IN GL</span>}
                      </td>
                      <td className="td">{x.customer}</td>
                      <td className="td font-mono text-xs text-ido-slate">{x.contractId}</td>
                      <td className="td text-right tabular-nums">{aed(x.amount)}</td>
                      <td className={`td text-right tabular-nums ${x.amount !== x.expected ? 'font-semibold text-rose-600' : 'text-ido-slate'}`}>{x.duplicateOf ? '0' : aed(x.expected)}</td>
                      <td className="td text-ido-slate">{x.kind === 'Invoice' ? x.due : ''}</td>
                      <td className="td text-right tabular-nums">{x.received ? aed(x.received) : x.kind === 'Invoice' ? '-' : ''}</td>
                      <td className="td">{x.kind === 'Invoice' ? <Pill>{x.status}</Pill> : <span className="text-xs text-ido-slate">Credit note</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'bank' && (
          <div className="overflow-x-auto p-2">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Receipt</th>
                  <th className="th">Date</th>
                  <th className="th">Payer (as on statement)</th>
                  <th className="th">Matched invoice</th>
                  <th className="th text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {a.receipts.map((r) => (
                  <tr key={r.id} className={r.invoiceId ? '' : 'bg-rose-50/40'}>
                    <td className="td font-mono text-xs">{r.id}</td>
                    <td className="td text-ido-slate">{r.date}</td>
                    <td className="td">{r.payer}</td>
                    <td className="td font-mono text-xs">{r.invoiceId ?? <span className="font-sans font-semibold text-rose-600">No match</span>}</td>
                    <td className="td text-right tabular-nums">{aed(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'journals' && (
          <div className="overflow-x-auto p-2">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Journal</th>
                  <th className="th">Date</th>
                  <th className="th">Account</th>
                  <th className="th">Description</th>
                  <th className="th">Source</th>
                  <th className="th text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {a.revenueJournals.map((j) => (
                  <tr key={j.id} className={j.flag ? 'bg-rose-50/40' : ''}>
                    <td className="td font-mono text-xs">{j.id}</td>
                    <td className="td text-ido-slate">{j.date}</td>
                    <td className="td text-xs">
                      {j.account} {accountByCode(j.account).name}
                    </td>
                    <td className="td">
                      {j.description} {j.flag && <Pill>{j.flag}</Pill>}
                    </td>
                    <td className="td text-xs text-ido-slate">{j.source}</td>
                    <td className="td text-right tabular-nums">{aed(-j.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ido-line font-semibold">
                  <td className="td" colSpan={5}>
                    Total in ledger (4000 + 4100)
                  </td>
                  <td className="td text-right tabular-nums">{aed(a.glRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {tab === 'contracts' && (
          <div className="overflow-x-auto p-2">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Contract</th>
                  <th className="th">Customer</th>
                  <th className="th">Service</th>
                  <th className="th">Since</th>
                  <th className="th">Terms</th>
                  <th className="th text-right">Monthly fee</th>
                  <th className="th">October invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ido-line">
                {a.contracts.map((c) => {
                  const inv = a.invoices.filter((x) => x.contractId === c.id && x.kind === 'Invoice')
                  return (
                    <tr key={c.id} className={inv.length ? '' : 'bg-rose-50/40'}>
                      <td className="td font-mono text-xs">{c.id}</td>
                      <td className="td">{c.customer}</td>
                      <td className="td text-ido-slate">{c.description}</td>
                      <td className="td text-ido-slate">{c.start}</td>
                      <td className="td text-ido-slate">{c.terms} days</td>
                      <td className="td text-right tabular-nums">{aed(c.monthlyFee)}</td>
                      <td className="td font-mono text-xs">{inv.length ? inv.map((x) => x.id).join(', ') : <span className="font-sans font-semibold text-rose-600">Missing</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <SidePanel eyebrow={`${open.id} · ${t.name} · ${a.checks.find((c) => c.id === open.check)!.title}`} title={open.type} onClose={() => setOpen(null)}>
          <div className="space-y-5 p-5 text-sm">
            <div>
              <div className="eyebrow">At stake</div>
              <div className="mt-1 text-2xl font-semibold text-ido-primary">AED {aed(open.amount)}</div>
            </div>
            <p className="text-ido-navy/90">{open.description}</p>
            <div className="rounded-xl bg-ido-mist p-4">
              <div className="eyebrow">Suggested action</div>
              <p className="mt-1 text-ido-navy">{open.fix}</p>
            </div>
            <div>
              <div className="eyebrow mb-2">Evidence</div>
              <div className="space-y-2">
                {open.journalId && <Evidence label="General ledger" rows={[['Journal', open.journalId], ['Description', journalById(open.journalId)?.description ?? ''], ['Posted by', journalById(open.journalId)?.postedBy ?? ''], ['Amount', aed(-(journalById(open.journalId)?.amount ?? 0))]]} />}
                {open.contractId && contractById(open.contractId) && (
                  <Evidence label="Contract" rows={[['Contract', open.contractId], ['Customer', contractById(open.contractId)!.customer], ['Service', contractById(open.contractId)!.description], ['Monthly fee', aed(contractById(open.contractId)!.monthlyFee)]]} />
                )}
                {open.invoiceId && invoiceById(open.invoiceId) && (
                  <Evidence
                    label={invoiceById(open.invoiceId)!.kind}
                    rows={[
                      ['Number', open.invoiceId],
                      ['Date', invoiceById(open.invoiceId)!.date],
                      ['Billed', aed(invoiceById(open.invoiceId)!.amount)],
                      ...(invoiceById(open.invoiceId)!.duplicateOf ? [['Duplicate of', invoiceById(open.invoiceId)!.duplicateOf!] as [string, string]] : []),
                      ['Status', invoiceById(open.invoiceId)!.status],
                    ]}
                  />
                )}
                {open.receiptId && receiptById(open.receiptId) && (
                  <Evidence label="Bank statement" rows={[['Receipt', open.receiptId], ['Date', receiptById(open.receiptId)!.date], ['Payer', receiptById(open.receiptId)!.payer], ['Amount', aed(receiptById(open.receiptId)!.amount)]]} />
                )}
                {!open.journalId && !open.invoiceId && !open.receiptId && !open.contractId && <Evidence label="Management pack" rows={[['Reported', aed(a.reported)], ['Ledger', aed(a.glRevenue)], ['Difference', aed(a.reported - a.glRevenue)]]} />}
              </div>
            </div>
            <p className="text-xs text-ido-muted">This finding is also in the exception queue as {open.id}, assigned to the AR preparer.</p>
          </div>
        </SidePanel>
      )}
    </>
  )
}

function Evidence({ label, rows }: { label: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-ido-line">
      <div className="border-b border-ido-line px-3 py-2 text-xs font-semibold text-ido-teal">{label}</div>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 px-3 py-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ido-slate">{k}</dt>
            <dd className="min-w-0 break-words font-medium text-ido-navy">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
