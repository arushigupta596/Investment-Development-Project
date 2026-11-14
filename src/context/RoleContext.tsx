import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { tenantById } from '../data/tenants'

export type Persona = { kind: 'ido'; token: string } | { kind: 'cfo'; tenantId: string }
interface RoleCtx {
  persona: Persona | null
  signIn: (p: Persona) => void
  signOut: () => void
}
const Ctx = createContext<RoleCtx | null>(null)
const KEY = 'ido-recon-persona'

function load(): Persona | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const p = raw ? (JSON.parse(raw) as Persona) : null
    // Drop a saved CFO persona whose company is no longer in the demo
    if (p?.kind === 'cfo' && !tenantById(p.tenantId)) return null
    // IDO sessions need a server-issued token
    if (p?.kind === 'ido' && !p.token) return null
    return p
  } catch {
    return null
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(load)
  const save = (p: Persona | null) => {
    setPersona(p)
    try {
      if (p) sessionStorage.setItem(KEY, JSON.stringify(p))
      else sessionStorage.removeItem(KEY)
    } catch {
      /* storage unavailable */
    }
  }
  // Re-check a saved IDO session with the server (tokens expire and reset when the server restarts)
  useEffect(() => {
    if (persona?.kind !== 'ido') return
    fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: persona.token }) })
      .then((r) => {
        if (!r.ok) save(null)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.kind === 'ido' ? persona.token : null])
  return <Ctx.Provider value={{ persona, signIn: save, signOut: () => save(null) }}>{children}</Ctx.Provider>
}

export const useRole = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRole outside provider')
  return c
}

/** Display name of whoever is acting, for the audit trail. */
export function actorName(p: Persona | null, cfoName?: string) {
  if (!p) return 'Unknown'
  return p.kind === 'ido' ? 'IDO Group Finance' : cfoName ?? 'CFO'
}
