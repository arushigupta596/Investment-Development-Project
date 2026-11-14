import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { useRole } from './context/RoleContext'
import { tenantById } from './data/tenants'
import { applyBrand } from './lib/brand'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/tenant/Overview'
import Reconciliations from './pages/tenant/Reconciliations'
import Exceptions from './pages/tenant/Exceptions'
import ReconDetail from './pages/tenant/ReconDetail'
import Portfolio from './pages/ido/Portfolio'
import PortfolioExceptions from './pages/ido/PortfolioExceptions'
import Assistant from './pages/ido/Assistant'
import Home from './pages/ido/Home'
import Journey from './pages/ido/Journey'
import DataExplorer from './pages/ido/DataExplorer'
import Financials from './pages/ido/Financials'
import AssuranceOverview from './pages/ido/AssuranceOverview'
import AssuranceDetail from './pages/AssuranceDetail'
import TenantHome from './pages/tenant/TenantHome'
import CompanyJourney from './pages/tenant/CompanyJourney'

export const homeFor = (p: ReturnType<typeof useRole>['persona']) => (!p ? '/' : p.kind === 'ido' ? '/ido' : `/t/${p.tenantId}`)

function RequireIdo() {
  const { persona } = useRole()
  if (!persona) return <Navigate to="/" replace />
  if (persona.kind !== 'ido') return <Navigate to={homeFor(persona)} replace />
  return <Outlet />
}

/** Tenant isolation: a CFO can only ever load their own tenant. */
function RequireTenant() {
  const { persona } = useRole()
  const { tenantId = '' } = useParams()
  if (!persona) return <Navigate to="/" replace />
  if (!tenantById(tenantId)) return <Navigate to={homeFor(persona)} replace />
  if (persona.kind === 'cfo' && persona.tenantId !== tenantId) return <Navigate to={homeFor(persona)} replace state={{ denied: tenantId }} />
  return <Outlet />
}

export default function App() {
  const { persona } = useRole()
  // A CFO sees the app in their company's brand; IDO always sees the IDO theme.
  // Applied during render so every chart in this render already uses the right colours.
  applyBrand(persona?.kind === 'cfo' ? persona.tenantId : null)
  return (
    <Routes>
      <Route path="/" element={persona ? <Navigate to={homeFor(persona)} replace /> : <Login />} />
      <Route element={<Layout />}>
        <Route element={<RequireIdo />}>
          <Route path="/ido" element={<Home />} />
          <Route path="/ido/journey" element={<Journey />} />
          <Route path="/ido/data" element={<DataExplorer />} />
          <Route path="/ido/financials" element={<Financials />} />
          <Route path="/ido/assurance" element={<AssuranceOverview />} />
          <Route path="/ido/assurance/:tenantId" element={<AssuranceDetail />} />
          <Route path="/ido/reconciliation" element={<Portfolio />} />
          <Route path="/ido/exceptions" element={<PortfolioExceptions />} />
          <Route path="/ido/assistant" element={<Assistant />} />
        </Route>
        <Route path="/t/:tenantId" element={<RequireTenant />}>
          <Route index element={<TenantHome />} />
          <Route path="journey" element={<CompanyJourney />} />
          <Route path="data" element={<DataExplorer />} />
          <Route path="financials" element={<Financials />} />
          <Route path="close" element={<Overview />} />
          <Route path="reconciliations" element={<Reconciliations />} />
          <Route path="reconciliations/:reconId" element={<ReconDetail />} />
          <Route path="exceptions" element={<Exceptions />} />
          <Route path="assurance" element={<AssuranceDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
