import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { generate, CURRENT_MONTH, type Dataset, type ExceptionStatus, type Recon, type ReconException, type Stage } from '../data/generate'
import { buildFeeds, type Feed } from '../data/finance'
import { allAssurance } from '../lib/assurance'

export interface Activity {
  id: number
  at: string // ISO timestamp
  who: string
  refId: string // recon id or exception id
  tenantId: string
  text: string
  kind: 'system' | 'action' | 'comment'
}

interface DataCtx {
  ds: Dataset
  activity: Activity[]
  setStatus: (id: string, status: ExceptionStatus, who?: string) => void
  bulkStatus: (ids: string[], status: ExceptionStatus, who?: string) => void
  assign: (id: string, owner: string, who?: string) => void
  bulkAssign: (ids: string[], owner: string, who?: string) => void
  setStage: (reconId: string, stage: Stage, who?: string) => void
  autoMatch: (reconId: string, who?: string) => { matched: number; resolved: number }
  comment: (refId: string, tenantId: string, text: string, who: string) => void
  feeds: Feed[]
  upload: (tenantId: string, feedName: string, fileName: string, rows: number, rejected: number) => void
}
const Ctx = createContext<DataCtx | null>(null)
const initial = generate()

// Revenue assurance findings join the exception queue as their own exception types
const assuranceExceptions: ReconException[] = allAssurance().flatMap((a) => {
  const ar = initial.recons.find((r) => r.tenantId === a.tenantId && r.month === CURRENT_MONTH && r.type === 'AR sub-ledger')!
  return a.findings.map((f, i) => ({
    id: f.id,
    tenantId: a.tenantId,
    reconId: ar.id,
    month: CURRENT_MONTH,
    reconType: 'AR sub-ledger' as const,
    account: 'Revenue assurance',
    type: f.type,
    description: f.description,
    counterparty: f.customer ?? (f.type === 'Unidentified cash' ? 'Unknown payer' : 'Internal'),
    amount: Math.round(f.amount),
    raisedOn: `2026-11-${String(10 + (i % 2)).padStart(2, '0')}`,
    owner: ar.preparer,
    status: 'Open' as const,
    priority: f.amount > 250000 ? ('High' as const) : f.amount > 40000 ? ('Medium' as const) : ('Low' as const),
    suggestion: f.fix,
    confidence: 0.9,
  }))
})
initial.exceptions.push(...assuranceExceptions)

let seq = 1
const stamp = (minsAgo: number) => new Date(new Date('2026-11-12T09:00:00').getTime() - minsAgo * 60000).toISOString()

/** Seed a believable audit trail for every reconciliation. */
function seedActivity(ds: Dataset): Activity[] {
  const out: Activity[] = []
  for (const r of ds.recons.filter((x) => x.month === '2026-10')) {
    const base = ([...r.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2400)
    out.push({ id: seq++, at: stamp(base + 9000), who: 'System', refId: r.id, tenantId: r.tenantId, text: `Statement and ledger imported (${r.items.toLocaleString()} items)`, kind: 'system' })
    out.push({ id: seq++, at: stamp(base + 8900), who: 'Auto-match engine', refId: r.id, tenantId: r.tenantId, text: `Auto-matched ${r.autoMatched.toLocaleString()} items using amount, date and reference rules`, kind: 'system' })
    if (r.stage !== 'Not started') out.push({ id: seq++, at: stamp(base + 4000), who: r.preparer, refId: r.id, tenantId: r.tenantId, text: `Manually matched ${r.manualMatched.toLocaleString()} items`, kind: 'action' })
    if (r.stage === 'Pending review' || r.stage === 'Signed off') out.push({ id: seq++, at: stamp(base + 2500), who: r.preparer, refId: r.id, tenantId: r.tenantId, text: 'Submitted for review', kind: 'action' })
    if (r.stage === 'Signed off') out.push({ id: seq++, at: stamp(base + 900), who: r.reviewer, refId: r.id, tenantId: r.tenantId, text: 'Reviewed and signed off', kind: 'action' })
  }
  return out
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [exceptions, setExceptions] = useState(initial.exceptions)
  const [recons, setRecons] = useState<Recon[]>(initial.recons)
  const [activity, setActivity] = useState<Activity[]>(() => seedActivity(initial))
  const [feeds, setFeeds] = useState<Feed[]>(buildFeeds)

  const value = useMemo<DataCtx>(() => {
    const log = (refId: string, tenantId: string, who: string, text: string, kind: Activity['kind'] = 'action') =>
      setActivity((a) => [...a, { id: seq++, at: new Date().toISOString(), who, refId, tenantId, text, kind }])
    const excTenant = (id: string) => exceptions.find((x) => x.id === id)?.tenantId ?? ''

    return {
      ds: { ...initial, exceptions, recons },
      activity,
      setStatus: (id, status, who = 'You') => {
        setExceptions((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)))
        log(id, excTenant(id), who, status === 'Resolved' ? 'Resolved exception' : status === 'In review' ? 'Sent to review' : 'Reopened exception')
      },
      bulkStatus: (ids, status, who = 'You') => {
        setExceptions((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, status } : x)))
        ids.forEach((id) => log(id, excTenant(id), who, status === 'Resolved' ? 'Resolved in bulk' : `Bulk status: ${status}`))
      },
      assign: (id, owner, who = 'You') => {
        setExceptions((xs) => xs.map((x) => (x.id === id ? { ...x, owner } : x)))
        log(id, excTenant(id), who, `Assigned to ${owner}`)
      },
      bulkAssign: (ids, owner, who = 'You') => {
        setExceptions((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, owner } : x)))
        ids.forEach((id) => log(id, excTenant(id), who, `Assigned to ${owner} (bulk)`))
      },
      setStage: (reconId, stage, who = 'You') => {
        const r = recons.find((x) => x.id === reconId)
        setRecons((rs) => rs.map((x) => (x.id === reconId ? { ...x, stage } : x)))
        log(reconId, r?.tenantId ?? '', who, stage === 'Signed off' ? 'Reviewed and signed off' : stage === 'Pending review' ? 'Submitted for review' : `Moved to ${stage}`)
      },
      autoMatch: (reconId, who = 'You') => {
        const r = recons.find((x) => x.id === reconId)!
        const unmatched = r.items - r.autoMatched - r.manualMatched
        const matched = Math.max(0, Math.round(unmatched * 0.55))
        // Low-value timing / charge items get cleared by the rerun
        const clearable = exceptions.filter((e) => e.reconId === reconId && e.status !== 'Resolved' && (e.type === 'Timing difference' || e.type === 'Bank charge not booked' || e.amount < 15000))
        setRecons((rs) => rs.map((x) => (x.id === reconId ? { ...x, autoMatched: x.autoMatched + matched, stage: x.stage === 'Not started' ? 'In progress' : x.stage } : x)))
        setExceptions((xs) => xs.map((x) => (clearable.some((c) => c.id === x.id) ? { ...x, status: 'Resolved' } : x)))
        log(reconId, r.tenantId, 'Auto-match engine', `Re-run by ${who}: matched ${matched} more items, cleared ${clearable.length} exception${clearable.length === 1 ? '' : 's'}`, 'system')
        return { matched, resolved: clearable.length }
      },
      comment: (refId, tenantId, text, who) => log(refId, tenantId, who, text, 'comment'),
      feeds,
      upload: (tenantId, feedName, fileName, rows, rejected) => {
        const now = new Date(new Date('2026-11-12T09:00:00+04:00').getTime() + (1 + Math.floor((Date.now() / 1000) % 50)) * 60_000)
        setFeeds((fs) => [
          { id: `${tenantId}-upload-${Date.now()}`, tenantId, name: `${feedName} (manual upload)`, system: fileName, frequency: 'Ad hoc', lastSync: now.toISOString(), rows, rejected, status: rejected ? 'Warning' : 'OK', note: rejected ? `${rejected} rows failed validation` : 'All rows accepted', uploaded: true },
          ...fs,
        ])
        log(tenantId, tenantId, 'IDO Group Finance', `Uploaded ${fileName}: ${rows.toLocaleString()} rows${rejected ? `, ${rejected} rejected` : ''}`, 'system')
      },
    }
  }, [exceptions, recons, activity, feeds])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useData outside provider')
  return c
}
