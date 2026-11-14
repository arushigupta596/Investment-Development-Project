/**
 * Revenue assurance agent: "Is that number actually true?"
 * Tests a company's reported revenue for the current month against three independent sources:
 *   1. General ledger  - do the revenue entries in the accounts match the report?
 *   2. Invoices and contracts - billed at the right amount, no duplicates or missing invoices?
 *   3. Bank statements - did the cash actually arrive for what was invoiced?
 */
import { TENANTS, tenantById } from '../data/tenants'
import { CURRENT_MONTH } from '../data/generate'
import { FAULTS, bal, journalsFor, seeded, type JournalLine } from '../data/finance'

export const AS_OF_DATE = '2026-11-12'

export interface Contract {
  id: string
  customer: string
  description: string
  monthlyFee: number
  terms: number // payment terms in days
  start: string
}
export type InvoiceStatus = 'Paid' | 'Short-paid' | 'Unpaid, past due' | 'Not yet due'
export interface Invoice {
  id: string
  contractId: string
  customer: string
  date: string
  due: string
  amount: number
  expected: number // what the contract says should have been billed
  status: InvoiceStatus
  received: number
  receiptId?: string
  duplicateOf?: string
  kind: 'Invoice' | 'Credit note'
  postedToGL: boolean
}
export interface Receipt {
  id: string
  date: string
  payer: string
  reference: string
  amount: number
  invoiceId?: string
}
export type CheckId = 'gl' | 'billing' | 'bank'
export type FindingType =
  | 'Report differs from ledger'
  | 'Unsupported journal'
  | 'Credit note not posted'
  | 'Price mismatch'
  | 'Duplicate invoice'
  | 'Missing invoice'
  | 'Unpaid invoice'
  | 'Short payment'
  | 'Unidentified cash'
export interface Finding {
  id: string
  check: CheckId
  type: FindingType
  description: string
  amount: number // absolute AED at stake
  customer?: string
  invoiceId?: string
  contractId?: string
  receiptId?: string
  journalId?: string
  fix: string
}
export interface CheckResult {
  id: CheckId
  title: string
  question: string
  status: 'pass' | 'variance' | 'fail'
  summary: string
  amount: number
  findings: Finding[]
}
export interface Assurance {
  tenantId: string
  month: string
  reported: number
  glRevenue: number
  invoicedNet: number
  contractCorrect: number
  unbilled: number
  collected: number
  shortfall: number
  unpaidPastDue: number
  notYetDue: number
  verified: number
  verifiedPct: number
  contracts: Contract[]
  invoices: Invoice[]
  receipts: Receipt[]
  revenueJournals: JournalLine[]
  checks: CheckResult[]
  findings: Finding[]
}

const CUSTOMERS: Record<string, string[]> = {
  'Real Estate & Tourism': ['Wynn Al Marjan Resort', 'Rixos Bab Al Bahr', 'Hampton by Hilton', 'Al Hamra Holdings', 'Emaar Hospitality', 'Mövenpick Resort', 'InterContinental', 'Address Hotels', 'Nobu Hospitality', 'Bayview Residences', 'Coral Bay Owners', 'Ritz-Carlton RAK'],
  Industry: ['Emirates Steel', 'Sharjah Cement', 'RAK Ceramics', 'Gulf Cement Co.', 'Union Cement', 'Arabian Glass', 'Al Ghurair Foods', 'Oman Aggregates', 'Qatar Building Co.', 'Kuwait Precast', 'ADNOC Distribution', 'Emirates Gas'],
  'Transport & Logistics': ['Maersk Line', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'Kuehne+Nagel', 'DHL Global Forwarding', 'Air Arabia', 'IndiGo', 'Gulf Marine Services', 'Oman Shipping', 'Bayanat Logistics', 'Aramex'],
  'Business & Finance': ['Crypto.com MENA', 'Binance FZE', 'Ripple Labs', 'Zand Bank', 'HSBC Middle East', 'Al Tamimi & Co', 'KPMG Lower Gulf', 'Chalhoub Group', 'Al Futtaim', 'Majid Al Futtaim', 'Lulu Group', 'Apparel Group'],
  'Healthcare & Pharma': ['Daman Insurance', 'ADNIC', 'Thiqa', 'AXA Gulf', 'MetLife', 'Aster Pharmacy', 'Life Pharmacy', 'Boots ME', 'Saudi MoH', 'Algeria PCH', 'Ecuador Distribuidora', 'Medline ME'],
  Education: ['Ministry of Education', 'RAK Government Scholarships', 'Saqr Hospital', 'Ibrahim Bin Hamad Hospital', 'Family fees (bulk)', 'Corporate sponsors', 'Etisalat Foundation', 'ADNOC Scholarships', 'Emirates Foundation', 'Al Qasimi Foundation', 'Parent payment portal', 'Alumni fund'],
}
const SERVICE: Record<string, string[]> = {
  'Real Estate & Tourism': ['Ground lease', 'Plot sale instalment', 'Service charges', 'Hotel management fee'],
  Industry: ['Aggregate supply', 'Limestone supply', 'Gas supply agreement', 'Haulage'],
  'Transport & Logistics': ['Port dues', 'Stevedoring', 'Bulk cargo handling', 'Landing and parking fees', 'Ground handling'],
  'Business & Finance': ['Licence fee', 'Registration fee', 'Office lease', 'Registry services'],
  'Healthcare & Pharma': ['Insurance claims', 'Product supply', 'Distribution agreement', 'Inpatient services'],
  Education: ['Tuition fees', 'Clinical training fees', 'Scholarship billing', 'Transport and boarding'],
}

const r0 = (n: number) => Math.round(n)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

function build(tenantId: string): Assurance {
  const t = tenantById(tenantId)!
  const f = FAULTS[tenantId]
  const month = CURRENT_MONTH
  const { r, between, pick } = seeded('assure-' + tenantId)
  const short = t.short
  const glRevenue = -(bal(tenantId, month, '4000') + bal(tenantId, month, '4100'))
  const unsupportedTotal = f.unsupported.reduce((s, x) => s + x, 0)
  const bookedTarget = r0(glRevenue - unsupportedTotal) // invoices posted through AR

  // ---- contracts ----
  const names = [...CUSTOMERS[t.sector]]
  const nContracts = Math.max(6, Math.min(12, Math.round(5 + t.profile.scale * 4)))
  const weights = Array.from({ length: nContracts }, () => 0.3 + Math.pow(r(), 1.3) * 2)
  const contracts: Contract[] = weights.map((_, i) => ({
    id: `CT-${short}-${String(i + 1).padStart(3, '0')}`,
    customer: names[i % names.length],
    description: pick(SERVICE[t.sector]),
    monthlyFee: 0,
    terms: t.sector === 'Healthcare & Pharma' ? 45 : t.sector === 'Education' ? 15 : 30,
    start: `20${String(22 + Math.floor(r() * 4))}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-01`,
  }))
  // which contracts carry faults
  const idx = contracts.map((_, i) => i)
  const missingIdx = f.missing ? idx.slice(-f.missing) : []
  const billable = idx.filter((i) => !missingIdx.includes(i))
  const mispricedIdx = billable.slice(0, f.mispriced)
  const priceDelta: Record<number, number> = {}
  mispricedIdx.forEach((i, k) => (priceDelta[i] = (k % 2 === 0 ? 1 : -1) * between(0.04, 0.12)))
  const dupIdx = billable.slice(f.mispriced, f.mispriced + f.duplicates)

  // scale fees so that booked invoices sum exactly to the GL (net of unsupported journals)
  const unit = billable.reduce((s, i) => s + weights[i] * (1 + (priceDelta[i] ?? 0)), 0) + dupIdx.reduce((s, i) => s + weights[i], 0)
  const K = bookedTarget / unit
  contracts.forEach((c, i) => (c.monthlyFee = r0(weights[i] * K)))

  // ---- invoices ----
  const invoices: Invoice[] = []
  let invSeq = 1
  const invDate = () => `${month}-${String(1 + Math.floor(between(0, 27))).padStart(2, '0')}`
  for (const i of billable) {
    const c = contracts[i]
    const amount = r0(c.monthlyFee * (1 + (priceDelta[i] ?? 0)))
    const date = invDate()
    invoices.push({ id: `INV-${short}-${String(10400 + invSeq++)}`, contractId: c.id, customer: c.customer, date, due: addDays(date, c.terms), amount, expected: c.monthlyFee, status: 'Not yet due', received: 0, kind: 'Invoice', postedToGL: true })
  }
  for (const i of dupIdx) {
    const orig = invoices.find((x) => x.contractId === contracts[i].id)!
    invoices.push({ ...orig, id: `INV-${short}-${String(10400 + invSeq++)}`, date: addDays(orig.date, 1), due: addDays(orig.due, 1), expected: 0, duplicateOf: orig.id })
  }
  // plug rounding into the first clean invoice so the total ties exactly
  const dupContracts = new Set(dupIdx.map((i) => contracts[i].id))
  const clean = invoices.find((x) => !x.duplicateOf && x.amount === x.expected && !dupContracts.has(x.contractId))!
  const diff = bookedTarget - invoices.reduce((s, x) => s + x.amount, 0)
  clean.amount += diff
  clean.expected += diff
  contracts.find((c) => c.id === clean.contractId)!.monthlyFee = clean.expected
  // credit notes issued in billing but never posted to the ledger
  for (let k = 0; k < f.creditNotes; k++) {
    const target = invoices[(k * 3 + 1) % invoices.length]
    const amt = r0(target.amount * between(0.04, 0.09))
    invoices.push({ id: `CN-${short}-${String(700 + k)}`, contractId: target.contractId, customer: target.customer, date: `${month}-28`, due: `${month}-28`, amount: -amt, expected: -amt, status: 'Paid', received: 0, kind: 'Credit note', postedToGL: false })
  }

  // ---- bank receipts ----
  const receipts: Receipt[] = []
  let rcSeq = 1
  const shortIdx = new Set(invoices.filter((x) => x.kind === 'Invoice' && !x.duplicateOf).slice(1, 1 + f.shortPaid).map((x) => x.id))
  for (const inv of invoices) {
    if (inv.kind !== 'Invoice') continue
    const pastDue = inv.due < AS_OF_DATE
    if (inv.duplicateOf) {
      inv.status = pastDue ? 'Unpaid, past due' : 'Not yet due'
      continue
    }
    const willPay = shortIdx.has(inv.id) || r() > f.unpaidRate
    let payDate = addDays(inv.date, Math.floor(between(5, inv.date >= `${month}-20` ? 10 : 26)))
    if (willPay && payDate > '2026-11-11') {
      if (!pastDue) {
        inv.status = 'Not yet due'
        continue
      }
      payDate = '2026-11-11'
    }
    if (!willPay) {
      inv.status = pastDue ? 'Unpaid, past due' : 'Not yet due'
      continue
    }
    // customers pay the contract price when overbilled
    const base = inv.amount > inv.expected ? inv.expected : inv.amount
    const amt = shortIdx.has(inv.id) ? r0(base * between(0.82, 0.95)) : base
    const rc: Receipt = { id: `RC-${short}-${String(5000 + rcSeq++)}`, date: payDate, payer: inv.customer.toUpperCase(), reference: inv.id, amount: amt, invoiceId: inv.id }
    receipts.push(rc)
    inv.received = amt
    inv.receiptId = rc.id
    inv.status = shortIdx.has(inv.id) ? 'Short-paid' : 'Paid'
  }
  for (let k = 0; k < f.unidentified; k++) {
    receipts.push({ id: `RC-${short}-${String(5000 + rcSeq++)}`, date: `2026-11-0${3 + k}`, payer: pick(['TRF FROM ACCT 4471', 'CASH DEPOSIT BR 12', 'CHQ 008812', 'INWARD SWIFT REF']), reference: '', amount: r0(K * between(0.15, 0.6)) })
  }

  // ---- findings ----
  const findings: Finding[] = []
  let fSeq = 1
  const fid = () => `RA-${short}-${String(fSeq++).padStart(2, '0')}`
  const revenueJournals = [...journalsFor(tenantId, month, '4000'), ...journalsFor(tenantId, month, '4100')]
  const reported = r0(glRevenue + f.reportDiff)
  if (f.reportDiff)
    findings.push({ id: fid(), check: 'gl', type: 'Report differs from ledger', amount: Math.abs(f.reportDiff), description: `Management pack shows ${f.reportDiff > 0 ? 'more' : 'less'} revenue than the general ledger. The pack was prepared before late adjustments were posted.`, fix: 'Refresh the management pack from the closed ledger and resubmit.' })
  revenueJournals
    .filter((j) => j.flag === 'Unsupported')
    .forEach((j) => findings.push({ id: fid(), check: 'gl', type: 'Unsupported journal', amount: Math.abs(j.amount), journalId: j.id, description: `Manual journal ${j.id} books revenue with no invoice or contract behind it ("${j.description}").`, fix: 'Request support from the Finance Controller, or reverse the journal before sign-off.' }))
  invoices
    .filter((x) => x.kind === 'Credit note')
    .forEach((x) => findings.push({ id: fid(), check: 'gl', type: 'Credit note not posted', amount: Math.abs(x.amount), customer: x.customer, invoiceId: x.id, contractId: x.contractId, description: `Credit note ${x.id} to ${x.customer} was issued in billing but never posted, so ledger revenue is overstated.`, fix: 'Post the credit note to 4000 Operating revenue against the customer account.' }))
  invoices
    .filter((x) => x.kind === 'Invoice' && !x.duplicateOf && x.amount !== x.expected)
    .forEach((x) => findings.push({ id: fid(), check: 'billing', type: 'Price mismatch', amount: Math.abs(x.amount - x.expected), customer: x.customer, invoiceId: x.id, contractId: x.contractId, description: `${x.id} billed ${x.customer} ${x.amount > x.expected ? 'above' : 'below'} the contract rate (${Math.round(((x.amount - x.expected) / x.expected) * 1000) / 10}%).`, fix: x.amount > x.expected ? 'Issue a credit note for the overbilled amount.' : 'Raise a supplementary invoice for the underbilled amount.' }))
  invoices
    .filter((x) => x.duplicateOf)
    .forEach((x) => findings.push({ id: fid(), check: 'billing', type: 'Duplicate invoice', amount: x.amount, customer: x.customer, invoiceId: x.id, contractId: x.contractId, description: `${x.id} repeats ${x.duplicateOf} for ${x.customer}: same contract, same period, same amount.`, fix: 'Cancel the duplicate and reverse its revenue.' }))
  missingIdx.forEach((i) => {
    const c = contracts[i]
    findings.push({ id: fid(), check: 'billing', type: 'Missing invoice', amount: c.monthlyFee, customer: c.customer, contractId: c.id, description: `Contract ${c.id} with ${c.customer} (${c.description}) is active but was not billed for October.`, fix: 'Raise the October invoice; revenue is currently understated.' })
  })
  invoices
    .filter((x) => x.kind === 'Invoice' && !x.duplicateOf && x.status === 'Unpaid, past due')
    .forEach((x) => findings.push({ id: fid(), check: 'bank', type: 'Unpaid invoice', amount: x.amount, customer: x.customer, invoiceId: x.id, contractId: x.contractId, description: `${x.id} to ${x.customer} was due on ${x.due} and no payment has reached the bank.`, fix: 'Chase the customer; confirm the service was delivered before keeping the revenue.' }))
  invoices
    .filter((x) => x.status === 'Short-paid')
    .forEach((x) => findings.push({ id: fid(), check: 'bank', type: 'Short payment', amount: Math.min(x.amount, x.expected) - x.received, customer: x.customer, invoiceId: x.id, receiptId: x.receiptId, contractId: x.contractId, description: `${x.customer} paid ${Math.round((x.received / x.amount) * 100)}% of ${x.id}; the rest has not arrived.`, fix: 'Open a deduction case: withholding, rejection or dispute.' }))
  receipts
    .filter((x) => !x.invoiceId)
    .forEach((x) => findings.push({ id: fid(), check: 'bank', type: 'Unidentified cash', amount: x.amount, receiptId: x.id, description: `Receipt ${x.id} ("${x.payer}") on ${x.date} does not match any invoice.`, fix: 'Identify the payer; it may be an unbilled sale or a customer prepayment.' }))

  const sum = (xs: Finding[]) => xs.reduce((s, x) => s + x.amount, 0)
  const mk = (id: CheckId, title: string, question: string, ok: string): CheckResult => {
    const fs = findings.filter((x) => x.check === id)
    const amt = sum(fs)
    return { id, title, question, findings: fs, amount: amt, status: !fs.length ? 'pass' : amt / reported > 0.02 ? 'fail' : 'variance', summary: fs.length ? `${fs.length} finding${fs.length > 1 ? 's' : ''} worth AED ${Math.round(amt).toLocaleString('en-US')}` : ok }
  }
  const checks = [
    mk('gl', 'General ledger', 'Do the revenue entries in the accounts match the report?', 'Reported revenue agrees to the ledger, and every revenue entry is supported.'),
    mk('billing', 'Invoices and contracts', 'Was everything billed at the right amount, with no duplicates or missing invoices?', 'Every invoice matches its contract; no duplicates or gaps.'),
    mk('bank', 'Bank statements', 'Did the cash actually arrive for what was invoiced?', 'Cash received for everything that is due.'),
  ]

  const inv = invoices.filter((x) => x.kind === 'Invoice')
  const cns = invoices.filter((x) => x.kind === 'Credit note')
  const invoicedNet = inv.reduce((s, x) => s + x.amount, 0) + cns.reduce((s, x) => s + x.amount, 0)
  const contractCorrect = inv.filter((x) => !x.duplicateOf).reduce((s, x) => s + x.expected, 0) + cns.reduce((s, x) => s + x.amount, 0)
  const collected = inv.reduce((s, x) => s + x.received, 0)
  const shortfall = inv.filter((x) => x.status === 'Short-paid').reduce((s, x) => s + Math.min(x.amount, x.expected) - x.received, 0)
  const unpaidPastDue = inv.filter((x) => !x.duplicateOf && x.status === 'Unpaid, past due').reduce((s, x) => s + x.amount, 0)
  const notYetDue = inv.filter((x) => !x.duplicateOf && x.status === 'Not yet due').reduce((s, x) => s + x.amount, 0)
  const unbilled = sum(findings.filter((x) => x.type === 'Missing invoice'))
  // verified = billed at contract price and either collected or not yet due
  const verified = inv
    .filter((x) => !x.duplicateOf)
    .reduce((s, x) => s + (x.status === 'Paid' || x.status === 'Short-paid' ? Math.min(x.received, x.expected) : x.status === 'Not yet due' ? Math.min(x.amount, x.expected) : 0), 0)
  const verifiedPct = Math.max(0, Math.min(1, (verified - cns.reduce((s, x) => s - x.amount, 0)) / reported))

  return { tenantId, month, reported, glRevenue: r0(glRevenue), invoicedNet, contractCorrect, unbilled, collected, shortfall, unpaidPastDue, notYetDue, verified, verifiedPct, contracts, invoices, receipts, revenueJournals, checks, findings }
}

const cache = new Map<string, Assurance>()
export function assuranceFor(tenantId: string): Assurance {
  if (!cache.has(tenantId)) cache.set(tenantId, build(tenantId))
  return cache.get(tenantId)!
}
export const allAssurance = () => TENANTS.map((t) => assuranceFor(t.id))
