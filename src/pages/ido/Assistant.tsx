import { useSearchParams } from 'react-router-dom'
import Chat from '../../components/Chat'
import { PageHeader } from '../../components/ui'

export default function Assistant() {
  const [sp] = useSearchParams()
  const q = sp.get('q') ?? undefined
  return (
    <>
      <PageHeader eyebrow="Master view" title="IDO Portfolio Assistant" subtitle="Ask in plain English about performance, the close, data feeds and verified revenue across all 15 portfolio companies." />
      <div className="card flex h-[calc(100vh-330px)] min-h-[560px] flex-col overflow-hidden">
        <Chat key={q} initial={q} />
      </div>
    </>
  )
}
