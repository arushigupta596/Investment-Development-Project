import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Check, Copy, Cpu, FileDown, FileSpreadsheet, RotateCcw, Sparkles, WifiOff, Zap } from 'lucide-react'
import { useData } from '../context/DataContext'
import { ask, llmHealth, type AssistantAnswer, type Source } from '../lib/assistant'
import { FAQ_CHIPS } from '../data/faqs'
import { downloadCsv, downloadPdf } from '../lib/report'
import { ChartFromSpec } from './charts'

interface Msg {
  id: number
  role: 'user' | 'bot'
  text: string
  ans?: AssistantAnswer
  shown?: number
  q?: string
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-ido-primary">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

export function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim() !== '')
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+\.)\s/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s/, ''))}</li>
              ))}
            </ul>
          )
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {/^#{1,4}\s/.test(l) ? <strong className="font-semibold text-ido-primary">{l.replace(/^#{1,4}\s/, '')}</strong> : /^\s*[-*•]\s/.test(l) ? <>• {inline(l.replace(/^\s*[-*•]\s/, ''))}</> : inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

const SOURCE: Record<Source, { label: string; Icon: typeof Zap; cls: string }> = {
  cached: { label: 'Cached answer', Icon: Zap, cls: 'bg-emerald-50 text-emerald-700' },
  llm: { label: 'Live LLM', Icon: Cpu, cls: 'bg-sky-50 text-sky-700' },
  'llm-cached': { label: 'LLM, cached', Icon: Zap, cls: 'bg-sky-50 text-sky-700' },
  offline: { label: 'Offline engine', Icon: WifiOff, cls: 'bg-slate-100 text-slate-600' },
}

function Action({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ido-muted hover:bg-ido-mist hover:text-ido-teal">
      {icon} {children}
    </button>
  )
}

export default function Chat({ compact, initial, variant = 'page' }: { compact?: boolean; initial?: string; variant?: 'page' | 'hero' }) {
  const { ds, feeds } = useData()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<string>('')
  const [copied, setCopied] = useState(0)
  const [status, setStatus] = useState<{ live: boolean; model: string | null } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const charts = useRef(new Map<number, HTMLDivElement | null>())
  const seq = useRef(1)
  const asked = useRef(false)

  useEffect(() => {
    llmHealth().then(setStatus)
  }, [])
  useEffect(() => {
    if (initial && !asked.current) {
      asked.current = true
      send(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  const send = async (q: string) => {
    const text = q.trim()
    if (!text || busy) return
    setInput('')
    const history = msgs.slice(-6).map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.text }))
    setMsgs((m) => [...m, { id: seq.current++, role: 'user', text }])
    setBusy('Checking cached answers…')
    const slow = window.setTimeout(() => setBusy('Asking the model…'), 500)
    const started = Date.now()
    const ans = await ask(ds, feeds, text, history)
    llmHealth().then(setStatus)
    window.clearTimeout(slow)
    // keep a short pause so cached answers still feel considered
    await new Promise((r) => setTimeout(r, Math.max(0, 350 - (Date.now() - started))))
    const id = seq.current++
    setMsgs((m) => [...m, { id, role: 'bot', text: ans.text, ans, shown: 0, q: text }])
    const timer = window.setInterval(() => {
      setMsgs((m) =>
        m.map((x) => {
          if (x.id !== id) return x
          const next = Math.min(x.text.length, (x.shown ?? 0) + 8)
          if (next >= x.text.length) {
            window.clearInterval(timer)
            setBusy('')
          }
          return { ...x, shown: next }
        }),
      )
    }, 14)
  }

  const bots = msgs.filter((m) => m.role === 'bot' && m.ans)
  const pdfAll = () => downloadPdf(bots.map((m) => ({ question: m.q ?? '', answer: m.ans!, chartEl: charts.current.get(m.id) })), 'IDO Portfolio Assistant conversation')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-ido-line px-4 py-2 text-xs md:px-6">
        {status && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${status.live ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'}`} title={status.live ? `OpenRouter model: ${status.model}` : 'Add OPENROUTER_API_KEY to .env to enable the live model'}>
            {status.live ? <Cpu size={12} /> : <WifiOff size={12} />} {status.live ? `Live LLM · ${status.model}` : 'Offline demo mode'}
          </span>
        )}
        <span className="hidden text-ido-muted sm:inline">Cached FAQs answer instantly</span>
        <div className="ml-auto flex items-center gap-1">
          {bots.length > 0 && (
            <Action onClick={pdfAll} icon={<FileDown size={13} />}>
              Conversation PDF
            </Action>
          )}
          {msgs.length > 0 && (
            <Action onClick={() => !busy && setMsgs([])} icon={<RotateCcw size={12} />}>
              New
            </Action>
          )}
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {!msgs.length && (
          <div className={`mx-auto max-w-3xl ${compact ? 'pt-0' : 'pt-4'}`}>
            {variant === 'page' && (
              <>
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-ido-primary">
                  <img src="/favicon.svg" alt="" className="h-6 w-6" style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ido-primary">Ask about your portfolio</h2>
                <p className="mt-1 text-sm text-ido-slate">Performance, the close, data feeds and whether reported revenue is backed by ledger, invoices and cash. Answers come with charts, tables and a downloadable report.</p>
              </>
            )}
            <div className="eyebrow mb-2 mt-5">Frequently asked</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {FAQ_CHIPS.map((s) => (
                <button key={s} onClick={() => send(s)} className="flex items-center gap-2 rounded-xl border border-ido-line px-4 py-3 text-left text-sm text-ido-primary transition hover:border-ido-sky hover:bg-ido-mist">
                  <Zap size={14} className="shrink-0 text-emerald-600" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {msgs.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ido-primary px-4 py-2.5 text-sm text-white">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ido-mist text-ido-teal">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0 flex-1 text-sm leading-relaxed text-ido-navy/90">
                  {m.ans && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      {(() => {
                        const S = SOURCE[m.ans.source]
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${S.cls}`} title={m.ans.note}>
                            <S.Icon size={11} /> {S.label}
                          </span>
                        )
                      })()}
                      {m.ans.note && <span className="text-[11px] text-ido-muted">{m.ans.note}</span>}
                    </div>
                  )}
                  <Rich text={m.text.slice(0, m.shown ?? m.text.length)} />
                  {m.shown === m.text.length && m.ans && (
                    <>
                      {m.ans.chart && (
                        <div ref={(el) => charts.current.set(m.id, el)} className="mt-3 rounded-xl border border-ido-line p-3">
                          {m.ans.chart.title && <div className="mb-1 text-xs font-semibold text-ido-slate">{m.ans.chart.title}</div>}
                          <ChartFromSpec spec={m.ans.chart} height={230} />
                        </div>
                      )}
                      {m.ans.table && (
                        <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-ido-line">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-ido-mist">
                              <tr>
                                {m.ans.table.columns.map((c) => (
                                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-ido-slate">
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ido-line">
                              {m.ans.table.rows.map((r, i) => (
                                <tr key={i}>
                                  {r.map((c, j) => (
                                    <td key={j} className={`whitespace-nowrap px-3 py-2 ${j === 0 ? 'font-semibold text-ido-primary' : 'tabular-nums'}`}>
                                      {typeof c === 'number' ? c.toLocaleString('en-US') : c}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Action
                          onClick={() => {
                            navigator.clipboard?.writeText(m.text.replace(/\*\*/g, '')).catch(() => {})
                            setCopied(m.id)
                            setTimeout(() => setCopied(0), 1500)
                          }}
                          icon={copied === m.id ? <Check size={13} /> : <Copy size={13} />}
                        >
                          {copied === m.id ? 'Copied' : 'Copy'}
                        </Action>
                        <Action onClick={() => downloadPdf([{ question: m.q ?? '', answer: m.ans!, chartEl: charts.current.get(m.id) }], 'IDO Portfolio Assistant')} icon={<FileDown size={13} />}>
                          PDF report
                        </Action>
                        {(m.ans.table || m.ans.chart) && (
                          <Action onClick={() => downloadCsv(m.ans!)} icon={<FileSpreadsheet size={13} />}>
                            CSV
                          </Action>
                        )}
                      </div>
                      {m.ans.followUps && m.id === msgs[msgs.length - 1].id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.ans.followUps.map((f) => (
                            <button key={f} onClick={() => send(f)} className="rounded-full border border-ido-line px-3 py-1.5 text-xs font-medium text-ido-teal hover:border-ido-sky hover:bg-ido-mist">
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ),
          )}
          {busy && msgs[msgs.length - 1]?.role === 'user' && (
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-ido-mist text-ido-teal">
                <Sparkles size={16} />
              </div>
              <div className="typing flex gap-1 text-2xl leading-none text-ido-sky">
                <span>•</span>
                <span>•</span>
                <span>•</span>
              </div>
              <span className="text-xs text-ido-muted">{busy}</span>
            </div>
          )}
        </div>
      </div>

      <form
        className="border-t border-ido-line bg-white p-3 md:p-4"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-ido-line bg-white py-1.5 pl-5 pr-1.5 focus-within:border-ido-sky focus-within:ring-2 focus-within:ring-ido-sky/30">
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Ask in plain English, e.g. Is Marjan's revenue real?" value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" disabled={!input.trim() || !!busy} className="grid h-9 w-9 place-items-center rounded-full bg-ido-primary text-white transition hover:bg-ido-teal disabled:opacity-30" aria-label="Send">
            <ArrowUp size={18} />
          </button>
        </div>
        <div className="mt-2 text-center text-[11px] text-ido-muted">Demo assistant on fictional data. Check important numbers on the source screens.</div>
      </form>
    </div>
  )
}
