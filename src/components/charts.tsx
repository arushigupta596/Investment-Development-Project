import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthLabel } from '../data/generate'
import { fmtAED } from '../lib/metrics'

export const C = { primary: '#0A3D50', teal: '#015677', sky: '#759CAF', line: '#DCE5E9', muted: '#808E93', bad: '#E11D48', warn: '#D97706' }
const axis = { fontSize: 12, fill: C.muted }

export function MatchTrend({ data, height = 240 }: { data: { month: string; matchRate: number; autoRate: number }[]; height?: number }) {
  const min = Math.floor(Math.min(...data.map((d) => d.autoRate)) / 5) * 5
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.teal} stopOpacity={0.25} />
            <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={axis} axisLine={false} tickLine={false} />
        <YAxis domain={[min, 100]} tick={axis} axisLine={false} tickLine={false} unit="%" />
        <Tooltip formatter={(v: number) => v + '%'} labelFormatter={(m) => monthLabel(m, true)} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="matchRate" name="Total match rate" stroke={C.teal} strokeWidth={2.5} fill="url(#g1)" dot={{ r: 3 }} />
        <Area type="monotone" dataKey="autoRate" name="Auto-matched" stroke={C.sky} strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function AgingBars({ data, height = 220, onSelect }: { data: { bucket: string; amount: number; count: number }[]; height?: number; onSelect?: (bucket: string) => void }) {
  const colors = [C.sky, C.teal, C.warn, C.bad]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -6, bottom: 0 }} onClick={(e: any) => e?.activeLabel && onSelect?.(e.activeLabel)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="bucket" tick={axis} axisLine={false} tickLine={false} tickFormatter={(b) => b + 'd'} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => fmtAED(v).replace('AED ', '')} />
        <Tooltip cursor={{ fill: 'rgba(117,156,175,0.12)' }} formatter={(v: number, _n, p) => [`${fmtAED(v, false)} (${p.payload.count} items)`, 'Open']} labelFormatter={(b) => `${b} days${onSelect ? ' · click to view' : ''}`} />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]} shape={(props: any) => <rect x={props.x} y={props.y} width={props.width} height={props.height} rx={6} fill={colors[props.index]} />} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TypeBars({ data, height = 260, onSelect }: { data: { type: string; amount: number; count: number }[]; height?: number; onSelect?: (type: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 20, bottom: 0 }} onClick={(e: any) => e?.activeLabel && onSelect?.(e.activeLabel)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
        <CartesianGrid stroke={C.line} horizontal={false} />
        <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => fmtAED(v).replace('AED ', '')} />
        <YAxis type="category" dataKey="type" tick={axis} axisLine={false} tickLine={false} width={110} />
        <Tooltip cursor={{ fill: 'rgba(117,156,175,0.12)' }} formatter={(v: number, _n, p) => [`${fmtAED(v, false)} (${p.payload.count} items)`, 'Open']} labelFormatter={(l) => `${l}${onSelect ? ' · click to view' : ''}`} />
        <Bar dataKey="amount" fill={C.teal} radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- finance + assistant charts ----------
/** Fixed categorical order (never cycled past 6; extra series fold into "Other"). */
export const SERIES = ['#015677', '#759CAF', '#D97706', '#0A3D50', '#9DB8C5', '#B45309']
const isMonth = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)
const tickMoney = (v: number) => fmtAED(v).replace('AED ', '')

export interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'pie' | 'hbar'
  title?: string
  xKey: string
  series: { key: string; name?: string }[]
  data: Record<string, string | number>[]
  unit?: 'aed' | 'pct' | 'number'
}

export function ChartFromSpec({ spec, height = 260 }: { spec: ChartSpec; height?: number }) {
  const fmt = (v: number) => (spec.unit === 'pct' ? `${Math.round(v * 10) / 10}%` : spec.unit === 'number' ? v.toLocaleString('en-US') : fmtAED(v, false))
  const tick = (v: number) => (spec.unit === 'pct' ? `${v}%` : spec.unit === 'number' ? v.toLocaleString('en-US') : tickMoney(v))
  const xTick = (v: string) => (isMonth(v) ? monthLabel(v) : String(v).length > 14 ? String(v).slice(0, 13) + '…' : v)
  const series = spec.series.slice(0, 6)
  const many = series.length > 1
  if (spec.type === 'pie') {
    const k = series[0].key
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={spec.data} dataKey={k} nameKey={spec.xKey} innerRadius="55%" outerRadius="85%" paddingAngle={1.5} stroke="#fff" strokeWidth={2}>
            {spec.data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (spec.type === 'hbar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, spec.data.length * 30 + 40)}>
        <BarChart data={spec.data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={C.line} horizontal={false} />
          <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={tick} />
          <YAxis type="category" dataKey={spec.xKey} tick={axis} axisLine={false} tickLine={false} width={130} tickFormatter={xTick} />
          <Tooltip cursor={{ fill: 'rgba(117,156,175,0.12)' }} formatter={(v: number) => fmt(v)} />
          {many && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={SERIES[i]} radius={[0, 4, 4, 0]} barSize={many ? 10 : 16} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }
  const Chart = spec.type === 'bar' ? BarChart : spec.type === 'line' ? LineChart : AreaChart
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={spec.data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey={spec.xKey} tick={axis} axisLine={false} tickLine={false} tickFormatter={xTick} interval={0} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={tick} width={56} />
        <Tooltip cursor={{ fill: 'rgba(117,156,175,0.12)' }} formatter={(v: number) => fmt(v)} labelFormatter={(l) => (isMonth(l) ? monthLabel(l, true) : l)} />
        {many && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) =>
          spec.type === 'bar' ? (
            <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          ) : spec.type === 'line' ? (
            <Line key={s.key} dataKey={s.key} name={s.name ?? s.key} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
          ) : (
            <Area key={s.key} dataKey={s.key} name={s.name ?? s.key} stroke={SERIES[i]} strokeWidth={2} fill={SERIES[i]} fillOpacity={0.12} type="monotone" />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  )
}

/** Actual vs budget bars with a line for EBITDA. */
export function FinanceTrend({ data, height = 260 }: { data: { month: string; revenue: number; revenueBudget: number; ebitda: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={tickMoney} width={56} />
        <Tooltip formatter={(v: number) => fmtAED(v, false)} labelFormatter={(m) => monthLabel(m, true)} cursor={{ fill: 'rgba(117,156,175,0.12)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Revenue" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="revenueBudget" name="Revenue budget" fill={SERIES[4]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line dataKey="ebitda" name="EBITDA" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Simple waterfall: start, signed steps, end. */
export function Waterfall({ steps, height = 280 }: { steps: { label: string; value: number; total?: boolean }[]; height?: number }) {
  let run = 0
  const data = steps.map((s) => {
    if (s.total) {
      run = s.value
      return { label: s.label, base: 0, up: s.value, raw: s.value, kind: 'total' }
    }
    const from = run
    run += s.value
    return { label: s.label, base: Math.min(from, run), up: Math.abs(s.value), raw: s.value, kind: s.value >= 0 ? 'pos' : 'neg' }
  })
  // zoom the axis so small steps stay visible; totals are clipped at the axis floor
  const lows = data.map((d) => (d.kind === 'total' ? d.up : d.base))
  const lo = Math.max(0, Math.floor((Math.min(...lows) * 0.9) / 1e5) * 1e5)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="label" tick={{ ...axis, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={tickMoney} width={56} domain={[lo, 'auto']} allowDataOverflow />
        <Tooltip cursor={{ fill: 'rgba(117,156,175,0.12)' }} formatter={(_v, _n, p: any) => [fmtAED(p.payload.raw, false), p.payload.label]} labelFormatter={() => ''} />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="up" stackId="w" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.kind === 'total' ? C.primary : d.kind === 'pos' ? '#059669' : C.bad} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
