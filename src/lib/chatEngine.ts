import { TENANTS, SECTORS, tenantById, type Sector, type Tenant } from '../data/tenants'
import { CLOSE_DAY_TODAY, CLOSE_SLA_DAYS, MONTHS, monthLabel, type Dataset } from '../data/generate'
import { ageDays, fmtAED, fmtPct, isOpen, portfolioSummary, tenantSummary, tenantTrend, type TenantSummary } from './metrics'

export interface ChatTable {
  columns: string[]
  rows: (string | number)[][]
}
export interface ChatAnswer {
  text: string
  table?: ChatTable
  trend?: { month: string; matchRate: number; autoRate: number }[]
  followUps?: string[]
}

export const SUGGESTED = [
  'Give me a portfolio summary',
  'Which companies need attention?',
  'Who has the most exceptions older than 60 days?',
  'How has RAK Ports improved since July?',
  'Compare Julphar and RAK Ports',
  'Which closes are behind SLA?',
  'What is driving exceptions at Julphar?',
  'Where is our biggest unreconciled exposure?',
]

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
  [/mhsu/, 'rak-mhsu'],
  [/rak academy/, 'rak-academy'],
  [/modern school/, 'rak-modern-school'],
]
const SECTOR_ALIASES: [RegExp, Sector][] = ([
  [/health|pharma|medical/, 'Healthcare & Pharma'],
  [/education|universit|school/, 'Education'],
  [/industr|manufactur/, 'Industry'],
  [/transport|logistic/, 'Transport & Logistics'],
  [/real estate|tourism|property/, 'Real Estate & Tourism'],
  [/business|free ?zone/, 'Business & Finance'],
] as [RegExp, Sector][]).filter(([, sec]) => SECTORS.includes(sec))

function findTenants(q: string): Tenant[] {
  const hits: { id: string; at: number }[] = []
  for (const [re, id] of ALIASES) {
    const m = q.match(re)
    if (m && !hits.some((h) => h.id === id)) hits.push({ id, at: m.index ?? 0 })
  }
  const ids = hits.sort((a, b) => a.at - b.at).map((h) => h.id)
  return ids.map((i) => tenantById(i)!)
}
function findSector(q: string, tenants: Tenant[]): Sector | undefined {
  if (tenants.length) return undefined
  return SECTOR_ALIASES.find(([re]) => re.test(q))?.[1]
}

const has = (q: string, re: RegExp) => re.test(q)
const pts = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)} pts`
const closeTxt = (s: TenantSummary) => (s.closeRunning ? `open (day ${CLOSE_DAY_TODAY})` : `${s.closeDays} days`)
const name = (id: string) => tenantById(id)!.name

export function answer(ds: Dataset, raw: string): ChatAnswer {
  const q = raw.toLowerCase().trim()
  const tenants = findTenants(q)
  const sector = findSector(q, tenants)
  const p = portfolioSummary(ds)
  const scope = (list: TenantSummary[]) => (sector ? list.filter((s) => tenantById(s.tenantId)!.sector === sector) : list)
  const scopeLabel = sector ? `in ${sector}` : 'across the portfolio'

  // ---- compare ----
  if (tenants.length >= 2 || (tenants.length === 2 && has(q, /compar|vs|versus|against/))) {
    const ss = tenants.slice(0, 3).map((t) => tenantSummary(ds, t.id))
    const better = [...ss].sort((a, b) => b.health - a.health)[0]
    return {
      text: `Here is how **${ss.map((s) => name(s.tenantId)).join('** and **')}** compare for the October close. **${name(better.tenantId)}** is in better shape with a health score of ${better.health}.`,
      table: {
        columns: ['Metric', ...ss.map((s) => name(s.tenantId))],
        rows: [
          ['Health score', ...ss.map((s) => s.health)],
          ['Match rate', ...ss.map((s) => fmtPct(s.matchRate))],
          ['Change vs Sep', ...ss.map((s) => pts(s.matchDelta))],
          ['Open exceptions', ...ss.map((s) => s.openCount)],
          ['Unreconciled', ...ss.map((s) => fmtAED(s.openAmount))],
          ['Aged 60d+', ...ss.map((s) => s.aged60Count)],
          ['Close', ...ss.map(closeTxt)],
          ['Main problem area', ...ss.map((s) => s.weakSpot)],
        ],
      },
      followUps: ss.map((s) => `How has ${name(s.tenantId)} trended since May?`),
    }
  }

  // ---- trend ----
  if (has(q, /trend|improv|progress|since|over time|declin|worse|better|history|month on month|momentum/)) {
    if (tenants.length === 1) {
      const t = tenants[0]
      const tr = tenantTrend(ds, t.id)
      const fromIdx = Math.max(0, MONTHS.findIndex((m) => q.includes(monthLabel(m, true).split(' ')[0].toLowerCase())))
      const a = tr[fromIdx]
      const b = tr[tr.length - 1]
      const diff = b.matchRate - a.matchRate
      const closeA = a.closeDays
      const lastClosed = tr.filter((x) => x.closeDays !== null).at(-1)!
      const closeTxtT = b.closeDays === null ? `${closeA} business days to ${lastClosed.closeDays} in ${monthLabel(lastClosed.month, true)}, and October is still open on day ${CLOSE_DAY_TODAY}` : `${closeA} to ${b.closeDays} business days`
      return {
        text:
          `**${t.name}** match rate went from **${a.matchRate}%** in ${monthLabel(a.month, true)} to **${b.matchRate}%** in October (${pts(diff)}). ` +
          `Auto-matching moved from ${a.autoRate}% to ${b.autoRate}%, and close time from ${closeTxtT}.\n\n` +
          `Context: ${t.profile.story}`,
        trend: tr.slice(fromIdx).map(({ month, matchRate, autoRate }) => ({ month, matchRate, autoRate })),
        followUps: [`What are ${t.name}'s largest open exceptions?`, `Compare Julphar and RAK Ports`],
      }
    }
    const rows = scope(p.tenants).map((s) => {
      const tr = tenantTrend(ds, s.tenantId)
      return { s, d: tr.at(-1)!.matchRate - tr[0].matchRate }
    })
    rows.sort((a, b) => b.d - a.d)
    return {
      text: `Match rate change from May to October ${scopeLabel}. **${name(rows[0].s.tenantId)}** improved the most (${pts(rows[0].d)}); **${name(rows.at(-1)!.s.tenantId)}** moved the least favourably (${pts(rows.at(-1)!.d)}).`,
      table: { columns: ['Company', 'May to Oct', 'Oct match rate', 'Health'], rows: rows.map(({ s, d }) => [name(s.tenantId), pts(d), fmtPct(s.matchRate), s.health]) },
      followUps: [`How has ${name(rows[0].s.tenantId)} improved since July?`, `Why is ${name(rows.at(-1)!.s.tenantId)} declining?`],
    }
  }

  // ---- aging ----
  if (has(q, /aged|aging|ageing|older|old |overdue|stale|\b(30|45|60|90|120)\b|backlog/)) {
    const days = Number(q.match(/\b(30|45|60|90|120)\b/)?.[1] ?? 60)
    const filt = (tid?: string) => ds.exceptions.filter((e) => isOpen(e) && ageDays(e) > days && (!tid || e.tenantId === tid))
    if (tenants.length === 1) {
      const xs = filt(tenants[0].id).sort((a, b) => b.amount - a.amount)
      return {
        text: `**${tenants[0].name}** has **${xs.length}** open exceptions older than ${days} days, totalling **${fmtAED(xs.reduce((s, e) => s + e.amount, 0))}**. The largest ones:`,
        table: { columns: ['ID', 'Type', 'Account', 'Amount', 'Age', 'Owner'], rows: xs.slice(0, 8).map((e) => [e.id, e.type, e.reconType, fmtAED(e.amount, false), `${ageDays(e)}d`, e.owner]) },
        followUps: [`How has ${tenants[0].name} trended since May?`, 'Which companies need attention?'],
      }
    }
    const rows = scope(p.tenants)
      .map((s) => {
        const xs = filt(s.tenantId)
        return { id: s.tenantId, n: xs.length, amt: xs.reduce((a, e) => a + e.amount, 0) }
      })
      .filter((r) => r.n)
      .sort((a, b) => b.amt - a.amt)
    const totN = rows.reduce((s, r) => s + r.n, 0)
    const totA = rows.reduce((s, r) => s + r.amt, 0)
    return {
      text: `There are **${totN}** open exceptions older than ${days} days ${scopeLabel}, worth **${fmtAED(totA)}**. **${name(rows[0].id)}** carries the most (${fmtAED(rows[0].amt)}, ${Math.round((rows[0].amt / totA) * 100)}% of the total).`,
      table: { columns: ['Company', `Items > ${days}d`, 'Amount'], rows: rows.map((r) => [name(r.id), r.n, fmtAED(r.amt)]) },
      followUps: [`Show ${name(rows[0].id)}'s exceptions older than ${days} days`, `What is driving exceptions at ${name(rows[0].id)}?`],
    }
  }

  // ---- close / SLA ----
  if (has(q, /close|sla|late|behind|deadline|month.?end|sign.?off|signed/)) {
    const rows = scope(p.tenants).sort((a, b) => (b.closeDays ?? 99) - (a.closeDays ?? 99))
    const running = rows.filter((s) => s.closeRunning)
    const breach = rows.filter((s) => s.slaBreach)
    return {
      text:
        `As of business day ${CLOSE_DAY_TODAY}, **${rows.length - running.length} of ${rows.length}** companies ${scopeLabel} have closed October. ` +
        (breach.length ? `**${breach.length}** are beyond the ${CLOSE_SLA_DAYS}-day SLA: ${breach.map((s) => name(s.tenantId)).join(', ')}.` : `All are within the ${CLOSE_SLA_DAYS}-day SLA.`),
      table: { columns: ['Company', 'Close', 'Signed off', 'Open exceptions'], rows: rows.map((s) => [name(s.tenantId), closeTxt(s), `${s.reconsSignedOff}/${s.reconsTotal}`, s.openCount]) },
      followUps: running.length ? ['Compare Julphar and RAK Ports', 'Which companies need attention?'] : ['Give me a portfolio summary'],
    }
  }

  // ---- drivers / root cause ----
  if (has(q, /driv|cause|why|root|type|categor|breakdown|where .*exception|what kind/)) {
    const pool = ds.exceptions.filter((e) => isOpen(e) && (tenants.length ? tenants.some((t) => t.id === e.tenantId) : !sector || tenantById(e.tenantId)!.sector === sector))
    const by = new Map<string, { n: number; amt: number; area: string }>()
    for (const e of pool) {
      const k = e.type
      const v = by.get(k) ?? { n: 0, amt: 0, area: e.reconType }
      v.n++
      v.amt += e.amount
      by.set(k, v)
    }
    const rows = [...by.entries()].sort((a, b) => b[1].amt - a[1].amt)
    const tot = pool.reduce((s, e) => s + e.amount, 0)
    const label = tenants.length ? tenants[0].name : sector ?? 'the portfolio'
    const top = rows[0]
    return {
      text:
        `Open exceptions at **${label}** total **${fmtAED(tot)}** across ${pool.length} items. The biggest driver is **${top[0]}** (${top[1].area}), at ${fmtAED(top[1].amt)} or ${Math.round((top[1].amt / tot) * 100)}% of the value.` +
        (tenants.length ? `\n\nContext: ${tenants[0].profile.story}` : ''),
      table: { columns: ['Exception type', 'Area', 'Items', 'Amount'], rows: rows.slice(0, 8).map(([k, v]) => [k, v.area, v.n, fmtAED(v.amt)]) },
      followUps: ['Who has the most exceptions older than 60 days?', 'Where is our biggest unreconciled exposure?'],
    }
  }

  // ---- worst / best ----
  const worst = has(q, /worst|lowest|bottom|risk|struggl|attention|concern|problem|weak|focus|red flag|underperform/)
  const best = has(q, /best|top|highest|leader|strongest|outperform|cleanest/)
  if (worst || best) {
    const list = scope(p.tenants).sort((a, b) => (worst ? a.health - b.health : b.health - a.health)).slice(0, 3)
    const bullets = list
      .map((s) =>
        worst
          ? `- **${name(s.tenantId)}** (health ${s.health}): ${fmtPct(s.matchRate)} match rate, ${s.openCount} open exceptions worth ${fmtAED(s.openAmount)}, ${s.aged60Count} older than 60 days. Close ${closeTxt(s)}. Weak spot: ${s.weakSpot}.`
          : `- **${name(s.tenantId)}** (health ${s.health}): ${fmtPct(s.matchRate)} match rate, only ${s.openCount} open exceptions, closed in ${closeTxt(s)}.`,
      )
      .join('\n')
    return {
      text: `${worst ? 'The companies needing the most attention' : 'The strongest performers'} ${scopeLabel} this close:\n\n${bullets}`,
      followUps: list.map((s) => `What is driving exceptions at ${name(s.tenantId)}?`).slice(0, 2).concat(['Compare Julphar and RAK Ports']),
    }
  }

  // ---- exposure ----
  if (has(q, /unreconciled|exposure|amount|balance|money|aed|value|biggest|largest|how much/)) {
    if (tenants.length === 1) {
      const xs = ds.exceptions.filter((e) => e.tenantId === tenants[0].id && isOpen(e)).sort((a, b) => b.amount - a.amount)
      return {
        text: `**${tenants[0].name}** has **${fmtAED(xs.reduce((s, e) => s + e.amount, 0))}** unreconciled across ${xs.length} open exceptions. The largest:`,
        table: { columns: ['ID', 'Type', 'Counterparty', 'Amount', 'Age'], rows: xs.slice(0, 8).map((e) => [e.id, e.type, e.counterparty, fmtAED(e.amount, false), `${ageDays(e)}d`]) },
        followUps: [`What is driving exceptions at ${tenants[0].name}?`],
      }
    }
    const rows = scope(p.tenants).sort((a, b) => b.openAmount - a.openAmount)
    const tot = rows.reduce((s, r) => s + r.openAmount, 0)
    return {
      text: `Total unreconciled ${scopeLabel} is **${fmtAED(tot)}**. **${name(rows[0].tenantId)}** accounts for ${Math.round((rows[0].openAmount / tot) * 100)}% of it.`,
      table: { columns: ['Company', 'Unreconciled', 'Open items', 'High priority'], rows: rows.map((s) => [name(s.tenantId), fmtAED(s.openAmount), s.openCount, s.highOpen]) },
      followUps: [`What are ${name(rows[0].tenantId)}'s largest open exceptions?`, 'What is driving exceptions at Julphar?'],
    }
  }

  // ---- single company summary ----
  if (tenants.length === 1) {
    const t = tenants[0]
    const s = tenantSummary(ds, t.id)
    return {
      text:
        `**${t.name}** (${t.sector}, CFO ${t.cfo}, ${t.erp}):\n\n` +
        `- Health score **${s.health}**\n- Match rate **${fmtPct(s.matchRate)}** (${pts(s.matchDelta)} vs Sep), ${fmtPct(s.autoRate)} auto-matched\n` +
        `- **${s.openCount}** open exceptions worth **${fmtAED(s.openAmount)}**, ${s.aged60Count} older than 60 days\n` +
        `- October close: ${closeTxt(s)}, ${s.reconsSignedOff}/${s.reconsTotal} reconciliations signed off\n\n${t.profile.story}`,
      followUps: [`How has ${t.name} trended since May?`, `What is driving exceptions at ${t.name}?`, `Compare Julphar and RAK Ports`],
    }
  }

  // ---- portfolio / sector summary ----
  if (has(q, /summar|overview|how (is|are|did)|status|portfolio|overall|update|brief|perform|health/) || sector) {
    const list = scope(p.tenants)
    const open = list.reduce((s, t) => s + t.openAmount, 0)
    const sorted = [...list].sort((a, b) => b.health - a.health)
    const running = list.filter((s) => s.closeRunning)
    return {
      text:
        `**October close ${sector ? `for ${sector}` : 'portfolio summary'}** (as of 12 Nov 2026, business day ${CLOSE_DAY_TODAY})\n\n` +
        (sector ? '' : `- Portfolio match rate **${fmtPct(p.matchRate)}** across ${p.reconsTotal} reconciliations\n`) +
        `- **${list.reduce((s, t) => s + t.openCount, 0)}** open exceptions, **${fmtAED(open)}** unreconciled, ${list.reduce((s, t) => s + t.aged60Count, 0)} older than 60 days\n` +
        `- **${list.length - running.length}/${list.length}** closes complete` +
        (running.length ? `; still open: ${running.map((s) => name(s.tenantId)).join(', ')}\n` : '\n') +
        `- Strongest: **${name(sorted[0].tenantId)}** (health ${sorted[0].health}). Weakest: **${name(sorted.at(-1)!.tenantId)}** (health ${sorted.at(-1)!.health})`,
      table: { columns: ['Company', 'Health', 'Match', 'Unreconciled'], rows: sorted.map((s) => [name(s.tenantId), s.health, fmtPct(s.matchRate), fmtAED(s.openAmount)]) },
      followUps: ['Which companies need attention?', 'Which closes are behind SLA?', 'How has RAK Ports improved since July?'],
    }
  }

  return {
    text: `I can answer questions about reconciliation performance across IDO's ${TENANTS.length} portfolio companies in this demo (${TENANTS.map((t) => t.name).join(' and ')}), such as match rates, open and aged exceptions, unreconciled exposure, close timeliness, trends and comparisons. Try one of these:`,
    followUps: SUGGESTED.slice(0, 5),
  }
}

export { SECTORS }
