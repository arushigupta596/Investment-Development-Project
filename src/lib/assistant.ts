/**
 * Assistant routing:
 *   1. Cached FAQ (instant, computed from the dashboard data)
 *   2. Live LLM via the local OpenRouter proxy (/api/chat)
 *   3. Offline engine (deterministic intents) when no key is set or the call fails
 */
import { TENANTS } from '../data/tenants'
import { CURRENT_MONTH, MONTHS, type Dataset } from '../data/generate'
import type { Feed } from '../data/finance'
import { faqAnswer, type Answer } from '../data/faqs'
import { answer as offlineAnswer } from './chatEngine'
import { companyKpis, financeTrend, pipelineFor, bs } from './finance'
import { assuranceFor } from './assurance'
import { tenantSummary } from './metrics'
import type { ChartSpec } from '../components/charts'

export type Source = 'cached' | 'llm' | 'llm-cached' | 'offline'
export interface AssistantAnswer extends Answer {
  source: Source
  note?: string
}

let health: Promise<{ live: boolean; model: string | null }> | null = null
/** Checks whether the live model is configured. A negative result is never remembered, so adding a key later works without a reload. */
export function llmHealth() {
  const p = (health ??= fetch('/api/health')
    .then((r) => (r.ok ? r.json() : { live: false, model: null }))
    .catch(() => ({ live: false, model: null })))
  p.then((h) => {
    if (!h.live) health = null
  })
  return p
}

const r0 = (n: number) => Math.round(n)
/** Compact JSON context for the LLM (~20 KB). */
export function buildContext(ds: Dataset, feeds: Feed[]) {
  const companies = TENANTS.map((t) => {
    const k = companyKpis(t.id)
    const rs = tenantSummary(ds, t.id)
    const a = assuranceFor(t.id)
    const b = bs(t.id, CURRENT_MONTH)
    return {
      id: t.id,
      name: t.name,
      sector: t.sector,
      erp: t.erp,
      cfo: t.cfo,
      note: t.profile.story,
      monthly: financeTrend(t.id).map((m) => ({ month: m.month, revenue: r0(m.revenue), revenueBudget: r0(m.revenueBudget), ebitda: r0(m.ebitda), ebitdaBudget: r0(m.ebitdaBudget), netIncome: r0(m.netIncome), cash: r0(m.cash) })),
      october: { revenue: r0(k.revenue), ebitdaMarginPct: +(k.ebitdaMargin * 100).toFixed(1), netIncome: r0(k.netIncome), cash: r0(k.cash), netDebt: r0(k.netDebt), receivables: r0(b.receivables), workingCapital: r0(k.workingCapital), suspense: r0(b.suspense) },
      closePipeline: pipelineFor(ds, feeds, t.id).map((c) => ({ stage: c.stage, status: c.status, detail: c.detail })),
      reconciliation: { matchRatePct: +(rs.matchRate * 100).toFixed(1), openExceptions: rs.openCount, openAmount: r0(rs.openAmount), agedOver60: rs.aged60Count, closeDays: rs.closeDays, closeStillOpen: rs.closeRunning, healthScore: rs.health },
      revenueAssurance: {
        reported: a.reported,
        ledger: a.glRevenue,
        invoicedNet: r0(a.invoicedNet),
        perContract: r0(a.contractCorrect),
        collected: r0(a.collected),
        unpaidPastDue: r0(a.unpaidPastDue),
        verifiedPct: +(a.verifiedPct * 100).toFixed(1),
        checks: a.checks.map((c) => ({ check: c.title, status: c.status, findings: c.findings.length, amount: r0(c.amount) })),
        totalsByFindingType: Object.fromEntries([...new Set(a.findings.map((f) => f.type))].map((ty) => { const fs = a.findings.filter((f) => f.type === ty); return [ty, { count: fs.length, amount: r0(fs.reduce((s, f) => s + f.amount, 0)) }] })),
        valueAtRisk: r0(a.findings.reduce((s, f) => s + f.amount, 0)),
        findings: a.findings.map((f) => ({ type: f.type, customer: f.customer, document: f.invoiceId ?? f.journalId ?? f.receiptId ?? f.contractId, amount: r0(f.amount) })),
      },
      feedIssues: feeds.filter((f) => f.tenantId === t.id && f.status !== 'OK').map((f) => ({ feed: f.name, status: f.status, rejected: f.rejected, note: f.note })),
    }
  })
  return JSON.stringify({ asOf: '2026-11-12', currentMonth: CURRENT_MONTH, months: MONTHS, currency: 'AED', companies })
}

function sanitizeChart(c: unknown): ChartSpec | undefined {
  const s = c as ChartSpec
  if (!s || !Array.isArray(s.data) || !Array.isArray(s.series) || !s.xKey || !s.data.length) return undefined
  if (!['bar', 'hbar', 'line', 'area', 'pie'].includes(s.type)) return undefined
  return { ...s, data: s.data.slice(0, 30), series: s.series.filter((x) => x && x.key).slice(0, 6) }
}
function sanitizeTable(t: unknown): Answer['table'] {
  const s = t as Answer['table']
  if (!s || !Array.isArray(s.columns) || !Array.isArray(s.rows)) return undefined
  return { columns: s.columns.map(String), rows: s.rows.slice(0, 50).map((r) => (Array.isArray(r) ? r : [String(r)])) }
}

function offline(ds: Dataset, q: string, note?: string): AssistantAnswer {
  const a = offlineAnswer(ds, q)
  return {
    text: a.text,
    table: a.table,
    chart: a.trend ? { type: 'line', title: 'Match rate', xKey: 'month', unit: 'pct', series: [{ key: 'matchRate', name: 'Total match rate' }, { key: 'autoRate', name: 'Auto-matched' }], data: a.trend } : undefined,
    followUps: a.followUps,
    source: 'offline',
    note,
  }
}

export async function ask(ds: Dataset, feeds: Feed[], q: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<AssistantAnswer> {
  const faq = faqAnswer(ds, feeds, q)
  if (faq) return { ...faq, source: 'cached' }
  const h = await llmHealth()
  if (!h.live) return offline(ds, q, 'Live LLM is not configured; answered by the offline demo engine.')
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, history, context: buildContext(ds, feeds) }) })
    const body = await r.json()
    if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
    return {
      text: String(body.text ?? ''),
      chart: sanitizeChart(body.chart),
      table: sanitizeTable(body.table),
      followUps: Array.isArray(body.followUps) ? body.followUps.slice(0, 3).map(String) : undefined,
      source: body.cached ? 'llm-cached' : 'llm',
    }
  } catch (e) {
    return offline(ds, q, `Live LLM call failed (${(e as Error).message}); answered by the offline demo engine.`)
  }
}
