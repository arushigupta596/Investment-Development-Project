export type Sector =
  | 'Real Estate & Tourism'
  | 'Industry'
  | 'Transport & Logistics'
  | 'Business & Finance'
  | 'Healthcare & Pharma'
  | 'Education'

export interface Tenant {
  id: string
  name: string
  short: string
  sector: Sector
  cfo: string
  erp: string
  entities: number
  /** Generator profile (mock only) */
  profile: {
    scale: number // relative transaction volume
    baseMatch: number // auto-match rate in May
    monthlyGain: number // match-rate change per month
    closeDays: number // business days to close in May
    closeGain: number // close-day change per month (negative = faster)
    backlog: number // 0..1 tendency to leave old exceptions open
    weakSpot: ReconType // account type where most exceptions occur
    story: string
  }
  /** Finance profile (mock only), AED */
  fin: {
    revenue: number // monthly operating revenue in May
    grossMargin: number
    staffRatio: number // staff costs / revenue
    opexRatio: number // other opex / revenue
    assets: number // total assets
    debtRatio: number // borrowings / assets
    growth: number // monthly revenue growth
    seasonal?: 'education'
  }
}

export type ReconType =
  | 'Bank'
  | 'Intercompany'
  | 'AR sub-ledger'
  | 'AP sub-ledger'
  | 'GL to sub-ledger'
  | 'Fixed assets'
  | 'Payroll'

export const RECON_TYPES: ReconType[] = ['Bank', 'Intercompany', 'AR sub-ledger', 'AP sub-ledger', 'GL to sub-ledger', 'Fixed assets', 'Payroll']

// The 15 companies named on ido.ae/portfolio. All people and numbers are fictional demo data.
const M = 1e6
const B = 1e9
export const TENANTS: Tenant[] = [
  {
    id: 'marjan', name: 'Marjan', short: 'MJ', sector: 'Real Estate & Tourism', cfo: 'Layla Haddad', erp: 'Oracle Fusion', entities: 6,
    profile: { scale: 1.6, baseMatch: 0.9, monthlyGain: 0.006, closeDays: 9, closeGain: -0.2, backlog: 0.55, weakSpot: 'Bank', story: 'Escrow and off-plan collection accounts drive most bank breaks.' },
    fin: { revenue: 120 * M, grossMargin: 0.45, staffRatio: 0.06, opexRatio: 0.08, assets: 9 * B, debtRatio: 0.35, growth: 0.01 },
  },
  {
    id: 'stevin-rock', name: 'Stevin Rock', short: 'SR', sector: 'Industry', cfo: 'Priya Nair', erp: 'Microsoft Dynamics 365', entities: 4,
    profile: { scale: 1.1, baseMatch: 0.93, monthlyGain: 0.003, closeDays: 7, closeGain: 0, backlog: 0.3, weakSpot: 'Fixed assets', story: 'Quarry equipment capitalisation lags create fixed asset variances.' },
    fin: { revenue: 60 * M, grossMargin: 0.3, staffRatio: 0.08, opexRatio: 0.06, assets: 1.5 * B, debtRatio: 0.25, growth: 0.005 },
  },
  {
    id: 'rak-gas', name: 'RAK Gas', short: 'RG', sector: 'Industry', cfo: 'Daniel Mercer', erp: 'SAP S/4HANA', entities: 3,
    profile: { scale: 1.2, baseMatch: 0.965, monthlyGain: 0.002, closeDays: 5, closeGain: -0.1, backlog: 0.15, weakSpot: 'Intercompany', story: 'Best-in-class close; occasional intercompany timing differences.' },
    fin: { revenue: 140 * M, grossMargin: 0.22, staffRatio: 0.03, opexRatio: 0.04, assets: 2.8 * B, debtRatio: 0.2, growth: 0.003 },
  },
  {
    id: 'rak-ports', name: 'RAK Ports', short: 'RP', sector: 'Transport & Logistics', cfo: 'Omar Al Suwaidi', erp: 'SAP S/4HANA', entities: 5,
    profile: { scale: 1.4, baseMatch: 0.82, monthlyGain: 0.025, closeDays: 11, closeGain: -0.9, backlog: 0.35, weakSpot: 'AR sub-ledger', story: 'Rolled out automated matching for port-dues receivables in July; strong improvement since.' },
    fin: { revenue: 85 * M, grossMargin: 0.38, staffRatio: 0.09, opexRatio: 0.06, assets: 3.5 * B, debtRatio: 0.3, growth: 0.015 },
  },
  {
    id: 'saqr-port', name: 'SAQR Port', short: 'SQ', sector: 'Transport & Logistics', cfo: 'Rashid Al Nuaimi', erp: 'SAP S/4HANA', entities: 2,
    profile: { scale: 1.3, baseMatch: 0.9, monthlyGain: 0.004, closeDays: 8, closeGain: -0.2, backlog: 0.4, weakSpot: 'AR sub-ledger', story: 'Bulk cargo is billed by tonnage, so weighbridge data drives most billing disputes.' },
    fin: { revenue: 75 * M, grossMargin: 0.42, staffRatio: 0.07, opexRatio: 0.05, assets: 3 * B, debtRatio: 0.3, growth: 0.006 },
  },
  {
    id: 'rak-airport', name: 'RAK International Airport', short: 'AP', sector: 'Transport & Logistics', cfo: 'Fatima Al Zaabi', erp: 'SAP S/4HANA', entities: 2,
    profile: { scale: 0.9, baseMatch: 0.91, monthlyGain: 0.008, closeDays: 9, closeGain: -0.3, backlog: 0.35, weakSpot: 'AP sub-ledger', story: 'Ground-handling and fuel supplier invoices often mismatch PO quantities.' },
    fin: { revenue: 30 * M, grossMargin: 0.4, staffRatio: 0.12, opexRatio: 0.08, assets: 1.8 * B, debtRatio: 0.3, growth: 0.01 },
  },
  {
    id: 'rakez', name: 'RAKEZ', short: 'RZ', sector: 'Business & Finance', cfo: 'Hessa Al Mansoori', erp: 'Oracle Fusion', entities: 2,
    profile: { scale: 1.8, baseMatch: 0.94, monthlyGain: 0.004, closeDays: 6, closeGain: -0.1, backlog: 0.25, weakSpot: 'AR sub-ledger', story: 'High volume of licence-fee receipts; unapplied cash is the main exception type.' },
    fin: { revenue: 70 * M, grossMargin: 0.7, staffRatio: 0.18, opexRatio: 0.12, assets: 2.2 * B, debtRatio: 0.1, growth: 0.008 },
  },
  {
    id: 'rak-icc', name: 'RAK ICC', short: 'IC', sector: 'Business & Finance', cfo: 'James Whitfield', erp: 'Xero', entities: 1,
    profile: { scale: 0.5, baseMatch: 0.95, monthlyGain: 0.002, closeDays: 5, closeGain: 0, backlog: 0.2, weakSpot: 'Bank', story: 'Small, clean ledger; registry fee receipts occasionally unidentified.' },
    fin: { revenue: 8 * M, grossMargin: 0.85, staffRatio: 0.22, opexRatio: 0.13, assets: 0.15 * B, debtRatio: 0, growth: 0.004 },
  },
  {
    id: 'innovation-city', name: 'Innovation City', short: 'IN', sector: 'Business & Finance', cfo: 'Elena Petrova', erp: 'NetSuite', entities: 1,
    profile: { scale: 0.4, baseMatch: 0.9, monthlyGain: 0.01, closeDays: 7, closeGain: -0.3, backlog: 0.3, weakSpot: 'Bank', story: 'New virtual-assets free zone with fast-growing licence volume; bank feeds are still being automated.' },
    fin: { revenue: 6 * M, grossMargin: 0.8, staffRatio: 0.3, opexRatio: 0.22, assets: 0.08 * B, debtRatio: 0, growth: 0.05 },
  },
  {
    id: 'ahg', name: 'Arabian Healthcare Group', short: 'AH', sector: 'Healthcare & Pharma', cfo: 'Sara Qureshi', erp: 'Oracle EBS', entities: 4,
    profile: { scale: 1.5, baseMatch: 0.86, monthlyGain: 0.004, closeDays: 12, closeGain: -0.2, backlog: 0.7, weakSpot: 'AR sub-ledger', story: 'Insurance claim remittances and rejections leave a large aged AR backlog.' },
    fin: { revenue: 95 * M, grossMargin: 0.35, staffRatio: 0.12, opexRatio: 0.1, assets: 2.5 * B, debtRatio: 0.4, growth: 0.006 },
  },
  {
    id: 'julphar', name: 'Julphar', short: 'JP', sector: 'Healthcare & Pharma', cfo: 'Karim Fawzi', erp: 'SAP ECC', entities: 9,
    profile: { scale: 1.7, baseMatch: 0.88, monthlyGain: -0.006, closeDays: 10, closeGain: 0.4, backlog: 0.75, weakSpot: 'Intercompany', story: 'Intercompany FX differences across overseas distribution entities are building up.' },
    fin: { revenue: 110 * M, grossMargin: 0.32, staffRatio: 0.11, opexRatio: 0.12, assets: 4.2 * B, debtRatio: 0.45, growth: -0.01 },
  },
  {
    id: 'aurak', name: 'AURAK', short: 'AU', sector: 'Education', cfo: 'Michael Tan', erp: 'Banner Finance', entities: 1,
    profile: { scale: 0.7, baseMatch: 0.92, monthlyGain: 0.003, closeDays: 8, closeGain: 0.1, backlog: 0.45, weakSpot: 'AR sub-ledger', story: 'Tuition instalments and scholarship offsets peak around the September intake.' },
    fin: { revenue: 18 * M, grossMargin: 0.5, staffRatio: 0.25, opexRatio: 0.1, assets: 0.9 * B, debtRatio: 0.2, growth: 0.002, seasonal: 'education' },
  },
  {
    id: 'rak-mhsu', name: 'RAK MHSU', short: 'MH', sector: 'Education', cfo: 'Suresh Menon', erp: 'Oracle EBS', entities: 1,
    profile: { scale: 0.5, baseMatch: 0.91, monthlyGain: 0.003, closeDays: 8, closeGain: 0, backlog: 0.4, weakSpot: 'AR sub-ledger', story: 'Tuition and clinical training fees from partner hospitals reconcile late.' },
    fin: { revenue: 12 * M, grossMargin: 0.45, staffRatio: 0.24, opexRatio: 0.11, assets: 0.5 * B, debtRatio: 0.15, growth: 0.002, seasonal: 'education' },
  },
  {
    id: 'rak-academy', name: 'RAK Academy', short: 'AC', sector: 'Education', cfo: 'Claire Donovan', erp: 'Microsoft Dynamics 365', entities: 2,
    profile: { scale: 0.5, baseMatch: 0.94, monthlyGain: 0.002, closeDays: 6, closeGain: 0, backlog: 0.25, weakSpot: 'AR sub-ledger', story: 'Termly fee billing with sibling discounts; mostly clean.' },
    fin: { revenue: 10 * M, grossMargin: 0.4, staffRatio: 0.22, opexRatio: 0.08, assets: 0.4 * B, debtRatio: 0.1, growth: 0.001, seasonal: 'education' },
  },
  {
    id: 'rak-modern-school', name: 'RAK Modern School', short: 'MS', sector: 'Education', cfo: 'Hamad Al Shehhi', erp: 'Tally', entities: 1,
    profile: { scale: 0.3, baseMatch: 0.9, monthlyGain: 0.002, closeDays: 9, closeGain: 0.2, backlog: 0.5, weakSpot: 'Bank', story: 'Small finance team; cash and cheque fee collections cause bank breaks.' },
    fin: { revenue: 4 * M, grossMargin: 0.35, staffRatio: 0.2, opexRatio: 0.09, assets: 0.12 * B, debtRatio: 0.05, growth: 0.001, seasonal: 'education' },
  },
]

/** Companies whose CFO can sign in to the demo. */
export const CFO_LOGINS = ['rak-ports', 'julphar']

export const tenantById = (id: string) => TENANTS.find((t) => t.id === id)

export const SECTORS: Sector[] = Array.from(new Set(TENANTS.map((t) => t.sector)))
