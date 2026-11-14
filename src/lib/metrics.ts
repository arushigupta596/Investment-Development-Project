import { AS_OF, CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, CURRENT_MONTH, MONTHS, type Dataset, type Month, type ReconException } from '../data/generate'
import { TENANTS, RECON_TYPES, type ReconType } from '../data/tenants'

export const ageDays = (e: ReconException) =>
  Math.max(0, Math.round((AS_OF.getTime() - new Date(e.raisedOn + 'T00:00:00').getTime()) / 86400000))

export const isOpen = (e: ReconException) => e.status !== 'Resolved'

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+'
export const AGING_BUCKETS: AgingBucket[] = ['0-30', '31-60', '61-90', '90+']
export const bucketOf = (days: number): AgingBucket => (days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+')

export function aging(exceptions: ReconException[]) {
  const out = AGING_BUCKETS.map((b) => ({ bucket: b, count: 0, amount: 0 }))
  for (const e of exceptions) {
    if (!isOpen(e)) continue
    const row = out.find((r) => r.bucket === bucketOf(ageDays(e)))!
    row.count++
    row.amount += e.amount
  }
  return out
}

export interface TenantSummary {
  tenantId: string
  matchRate: number
  autoRate: number
  openCount: number
  openAmount: number
  aged60Count: number
  aged60Amount: number
  highOpen: number
  closeDays: number | null
  closeRunning: boolean
  slaBreach: boolean
  reconsTotal: number
  reconsSignedOff: number
  completion: number
  health: number
  matchDelta: number // vs previous month, in pct points
  weakSpot: ReconType
}

const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n))

export function matchFor(ds: Dataset, tenantId: string, month: Month) {
  const rs = ds.recons.filter((r) => r.tenantId === tenantId && r.month === month)
  const items = rs.reduce((s, r) => s + r.items, 0)
  const matched = rs.reduce((s, r) => s + r.autoMatched + r.manualMatched, 0)
  const auto = rs.reduce((s, r) => s + r.autoMatched, 0)
  return { matchRate: items ? matched / items : 0, autoRate: items ? auto / items : 0 }
}

export function tenantSummary(ds: Dataset, tenantId: string): TenantSummary {
  const { matchRate, autoRate } = matchFor(ds, tenantId, CURRENT_MONTH)
  const prev = matchFor(ds, tenantId, MONTHS[MONTHS.length - 2])
  const exc = ds.exceptions.filter((e) => e.tenantId === tenantId && isOpen(e))
  const aged = exc.filter((e) => ageDays(e) > 60)
  const rs = ds.recons.filter((r) => r.tenantId === tenantId && r.month === CURRENT_MONTH)
  const signed = rs.filter((r) => r.stage === 'Signed off').length
  const stat = ds.monthStats.find((m) => m.tenantId === tenantId && m.month === CURRENT_MONTH)!
  const closeDays = stat.closeDays
  const closeRunning = closeDays === null
  const effClose = closeDays ?? CLOSE_DAY_TODAY + 2
  const openAmount = exc.reduce((s, e) => s + e.amount, 0)
  const aged60Amount = aged.reduce((s, e) => s + e.amount, 0)
  const completion = rs.length ? signed / rs.length : 0

  const health = Math.min(97, Math.round(
    0.4 * clamp(((matchRate - 0.78) / 0.2) * 100) +
      0.25 * clamp(100 - Math.min(55, (openAmount ? aged60Amount / openAmount : 0) * 55 * Math.min(1, aged.length / 5)) - Math.min(30, aged.length * 2.5)) +
      0.2 * clamp(100 - Math.max(0, effClose - 5) * 10) +
      0.15 * completion * 100,
  ))
  return {
    tenantId,
    matchRate,
    autoRate,
    openCount: exc.length,
    openAmount,
    aged60Count: aged.length,
    aged60Amount,
    highOpen: exc.filter((e) => e.priority === 'High').length,
    closeDays,
    closeRunning,
    slaBreach: effClose > CLOSE_SLA_DAYS,
    reconsTotal: rs.length,
    reconsSignedOff: signed,
    completion,
    health,
    matchDelta: (matchRate - prev.matchRate) * 100,
    weakSpot: TENANTS.find((t) => t.id === tenantId)!.profile.weakSpot,
  }
}

export function tenantTrend(ds: Dataset, tenantId: string) {
  return MONTHS.map((month) => {
    const { matchRate, autoRate } = matchFor(ds, tenantId, month)
    const exc = ds.exceptions.filter((e) => e.tenantId === tenantId && e.month === month)
    const stat = ds.monthStats.find((m) => m.tenantId === tenantId && m.month === month)!
    return {
      month,
      matchRate: +(matchRate * 100).toFixed(1),
      autoRate: +(autoRate * 100).toFixed(1),
      raised: exc.length,
      stillOpen: exc.filter(isOpen).length,
      raisedAmount: exc.reduce((s, e) => s + e.amount, 0),
      closeDays: stat.closeDays,
    }
  })
}

export function byReconType(ds: Dataset, tenantId?: string) {
  return RECON_TYPES.map((type) => {
    const exc = ds.exceptions.filter((e) => (!tenantId || e.tenantId === tenantId) && e.reconType === type && isOpen(e))
    return { type, count: exc.length, amount: exc.reduce((s, e) => s + e.amount, 0) }
  })
}

export function portfolioSummary(ds: Dataset) {
  const tenants = TENANTS.map((t) => tenantSummary(ds, t.id))
  const items = ds.recons.filter((r) => r.month === CURRENT_MONTH)
  const totalItems = items.reduce((s, r) => s + r.items, 0)
  const matched = items.reduce((s, r) => s + r.autoMatched + r.manualMatched, 0)
  const open = ds.exceptions.filter(isOpen)
  return {
    tenants,
    matchRate: matched / totalItems,
    openCount: open.length,
    openAmount: open.reduce((s, e) => s + e.amount, 0),
    aged60Amount: tenants.reduce((s, t) => s + t.aged60Amount, 0),
    aged60Count: tenants.reduce((s, t) => s + t.aged60Count, 0),
    closed: tenants.filter((t) => !t.closeRunning).length,
    slaBreaches: tenants.filter((t) => t.slaBreach).length,
    avgHealth: Math.round(tenants.reduce((s, t) => s + t.health, 0) / tenants.length),
    reconsTotal: items.length,
    reconsSignedOff: items.filter((r) => r.stage === 'Signed off').length,
  }
}

export function portfolioTrend(ds: Dataset) {
  return MONTHS.map((month) => {
    const rs = ds.recons.filter((r) => r.month === month)
    const items = rs.reduce((s, r) => s + r.items, 0)
    const matched = rs.reduce((s, r) => s + r.autoMatched + r.manualMatched, 0)
    const auto = rs.reduce((s, r) => s + r.autoMatched, 0)
    const exc = ds.exceptions.filter((e) => e.month === month)
    return {
      month,
      matchRate: +((matched / items) * 100).toFixed(1),
      autoRate: +((auto / items) * 100).toFixed(1),
      raised: exc.length,
      stillOpen: exc.filter(isOpen).length,
    }
  })
}

export function healthBand(h: number) {
  return h >= 80 ? 'good' : h >= 65 ? 'watch' : 'risk'
}

// ---------- formatting ----------
export const fmtAED = (n: number, compact = true) =>
  'AED ' +
  (compact
    ? Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n))
export const fmtPct = (n: number, d = 1) => (n * 100).toFixed(d) + '%'
export const fmtNum = (n: number) => Intl.NumberFormat('en-US').format(n)
