import { useParams, useSearchParams } from 'react-router-dom'
import { useRole } from '../../context/RoleContext'
import { useData } from '../../context/DataContext'
import { tenantById } from '../../data/tenants'
import { aging, fmtAED } from '../../lib/metrics'
import ExceptionList from '../../components/ExceptionList'
import { PageHeader } from '../../components/ui'
import { CountUp } from '../../components/fx'

export function AgingTiles({ tenantId }: { tenantId?: string }) {
  const { ds } = useData()
  const [sp, setSp] = useSearchParams()
  const a = aging(ds.exceptions.filter((e) => !tenantId || e.tenantId === tenantId))
  const total = a.reduce((s, b) => s + b.amount, 0) || 1
  const cur = sp.get('age')
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {a.map((b, i) => {
        const on = cur === b.bucket
        return (
          <button
            key={b.bucket}
            onClick={() => {
              const n = new URLSearchParams(sp)
              on ? n.delete('age') : n.set('age', b.bucket)
              setSp(n, { replace: true })
            }}
            className={`card px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${on ? 'border-ido-teal ring-2 ring-ido-teal/20' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">{b.bucket} days</span>
              <span className="text-[11px] text-ido-muted">{Math.round((b.amount / total) * 100)}%</span>
            </div>
            <div className={`mt-1 text-2xl font-semibold ${i >= 2 ? 'text-rose-600' : 'text-ido-primary'}`}><CountUp value={b.count} /></div>
            <div className="text-xs text-ido-slate">{fmtAED(b.amount)}</div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ido-line">
              <div className={`h-full ${i >= 2 ? 'bg-rose-500' : i === 1 ? 'bg-ido-teal' : 'bg-ido-sky'}`} style={{ width: `${(b.amount / total) * 100}%` }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function Exceptions() {
  const { tenantId = '' } = useParams()
  const { persona } = useRole()
  const t = tenantById(tenantId)!
  return (
    <>
      <PageHeader eyebrow={`${t.name} · Queue`} title="Exceptions" subtitle="Every break the matching engine could not clear. Click a row for details and the suggested fix, or tick rows to act in bulk." />
      <AgingTiles tenantId={tenantId} />
      <ExceptionList tenantId={tenantId} readOnly={persona?.kind === 'ido'} />
    </>
  )
}
