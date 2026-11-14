/** Immediate actions for IDO Group Finance, derived from the same data as every screen. */
import { TENANTS } from '../data/tenants'
import { CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, CURRENT_MONTH, type Dataset } from '../data/generate'
import type { Feed } from '../data/finance'
import { bs, companyKpis, pipelineFor } from './finance'
import { assuranceFor } from './assurance'
import { tenantSummary } from './metrics'
import { linksFor } from './paths'

export type Severity = 'Critical' | 'High' | 'Medium'
export type Category = 'Close blocker' | 'Revenue at risk' | 'Data feed' | 'Performance' | 'Exceptions'
export interface Action {
  id: string
  severity: Severity
  category: Category
  tenantId: string
  title: string
  detail: string
  impact: number | null // AED at stake
  owner: string
  due: string
  to: string
  cta: string
}

const SEV_RANK: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2 }
const aed = (n: number) => (n >= 1e6 ? `AED ${(n / 1e6).toFixed(1)}M` : `AED ${Math.round(n / 1e3)}K`)

/** All companies for IDO, or one company (with CFO links) when tenantId is given. */
export function buildActions(ds: Dataset, feeds: Feed[], tenantId?: string): Action[] {
  const out: Action[] = []
  for (const t of TENANTS.filter((x) => !tenantId || x.id === tenantId)) {
    const L = linksFor(t.id, !!tenantId)
    const cfo = `${t.cfo} (CFO)`
    const cells = pipelineFor(ds, feeds, t.id, CURRENT_MONTH)
    const a = assuranceFor(t.id)
    const k = companyKpis(t.id)
    const rs = tenantSummary(ds, t.id)
    const sum = (type: string) => a.findings.filter((f) => f.type === type)
    const total = (type: string) => sum(type).reduce((s, f) => s + f.amount, 0)

    // ---- close blockers ----
    const tb = cells.find((c) => c.stage === 'Trial balance')!
    if (tb.status === 'Blocked')
      out.push({ id: `${t.id}-suspense`, severity: 'Critical', category: 'Close blocker', tenantId: t.id, title: 'Clear the suspense balance', detail: `${tb.detail}. The trial balance cannot be signed off and the statements are on hold.`, impact: Math.abs(bs(t.id, CURRENT_MONTH).suspense) || null, owner: cfo, due: 'Today', to: L.ledger('1999'), cta: 'Open suspense ledger' })
    const ingest = cells.find((c) => c.stage === 'Ingest')!
    if (ingest.status === 'Blocked')
      out.push({ id: `${t.id}-feed-failed`, severity: 'Critical', category: 'Data feed', tenantId: t.id, title: 'Fix the failed data feed', detail: `${ingest.detail}. Nothing after ingest can complete until it is re-sent.`, impact: null, owner: cfo, due: 'Today', to: L.feeds, cta: 'View feeds' })
    if (rs.closeRunning && CLOSE_DAY_TODAY > CLOSE_SLA_DAYS)
      out.push({ id: `${t.id}-sla`, severity: 'High', category: 'Close blocker', tenantId: t.id, title: `Close is past the ${CLOSE_SLA_DAYS}-day deadline`, detail: `October is still open on business day ${CLOSE_DAY_TODAY}; ${rs.reconsSignedOff}/${rs.reconsTotal} reconciliations signed off.`, impact: null, owner: cfo, due: 'Today', to: L.reconciliations, cta: 'See reconciliations' })

    // ---- revenue integrity ----
    if (total('Unsupported journal') || total('Report differs from ledger'))
      out.push({ id: `${t.id}-gl`, severity: 'Critical', category: 'Revenue at risk', tenantId: t.id, title: 'Reported revenue is not supported by the ledger', detail: [sum('Unsupported journal').length ? `${sum('Unsupported journal').length} manual revenue journal with no invoice (${aed(total('Unsupported journal'))})` : '', total('Report differs from ledger') ? `management pack differs from the ledger by ${aed(total('Report differs from ledger'))}` : ''].filter(Boolean).join('; ') + '. Hold sign-off until supported or reversed.', impact: total('Unsupported journal') + total('Report differs from ledger'), owner: cfo, due: 'Before sign-off', to: L.assurance, cta: 'Review evidence' })
    if (sum('Duplicate invoice').length)
      out.push({ id: `${t.id}-dup`, severity: 'High', category: 'Revenue at risk', tenantId: t.id, title: `Cancel ${sum('Duplicate invoice').length} duplicate invoice${sum('Duplicate invoice').length > 1 ? 's' : ''}`, detail: `Same contract, period and amount billed twice (${sum('Duplicate invoice').map((f) => f.customer).join(', ')}). Revenue is overstated.`, impact: total('Duplicate invoice'), owner: cfo, due: 'Before sign-off', to: L.assurance, cta: 'Review invoices' })
    if (sum('Missing invoice').length)
      out.push({ id: `${t.id}-missing`, severity: 'High', category: 'Revenue at risk', tenantId: t.id, title: `Raise ${sum('Missing invoice').length} missing invoice${sum('Missing invoice').length > 1 ? 's' : ''}`, detail: `Active contracts were not billed for October (${sum('Missing invoice').map((f) => f.customer).join(', ')}). Revenue is being left on the table.`, impact: total('Missing invoice'), owner: cfo, due: 'This week', to: L.assurance, cta: 'See contracts' })
    const unpaid = total('Unpaid invoice') + total('Short payment')
    if (unpaid > 500_000)
      out.push({ id: `${t.id}-cash`, severity: unpaid > 2_000_000 ? 'High' : 'Medium', category: 'Revenue at risk', tenantId: t.id, title: 'Chase overdue and short-paid invoices', detail: `${sum('Unpaid invoice').length + sum('Short payment').length} October invoices have not been fully paid past their due date.`, impact: unpaid, owner: cfo, due: 'This week', to: L.assurance, cta: 'See bank check' })
    if (sum('Unidentified cash').length)
      out.push({ id: `${t.id}-unid`, severity: 'Medium', category: 'Revenue at risk', tenantId: t.id, title: 'Identify unmatched cash receipts', detail: `${sum('Unidentified cash').length} bank receipt${sum('Unidentified cash').length > 1 ? 's' : ''} match no invoice; could be unbilled sales or prepayments.`, impact: total('Unidentified cash'), owner: cfo, due: 'This week', to: L.assurance, cta: 'See receipts' })

    // ---- data feeds ----
    feeds
      .filter((f) => f.tenantId === t.id && f.status === 'Delayed')
      .forEach((f) => out.push({ id: `${f.id}-delayed`, severity: 'Medium', category: 'Data feed', tenantId: t.id, title: `${f.name} feed is delayed`, detail: f.note ?? 'Latest file not received.', impact: null, owner: cfo, due: 'This week', to: L.feeds, cta: 'View feed' }))

    // ---- performance ----
    const vb = k.revenue / k.revenueBudget - 1
    if (vb < -0.05)
      out.push({ id: `${t.id}-budget`, severity: 'High', category: 'Performance', tenantId: t.id, title: `Revenue ${Math.abs(vb * 100).toFixed(1)}% below budget`, detail: `October revenue ${aed(k.revenue)} against a budget of ${aed(k.revenueBudget)}. Ask for a recovery plan.`, impact: k.revenueBudget - k.revenue, owner: cfo, due: 'This week', to: L.financials(), cta: 'Open P&L' })
    if (k.netIncome < 0)
      out.push({ id: `${t.id}-loss`, severity: 'Medium', category: 'Performance', tenantId: t.id, title: 'Loss-making month', detail: `Net loss of ${aed(-k.netIncome)} in October (EBITDA margin ${(k.ebitdaMargin * 100).toFixed(1)}%).`, impact: -k.netIncome, owner: cfo, due: 'This week', to: L.financials(), cta: 'Open P&L' })

    // ---- reconciliation backlog ----
    if (rs.aged60Count >= 8)
      out.push({ id: `${t.id}-aged`, severity: 'Medium', category: 'Exceptions', tenantId: t.id, title: `${rs.aged60Count} exceptions older than 60 days`, detail: `Aged reconciliation items worth ${aed(rs.aged60Amount)} are still open.`, impact: rs.aged60Amount, owner: cfo, due: 'This week', to: L.exceptionsAged, cta: 'See exceptions' })
  }
  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (b.impact ?? 0) - (a.impact ?? 0))
}
