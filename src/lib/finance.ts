/** Finance metrics shared by dashboards, data screens and the assistant. */
import { TENANTS, tenantById, type Sector } from '../data/tenants'
import { CURRENT_MONTH, MONTHS, type Dataset, type Month } from '../data/generate'
import { ACCOUNTS, FINANCE, bal, type Feed, type PLLine, type BSLine } from '../data/finance'
import { assuranceFor } from './assurance'

export type Scope = string | 'all' // tenant id or whole portfolio
const ids = (scope: Scope) => (scope === 'all' ? TENANTS.map((t) => t.id) : [scope])

/** Natural-sign total of a statement line (revenue and liabilities positive). */
export function lineTotal(scope: Scope, month: string, line: PLLine | BSLine) {
  const accts = ACCOUNTS.filter((a) => a.line === line)
  const isCredit = ['Revenue', 'Trade payables', 'Accruals & other payables', 'Borrowings', 'Share capital', 'Retained earnings'].includes(line)
  const s = ids(scope).reduce((acc, id) => acc + accts.reduce((x, a) => x + bal(id, month, a.code), 0), 0)
  return isCredit ? -s : s
}

export interface PL {
  revenue: number
  cogs: number
  grossProfit: number
  staff: number
  opex: number
  ebitda: number
  da: number
  ebit: number
  finance: number
  pbt: number
  tax: number
  netIncome: number
}
export function pl(scope: Scope, month: string): PL {
  const revenue = lineTotal(scope, month, 'Revenue')
  const cogs = lineTotal(scope, month, 'Cost of sales')
  const staff = lineTotal(scope, month, 'Staff costs')
  const opex = lineTotal(scope, month, 'Other operating expenses')
  const da = lineTotal(scope, month, 'Depreciation & amortisation')
  const finance = lineTotal(scope, month, 'Finance costs')
  const tax = lineTotal(scope, month, 'Corporate tax')
  const grossProfit = revenue - cogs
  const ebitda = grossProfit - staff - opex
  const ebit = ebitda - da
  const pbt = ebit - finance
  return { revenue, cogs, grossProfit, staff, opex, ebitda, da, ebit, finance, pbt, tax, netIncome: pbt - tax }
}

export interface BS {
  cash: number
  receivables: number
  inventory: number
  otherCurrent: number
  ppe: number
  intangibles: number
  suspense: number
  totalAssets: number
  payables: number
  accruals: number
  borrowings: number
  totalLiabilities: number
  shareCapital: number
  retained: number // includes this month's profit
  totalEquity: number
}
export function bs(scope: Scope, month: string): BS {
  const L = (l: BSLine) => lineTotal(scope, month, l)
  const cash = L('Cash and bank')
  const receivables = L('Trade receivables')
  const inventory = L('Inventory')
  const otherCurrent = L('Other current assets')
  const ppe = L('Property, plant & equipment')
  const intangibles = L('Intangible assets')
  const suspense = L('Suspense')
  const payables = L('Trade payables')
  const accruals = L('Accruals & other payables')
  const borrowings = L('Borrowings')
  const shareCapital = L('Share capital')
  const retained = L('Retained earnings') + pl(scope, month).netIncome
  const totalAssets = cash + receivables + inventory + otherCurrent + ppe + intangibles + suspense
  const totalLiabilities = payables + accruals + borrowings
  return { cash, receivables, inventory, otherCurrent, ppe, intangibles, suspense, totalAssets, payables, accruals, borrowings, totalLiabilities, shareCapital, retained, totalEquity: shareCapital + retained }
}

export function budget(scope: Scope, month: Month) {
  return ids(scope).reduce((a, id) => ({ revenue: a.revenue + FINANCE[id].budget[month].revenue, ebitda: a.ebitda + FINANCE[id].budget[month].ebitda }), { revenue: 0, ebitda: 0 })
}

export function trialBalance(tenantId: string, month: string) {
  const rows = ACCOUNTS.map((a) => {
    const v = bal(tenantId, month, a.code)
    return { ...a, debit: v > 0 ? v : 0, credit: v < 0 ? -v : 0 }
  })
  const debit = rows.reduce((s, r) => s + r.debit, 0)
  const credit = rows.reduce((s, r) => s + r.credit, 0)
  return { rows, debit, credit, difference: Math.round((debit - credit) * 100) / 100, suspense: bal(tenantId, month, '1999') }
}

export interface CompanyKpis {
  tenantId: string
  name: string
  sector: Sector
  revenue: number
  revenuePrev: number
  revenueBudget: number
  ebitda: number
  ebitdaBudget: number
  ebitdaMargin: number
  netIncome: number
  netMargin: number
  cash: number
  netDebt: number
  workingCapital: number
  receivables: number
  verifiedPct: number
}
export function companyKpis(tenantId: string, month: Month = CURRENT_MONTH): CompanyKpis {
  const t = tenantById(tenantId)!
  const p = pl(tenantId, month)
  const prevIdx = MONTHS.indexOf(month) - 1
  const prev = prevIdx >= 0 ? pl(tenantId, MONTHS[prevIdx]).revenue : p.revenue
  const b = bs(tenantId, month)
  const bud = budget(tenantId, month)
  return {
    tenantId,
    name: t.name,
    sector: t.sector,
    revenue: p.revenue,
    revenuePrev: prev,
    revenueBudget: bud.revenue,
    ebitda: p.ebitda,
    ebitdaBudget: bud.ebitda,
    ebitdaMargin: p.ebitda / p.revenue,
    netIncome: p.netIncome,
    netMargin: p.netIncome / p.revenue,
    cash: b.cash,
    netDebt: b.borrowings - b.cash,
    workingCapital: b.receivables + b.inventory + b.otherCurrent - b.payables - b.accruals,
    receivables: b.receivables,
    verifiedPct: assuranceFor(tenantId).verifiedPct,
  }
}

export function financeTrend(scope: Scope) {
  return MONTHS.map((m) => {
    const p = pl(scope, m)
    const b = budget(scope, m)
    return { month: m, revenue: p.revenue, ebitda: p.ebitda, netIncome: p.netIncome, revenueBudget: b.revenue, ebitdaBudget: b.ebitda, cash: bs(scope, m).cash }
  })
}

// ---------- pipeline ----------
export const STAGES = ['Ingest', 'Ledger', 'Trial balance', 'Statements', 'Reconciliation'] as const
export type StageName = (typeof STAGES)[number]
export type StageStatus = 'Done' | 'In progress' | 'Blocked' | 'Not started'
export interface StageCell {
  stage: StageName
  status: StageStatus
  detail: string
}

export function pipelineFor(ds: Dataset, feeds: Feed[], tenantId: string, month: Month = CURRENT_MONTH): StageCell[] {
  if (month !== CURRENT_MONTH) return STAGES.map((stage) => ({ stage, status: 'Done', detail: 'Closed' }))
  const fs = feeds.filter((f) => f.tenantId === tenantId)
  const failed = fs.filter((f) => f.status === 'Failed')
  const delayed = fs.filter((f) => f.status === 'Delayed')
  const ingest: StageCell = failed.length
    ? { stage: 'Ingest', status: 'Blocked', detail: `${failed[0].name}: ${failed[0].note ?? 'failed'}` }
    : delayed.length
      ? { stage: 'Ingest', status: 'In progress', detail: `${delayed[0].name}: ${delayed[0].note ?? 'delayed'}` }
      : { stage: 'Ingest', status: 'Done', detail: `${fs.reduce((s, f) => s + f.rows, 0).toLocaleString('en-US')} rows from ${fs.length} feeds` }
  const ledger: StageCell =
    ingest.status === 'Done'
      ? { stage: 'Ledger', status: 'Done', detail: 'All journals posted' }
      : { stage: 'Ledger', status: ingest.status === 'Blocked' ? 'Blocked' : 'In progress', detail: ingest.status === 'Blocked' ? `Waiting for ${failed[0].name}` : 'Posting as feeds arrive' }
  const tb = trialBalance(tenantId, month)
  const tbCell: StageCell =
    ledger.status !== 'Done'
      ? { stage: 'Trial balance', status: 'Not started', detail: 'Waiting for ledger' }
      : tb.suspense
        ? { stage: 'Trial balance', status: 'Blocked', detail: `Suspense holds AED ${Math.round(tb.suspense).toLocaleString('en-US')}` }
        : { stage: 'Trial balance', status: 'Done', detail: 'Balanced, suspense clear' }
  const ms = ds.monthStats.find((s) => s.tenantId === tenantId && s.month === month)
  const closed = ms?.closeDays != null
  const st: StageCell =
    tbCell.status !== 'Done'
      ? { stage: 'Statements', status: 'Not started', detail: 'Waiting for trial balance' }
      : closed
        ? { stage: 'Statements', status: 'Done', detail: `Issued on day ${ms!.closeDays}` }
        : { stage: 'Statements', status: 'In progress', detail: 'Draft P&L and balance sheet in review' }
  const recons = ds.recons.filter((r) => r.tenantId === tenantId && r.month === month)
  const signed = recons.filter((r) => r.stage === 'Signed off').length
  const a = assuranceFor(tenantId)
  const rc: StageCell =
    signed === recons.length && closed
      ? { stage: 'Reconciliation', status: 'Done', detail: `${signed}/${recons.length} signed off · revenue ${Math.round(a.verifiedPct * 1000) / 10}% verified` }
      : signed === 0
        ? { stage: 'Reconciliation', status: 'Not started', detail: `0/${recons.length} signed off` }
        : { stage: 'Reconciliation', status: 'In progress', detail: `${signed}/${recons.length} signed off · revenue ${Math.round(a.verifiedPct * 1000) / 10}% verified` }
  return [ingest, ledger, tbCell, st, rc]
}

export const pipelineDone = (cells: StageCell[]) => cells.every((c) => c.status === 'Done')
