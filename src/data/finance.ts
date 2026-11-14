/**
 * Mock finance journey for every portfolio company:
 * source feeds -> journals -> general ledger -> trial balance -> P&L / balance sheet.
 * Deterministic (seeded) and internally consistent: the trial balance always nets to zero,
 * statements are built from the trial balance, and journal lines sum exactly to each account movement.
 */
import { TENANTS, type Tenant } from './tenants'
import { MONTHS, CURRENT_MONTH, type Month } from './generate'

// ---------- seeded RNG (separate from the reconciliation generator) ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const hashStr = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
export const seeded = (key: string) => {
  const r = mulberry32(hashStr(key))
  return {
    r,
    between: (a: number, b: number) => a + r() * (b - a),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)],
  }
}
const r2 = (n: number) => Math.round(n * 100) / 100

// ---------- chart of accounts ----------
export type Statement = 'PL' | 'BS'
export const PL_LINES = ['Revenue', 'Cost of sales', 'Staff costs', 'Other operating expenses', 'Depreciation & amortisation', 'Finance costs', 'Corporate tax'] as const
export const BS_LINES = [
  'Cash and bank',
  'Trade receivables',
  'Inventory',
  'Other current assets',
  'Property, plant & equipment',
  'Intangible assets',
  'Suspense',
  'Trade payables',
  'Accruals & other payables',
  'Borrowings',
  'Share capital',
  'Retained earnings',
] as const
export type PLLine = (typeof PL_LINES)[number]
export type BSLine = (typeof BS_LINES)[number]

export interface Account {
  code: string
  name: string
  statement: Statement
  line: PLLine | BSLine
  normal: 'Dr' | 'Cr'
}

export const ACCOUNTS: Account[] = [
  { code: '1000', name: 'Cash at bank', statement: 'BS', line: 'Cash and bank', normal: 'Dr' },
  { code: '1100', name: 'Trade receivables', statement: 'BS', line: 'Trade receivables', normal: 'Dr' },
  { code: '1150', name: 'Allowance for doubtful debts', statement: 'BS', line: 'Trade receivables', normal: 'Cr' },
  { code: '1200', name: 'Inventory', statement: 'BS', line: 'Inventory', normal: 'Dr' },
  { code: '1300', name: 'Prepayments and deposits', statement: 'BS', line: 'Other current assets', normal: 'Dr' },
  { code: '1500', name: 'PP&E at cost', statement: 'BS', line: 'Property, plant & equipment', normal: 'Dr' },
  { code: '1550', name: 'Accumulated depreciation', statement: 'BS', line: 'Property, plant & equipment', normal: 'Cr' },
  { code: '1600', name: 'Intangible assets', statement: 'BS', line: 'Intangible assets', normal: 'Dr' },
  { code: '1999', name: 'Suspense', statement: 'BS', line: 'Suspense', normal: 'Dr' },
  { code: '2000', name: 'Trade payables', statement: 'BS', line: 'Trade payables', normal: 'Cr' },
  { code: '2100', name: 'Accrued expenses', statement: 'BS', line: 'Accruals & other payables', normal: 'Cr' },
  { code: '2200', name: 'VAT payable', statement: 'BS', line: 'Accruals & other payables', normal: 'Cr' },
  { code: '2500', name: 'Bank borrowings', statement: 'BS', line: 'Borrowings', normal: 'Cr' },
  { code: '3000', name: 'Share capital', statement: 'BS', line: 'Share capital', normal: 'Cr' },
  { code: '3100', name: 'Retained earnings', statement: 'BS', line: 'Retained earnings', normal: 'Cr' },
  { code: '4000', name: 'Operating revenue', statement: 'PL', line: 'Revenue', normal: 'Cr' },
  { code: '4100', name: 'Service and fee revenue', statement: 'PL', line: 'Revenue', normal: 'Cr' },
  { code: '4900', name: 'Other income', statement: 'PL', line: 'Revenue', normal: 'Cr' },
  { code: '5000', name: 'Cost of sales: materials', statement: 'PL', line: 'Cost of sales', normal: 'Dr' },
  { code: '5100', name: 'Cost of sales: direct labour', statement: 'PL', line: 'Cost of sales', normal: 'Dr' },
  { code: '6000', name: 'Salaries and benefits', statement: 'PL', line: 'Staff costs', normal: 'Dr' },
  { code: '6100', name: 'Rent and utilities', statement: 'PL', line: 'Other operating expenses', normal: 'Dr' },
  { code: '6120', name: 'Bank charges', statement: 'PL', line: 'Other operating expenses', normal: 'Dr' },
  { code: '6200', name: 'Marketing', statement: 'PL', line: 'Other operating expenses', normal: 'Dr' },
  { code: '6300', name: 'IT and software', statement: 'PL', line: 'Other operating expenses', normal: 'Dr' },
  { code: '6400', name: 'Professional fees', statement: 'PL', line: 'Other operating expenses', normal: 'Dr' },
  { code: '7000', name: 'Depreciation', statement: 'PL', line: 'Depreciation & amortisation', normal: 'Dr' },
  { code: '7100', name: 'Amortisation', statement: 'PL', line: 'Depreciation & amortisation', normal: 'Dr' },
  { code: '8000', name: 'Interest expense', statement: 'PL', line: 'Finance costs', normal: 'Dr' },
  { code: '8100', name: 'FX gains and losses', statement: 'PL', line: 'Finance costs', normal: 'Dr' },
  { code: '8900', name: 'Corporate tax (9%)', statement: 'PL', line: 'Corporate tax', normal: 'Dr' },
]
export const accountByCode = (c: string) => ACCOUNTS.find((a) => a.code === c)!

// ---------- revenue assurance faults (scripted per company, used by assurance + journals) ----------
export interface AssuranceFaults {
  reportDiff: number // management pack revenue minus GL revenue
  unsupported: number[] // manual top-side revenue journals with no invoice
  creditNotes: number // credit notes issued in billing but not posted to GL
  mispriced: number
  duplicates: number
  missing: number
  shortPaid: number
  unpaidRate: number
  unidentified: number
}
const F = (o: Partial<AssuranceFaults>): AssuranceFaults => ({ reportDiff: 0, unsupported: [], creditNotes: 0, mispriced: 0, duplicates: 0, missing: 0, shortPaid: 0, unpaidRate: 0.04, unidentified: 0, ...o })
export const FAULTS: Record<string, AssuranceFaults> = {
  julphar: F({ reportDiff: 1_850_000, unsupported: [2_400_000], creditNotes: 1, mispriced: 2, duplicates: 2, missing: 1, shortPaid: 2, unpaidRate: 0.22, unidentified: 1 }),
  ahg: F({ creditNotes: 1, mispriced: 1, shortPaid: 5, unpaidRate: 0.2, unidentified: 1 }),
  'rak-ports': F({ mispriced: 1, shortPaid: 1, unpaidRate: 0.06 }),
  'saqr-port': F({ mispriced: 2, shortPaid: 1, unpaidRate: 0.08 }),
  marjan: F({ unidentified: 2, unpaidRate: 0.1, duplicates: 1 }),
  'rak-gas': F({ unpaidRate: 0.02 }),
  'rak-icc': F({ unpaidRate: 0 }),
  rakez: F({ unidentified: 2, unpaidRate: 0.05 }),
  'innovation-city': F({ missing: 2, unpaidRate: 0.05 }),
  'rak-modern-school': F({ unidentified: 2, unpaidRate: 0.12, shortPaid: 1 }),
  'stevin-rock': F({ mispriced: 1, unpaidRate: 0.06 }),
  'rak-airport': F({ duplicates: 1, unpaidRate: 0.05 }),
  aurak: F({ shortPaid: 2, unpaidRate: 0.1 }),
  'rak-mhsu': F({ missing: 1, unpaidRate: 0.08 }),
  'rak-academy': F({ unpaidRate: 0.03 }),
}

/** Scripted suspense balances in the current month (block the trial balance). */
const SUSPENSE: Record<string, { amount: number; reason: string }> = {
  julphar: { amount: 1_268_400, reason: 'Intercompany batch from the Algeria entity was rejected (missing FX rate) and parked in suspense' },
  'rak-airport': { amount: 86_250, reason: 'Fuel supplier batch posted without cost centre, parked in suspense' },
}

// ---------- periods ----------
const PERIODS = ['2026-04', ...MONTHS] as const // April is a hidden opening period
const SEASON_EDU: Record<string, number> = { '2026-04': 1.0, '2026-05': 1.0, '2026-06': 0.8, '2026-07': 0.45, '2026-08': 0.5, '2026-09': 1.35, '2026-10': 1.1 }

/** Signed balances, debit positive. P&L codes hold the month's movement; BS codes hold the closing balance. */
export type Balances = Record<string, number>

export interface CompanyFinance {
  tenantId: string
  periods: Record<string, Balances> // includes hidden '2026-04'
  budget: Record<Month, { revenue: number; ebitda: number }>
  suspense?: { amount: number; reason: string }
}

function buildCompany(t: Tenant): CompanyFinance {
  const f = t.fin
  const { between } = seeded('fin-' + t.id)
  const periods: Record<string, Balances> = {}
  const dso = t.id === 'julphar' ? 110 : t.id === 'ahg' ? 95 : t.sector === 'Education' ? 25 : t.sector === 'Business & Finance' ? 30 : 55
  const invDays = t.id === 'julphar' ? 95 : t.sector === 'Industry' ? 45 : t.sector === 'Healthcare & Pharma' ? 40 : 8
  const ppeBase = f.assets * 0.62
  const intangBase = f.assets * 0.03
  let capexCum = 0
  let depCum = 0
  let amortCum = 0
  let reBase = 0
  let niCum = 0

  PERIODS.forEach((pm, i) => {
    const mi = i - 1
    const season = f.seasonal === 'education' ? SEASON_EDU[pm] : 1
    const run = f.revenue * Math.pow(1 + f.growth, Math.max(-1, mi))
    const rev = run * season * between(0.965, 1.035)
    const b: Balances = {}
    // P&L movements (signed: revenue negative, costs positive)
    b['4000'] = -r2(rev * 0.7)
    b['4100'] = -r2(rev * 0.27)
    b['4900'] = -r2(rev * 0.03 * between(0.5, 1.5))
    const cogs = rev * (1 - f.grossMargin) * between(0.97, 1.03)
    b['5000'] = r2(cogs * 0.6)
    b['5100'] = r2(cogs * 0.4)
    b['6000'] = r2(run * f.staffRatio * between(0.98, 1.02))
    const opex = run * f.opexRatio * between(0.95, 1.05)
    b['6100'] = r2(opex * 0.3)
    b['6120'] = r2(opex * 0.02)
    b['6200'] = r2(opex * 0.18)
    b['6300'] = r2(opex * 0.2)
    b['6400'] = r2(opex * 0.3)
    const dep = r2(((ppeBase + capexCum) * 0.035) / 12)
    const amort = r2((intangBase * 0.1) / 12)
    b['7000'] = dep
    b['7100'] = amort
    const borrowings = f.assets * f.debtRatio * (1 - 0.002 * (mi + 1))
    b['8000'] = r2((borrowings * 0.048) / 12)
    b['8100'] = r2(t.id === 'julphar' ? rev * between(0.006, 0.014) * (1 + mi * 0.15) : rev * between(-0.001, 0.0015))
    const pbt = -(b['4000'] + b['4100'] + b['4900']) - (b['5000'] + b['5100'] + b['6000'] + b['6100'] + b['6120'] + b['6200'] + b['6300'] + b['6400'] + dep + amort + b['8000'] + b['8100'])
    b['8900'] = r2(Math.max(0, pbt * 0.09))
    const ni = pbt - b['8900']

    // Balance sheet closing balances (signed)
    capexCum += dep * between(0.9, 1.4)
    depCum += dep
    amortCum += amort
    b['1100'] = r2((rev * dso) / 30)
    b['1150'] = -r2(b['1100'] * 0.04)
    b['1200'] = r2((cogs * invDays) / 30)
    b['1300'] = r2(opex * 1.6)
    b['1500'] = r2(ppeBase + capexCum)
    b['1550'] = -r2(ppeBase * 0.35 + depCum)
    b['1600'] = r2(intangBase - amortCum)
    const susp = pm === CURRENT_MONTH ? SUSPENSE[t.id]?.amount ?? 0 : 0
    b['1999'] = susp
    b['2000'] = -r2((cogs + opex) * 1.2)
    b['2100'] = -r2(b['6000'] * 0.6 + opex * 0.3)
    b['2200'] = -r2(rev * 0.05 * 0.6)
    b['2500'] = -r2(borrowings)
    b['3000'] = -r2(f.assets * 0.25)
    if (i === 0) {
      // choose opening retained earnings so the opening cash is ~8% of assets
      const targetCash = f.assets * between(0.06, 0.1)
      const others = Object.entries(b).filter(([c]) => c !== '1000' && c !== '3100').reduce((s, [, v]) => s + v, 0)
      reBase = -(targetCash + others)
    }
    // retained earnings carry prior months' profit; this month's profit sits in the P&L accounts
    b['3100'] = r2(reBase - niCum)
    niCum += ni
    // cash is the balancing figure: total of all signed balances must be zero
    const sumOthers = Object.entries(b).filter(([c]) => c !== '1000').reduce((s, [, v]) => s + v, 0)
    b['1000'] = r2(-sumOthers)
    periods[pm] = b
  })

  const budget = {} as CompanyFinance['budget']
  MONTHS.forEach((m, mi) => {
    const season = f.seasonal === 'education' ? SEASON_EDU[m] : 1
    const bgGrowth = t.id === 'julphar' ? 0.006 : f.growth
    const { between: bb } = seeded(`budget-${t.id}-${m}`)
    const rev = f.revenue * Math.pow(1 + bgGrowth, mi) * season * bb(0.975, 1.02)
    const run = f.revenue * Math.pow(1 + bgGrowth, mi)
    budget[m] = { revenue: Math.round(rev), ebitda: Math.round(rev * f.grossMargin + rev * 0.03 - run * (f.staffRatio + f.opexRatio)) }
  })

  return { tenantId: t.id, periods, budget, suspense: SUSPENSE[t.id] }
}

export const FINANCE: Record<string, CompanyFinance> = Object.fromEntries(TENANTS.map((t) => [t.id, buildCompany(t)]))

/** Signed balance of one account (debit positive). */
export const bal = (tenantId: string, month: string, code: string) => FINANCE[tenantId].periods[month]?.[code] ?? 0

/** Movement in the month: P&L = the balance itself, BS = closing minus prior closing. */
export function movement(tenantId: string, month: string, code: string) {
  const a = accountByCode(code)
  if (a.statement === 'PL') return bal(tenantId, month, code)
  const idx = PERIODS.indexOf(month as (typeof PERIODS)[number])
  return r2(bal(tenantId, month, code) - bal(tenantId, PERIODS[idx - 1], code))
}
export const openingBal = (tenantId: string, month: string, code: string) => {
  const a = accountByCode(code)
  if (a.statement === 'PL') return 0
  const idx = PERIODS.indexOf(month as (typeof PERIODS)[number])
  return bal(tenantId, PERIODS[idx - 1], code)
}

// ---------- journals (generated on demand, sum exactly to each account movement) ----------
export type JournalSource = 'ERP GL extract' | 'AR sub-ledger' | 'AP sub-ledger' | 'Payroll file' | 'Bank statement' | 'Fixed asset register' | 'Manual journal'
export interface JournalLine {
  id: string
  tenantId: string
  month: string
  date: string
  account: string
  contra: string
  description: string
  amount: number // signed, debit positive
  source: JournalSource
  postedBy: string
  manual: boolean
  flag?: string
}

const DESC: Record<string, { source: JournalSource; contra: string; texts: string[] }> = {
  '1000': { source: 'Bank statement', contra: '1100', texts: ['Customer receipts', 'Supplier payment run', 'Payroll transfer (WPS)', 'Loan instalment', 'Card settlement', 'Fixed deposit placement'] },
  '1100': { source: 'AR sub-ledger', contra: '4000', texts: ['Invoices raised', 'Receipts applied', 'Credit note issued', 'Customer refund'] },
  '1150': { source: 'Manual journal', contra: '6400', texts: ['ECL provision update'] },
  '1200': { source: 'ERP GL extract', contra: '2000', texts: ['Goods received', 'Issued to production', 'Stock count adjustment'] },
  '1300': { source: 'Manual journal', contra: '6100', texts: ['Prepaid rent amortised', 'Insurance prepayment', 'Deposit paid'] },
  '1500': { source: 'Fixed asset register', contra: '2000', texts: ['Asset additions', 'CWIP capitalised', 'Disposal'] },
  '1550': { source: 'Fixed asset register', contra: '7000', texts: ['Monthly depreciation run'] },
  '1600': { source: 'Fixed asset register', contra: '7100', texts: ['Amortisation run'] },
  '1999': { source: 'ERP GL extract', contra: '2000', texts: ['Unmapped batch parked in suspense'] },
  '2000': { source: 'AP sub-ledger', contra: '5000', texts: ['Supplier invoices posted', 'Payment run', 'Debit note'] },
  '2100': { source: 'Manual journal', contra: '6000', texts: ['Month-end accruals', 'Accrual reversal', 'Bonus accrual'] },
  '2200': { source: 'ERP GL extract', contra: '1100', texts: ['Output VAT', 'Input VAT recovery', 'VAT payment to FTA'] },
  '2500': { source: 'Bank statement', contra: '1000', texts: ['Loan repayment', 'Facility drawdown'] },
  '3000': { source: 'Manual journal', contra: '1000', texts: ['Share capital'] },
  '3100': { source: 'Manual journal', contra: '8900', texts: ['Prior period profit transfer'] },
  '4000': { source: 'AR sub-ledger', contra: '1100', texts: ['Customer invoices', 'Contract billing', 'Unbilled revenue accrual', 'Revenue deferral release'] },
  '4100': { source: 'AR sub-ledger', contra: '1100', texts: ['Service fees billed', 'Licence and registration fees', 'Ancillary charges'] },
  '4900': { source: 'ERP GL extract', contra: '1000', texts: ['Interest income', 'Rental income', 'Sundry income'] },
  '5000': { source: 'AP sub-ledger', contra: '2000', texts: ['Materials consumed', 'Freight inwards', 'Subcontractor costs'] },
  '5100': { source: 'Payroll file', contra: '2100', texts: ['Direct labour allocation', 'Overtime'] },
  '6000': { source: 'Payroll file', contra: '1000', texts: ['Monthly payroll', 'EOSB provision', 'Medical insurance', 'Housing allowance'] },
  '6100': { source: 'AP sub-ledger', contra: '2000', texts: ['Office rent', 'DEWA / FEWA utilities', 'Facility services'] },
  '6120': { source: 'Bank statement', contra: '1000', texts: ['Bank service charges', 'Transfer fees'] },
  '6200': { source: 'AP sub-ledger', contra: '2000', texts: ['Campaign costs', 'Sponsorship', 'Digital advertising'] },
  '6300': { source: 'AP sub-ledger', contra: '2000', texts: ['Software subscriptions', 'Cloud hosting', 'IT support'] },
  '6400': { source: 'AP sub-ledger', contra: '2000', texts: ['Audit fees', 'Legal fees', 'Consulting'] },
  '7000': { source: 'Fixed asset register', contra: '1550', texts: ['Monthly depreciation run'] },
  '7100': { source: 'Fixed asset register', contra: '1600', texts: ['Amortisation run'] },
  '8000': { source: 'Bank statement', contra: '2500', texts: ['Interest on term loan', 'Facility fees'] },
  '8100': { source: 'ERP GL extract', contra: '1100', texts: ['FX revaluation', 'Realised FX on settlement'] },
  '8900': { source: 'Manual journal', contra: '2200', texts: ['Corporate tax provision'] },
}
const POSTERS = ['Aisha K.', 'Rahul M.', 'Noura S.', 'Ahmed T.', 'Grace L.', 'Yousef A.', 'Meera P.', 'Khalid R.']

const journalCache = new Map<string, JournalLine[]>()
export function journalsFor(tenantId: string, month: string, code: string): JournalLine[] {
  const key = `${tenantId}|${month}|${code}`
  const hit = journalCache.get(key)
  if (hit) return hit
  const total = movement(tenantId, month, code)
  const d = DESC[code]
  const { r, between, pick } = seeded('je-' + key)
  const out: JournalLine[] = []
  const short = TENANTS.find((t) => t.id === tenantId)!.short
  const fixed: JournalLine[] = []
  // scripted unsupported top-side revenue journals in the current month
  if (code === '4000' && month === CURRENT_MONTH) {
    FAULTS[tenantId]?.unsupported.forEach((amt, k) =>
      fixed.push({ id: `JE-${short}-${month.slice(2).replace('-', '')}-TS${k + 1}`, tenantId, month, date: `${month}-31`, account: code, contra: '1100', description: 'Top-side revenue accrual: management estimate (no invoice)', amount: -amt, source: 'Manual journal', postedBy: 'Finance Controller', manual: true, flag: 'Unsupported' }),
    )
  }
  if (code === '1999' && Math.abs(total) > 0) {
    fixed.push({ id: `JE-${short}-${month.slice(2).replace('-', '')}-SUS`, tenantId, month, date: `${month}-31`, account: code, contra: '2000', description: SUSPENSE[tenantId]?.reason ?? 'Suspense posting', amount: total, source: 'ERP GL extract', postedBy: 'Interface', manual: false, flag: 'Suspense' })
  }
  const remaining = r2(total - fixed.reduce((s, l) => s + l.amount, 0))
  if (Math.abs(remaining) >= 0.01) {
    const n = Math.max(3, Math.min(36, Math.round(Math.log10(Math.abs(remaining) + 10) * 3 + r() * 10)))
    const w = Array.from({ length: n }, () => Math.pow(r(), 1.6) + 0.05)
    const ws = w.reduce((s, x) => s + x, 0)
    let acc = 0
    const days = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
    for (let k = 0; k < n; k++) {
      const amt = k === n - 1 ? r2(remaining - acc) : r2((remaining * w[k]) / ws)
      acc = r2(acc + amt)
      const manual = d.source === 'Manual journal' || r() < 0.06
      out.push({
        id: `JE-${short}-${month.slice(2).replace('-', '')}-${code}-${String(k + 1).padStart(3, '0')}`,
        tenantId,
        month,
        date: `${month}-${String(Math.min(days, 1 + Math.floor(between(0, days)))).padStart(2, '0')}`,
        account: code,
        contra: d.contra,
        description: pick(d.texts),
        amount: amt,
        source: manual ? 'Manual journal' : d.source,
        postedBy: manual ? pick(POSTERS) : 'Interface',
        manual,
      })
    }
  }
  const lines = [...fixed, ...out].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
  journalCache.set(key, lines)
  return lines
}
export const allJournals = (tenantId: string, month: string) => ACCOUNTS.flatMap((a) => journalsFor(tenantId, month, a.code))

// ---------- data feeds ----------
export type FeedStatus = 'OK' | 'Warning' | 'Delayed' | 'Failed'
export interface Feed {
  id: string
  tenantId: string
  name: string
  system: string
  frequency: string
  lastSync: string // ISO with timezone
  rows: number
  rejected: number
  status: FeedStatus
  note?: string
  uploaded?: boolean
}

const FEED_SCRIPT: Record<string, Partial<Record<string, Partial<Feed>>>> = {
  ahg: { 'AR sub-ledger': { status: 'Failed', rejected: 312, note: 'Insurance remittance file failed validation: 312 rows missing claim IDs' } },
  julphar: { 'GL journal extract': { status: 'Warning', rejected: 48, note: 'Intercompany batch from Algeria entity rejected (FX rate missing), parked in suspense' } },
  'rak-modern-school': { 'Bank statements': { status: 'Delayed', note: 'Uploaded manually; latest statement is from 6 Nov', lastSync: '2026-11-06T15:20:00+04:00' } },
  'innovation-city': { 'Bank statements': { status: 'Delayed', note: 'Bank API onboarding in progress; using daily CSV export', lastSync: '2026-11-10T18:05:00+04:00' } },
  'rak-airport': { 'AP sub-ledger': { status: 'Warning', rejected: 9, note: 'Fuel invoices without cost centre' } },
}

export function buildFeeds(): Feed[] {
  const out: Feed[] = []
  for (const t of TENANTS) {
    const { between, r } = seeded('feeds-' + t.id)
    const jCount = allJournals(t.id, CURRENT_MONTH).length
    const base: Omit<Feed, 'id' | 'tenantId' | 'lastSync' | 'rows' | 'rejected' | 'status'>[] = [
      { name: 'GL journal extract', system: t.erp, frequency: 'Daily' },
      { name: 'Bank statements', system: 'MT940 via bank API', frequency: 'Daily' },
      { name: 'AR sub-ledger', system: t.erp, frequency: 'Daily' },
      { name: 'AP sub-ledger', system: t.erp, frequency: 'Daily' },
      { name: 'Payroll file', system: 'WPS payroll', frequency: 'Monthly' },
    ]
    base.forEach((b, i) => {
      const hrs = Math.floor(between(1, 20))
      const lastSync = new Date(new Date('2026-11-12T09:00:00+04:00').getTime() - hrs * 3600_000).toISOString()
      const rows = b.name === 'GL journal extract' ? jCount : Math.round(t.profile.scale * between(400, 4000) * (b.name === 'Payroll file' ? 0.15 : 1))
      const s = FEED_SCRIPT[t.id]?.[b.name] ?? {}
      out.push({
        id: `${t.id}-feed-${i}`,
        tenantId: t.id,
        ...b,
        lastSync,
        rows,
        rejected: r() < 0.2 ? Math.floor(between(1, 6)) : 0,
        status: 'OK',
        ...s,
      })
    })
  }
  return out
}
