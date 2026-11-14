/**
 * Cached FAQs: common questions answered instantly from the same data as the dashboards
 * (no LLM call). Each answer is computed live, so it always agrees with the screens.
 */
import { TENANTS, SECTORS, tenantById, type Tenant } from './tenants'
import { CURRENT_MONTH, MONTHS, monthLabel, type Dataset } from './generate'
import type { Feed } from './finance'
import { companyKpis, financeTrend, pipelineFor, pl, bs, STAGES } from '../lib/finance'
import { allAssurance, assuranceFor } from '../lib/assurance'
import { fmtAED, fmtPct, portfolioSummary, tenantSummary } from '../lib/metrics'
import type { ChartSpec } from '../components/charts'

export interface Answer {
  text: string
  chart?: ChartSpec
  table?: { columns: string[]; rows: (string | number)[][] }
  followUps?: string[]
}
export interface FaqCtx {
  ds: Dataset
  feeds: Feed[]
  q: string
  tenant?: Tenant
}
export interface Faq {
  id: string
  question: string
  patterns: RegExp[]
  needsTenant?: boolean
  answer: (c: FaqCtx) => Answer
}

const M = (n: number) => Math.round(n)
const pct1 = (n: number) => Math.round(n * 1000) / 10
const oct = monthLabel(CURRENT_MONTH, true)
const kpisAll = () => TENANTS.map((t) => companyKpis(t.id))

const ALIASES: [RegExp, string][] = [
  [/marjan/, 'marjan'],
  [/stevin|limestone/, 'stevin-rock'],
  [/rak ?gas/, 'rak-gas'],
  [/saqr/, 'saqr-port'],
  [/rak ?ports?\b/, 'rak-ports'],
  [/airport/, 'rak-airport'],
  [/rakez|economic zone/, 'rakez'],
  [/\bicc\b|rak icc/, 'rak-icc'],
  [/innovation city/, 'innovation-city'],
  [/\bahg\b|arabian healthcare/, 'ahg'],
  [/julphar/, 'julphar'],
  [/aurak|american university/, 'aurak'],
  [/mhsu|medical (and|&) health/, 'rak-mhsu'],
  [/rak academy/, 'rak-academy'],
  [/modern school/, 'rak-modern-school'],
]
export function findTenants(q: string): Tenant[] {
  const s = q.toLowerCase()
  return ALIASES.map(([re, id]) => ({ id, at: s.search(re) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((h) => tenantById(h.id)!)
}

export const FAQS: Faq[] = [
  // ---------- company-specific ----------
  {
    id: 'assurance-company',
    question: "Is Julphar's October revenue real?",
    needsTenant: true,
    patterns: [/(real|true|accurate|verif|trust|assur|right|correct|genuine)/, /revenue.*(check|test)/],
    answer: ({ tenant }) => {
      const a = assuranceFor(tenant!.id)
      const risk = a.findings.reduce((s, f) => s + f.amount, 0)
      return {
        text:
          `**${tenant!.name}** reported **${fmtAED(a.reported)}** of revenue for ${oct}. Checked against the ledger, invoices and contracts, and bank statements, **${fmtPct(a.verifiedPct)}** is verified.\n\n` +
          a.checks.map((c) => `- **${c.title}**: ${c.status === 'pass' ? 'pass' : c.summary}`).join('\n') +
          (risk ? `\n\nIn total **${fmtAED(risk)}** is at risk across ${a.findings.length} findings.` : '\n\nNothing to flag.'),
        chart: {
          type: 'bar',
          title: 'Revenue: reported to verified',
          xKey: 'stage',
          series: [{ key: 'amount', name: 'AED' }],
          data: [
            { stage: 'Reported', amount: a.reported },
            { stage: 'Ledger', amount: a.glRevenue },
            { stage: 'Invoiced', amount: a.invoicedNet },
            { stage: 'Per contract', amount: a.contractCorrect },
            { stage: 'Verified', amount: M(a.verifiedPct * a.reported) },
          ],
        },
        table: a.findings.length ? { columns: ['Finding', 'Check', 'Customer', 'Amount (AED)'], rows: a.findings.map((f) => [f.type, a.checks.find((c) => c.id === f.check)!.title, f.customer ?? '-', M(f.amount)]) } : undefined,
        followUps: [`How is ${tenant!.name} performing financially?`, 'Which companies have unpaid invoices?', 'How much revenue is verified across the portfolio?'],
      }
    },
  },
  {
    id: 'company-financials',
    question: 'How is RAK Ports performing financially?',
    needsTenant: true,
    patterns: [/(perform|doing|financ|p ?& ?l|profit|revenue|ebitda|results|summary|overview|how is|how are)/],
    answer: ({ tenant, ds }) => {
      const k = companyKpis(tenant!.id)
      const tr = financeTrend(tenant!.id)
      const rs = tenantSummary(ds, tenant!.id)
      const vb = k.revenue / k.revenueBudget - 1
      return {
        text:
          `**${tenant!.name}** in ${oct}:\n\n` +
          `- Revenue **${fmtAED(k.revenue)}**, ${vb >= 0 ? 'ahead of' : 'behind'} budget by ${fmtPct(Math.abs(vb))}\n` +
          `- EBITDA **${fmtAED(k.ebitda)}** (${fmtPct(k.ebitdaMargin)} margin), net income **${fmtAED(k.netIncome)}**\n` +
          `- Cash **${fmtAED(k.cash)}**, net debt ${fmtAED(k.netDebt)}\n` +
          `- Revenue verified **${fmtPct(k.verifiedPct)}**; reconciliation match rate ${fmtPct(rs.matchRate)} with ${rs.openCount} open exceptions\n\n${tenant!.profile.story}`,
        chart: { type: 'bar', title: `${tenant!.name}: revenue vs budget`, xKey: 'month', series: [{ key: 'revenue', name: 'Revenue' }, { key: 'revenueBudget', name: 'Budget' }], data: tr.map((x) => ({ month: x.month, revenue: M(x.revenue), revenueBudget: M(x.revenueBudget) })) },
        table: { columns: ['Month', 'Revenue', 'EBITDA', 'Net income', 'Cash'], rows: tr.map((x) => [monthLabel(x.month), fmtAED(x.revenue), fmtAED(x.ebitda), fmtAED(x.netIncome), fmtAED(x.cash)]) },
        followUps: [`Is ${tenant!.name}'s October revenue real?`, `What is blocking ${tenant!.name}'s close?`, 'Compare all companies by EBITDA margin'],
      }
    },
  },
  {
    id: 'company-pipeline',
    question: "What is blocking Julphar's close?",
    needsTenant: true,
    patterns: [/(block|stuck|close|pipeline|journey|stage|status|behind)/],
    answer: ({ tenant, ds, feeds }) => {
      const cells = pipelineFor(ds, feeds, tenant!.id)
      const bad = cells.filter((c) => c.status !== 'Done')
      return {
        text: bad.length
          ? `**${tenant!.name}** has ${STAGES.length - bad.length} of ${STAGES.length} stages done for ${oct}. ` + bad.map((c) => `**${c.stage}** is ${c.status.toLowerCase()}: ${c.detail}.`).join(' ')
          : `**${tenant!.name}** has completed every stage of the ${oct} close.`,
        table: { columns: ['Stage', 'Status', 'Detail'], rows: cells.map((c) => [c.stage, c.status, c.detail]) },
        followUps: ['Which companies are blocked?', `How is ${tenant!.name} performing financially?`],
      }
    },
  },
  // ---------- portfolio ----------
  {
    id: 'summary',
    question: 'Give me a portfolio summary',
    patterns: [/(portfolio )?(summary|overview|snapshot|brief)/, /how (is|are) (the )?(portfolio|we|group|companies) (doing|performing)/],
    answer: ({ ds, feeds }) => {
      const p = pl('all', CURRENT_MONTH)
      const b = bs('all', CURRENT_MONTH)
      const rs = portfolioSummary(ds)
      const done = TENANTS.filter((t) => pipelineFor(ds, feeds, t.id).every((c) => c.status === 'Done')).length
      const as = allAssurance()
      const rep = as.reduce((s, a) => s + a.reported, 0)
      const ver = as.reduce((s, a) => s + a.verifiedPct * a.reported, 0) / rep
      const tr = financeTrend('all')
      return {
        text:
          `**${oct} across ${TENANTS.length} portfolio companies** (as of 12 Nov 2026):\n\n` +
          `- Revenue **${fmtAED(p.revenue)}**, EBITDA **${fmtAED(p.ebitda)}** (${fmtPct(p.ebitda / p.revenue)} margin), net income **${fmtAED(p.netIncome)}**\n` +
          `- Cash **${fmtAED(b.cash)}** against borrowings of ${fmtAED(b.borrowings)}\n` +
          `- **${done}/${TENANTS.length}** companies have finished every close stage\n` +
          `- **${fmtPct(ver)}** of reported revenue is verified; reconciliation match rate ${fmtPct(rs.matchRate)}`,
        chart: { type: 'bar', title: 'Portfolio revenue vs budget', xKey: 'month', series: [{ key: 'revenue', name: 'Revenue' }, { key: 'revenueBudget', name: 'Budget' }], data: tr.map((x) => ({ month: x.month, revenue: M(x.revenue), revenueBudget: M(x.revenueBudget) })) },
        followUps: ['Which companies missed their revenue budget?', 'Which closes are blocked?', 'How much revenue is verified across the portfolio?'],
      }
    },
  },
  {
    id: 'revenue-sector',
    question: 'Revenue by sector',
    patterns: [/(revenue|sales|income).*(sector|segment|industr)/, /sector.*(revenue|sales|mix|split)/],
    answer: () => {
      const rows = SECTORS.map((s) => {
        const ks = kpisAll().filter((k) => k.sector === s)
        return { sector: s, revenue: ks.reduce((a, k) => a + k.revenue, 0), ebitda: ks.reduce((a, k) => a + k.ebitda, 0), n: ks.length }
      }).sort((a, b) => b.revenue - a.revenue)
      const tot = rows.reduce((s, r) => s + r.revenue, 0)
      return {
        text: `${oct} revenue was **${fmtAED(tot)}**. **${rows[0].sector}** is the largest sector at ${fmtPct(rows[0].revenue / tot, 0)} of the total, followed by ${rows[1].sector} (${fmtPct(rows[1].revenue / tot, 0)}).`,
        chart: { type: 'pie', title: 'Revenue by sector', xKey: 'sector', series: [{ key: 'revenue' }], data: rows.map((r) => ({ sector: r.sector, revenue: M(r.revenue) })) },
        table: { columns: ['Sector', 'Companies', 'Revenue', 'EBITDA', 'EBITDA margin'], rows: rows.map((r) => [r.sector, r.n, fmtAED(r.revenue), fmtAED(r.ebitda), fmtPct(r.ebitda / r.revenue)]) },
        followUps: ['Compare all companies by EBITDA margin', 'Which companies missed their revenue budget?'],
      }
    },
  },
  {
    id: 'ebitda-margin',
    question: 'Compare all companies by EBITDA margin',
    patterns: [/ebitda margin/, /(most|least|top|best|worst|rank).*(profitab|margin)/, /margin.*(compar|rank|by company)/],
    answer: () => {
      const ks = kpisAll().sort((a, b) => b.ebitdaMargin - a.ebitdaMargin)
      return {
        text: `**${ks[0].name}** has the highest EBITDA margin at **${fmtPct(ks[0].ebitdaMargin)}**; **${ks.at(-1)!.name}** has the lowest at ${fmtPct(ks.at(-1)!.ebitdaMargin)}.`,
        chart: { type: 'hbar', title: `EBITDA margin, ${oct}`, xKey: 'company', unit: 'pct', series: [{ key: 'margin', name: 'EBITDA margin' }], data: ks.map((k) => ({ company: k.name, margin: pct1(k.ebitdaMargin) })) },
        table: { columns: ['Company', 'Revenue', 'EBITDA', 'Margin', 'Net income'], rows: ks.map((k) => [k.name, fmtAED(k.revenue), fmtAED(k.ebitda), fmtPct(k.ebitdaMargin), fmtAED(k.netIncome)]) },
        followUps: ['Which companies made a loss?', 'Revenue by sector'],
      }
    },
  },
  {
    id: 'budget',
    question: 'Which companies missed their revenue budget?',
    patterns: [/budget/, /(miss|beat|behind|ahead|below|above).*(plan|target|forecast)/],
    answer: () => {
      const ks = kpisAll().map((k) => ({ ...k, vb: k.revenue / k.revenueBudget - 1 })).sort((a, b) => a.vb - b.vb)
      const miss = ks.filter((k) => k.vb < 0)
      return {
        text: miss.length
          ? `**${miss.length}** of ${TENANTS.length} companies are below their ${oct} revenue budget. The biggest gap is **${miss[0].name}** at ${fmtPct(miss[0].vb)} (${fmtAED(miss[0].revenue - miss[0].revenueBudget)}).`
          : `Every company met its ${oct} revenue budget.`,
        chart: { type: 'hbar', title: 'Revenue vs budget', xKey: 'company', unit: 'pct', series: [{ key: 'variance', name: 'Variance %' }], data: ks.map((k) => ({ company: k.name, variance: pct1(k.vb) })) },
        table: { columns: ['Company', 'Revenue', 'Budget', 'Variance'], rows: ks.map((k) => [k.name, fmtAED(k.revenue), fmtAED(k.revenueBudget), `${k.vb >= 0 ? '+' : ''}${fmtPct(k.vb)}`]) },
        followUps: [miss.length ? `How is ${miss[0].name} performing financially?` : 'Give me a portfolio summary', 'Revenue by sector'],
      }
    },
  },
  {
    id: 'loss',
    question: 'Which companies made a loss?',
    patterns: [/(loss|losing money|negative (net|profit)|unprofitab)/, /net income/],
    answer: () => {
      const ks = kpisAll().sort((a, b) => a.netIncome - b.netIncome)
      const loss = ks.filter((k) => k.netIncome < 0)
      return {
        text: loss.length ? `**${loss.map((k) => k.name).join(', ')}** made a net loss in ${oct}. ${loss[0].name}'s loss is ${fmtAED(-loss[0].netIncome)}.` : `Every company was profitable in ${oct}.`,
        chart: { type: 'hbar', title: `Net income, ${oct}`, xKey: 'company', series: [{ key: 'ni', name: 'Net income' }], data: ks.map((k) => ({ company: k.name, ni: M(k.netIncome) })) },
        table: { columns: ['Company', 'Net income', 'Net margin'], rows: ks.map((k) => [k.name, fmtAED(k.netIncome), fmtPct(k.netMargin)]) },
        followUps: loss.length ? [`How is ${loss[0].name} performing financially?`] : ['Compare all companies by EBITDA margin'],
      }
    },
  },
  {
    id: 'cash',
    question: 'What is the cash position by company?',
    patterns: [/cash (position|balance)|liquidity|net debt|leverage|borrowing/],
    answer: () => {
      const ks = kpisAll().sort((a, b) => b.cash - a.cash)
      const cash = ks.reduce((s, k) => s + k.cash, 0)
      return {
        text: `Portfolio cash at end of ${oct} is **${fmtAED(cash)}**. **${ks[0].name}** holds the most (${fmtAED(ks[0].cash)}). Net debt is highest at **${[...ks].sort((a, b) => b.netDebt - a.netDebt)[0].name}**.`,
        chart: { type: 'hbar', title: 'Cash and net debt', xKey: 'company', series: [{ key: 'cash', name: 'Cash' }, { key: 'netDebt', name: 'Net debt' }], data: ks.map((k) => ({ company: k.name, cash: M(k.cash), netDebt: M(k.netDebt) })) },
        table: { columns: ['Company', 'Cash', 'Net debt', 'Working capital'], rows: ks.map((k) => [k.name, fmtAED(k.cash), fmtAED(k.netDebt), fmtAED(k.workingCapital)]) },
        followUps: ['Which companies made a loss?', 'Give me a portfolio summary'],
      }
    },
  },
  {
    id: 'trend',
    question: 'Show the revenue trend since May',
    patterns: [/(revenue|ebitda|profit).*(trend|over time|since|month on month|history|growth)/, /trend/],
    answer: () => {
      const tr = financeTrend('all')
      const g = tr.at(-1)!.revenue / tr[0].revenue - 1
      return {
        text: `Portfolio revenue moved from **${fmtAED(tr[0].revenue)}** in May to **${fmtAED(tr.at(-1)!.revenue)}** in October (${g >= 0 ? '+' : ''}${fmtPct(g)}). Education revenue dips over the summer and recovers with the September intake.`,
        chart: { type: 'line', title: 'Portfolio revenue and EBITDA', xKey: 'month', series: [{ key: 'revenue', name: 'Revenue' }, { key: 'budget', name: 'Budget' }, { key: 'ebitda', name: 'EBITDA' }], data: tr.map((x) => ({ month: x.month, revenue: M(x.revenue), budget: M(x.revenueBudget), ebitda: M(x.ebitda) })) },
        table: { columns: ['Month', 'Revenue', 'Budget', 'EBITDA', 'Net income'], rows: tr.map((x) => [monthLabel(x.month), fmtAED(x.revenue), fmtAED(x.revenueBudget), fmtAED(x.ebitda), fmtAED(x.netIncome)]) },
        followUps: ['Which companies missed their revenue budget?', 'Revenue by sector'],
      }
    },
  },
  {
    id: 'blocked',
    question: 'Which closes are blocked?',
    patterns: [/(block|stuck|not (closed|finished|complete)|behind|pipeline|journey|which closes|close status)/],
    answer: ({ ds, feeds }) => {
      const rows = TENANTS.map((t) => ({ t, cells: pipelineFor(ds, feeds, t.id) }))
      const open = rows.filter((r) => r.cells.some((c) => c.status !== 'Done'))
      const blocked = rows.filter((r) => r.cells.some((c) => c.status === 'Blocked'))
      const stageCounts = STAGES.map((s) => ({ stage: s, done: rows.filter((r) => r.cells.find((c) => c.stage === s)!.status === 'Done').length }))
      return {
        text:
          `**${TENANTS.length - open.length}/${TENANTS.length}** companies have completed the ${oct} close. ` +
          (blocked.length ? `**${blocked.length}** are blocked: ` + blocked.map((r) => { const c = r.cells.find((x) => x.status === 'Blocked')!; return `**${r.t.name}** at ${c.stage} (${c.detail})` }).join('; ') + '.' : 'None are blocked.'),
        chart: { type: 'bar', title: 'Companies done at each stage', xKey: 'stage', unit: 'number', series: [{ key: 'done', name: 'Companies done' }], data: stageCounts },
        table: { columns: ['Company', ...STAGES], rows: open.map((r) => [r.t.name, ...r.cells.map((c) => c.status)]) },
        followUps: blocked.length ? [`What is blocking ${blocked[0].t.name}'s close?`, 'Which data feeds have problems?'] : ['Give me a portfolio summary'],
      }
    },
  },
  {
    id: 'feeds',
    question: 'Which data feeds have problems?',
    patterns: [/(feed|upload|file|ingest|data (quality|issue|problem)|rejected|sync)/],
    answer: ({ feeds }) => {
      const bad = feeds.filter((f) => f.status !== 'OK')
      return {
        text: bad.length ? `**${bad.length}** of ${feeds.length} data feeds need attention. ${bad.filter((f) => f.status === 'Failed').length} failed, ${bad.filter((f) => f.status === 'Delayed').length} are delayed and the rest have rejected rows.` : 'All data feeds are running normally.',
        table: { columns: ['Company', 'Feed', 'Status', 'Rejected rows', 'Note'], rows: bad.map((f) => [tenantById(f.tenantId)!.name, f.name, f.status, f.rejected, f.note ?? '']) },
        followUps: ['Which closes are blocked?'],
      }
    },
  },
  {
    id: 'assurance-portfolio',
    question: 'How much revenue is verified across the portfolio?',
    patterns: [/(verif|assur|real|true|accurate|trust).*(revenue|number|portfolio|compan)/, /revenue (assurance|verification)/, /is (the|our) revenue/],
    answer: () => {
      const as = allAssurance().sort((a, b) => a.verifiedPct - b.verifiedPct)
      const rep = as.reduce((s, a) => s + a.reported, 0)
      const ver = as.reduce((s, a) => s + a.verifiedPct * a.reported, 0) / rep
      const risk = as.reduce((s, a) => s + a.findings.reduce((x, f) => x + f.amount, 0), 0)
      return {
        text: `Of **${fmtAED(rep)}** reported revenue in ${oct}, **${fmtPct(ver)}** is verified against bank, ledger and invoices. **${fmtAED(risk)}** is at risk. The lowest is **${tenantById(as[0].tenantId)!.name}** at ${fmtPct(as[0].verifiedPct)}.`,
        chart: { type: 'hbar', title: 'Revenue verified', xKey: 'company', unit: 'pct', series: [{ key: 'verified', name: 'Verified %' }], data: as.map((a) => ({ company: tenantById(a.tenantId)!.name, verified: pct1(a.verifiedPct) })) },
        table: { columns: ['Company', 'Reported', 'Verified', 'Findings', 'At risk'], rows: as.map((a) => [tenantById(a.tenantId)!.name, fmtAED(a.reported), fmtPct(a.verifiedPct), a.findings.length, fmtAED(a.findings.reduce((s, f) => s + f.amount, 0))]) },
        followUps: [`Is ${tenantById(as[0].tenantId)!.name}'s October revenue real?`, 'Which companies have unpaid invoices?', 'Show duplicate invoices'],
      }
    },
  },
  {
    id: 'unpaid',
    question: 'Which companies have unpaid invoices?',
    patterns: [/(unpaid|overdue|past due|not paid|outstanding invoice|short.?paid|collect)/],
    answer: () => {
      const rows = allAssurance().flatMap((a) => a.findings.filter((f) => f.type === 'Unpaid invoice' || f.type === 'Short payment').map((f) => ({ co: tenantById(a.tenantId)!.name, f }))).sort((a, b) => b.f.amount - a.f.amount)
      const tot = rows.reduce((s, r) => s + r.f.amount, 0)
      const by = new Map<string, number>()
      rows.forEach((r) => by.set(r.co, (by.get(r.co) ?? 0) + r.f.amount))
      return {
        text: `**${rows.length}** October invoices are unpaid past due or short-paid, worth **${fmtAED(tot)}**. ${[...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''} has the most cash outstanding.`,
        chart: { type: 'hbar', title: 'Unpaid and short-paid by company', xKey: 'company', series: [{ key: 'amount', name: 'AED' }], data: [...by.entries()].sort((a, b) => b[1] - a[1]).map(([company, amount]) => ({ company, amount: M(amount) })) },
        table: { columns: ['Company', 'Type', 'Customer', 'Invoice', 'Amount (AED)'], rows: rows.map((r) => [r.co, r.f.type, r.f.customer ?? '-', r.f.invoiceId ?? '-', M(r.f.amount)]) },
        followUps: ['Show duplicate invoices', 'How much revenue is verified across the portfolio?'],
      }
    },
  },
  {
    id: 'duplicates',
    question: 'Show duplicate invoices',
    patterns: [/duplicat/, /(price|billing) (mismatch|error)|wrong (price|amount)|missing invoice|overbill|underbill/],
    answer: () => {
      const rows = allAssurance().flatMap((a) => a.findings.filter((f) => f.check === 'billing').map((f) => ({ co: tenantById(a.tenantId)!.name, f })))
      const tot = rows.reduce((s, r) => s + r.f.amount, 0)
      return {
        text: `The invoice and contract check found **${rows.length}** billing issues worth **${fmtAED(tot)}**: ${rows.filter((r) => r.f.type === 'Duplicate invoice').length} duplicate invoices, ${rows.filter((r) => r.f.type === 'Price mismatch').length} price mismatches and ${rows.filter((r) => r.f.type === 'Missing invoice').length} missing invoices.`,
        table: { columns: ['Company', 'Type', 'Customer', 'Document', 'Amount (AED)'], rows: rows.map((r) => [r.co, r.f.type, r.f.customer ?? '-', r.f.invoiceId ?? r.f.contractId ?? '-', M(r.f.amount)]) },
        followUps: ['Which companies have unpaid invoices?', 'How much revenue is verified across the portfolio?'],
      }
    },
  },
  {
    id: 'suspense',
    question: 'Are there any suspense balances?',
    patterns: [/suspense|trial balance|tb (balance|issue)|unbalanced/],
    answer: () => {
      const rows = TENANTS.map((t) => ({ t, s: bs(t.id, CURRENT_MONTH).suspense })).filter((r) => r.s)
      return {
        text: rows.length ? `**${rows.length}** companies have suspense balances blocking their trial balance: ${rows.map((r) => `**${r.t.name}** (${fmtAED(r.s)})`).join(', ')}.` : 'No company has a suspense balance; every trial balance is clean.',
        table: rows.length ? { columns: ['Company', 'Suspense (AED)'], rows: rows.map((r) => [r.t.name, M(r.s)]) } : undefined,
        followUps: ['Which closes are blocked?'],
      }
    },
  },
]

export const FAQ_CHIPS = ['Give me a portfolio summary', 'How much revenue is verified across the portfolio?', 'Which closes are blocked?', 'Which companies missed their revenue budget?', "Is Julphar's October revenue real?", 'Revenue by sector', 'Which companies have unpaid invoices?', 'Compare all companies by EBITDA margin']

/** Returns a cached FAQ answer, or null when the question needs the LLM. */
export function faqAnswer(ds: Dataset, feeds: Feed[], raw: string): Answer | null {
  const q = raw.toLowerCase().trim()
  const ts = findTenants(q)
  // questions about two or more named companies, or open-ended "why/explain" questions, go to the LLM
  if (ts.length > 1 || /\b(why|explain|what if|should|recommend|predict|forecast)\b/.test(q)) return null
  for (const f of FAQS) {
    if (!!f.needsTenant !== (ts.length === 1)) continue
    if (f.patterns.some((p) => p.test(q))) return f.answer({ ds, feeds, q, tenant: ts[0] })
  }
  return null
}

export { MONTHS }
