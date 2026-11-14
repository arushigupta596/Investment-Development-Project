import type { Recon, ReconException } from '../data/generate'

export interface Line {
  date: string
  ref: string
  desc: string
  amount: number
}
export type PairStatus = 'Auto-matched' | 'Manually matched' | 'Unmatched' | 'Resolved'
export interface Pair {
  key: string
  status: PairStatus
  rule?: string
  source?: Line
  ledger?: Line
  exception?: ReconException
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PARTIES = ['Daman Insurance', 'ADNOC Distribution', 'Etisalat', 'Gulf Marine Services', 'RAK Ceramics', 'DEWA', 'Aramex', 'Emirates Steel', 'Al Futtaim', 'Thiqa', 'Majid Al Futtaim', 'Kuehne+Nagel', 'Hamriyah Trading', 'Medline ME']
const RULES = ['Exact amount + reference', 'Amount + date ±2d', 'Fuzzy reference (92%)', 'One-to-many (3 invoices)', 'Amount + counterparty']

/** Sample of the latest transactions for a reconciliation, deterministic per recon. */
export function samplePairs(r: Recon, exceptions: ReconException[]): { pairs: Pair[]; shown: number } {
  const rand = rng(hash(r.id))
  const [y, m] = r.month.split('-').map(Number)
  const day = () => `${y}-${String(m).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`
  const sourceLabel = r.type === 'Bank' ? 'STMT' : r.type === 'Intercompany' ? 'IC' : 'SUB'
  const pairs: Pair[] = []
  const autoShare = r.autoMatched / Math.max(1, r.autoMatched + r.manualMatched)
  const n = 26

  for (let i = 0; i < n; i++) {
    const party = PARTIES[Math.floor(rand() * PARTIES.length)]
    const amt = Math.round(Math.pow(10, 2.8 + rand() * 2.6) * 100) / 100
    const sign = rand() < 0.55 ? 1 : -1
    const d = day()
    const ref = `${Math.floor(rand() * 900000 + 100000)}`
    const auto = rand() < autoShare
    pairs.push({
      key: `${r.id}-p${i}`,
      status: auto ? 'Auto-matched' : 'Manually matched',
      rule: auto ? RULES[Math.floor(rand() * RULES.length)] : 'Matched by ' + r.preparer,
      source: { date: d, ref: `${sourceLabel}-${ref}`, desc: r.type === 'Bank' ? `${sign > 0 ? 'TRF FRM' : 'PMT TO'} ${party.toUpperCase().slice(0, 18)} ${ref.slice(0, 4)}` : `${party} ${sign > 0 ? 'receipt' : 'invoice'}`, amount: sign * amt },
      ledger: { date: d, ref: `JE-${Math.floor(rand() * 90000 + 10000)}`, desc: `${sign > 0 ? 'Receipt' : 'Payment'} - ${party} INV-${ref.slice(2)}`, amount: sign * amt },
    })
  }

  for (const e of exceptions.filter((x) => x.reconId === r.id)) {
    const sourceSide = /receipt|charge|Duplicate payment|Unapplied|Short|counterparty|FX/i.test(e.type)
    const line: Line = { date: e.raisedOn > `${y}-${String(m).padStart(2, '0')}-31` ? day() : e.raisedOn, ref: e.id, desc: e.description, amount: e.amount }
    pairs.push({
      key: e.id,
      status: e.status === 'Resolved' ? 'Resolved' : 'Unmatched',
      exception: e,
      source: sourceSide ? { ...line, ref: `${sourceLabel}-${e.id.slice(3)}` } : undefined,
      ledger: sourceSide ? undefined : { ...line, ref: `JE-${e.id.slice(3)}` },
    })
  }
  pairs.sort((a, b) => ((b.source ?? b.ledger)!.date > (a.source ?? a.ledger)!.date ? 1 : -1))
  return { pairs, shown: pairs.length }
}
