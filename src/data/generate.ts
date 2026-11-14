import { RECON_TYPES, TENANTS, type ReconType, type Tenant } from './tenants'

export const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'] as const
export type Month = (typeof MONTHS)[number]
export const CURRENT_MONTH: Month = '2026-10'
export const AS_OF = new Date('2026-11-12T09:00:00')
/** Business days elapsed in the November close window as of AS_OF (UAE Mon-Fri week). */
export const CLOSE_DAY_TODAY = 9
export const CLOSE_SLA_DAYS = 8

export const monthLabel = (m: string, long = false) =>
  new Date(m + '-01T00:00:00').toLocaleString('en-US', { month: long ? 'long' : 'short', year: long ? 'numeric' : undefined })

export type Stage = 'Not started' | 'In progress' | 'Pending review' | 'Signed off'
export type ExceptionStatus = 'Open' | 'In review' | 'Resolved'
export type Priority = 'High' | 'Medium' | 'Low'

export interface Recon {
  id: string
  tenantId: string
  month: Month
  type: ReconType
  account: string
  glBalance: number
  subBalance: number
  items: number
  autoMatched: number
  manualMatched: number
  stage: Stage
  preparer: string
  reviewer: string
}

export interface ReconException {
  id: string
  tenantId: string
  reconId: string
  month: Month
  reconType: ReconType
  account: string
  type: string
  description: string
  counterparty: string
  amount: number
  raisedOn: string // ISO date
  owner: string
  status: ExceptionStatus
  priority: Priority
  suggestion: string
  confidence: number // AI suggestion confidence 0..1
}

export interface TenantMonthStat {
  tenantId: string
  month: Month
  closeDays: number | null // null = close still running
}

// ---------- deterministic RNG ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20261112)
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)]
const between = (a: number, b: number) => a + rng() * (b - a)
const round = (n: number, step = 1) => Math.round(n / step) * step

// ---------- reference lists ----------
const BANKS = ['Emirates NBD', 'RAKBANK', 'FAB', 'Mashreq', 'ADCB']
const ACCOUNTS: Record<ReconType, (t: Tenant) => string[]> = {
  Bank: (t) => [`${pick(BANKS)} Operating ${Math.floor(between(1000, 9999))}`, `${pick(BANKS)} ${t.id === 'marjan' ? 'Escrow' : 'Collections'} ${Math.floor(between(1000, 9999))}`],
  Intercompany: () => ['Intercompany receivable / payable'],
  'AR sub-ledger': (t) => [t.id === 'ahg' ? 'Insurance receivables' : t.id === 'aurak' ? 'Student receivables' : t.id === 'rak-ports' ? 'Port dues receivable' : 'Trade receivables'],
  'AP sub-ledger': () => ['Trade payables'],
  'GL to sub-ledger': () => ['Accruals & prepayments'],
  'Fixed assets': () => ['PP&E register'],
  Payroll: () => ['Payroll & EOSB'],
}

const EXC: Record<ReconType, { type: string; desc: (cp: string) => string; fix: string }[]> = {
  Bank: [
    { type: 'Unidentified receipt', desc: (cp) => `Credit on statement with no matching ledger entry, reference "${cp}"`, fix: 'Match to open invoice with same amount and payer name (fuzzy match on reference).' },
    { type: 'Bank charge not booked', desc: () => 'Bank service charges debited but not posted to GL', fix: 'Post bank charges journal to 6120 Bank Charges.' },
    { type: 'Timing difference', desc: () => 'Payment in transit at month end, cleared on day +2', fix: 'Mark as timing difference; auto-clears when the next statement posts.' },
    { type: 'Duplicate payment', desc: (cp) => `Same amount paid twice to ${cp} within 3 days`, fix: 'Raise recovery request with vendor and post receivable.' },
  ],
  Intercompany: [
    { type: 'FX difference', desc: (cp) => `Revaluation rate mismatch vs ${cp} (USD/AED vs EUR/AED)`, fix: 'Align both entities on group month-end rate and post FX true-up.' },
    { type: 'Unmatched counterparty entry', desc: (cp) => `Recharge booked here but not by ${cp}`, fix: 'Notify counterparty entity to book mirror entry.' },
    { type: 'Timing difference', desc: (cp) => `${cp} booked in following period`, fix: 'Accept as cut-off difference; confirm entry in next period.' },
  ],
  'AR sub-ledger': [
    { type: 'Unapplied cash', desc: (cp) => `Receipt from ${cp} not applied to any invoice`, fix: 'Apply to oldest open invoices for this customer (amount matches 3 invoices).' },
    { type: 'Short payment', desc: (cp) => `${cp} paid less than invoiced amount`, fix: 'Create deduction case; likely withholding or rejection.' },
    { type: 'Disputed invoice', desc: (cp) => `Invoice disputed by ${cp}`, fix: 'Route to collections team for credit note decision.' },
  ],
  'AP sub-ledger': [
    { type: 'Price / quantity mismatch', desc: (cp) => `${cp} invoice differs from PO and GRN`, fix: 'Hold invoice and request credit note for the variance.' },
    { type: 'Missing GRN', desc: (cp) => `Invoice from ${cp} without goods receipt`, fix: 'Request receiving confirmation from operations.' },
    { type: 'Duplicate invoice', desc: (cp) => `Possible duplicate invoice from ${cp}`, fix: 'Block second invoice; same number, amount and date.' },
  ],
  'GL to sub-ledger': [
    { type: 'Manual journal mismatch', desc: () => 'Manual journal posted to control account bypassing sub-ledger', fix: 'Reverse journal and repost via sub-ledger.' },
    { type: 'Missing posting', desc: () => 'Sub-ledger batch not transferred to GL', fix: 'Re-run GL transfer for the batch.' },
  ],
  'Fixed assets': [
    { type: 'Capitalisation lag', desc: () => 'CWIP item in service but not capitalised', fix: 'Capitalise asset and start depreciation from in-service date.' },
    { type: 'Depreciation variance', desc: () => 'Register depreciation differs from GL', fix: 'Re-run depreciation and post true-up.' },
  ],
  Payroll: [
    { type: 'Accrual variance', desc: () => 'Payroll accrual differs from payroll register', fix: 'Post accrual true-up from final register.' },
    { type: 'Unmatched EOSB payment', desc: () => 'End-of-service payment not matched to provision', fix: 'Release provision for the leaver.' },
  ],
}

const COUNTERPARTIES = ['Gulf Marine Services', 'Al Hamra Contracting', 'Daman Insurance', 'ADNIC', 'Emirates Steel', 'DP World', 'NMC Supplies', 'Etisalat', 'Bayanat Logistics', 'Al Jazeera Fuel', 'Hamriyah Trading', 'Medline ME', 'Sharjah Cement', 'Oman Shipping', 'RAK Ceramics', 'Thiqa', 'Aster Pharmacy', 'Kuehne+Nagel']
const IC_ENTITIES = ['Saudi entity', 'Algeria entity', 'Ecuador entity', 'UK holding', 'Bangladesh JV', 'Ethiopia entity']
const PEOPLE = ['Aisha K.', 'Rahul M.', 'Noura S.', 'Ahmed T.', 'Grace L.', 'Yousef A.', 'Meera P.', 'Khalid R.', 'Hannah B.', 'Faisal O.', 'Ritu S.', 'Tariq H.']

// ---------- generation ----------
function addDays(month: string, days: number) {
  const d = new Date(month + '-01T00:00:00')
  d.setMonth(d.getMonth() + 1)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface Dataset {
  recons: Recon[]
  exceptions: ReconException[]
  monthStats: TenantMonthStat[]
}

export function generate(): Dataset {
  const recons: Recon[] = []
  const exceptions: ReconException[] = []
  const monthStats: TenantMonthStat[] = []
  let excSeq = 1000

  for (const t of TENANTS) {
    const p = t.profile
    const team = [...PEOPLE]
    for (let i = team.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[team[i], team[j]] = [team[j], team[i]]
    }
    team.length = 4
    // Accounts are stable across months
    // Each account has a stable difficulty, so month-to-month trends stay smooth
    const accounts = RECON_TYPES.flatMap((type) => ACCOUNTS[type](t).map((account) => ({ type, account, difficulty: between(0.6, 1.4) })))

    MONTHS.forEach((month, mi) => {
      const monthsAgo = MONTHS.length - 1 - mi
      // RAK Ports: improvement kicks in from July
      const gainMonths = t.id === 'rak-ports' ? Math.max(0, mi - 1) : mi
      const match = Math.min(0.995, Math.max(0.7, p.baseMatch + p.monthlyGain * gainMonths + between(-0.004, 0.004)))
      const closeDays = Math.max(3, round(p.closeDays + p.closeGain * gainMonths + between(-0.8, 0.8)))
      const isCurrent = month === '2026-10'
      monthStats.push({ tenantId: t.id, month, closeDays: isCurrent && closeDays > CLOSE_DAY_TODAY ? null : closeDays })
      const progress = !isCurrent || closeDays <= CLOSE_DAY_TODAY ? 1 : (CLOSE_DAY_TODAY - 1) / closeDays

      accounts.forEach(({ type, account, difficulty }, ai) => {
        const weak = type === p.weakSpot ? 1.9 : 0.75
        const items = Math.round(p.scale * between(180, 900) * (type === 'Bank' || type === 'AR sub-ledger' ? 2.2 : 0.6))
        const typeMatch = Math.max(0.6, Math.min(0.999, 1 - (1 - match) * weak * difficulty * between(0.94, 1.06)))
        const matched = Math.round(items * typeMatch)
        const autoMatched = Math.round(matched * between(0.72, 0.93))
        const id = `${t.id}-${month}-${ai}`
        const glBalance = round(p.scale * between(2e5, 4.5e7), 100)

        let stage: Stage = 'Signed off'
        if (isCurrent && progress < 1) {
          const r = rng()
          if (r > progress + 0.15) stage = rng() < 0.4 ? 'Not started' : 'In progress'
          else if (r > progress - 0.2) stage = 'Pending review'
        }

        const nExc = stage === 'Not started' ? 0 : Math.round(rng() * (1 - typeMatch) * 26 * Math.min(weak, 1.8) + (weak > 1 && rng() < 0.6 ? 1 : 0))
        let variance = 0
        for (let k = 0; k < nExc; k++) {
          const tmpl =
            t.id === 'julphar' && type === 'Intercompany' && rng() < 0.7
              ? EXC.Intercompany[0]
              : t.id === 'ahg' && type === 'AR sub-ledger' && rng() < 0.6
                ? EXC['AR sub-ledger'][1]
                : pick(EXC[type])
          const cp = type === 'Intercompany' ? pick(IC_ENTITIES) : pick(COUNTERPARTIES)
          let amount = round(p.scale * Math.pow(10, between(3, 5.1)), 10)
          if (rng() < 0.04) amount *= 7
          if (t.id === 'julphar' && type === 'Intercompany') amount *= 1.8 + monthsAgo * 0.1
          if (t.id === 'ahg' && type === 'AR sub-ledger') amount *= 1.5
          variance += amount
          const openProb = monthsAgo === 0 ? 0.7 : p.backlog * Math.pow(0.62, monthsAgo - 1) * 0.85
          const open = rng() < openProb
          const status: ExceptionStatus = open ? (rng() < 0.3 ? 'In review' : 'Open') : 'Resolved'
          const priority: Priority = amount > 250000 ? 'High' : amount > 40000 ? 'Medium' : 'Low'
          exceptions.push({
            id: `EX-${excSeq++}`,
            tenantId: t.id,
            reconId: id,
            month,
            reconType: type,
            account,
            type: tmpl.type,
            description: tmpl.desc(cp),
            counterparty: cp,
            amount,
            raisedOn: addDays(month, Math.floor(between(1, 6))),
            owner: pick(team),
            status,
            priority,
            suggestion: tmpl.fix,
            confidence: round(between(0.62, 0.98), 0.01),
          })
        }

        recons.push({
          id, tenantId: t.id, month, type, account,
          glBalance,
          subBalance: glBalance - variance * (rng() < 0.5 ? 1 : -1),
          items,
          autoMatched,
          manualMatched: matched - autoMatched,
          stage,
          preparer: team[ai % 4],
          reviewer: team[(ai + 1) % 4],
        })
      })
    })
  }
  return { recons, exceptions, monthStats }
}
