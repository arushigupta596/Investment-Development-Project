import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, ChevronDown, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react'
import { useRole, type Persona } from '../context/RoleContext'
import { CFO_LOGINS, TENANTS } from '../data/tenants'

interface RoleOption {
  key: string
  persona: Persona | null // null = needs a server-checked sign-in
  title: string
  sub: string
  username: string
}

// CFO roles are demo accounts (any password). IDO Group Finance is checked by the server against .env.
const DEMO_PASSWORD = 'demo1234'
const handle = (name: string) => name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')

const ROLES: RoleOption[] = [
  {
    key: 'ido',
    persona: null,
    title: 'IDO Group Finance',
    sub: `Master view across ${TENANTS.length} companies · secure sign-in`,
    username: '',
  },
  ...TENANTS.filter((t) => CFO_LOGINS.includes(t.id)).map<RoleOption>((t) => ({
    key: t.id,
    persona: { kind: 'cfo', tenantId: t.id },
    title: `CFO, ${t.name}`,
    sub: `${t.cfo} · ${t.sector}`,
    username: `${handle(t.cfo)}@${t.id.replace(/-/g, '')}.demo`,
  })),
]

export default function Login() {
  const { signIn } = useRole()
  const nav = useNavigate()
  const [roleKey, setRoleKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const role = ROLES.find((r) => r.key === roleKey)

  const pick = (r: RoleOption) => {
    setRoleKey(r.key)
    setUsername(r.username)
    setPassword(r.persona ? DEMO_PASSWORD : '')
    setShow(false)
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!role) return setError('Choose a role to sign in as.')
    if (!username.trim()) return setError('Enter your username.')
    if (!password) return setError('Enter your password.')
    setError('')
    setBusy(true)
    if (!role.persona) {
      fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok || !body.token) throw new Error(body.error ?? 'Sign-in failed.')
          signIn({ kind: 'ido', token: body.token })
          nav('/ido')
        })
        .catch((err: Error) => {
          setError(err.message === 'Failed to fetch' ? 'Cannot reach the sign-in server.' : err.message)
          setPassword('')
          setBusy(false)
        })
      return
    }
    const persona = role.persona
    setTimeout(() => {
      signIn(persona)
      nav(persona.kind === 'ido' ? '/ido' : `/t/${persona.tenantId}`)
    }, 450)
  }

  return (
    <div className="flex min-h-full flex-col bg-ido-mist lg:flex-row">
      {/* Brand panel */}
      <div className="relative overflow-hidden bg-ido-navy text-white lg:flex lg:w-[46%] lg:flex-col">
        <div
          className="pointer-events-none absolute -right-28 -top-20 hidden h-[520px] w-[520px] opacity-[0.07] md:block"
          style={{
            backgroundImage: 'url(/favicon.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            filter: 'brightness(0) invert(1)',
            maskImage: 'linear-gradient(to left, black 35%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to left, black 35%, transparent 95%)',
          }}
        />
        <div className="relative flex flex-1 flex-col px-6 py-8 md:px-12 md:py-12">
          <div className="flex items-center justify-between">
            <img src="/ido-logo-white.svg" alt="IDO" className="h-10 md:h-12" />
            <span className="rounded-full border border-amber-300/60 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">Demo data</span>
          </div>
          <div className="mt-10 lg:mt-auto">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ido-sky">Finance Reconciliation Supervisor</div>
            <h1 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl">One close. Every portfolio company.</h1>
            <p className="mt-4 max-w-md text-sm text-white/70 md:text-base">
              Each CFO runs their own reconciliations and clears exceptions. IDO supervises the portfolio in one place, and can simply ask how it is performing.
            </p>
          </div>
          <div className="mt-8 hidden flex-wrap gap-2 lg:flex">
            {TENANTS.map((t) => (
              <span key={t.id} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sign-in form */}
      <div className="flex flex-1 items-start justify-center px-4 py-8 md:px-8 lg:items-center lg:py-12">
        <form onSubmit={submit} className="card w-full max-w-md p-6 shadow-lg md:p-8" noValidate>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ido-sky">
            <ShieldCheck size={14} /> Single sign-on
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-ido-primary">Sign in</h2>
          <p className="mt-1 text-sm text-ido-slate">Select your role, then sign in with your IDO account.</p>

          <label className="mt-6 block">
            <span className="eyebrow">Role</span>
            <div className="relative mt-1.5 flex items-center gap-2 rounded-lg border border-ido-line bg-white px-3 focus-within:border-ido-teal focus-within:ring-1 focus-within:ring-ido-teal">
              <Briefcase size={16} className="text-ido-muted" />
              <select
                value={roleKey}
                onChange={(e) => {
                  const r = ROLES.find((x) => x.key === e.target.value)
                  if (r) pick(r)
                }}
                className={`h-11 w-full appearance-none bg-transparent pr-6 text-sm outline-none ${roleKey ? 'text-ido-navy' : 'text-ido-muted'}`}
              >
                <option value="" disabled>
                  Select a role
                </option>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 text-ido-muted" />
            </div>
            {role && <span className="mt-1.5 block text-xs text-ido-slate">{role.sub}</span>}
          </label>

          <label className="mt-5 block">
            <span className="eyebrow">Username</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-ido-line bg-white px-3 focus-within:border-ido-teal focus-within:ring-1 focus-within:ring-ido-teal">
              <User size={16} className="text-ido-muted" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="name@company"
                className="h-11 w-full bg-transparent text-sm text-ido-navy outline-none placeholder:text-ido-muted"
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="eyebrow">Password</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-ido-line bg-white px-3 focus-within:border-ido-teal focus-within:ring-1 focus-within:ring-ido-teal">
              <Lock size={16} className="text-ido-muted" />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                className="h-11 w-full bg-transparent text-sm text-ido-navy outline-none placeholder:text-ido-muted"
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="text-ido-muted hover:text-ido-primary" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          <button type="submit" disabled={busy} className="btn-primary mt-6 h-11 w-full justify-center disabled:opacity-70">
            {busy ? 'Signing in…' : role ? `Sign in as ${role.title}` : 'Sign in'}
            {!busy && <ArrowRight size={16} />}
          </button>

          <p className="mt-4 text-center text-xs text-ido-muted">
            {role && !role.persona ? 'IDO Group Finance requires your IDO username and password.' : 'CFO roles are demo accounts: selecting one fills in the details.'}
          </p>
        </form>
      </div>
    </div>
  )
}
