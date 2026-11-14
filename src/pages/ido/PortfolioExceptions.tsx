import ExceptionList from '../../components/ExceptionList'
import { PageHeader } from '../../components/ui'
import { AgingTiles } from '../tenant/Exceptions'

export default function PortfolioExceptions() {
  return (
    <>
      <PageHeader eyebrow="Master view" title="All exceptions" subtitle="Every open exception across the portfolio. IDO has read-only access; company finance teams resolve them. You can still comment." />
      <AgingTiles />
      <ExceptionList showTenant readOnly />
    </>
  )
}
