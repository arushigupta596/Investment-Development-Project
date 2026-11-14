import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BadgeCheck, Building2, Database, FileCheck2, FileSpreadsheet, GitBranch, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquareText, ShieldCheck, X } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { tenantById } from '../data/tenants'
import { monthLabel, CURRENT_MONTH, CLOSE_DAY_TODAY } from '../data/generate'
import { currentBrand } from '../lib/brand'

export default function Layout() {
  const { persona, signOut } = useRole()
  const nav = useNavigate()
  const loc = useLocation()
  const tMatch = useMatch('/t/:tenantId/*')
  const [open, setOpen] = useState(false)
  const tenant = tMatch ? tenantById(tMatch.params.tenantId!) : undefined
  const isIdo = persona?.kind === 'ido'
  const denied = (loc.state as { denied?: string } | null)?.denied

  const items = tenant
    ? [
        { to: `/t/${tenant.id}`, label: 'Home', icon: LayoutDashboard, end: true },
        { to: `/t/${tenant.id}/journey`, label: 'Finance journey', icon: GitBranch },
        { to: `/t/${tenant.id}/data`, label: 'Data explorer', icon: Database },
        { to: `/t/${tenant.id}/financials`, label: 'Financial statements', icon: FileSpreadsheet },
        { to: `/t/${tenant.id}/assurance`, label: 'Revenue assurance', icon: BadgeCheck },
        { to: `/t/${tenant.id}/close`, label: 'Close checklist', icon: ListChecks },
        { to: `/t/${tenant.id}/reconciliations`, label: 'Reconciliations', icon: FileCheck2 },
        { to: `/t/${tenant.id}/exceptions`, label: 'Exceptions', icon: AlertTriangle },
      ]
    : [
        { to: '/ido', label: 'Home', icon: LayoutDashboard, end: true },
        { to: '/ido/journey', label: 'Finance journey', icon: GitBranch },
        { to: '/ido/data', label: 'Data explorer', icon: Database },
        { to: '/ido/financials', label: 'Financial statements', icon: FileSpreadsheet },
        { to: '/ido/assurance', label: 'Revenue assurance', icon: BadgeCheck },
        { to: '/ido/reconciliation', label: 'Reconciliations', icon: FileCheck2 },
        { to: '/ido/exceptions', label: 'All exceptions', icon: AlertTriangle },
        { to: '/ido/assistant', label: 'Ask IDO Assistant', icon: MessageSquareText },
      ]

  // signed out (or an IDO session the server rejected): go to the sign-on page
  if (!persona) return <Navigate to="/" replace />
  const brand = currentBrand()

  const who = isIdo ? { name: 'Group Finance', role: 'IDO master view' } : { name: tenantById((persona as { tenantId: string }).tenantId)?.cfo ?? '', role: `CFO, ${tenant?.name ?? ''}` }

  const sidebar = (
    <div className="flex h-full flex-col bg-ido-navy text-white">
      <div className="flex items-center justify-between px-6 pb-6 pt-7">
        <Link to="/" onClick={() => setOpen(false)}>
          <img src={brand.logoOnDark} alt={brand.appName} className={brand.key === 'ido' ? 'h-9' : 'max-h-10 max-w-[150px] object-contain'} style={brand.invertOnDark ? { filter: 'brightness(0) invert(1)' } : undefined} />
        </Link>
        <button className="text-white/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <div className="mx-6 mb-6 border-t border-white/10 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ido-sky">{brand.key === 'ido' ? 'Finance Supervisor' : `${tenant?.name ?? ''} Finance`}</div>
      </div>

      {tenant && isIdo && (
        <Link to="/ido" onClick={() => setOpen(false)} className="mx-4 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <ArrowLeft size={16} /> Back to IDO home
        </Link>
      )}
      {tenant && (
        <div className="mx-4 mb-4 rounded-lg bg-white/5 px-3 py-3">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Building2 size={13} /> {tenant.sector}
          </div>
          <div className="mt-0.5 font-semibold">{tenant.name}</div>
          <div className="text-xs text-white/50">{tenant.erp} · {tenant.entities} {tenant.entities > 1 ? 'entities' : 'entity'}</div>
        </div>
      )}

      <nav className="flex flex-col gap-1 px-4">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-white text-ido-navy' : 'text-white/75 hover:bg-white/5 hover:text-white'}`
            }
          >
            <it.icon size={18} /> {it.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-4 pb-5">
        {brand.key !== 'ido' && (
          <div className="mb-3 flex items-center gap-2 px-2 text-[11px] text-white/45">
            Powered by <img src="/ido-logo-white.svg" alt="IDO" className="h-5 opacity-70" />
          </div>
        )}
        <div className="mb-3 rounded-lg border border-white/10 px-3 py-3 text-xs text-white/60">
          <div className="font-semibold text-white/90">{monthLabel(CURRENT_MONTH, true)} close</div>
          Business day {CLOSE_DAY_TODAY} · as of 12 Nov 2026
        </div>
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-ido-teal text-sm font-semibold">
            {who.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{who.name}</div>
            <div className="truncate text-xs text-white/50">{who.role}</div>
          </div>
          <button
            title="Switch persona"
            aria-label="Switch persona"
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => {
              signOut()
              nav('/')
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ido-navy/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ido-line bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <button className="text-ido-primary lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <img src={brand.logo} alt={brand.appName} className="h-7 max-w-[110px] object-contain lg:hidden" />
          <div className="hidden text-sm text-ido-slate lg:block">
            {tenant ? (
              <>
                <span className="font-semibold text-ido-primary">{tenant.name}</span> · {tenant.sector}
              </>
            ) : (
              <>
                <span className="font-semibold text-ido-primary">Investment &amp; Development Office</span> · Portfolio finance
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {tenant && isIdo && (
              <span className="hidden items-center gap-1.5 rounded-full bg-ido-primary px-3 py-1 text-xs font-semibold text-white sm:inline-flex">
                <ShieldCheck size={13} /> IDO read-only view
              </span>
            )}
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Demo data</span>
          </div>
        </header>
        {denied && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-8">
            Access denied: your CFO role is scoped to {tenant?.name}. Data for other portfolio companies is not visible.
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
