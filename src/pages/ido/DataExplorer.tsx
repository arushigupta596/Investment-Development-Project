import { useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Search, Upload } from 'lucide-react'
import { Card, Pill } from '../../components/ui'
import { Hero, Tabs, Toast } from '../../components/fx'
import { Empty, Select, SidePanel, aed } from '../../components/finance'
import { useData } from '../../context/DataContext'
import { TENANTS, tenantById } from '../../data/tenants'
import { CURRENT_MONTH, MONTHS, monthLabel } from '../../data/generate'
import { ACCOUNTS, accountByCode, allJournals, journalsFor, openingBal, bal, type JournalSource } from '../../data/finance'
import { trialBalance } from '../../lib/finance'

type Tab = 'feeds' | 'journals' | 'ledger' | 'tb'
const SOURCES: JournalSource[] = ['ERP GL extract', 'AR sub-ledger', 'AP sub-ledger', 'Payroll file', 'Bank statement', 'Fixed asset register', 'Manual journal']
const PAGE = 50

export default function DataExplorer() {
  const [sp, setSp] = useSearchParams()
  const { tenantId: locked } = useParams() // set on a company's own route: data is limited to that company
  const tab = (sp.get('tab') as Tab) || 'feeds'
  const company = locked || sp.get('company') || ''
  const month = sp.get('month') || CURRENT_MONTH
  const account = sp.get('account') || ''
  const source = sp.get('source') || ''
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v)
    else n.delete(k)
    if (k !== 'page') n.delete('page')
    setSp(n, { replace: true })
  }
  const [toast, setToast] = useState('')
  const [uploading, setUploading] = useState(false)
  const companyOpts = [{ value: '', label: 'All companies' }, ...TENANTS.map((t) => ({ value: t.id, label: t.name }))]
  const needsCompany = tab !== 'feeds'
  const co = company || (needsCompany ? 'julphar' : '')

  return (
    <>
      <Hero
        eyebrow="Data explorer"
        title="The data coming in"
        subtitle={`Every feed, journal line, ledger posting and trial balance behind ${locked ? `${tenantById(locked)!.name}'s` : 'the'} statements. Filters live in the URL, so links are shareable.`}
        right={
          <button className="btn bg-white text-ido-navy hover:bg-ido-mist" onClick={() => setUploading(true)}>
            <Upload size={16} /> Upload file
          </button>
        }
      />
      <div className="card">
        <Tabs
          tabs={[
            { id: 'feeds', label: 'Data feeds' },
            { id: 'journals', label: 'Journals' },
            { id: 'ledger', label: 'General ledger' },
            { id: 'tb', label: 'Trial balance' },
          ]}
          value={tab}
          onChange={(t) => set('tab', t)}
        />
        <div className="grid grid-cols-2 gap-3 border-b border-ido-line p-4 md:grid-cols-4">
          {!locked && <Select label="Company" value={needsCompany ? co : company} onChange={(v) => set('company', v)} options={needsCompany ? companyOpts.slice(1) : companyOpts} />}
          {tab !== 'feeds' && <Select label="Month" value={month} onChange={(v) => set('month', v)} options={[...MONTHS].reverse().map((m) => ({ value: m, label: monthLabel(m, true) }))} />}
          {(tab === 'journals' || tab === 'ledger') && (
            <Select
              label="Account"
              value={tab === 'ledger' ? account || '4000' : account}
              onChange={(v) => set('account', v)}
              options={[...(tab === 'journals' ? [{ value: '', label: 'All accounts' }] : []), ...ACCOUNTS.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))]}
            />
          )}
          {tab === 'journals' && <Select label="Source" value={source} onChange={(v) => set('source', v)} options={[{ value: '', label: 'All sources' }, ...SOURCES.map((s) => ({ value: s, label: s }))]} />}
        </div>
        {tab === 'feeds' && <Feeds company={company} />}
        {tab === 'journals' && <Journals company={co} month={month} account={account} source={source} page={+(sp.get('page') || 0)} setPage={(p) => set('page', String(p))} />}
        {tab === 'ledger' && <Ledger company={co} month={month} account={account || '4000'} />}
        {tab === 'tb' && <TB company={co} month={month} onAccount={(c) => setSp(new URLSearchParams({ tab: 'ledger', ...(locked ? {} : { company: co }), month, account: c }))} />}
      </div>
      {uploading && <UploadPanel lockedCompany={locked} defaultCompany={company || 'julphar'} onClose={() => setUploading(false)} onDone={(msg) => { setUploading(false); setToast(msg); setSp(new URLSearchParams({ tab: 'feeds' })) }} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </>
  )
}

function Feeds({ company }: { company: string }) {
  const { feeds } = useData()
  const fs = feeds.filter((f) => !company || f.tenantId === company)
  const issues = fs.filter((f) => f.status !== 'OK').length
  return (
    <>
      <div className="flex flex-wrap gap-4 px-5 pt-4 text-sm text-ido-slate">
        <span>
          <strong className="text-ido-primary">{fs.length}</strong> feeds
        </span>
        <span>
          <strong className="text-ido-primary">{fs.reduce((s, f) => s + f.rows, 0).toLocaleString('en-US')}</strong> rows received
        </span>
        <span>
          <strong className={issues ? 'text-rose-600' : 'text-emerald-600'}>{issues}</strong> need attention
        </span>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Company</th>
              <th className="th">Feed</th>
              <th className="th">Source system</th>
              <th className="th">Last received</th>
              <th className="th text-right">Rows</th>
              <th className="th text-right">Rejected</th>
              <th className="th">Status</th>
              <th className="th">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ido-line">
            {[...fs]
              .sort((a, b) => Number(!!b.uploaded) - Number(!!a.uploaded) || (a.status === 'OK' ? 1 : 0) - (b.status === 'OK' ? 1 : 0))
              .map((f) => (
                <tr key={f.id} className={f.uploaded ? 'bg-emerald-50/50' : ''}>
                  <td className="td font-semibold text-ido-primary">{tenantById(f.tenantId)!.name}</td>
                  <td className="td">{f.name}</td>
                  <td className="td text-ido-slate">{f.system}</td>
                  <td className="td text-ido-slate">{new Date(f.lastSync).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="td text-right tabular-nums">{f.rows.toLocaleString('en-US')}</td>
                  <td className={`td text-right tabular-nums ${f.rejected ? 'font-semibold text-rose-600' : 'text-ido-slate'}`}>{f.rejected}</td>
                  <td className="td">
                    <Pill>{f.status}</Pill>
                  </td>
                  <td className="td max-w-[320px] whitespace-normal text-xs text-ido-slate">{f.note ?? ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Journals({ company, month, account, source, page, setPage }: { company: string; month: string; account: string; source: string; page: number; setPage: (p: number) => void }) {
  const [q, setQ] = useState('')
  const lines = useMemo(() => (account ? journalsFor(company, month, account) : allJournals(company, month)), [company, month, account])
  const shown = lines.filter((l) => (!source || l.source === source) && (!q || `${l.id} ${l.description} ${l.postedBy}`.toLowerCase().includes(q.toLowerCase())))
  const dr = shown.reduce((s, l) => s + Math.max(0, l.amount), 0)
  const cr = shown.reduce((s, l) => s + Math.max(0, -l.amount), 0)
  const pages = Math.ceil(shown.length / PAGE)
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-ido-line px-3">
          <Search size={15} className="text-ido-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, description, user" className="w-56 bg-transparent text-sm outline-none" />
        </div>
        <span className="text-sm text-ido-slate">
          <strong className="text-ido-primary">{shown.length.toLocaleString('en-US')}</strong> lines · Dr {aed(dr)} · Cr {aed(cr)}
        </span>
      </div>
      {shown.length ? (
        <div className="overflow-x-auto p-2">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Journal</th>
                <th className="th">Date</th>
                <th className="th">Account</th>
                <th className="th">Description</th>
                <th className="th">Source</th>
                <th className="th">Posted by</th>
                <th className="th text-right">Debit</th>
                <th className="th text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ido-line">
              {shown.slice(page * PAGE, page * PAGE + PAGE).map((l) => (
                <tr key={l.id} className={l.flag ? 'bg-rose-50/50' : ''}>
                  <td className="td font-mono text-xs">{l.id}</td>
                  <td className="td text-ido-slate">{l.date}</td>
                  <td className="td text-xs">
                    {l.account} {accountByCode(l.account).name}
                  </td>
                  <td className="td">
                    {l.description} {l.flag && <Pill>{l.flag}</Pill>} {l.manual && !l.flag && <Pill>Manual</Pill>}
                  </td>
                  <td className="td text-xs text-ido-slate">{l.source}</td>
                  <td className="td text-xs text-ido-slate">{l.postedBy}</td>
                  <td className="td text-right tabular-nums">{l.amount > 0 ? aed(l.amount) : ''}</td>
                  <td className="td text-right tabular-nums">{l.amount < 0 ? aed(-l.amount) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No journal lines match these filters.</Empty>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-ido-line px-5 py-3 text-sm text-ido-slate">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost py-1" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button className="btn-ghost py-1" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Ledger({ company, month, account }: { company: string; month: string; account: string }) {
  const a = accountByCode(account)
  const lines = journalsFor(company, month, account)
  const opening = openingBal(company, month, account)
  let run = opening
  const closing = a.statement === 'PL' ? bal(company, month, account) : bal(company, month, account)
  return (
    <div className="overflow-x-auto p-2">
      <div className="px-3 py-2 text-sm text-ido-slate">
        <strong className="text-ido-primary">
          {a.code} {a.name}
        </strong>{' '}
        · {a.statement === 'PL' ? 'Profit and loss' : 'Balance sheet'} · {a.line} · normal balance {a.normal}
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Date</th>
            <th className="th">Journal</th>
            <th className="th">Description</th>
            <th className="th">Contra</th>
            <th className="th text-right">Debit</th>
            <th className="th text-right">Credit</th>
            <th className="th text-right">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ido-line">
          <tr className="bg-ido-mist/50 font-semibold">
            <td className="td" colSpan={6}>
              Opening balance
            </td>
            <td className="td text-right tabular-nums">{aed(opening)}</td>
          </tr>
          {lines.map((l) => {
            run += l.amount
            return (
              <tr key={l.id} className={l.flag ? 'bg-rose-50/50' : ''}>
                <td className="td text-ido-slate">{l.date}</td>
                <td className="td font-mono text-xs">{l.id}</td>
                <td className="td">
                  {l.description} {l.flag && <Pill>{l.flag}</Pill>}
                </td>
                <td className="td text-xs text-ido-slate">
                  {l.contra} {accountByCode(l.contra).name}
                </td>
                <td className="td text-right tabular-nums">{l.amount > 0 ? aed(l.amount) : ''}</td>
                <td className="td text-right tabular-nums">{l.amount < 0 ? aed(-l.amount) : ''}</td>
                <td className="td text-right tabular-nums text-ido-slate">{aed(run)}</td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-ido-line bg-ido-mist/50 font-semibold">
            <td className="td" colSpan={6}>
              Closing balance {a.statement === 'PL' && <span className="font-normal text-ido-slate">(month movement; P&L accounts reset each month in this view)</span>}
            </td>
            <td className="td text-right tabular-nums">{aed(closing)}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-ido-muted">Signed balances: debits positive, credits shown in brackets.</p>
    </div>
  )
}

function TB({ company, month, onAccount }: { company: string; month: string; onAccount: (code: string) => void }) {
  const tb = trialBalance(company, month)
  return (
    <>
      <div className="flex flex-wrap gap-3 px-5 pt-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tb.difference === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          <CheckCircle2 size={13} /> Debits {tb.difference === 0 ? 'equal' : 'do not equal'} credits
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tb.suspense ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          Suspense {tb.suspense ? `holds AED ${aed(tb.suspense)}: blocks the statements` : 'is clear'}
        </span>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Account</th>
              <th className="th">Statement line</th>
              <th className="th text-right">Debit</th>
              <th className="th text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ido-line">
            {tb.rows.map((r) => (
              <tr key={r.code} className={`cursor-pointer hover:bg-ido-mist/60 ${r.code === '1999' && r.debit ? 'bg-rose-50/60' : ''}`} onClick={() => onAccount(r.code)}>
                <td className="td">
                  <span className="font-mono text-xs text-ido-slate">{r.code}</span> <span className="font-medium text-ido-primary">{r.name}</span>
                </td>
                <td className="td text-xs text-ido-slate">{r.line}</td>
                <td className="td text-right tabular-nums">{r.debit ? aed(r.debit) : ''}</td>
                <td className="td text-right tabular-nums">{r.credit ? aed(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ido-line font-semibold">
              <td className="td" colSpan={2}>
                Total
              </td>
              <td className="td text-right tabular-nums">{aed(tb.debit)}</td>
              <td className="td text-right tabular-nums">{aed(tb.credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 pb-4 text-xs text-ido-muted">Click an account to open its ledger. P&L accounts show the month's movement; balance sheet accounts show the closing balance.</p>
    </>
  )
}

function UploadPanel({ lockedCompany, defaultCompany, onClose, onDone }: { lockedCompany?: string; defaultCompany: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { upload } = useData()
  const [company, setCompany] = useState(defaultCompany)
  const [feed, setFeed] = useState('Bank statements')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const go = () => {
    const name = file?.name ?? `${feed.toLowerCase().replace(/\s+/g, '_')}_oct2026.csv`
    const rows = file ? Math.max(12, Math.round(file.size / 85)) : 1240 + Math.floor(Math.random() * 800)
    const rejected = Math.random() < 0.5 ? Math.floor(rows * 0.01) : 0
    setProgress(0)
    const steps = [15, 40, 70, 90, 100]
    steps.forEach((p, i) =>
      window.setTimeout(() => {
        setProgress(p)
        if (p === 100) {
          upload(company, feed, name, rows, rejected)
          window.setTimeout(() => onDone(`${name}: ${rows.toLocaleString()} rows received${rejected ? `, ${rejected} rejected` : ''}`), 400)
        }
      }, (i + 1) * 450),
    )
  }
  const label = ['Uploading', 'Validating columns', 'Checking duplicates', 'Mapping accounts', 'Done'][Math.min(4, Math.floor(progress / 22))]
  return (
    <SidePanel eyebrow="Simulated upload (demo)" title="Upload a data file" onClose={onClose}>
      <div className="space-y-4 p-5">
        {!lockedCompany && <Select label="Company" value={company} onChange={setCompany} options={TENANTS.map((t) => ({ value: t.id, label: t.name }))} />}
        <Select label="Feed" value={feed} onChange={setFeed} options={['Bank statements', 'GL journal extract', 'AR sub-ledger', 'AP sub-ledger', 'Payroll file', 'Invoices and contracts'].map((f) => ({ value: f, label: f }))} />
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ido-line px-4 py-8 text-sm text-ido-slate hover:border-ido-sky hover:bg-ido-mist">
          <Upload size={22} className="text-ido-teal" />
          {file ? <span className="font-semibold text-ido-primary">{file.name}</span> : 'Choose a CSV or Excel file (optional)'}
          <span className="text-xs text-ido-muted">The file stays in your browser; only its name and size are used.</span>
        </button>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls,.txt,.mt940" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {progress >= 0 && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-ido-slate">
              <span>{label}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ido-mist">
              <div className="h-full bg-ido-teal transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <button className="btn-primary w-full" disabled={progress >= 0} onClick={go}>
          <Upload size={16} /> {file ? 'Upload file' : 'Upload sample file'}
        </button>
      </div>
    </SidePanel>
  )
}
